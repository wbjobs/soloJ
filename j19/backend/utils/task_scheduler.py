import logging
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

from ..models import db, Cluster, FPGANode, ClusterTask, TaskChunk

logger = logging.getLogger(__name__)

MAX_NODES_PER_CLUSTER = 16
DEFAULT_CHUNK_SIZE = 1024 * 1024


@dataclass
class ChunkData:
    index: int
    data: bytes
    size: int
    hash: str


class TaskScheduler:
    def __init__(self, db_session=None):
        self.db = db_session or db.session

    def _split_bitstream_into_chunks(
        self, bitstream_data: bytes, num_chunks: Optional[int] = None
    ) -> List[ChunkData]:
        if not bitstream_data:
            raise ValueError("Bitstream data cannot be empty")

        total_size = len(bitstream_data)
        if num_chunks is None:
            num_chunks = max(1, (total_size + DEFAULT_CHUNK_SIZE - 1) // DEFAULT_CHUNK_SIZE)

        chunk_size = (total_size + num_chunks - 1) // num_chunks
        chunks = []

        for i in range(num_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, total_size)
            chunk_data = bitstream_data[start:end]
            chunk_hash = hashlib.sha256(chunk_data).hexdigest()
            chunks.append(
                ChunkData(
                    index=i,
                    data=chunk_data,
                    size=len(chunk_data),
                    hash=chunk_hash,
                )
            )

        logger.info(f"Split bitstream into {len(chunks)} chunks, total size: {total_size} bytes")
        return chunks

    def _get_available_nodes(self, cluster_id: int) -> List[FPGANode]:
        cluster = Cluster.query.get(cluster_id)
        if not cluster:
            raise ValueError(f"Cluster {cluster_id} not found")

        available_nodes = (
            FPGANode.query.filter_by(cluster_id=cluster_id, status="idle")
            .order_by(FPGANode.load.asc())
            .all()
        )

        logger.debug(f"Found {len(available_nodes)} available nodes in cluster {cluster_id}")
        return available_nodes[:MAX_NODES_PER_CLUSTER]

    def _least_loaded_first_balance(
        self, chunks: List[ChunkData], nodes: List[FPGANode]
    ) -> Dict[int, List[ChunkData]]:
        if not nodes:
            raise ValueError("No available nodes for scheduling")

        node_loads = {node.id: node.load for node in nodes}
        assignments: Dict[int, List[ChunkData]] = {node.id: [] for node in nodes}

        for chunk in chunks:
            least_loaded_node_id = min(node_loads, key=node_loads.get)
            assignments[least_loaded_node_id].append(chunk)
            node_loads[least_loaded_node_id] += 1

        logger.info(f"Assigned {len(chunks)} chunks to {len(nodes)} nodes")
        return assignments

    def schedule_task(
        self,
        cluster_id: int,
        task_id: int,
        bitstream_data: bytes,
        num_chunks: Optional[int] = None,
    ) -> Tuple[bool, str, List[TaskChunk]]:
        try:
            task = ClusterTask.query.get(task_id)
            if not task:
                return False, f"Task {task_id} not found", []

            if task.status not in ["pending", "scheduled"]:
                return False, f"Task {task_id} is not in schedulable state: {task.status}", []

            chunks = self._split_bitstream_into_chunks(bitstream_data, num_chunks)
            available_nodes = self._get_available_nodes(cluster_id)

            if not available_nodes:
                task.status = "pending"
                task.error_message = "No available nodes for scheduling"
                self.db.commit()
                return False, "No available nodes for scheduling", []

            assignments = self._least_loaded_first_balance(chunks, available_nodes)

            created_chunks = []
            for node_id, node_chunks in assignments.items():
                node = FPGANode.query.get(node_id)
                for chunk_data in node_chunks:
                    task_chunk = TaskChunk(
                        task_id=task_id,
                        node_id=node_id,
                        chunk_index=chunk_data.index,
                        chunk_data_hash=chunk_data.hash,
                        chunk_size=chunk_data.size,
                        status="assigned",
                        assigned_at=datetime.utcnow(),
                    )
                    self.db.add(task_chunk)
                    created_chunks.append(task_chunk)

                    if node:
                        node.load += 1

            task.total_chunks = len(chunks)
            task.status = "scheduled"
            task.started_at = datetime.utcnow()

            self.db.commit()
            logger.info(f"Successfully scheduled task {task_id} with {len(chunks)} chunks")
            return True, "Task scheduled successfully", created_chunks

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to schedule task {task_id}: {str(e)}", exc_info=True)
            return False, f"Scheduling failed: {str(e)}", []

    def cancel_task(self, task_id: int) -> Tuple[bool, str]:
        try:
            task = ClusterTask.query.get(task_id)
            if not task:
                return False, f"Task {task_id} not found"

            if task.status in ["completed", "failed", "cancelled"]:
                return False, f"Task {task_id} is already in terminal state: {task.status}"

            pending_chunks = TaskChunk.query.filter(
                TaskChunk.task_id == task_id,
                TaskChunk.status.in_(["pending", "assigned", "scheduled"]),
            ).all()

            for chunk in pending_chunks:
                chunk.status = "failed"
                chunk.error_message = "Task cancelled by user"
                if chunk.node_id:
                    node = FPGANode.query.get(chunk.node_id)
                    if node and node.load > 0:
                        node.load -= 1

            task.status = "cancelled"
            task.completed_at = datetime.utcnow()
            if task.started_at:
                task.actual_duration = (task.completed_at - task.started_at).total_seconds()

            self.db.commit()
            logger.info(f"Successfully cancelled task {task_id}")
            return True, "Task cancelled successfully"

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to cancel task {task_id}: {str(e)}", exc_info=True)
            return False, f"Cancel failed: {str(e)}"

    def get_node_status(self, node_id: int) -> Tuple[bool, str, Optional[Dict]]:
        try:
            node = FPGANode.query.get(node_id)
            if not node:
                return False, f"Node {node_id} not found", None

            assigned_chunks = TaskChunk.query.filter_by(
                node_id=node_id, status="running"
            ).count()

            status_info = {
                "node": node.to_dict(),
                "assigned_chunks": assigned_chunks,
                "is_available": node.status == "idle",
                "is_alive": node.last_seen is not None
                and (datetime.utcnow() - node.last_seen).total_seconds() < 300,
            }

            return True, "Node status retrieved", status_info

        except Exception as e:
            logger.error(f"Failed to get node status {node_id}: {str(e)}", exc_info=True)
            return False, f"Status check failed: {str(e)}", None

    def rebalance_load(self, cluster_id: int) -> Tuple[bool, str, Dict]:
        try:
            cluster = Cluster.query.get(cluster_id)
            if not cluster:
                return False, f"Cluster {cluster_id} not found", {}

            nodes = FPGANode.query.filter_by(cluster_id=cluster_id).all()
            if not nodes:
                return False, "No nodes in cluster", {}

            running_chunks = TaskChunk.query.filter(
                TaskChunk.status == "running",
                TaskChunk.node_id.in_([n.id for n in nodes]),
            ).all()

            chunk_node_map = {chunk.id: chunk.node_id for chunk in running_chunks}

            node_loads = {node.id: node.load for node in nodes}
            avg_load = sum(node_loads.values()) / len(nodes) if nodes else 0

            reassignments = []
            overloaded_nodes = [
                (nid, load) for nid, load in node_loads.items() if load > avg_load + 1
            ]
            underloaded_nodes = [
                (nid, load) for nid, load in node_loads.items() if load < avg_load - 1
            ]

            overloaded_nodes.sort(key=lambda x: x[1], reverse=True)
            underloaded_nodes.sort(key=lambda x: x[1])

            for over_node_id, over_load in overloaded_nodes:
                for under_node_id, under_load in underloaded_nodes:
                    if over_load <= avg_load or under_load >= avg_load:
                        break

                    running_chunks_on_node = [
                        c for c in running_chunks if c.node_id == over_node_id
                    ]
                    if running_chunks_on_node:
                        chunk = running_chunks_on_node.pop(0)
                        chunk.node_id = under_node_id
                        reassignments.append(
                            {
                                "chunk_id": chunk.id,
                                "from_node": over_node_id,
                                "to_node": under_node_id,
                            }
                        )
                        over_load -= 1
                        under_load += 1

            self.db.commit()
            logger.info(f"Rebalanced load on cluster {cluster_id}: {len(reassignments)} chunks reassigned")

            return (
                True,
                "Load rebalanced successfully",
                {
                    "reassignments": reassignments,
                    "average_load": avg_load,
                    "node_loads": node_loads,
                },
            )

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to rebalance load on cluster {cluster_id}: {str(e)}", exc_info=True)
            return False, f"Rebalance failed: {str(e)}", {}

    def health_check(self, cluster_id: int) -> Tuple[bool, str, Dict]:
        try:
            cluster = Cluster.query.get(cluster_id)
            if not cluster:
                return False, f"Cluster {cluster_id} not found", {}

            nodes = FPGANode.query.filter_by(cluster_id=cluster_id).all()
            now = datetime.utcnow()
            timeout_seconds = 300

            health_report = {
                "cluster_id": cluster_id,
                "total_nodes": len(nodes),
                "healthy_nodes": 0,
                "unhealthy_nodes": 0,
                "offline_nodes": 0,
                "node_statuses": [],
            }

            for node in nodes:
                node_health = {
                    "node_id": node.id,
                    "name": node.name,
                    "status": node.status,
                    "load": node.load,
                    "is_alive": False,
                    "last_seen_seconds": None,
                }

                if node.last_seen:
                    seconds_since_seen = (now - node.last_seen).total_seconds()
                    node_health["last_seen_seconds"] = seconds_since_seen
                    node_health["is_alive"] = seconds_since_seen < timeout_seconds

                if node.status == "offline":
                    health_report["offline_nodes"] += 1
                elif node_health["is_alive"]:
                    health_report["healthy_nodes"] += 1
                else:
                    health_report["unhealthy_nodes"] += 1
                    node.status = "error"

                health_report["node_statuses"].append(node_health)

            health_report["all_healthy"] = (
                health_report["healthy_nodes"] == health_report["total_nodes"]
                and health_report["total_nodes"] > 0
            )

            self.db.commit()
            logger.info(
                f"Health check on cluster {cluster_id}: "
                f"{health_report['healthy_nodes']}/{health_report['total_nodes']} nodes healthy"
            )

            return True, "Health check completed", health_report

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed health check on cluster {cluster_id}: {str(e)}", exc_info=True)
            return False, f"Health check failed: {str(e)}", {}


_scheduler_instance: Optional[TaskScheduler] = None


def get_scheduler() -> TaskScheduler:
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = TaskScheduler()
    return _scheduler_instance
