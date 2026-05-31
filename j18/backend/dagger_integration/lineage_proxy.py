import functools
import inspect
import json
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional
from dataclasses import asdict

from ..models.lineage_models import JobExecutionContext, FieldMapping
from ..sql_parser import SparkSQLParser
from ..graph_db import Neo4jAdapter


class LineageProxy:
    def __init__(
        self,
        neo4j_uri: str = "bolt://localhost:7687",
        neo4j_user: str = "neo4j",
        neo4j_password: str = "password",
    ):
        self.sql_parser = SparkSQLParser()
        self.neo4j_adapter = Neo4jAdapter(neo4j_uri, neo4j_user, neo4j_password)
        self.active_jobs: Dict[str, JobExecutionContext] = {}

    def _generate_job_id(self) -> str:
        return f"job_{datetime.now().strftime('%Y%m%d%H%M%S')}_{abs(hash(datetime.now())) % 10000}"

    def etl_job(
        self, job_name: Optional[str] = None, target_table: Optional[str] = None
    ) -> Callable:
        def decorator(func: Callable) -> Callable:
            @functools.wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                job_id = self._generate_job_id()
                actual_job_name = job_name or func.__name__

                context = JobExecutionContext(
                    job_id=job_id,
                    job_name=actual_job_name,
                    start_time=datetime.now().isoformat(),
                )
                self.active_jobs[job_id] = context

                try:
                    result = func(*args, **kwargs, _lineage_context=context)
                    self._process_job_lineage(context, target_table)
                    context.status = "success"
                except Exception as e:
                    context.status = "failed"
                    raise
                finally:
                    context.end_time = datetime.now().isoformat()
                    self._persist_job_metadata(context)

                return result

            return wrapper

        return decorator

    def sql_operation(self, operation_type: str = "query") -> Callable:
        def decorator(func: Callable) -> Callable:
            @functools.wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                _lineage_context = kwargs.get("_lineage_context")
                sql = self._extract_sql_from_args(args, kwargs)

                if _lineage_context and sql:
                    _lineage_context.sql_statements.append(sql)

                result = func(*args, **kwargs)

                if _lineage_context and sql:
                    try:
                        lineage_result = self.sql_parser.parse_lineage(sql)
                        _lineage_context.lineage_records.extend(lineage_result.field_mappings)
                    except Exception as e:
                        pass

                return result

            return wrapper

        return decorator

    def _extract_sql_from_args(self, args: tuple, kwargs: dict) -> Optional[str]:
        for arg in args:
            if isinstance(arg, str) and arg.strip().lower().startswith(("select", "insert", "create", "with")):
                return arg

        for key, value in kwargs.items():
            if isinstance(value, str) and value.strip().lower().startswith(("select", "insert", "create", "with")):
                return value

        return None

    def _process_job_lineage(
        self, context: JobExecutionContext, target_table: Optional[str] = None
    ) -> None:
        for sql in context.sql_statements:
            try:
                lineage_result = self.sql_parser.parse_lineage(sql, target_table)
                self.neo4j_adapter.store_lineage(lineage_result, context.job_id)
            except Exception as e:
                pass

    def _persist_job_metadata(self, context: JobExecutionContext) -> None:
        self.neo4j_adapter.store_job_metadata(context)


class DaggerLineageWrapper:
    def __init__(self, proxy: LineageProxy):
        self.proxy = proxy

    def wrap_container(self, container, job_context: JobExecutionContext):
        original_with_exec = container.with_exec

        @functools.wraps(original_with_exec)
        def wrapped_with_exec(*args, **kwargs):
            exec_args = args[0] if args else kwargs.get("args", [])
            sql_statement = self._extract_sql_from_command(exec_args)

            if sql_statement and job_context:
                job_context.sql_statements.append(sql_statement)
                try:
                    lineage_result = self.proxy.sql_parser.parse_lineage(sql_statement)
                    job_context.lineage_records.extend(lineage_result.field_mappings)
                    self.proxy.neo4j_adapter.store_lineage(lineage_result, job_context.job_id)
                except Exception as e:
                    pass

            return original_with_exec(*args, **kwargs)

        container.with_exec = wrapped_with_exec
        return container

    def _extract_sql_from_command(self, command_args: List[str]) -> Optional[str]:
        command_str = " ".join(command_args)
        sql_match = self._find_sql_pattern(command_str)
        return sql_match

    def _find_sql_pattern(self, text: str) -> Optional[str]:
        import re

        patterns = [
            r"SELECT[\s\S]*?(?:;|$)",
            r"INSERT[\s\S]*?(?:;|$)",
            r"CREATE[\s\S]*?(?:;|$)",
            r"WITH[\s\S]*?(?:;|$)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)

        return None
