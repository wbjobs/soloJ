require('dotenv').config();
const express = require('express');
const cors = require('cors');
const taskRoutes = require('./routes/taskRoutes');
const redisService = require('./services/RedisService');
const schedulerService = require('./services/SchedulerService');
const taskStore = require('./models/TaskStore');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

app.use(cors());
app.use(express.json());

app.use('/api/tasks', taskRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function initializeSampleTasks() {
  const task1 = taskStore.createTask({
    name: '步骤1: 数据采集',
    cronExpression: '*/30 * * * * *',
    command: 'echo "Collecting data at $(date +%H:%M:%S)',
    timeout: 10,
  });

  const task2 = taskStore.createTask({
    name: '步骤2: 数据处理',
    cronExpression: '*/30 * * * * *',
    command: 'echo "Processing data at $(date +%H:%M:%S)"',
    timeout: 15,
  });

  const task3 = taskStore.createTask({
    name: '步骤3: 报表生成',
    cronExpression: '*/30 * * * * *',
    command: 'echo "Generating report at $(date +%H:%M:%S)"',
    timeout: 20,
    dependsOn: [task1.id, task2.id],
  });

  const task4 = taskStore.createTask({
    name: '步骤4: 邮件发送',
    cronExpression: '*/30 * * * * *',
    command: 'echo "Sending email at $(date +%H:%M:%S)"',
    timeout: 10,
    dependsOn: [task3.id],
  });

  schedulerService.scheduleTask(task1);
  schedulerService.scheduleTask(task2);
  schedulerService.scheduleTask(task3);
  schedulerService.scheduleTask(task4);
  
  console.log('Sample tasks with dependencies initialized');
  console.log('Task1 (数据采集) -> Task2 (数据处理) -> Task3 (报表生成) -> Task4 (邮件发送)');
}

async function startServer() {
  try {
    await redisService.connect(REDIS_URL);

    await redisService.subscribeToTaskResults((result) => {
      console.log(`Task result received: ${result.taskName} - ${result.status}`);
      
      taskStore.addExecutionLog({
        taskId: result.taskId,
        taskName: result.taskName,
        workerId: result.workerId,
        status: result.status,
        output: result.output,
        error: result.error,
        duration: result.duration,
      });

      taskStore.updateTaskLastExecution(result.taskId, result.status, result.executionId);
    });

    schedulerService.start();

    await initializeSampleTasks();

    app.listen(PORT, () => {
      console.log(`Cron Scheduler Backend running on port ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api/tasks`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  schedulerService.stop();
  await redisService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  schedulerService.stop();
  await redisService.disconnect();
  process.exit(0);
});

startServer();
