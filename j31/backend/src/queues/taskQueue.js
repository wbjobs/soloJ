import Queue from 'bull';
import axios from 'axios';
import dotenv from 'dotenv';
import Task from '../models/Task.js';
import websocketManager from '../websocket/WebSocketManager.js';
import redis from '../config/redis.js';
import { abTestService } from '../services/abTestService.js';

dotenv.config();

const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');
const PROGRESS_POLL_INTERVAL = parseInt(process.env.PROGRESS_POLL_INTERVAL || '5000');
const ALGORITHM_TIMEOUT = parseInt(process.env.ALGORITHM_TIMEOUT || '600000');

const alignmentQueue = new Queue('subtitle-alignment', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  limiter: {
    max: MAX_CONCURRENT_JOBS,
    duration: 1000
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    timeout: ALGORITHM_TIMEOUT,
    removeOnComplete: true,
    removeOnFail: 100
  }
});

const activeTasks = new Map();
const progressPollers = new Map();

const updateTaskProgress = async (taskId, progress, status, message) => {
  try {
    const progressKey = `task_progress:${taskId}`;
    await redis.set(progressKey, JSON.stringify({
      progress,
      status,
      message,
      timestamp: Date.now()
    }), 'EX', 86400);
    
    await Task.update(
      { progress, status },
      { where: { id: taskId } }
    );
    
    websocketManager.sendProgress(taskId, progress, status, message);
  } catch (error) {
    console.error(`[Queue] Failed to update progress for task ${taskId}:`, error.message);
  }
};

const getStoredProgress = async (taskId) => {
  try {
    const progressKey = `task_progress:${taskId}`;
    const data = await redis.get(progressKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    return null;
  }
};

const startProgressPoller = async (taskId, algorithmServiceUrl) => {
  if (progressPollers.has(taskId)) {
    return;
  }
  
  console.log(`[Queue] Starting progress poller for task ${taskId}`);
  
  const poll = async () => {
    try {
      if (!activeTasks.has(taskId)) {
        stopProgressPoller(taskId);
        return;
      }
      
      const response = await axios.get(
        `${algorithmServiceUrl}/api/v1/task/${taskId}/progress`,
        { timeout: 5000 }
      );
      
      if (response.data && response.data.status !== 'pending') {
        const { progress, status, message } = response.data;
        await updateTaskProgress(taskId, progress, status, message);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`[Queue] Task ${taskId} not found in algorithm service, stopping poller`);
        stopProgressPoller(taskId);
      } else {
        console.warn(`[Queue] Progress poll failed for ${taskId}:`, error.message);
      }
    }
  };
  
  const intervalId = setInterval(poll, PROGRESS_POLL_INTERVAL);
  progressPollers.set(taskId, intervalId);
  
  poll();
};

const stopProgressPoller = (taskId) => {
  const intervalId = progressPollers.get(taskId);
  if (intervalId) {
    clearInterval(intervalId);
    progressPollers.delete(taskId);
    console.log(`[Queue] Stopped progress poller for task ${taskId}`);
  }
};

const checkAlgorithmServiceHealth = async () => {
  try {
    const response = await axios.get(
      `${process.env.ALGORITHM_SERVICE_URL}/health`,
      { timeout: 5000 }
    );
    return response.data.status === 'ok';
  } catch (error) {
    console.error('[Queue] Algorithm service health check failed:', error.message);
    return false;
  }
};

const getActiveTaskCount = () => {
  return activeTasks.size;
};

