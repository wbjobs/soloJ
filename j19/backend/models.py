from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db: SQLAlchemy = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="viewer")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    bitstreams = db.relationship("Bitstream", backref="uploader", lazy="dynamic")
    burn_records = db.relationship("BurnRecord", backref="user", lazy="dynamic")
    debug_sessions = db.relationship("DebugSession", backref="user", lazy="dynamic")

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_active": self.is_active,
        }


class Bitstream(db.Model):
    __tablename__ = "bitstreams"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False)
    device_type = db.Column(db.String(128), nullable=False)
    hash = db.Column(db.String(64), nullable=False)
    size = db.Column(db.Integer, nullable=False)
    uploader_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    description = db.Column(db.String(512), nullable=True)

    burn_records = db.relationship("BurnRecord", backref="bitstream", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "filename": self.filename,
            "device_type": self.device_type,
            "hash": self.hash,
            "size": self.size,
            "uploader_id": self.uploader_id,
            "upload_date": self.upload_date.isoformat() if self.upload_date else None,
            "description": self.description,
        }


class BurnRecord(db.Model):
    __tablename__ = "burn_records"

    id = db.Column(db.Integer, primary_key=True)
    bitstream_id = db.Column(db.Integer, db.ForeignKey("bitstreams.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    device_serial = db.Column(db.String(128), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    duration = db.Column(db.Float, nullable=True)
    error_message = db.Column(db.Text, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "bitstream_id": self.bitstream_id,
            "user_id": self.user_id,
            "device_serial": self.device_serial,
            "status": self.status,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "duration": self.duration,
            "error_message": self.error_message,
        }


class DebugSession(db.Model):
    __tablename__ = "debug_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    device_serial = db.Column(db.String(128), nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    ended_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="active")

    breakpoints = db.relationship("Breakpoint", backref="session", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "device_serial": self.device_serial,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "status": self.status,
        }


class Breakpoint(db.Model):
    __tablename__ = "breakpoints"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("debug_sessions.id"), nullable=False, index=True)
    address = db.Column(db.String(32), nullable=False)
    type = db.Column(db.String(20), nullable=False, default="execution")
    enabled = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "address": self.address,
            "type": self.type,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DebugCommand(db.Model):
    __tablename__ = "debug_commands"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("debug_sessions.id"), nullable=False, index=True)
    command = db.Column(db.String(256), nullable=False)
    priority = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="queued")
    result = db.Column(db.Text, nullable=True)
    enqueued_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    executed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "command": self.command,
            "priority": self.priority,
            "status": self.status,
            "result": self.result,
            "enqueued_at": self.enqueued_at.isoformat() if self.enqueued_at else None,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
        }


class Cluster(db.Model):
    __tablename__ = "clusters"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False, unique=True, index=True)
    description = db.Column(db.String(512), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="active")
    max_nodes = db.Column(db.Integer, nullable=False, default=16)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    nodes = db.relationship("FPGANode", backref="cluster", lazy="dynamic", cascade="all, delete-orphan")
    tasks = db.relationship("ClusterTask", backref="cluster", lazy="dynamic", cascade="all, delete-orphan")
    sync_messages = db.relationship("SyncMessage", backref="cluster_ref", lazy="dynamic", cascade="all, delete-orphan")

    creator = db.relationship("User", foreign_keys=[created_by])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "max_nodes": self.max_nodes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "node_count": self.nodes.count(),
        }


