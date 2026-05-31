const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const taskStore = require('../models/TaskStore');
const redisService = require('./RedisService');

class SchedulerService {
  constructor() {
    this.scheduledTasks = new Map();
  }

  start() {
    console.log('Scheduler service started');
  }

  scheduleTask(task) {
    if (this.scheduledTasks.has(task.id)) {
      this.unscheduleTask(task.id);
    }

    if (task.status !== 'active') {
      return;
    }

    try {
      const job = cron.schedule(task.cronExpression, async () => {
        await this.triggerTask(task);
      });

      this.scheduledTasks.set(task.id, job);
      console.log(`Task ${task.name} scheduled with cron: ${task.cronExpression}`);
    } catch (error) {
      console.error(`Failed to schedule task ${task.name}:`, error.message);
    }
  }

  unscheduleTask(taskId) {
    const job = this.scheduledTasks.get(taskId);
    if (job) {
      job.stop();
      this.scheduledTasks.delete(taskId);
      console.log(`Task ${taskId} unscheduled`);
    }
  }

  async triggerTask(task) {
    console.log(`Triggering task: ${task.name}`);
    
    if (!redisService.isConnected()) {
      console.warn(`Redis not connected, skipping task ${task.name}`);
      return;
    }
    
    const depCheck = taskStore.checkDependenciesMet(task.id);
    if (!depCheck.met) {
      if (depCheck.reason === 'failed') {
        console.log(`Task ${task.name} skipped: dependencies failed - ${depCheck.failedTasks.join(', ')}`);
      } else if (depCheck.reason === 'pending') {
        console.log(`Task ${task.name} skipped: dependencies pending - ${depCheck.pendingTasks.join(', ')}`);
      }
      return;
    }

    const lockResult = await redisService.acquireLock(task.id, task.timeout);
    if (!lockResult) {
      console.log(`Task ${task.name} is already being processed by another worker`);
      return;
    }

    const { lockValue, lockTtl } = lockResult;
    const executionId = uuidv4();

    try {
      const markSet = await redisService.setRunningMark(
        task.id,
        executionId,
        lockValue,
        lockTtl
      );

      if (!markSet) {
        console.log(`Task ${task.name} already has a running execution, releasing lock`);
        await redisService.releaseLock(task.id, lockValue);
        return;
      }

      await redisService.enqueueTask({
        id: task.id,
        name: task.name,
        command: task.command,
        timeout: task.timeout,
        lockValue,
        lockTtl,
        executionId,
      });
      console.log(`Task ${task.name} enqueued with executionId: ${executionId}`);
    } catch (error) {
      console.error(`Failed to enqueue task ${task.name}:`, error);
      try {
        await redisService.clearRunningMark(task.id, executionId, lockValue);
      } catch (e) {
        console.error('Failed to clear running mark:', e);
      }
    }
  }

  rescheduleAll() {
    const tasks = taskStore.getTasks();
    tasks.forEach(task => {
      if (task.status === 'active') {
        this.scheduleTask(task);
      }
    });
  }

  stop() {
    this.scheduledTasks.forEach((job) => job.stop());
    this.scheduledTasks.clear();
  }
}

module.exports = new SchedulerService();
