const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const os = require('os');
const { renderBlock } = require('../raytracer/raytracer');
const { generateWorkerId } = require('../common/utils');

const PROTO_PATH = path.join(__dirname, '../../proto/renderfarm.proto');
const MASTER_ADDRESS = process.env.MASTER_ADDRESS || 'localhost:50051';
const HEARTBEAT_INTERVAL = 5000;
const TASK_POLL_INTERVAL = 1000;

class Worker {
  constructor(workerId = null) {
    this.workerId = workerId || generateWorkerId();
    this.address = `${os.hostname()}:${process.env.PORT || 0}`;
    this.cores = os.cpus().length;
    this.currentTask = null;
    this.currentLoad = 0;
    this.running = true;
    this.client = null;
  }

  connect() {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const renderfarm = protoDescriptor.renderfarm;

    this.client = new renderfarm.MasterService(
      MASTER_ADDRESS,
      grpc.credentials.createInsecure()
    );

    console.log(`Worker ${this.workerId} connecting to master at ${MASTER_ADDRESS}`);
  }

  register() {
    return new Promise((resolve, reject) => {
      this.client.RegisterWorker(
        {
          workerId: this.workerId,
          address: this.address,
          cores: this.cores
        },
        (err, response) => {
          if (err) {
            console.error('Failed to register:', err);
            reject(err);
          } else {
            console.log('Registered with master:', response.message);
            resolve();
          }
        }
      );
    });
  }

  startHeartbeat() {
    setInterval(() => {
      if (!this.running) return;

      this.client.Heartbeat(
        {
          workerId: this.workerId,
          currentLoad: this.currentLoad,
          currentTaskId: this.currentTask?.taskId || ''
        },
        (err) => {
          if (err) {
            console.error('Heartbeat failed:', err.message);
          }
        }
      );
    }, HEARTBEAT_INTERVAL);
  }

  async requestTask() {
    return new Promise((resolve, reject) => {
      this.client.RequestTask(
        { workerId: this.workerId },
        (err, response) => {
          if (err) {
            reject(err);
          } else if (response.hasTask) {
            resolve(response.task);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  submitResult(taskId, blockId, pixels, renderTimeMs, totalSamples) {
    return new Promise((resolve, reject) => {
      this.client.SubmitTaskResult(
        {
          taskId,
          blockId,
          workerId: this.workerId,
          pixels,
          renderTimeMs,
          totalSamples
        },
        (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async renderTask(task) {
    this.currentTask = task;
    this.currentLoad = 1;

    console.log(`Rendering block ${task.blockId} for task ${task.taskId}`);
    console.log(`Block: (${task.startX},${task.startY}) to (${task.endX},${task.endY})`);

    const block = {
      startX: task.startX,
      startY: task.startY,
      endX: task.endX,
      endY: task.endY
    };

    try {
      const { pixels, renderTimeMs, totalSamples } = renderBlock(block, task.scene);
      
      console.log(`Block ${task.blockId} completed in ${renderTimeMs}ms, ${totalSamples} samples`);

      await this.submitResult(task.taskId, task.blockId, pixels, renderTimeMs, totalSamples);
      console.log(`Result submitted for block ${task.blockId}`);
    } catch (err) {
      console.error(`Error rendering block ${task.blockId}:`, err);
    } finally {
      this.currentTask = null;
      this.currentLoad = 0;
    }
  }

  async start() {
    this.connect();
    
    try {
      await this.register();
    } catch (err) {
      console.error('Failed to register with master, exiting');
      process.exit(1);
    }

    this.startHeartbeat();
    console.log(`Worker ${this.workerId} started, waiting for tasks...`);

    while (this.running) {
      try {
        const task = await this.requestTask();
        
        if (task) {
          await this.renderTask(task);
        } else {
          await new Promise(resolve => setTimeout(resolve, TASK_POLL_INTERVAL));
        }
      } catch (err) {
        console.error('Error in task loop:', err);
        await new Promise(resolve => setTimeout(resolve, TASK_POLL_INTERVAL * 2));
      }
    }
  }

  stop() {
    this.running = false;
    console.log('Worker stopping...');
  }
}

const workerId = process.argv[2] || null;
const worker = new Worker(workerId);

process.on('SIGINT', () => {
  worker.stop();
  process.exit(0);
});

worker.start().catch(err => {
  console.error('Worker failed:', err);
  process.exit(1);
});
