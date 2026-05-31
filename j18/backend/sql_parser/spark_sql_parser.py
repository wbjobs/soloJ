from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass
import sqlglot
from sqlglot import exp, parse_one

from ..models.lineage_models import (
    FieldMapping,
    TransformationNode,
    TransformationType,
    ParsedLineageResult,
)


@dataclass
class SubqueryField:
    subquery_alias: str
    output_column: str
    source_table: str
    source_column: str
    transformation_type: TransformationType
    sql_snippet: str


@dataclass
class SubqueryScope:
    alias: str
    select_expr: exp.Select
    field_mappings: Dict[str, SubqueryField]


class SparkSQLParser:
    def __init__(self):
        self.dialect = "spark"

    def parse_lineage(
        self, sql: str, target_table: Optional[str] = None
    ) -> ParsedLineageResult:
        try:
            parsed = parse_one(sql, dialect=self.dialect)
        except Exception as e:
            raise ValueError(f"Failed to parse SQL: {e}")

        source_tables = self._extract_source_tables(parsed)
        actual_target = target_table or self._extract_target_table(parsed)

        if not actual_target:
            raise ValueError("Could not determine target table")

        field_mappings = self._extract_field_mappings_with_subqueries(parsed, actual_target)
        transformations = self._extract_transformations(parsed)

        return ParsedLineageResult(
            source_tables=list(source_tables),
            target_table=actual_target,
            field_mappings=field_mappings,
            transformation_nodes=transformations,
            raw_sql=sql,
        )

    def _extract_source_tables(self, parsed: exp.Expression) -> Set[str]:
        tables = set()

        def find_tables(node):
            if isinstance(node, exp.Table):
                table_name = node.name
                if table_name:
                    tables.add(table_name)
            for child in node.args.values():
                if isinstance(child, list):
                    for item in child:
                        if isinstance(item, exp.Expression):
                            find_tables(item)
                elif isinstance(child, exp.Expression):
                    find_tables(child)

        find_tables(parsed)
        return tables

    def _extract_target_table(self, parsed: exp.Expression) -> Optional[str]:
        if isinstance(parsed, exp.Insert):
            return parsed.this.name if hasattr(parsed.this, "name") else str(parsed.this)
        elif isinstance(parsed, exp.Create):
            if isinstance(parsed.this, exp.Table):
                return parsed.this.name
        elif isinstance(parsed, exp.Select):
            into = parsed.args.get("into")
            if into:
                return into.name if hasattr(into, "name") else str(into)
        return None

    def _extract_field_mappings_with_subqueries(
        self, parsed: exp.Expression, target_table: str
    ) -> List[FieldMapping]:
        mappings = []

        if isinstance(parsed, exp.Select):
            mappings.extend(self._parse_select_with_subqueries(parsed, target_table))
        elif isinstance(parsed, exp.Insert):
            if isinstance(parsed.expression, exp.Select):
                mappings.extend(self._parse_select_with_subqueries(parsed.expression, target_table))
        elif isinstance(parsed, exp.Create):
            if parsed.expression and isinstance(parsed.expression, exp.Select):
                mappings.extend(self._parse_select_with_subqueries(parsed.expression, target_table))

        return mappings

    def _parse_select_with_subqueries(
        self, select_expr: exp.Select, target_table: str
    ) -> List[FieldMapping]:
        all_mappings = []

        subquery_scopes = self._extract_subquery_scopes(select_expr)

        table_aliases = self._get_table_aliases(select_expr)
        for subq in subquery_scopes:
            table_aliases[subq.alias] = f"subquery_{subq.alias}"

        for subq in subquery_scopes:
            subq_internal_mappings = self._parse_subquery_internal_mappings(subq)
            all_mappings.extend(subq_internal_mappings)

        available_tables = self._get_direct_tables(select_expr)

        for i, expr in enumerate(select_expr.expressions):
            target_col = self._get_expression_alias(expr) or f"col_{i}"
            direct_origins = self._trace_direct_origins(
                expr, table_aliases, available_tables
            )

            for source_table, source_col, trans_type, trans_sql in direct_origins:
                all_mappings.append(
                    FieldMapping(
                        source_table=source_table,
                        source_column=source_col,
                        target_table=target_table,
                        target_column=target_col,
                        transformation_type=trans_type,
                        transformation_logic=self._build_transformation_logic(expr, source_table, source_col, target_col),
                        sql_snippet=trans_sql or expr.sql(dialect=self.dialect),
                    )
                )

        join_conditions = self._extract_join_conditions(select_expr, table_aliases)
        for join_cond in join_conditions:
            all_mappings.extend(join_cond)

        return all_mappings

    def _extract_subquery_scopes(self, select_expr: exp.Select) -> List[SubqueryScope]:
        scopes = []

        def get_alias_name(alias_node):
            if alias_node is None:
                return None
            if isinstance(alias_node, exp.Identifier):
                return alias_node.name
            if isinstance(alias_node, exp.TableAlias):
                return alias_node.name
            if hasattr(alias_node, 'name'):
                return alias_node.name
            if hasattr(alias_node, 'this') and isinstance(alias_node.this, exp.Identifier):
                return alias_node.this.name
            return str(alias_node)

        def find_subqueries(node):
            if isinstance(node, exp.Subquery):
                alias_name = get_alias_name(node.alias)
                if alias_name and isinstance(node.this, exp.Select):
                    scope = SubqueryScope(
                        alias=alias_name,
                        select_expr=node.this,
                        field_mappings={},
                    )
                    scopes.append(scope)
                    nested_scopes = self._extract_subquery_scopes(node.this)
                    scopes.extend(nested_scopes)

            for child in node.args.values():
                if isinstance(child, list):
                    for item in child:
                        if isinstance(item, exp.Expression):
                            find_subqueries(item)
                elif isinstance(child, exp.Expression):
                    find_subqueries(child)

        from_clause = select_expr.args.get("from_")
        if from_clause:
            find_subqueries(from_clause)

        joins = select_expr.args.get("joins", [])
        for join in joins:
            find_subqueries(join.this)

        return scopes

    def _get_direct_tables(self, select_expr: exp.Select) -> List[str]:
        tables = []
        
        def find_direct_tables(node):
            if isinstance(node, exp.Table):
                tables.append(node.name)
            elif isinstance(node, exp.Subquery):
                alias = self._get_alias_name(node.alias)
                if alias:
                    tables.append(f"subquery_{alias}")
            elif isinstance(node, exp.From):
                if hasattr(node, 'this') and node.this:
                    find_direct_tables(node.this)
            elif isinstance(node, exp.Alias):
                if hasattr(node, 'this') and node.this:
                    find_direct_tables(node.this)

        from_clause = select_expr.args.get("from_")
        if from_clause:
            find_direct_tables(from_clause)
        
        joins = select_expr.args.get("joins", [])
        for join in joins:
            find_direct_tables(join.this)

        return tables

    def _parse_subquery_internal_mappings(
        self, subq_scope: SubqueryScope
    ) -> List[FieldMapping]:
        mappings = []

        nested_scopes = self._extract_subquery_scopes(subq_scope.select_expr)

        for nested in nested_scopes:
            nested_mappings = self._parse_subquery_internal_mappings(nested)
            mappings.extend(nested_mappings)

        nested_table_aliases = self._get_table_aliases(subq_scope.select_expr)
        for nested in nested_scopes:
            nested_table_aliases[nested.alias] = f"subquery_{nested.alias}"

        available_tables = self._get_direct_tables(subq_scope.select_expr)

        for i, expr in enumerate(subq_scope.select_expr.expressions):
            output_col = self._get_expression_alias(expr) or f"col_{i}"
            direct_origins = self._trace_direct_origins(
                expr, nested_table_aliases, available_tables
            )

            for source_table, source_col, trans_type, trans_sql in direct_origins:
                mappings.append(
                    FieldMapping(
                        source_table=source_table,
                        source_column=source_col,
                        target_table=f"subquery_{subq_scope.alias}",
                        target_column=output_col,
                        transformation_type=trans_type,
                        transformation_logic=f"Subquery alias mapping from {source_table}.{source_col} to {subq_scope.alias}.{output_col}",
                        sql_snippet=trans_sql or expr.sql(dialect=self.dialect),
                    )
                )

        return mappings

    def _trace_direct_origins(
        self,
        expr: exp.Expression,
        table_aliases: Dict[str, str],
        available_tables: List[str] = None,
    ) -> List[Tuple[str, str, TransformationType, str]]:
        origins = []

        def trace(node, current_trans_type: TransformationType = None, current_sql: str = None):
            if isinstance(node, exp.Column):
                table_alias = node.table
                col_name = node.name

                if table_alias:
                    actual_table = table_aliases.get(table_alias, table_alias)
                elif available_tables and len(available_tables) == 1:
                    actual_table = available_tables[0]
                else:
                    actual_table = "unknown"

                origins.append((
                    actual_table,
                    col_name,
                    current_trans_type or TransformationType.SELECT,
                    current_sql or node.sql(dialect=self.dialect),
                ))
                return

            node_trans_type = self._determine_node_transformation_type(node)
            node_sql = node.sql(dialect=self.dialect)

            effective_trans = current_trans_type if current_trans_type else node_trans_type
            effective_sql = current_sql if current_sql else node_sql

            for child in node.args.values():
                if isinstance(child, list):
                    for item in child:
                        if isinstance(item, exp.Expression):
                            trace(item, effective_trans, effective_sql)
                elif isinstance(child, exp.Expression):
                    trace(child, effective_trans, effective_sql)

        trace(expr)

        return origins

    def _get_table_aliases(self, select_expr: exp.Select) -> Dict[str, str]:
        aliases = {}
        from_clause = select_expr.args.get("from_")
        if from_clause:
            self._process_table_node(from_clause, aliases)

        joins = select_expr.args.get("joins", [])
        for join in joins:
            self._process_table_node(join.this, aliases)

        return aliases

    def _get_alias_name(self, alias_node):
        if alias_node is None:
            return None
        if isinstance(alias_node, exp.Identifier):
            return alias_node.name
        if isinstance(alias_node, exp.TableAlias):
            return alias_node.name
        if hasattr(alias_node, 'name'):
            return alias_node.name
        if hasattr(alias_node, 'this') and isinstance(alias_node.this, exp.Identifier):
            return alias_node.this.name
        return str(alias_node)

    def _process_table_node(self, node, aliases: Dict[str, str]):
        if isinstance(node, exp.From):
            if hasattr(node, 'this') and node.this:
                self._process_table_node(node.this, aliases)
        elif isinstance(node, exp.Table):
            table_name = node.name
            alias = self._get_alias_name(node.alias) or table_name
            aliases[alias] = table_name
        elif isinstance(node, exp.Subquery):
            alias = self._get_alias_name(node.alias)
            if alias:
                aliases[alias] = f"subquery_{alias}"
        elif isinstance(node, exp.Alias):
            alias_name = self._get_alias_name(node.alias)
            if isinstance(node.this, exp.Table):
                aliases[alias_name] = node.this.name
            elif isinstance(node.this, exp.Subquery):
                subq_alias = self._get_alias_name(node.this.alias)
                if subq_alias:
                    aliases[subq_alias] = f"subquery_{subq_alias}"
                if alias_name:
                    aliases[alias_name] = f"subquery_{alias_name}"

    def _extract_join_conditions(
        self,
        select_expr: exp.Select,
        table_aliases: Dict[str, str],
    ) -> List[List[FieldMapping]]:
        join_mappings = []
        joins = select_expr.args.get("joins", [])

        for join in joins:
            condition = join.args.get("on")
            if condition:
                mappings = self._parse_join_condition(
                    condition, table_aliases
                )
                join_mappings.append(mappings)

        return join_mappings

    def _parse_join_condition(
        self,
        condition: exp.Expression,
        table_aliases: Dict[str, str],
    ) -> List[FieldMapping]:
        mappings = []
        if isinstance(condition, exp.EQ):
            left_origins = self._trace_direct_origins(condition.left, table_aliases)
            right_origins = self._trace_direct_origins(condition.right, table_aliases)

            for left_table, left_col, _, _ in left_origins:
                for right_table, right_col, _, _ in right_origins:
                    mappings.append(
                        FieldMapping(
                            source_table=left_table,
                            source_column=left_col,
                            target_table=right_table,
                            target_column=right_col,
                            transformation_type=TransformationType.JOIN,
                            transformation_logic=f"JOIN condition: {left_table}.{left_col} = {right_table}.{right_col}",
                            sql_snippet=condition.sql(dialect=self.dialect),
                        )
                    )
        return mappings

    def _get_expression_alias(self, expr: exp.Expression) -> Optional[str]:
        if isinstance(expr, exp.Alias):
            return expr.alias
        if hasattr(expr, "alias") and expr.alias:
            return expr.alias
        if isinstance(expr, exp.Column):
            return expr.name
        return None

    def _determine_node_transformation_type(self, expr: exp.Expression) -> TransformationType:
        if self._is_aggregate_node(expr):
            return TransformationType.AGGREGATE
        elif self._has_function_calls(expr):
            return TransformationType.PROJECT
        return TransformationType.SELECT

    def _determine_transformation_type(self, expr: exp.Expression) -> TransformationType:
        if self._is_aggregate(expr):
            return TransformationType.AGGREGATE
        elif self._is_join(expr):
            return TransformationType.JOIN
        elif self._is_filter(expr):
            return TransformationType.FILTER
        elif len(self._find_function_calls(expr)) > 0:
            return TransformationType.PROJECT
        return TransformationType.SELECT

    def _is_aggregate_node(self, expr: exp.Expression) -> bool:
        agg_funcs = {exp.Sum, exp.Avg, exp.Count, exp.Max, exp.Min}
        if hasattr(exp, 'CountDistinct'):
            agg_funcs.add(exp.CountDistinct)
        return isinstance(expr, tuple(agg_funcs))

    def _has_function_calls(self, expr: exp.Expression) -> bool:
        return isinstance(expr, exp.Func) and not isinstance(expr, exp.Column)

    def _is_aggregate(self, expr: exp.Expression) -> bool:
        agg_funcs = {exp.Sum, exp.Avg, exp.Count, exp.Max, exp.Min}
        if hasattr(exp, 'CountDistinct'):
            agg_funcs.add(exp.CountDistinct)
        for func_type in agg_funcs:
            if expr.find(func_type):
                return True
        return False

    def _is_join(self, expr: exp.Expression) -> bool:
        return expr.find(exp.Join) is not None

    def _is_filter(self, expr: exp.Expression) -> bool:
        return expr.find(exp.Where) is not None

    def _find_function_calls(self, expr: exp.Expression) -> List[exp.Func]:
        funcs = []

        def find_funcs(node):
            if isinstance(node, exp.Func) and not isinstance(node, exp.Column):
                funcs.append(node)
            for child in node.args.values():
                if isinstance(child, list):
                    for item in child:
                        if isinstance(item, exp.Expression):
                            find_funcs(item)
                elif isinstance(child, exp.Expression):
                    find_funcs(child)

        find_funcs(expr)
        return funcs

    def _build_transformation_logic(
        self, expr: exp.Expression, source_table: str, source_col: str, target_col: str
    ) -> str:
        functions = self._find_function_calls(expr)
        if functions:
            func_names = [f.__class__.__name__ for f in functions]
            return f"Applied functions: {', '.join(func_names)} to {source_table}.{source_col} -> {target_col}"
        return f"Direct mapping from {source_table}.{source_col} to {target_col}"

    def _extract_transformations(self, parsed: exp.Expression) -> List[TransformationNode]:
        transformations = []
        trans_id = 0

        def visit(node, parent=None):
            nonlocal trans_id
            trans_type = None
            input_fields = []
            output_fields = []

            if isinstance(node, exp.Join):
                trans_type = TransformationType.JOIN
                table_aliases = self._get_table_aliases(parsed) if isinstance(parsed, exp.Select) else {}
                origins = self._trace_direct_origins(node, table_aliases)
                input_fields = [f"{t}.{c}" for t, c, _, _ in origins]
            elif isinstance(node, exp.Where):
                trans_type = TransformationType.FILTER
            elif isinstance(node, exp.Group):
                trans_type = TransformationType.AGGREGATE
            elif isinstance(node, exp.Select):
                pass

            if trans_type:
                transformations.append(
                    TransformationNode(
                        transformation_id=f"trans_{trans_id}",
                        transformation_type=trans_type,
                        sql_snippet=node.sql(dialect=self.dialect),
                        input_fields=input_fields,
                        output_fields=output_fields,
                        logic=node.sql(dialect=self.dialect),
                    )
                )
                trans_id += 1

            for child in node.args.values():
                if isinstance(child, list):
                    for item in child:
                        if isinstance(item, exp.Expression):
                            visit(item, node)
                elif isinstance(child, exp.Expression):
                    visit(child, node)

        visit(parsed)
        return transformations
