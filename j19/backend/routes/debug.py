import logging
import json
import time
import threading
from datetime import datetime
from flask import Blueprint, request, jsonify, Response, current_app, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, User, DebugSession, Breakpoint, DebugCommand
from utils.debug_queue import DebugCommandQueue

debug_bp = Blueprint("debug", __name__)
logger = logging.getLogger(__name__)

_sse_subscribers: dict = {}
_sse_lock = threading.Lock()


def _get_current_user() -> User | None:
    user_id = get_jwt_identity()
    return db.session.get(User, user_id)


def _notify_sse(session_id: int, data: dict) -> None:
    with _sse_lock:
        subscriber = _sse_subscribers.get(session_id)
        if subscriber:
            subscriber["events"].append(data)
            subscriber["event"].set()


def _get_or_create_queue(session_id: int) -> DebugCommandQueue:
    queue = current_app.extensions.get("debug_queues", {}).get(session_id)
    if not queue:
        if "debug_queues" not in current_app.extensions:
            current_app.extensions["debug_queues"] = {}
        queue = DebugCommandQueue()
        current_app.extensions["debug_queues"][session_id] = queue
    return queue


@debug_bp.route("/debug/start-session", methods=["POST"])
@jwt_required()
def start_session():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    device_serial = data.get("device_serial")

    if not device_serial:
        return jsonify({"error": "Device serial is required"}), 400

    active_session = DebugSession.query.filter_by(
        device_serial=device_serial, status="active"
    ).first()
    if active_session:
        return jsonify({"error": "Device already has an active debug session", "session_id": active_session.id}), 409

    session = DebugSession(
        user_id=current_user.id,
        device_serial=device_serial,
        status="active",
        started_at=datetime.utcnow(),
    )
    db.session.add(session)
    db.session.commit()

    _get_or_create_queue(session.id)

    logger.info(f"Debug session {session.id} started for device {device_serial} by {current_user.username}")
    return jsonify(session.to_dict()), 201


@debug_bp.route("/debug/stop-session", methods=["POST"])
@jwt_required()
def stop_session():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    session_id = data.get("session_id")

    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400

    session = db.session.get(DebugSession, session_id)
    if not session:
        return jsonify({"error": "Debug session not found"}), 404

    if session.user_id != current_user.id and current_user.role != "admin":
        return jsonify({"error": "Not authorized to stop this session"}), 403

    if session.status != "active":
        return jsonify({"error": "Session is not active"}), 400

    session.status = "stopped"
    session.ended_at = datetime.utcnow()

    queue = current_app.extensions.get("debug_queues", {}).get(session.id)
    if queue:
        queue.clear()

    Breakpoint.query.filter_by(session_id=session.id).delete()
    DebugCommand.query.filter_by(session_id=session.id).update({"status": "cancelled"})

    db.session.commit()

    _notify_sse(session.id, {"type": "session_stopped", "session_id": session.id})

    logger.info(f"Debug session {session.id} stopped by {current_user.username}")
    return jsonify(session.to_dict()), 200


@debug_bp.route("/debug/sessions", methods=["GET"])
@jwt_required()
def list_sessions():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    device_filter = request.args.get("device_serial", None)
    status_filter = request.args.get("status", None)

    query = DebugSession.query
    if current_user.role != "admin":
        query = query.filter_by(user_id=current_user.id)

    if device_filter:
        query = query.filter(DebugSession.device_serial.ilike(f"%{device_filter}%"))
    if status_filter:
        query = query.filter_by(status=status_filter)

    pagination = query.order_by(DebugSession.started_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "sessions": [s.to_dict() for s in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }), 200


