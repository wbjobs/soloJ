const { generateTaskId, splitIntoBlocks } = require('../common/utils');

const TASK_TIMEOUT_MS = 30000;
const BLOCK_SIZE = 16;

class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.pendingBlocks = [];
    this.inProgressBlocks = new Map();
    this.completedBlocks = new Map();
    this.workers = new Map();
    this.taskStats = new Map();
  }

  createTask(scene) {
    const taskId = generateTaskId();
    const blocks = splitIntoBlocks(scene.width, scene.height, BLOCK_SIZE);
    
    const task = {
      id: taskId,
      scene,
      totalBlocks: blocks.length,
      completedBlocks: 0,
      status: 'pending',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      pixelData: new Map(),
      stats: {
        totalSamples: 0,
        workerTimes: new Map(),
        blockStats: new Map()
      }
    };

    this.tasks.set(taskId, task);
    this.taskStats.set(taskId, {
      pendingBlocks: [...blocks],
      inProgressBlocks: new Map(),
      completedBlocks: new Map()
    });

    blocks.forEach(block => {
      this.pendingBlocks.push({
        taskId,
        blockId: block.blockId,
        startX: block.startX,
        startY: block.startY,
        endX: block.endX,
        endY: block.endY,
        scene
      });
    });

    return taskId;
  }

  getNextTask(workerId) {
    if (this.pendingBlocks.length === 0) {
      return null;
    }

    const block = this.pendingBlocks.shift();
    const task = this.tasks.get(block.taskId);
    
    if (task.status === 'pending') {
      task.status = 'running';
      task.startedAt = Date.now();
    }

    block.assignedTo = workerId;
    block.assignedAt = Date.now();
    
    this.inProgressBlocks.set(`${block.taskId}-${block.blockId}`, block);
    
    const taskStat = this.taskStats.get(block.taskId);
    if (taskStat) {
      taskStat.pendingBlocks = taskStat.pendingBlocks.filter(b => b.blockId !== block.blockId);
      taskStat.inProgressBlocks.set(block.blockId, { ...block, workerId });
    }

    return block;
  }

  submitResult(taskId, blockId, workerId, pixels, renderTimeMs, totalSamples) {
    const key = `${taskId}-${blockId}`;
    const block = this.inProgressBlocks.get(key);
    
    if (!block) {
      return { success: false, message: 'Block not found or already completed' };
    }

    this.inProgressBlocks.delete(key);
    this.completedBlocks.set(key, {
      ...block,
      completedBy: workerId,
      completedAt: Date.now(),
      renderTimeMs,
      totalSamples
    });

    const task = this.tasks.get(taskId);
    if (task) {
      pixels.forEach(p => {
        task.pixelData.set(`${p.x}-${p.y}`, p);
      });
      task.completedBlocks++;
      task.stats.totalSamples += totalSamples;
      
      const workerTime = task.stats.workerTimes.get(workerId) || 0;
      task.stats.workerTimes.set(workerId, workerTime + renderTimeMs);
      task.stats.blockStats.set(blockId, { workerId, renderTimeMs, totalSamples });

      const taskStat = this.taskStats.get(taskId);
      if (taskStat) {
        taskStat.inProgressBlocks.delete(blockId);
        taskStat.completedBlocks.set(blockId, {
          workerId,
          renderTimeMs,
          totalSamples
        });
      }

      if (task.completedBlocks >= task.totalBlocks) {
        task.status = 'completed';
        task.completedAt = Date.now();
      }
    }

    return { success: true };
  }

  registerWorker(workerId, address, cores) {
    this.workers.set(workerId, {
      id: workerId,
      address,
      cores,
      status: 'active',
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      currentLoad: 0,
      currentTaskId: null
    });
  }

  heartbeat(workerId, currentLoad, currentTaskId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.lastHeartbeat = Date.now();
      worker.currentLoad = currentLoad;
      worker.currentTaskId = currentTaskId;
      return true;
    }
    return false;
  }

  checkTimeouts() {
    const now = Date.now();
    const timedOut = [];

    for (const [key, block] of this.inProgressBlocks.entries()) {
      if (now - block.assignedAt > TASK_TIMEOUT_MS) {
        timedOut.push(block);
        this.inProgressBlocks.delete(key);
        
        const taskStat = this.taskStats.get(block.taskId);
        if (taskStat) {
          taskStat.inProgressBlocks.delete(block.blockId);
          taskStat.pendingBlocks.push({
            blockId: block.blockId,
            startX: block.startX,
            startY: block.startY,
            endX: block.endX,
            endY: block.endY
          });
        }

        this.pendingBlocks.unshift({
          taskId: block.taskId,
          blockId: block.blockId,
          startX: block.startX,
          startY: block.startY,
          endX: block.endX,
          endY: block.endY,
          scene: block.scene
        });
      }
    }

    for (const [workerId, worker] of this.workers.entries()) {
      if (now - worker.lastHeartbeat > TASK_TIMEOUT_MS * 2) {
        worker.status = 'dead';
      }
    }

    return timedOut;
  }

  getTaskStatus(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const progress = task.totalBlocks > 0 
      ? (task.completedBlocks / task.totalBlocks) * 100 
      : 0;

    let eta = null;
    if (task.status === 'running' && task.completedBlocks > 0) {
      const elapsed = Date.now() - task.startedAt;
      const timePerBlock = elapsed / task.completedBlocks;
      const remainingBlocks = task.totalBlocks - task.completedBlocks;
      eta = timePerBlock * remainingBlocks;
    }

    return {
      taskId,
      status: task.status,
      progress,
      totalBlocks: task.totalBlocks,
      completedBlocks: task.completedBlocks,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      eta,
      totalSamples: task.stats.totalSamples
    };
  }

  getAllTasks() {
    return Array.from(this.tasks.values()).map(task => ({
      taskId: task.id,
      status: task.status,
      progress: task.totalBlocks > 0 ? (task.completedBlocks / task.totalBlocks) * 100 : 0,
      totalBlocks: task.totalBlocks,
      completedBlocks: task.completedBlocks,
      createdAt: task.createdAt,
      width: task.scene.width,
      height: task.scene.height,
      samplesPerPixel: task.scene.samplesPerPixel,
      previewUrl: task.previewUrl || null,
      previewWidth: task.previewWidth || null,
      previewHeight: task.previewHeight || null
    }));
  }

  getWorkerStatus() {
    return Array.from(this.workers.values()).map(worker => ({
      workerId: worker.id,
      address: worker.address,
      cores: worker.cores,
      status: worker.status,
      lastHeartbeat: worker.lastHeartbeat,
      currentLoad: worker.currentLoad,
      currentTaskId: worker.currentTaskId
    }));
  }

  getTaskStats(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      taskId,
      totalSamples: task.stats.totalSamples,
      workerTimes: Array.from(task.stats.workerTimes.entries()).map(([workerId, time]) => ({
        workerId,
        timeMs: time
      })),
      blockStats: Array.from(task.stats.blockStats.entries()).map(([blockId, stats]) => ({
        blockId,
        workerId: stats.workerId,
        renderTimeMs: stats.renderTimeMs,
        totalSamples: stats.totalSamples
      })),
      totalRenderTime: task.completedAt ? task.completedAt - task.startedAt : null
    };
  }

  getTaskPixelData(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    return Array.from(task.pixelData.values());
  }
}

module.exports = TaskManager;
