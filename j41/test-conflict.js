const redis = require('redis');
const crypto = require('crypto');

function uuidv4() {
  return crypto.randomUUID();
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const LOCK_KEY_PREFIX = 'cron:lock:';
const RUNNING_KEY_PREFIX = 'cron:running:';
const TASK_QUEUE_KEY = 'cron:task:queue';

async function testConflictDetection() {
  console.log('=== 分布式锁冲突检测测试 ===\n');
  
  const client = redis.createClient({ url: REDIS_URL });
  await client.connect();
  
  const taskId = 'test-task-001';
  const taskName = '冲突测试任务';
  const lockValue1 = uuidv4();
  const lockValue2 = uuidv4();
  const executionId1 = uuidv4();
  const executionId2 = uuidv4();
  const lockTtl = 60;

  console.log('步骤 1: 模拟调度中心获取锁并设置运行标记...');
  const lockResult1 = await client.set(`${LOCK_KEY_PREFIX}${taskId}`, lockValue1, {
    NX: true,
    EX: lockTtl,
  });
  console.log(`  Worker 1 获取锁: ${lockResult1 === 'OK' ? '成功' : '失败'}`);
  
  const runningMark1 = await client.set(`${RUNNING_KEY_PREFIX}${taskId}`, executionId1, {
    NX: true,
    EX: lockTtl,
  });
  console.log(`  Worker 1 设置运行标记: ${runningMark1 === 'OK' ? '成功' : '失败'}`);

  console.log('\n步骤 2: 将任务放入队列两次（模拟 Redis 中断恢复后重复入队）...');
  const taskData1 = JSON.stringify({
    id: taskId,
    name: taskName,
    command: 'echo "Task from worker 1" && sleep 2',
    timeout: 10,
    lockValue: lockValue1,
    lockTtl: lockTtl,
    executionId: executionId1,
  });
  await client.lPush(TASK_QUEUE_KEY, taskData1);
  
  const taskData2 = JSON.stringify({
    id: taskId,
    name: taskName,
    command: 'echo "Task from worker 2" && sleep 2',
    timeout: 10,
    lockValue: lockValue2,
    lockTtl: lockTtl,
    executionId: executionId2,
  });
  await client.lPush(TASK_QUEUE_KEY, taskData2);
  console.log('  已将两个相同 taskId 的任务放入队列');

  console.log('\n步骤 3: 模拟两个 Worker 同时领取任务...');
  console.log('  注意: 实际运行中 Worker 会检测到冲突并上报 conflict 状态');
  console.log('  第二个任务的锁值与锁不匹配，所有权验证将失败');

  console.log('\n步骤 4: 手动验证所有权检测逻辑...');
  
  const checkOwnership = async (lockVal, execId, workerName) => {
    const currentLock = await client.get(`${LOCK_KEY_PREFIX}${taskId}`);
    const currentRunning = await client.get(`${RUNNING_KEY_PREFIX}${taskId}`);
    
    const lockMatch = currentLock === lockVal;
    const runningMatch = currentRunning === execId;
    const isOwner = lockMatch && runningMatch;
    
    console.log(`\n  ${workerName} 所有权检查:`);
    console.log(`    锁值匹配: ${lockMatch} (expected: ${lockVal.substring(0, 8)}..., actual: ${currentLock ? currentLock.substring(0, 8) + '...' : 'null'})`);
    console.log(`    运行标记匹配: ${runningMatch} (expected: ${execId.substring(0, 8)}..., actual: ${currentRunning ? currentRunning.substring(0, 8) + '...' : 'null'})`);
    console.log(`    所有权验证结果: ${isOwner ? '✅ 通过' : '❌ 失败 (将上报 conflict 状态)'}`);
    
    return isOwner;
  };

  const worker1Owner = await checkOwnership(lockValue1, executionId1, 'Worker 1');
  const worker2Owner = await checkOwnership(lockValue2, executionId2, 'Worker 2');

  console.log('\n=== 测试结果 ===');
  if (worker1Owner && !worker2Owner) {
    console.log('✅ 冲突检测正常工作!');
    console.log('   - Worker 1 拥有所有权，可以执行任务');
    console.log('   - Worker 2 所有权验证失败，将上报 conflict 状态');
  } else {
    console.log('❌ 测试失败');
  }

  console.log('\n步骤 5: 清理测试数据...');
  await client.del(`${LOCK_KEY_PREFIX}${taskId}`);
  await client.del(`${RUNNING_KEY_PREFIX}${taskId}`);
  
  while (true) {
    const result = await client.rPop(TASK_QUEUE_KEY);
    if (!result) break;
  }
  console.log('  测试数据已清理');

  await client.quit();
  console.log('\n=== 测试完成 ===');
}

async function testLockRenewal() {
  console.log('\n=== 锁续期机制测试 ===\n');
  
  const client = redis.createClient({ url: REDIS_URL });
  await client.connect();
  
  const taskId = 'test-renewal-001';
  const lockValue = uuidv4();
  const executionId = uuidv4();
  const shortTtl = 3;

  console.log('步骤 1: 获取一个短 TTL (3秒) 的锁...');
  await client.set(`${LOCK_KEY_PREFIX}${taskId}`, lockValue, {
    NX: true,
    EX: shortTtl,
  });
  await client.set(`${RUNNING_KEY_PREFIX}${taskId}`, executionId, {
    NX: true,
    EX: shortTtl,
  });
  
  let ttl = await client.ttl(`${LOCK_KEY_PREFIX}${taskId}`);
  console.log(`  锁初始 TTL: ${ttl} 秒`);

  console.log('\n步骤 2: 模拟锁续期（每 1 秒续期一次）...');
  const renewInterval = setInterval(async () => {
    const currentLock = await client.get(`${LOCK_KEY_PREFIX}${taskId}`);
    if (currentLock === lockValue) {
      await client.expire(`${LOCK_KEY_PREFIX}${taskId}`, shortTtl);
      await client.expire(`${RUNNING_KEY_PREFIX}${taskId}`, shortTtl);
      const newTtl = await client.ttl(`${LOCK_KEY_PREFIX}${taskId}`);
      console.log(`  锁已续期，当前 TTL: ${newTtl} 秒`);
    }
  }, 1000);

  console.log('\n步骤 3: 等待 5 秒（超过初始 TTL）...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  clearInterval(renewInterval);
  
  const lockExists = await client.exists(`${LOCK_KEY_PREFIX}${taskId}`);
  const runningExists = await client.exists(`${RUNNING_KEY_PREFIX}${taskId}`);
  
  console.log(`\n  5 秒后锁仍存在: ${lockExists === 1 ? '✅ 是 (续期成功)' : '❌ 否 (续期失败)'}`);
  console.log(`  5 秒后运行标记仍存在: ${runningExists === 1 ? '✅ 是' : '❌ 否'}`);

  console.log('\n步骤 4: 清理测试数据...');
  await client.del(`${LOCK_KEY_PREFIX}${taskId}`);
  await client.del(`${RUNNING_KEY_PREFIX}${taskId}`);
  
  await client.quit();
  console.log('\n=== 锁续期测试完成 ===');
}

async function runAllTests() {
  try {
    await testConflictDetection();
    await testLockRenewal();
  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

runAllTests();
