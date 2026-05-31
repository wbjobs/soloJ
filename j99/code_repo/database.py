import sqlite3
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DB_PATH = "app.db"


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        conn.close()


def init_database():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                stock INTEGER DEFAULT 0,
                category TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_price REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        """)
    logger.info("Database initialized successfully")


def create_order(user_id, items):
    with get_connection() as conn:
        total = 0
        for item in items:
            product = conn.execute(
                "SELECT price, stock FROM products WHERE id = ?",
                (item["product_id"],),
            ).fetchone()
            if not product:
                raise ValueError(f"Product {item['product_id']} not found")
            if product["stock"] < item["quantity"]:
                raise ValueError(f"Insufficient stock for product {item['product_id']}")
            total += product["price"] * item["quantity"]

        cursor = conn.execute(
            "INSERT INTO orders (user_id, total_price) VALUES (?, ?)",
            (user_id, total),
        )
        order_id = cursor.lastrowid

        for item in items:
            product = conn.execute(
                "SELECT price FROM products WHERE id = ?",
                (item["product_id"],),
            ).fetchone()
            conn.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
                (order_id, item["product_id"], item["quantity"], product["price"]),
            )
            conn.execute(
                "UPDATE products SET stock = stock - ? WHERE id = ?",
                (item["quantity"], item["product_id"]),
            )

        return {"order_id": order_id, "total_price": total}


def get_orders_by_user(user_id):
    with get_connection() as conn:
        orders = conn.execute(
            "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        result = []
        for order in orders:
            items = conn.execute(
                """SELECT oi.*, p.name as product_name
                   FROM order_items oi
                   JOIN products p ON oi.product_id = p.id
                   WHERE oi.order_id = ?""",
                (order["id"],),
            ).fetchall()
            result.append({"order": dict(order), "items": [dict(i) for i in items]})
        return result
