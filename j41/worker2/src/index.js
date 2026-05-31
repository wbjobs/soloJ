require('dotenv').config();
const { exec } = require('child_process');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

const WORKER_ID = process.env.WORKER_ID || 'worker-2';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TASK_QUEUE_KEY = 'cron:task:queue';
const RESULT_CHANNEL = 'cron:task:result';
const LOCK_KEY_PREFIX = 'cron:lock:';
const RUNNING_KEY_PREFIX = 'cron:running:';

const RELEASE_LOCK_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    redis.call('del', KEYS[1])
    return 1
  else
    return 0
  end
`;

const RENEW_LOCK_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('expire', KEYS[1], ARGV[2])
  else
    return 0
  end
`;

const VERIFY_OWNERSHIP_SCRIPT = `
  local lockKey = KEYS[1]
  local runningKey = KEYS[2]
  local lockValue = ARGV[1]
  local executionId = ARGV[2]
  
  if redis.call('get', lockKey) ~= lockValue then
    return 0
  end
  
  if redis.call('get', runningKey) ~= executionId then
    return 0
  end
  
  return 1
`;

const CLEAR_RUNNING_MARK_SCRIPT = `
  local runningKey = KEYS[1]
  local lockKey = KEYS[2]
  local lockValue = ARGV[1]
  local executionId = ARGV[2]
  
  local currentExecution = redis.call('get', runningKey)
  if currentExecution == executionId then
    redis.call('del', runningKey)
  end
  
  if redis.call('get', lockKey) == lockValue then
    redis.call('del', lockKey)
  end
  
  return 1
`;

let client;
let subscriber;

async function connectRedis() {
  client = redis.createClient({ 
    url: REDIS_URL,
    retryDelayOnFailover: 100,
    enableOfflineQueue: true,
  });
  
  client.on('error', (err) => console.error(`[${WORKER_ID}] Redis Client Error:`, err.message));
  client.on('reconnecting', () => console.log(`[${WORKER_ID}] Redis reconnecting...`));
  client.on('ready', () => console.log(`[${WORKER_ID}] Redis connection restored`));
  
  await client.connect();
  
  subscriber = client.duplicate();
  await subscriber.connect();
  
  console.log(`[${WORKER_ID}] Connected to Redis`);
}

function isRedisConnected() {
  return client && client.isOpen;
}

async function executeCommand(command, timeout) {
  return new Promise((resolve, reject) => {
    const execTimeout = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout} seconds`));
    }, timeout * 1000);

    const isWindows = process.platform === 'win32';
    const shellCommand = isWindows 
      ? `powershell -Command "${command.replace(/"/g, '\\"')}"`
      : command;

    exec(shellCommand, { shell: true }, (error, stdout, stderr) => {
      clearTimeout(execTimeout);
      
      if (error) {
        reject({ error, stderr });
      } else {
        resolve(stdout);
      }
    });
  });
}

async function renewLock(taskId, lockValue, ttl) {
  if (!isRedisConnected()) return false;
  
  const lockKey = `${LOCK_KEY_PREFIX}${taskId}`;
  try {
    const result = await client.eval(RENEW_LOCK_SCRIPT, {
      keys: [lockKey],
      arguments: [lockValue, String(ttl)],
    });
    return result === 1;
  } catch (err) {
    console.error(`[${WORKER_ID}] Failed to renew lock for task ${taskId}:`, err.message);
    return false;
  }
}

async function verifyOwnership(taskId, executionId, lockValue) {
  if (!isRedisConnected()) return false;
  
  const lockKey = `${LOCK_KEY_PREFIX}${taskId}`;
  const runningKey = `${RUNNING_KEY_PREFIX}${taskId}`;
  
  try {
    const result = await client.eval(VERIFY_OWNERSHIP_SCRIPT, {
      keys: [lockKey, runningKey],
      arguments: [lockValue, executionId],
    });
    return result === 1;
  } catch (err) {
    console.error(`[${WORKER_ID}] Failed to verify ownership for task ${taskId}:`, err.message);
    return false;
  }
}

async function clearRunningMark(taskId, executionId, lockValue) {
  if (!isRedisConnected()) return;
  
  const runningKey = `${RUNNING_KEY_PREFIX}${taskId}`;
  const lockKey = `${LOCK_KEY_PREFIX}${taskId}`;
  
  try {
    await client.eval(CLEAR_RUNNING_MARK_SCRIPT, {
      keys: [runningKey, lockKey],
      arguments: [lockValue, executionId],
    });
  } catch (err) {
    console.error(`[${WORKER_ID}] Failed to clear running mark for task ${taskId}:`, err.message);
  }
}