const getQueueStats = async () => {
  const [waiting, active, completed, failed] = await Promise.all([
    alignmentQueue.getWaitingCount(),
    alignmentQueue.getActiveCount(),
    alignmentQueue.getCompletedCount(),
    alignmentQueue.getFailedCount()
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    maxConcurrent: MAX_CONCURRENT_JOBS,
    activeTasks: getActiveTaskCount()
  };
};

alignmentQueue.process(MAX_CONCURRENT_JOBS, async (job) => {
  const { taskId, videoPath, subtitlePath } = job.data;
  
  console.log(`[Queue] Processing job ${job.id} for task ${taskId}`);
  console.log(`[Queue] Active tasks: ${getActiveTaskCount() + 1}/${MAX_CONCURRENT_JOBS}`);
  
  const startTime = Date.now();
  activeTasks.set(taskId, { jobId: job.id, startTime });
  
  try {
    const assignment = await abTestService.getAssignmentForTask(taskId);
    console.log(`[Queue] Task ${taskId} assigned to ${assignment.variant} group, model: ${assignment.modelVersion}`);
    
    if (assignment.abTestId) {
      await abTestService.recordAssignment(
        assignment.abTestId,
        taskId,
        assignment.modelId,
        assignment.variant
      );
    }
    
    const storedProgress = await getStoredProgress(taskId);
    if (storedProgress && storedProgress.status === 'processing') {
      console.log(`[Queue] Task ${taskId} has stored progress, continuing from ${storedProgress.progress}%`);
      await updateTaskProgress(taskId, storedProgress.progress, 'processing', storedProgress.message || '继续处理...');
    } else {
      await updateTaskProgress(taskId, 10, 'processing', '开始音频分析...');
    }
    
    const isHealthy = await checkAlgorithmServiceHealth();
    if (!isHealthy) {
      throw new Error('Algorithm service is not available');
    }
    
    startProgressPoller(taskId, process.env.ALGORITHM_SERVICE_URL);
    
    const cancellationToken = { cancelled: false };
    job.on('failed', () => {
      cancellationToken.cancelled = true;
    });
    
    let algorithmResponse;
    try {
      algorithmResponse = await axios.post(
        `${process.env.ALGORITHM_SERVICE_URL}/api/v1/align`,
        {
          task_id: taskId,
          video_path: videoPath,
          subtitle_path: subtitlePath,
          priority: job.opts.priority || 0,
          model_version: assignment.modelVersion,
          model_params: assignment.modelData || {}
        },
        { 
          timeout: ALGORITHM_TIMEOUT,
          onDownloadProgress: (progressEvent) => {
            if (cancellationToken.cancelled) return;
            
            const progress = progressEvent.progress ? 
              Math.min(95, Math.round(progressEvent.progress * 85) + 10) : undefined;
            
            if (progress) {
              updateTaskProgress(taskId, progress, 'processing', '校准算法处理中...');
            }
          }
        }
      );
    } catch (error) {
      stopProgressPoller(taskId);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Algorithm processing timed out');
      }
      
      throw error;
    }
    
    stopProgressPoller(taskId);
    
    const result = algorithmResponse.data;
    
    const validationResult = validateAlignmentResult(result, taskId);
    if (!validationResult.valid) {
      console.warn(`[Queue] Validation warning for task ${taskId}: ${validationResult.message}`);
      result.metadata = {
        ...result.metadata,
        validationWarning: validationResult.message
      };
    }
    
    await updateTaskProgress(taskId, 95, 'processing', '保存校准结果...');
    
    await Task.update(
      {
        status: 'completed',
        progress: 100,
        alignmentOffset: result.offset,
        confidence: result.confidence,
        vadSegments: result.vad_segments,
        subtitleSegments: result.subtitle_segments,
        alignedSubtitlePath: result.aligned_subtitle_path,
        modelVersion: assignment.modelVersion,
        metadata: {
          ...result.metadata,
          processingTime: Date.now() - startTime,
          queueStats: await getQueueStats(),
          abTestVariant: assignment.variant,
          abTestId: assignment.abTestId
        }
      },
      { where: { id: taskId } }
    );
    
    const progressKey = `task_progress:${taskId}`;
    await redis.del(progressKey);
    
    websocketManager.sendProgress(taskId, 100, 'completed', '字幕校准完成');
    websocketManager.sendCompletion(taskId, result);
    
    console.log(`[Queue] Task ${taskId} completed in ${Date.now() - startTime}ms`);
    
    return result;
    
  } catch (error) {
    stopProgressPoller(taskId);
    
    console.error(`[Queue] Task ${taskId} failed:`, error.message);
    
    const errorMessage = error.response?.data?.detail || error.message || '未知错误';
    
    await Task.update(
      {
        status: 'failed',
        errorMessage: errorMessage,
        progress: 0,
        metadata: {
          ...(Task.metadata || {}),
          error: errorMessage,
          failedAt: Date.now(),
          processingTime: Date.now() - startTime
        }
      },
      { where: { id: taskId } }
    );
    
    websocketManager.sendError(taskId, errorMessage);
    
    const progressKey = `task_progress:${taskId}`;
    await redis.del(progressKey);
    
    throw error;
  } finally {
    activeTasks.delete(taskId);
    stopProgressPoller(taskId);
    console.log(`[Queue] Cleaned up task ${taskId}. Active: ${getActiveTaskCount()}`);
  }
});

