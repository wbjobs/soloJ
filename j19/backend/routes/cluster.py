import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models import db, Cluster, FPGANode, ClusterTask, TaskChunk, SyncMessage, User, Bitstream
from ..utils.task_scheduler import get_scheduler
from ..utils.sync_protocol import get_sync_protocol

logger = logging.getLogger(__name__)

cluster_bp = Blueprint("cluster", __name__, url_prefix="/api/clusters")


@cluster_bp.route("", methods=["GET"])
@jwt_required()
def list_clusters():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", None)

    query = Cluster.query
    if status:
        query = query.filter_by(status=status)

    clusters = query.order_by(Cluster.created_at.desc()).paginate(page=page, per_page=per_page)

    return jsonify({
        "clusters": [c.to_dict() for c in clusters.items],
        "total": clusters.total,
        "page": page,
        "per_page": per_page,
        "pages": clusters.pages,
    })


@cluster_bp.route("", methods=["POST"])
@jwt_required()
def create_cluster():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Cluster name is required"}), 400

    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    existing = Cluster.query.filter_by(name=data["name"]).first()
    if existing:
        return jsonify({"error": "Cluster with this name already exists"}), 400

    cluster = Cluster(
        name=data["name"],
        description=data.get("description"),
        max_nodes=min(data.get("max_nodes", 16), 16),
        created_by=user.id,
    )
    db.session.add(cluster)
    db.session.commit()

    logger.info(f"Cluster created: {cluster.name} by {username}")
    return jsonify(cluster.to_dict()), 201


