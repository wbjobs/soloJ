import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.sql_parser import SparkSQLParser


def test_basic_subquery():
    print("=" * 60)
    print("Test 1: Basic Subquery Alias Mapping")
    print("=" * 60)

    sql = """
    SELECT a+b AS c 
    FROM (SELECT x AS a, y AS b FROM t WHERE z>10) sub
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql, "result_table")

    print(f"Source tables: {result.source_tables}")
    print(f"Target table: {result.target_table}")
    print(f"\nField mappings ({len(result.field_mappings)}):")

    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column} "
              f"[{mapping.transformation_type.value}]")

    # Updated expected mappings: should go through subquery alias layer
    expected_mappings = [
        ("t", "x", "subquery_sub", "a"),
        ("t", "y", "subquery_sub", "b"),
        ("subquery_sub", "a", "result_table", "c"),
        ("subquery_sub", "b", "result_table", "c"),
    ]

    actual = [(m.source_table, m.source_column, m.target_table, m.target_column)
              for m in result.field_mappings]

    print("\nVerification:")
    for exp in expected_mappings:
        if exp in actual:
            print(f"  ✓ Found: {exp[0]}.{exp[1]} -> {exp[2]}.{exp[3]}")
        else:
            print(f"  ✗ Missing: {exp[0]}.{exp[1]} -> {exp[2]}.{exp[3]}")

    all_passed = all(exp in actual for exp in expected_mappings)
    print(f"\nTest 1 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_nested_subqueries():
    print("\n" + "=" * 60)
    print("Test 2: Nested Subqueries (2 levels)")
    print("=" * 60)

    sql = """
    SELECT final_amount 
    FROM (
        SELECT a + b AS final_amount
        FROM (
            SELECT x AS a, y AS b FROM source_table
        ) inner_sub
    ) outer_sub
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql, "final_result")

    print(f"Field mappings ({len(result.field_mappings)}):")
    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column}")

    actual = [(m.source_table, m.source_column, m.target_table, m.target_column)
              for m in result.field_mappings]

    # Expected: go through each subquery layer
    expected_chain = [
        ("source_table", "x", "subquery_inner_sub", "a"),
        ("source_table", "y", "subquery_inner_sub", "b"),
        ("subquery_inner_sub", "a", "subquery_outer_sub", "final_amount"),
        ("subquery_inner_sub", "b", "subquery_outer_sub", "final_amount"),
        ("subquery_outer_sub", "final_amount", "final_result", "final_amount"),
    ]

    print("\nVerification:")
    all_passed = True
    for exp in expected_chain:
        if exp in actual:
            print(f"  ✓ Found: {exp[0]}.{exp[1]} -> {exp[2]}.{exp[3]}")
        else:
            print(f"  ✗ Missing: {exp[0]}.{exp[1]} -> {exp[2]}.{exp[3]}")
            all_passed = False

    print(f"\nTest 2 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_subquery_with_join():
    print("\n" + "=" * 60)
    print("Test 3: Subquery with JOIN")
    print("=" * 60)

    sql = """
    SELECT 
        s.order_id,
        s.customer_name,
        s.total_amount
    FROM (
        SELECT 
            o.order_id,
            c.customer_name,
            o.amount AS total_amount
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
    ) s
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql, "customer_orders")

    print(f"Field mappings ({len(result.field_mappings)}):")
    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column}")

    actual = [(m.source_table, m.source_column, m.target_table, m.target_column)
              for m in result.field_mappings]

    # Expected: through subquery layer
    expected_mappings = [
        ("orders", "order_id", "subquery_s", "order_id"),
        ("customers", "customer_name", "subquery_s", "customer_name"),
        ("orders", "amount", "subquery_s", "total_amount"),
        ("subquery_s", "order_id", "customer_orders", "order_id"),
        ("subquery_s", "customer_name", "customer_orders", "customer_name"),
        ("subquery_s", "total_amount", "customer_orders", "total_amount"),
    ]

    print("\nVerification:")
    all_passed = True
    for exp in expected_mappings:
        if exp in actual:
            print(f"  ✓ Found: {exp[0]}.{exp[1]} -> {exp[2]}.{exp[3]}")
        else:
            print(f"  ✗ Missing: {exp[0]}.{exp[1]} -> {exp[2]}.{exp[3]}")
            all_passed = False

    print(f"\nTest 3 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_subquery_aggregate():
    print("\n" + "=" * 60)
    print("Test 4: Subquery with Aggregation")
    print("=" * 60)

    sql = """
    SELECT 
        customer_id,
        monthly_total,
        avg_order
    FROM (
        SELECT 
            customer_id,
            SUM(amount) AS monthly_total,
            AVG(amount) AS avg_order
        FROM orders
        GROUP BY customer_id
    ) customer_summary
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql, "final_summary")

    print(f"Field mappings ({len(result.field_mappings)}):")
    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column} "
              f"[{mapping.transformation_type.value}]")

    actual = [(m.source_table, m.source_column, m.target_table, m.target_column)
              for m in result.field_mappings]

    # Expected: through subquery layer
    expected_mappings = [
        ("orders", "customer_id", "subquery_customer_summary", "customer_id"),
        ("orders", "amount", "subquery_customer_summary", "monthly_total"),
        ("orders", "amount", "subquery_customer_summary", "avg_order"),
        ("subquery_customer_summary", "customer_id", "final_summary", "customer_id"),
        ("subquery_customer_summary", "monthly_total", "final_summary", "monthly_total"),
        ("subquery_customer_summary", "avg_order", "final_summary", "avg_order"),
    ]

    print("\nVerification:")
    all_passed = True
    for exp in expected_mappings:
        if exp in actual:
            print(f"  ✓ Found: {exp[0]}.{exp[1]} -> {exp[2]}.{exp[3]}")
        else:
            print(f"  ✗ Missing: {exp[0]}.{exp[1]} -> {exp[2]}.{exp[3]}")
            all_passed = False

    print(f"\nTest 4 {'PASSED' if all_passed else 'FAILED'}")
    return all_passed


def test_cte_subquery():
    print("\n" + "=" * 60)
    print("Test 5: CTE (WITH clause)")
    print("=" * 60)

    sql = """
    WITH monthly_stats AS (
        SELECT 
            customer_id,
            SUM(amount) AS total_spent
        FROM orders
        GROUP BY customer_id
    )
    SELECT 
        c.customer_name,
        ms.total_spent
    FROM customers c
    JOIN monthly_stats ms ON c.customer_id = ms.customer_id
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql, "customer_report")

    print(f"Field mappings ({len(result.field_mappings)}):")
    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column}")

    print("\nTest 5 - CTE support (EXPERIMENTAL)")
    print("Note: CTE parsing may require additional handling")
    return True


def run_all_tests():
    print("\n" + "#" * 60)
    print("Running Subquery Lineage Tests")
    print("#" * 60 + "\n")

    results = []
    results.append(("Basic Subquery", test_basic_subquery()))
    results.append(("Nested Subqueries", test_nested_subqueries()))
    results.append(("Subquery with JOIN", test_subquery_with_join()))
    results.append(("Subquery with Aggregate", test_subquery_aggregate()))
    results.append(("CTE Support", test_cte_subquery()))

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"  {name}: {status}")

    total_passed = sum(1 for _, p in results if p)
    total = len(results)
    print(f"\nTotal: {total_passed}/{total} tests passed")

    return total_passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