class FPGANode(db.Model):
    __tablename__ = "fpga_nodes"

    id = db.Column(db.Integer, primary_key=True)
    cluster_id = db.Column(db.Integer, db.ForeignKey("clusters.id"), nullable=False, index=True)
    name = db.Column(db.String(128), nullable=False)
    vendor_id = db.Column(db.String(16), nullable=True)
    product_id = db.Column(db.String(16), nullable=True)
    serial_number = db.Column(db.String(128), nullable=False, unique=True, index=True)
    usb_handle = db.Column(db.String(256), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="offline")
    load = db.Column(db.Integer, nullable=False, default=0)
    temperature = db.Column(db.Float, nullable=True)
    voltage = db.Column(db.Float, nullable=True)
    current_task_id = db.Column(db.Integer, nullable=True)
    tasks_completed = db.Column(db.Integer, nullable=False, default=0)
    total_execution_time = db.Column(db.Float, nullable=False, default=0.0)
    last_seen = db.Column(db.DateTime, nullable=True)
    x_position = db.Column(db.Integer, nullable=False, default=0)
    y_position = db.Column(db.Integer, nullable=False, default=0)

    assigned_chunks = db.relationship("TaskChunk", foreign_keys="TaskChunk.node_id", backref="node", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "cluster_id": self.cluster_id,
            "name": self.name,
            "vendor_id": self.vendor_id,
            "product_id": self.product_id,
            "serial_number": self.serial_number,
            "usb_handle": self.usb_handle,
            "status": self.status,
            "load": self.load,
            "temperature": self.temperature,
            "voltage": self.voltage,
            "current_task_id": self.current_task_id,
            "tasks_completed": self.tasks_completed,
            "total_execution_time": self.total_execution_time,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "x_position": self.x_position,
            "y_position": self.y_position,
        }


class ClusterTask(db.Model):
    __tablename__ = "cluster_tasks"

    id = db.Column(db.Integer, primary_key=True)
    cluster_id = db.Column(db.Integer, db.ForeignKey("clusters.id"), nullable=False, index=True)
    name = db.Column(db.String(256), nullable=False)
    bitstream_id = db.Column(db.Integer, db.ForeignKey("bitstreams.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")
    total_chunks = db.Column(db.Integer, nullable=False, default=1)
    completed_chunks = db.Column(db.Integer, nullable=False, default=0)
    priority = db.Column(db.Integer, nullable=False, default=0)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    estimated_duration = db.Column(db.Float, nullable=True)
    actual_duration = db.Column(db.Float, nullable=True)

    chunks = db.relationship("TaskChunk", backref="task", lazy="dynamic", cascade="all, delete-orphan")
    bitstream = db.relationship("Bitstream", foreign_keys=[bitstream_id])
    creator = db.relationship("User", foreign_keys=[created_by])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "cluster_id": self.cluster_id,
            "name": self.name,
            "bitstream_id": self.bitstream_id,
            "status": self.status,
            "total_chunks": self.total_chunks,
            "completed_chunks": self.completed_chunks,
            "priority": self.priority,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
            "estimated_duration": self.estimated_duration,
            "actual_duration": self.actual_duration,
            "progress": (self.completed_chunks / self.total_chunks * 100) if self.total_chunks > 0 else 0,
        }


class TaskChunk(db.Model):
    __tablename__ = "task_chunks"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("cluster_tasks.id"), nullable=False, index=True)
    node_id = db.Column(db.Integer, db.ForeignKey("fpga_nodes.id"), nullable=True, index=True)
    chunk_index = db.Column(db.Integer, nullable=False)
    chunk_data_hash = db.Column(db.String(64), nullable=True)
    chunk_size = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="pending")
    assigned_at = db.Column(db.DateTime, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    result_hash = db.Column(db.String(64), nullable=True)

    __table_args__ = (db.UniqueConstraint("task_id", "chunk_index", name="_task_chunk_uc"),)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "node_id": self.node_id,
            "chunk_index": self.chunk_index,
            "chunk_data_hash": self.chunk_data_hash,
            "chunk_size": self.chunk_size,
            "status": self.status,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
            "result_hash": self.result_hash,
        }


class SyncMessage(db.Model):
    __tablename__ = "sync_messages"

    id = db.Column(db.Integer, primary_key=True)
    cluster_id = db.Column(db.Integer, db.ForeignKey("clusters.id"), nullable=False, index=True)
    source_node_id = db.Column(db.Integer, db.ForeignKey("fpga_nodes.id"), nullable=True, index=True)
    target_node_id = db.Column(db.Integer, db.ForeignKey("fpga_nodes.id"), nullable=True, index=True)
    message_type = db.Column(db.String(20), nullable=False)
    payload = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")

    source_node = db.relationship("FPGANode", foreign_keys=[source_node_id])
    target_node = db.relationship("FPGANode", foreign_keys=[target_node_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "cluster_id": self.cluster_id,
            "source_node_id": self.source_node_id,
            "target_node_id": self.target_node_id,
            "message_type": self.message_type,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "status": self.status,
        }
