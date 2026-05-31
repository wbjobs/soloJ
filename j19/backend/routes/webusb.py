import logging
import json
import threading
from flask import Blueprint, request, jsonify, Response, current_app, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, User
from utils.webusb_proxy import WebUSBProxy, WebUSBProxyError

webusb_bp = Blueprint("webusb", __name__)
logger = logging.getLogger(__name__)

_device_sse_subscribers: dict = {}
_device_sse_lock = threading.Lock()


def _get_current_user() -> User | None:
    user_id = get_jwt_identity()
    return db.session.get(User, user_id)


def _get_proxy() -> WebUSBProxy:
    proxy = current_app.extensions.get("webusb_proxy")
    if not proxy:
        proxy = WebUSBProxy()
        current_app.extensions["webusb_proxy"] = proxy
    return proxy


def _notify_device_event(event_data: dict) -> None:
    with _device_sse_lock:
        for subscriber in list(_device_sse_subscribers.values()):
            subscriber["events"].append(event_data)
            subscriber["event"].set()


@webusb_bp.route("/webusb/devices", methods=["GET"])
@jwt_required()
def list_devices():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    proxy = _get_proxy()
    vendor_id = request.args.get("vendor_id", type=lambda x: int(x, 0) if x else None)

    try:
        devices = proxy.enumerate(vendor_id=vendor_id)
        return jsonify({"devices": devices}), 200
    except WebUSBProxyError as e:
        logger.error(f"Failed to enumerate devices: {e}")
        return jsonify({"error": str(e), "message": "Failed to enumerate USB devices"}), 500


@webusb_bp.route("/webusb/connect", methods=["POST"])
@jwt_required()
def connect_device():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    vendor_id = data.get("vendor_id")
    product_id = data.get("product_id")
    serial_number = data.get("serial_number")

    if vendor_id is None or product_id is None:
        return jsonify({"error": "vendor_id and product_id are required"}), 400

    vendor_id = int(vendor_id)
    product_id = int(product_id)

    proxy = _get_proxy()

    try:
        device_handle = proxy.connect(vendor_id, product_id, serial_number)
        _notify_device_event({
            "type": "device_connected",
            "vendor_id": vendor_id,
            "product_id": product_id,
            "serial_number": serial_number,
            "handle": device_handle,
        })
        logger.info(f"Device connected: vid={vendor_id:04x}, pid={product_id:04x}, serial={serial_number}")
        return jsonify({"handle": device_handle, "message": "Device connected"}), 200
    except WebUSBProxyError as e:
        logger.error(f"Failed to connect device: {e}")
        return jsonify({"error": str(e), "message": "Failed to connect to device"}), 500


@webusb_bp.route("/webusb/disconnect", methods=["POST"])
@jwt_required()
def disconnect_device():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    handle = data.get("handle")

    if not handle:
        return jsonify({"error": "Device handle is required"}), 400

    proxy = _get_proxy()

    try:
        proxy.disconnect(handle)
        _notify_device_event({"type": "device_disconnected", "handle": handle})
        logger.info(f"Device disconnected: handle={handle}")
        return jsonify({"message": "Device disconnected"}), 200
    except WebUSBProxyError as e:
        logger.error(f"Failed to disconnect device: {e}")
        return jsonify({"error": str(e), "message": "Failed to disconnect device"}), 500


@webusb_bp.route("/webusb/transfer", methods=["POST"])
@jwt_required()
def bulk_transfer():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    handle = data.get("handle")
    endpoint = data.get("endpoint")
    data_hex = data.get("data")

    if not handle or endpoint is None or not data_hex:
        return jsonify({"error": "handle, endpoint, and data are required"}), 400

    endpoint = int(endpoint)
    try:
        transfer_data = bytes.fromhex(data_hex)
    except ValueError:
        return jsonify({"error": "Invalid hex data"}), 400

    proxy = _get_proxy()

    try:
        result = proxy.bulk_transfer(handle, endpoint, transfer_data)
        return jsonify({
            "data": result.hex() if isinstance(result, bytes) else result,
            "length": len(result) if isinstance(result, bytes) else 0,
        }), 200
    except WebUSBProxyError as e:
        logger.error(f"Bulk transfer failed: {e}")
        return jsonify({"error": str(e), "message": "Transfer failed"}), 500


