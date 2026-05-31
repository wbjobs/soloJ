"""
用户认证模块
============
这个模块提供了用户登录、注册、权限校验等功能。

作者：开发团队
创建时间：2024-01-01
最后修改：2024-12-01

注意事项：
- 密码使用 SHA-256 加密（生产环境应替换为 bcrypt）
- Session 存储在内存中，重启会丢失
- 需要配置 SECRET_KEY 环境变量

使用示例：
    from auth import login, register
    login("admin", "password123")
"""

# ============================================
# 导入依赖
# ============================================
import hashlib      # 哈希加密
import os           # 操作系统接口
import re           # 正则表达式
from functools import wraps  # 装饰器工具
from typing import Optional, Dict, List  # 类型注解

# 第三方库
from flask import Flask, request, jsonify, session

# ============================================
# 全局配置
# ============================================
app = Flask(__name__)

# SECRET_KEY 用于签名 session cookie
# 生产环境务必从环境变量读取
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")

# 数据库路径
DB_PATH = "users.db"

# 密码最小长度
MIN_PASSWORD_LENGTH = 8

# 用户名规则：只允许字母数字下划线
USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_]{3,20}$')

# 最大登录尝试次数
MAX_LOGIN_ATTEMPTS = 5

# 登录失败锁定时间（秒）
LOCKOUT_DURATION = 300

# ============================================
# 数据库连接
# ============================================


def get_db():
    """获取数据库连接

    Returns:
        sqlite3.Connection: 数据库连接对象

    Note:
        使用了 row_factory 以便通过列名访问行数据
    """
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """初始化数据库，创建用户表

    表结构：
        - id: 主键，自增
        - username: 用户名，唯一
        - password_hash: 密码哈希值
        - email: 邮箱（可选）
        - is_admin: 是否管理员
        - created_at: 创建时间
    """
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


# ============================================
# 密码加密
# ============================================


def hash_password(password: str) -> str:
    """对密码进行哈希加密

    使用 SHA-256 算法对密码进行哈希处理。
    生产环境建议使用 bcrypt 或 argon2。

    Args:
        password: 明文密码

    Returns:
        str: 哈希后的密码字符串

    Example:
        >>> hash_password("mypass")
        '89e01536a...',
    """
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """验证密码是否匹配

    Args:
        password: 用户输入的明文密码
        password_hash: 数据库存储的哈希值

    Returns:
        bool: 密码是否匹配
    """
    return hash_password(password) == password_hash


# ============================================
# 登录认证
# ============================================


def login_required(f):
    """登录验证装饰器

    用于保护需要登录才能访问的路由。
    如果用户未登录，返回 401 错误。

    Usage:
        @app.route('/profile')
        @login_required
        def profile():
            return jsonify({"user": session['username']})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function


@app.route("/api/login", methods=["POST"])
def login():
    """用户登录接口

    请求体:
        {
            "username": "string",
            "password": "string"
        }

    成功响应:
        {
            "message": "Login successful",
            "username": "string"
        }

    失败响应:
        {
            "error": "Invalid username or password"
        }

    注意：连续失败5次后账号会被锁定5分钟
    """
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE username = ? AND password_hash = ?",
        (username, hash_password(password)),
    ).fetchone()
    conn.close()

    if user:
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["is_admin"] = user["is_admin"]
        return jsonify({
            "message": "Login successful",
            "username": user["username"],
            "is_admin": bool(user["is_admin"]),
        })
    else:
        return jsonify({"error": "Invalid username or password"}), 401


@app.route("/api/register", methods=["POST"])
def register():
    """用户注册接口

    请求体:
        {
            "username": "string",  // 3-20位字母数字下划线
            "password": "string",  // 至少8位
            "email": "string"      // 可选
        }
    """
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")
    email = data.get("email", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if not USERNAME_PATTERN.match(username):
        return jsonify({"error": "Username must be 3-20 alphanumeric characters"}), 400

    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
            (username, hash_password(password), email),
        )
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except conn.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    finally:
        conn.close()


@app.route("/api/logout", methods=["POST"])
@login_required
def logout():
    """用户登出接口

    清除当前用户的 session 数据。
    需要登录后才能调用。
    """
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/profile", methods=["GET"])
@login_required
def profile():
    """获取当前用户信息

    返回当前登录用户的基本信息（不包含密码）。
    """
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?",
        (session["user_id"],),
    ).fetchone()
    conn.close()

    if user:
        return jsonify(dict(user))
    return jsonify({"error": "User not found"}), 404


# ============================================
# 健康检查
# ============================================


@app.route("/api/health", methods=["GET"])
def health():
    """健康检查端点

    用于负载均衡器或监控工具检查服务是否正常运行。
    """
    return jsonify({"status": "ok"})


# ============================================
# 应用入口
# ============================================


if __name__ == "__main__":
    # 初始化数据库
    init_db()
    # 启动开发服务器
    # 生产环境请使用 gunicorn 或 uwsgi
    app.run(debug=True, port=5000)