async function publishResult(result) {
  if (!isRedisConnected()) {
    console.warn(`[${WORKER_ID}] Redis not connected, cannot publish result for task ${result.taskName}`);
    return;
  }
  
  try {
    await client.publish(RESULT_CHANNEL, JSON.stringify(result));
  } catch (err) {
    console.error(`[${WORKER_ID}] Failed to publish result:`, err.message);
  }
}

async function processTask(task) {
  const executionId = task.executionId || uuidv4();
  const startTime = Date.now();
  const lockValue = task.lockValue;
  const lockTtl = task.lockTtl || Math.max(task.timeout * 3, 60);
  
  console.log(`[${WORKER_ID}] Processing task: ${task.name} (${task.id}) execution: ${executionId}`);
  
  const isOwner = await verifyOwnership(task.id, executionId, lockValue);
  if (!isOwner) {
    console.log(`[${WORKER_ID}] CONFLICT: Task ${task.name} ownership verification failed. Another worker may be processing it.`);
    
    await publishResult({
      executionId,
      taskId: task.id,
      taskName: task.name,
      workerId: WORKER_ID,
      status: 'conflict',
      output: '',
      error: 'Ownership verification failed. Another worker may have acquired the lock due to Redis connection issues.',
      duration: 0,
    });
    return;
  }
  
  const renewInterval = Math.floor(lockTtl * 1000 / 3);
  let lockRenewer = setInterval(async () => {
    const renewed = await renewLock(task.id, lockValue, lockTtl);
    if (!renewed) {
      console.warn(`[${WORKER_ID}] Failed to renew lock for task ${task.name}, may lose ownership`);
    }
  }, renewInterval);
  
  let conflictDetected = false;
  const ownershipChecker = setInterval(async () => {
    const stillOwner = await verifyOwnership(task.id, executionId, lockValue);
    if (!stillOwner) {
      conflictDetected = true;
      console.warn(`[${WORKER_ID}] CONFLICT DETECTED: Lost ownership of task ${task.name} during execution!`);
    }
  }, 1000);

  try {
    const output = await executeCommand(task.command, task.timeout);
    const duration = Date.now() - startTime;
    
    if (conflictDetected) {
      console.log(`[${WORKER_ID}] Task ${task.name} completed but conflict was detected during execution`);
      await publishResult({
        executionId,
        taskId: task.id,
        taskName: task.name,
        workerId: WORKER_ID,
        status: 'conflict',
        output,
        error: 'Conflict detected during execution. Another worker may have also processed this task.',
        duration,
      });
    } else {
      console.log(`[${WORKER_ID}] Task completed: ${task.name} in ${duration}ms`);
      
      await publishResult({
        executionId,
        taskId: task.id,
        taskName: task.name,
        workerId: WORKER_ID,
        status: 'success',
        output,
        duration,
      });
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err.error ? err.error.message : (err.message || 'Unknown error');
    const stderr = err.stderr || '';
    
    console.log(`[${WORKER_ID}] Task failed: ${task.name} - ${errorMessage}`);
    
    if (conflictDetected) {
      await publishResult({
        executionId,
        taskId: task.id,
        taskName: task.name,
        workerId: WORKER_ID,
        status: 'conflict',
        output: stderr,
        error: `Conflict detected during execution. Original error: ${errorMessage}`,
        duration,
      });
    } else {
      await publishResult({
        executionId,
        taskId: task.id,
        taskName: task.name,
        workerId: WORKER_ID,
        status: 'failed',
        output: stderr,
        error: errorMessage,
        duration,
      });
    }
  } finally {
    clearInterval(lockRenewer);
    clearInterval(ownershipChecker);
    
    await clearRunningMark(task.id, executionId, lockValue);
    
    console.log(`[${WORKER_ID}] Cleaned up resources for task ${task.name}`);
  }
}

async function startWorker() {
  await connectRedis();
  
  console.log(`[${WORKER_ID}] Worker started, waiting for tasks...`);
  
  while (true) {
    try {
      if (!isRedisConnected()) {
        console.log(`[${WORKER_ID}] Waiting for Redis connection...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      const result = await client.brPop(TASK_QUEUE_KEY, 0);
      if (result) {
        const task = JSON.parse(result.element);
        await processTask(task);
      }
    } catch (error) {
      console.error(`[${WORKER_ID}] Error processing task:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

process.on('SIGTERM', async () => {
  console.log(`[${WORKER_ID}] SIGTERM received, shutting down`);
  if (client) await client.quit();
  if (subscriber) await subscriber.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(`[${WORKER_ID}] SIGINT received, shutting down`);
  if (client) await client.quit();
  if (subscriber) await subscriber.quit();
  process.exit(0);
});

startWorker().catch(console.error);