@webusb_bp.route("/webusb/program", methods=["POST"])
@jwt_required()
def program_device():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    handle = data.get("handle")
    bitstream_data = data.get("bitstream_data")
    device_type = data.get("device_type", "xilinx")

    if not handle or not bitstream_data:
        return jsonify({"error": "handle and bitstream_data are required"}), 400

    try:
        bitstream = bytes.fromhex(bitstream_data)
    except ValueError:
        return jsonify({"error": "Invalid hex data for bitstream"}), 400

    proxy = _get_proxy()

    try:
        result = proxy.program_fpga(handle, bitstream, device_type)
        _notify_device_event({
            "type": "programming_complete",
            "handle": handle,
            "status": "success",
            "device_type": device_type,
        })
        logger.info(f"FPGA programmed successfully: handle={handle}, device_type={device_type}")
        return jsonify({"success": True, "result": result}), 200
    except WebUSBProxyError as e:
        logger.error(f"FPGA programming failed: {e}")
        _notify_device_event({
            "type": "programming_failed",
            "handle": handle,
            "error": str(e),
        })
        return jsonify({"error": str(e), "message": "Programming failed"}), 500


@webusb_bp.route("/webusb/jtag/reset", methods=["POST"])
@jwt_required()
def jtag_reset():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    handle = data.get("handle")

    if not handle:
        return jsonify({"error": "Device handle is required"}), 400

    proxy = _get_proxy()

    try:
        proxy.jtag_reset(handle)
        return jsonify({"message": "JTAG reset completed"}), 200
    except WebUSBProxyError as e:
        logger.error(f"JTAG reset failed: {e}")
        return jsonify({"error": str(e), "message": "JTAG reset failed"}), 500


@webusb_bp.route("/webusb/jtag/shift", methods=["POST"])
@jwt_required()
def jtag_shift():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    handle = data.get("handle")
    tdi_hex = data.get("tdi")
    bit_count = data.get("bit_count")

    if not handle or not tdi_hex or bit_count is None:
        return jsonify({"error": "handle, tdi, and bit_count are required"}), 400

    bit_count = int(bit_count)
    try:
        tdi = bytes.fromhex(tdi_hex)
    except ValueError:
        return jsonify({"error": "Invalid hex data for TDI"}), 400

    proxy = _get_proxy()

    try:
        result = proxy.jtag_shift(handle, tdi, bit_count)
        return jsonify({"tdo": result.hex() if isinstance(result, bytes) else result}), 200
    except WebUSBProxyError as e:
        logger.error(f"JTAG shift failed: {e}")
        return jsonify({"error": str(e), "message": "JTAG shift failed"}), 500


@webusb_bp.route("/webusb/events", methods=["GET"])
@jwt_required()
def device_events():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    subscriber_id = id(current_app) + len(_device_sse_subscribers)
    subscriber = {
        "events": [],
        "event": threading.Event(),
        "connected": True,
        "id": subscriber_id,
    }

    with _device_sse_lock:
        _device_sse_subscribers[subscriber_id] = subscriber

    def generate():
        try:
            yield f"data: {json.dumps({'type': 'connected', 'subscriber_id': subscriber_id})}\n\n"
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
            with _device_sse_lock:
                _device_sse_subscribers.pop(subscriber_id, None)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@webusb_bp.route("/webusb/connected-devices", methods=["GET"])
@jwt_required()
def list_connected_devices():
    current_user = _get_current_user()
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    proxy = _get_proxy()
    connected = proxy.list_connected()
    return jsonify({"connected_devices": connected}), 200
