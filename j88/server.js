const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 10000,
  pingInterval: 5000,
});

app.use(express.static(path.join(__dirname, 'public')));

const controllers = new Map();
const workers = new Map();

const CONTROLLER_ROOM = 'controllers';

io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id}`);

  socket.on('register-controller', () => {
    controllers.set(socket.id, { socket, workerIds: [], taskQueue: [] });
    socket.join(CONTROLLER_ROOM);
    console.log(`[主控端注册] ${socket.id}`);
    socket.emit('controller-registered', { controllerId: socket.id });
  });

  socket.on('register-worker', () => {
    workers.set(socket.id, { socket, controllerId: null, busy: false, lastHeartbeat: Date.now() });
    console.log(`[工作端注册] ${socket.id}`);
    socket.emit('worker-registered', { workerId: socket.id });
    io.to(CONTROLLER_ROOM).emit('worker-available', { workerId: socket.id });
  });

  socket.on('worker-heartbeat', () => {
    const worker = workers.get(socket.id);
    if (worker) {
      worker.lastHeartbeat = Date.now();
    }
  });

  socket.on('assign-task', ({ workerId, task }) => {
    const worker = workers.get(workerId);
    if (worker && !worker.busy) {
      worker.busy = true;
      worker.controllerId = socket.id;
      worker.currentTask = task;
      worker.taskAssignedAt = Date.now();
      const ctrl = controllers.get(socket.id);
      if (ctrl && !ctrl.workerIds.includes(workerId)) {
        ctrl.workerIds.push(workerId);
      }
      worker.socket.emit('execute-task', task);
      console.log(`[任务分配] 主控 ${socket.id} -> 工作端 ${workerId}, 范围: ${task.rangeStart}-${task.rangeEnd}`);
    } else {
      socket.emit('task-error', { workerId, error: '工作端不可用' });
    }
  });

  socket.on('webrtc-offer', ({ targetId, offer }) => {
    io.to(targetId).emit('webrtc-offer', { fromId: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ targetId, answer }) => {
    io.to(targetId).emit('webrtc-answer', { fromId: socket.id, answer });
  });

  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc-ice-candidate', { fromId: socket.id, candidate });
  });

  socket.on('task-completed', ({ controllerId, result }) => {
    const ctrl = controllers.get(controllerId);
    if (ctrl) {
      ctrl.socket.emit('task-result', result);
    }
    const worker = workers.get(socket.id);
    if (worker) {
      worker.busy = false;
      worker.currentTask = null;
      worker.taskAssignedAt = null;
    }
  });

  socket.on('task-progress', ({ controllerId, progress }) => {
    const ctrl = controllers.get(controllerId);
    if (ctrl) {
      ctrl.socket.emit('worker-progress', { workerId: socket.id, ...progress });
    }
    const worker = workers.get(socket.id);
    if (worker) {
      worker.lastHeartbeat = Date.now();
    }
  });

  socket.on('request-workers', () => {
    const availableWorkers = [];
    for (const [wid, w] of workers) {
      if (!w.busy) {
        availableWorkers.push(wid);
      }
    }
    socket.emit('available-workers', { workers: availableWorkers });
  });

  socket.on('disconnect', () => {
    console.log(`[断开] ${socket.id}`);

    if (controllers.has(socket.id)) {
      const ctrl = controllers.get(socket.id);
      socket.leave(CONTROLLER_ROOM);
      for (const wid of ctrl.workerIds) {
        const w = workers.get(wid);
        if (w) {
          w.busy = false;
          w.controllerId = null;
          w.currentTask = null;
          w.socket.emit('controller-disconnected');
        }
      }
      controllers.delete(socket.id);
    }

    if (workers.has(socket.id)) {
      const worker = workers.get(socket.id);
      if (worker.controllerId) {
        const ctrl = controllers.get(worker.controllerId);
        if (ctrl) {
          ctrl.workerIds = ctrl.workerIds.filter(id => id !== socket.id);
          ctrl.socket.emit('worker-disconnected', {
            workerId: socket.id,
            lostTask: worker.currentTask
          });
        }
      }
      workers.delete(socket.id);
    }
  });
});

const HEARTBEAT_TIMEOUT = 15000;
const TASK_TIMEOUT = 60000;

setInterval(() => {
  const now = Date.now();
  for (const [wid, worker] of workers) {
    if (now - worker.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.log(`[心跳超时] 工作端 ${wid} 疑似掉线`);
      worker.socket.disconnect(true);
    }
    if (worker.busy && worker.taskAssignedAt && now - worker.taskAssignedAt > TASK_TIMEOUT) {
      console.log(`[任务超时] 工作端 ${wid} 的任务执行时间过长`);
      if (worker.controllerId) {
        const ctrl = controllers.get(worker.controllerId);
        if (ctrl) {
          ctrl.socket.emit('worker-timeout', {
            workerId: wid,
            lostTask: worker.currentTask
          });
        }
      }
      worker.taskAssignedAt = now;
    }
  }
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
