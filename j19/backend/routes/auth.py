import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)

from models import db, User

auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

VALID_ROLES = {"admin", "operator", "viewer"}


@auth_bp.route("/auth/register", methods=["POST"])
@jwt_required()
def register():
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)
    if not current_user or current_user.role != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")
    role = data.get("role", "viewer")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if role not in VALID_ROLES:
        return jsonify({"error": f"Role must be one of: {', '.join(VALID_ROLES)}"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 409

    user = User(username=username, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    logger.info(f"User registered: {username} by admin {current_user.username}")
    return jsonify(user.to_dict()), 201


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(password):
        logger.warning(f"Failed login attempt for username: {username}")
        return jsonify({"error": "Invalid username or password"}), 401

    if not user.is_active:
        return jsonify({"error": "Account is deactivated"}), 403

    access_token = create_access_token(
        identity=user.id,
        additional_claims={"username": user.username, "role": user.role},
    )
    refresh_token = create_refresh_token(identity=user.id)

    logger.info(f"User logged in: {username}")
    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
    }), 200


@auth_bp.route("/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    logger.info(f"User logged out: {get_jwt_identity()}")
    return jsonify({"message": "Successfully logged out"}), 200


@auth_bp.route("/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return jsonify({"error": "User not found or inactive"}), 404

    new_access_token = create_access_token(
        identity=user.id,
        additional_claims={"username": user.username, "role": user.role},
    )
    return jsonify({"access_token": new_access_token}), 200


@auth_bp.route("/auth/users", methods=["GET"])
@jwt_required()
def get_users():
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)
    if not current_user or current_user.role != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    role_filter = request.args.get("role", None)

    query = User.query
    if role_filter:
        query = query.filter_by(role=role_filter)

    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "users": [u.to_dict() for u in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }), 200


@auth_bp.route("/auth/users/<int:user_id>/role", methods=["PUT"])
@jwt_required()
def update_user_role(user_id):
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)
    if not current_user or current_user.role != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    if current_user_id == user_id:
        return jsonify({"error": "Cannot modify your own role"}), 400

    data = request.get_json()
    if not data or "role" not in data:
        return jsonify({"error": "Role is required"}), 400

    new_role = data["role"]
    if new_role not in VALID_ROLES:
        return jsonify({"error": f"Role must be one of: {', '.join(VALID_ROLES)}"}), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    old_role = user.role
    user.role = new_role
    db.session.commit()

    logger.info(f"User {user.username} role changed from {old_role} to {new_role} by admin {current_user.username}")
    return jsonify(user.to_dict()), 200


@auth_bp.route("/auth/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)
    if not current_user or current_user.role != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    if current_user_id == user_id:
        return jsonify({"error": "Cannot delete your own account"}), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    username = user.username
    db.session.delete(user)
    db.session.commit()

    logger.info(f"User deleted: {username} by admin {current_user.username}")
    return jsonify({"message": f"User '{username}' deleted successfully"}), 200


@auth_bp.route("/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user.to_dict()), 200