const validateAlignmentResult = (result, taskId) => {
  if (!result) {
    return { valid: false, message: 'Empty result from algorithm service' };
  }
  
  if (typeof result.offset !== 'number') {
    return { valid: false, message: 'Invalid offset value' };
  }
  
  if (Math.abs(result.offset) > 60) {
    return { valid: false, message: `Offset ${result.offset}s exceeds reasonable range` };
  }
  
  if (result.confidence !== undefined && result.confidence < 0.2) {
    return { valid: false, message: `Low confidence: ${result.confidence}` };
  }
  
  if (!result.vad_segments || result.vad_segments.length === 0) {
    return { valid: false, message: 'No VAD segments detected' };
  }
  
  if (!result.subtitle_segments || result.subtitle_segments.length === 0) {
    return { valid: false, message: 'No subtitle segments produced' };
  }
  
  return { valid: true };
};

alignmentQueue.on('completed', (job, result) => {
  console.log(`[Queue] Job ${job.id} completed successfully`);
});

alignmentQueue.on('failed', (job, err) => {
  console.error(`[Queue] Job ${job.id} failed:`, err.message);
});

alignmentQueue.on('stalled', (job) => {
  console.warn(`[Queue] Job ${job.id} has stalled`);
  const { taskId } = job.data;
  updateTaskProgress(taskId, job.progress() || 0, 'processing', '任务处理中，请稍候...');
});

alignmentQueue.on('waiting', (jobId) => {
  console.log(`[Queue] Job ${jobId} is waiting`);
});

alignmentQueue.on('active', (job) => {
  console.log(`[Queue] Job ${job.id} started processing`);
});

alignmentQueue.on('progress', (job, progress) => {
  const { taskId } = job.data;
  if (typeof progress === 'number') {
    updateTaskProgress(taskId, Math.min(95, progress), 'processing', '处理中...');
  }
});

export const addAlignmentTask = async (taskId, videoPath, subtitlePath, priority = 0) => {
  const stats = await getQueueStats();
  console.log(`[Queue] Adding task ${taskId}. Queue stats:`, stats);
  
  if (stats.waiting >= 10) {
    throw new Error('Queue is full. Please try again later.');
  }
  
  const estimatedWaitTime = stats.waiting * 60;
  await updateTaskProgress(
    taskId, 
    5, 
    'pending', 
    `任务已加入队列，预计等待 ${estimatedWaitTime} 秒...`
  );
  
  return alignmentQueue.add(
    { taskId, videoPath, subtitlePath },
    {
      priority,
      jobId: `task_${taskId}`,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      timeout: ALGORITHM_TIMEOUT,
      removeOnComplete: true,
      removeOnFail: 100
    }
  );
};

export const cancelTask = async (taskId) => {
  const jobs = await alignmentQueue.getJobs(['waiting', 'active', 'delayed']);
  
  for (const job of jobs) {
    if (job.data.taskId === taskId) {
      await job.remove();
      console.log(`[Queue] Cancelled job for task ${taskId}`);
      
      await Task.update(
        { status: 'failed', errorMessage: 'Task cancelled by user', progress: 0 },
        { where: { id: taskId } }
      );
      
      websocketManager.sendError(taskId, '任务已取消');
      
      return true;
    }
  }
  
  return false;
};

export {
  alignmentQueue,
  getQueueStats,
  getActiveTaskCount,
  updateTaskProgress,
  getStoredProgress
};

export default alignmentQueue;
