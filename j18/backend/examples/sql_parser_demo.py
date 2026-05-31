import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sql_parser import SparkSQLParser


def demo_basic_select():
    print("=" * 60)
    print("Demo 1: Basic SELECT with JOIN")
    print("=" * 60)

    sql = """
    SELECT 
        o.order_id,
        o.order_date,
        c.customer_name,
        c.email
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql, "order_customer_view")

    print(f"Source tables: {result.source_tables}")
    print(f"Target table: {result.target_table}")
    print(f"\nField mappings ({len(result.field_mappings)}):")
    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column} "
              f"[{mapping.transformation_type.value}]")
    print()


def demo_aggregate():
    print("=" * 60)
    print("Demo 2: Aggregation with GROUP BY")
    print("=" * 60)

    sql = """
    SELECT 
        customer_id,
        COUNT(order_id) AS order_count,
        SUM(total_amount) AS total_spent,
        AVG(total_amount) AS avg_order
    FROM orders
    WHERE status = 'completed'
    GROUP BY customer_id
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql, "customer_summary")

    print(f"Source tables: {result.source_tables}")
    print(f"Target table: {result.target_table}")
    print(f"\nField mappings ({len(result.field_mappings)}):")
    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column} "
              f"[{mapping.transformation_type.value}]")
        print(f"    Logic: {mapping.transformation_logic}")
    print()


def demo_complex_etl():
    print("=" * 60)
    print("Demo 3: Complex ETL with multiple JOINs and aggregations")
    print("=" * 60)

    sql = """
    CREATE TABLE sales_analytics AS
    SELECT 
        p.product_category,
        r.region_name,
        DATE_TRUNC('quarter', o.order_date) AS sales_quarter,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.quantity * oi.unit_price) AS revenue,
        COUNT(DISTINCT o.customer_id) AS unique_customers
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN customers c ON o.customer_id = c.customer_id
    JOIN regions r ON c.region_id = r.region_id
    WHERE o.order_date >= '2023-01-01'
    GROUP BY p.product_category, r.region_name, DATE_TRUNC('quarter', o.order_date)
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql)

    print(f"Source tables: {result.source_tables}")
    print(f"Target table: {result.target_table}")
    print(f"\nField mappings ({len(result.field_mappings)}):")
    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column} "
              f"[{mapping.transformation_type.value}]")
    print()


def demo_cte():
    print("=" * 60)
    print("Demo 4: CTE (Common Table Expression)")
    print("=" * 60)

    sql = """
    WITH monthly_sales AS (
        SELECT 
            customer_id,
            DATE_TRUNC('month', order_date) AS order_month,
            SUM(total_amount) AS monthly_total
        FROM orders
        GROUP BY customer_id, DATE_TRUNC('month', order_date)
    )
    SELECT 
        c.customer_name,
        ms.order_month,
        ms.monthly_total,
        AVG(ms.monthly_total) OVER (PARTITION BY c.customer_id ORDER BY ms.order_month) AS rolling_avg
    FROM customers c
    JOIN monthly_sales ms ON c.customer_id = ms.customer_id
    """

    parser = SparkSQLParser()
    result = parser.parse_lineage(sql, "customer_monthly_sales")

    print(f"Source tables: {result.source_tables}")
    print(f"Target table: {result.target_table}")
    print(f"\nField mappings ({len(result.field_mappings)}):")
    for mapping in result.field_mappings:
        print(f"  {mapping.source_table}.{mapping.source_column} -> "
              f"{mapping.target_table}.{mapping.target_column} "
              f"[{mapping.transformation_type.value}]")
    print()


if __name__ == "__main__":
    demo_basic_select()
    demo_aggregate()
    demo_complex_etl()
    demo_cte()
