const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../../proto/renderfarm.proto');

class GrpcServer {
  constructor(taskManager, port = 50051) {
    this.taskManager = taskManager;
    this.port = port;
    this.server = null;
  }

  start() {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const renderfarm = protoDescriptor.renderfarm;

    this.server = new grpc.Server();
    this.server.addService(renderfarm.MasterService.service, {
      RegisterWorker: (call, callback) => {
        const { workerId, address, cores } = call.request;
        this.taskManager.registerWorker(workerId, address, cores);
        console.log(`Worker registered: ${workerId} at ${address}`);
        callback(null, { success: true, message: 'Worker registered successfully' });
      },

      Heartbeat: (call, callback) => {
        const { workerId, currentLoad, currentTaskId } = call.request;
        this.taskManager.heartbeat(workerId, currentLoad, currentTaskId);
        callback(null, { alive: true });
      },

      RequestTask: (call, callback) => {
        const { workerId } = call.request;
        const task = this.taskManager.getNextTask(workerId);
        
        if (task) {
          callback(null, {
            has_task: true,
            task: {
              task_id: task.taskId,
              block_id: task.blockId,
              start_x: task.startX,
              start_y: task.startY,
              end_x: task.endX,
              end_y: task.endY,
              scene: task.scene
            },
            message: 'Task assigned'
          });
        } else {
          callback(null, {
            has_task: false,
            message: 'No tasks available'
          });
        }
      },

      SubmitTaskResult: (call, callback) => {
        const { task_id, block_id, worker_id, pixels, render_time_ms, total_samples } = call.request;
        const result = this.taskManager.submitResult(
          task_id,
          block_id,
          worker_id,
          pixels,
          render_time_ms,
          total_samples
        );
        callback(null, { success: result.success, message: result.message || '' });
      }
    });

    this.server.bindAsync(
      `0.0.0.0:${this.port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          console.error('Failed to bind gRPC server:', err);
          return;
        }
        console.log(`gRPC server listening on port ${port}`);
        this.server.start();
      }
    );
  }

  stop() {
    if (this.server) {
      this.server.forceShutdown();
    }
  }
}

module.exports = GrpcServer;
