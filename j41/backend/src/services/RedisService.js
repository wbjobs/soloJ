const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

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

const SET_RUNNING_MARK_SCRIPT = `
  local runningKey = KEYS[1]
  local lockKey = KEYS[2]
  local lockValue = ARGV[1]
  local executionId = ARGV[2]
  local ttl = ARGV[3]
  
  if redis.call('get', lockKey) ~= lockValue then
    return 0
  end
  
  local currentExecution = redis.call('get', runningKey)
  if currentExecution then
    return 0
  end
  
  redis.call('setex', runningKey, ttl, executionId)
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

class RedisService {
  constructor() {
    this.client = null;
    this.lockKeyPrefix = 'cron:lock:';
    this.runningKeyPrefix = 'cron:running:';
    this.taskQueueKey = 'cron:task:queue';
    this.resultChannel = 'cron:task:result';
  }

  async connect(url) {
    this.client = redis.createClient({ url });
    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('reconnecting', () => console.log('Redis reconnecting...'));
    this.client.on('ready', () => console.log('Redis connection restored'));
    await this.client.connect();
    console.log('Redis connected successfully');
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
    }
  }

  async acquireLock(taskId, timeout = 30) {
    const lockKey = `${this.lockKeyPrefix}${taskId}`;
    const lockValue = uuidv4();
    const lockTtl = Math.max(timeout * 3, 60);
    
    const result = await this.client.set(lockKey, lockValue, {
      NX: true,
      EX: lockTtl,
    });
    
    if (result === 'OK') {
      return { lockValue, lockTtl };
    }
    return null;
  }

  async releaseLock(taskId, lockValue) {
    const lockKey = `${this.lockKeyPrefix}${taskId}`;
    const result = await this.client.eval(RELEASE_LOCK_SCRIPT, {
      keys: [lockKey],
      arguments: [lockValue],
    });
    return result === 1;
  }

  async renewLock(taskId, lockValue, ttl) {
    const lockKey = `${this.lockKeyPrefix}${taskId}`;
    const result = await this.client.eval(RENEW_LOCK_SCRIPT, {
      keys: [lockKey],
      arguments: [lockValue, String(ttl)],
    });
    return result === 1;
  }

  async setRunningMark(taskId, executionId, lockValue, ttl) {
    const runningKey = `${this.runningKeyPrefix}${taskId}`;
    const lockKey = `${this.lockKeyPrefix}${taskId}`;
    
    const result = await this.client.eval(SET_RUNNING_MARK_SCRIPT, {
      keys: [runningKey, lockKey],
      arguments: [lockValue, executionId, String(ttl)],
    });
    return result === 1;
  }

  async clearRunningMark(taskId, executionId, lockValue) {
    const runningKey = `${this.runningKeyPrefix}${taskId}`;
    const lockKey = `${this.lockKeyPrefix}${taskId}`;
    
    await this.client.eval(CLEAR_RUNNING_MARK_SCRIPT, {
      keys: [runningKey, lockKey],
      arguments: [lockValue, executionId],
    });
  }

  async verifyOwnership(taskId, executionId, lockValue) {
    const lockKey = `${this.lockKeyPrefix}${taskId}`;
    const runningKey = `${this.runningKeyPrefix}${taskId}`;
    
    const result = await this.client.eval(VERIFY_OWNERSHIP_SCRIPT, {
      keys: [lockKey, runningKey],
      arguments: [lockValue, executionId],
    });
    return result === 1;
  }

  async enqueueTask(task) {
    const taskData = JSON.stringify({
      ...task,
      queuedAt: new Date().toISOString(),
    });
    await this.client.lPush(this.taskQueueKey, taskData);
  }

  async dequeueTask(timeout = 0) {
    const result = await this.client.brPop(this.taskQueueKey, timeout);
    if (result) {
      return JSON.parse(result.element);
    }
    return null;
  }

  async publishTaskResult(result) {
    await this.client.publish(this.resultChannel, JSON.stringify(result));
  }

  async subscribeToTaskResults(callback) {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(this.resultChannel, (message) => {
      callback(JSON.parse(message));
    });
    return subscriber;
  }

  async getQueueLength() {
    return await this.client.lLen(this.taskQueueKey);
  }

  isConnected() {
    return this.client && this.client.isOpen;
  }
}

module.exports = new RedisService();
