const TaskManager = require('./taskManager');
const GrpcServer = require('./grpcServer');
const HttpServer = require('./httpServer');

const taskManager = new TaskManager();
const grpcServer = new GrpcServer(taskManager, 50051);
const httpServer = new HttpServer(taskManager, 3000);

grpcServer.start();
httpServer.start();

setInterval(() => {
  const timedOut = taskManager.checkTimeouts();
  if (timedOut.length > 0) {
    console.log(`Reassigned ${timedOut.length} timed out blocks`);
    httpServer.broadcastUpdate();
  }
}, 5000);

console.log('Master server started');
console.log('gRPC: localhost:50051');
console.log('HTTP: localhost:3000');

process.on('SIGINT', () => {
  console.log('Shutting down...');
  grpcServer.stop();
  httpServer.stop();
  process.exit(0);
});
