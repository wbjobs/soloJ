import os
import hashlib
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, User, Bitstream, BurnRecord
from utils.bitstream_parser import BitstreamParser

bitstream_bp = Blueprint("bitstream", __name__)
logger = logging.getLogger(__name__)


def _get_current_user() -> User | None:
    user_id = get_jwt_identity()
    return db.session.get(User, user_id)


@bitstream_bp.route("/bitstreams/upload", methods=["POST"])
@jwt_required()
def upload_bitstream():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    allowed_extensions = {".bit", ".bin"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        return jsonify({"error": f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"}), 400

    file_content = file.read()
    file_size = len(file_content)

    if file_size == 0:
        return jsonify({"error": "Empty file provided"}), 400

    max_size = current_app.config.get("MAX_CONTENT_LENGTH", 64 * 1024 * 1024)
    if file_size > max_size:
        return jsonify({"error": f"File too large. Maximum size: {max_size // (1024 * 1024)}MB"}), 413

    file_hash = hashlib.sha256(file_content).hexdigest()

    parser = BitstreamParser(file_content, file.filename)
    header_info = parser.parse()

    if not header_info.get("valid"):
        return jsonify({"error": "Invalid bitstream file format", "details": header_info.get("errors")}), 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    stored_filename = f"{timestamp}_{file_hash[:16]}{ext}"
    file_path = os.path.join(upload_folder, stored_filename)

    existing = Bitstream.query.filter_by(hash=file_hash).first()
    if existing:
        return jsonify({
            "error": "Bitstream with identical hash already exists",
            "existing_id": existing.id,
        }), 409

    with open(file_path, "wb") as f:
        f.write(file_content)

    description = request.form.get("description", "")
    device_type = header_info.get("device_type", parser.infer_device_type()) or "unknown"

    bitstream = Bitstream(
        filename=stored_filename,
        device_type=device_type,
        hash=file_hash,
        size=file_size,
        uploader_id=current_user.id,
        description=description,
    )
    db.session.add(bitstream)
    db.session.commit()

    logger.info(f"Bitstream uploaded: {file.filename} by user {current_user.username}, device={device_type}")
    result = bitstream.to_dict()
    result["original_filename"] = file.filename
    result["header_info"] = header_info
    return jsonify(result), 201


@bitstream_bp.route("/bitstreams", methods=["GET"])
@jwt_required()
def list_bitstreams():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    device_type = request.args.get("device_type", None)
    sort_by = request.args.get("sort_by", "upload_date")
    sort_order = request.args.get("sort_order", "desc")

    query = Bitstream.query
    if device_type:
        query = query.filter(Bitstream.device_type.ilike(f"%{device_type}%"))

    if sort_by == "upload_date":
        order_column = Bitstream.upload_date
    elif sort_by == "filename":
        order_column = Bitstream.filename
    elif sort_by == "size":
        order_column = Bitstream.size
    else:
        order_column = Bitstream.upload_date

    if sort_order == "asc":
        query = query.order_by(order_column.asc())
    else:
        query = query.order_by(order_column.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "bitstreams": [b.to_dict() for b in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }), 200


@bitstream_bp.route("/bitstreams/<int:bitstream_id>", methods=["GET"])
@jwt_required()
def get_bitstream(bitstream_id):
    bitstream = db.session.get(Bitstream, bitstream_id)
    if not bitstream:
        return jsonify({"error": "Bitstream not found"}), 404

    data = bitstream.to_dict()
    data["download_url"] = f"/api/bitstreams/{bitstream_id}/download"
    return jsonify(data), 200


@bitstream_bp.route("/bitstreams/<int:bitstream_id>/download", methods=["GET"])
@jwt_required()
def download_bitstream(bitstream_id):
    bitstream = db.session.get(Bitstream, bitstream_id)
    if not bitstream:
        return jsonify({"error": "Bitstream not found"}), 404

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    file_path = os.path.join(upload_folder, bitstream.filename)

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found on disk"}), 404

    original_ext = os.path.splitext(bitstream.filename)[1]
        download_name = f"bitstream_{bitstream.id}{original_ext}"

    return send_from_directory(
        upload_folder,
        bitstream.filename,
        as_attachment=True,
        download_name=download_name,
    )


@bitstream_bp.route("/bitstreams/<int:bitstream_id>", methods=["DELETE"])
@jwt_required()
def delete_bitstream(bitstream_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if current_user.role != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    bitstream = db.session.get(Bitstream, bitstream_id)
    if not bitstream:
        return jsonify({"error": "Bitstream not found"}), 404

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    file_path = os.path.join(upload_folder, bitstream.filename)

    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError as e:
            logger.error(f"Failed to delete bitstream file {file_path}: {e}")

    db.session.delete(bitstream)
    db.session.commit()

    logger.info(f"Bitstream {bitstream.filename} deleted by admin {current_user.username}")
    return jsonify({"message": "Bitstream deleted successfully"}), 200


@bitstream_bp.route("/bitstreams/<int:bitstream_id>/burn", methods=["POST"])
@jwt_required()
def burn_bitstream(bitstream_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    bitstream = db.session.get(Bitstream, bitstream_id)
    if not bitstream:
        return jsonify({"error": "Bitstream not found"}), 404

    data = request.get_json() or {}
    device_serial = data.get("device_serial")

    if not device_serial:
        return jsonify({"error": "Device serial is required"}), 400

    record = BurnRecord(
        bitstream_id=bitstream.id,
        user_id=current_user.id,
        device_serial=device_serial,
        status="in_progress",
        timestamp=datetime.utcnow(),
    )
    db.session.add(record)
    db.session.commit()

    logger.info(f"Burn initiated for bitstream {bitstream.filename} on device {device_serial} by {current_user.username}")
    return jsonify({
        "message": "Burn initiated",
        "burn_record": record.to_dict(),
    }), 202


@bitstream_bp.route("/burn-records", methods=["GET"])
@jwt_required()
def list_burn_records():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    user_filter = request.args.get("user_id", None)
    device_filter = request.args.get("device_serial", None)
    status_filter = request.args.get("status", None)

    query = BurnRecord.query

    if current_user.role != "admin":
        query = query.filter_by(user_id=current_user.id)
    elif user_filter:
        query = query.filter_by(user_id=int(user_filter))

    if device_filter:
        query = query.filter(BurnRecord.device_serial.ilike(f"%{device_filter}%"))

    if status_filter:
        query = query.filter_by(status=status_filter)

    pagination = query.order_by(BurnRecord.timestamp.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "records": [r.to_dict() for r in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }), 200


@bitstream_bp.route("/burn-records/<int:record_id>", methods=["GET"])
@jwt_required()
def get_burn_record(record_id):
    record = db.session.get(BurnRecord, record_id)
    if not record:
        return jsonify({"error": "Burn record not found"}), 404

    return jsonify(record.to_dict()), 200


@bitstream_bp.route("/burn-records/<int:record_id>/status", methods=["PUT"])
@jwt_required()
def update_burn_record_status(record_id):
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    record = db.session.get(BurnRecord, record_id)
    if not record:
        return jsonify({"error": "Burn record not found"}), 404

    data = request.get_json() or {}
    status = data.get("status")
    error_message = data.get("error_message")
    duration = data.get("duration")

    valid_statuses = {"success", "failed", "in_progress", "pending"}
    if status not in valid_statuses:
        return jsonify({"error": f"Status must be one of: {', '.join(valid_statuses)}"}), 400

    record.status = status
    if duration is not None:
        record.duration = float(duration)
    if error_message:
        record.error_message = error_message

    db.session.commit()
    return jsonify(record.to_dict()), 200