@debug_bp.route("/debug/sessions/<int:session_id>", methods=["GET"])
@jwt_required()
def get_session(session_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    session = db.session.get(DebugSession, session_id)
    if not session:
        return jsonify({"error": "Debug session not found"}), 404

    if session.user_id != current_user.id and current_user.role != "admin":
        return jsonify({"error": "Not authorized to view this session"}), 403

    return jsonify(session.to_dict()), 200


@debug_bp.route("/debug/breakpoints", methods=["POST"])
@jwt_required()
def set_breakpoint():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    session_id = data.get("session_id")
    address = data.get("address")
    bp_type = data.get("type", "execution")

    if not session_id or not address:
        return jsonify({"error": "Session ID and address are required"}), 400

    session = db.session.get(DebugSession, session_id)
    if not session:
        return jsonify({"error": "Debug session not found"}), 404

    if session.status != "active":
        return jsonify({"error": "Debug session is not active"}), 400

    if session.user_id != current_user.id and current_user.role != "admin":
        return jsonify({"error": "Not authorized"}), 403

    valid_types = {"execution", "read", "write", "access"}
    if bp_type not in valid_types:
        return jsonify({"error": f"Breakpoint type must be one of: {', '.join(valid_types)}"}), 400

    existing = Breakpoint.query.filter_by(
        session_id=session_id, address=str(address), type=bp_type
    ).first()
    if existing:
        return jsonify({"error": "Breakpoint already exists", "breakpoint": existing.to_dict()}), 409

    bp = Breakpoint(
        session_id=session_id,
        address=str(address),
        type=bp_type,
        enabled=True,
    )
    db.session.add(bp)
    db.session.commit()

    _notify_sse(session_id, {"type": "breakpoint_set", "breakpoint": bp.to_dict()})
    return jsonify(bp.to_dict()), 201


@debug_bp.route("/debug/breakpoints/<int:bp_id>", methods=["DELETE"])
@jwt_required()
def delete_breakpoint(bp_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    bp = db.session.get(Breakpoint, bp_id)
    if not bp:
        return jsonify({"error": "Breakpoint not found"}), 404

    session = db.session.get(DebugSession, bp.session_id)
    if not session:
        return jsonify({"error": "Associated debug session not found"}), 404

    if session.user_id != current_user.id and current_user.role != "admin":
        return jsonify({"error": "Not authorized"}), 403

    session_id = bp.session_id
    db.session.delete(bp)
    db.session.commit()

    _notify_sse(session_id, {"type": "breakpoint_removed", "breakpoint_id": bp_id})
    return jsonify({"message": "Breakpoint deleted"}), 200


@debug_bp.route("/debug/breakpoints", methods=["GET"])
@jwt_required()
def list_breakpoints():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    session_id = request.args.get("session_id", type=int)
    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400

    session = db.session.get(DebugSession, session_id)
    if not session:
        return jsonify({"error": "Debug session not found"}), 404

    if session.user_id != current_user.id and current_user.role != "admin":
        return jsonify({"error": "Not authorized"}), 403

    breakpoints = Breakpoint.query.filter_by(session_id=session_id).order_by(Breakpoint.created_at.desc()).all()
    return jsonify({"breakpoints": [bp.to_dict() for bp in breakpoints]}), 200


@debug_bp.route("/debug/command", methods=["POST"])
@jwt_required()
def enqueue_command():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    session_id = data.get("session_id")
    command = data.get("command")
    priority = data.get("priority", 0)
    timeout = data.get("timeout", 30)

    if not session_id or not command:
        return jsonify({"error": "Session ID and command are required"}), 400

    session = db.session.get(DebugSession, session_id)
    if not session:
        return jsonify({"error": "Debug session not found"}), 404

    if session.status != "active":
        return jsonify({"error": "Debug session is not active"}), 400

    if session.user_id != current_user.id and current_user.role != "admin":
        return jsonify({"error": "Not authorized"}), 403

    db_cmd = DebugCommand(
        session_id=session_id,
        command=command,
        priority=priority,
        status="queued",
    )
    db.session.add(db_cmd)
    db.session.commit()

    queue = _get_or_create_queue(session_id)
    queue.enqueue(
        command_id=db_cmd.id,
        command=command,
        priority=priority,
        timeout=timeout,
    )

    _notify_sse(session_id, {"type": "command_queued", "command": db_cmd.to_dict()})
    return jsonify(db_cmd.to_dict()), 202


@debug_bp.route("/debug/commands/<int:cmd_id>", methods=["GET"])
@jwt_required()
def get_command_status(cmd_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    cmd = db.session.get(DebugCommand, cmd_id)
    if not cmd:
        return jsonify({"error": "Command not found"}), 404

    session = db.session.get(DebugSession, cmd.session_id)
    if session and session.user_id != current_user.id and current_user.role != "admin":
        return jsonify({"error": "Not authorized"}), 403

    return jsonify(cmd.to_dict()), 200


@debug_bp.route("/debug/stream", methods=["GET"])
@jwt_required()
def debug_stream():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    session_id = request.args.get("session_id", type=int)
    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400

    session = db.session.get(DebugSession, session_id)
    if not session:
        return jsonify({"error": "Debug session not found"}), 404

    if session.user_id != current_user.id and current_user.role != "admin":
        return jsonify({"error": "Not authorized"}), 403

    subscriber = {
        "events": [],
        "event": threading.Event(),
        "connected": True,
    }

    with _sse_lock:
        _sse_subscribers[session_id] = subscriber

    def generate():
        try:
            yield f"data: {json.dumps({'type': 'connected', 'session_id': session_id})}\n\n"
            while subscriber["connected"]:
                if subscriber["event"].wait(timeout=30):
                    subscriber["event"].clear()
                    events = subscriber["events"]
                    subscriber["events"] = []
                    for event in events:
                        yield f"data: {json.dumps(event)}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        except GeneratorExit:
            subscriber["connected"] = False
        finally:
            with _sse_lock:
                if _sse_subscribers.get(session_id) is subscriber:
                    _sse_subscribers.pop(session_id, None)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
