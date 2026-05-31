import logging
import json
import time
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Set, Any
from dataclasses import dataclass, asdict

from ..models import db, Cluster, FPGANode, SyncMessage

logger = logging.getLogger(__name__)

VALID_MESSAGE_TYPES = {"sync_barrier", "data", "ack", "error"}
VALID_MESSAGE_STATUSES = {"pending", "sent", "acknowledged", "failed"}
MAX_PAYLOAD_SIZE = 1024 * 1024


@dataclass
class SyncBarrier:
    barrier_id: str
    cluster_id: int
    node_ids: List[int]
    arrived_nodes: Set[int]
    created_at: datetime
    timeout_seconds: int
    is_completed: bool = False


class SyncProtocol:
    def __init__(self, db_session=None):
        self.db = db_session or db.session
        self._active_barriers: Dict[str, SyncBarrier] = {}

    def _validate_cluster(self, cluster_id: int) -> Cluster:
        cluster = Cluster.query.get(cluster_id)
        if not cluster:
            raise ValueError(f"Cluster {cluster_id} not found")
        if cluster.status != "active":
            raise ValueError(f"Cluster {cluster_id} is not active")
        return cluster

    def _validate_node(self, node_id: int, cluster_id: int) -> FPGANode:
        node = FPGANode.query.get(node_id)
        if not node:
            raise ValueError(f"Node {node_id} not found")
        if node.cluster_id != cluster_id:
            raise ValueError(f"Node {node_id} does not belong to cluster {cluster_id}")
        return node

    def _validate_message_type(self, message_type: str) -> None:
        if message_type not in VALID_MESSAGE_TYPES:
            raise ValueError(
                f"Invalid message type: {message_type}. "
                f"Must be one of: {VALID_MESSAGE_TYPES}"
            )

    def _serialize_payload(self, payload: Any) -> str:
        if payload is None:
            return ""
        if isinstance(payload, str):
            if len(payload) > MAX_PAYLOAD_SIZE:
                raise ValueError(f"Payload exceeds maximum size of {MAX_PAYLOAD_SIZE} bytes")
            return payload
        try:
            serialized = json.dumps(payload)
            if len(serialized) > MAX_PAYLOAD_SIZE:
                raise ValueError(f"Payload exceeds maximum size of {MAX_PAYLOAD_SIZE} bytes")
            return serialized
        except (TypeError, ValueError) as e:
            raise ValueError(f"Failed to serialize payload: {e}")

    def _deserialize_payload(self, payload_str: Optional[str]) -> Any:
        if not payload_str:
            return None
        try:
            return json.loads(payload_str)
        except json.JSONDecodeError:
            return payload_str

    def create_sync_barrier(
        self,
        cluster_id: int,
        node_ids: List[int],
        barrier_id: Optional[str] = None,
        timeout_seconds: int = 60,
    ) -> Tuple[bool, str, Optional[SyncBarrier]]:
        try:
            cluster = self._validate_cluster(cluster_id)

            if not node_ids:
                return False, "No nodes specified for barrier", None

            for node_id in node_ids:
                self._validate_node(node_id, cluster_id)

            if barrier_id is None:
                barrier_id = f"barrier_{cluster_id}_{int(time.time() * 1000)}"

            if barrier_id in self._active_barriers:
                return False, f"Barrier {barrier_id} already exists", None

            barrier = SyncBarrier(
                barrier_id=barrier_id,
                cluster_id=cluster_id,
                node_ids=node_ids.copy(),
                arrived_nodes=set(),
                created_at=datetime.utcnow(),
                timeout_seconds=timeout_seconds,
            )

            self._active_barriers[barrier_id] = barrier

            for node_id in node_ids:
                self.send_sync_message(
                    cluster_id=cluster_id,
                    source_node=None,
                    target_node=node_id,
                    message_type="sync_barrier",
                    payload={"barrier_id": barrier_id, "action": "wait"},
                )

            logger.info(
                f"Created sync barrier {barrier_id} for cluster {cluster_id} "
                f"with {len(node_ids)} nodes, timeout: {timeout_seconds}s"
            )

            return True, "Sync barrier created successfully", barrier

        except Exception as e:
            logger.error(f"Failed to create sync barrier: {str(e)}", exc_info=True)
            return False, f"Failed to create sync barrier: {str(e)}", None

    def _check_barrier_completion(self, barrier: SyncBarrier) -> bool:
        if set(barrier.node_ids).issubset(barrier.arrived_nodes):
            barrier.is_completed = True
            return True
        return False

    def _check_barrier_timeout(self, barrier: SyncBarrier) -> bool:
        elapsed = (datetime.utcnow() - barrier.created_at).total_seconds()
        if elapsed > barrier.timeout_seconds:
            return True
        return False

    def send_sync_message(
        self,
        cluster_id: int,
        source_node: Optional[int],
        target_node: Optional[int],
        message_type: str,
        payload: Any = None,
    ) -> Tuple[bool, str, Optional[SyncMessage]]:
        try:
            self._validate_cluster(cluster_id)
            self._validate_message_type(message_type)

            if source_node is not None:
                self._validate_node(source_node, cluster_id)

            if target_node is not None:
                self._validate_node(target_node, cluster_id)

            serialized_payload = self._serialize_payload(payload)

            sync_message = SyncMessage(
                cluster_id=cluster_id,
                source_node_id=source_node,
                target_node_id=target_node,
                message_type=message_type,
                payload=serialized_payload,
                timestamp=datetime.utcnow(),
                status="pending",
            )

            self.db.add(sync_message)
            self.db.flush()

            logger.debug(
                f"Sent sync message {sync_message.id}: "
                f"{source_node or 'HOST'} -> {target_node or 'ALL'}, "
                f"type: {message_type}"
            )

            self.db.commit()
            return True, "Message sent successfully", sync_message

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to send sync message: {str(e)}", exc_info=True)
            return False, f"Failed to send message: {str(e)}", None

    def process_incoming_messages(
        self,
        cluster_id: int,
        node_id: Optional[int] = None,
    ) -> Tuple[bool, str, List[Dict]]:
        try:
            self._validate_cluster(cluster_id)

            query = SyncMessage.query.filter_by(
                cluster_id=cluster_id,
                status="pending",
            )

            if node_id is not None:
                query = query.filter(
                    (SyncMessage.target_node_id == node_id)
                    | (SyncMessage.target_node_id.is_(None))
                )

            pending_messages = query.order_by(SyncMessage.timestamp.asc()).all()
            processed_messages = []

            for message in pending_messages:
                try:
                    message.status = "sent"

                    payload_data = self._deserialize_payload(message.payload)

                    if message.message_type == "sync_barrier":
                        self._handle_sync_barrier_message(message, payload_data)
                    elif message.message_type == "ack":
                        self._handle_ack_message(message, payload_data)
                    elif message.message_type == "error":
                        self._handle_error_message(message, payload_data)

                    processed_messages.append(
                        {
                            "id": message.id,
                            "source_node_id": message.source_node_id,
                            "target_node_id": message.target_node_id,
                            "message_type": message.message_type,
                            "payload": payload_data,
                            "timestamp": message.timestamp.isoformat(),
                        }
                    )

                    logger.debug(
                        f"Processed message {message.id}: "
                        f"{message.source_node_id or 'HOST'} -> "
                        f"{message.target_node_id or 'BROADCAST'}"
                    )

                except Exception as msg_error:
                    message.status = "failed"
                    logger.error(
                        f"Failed to process message {message.id}: {str(msg_error)}",
                        exc_info=True,
                    )

            self.db.commit()
            logger.info(f"Processed {len(processed_messages)} messages for cluster {cluster_id}")

            return True, "Messages processed successfully", processed_messages

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to process incoming messages: {str(e)}", exc_info=True)
            return False, f"Failed to process messages: {str(e)}", []

    def _handle_sync_barrier_message(self, message: SyncMessage, payload: Any) -> None:
        if not isinstance(payload, dict):
            return

        barrier_id = payload.get("barrier_id")
        action = payload.get("action")

        if not barrier_id or barrier_id not in self._active_barriers:
            return

        barrier = self._active_barriers[barrier_id]

        if action == "arrive" and message.source_node_id:
            barrier.arrived_nodes.add(message.source_node_id)
            self._check_barrier_completion(barrier)

            if barrier.is_completed:
                for node_id in barrier.node_ids:
                    self.send_sync_message(
                        cluster_id=barrier.cluster_id,
                        source_node=None,
                        target_node=node_id,
                        message_type="sync_barrier",
                        payload={"barrier_id": barrier_id, "action": "release"},
                    )

    def _handle_ack_message(self, message: SyncMessage, payload: Any) -> None:
        if isinstance(payload, dict) and "message_id" in payload:
            orig_msg_id = payload["message_id"]
            orig_msg = SyncMessage.query.get(orig_msg_id)
            if orig_msg:
                orig_msg.status = "acknowledged"

    def _handle_error_message(self, message: SyncMessage, payload: Any) -> None:
        logger.warning(
            f"Received error message from node {message.source_node_id}: {payload}"
        )

    def wait_for_all_nodes(
        self,
        cluster_id: int,
        message_type: str,
        timeout: int = 30,
        source_node: Optional[int] = None,
    ) -> Tuple[bool, str, Dict]:
        try:
            self._validate_cluster(cluster_id)
            self._validate_message_type(message_type)

            nodes = FPGANode.query.filter_by(cluster_id=cluster_id, status="idle").all()
            node_ids = {node.id for node in nodes}

            if not node_ids:
                return False, "No active nodes in cluster", {}

            start_time = time.time()
            acknowledged_nodes: Set[int] = set()

            while time.time() - start_time < timeout:
                messages = SyncMessage.query.filter_by(
                    cluster_id=cluster_id,
                    message_type=message_type,
                    status="acknowledged",
                )

                if source_node is not None:
                    messages = messages.filter_by(source_node_id=source_node)

                for msg in messages.all():
                    if msg.target_node_id:
                        acknowledged_nodes.add(msg.target_node_id)

                if node_ids.issubset(acknowledged_nodes):
                    logger.info(
                        f"All {len(node_ids)} nodes acknowledged "
                        f"{message_type} in cluster {cluster_id}"
                    )
                    return (
                        True,
                        "All nodes acknowledged",
                        {
                            "total_nodes": len(node_ids),
                            "acknowledged_nodes": list(acknowledged_nodes),
                            "elapsed_time": time.time() - start_time,
                        },
                    )

                time.sleep(0.5)

            unacknowledged = node_ids - acknowledged_nodes
            logger.warning(
                f"Timeout waiting for {message_type} in cluster {cluster_id}. "
                f"Unacknowledged nodes: {unacknowledged}"
            )

            return (
                False,
                "Timeout waiting for node acknowledgements",
                {
                    "total_nodes": len(node_ids),
                    "acknowledged_nodes": list(acknowledged_nodes),
                    "unacknowledged_nodes": list(unacknowledged),
                    "elapsed_time": time.time() - start_time,
                },
            )

        except Exception as e:
            logger.error(f"Failed while waiting for nodes: {str(e)}", exc_info=True)
            return False, f"Wait failed: {str(e)}", {}

    def broadcast_message(
        self,
        cluster_id: int,
        source_node: Optional[int],
        message_type: str,
        payload: Any = None,
    ) -> Tuple[bool, str, List[SyncMessage]]:
        try:
            self._validate_cluster(cluster_id)

            nodes = FPGANode.query.filter_by(cluster_id=cluster_id, status="idle").all()

            if not nodes:
                return False, "No active nodes to broadcast to", []

            sent_messages = []
            for node in nodes:
                success, _, message = self.send_sync_message(
                    cluster_id=cluster_id,
                    source_node=source_node,
                    target_node=node.id,
                    message_type=message_type,
                    payload=payload,
                )
                if success and message:
                    sent_messages.append(message)

            logger.info(
                f"Broadcast {message_type} message to {len(sent_messages)}/{len(nodes)} "
                f"nodes in cluster {cluster_id}"
            )

            return (
                True,
                f"Broadcast to {len(sent_messages)} nodes",
                sent_messages,
            )

        except Exception as e:
            logger.error(f"Failed to broadcast message: {str(e)}", exc_info=True)
            return False, f"Broadcast failed: {str(e)}", []

    def node_arrive_at_barrier(
        self,
        barrier_id: str,
        node_id: int,
    ) -> Tuple[bool, str, Dict]:
        try:
            if barrier_id not in self._active_barriers:
                return False, f"Barrier {barrier_id} not found", {}

            barrier = self._active_barriers[barrier_id]

            if node_id not in barrier.node_ids:
                return False, f"Node {node_id} is not part of barrier {barrier_id}", {}

            if self._check_barrier_timeout(barrier):
                del self._active_barriers[barrier_id]
                return False, "Barrier has timed out", {}

            barrier.arrived_nodes.add(node_id)
            is_released = self._check_barrier_completion(barrier)

            logger.info(
                f"Node {node_id} arrived at barrier {barrier_id}. "
                f"{len(barrier.arrived_nodes)}/{len(barrier.node_ids)} nodes present."
            )

            return (
                True,
                "Node arrived at barrier",
                {
                    "barrier_id": barrier_id,
                    "arrived_count": len(barrier.arrived_nodes),
                    "total_nodes": len(barrier.node_ids),
                    "is_released": is_released,
                },
            )

        except Exception as e:
            logger.error(f"Failed to process node barrier arrival: {str(e)}", exc_info=True)
            return False, f"Barrier arrival failed: {str(e)}", {}

    def get_active_barriers(self, cluster_id: int) -> Tuple[bool, str, List[Dict]]:
        try:
            self._validate_cluster(cluster_id)

            cluster_barriers = [
                asdict(barrier)
                for barrier in self._active_barriers.values()
                if barrier.cluster_id == cluster_id
            ]

            return True, "Retrieved active barriers", cluster_barriers

        except Exception as e:
            logger.error(f"Failed to get active barriers: {str(e)}", exc_info=True)
            return False, f"Failed to get barriers: {str(e)}", []

    def cleanup_barriers(self) -> Tuple[bool, str, int]:
        try:
            cleaned_count = 0
            barrier_ids_to_remove = []

            for barrier_id, barrier in self._active_barriers.items():
                if barrier.is_completed or self._check_barrier_timeout(barrier):
                    barrier_ids_to_remove.append(barrier_id)

            for barrier_id in barrier_ids_to_remove:
                del self._active_barriers[barrier_id]
                cleaned_count += 1

            if cleaned_count > 0:
                logger.info(f"Cleaned up {cleaned_count} completed/timed-out barriers")

            return True, "Barrier cleanup complete", cleaned_count

        except Exception as e:
            logger.error(f"Failed to cleanup barriers: {str(e)}", exc_info=True)
            return False, f"Cleanup failed: {str(e)}", 0


_protocol_instance: Optional[SyncProtocol] = None


def get_sync_protocol() -> SyncProtocol:
    global _protocol_instance
    if _protocol_instance is None:
        _protocol_instance = SyncProtocol()
    return _protocol_instance
