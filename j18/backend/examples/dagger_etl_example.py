import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dagger_integration.lineage_proxy import LineageProxy
import asyncio


proxy = LineageProxy(
    neo4j_uri="bolt://localhost:7687",
    neo4j_user="neo4j",
    neo4j_password="password",
)


@proxy.etl_job(job_name="sales_etl_pipeline", target_table="sales_summary")
def sales_etl_pipeline(_lineage_context=None):
    sql1 = """
    CREATE TABLE sales_summary AS
    SELECT 
        o.order_date,
        c.customer_name,
        SUM(oi.quantity * oi.unit_price) AS total_amount,
        COUNT(DISTINCT o.order_id) AS order_count
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN customers c ON o.customer_id = c.customer_id
    WHERE o.status = 'completed'
    GROUP BY o.order_date, c.customer_name
    """

    @proxy.sql_operation()
    def execute_sql(sql, _lineage_context=None):
        print(f"Executing SQL: {sql[:50]}...")
        return True

    execute_sql(sql1, _lineage_context=_lineage_context)

    sql2 = """
    INSERT INTO monthly_sales
    SELECT 
        DATE_TRUNC('month', order_date) AS sales_month,
        customer_name,
        SUM(total_amount) AS monthly_total,
        SUM(order_count) AS monthly_orders
    FROM sales_summary
    GROUP BY DATE_TRUNC('month', order_date), customer_name
    """

    execute_sql(sql2, _lineage_context=_lineage_context)

    return "ETL job completed successfully"


@proxy.etl_job(job_name="customer_analytics", target_table="customer_ltv")
def customer_ltv_calculation(_lineage_context=None):
    sql = """
    CREATE TABLE customer_ltv AS
    SELECT 
        c.customer_id,
        c.customer_name,
        c.email,
        SUM(s.total_amount) AS lifetime_value,
        COUNT(DISTINCT s.order_date) AS active_days,
        AVG(s.total_amount) AS avg_order_value
    FROM customers c
    LEFT JOIN sales_summary s ON c.customer_name = s.customer_name
    GROUP BY c.customer_id, c.customer_name, c.email
    """

    @proxy.sql_operation()
    def execute_sql(sql, _lineage_context=None):
        print(f"Executing SQL: {sql[:50]}...")
        return True

    execute_sql(sql, _lineage_context=_lineage_context)

    return "Customer LTV calculation completed"


if __name__ == "__main__":
    print("Running Sales ETL Pipeline...")
    result = sales_etl_pipeline()
    print(f"Result: {result}")
    print("\n" + "="*50 + "\n")

    print("Running Customer LTV Calculation...")
    result = customer_ltv_calculation()
    print(f"Result: {result}")