@cluster_bp.route("/<int:cluster_id>", methods=["GET"])
@jwt_required()
def get_cluster(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    return jsonify(cluster.to_dict())


@cluster_bp.route("/<int:cluster_id>", methods=["PUT"])
@jwt_required()
def update_cluster(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    data = request.get_json() or {}

    if "name" in data:
        existing = Cluster.query.filter_by(name=data["name"]).first()
        if existing and existing.id != cluster_id:
            return jsonify({"error": "Cluster with this name already exists"}), 400
        cluster.name = data["name"]

    if "description" in data:
        cluster.description = data["description"]

    if "status" in data:
        if data["status"] not in ("active", "inactive"):
            return jsonify({"error": "Invalid status"}), 400
        cluster.status = data["status"]

    if "max_nodes" in data:
        cluster.max_nodes = min(data["max_nodes"], 16)

    db.session.commit()
    logger.info(f"Cluster updated: {cluster.name}")
    return jsonify(cluster.to_dict())


@cluster_bp.route("/<int:cluster_id>", methods=["DELETE"])
@jwt_required()
def delete_cluster(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)

    running_tasks = ClusterTask.query.filter_by(
        cluster_id=cluster_id, status="running"
    ).count()
    if running_tasks > 0:
        return jsonify({"error": f"Cannot delete cluster with {running_tasks} running tasks"}), 400

    db.session.delete(cluster)
    db.session.commit()
    logger.info(f"Cluster deleted: {cluster.name}")
    return jsonify({"message": "Cluster deleted"})


@cluster_bp.route("/<int:cluster_id>/nodes", methods=["GET"])
@jwt_required()
def list_nodes(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    nodes = FPGANode.query.filter_by(cluster_id=cluster_id).all()
    return jsonify({"nodes": [n.to_dict() for n in nodes]})


@cluster_bp.route("/<int:cluster_id>/nodes", methods=["POST"])
@jwt_required()
def add_node(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    data = request.get_json()

    if not data or not data.get("serial_number"):
        return jsonify({"error": "Serial number is required"}), 400

    if cluster.nodes.count() >= cluster.max_nodes:
        return jsonify({"error": f"Cluster has reached max nodes ({cluster.max_nodes})"}), 400

    existing = FPGANode.query.filter_by(serial_number=data["serial_number"]).first()
    if existing:
        return jsonify({"error": "Node with this serial already exists"}), 400

    node = FPGANode(
        cluster_id=cluster_id,
        name=data.get("name", f"FPGA-{data['serial_number']}"),
        vendor_id=data.get("vendor_id"),
        product_id=data.get("product_id"),
        serial_number=data["serial_number"],
        usb_handle=data.get("usb_handle"),
        status=data.get("status", "offline"),
        x_position=data.get("x_position", 0),
        y_position=data.get("y_position", 0),
    )
    db.session.add(node)
    db.session.commit()

    logger.info(f"Node added to cluster {cluster.name}: {node.name}")
    return jsonify(node.to_dict()), 201


@cluster_bp.route("/<int:cluster_id>/nodes/<int:node_id>", methods=["PUT"])
@jwt_required()
def update_node(cluster_id, node_id):
    node = FPGANode.query.filter_by(id=node_id, cluster_id=cluster_id).first_or_404()
    data = request.get_json() or {}

    if "name" in data:
        node.name = data["name"]
    if "status" in data:
        if data["status"] not in ("offline", "idle", "busy", "error"):
            return jsonify({"error": "Invalid status"}), 400
        node.status = data["status"]
    if "load" in data:
        node.load = max(0, min(100, int(data["load"])))
    if "temperature" in data:
        node.temperature = float(data["temperature"])
    if "voltage" in data:
        node.voltage = float(data["voltage"])
    if "usb_handle" in data:
        node.usb_handle = data["usb_handle"]
    if "x_position" in data:
        node.x_position = int(data["x_position"])
    if "y_position" in data:
        node.y_position = int(data["y_position"])

    node.last_seen = datetime.utcnow()
    db.session.commit()
    return jsonify(node.to_dict())


@cluster_bp.route("/<int:cluster_id>/nodes/<int:node_id>", methods=["DELETE"])
@jwt_required()
def remove_node(cluster_id, node_id):
    node = FPGANode.query.filter_by(id=node_id, cluster_id=cluster_id).first_or_404()

    if node.status == "busy":
        return jsonify({"error": "Cannot remove busy node"}), 400

    db.session.delete(node)
    db.session.commit()
    logger.info(f"Node removed from cluster {cluster_id}: {node.name}")
    return jsonify({"message": "Node removed"})


@cluster_bp.route("/<int:cluster_id>/nodes/<int:node_id>/load", methods=["GET"])
@jwt_required()
def get_node_load(cluster_id, node_id):
    node = FPGANode.query.filter_by(id=node_id, cluster_id=cluster_id).first_or_404()
    return jsonify({
        "node_id": node.id,
        "load": node.load,
        "status": node.status,
        "temperature": node.temperature,
        "voltage": node.voltage,
        "tasks_completed": node.tasks_completed,
        "last_seen": node.last_seen.isoformat() if node.last_seen else None,
    })


@cluster_bp.route("/<int:cluster_id>/nodes/metrics", methods=["GET"])
@jwt_required()
def get_all_node_metrics(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    nodes = FPGANode.query.filter_by(cluster_id=cluster_id).all()
    return jsonify({
        "cluster_id": cluster_id,
        "timestamp": datetime.utcnow().isoformat(),
        "nodes": [{
            "id": n.id,
            "name": n.name,
            "status": n.status,
            "load": n.load,
            "temperature": n.temperature,
            "voltage": n.voltage,
            "tasks_completed": n.tasks_completed,
            "total_execution_time": n.total_execution_time,
        } for n in nodes],
        "summary": {
            "total_nodes": len(nodes),
            "online_nodes": len([n for n in nodes if n.status != "offline"]),
            "busy_nodes": len([n for n in nodes if n.status == "busy"]),
            "avg_load": sum(n.load for n in nodes) / len(nodes) if nodes else 0,
        },
    })


@cluster_bp.route("/<int:cluster_id>/tasks", methods=["GET"])
@jwt_required()
def list_tasks(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    status = request.args.get("status", None)

    query = ClusterTask.query.filter_by(cluster_id=cluster_id)
    if status:
        query = query.filter_by(status=status)

    tasks = query.order_by(ClusterTask.created_at.desc()).limit(50).all()
    return jsonify({"tasks": [t.to_dict() for t in tasks]})


@cluster_bp.route("/<int:cluster_id>/tasks/queue", methods=["GET"])
@jwt_required()
def get_task_queue(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    tasks = ClusterTask.query.filter(
        ClusterTask.cluster_id == cluster_id,
        ClusterTask.status.in_(["pending", "scheduled", "running"]),
    ).order_by(ClusterTask.priority.desc(), ClusterTask.created_at.asc()).all()

    return jsonify({"queue": [t.to_dict() for t in tasks]})


@cluster_bp.route("/<int:cluster_id>/tasks", methods=["POST"])
@jwt_required()
def submit_task(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    data = request.get_json()

    if not data or not data.get("name"):
        return jsonify({"error": "Task name is required"}), 400

    bitstream = Bitstream.query.get(data.get("bitstream_id"))
    if not bitstream:
        return jsonify({"error": "Bitstream not found"}), 404

    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    available_nodes = FPGANode.query.filter_by(
        cluster_id=cluster_id, status="idle"
    ).count()
    if available_nodes == 0:
        return jsonify({"error": "No idle nodes available in cluster"}), 400

    num_chunks = min(data.get("num_chunks", available_nodes), cluster.max_nodes)

    task = ClusterTask(
        cluster_id=cluster_id,
        name=data["name"],
        bitstream_id=bitstream.id,
        total_chunks=num_chunks,
        priority=data.get("priority", 0),
        created_by=user.id,
        estimated_duration=data.get("estimated_duration"),
        status="scheduled",
    )
    db.session.add(task)
    db.session.flush()

    scheduler = get_scheduler()
    scheduler_result = scheduler.schedule_task(
        cluster_id, task.id, bitstream.size, num_chunks
    )

    for idx, node_id in enumerate(scheduler_result.get("assignments", [])):
        chunk = TaskChunk(
            task_id=task.id,
            node_id=node_id,
            chunk_index=idx,
            chunk_size=bitstream.size // num_chunks,
            status="assigned",
            assigned_at=datetime.utcnow(),
        )
        db.session.add(chunk)
        node = FPGANode.query.get(node_id)
        if node:
            node.status = "busy"
            node.current_task_id = task.id

    task.status = "running"
    task.started_at = datetime.utcnow()
    db.session.commit()

    logger.info(f"Task submitted to cluster {cluster.name}: {task.name}, chunks: {num_chunks}")
    return jsonify({
        **task.to_dict(),
        "assignments": scheduler_result.get("assignments", []),
    }), 201


@cluster_bp.route("/<int:cluster_id>/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def get_task(cluster_id, task_id):
    task = ClusterTask.query.filter_by(id=task_id, cluster_id=cluster_id).first_or_404()
    chunks = TaskChunk.query.filter_by(task_id=task_id).order_by(TaskChunk.chunk_index).all()
    return jsonify({
        **task.to_dict(),
        "chunks": [c.to_dict() for c in chunks],
    })


@cluster_bp.route("/<int:cluster_id>/tasks/<int:task_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_task(cluster_id, task_id):
    task = ClusterTask.query.filter_by(id=task_id, cluster_id=cluster_id).first_or_404()

    if task.status not in ("pending", "scheduled", "running"):
        return jsonify({"error": "Task cannot be cancelled"}), 400

    scheduler = get_scheduler()
    scheduler.cancel_task(task.id)

    for chunk in task.chunks:
        if chunk.status in ("pending", "assigned", "running"):
            chunk.status = "failed"
            chunk.error_message = "Cancelled by user"
        if chunk.node_id:
            node = FPGANode.query.get(chunk.node_id)
            if node and node.current_task_id == task.id:
                node.status = "idle"
                node.current_task_id = None

    task.status = "cancelled"
    task.completed_at = datetime.utcnow()
    db.session.commit()

    logger.info(f"Task cancelled: {task.name}")
    return jsonify(task.to_dict())


@cluster_bp.route("/<int:cluster_id>/tasks/<int:task_id>/rebalance", methods=["POST"])
@jwt_required()
def rebalance_task(cluster_id, task_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    scheduler = get_scheduler()
    result = scheduler.rebalance_load(cluster_id)
    return jsonify(result)


@cluster_bp.route("/<int:cluster_id>/sync", methods=["POST"])
@jwt_required()
def trigger_sync(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    data = request.get_json() or {}

    sync_protocol = get_sync_protocol()
    result = sync_protocol.create_sync_barrier(
        cluster_id,
        data.get("node_ids"),
        timeout=data.get("timeout", 30),
    )

    return jsonify(result), 201


@cluster_bp.route("/<int:cluster_id>/sync/<int:sync_id>", methods=["GET"])
@jwt_required()
def check_sync_status(cluster_id, sync_id):
    msg = SyncMessage.query.filter_by(id=sync_id, cluster_id=cluster_id).first_or_404()
    return jsonify(msg.to_dict())


@cluster_bp.route("/<int:cluster_id>/topology", methods=["GET"])
@jwt_required()
def get_topology(cluster_id):
    cluster = Cluster.query.get_or_404(cluster_id)
    nodes = FPGANode.query.filter_by(cluster_id=cluster_id).all()

    connections = []
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            connections.append({
                "source": nodes[i].id,
                "target": nodes[j].id,
                "type": "synchronous",
            })

    return jsonify({
        "cluster_id": cluster_id,
        "nodes": [n.to_dict() for n in nodes],
        "connections": connections,
    })