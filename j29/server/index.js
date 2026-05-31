const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const influxDB = new InfluxDB({
  url: process.env.INFLUXDB_URL,
  token: process.env.INFLUXDB_TOKEN
});
const writeApi = influxDB.getWriteApi(process.env.INFLUXDB_ORG, process.env.INFLUXDB_BUCKET);
const queryApi = influxDB.getQueryApi(process.env.INFLUXDB_ORG);

const users = new Map();
const robots = new Map();
const controlOwners = new Map();
const commandSeen = new Map();
const SEEN_CLEANUP_INTERVAL = 5000;
const MAX_SEEN_AGE = 30000;

users.set(process.env.ADMIN_USERNAME, {
  password: bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10),
  role: 'admin'
});

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of commandSeen) {
    if (now - timestamp > MAX_SEEN_AGE) {
      commandSeen.delete(key);
    }
  }
}, SEEN_CLEANUP_INTERVAL);

function isDuplicateCommand(seq) {
  if (!seq) return false;
  if (commandSeen.has(seq)) {
    return true;
  }
  commandSeen.set(seq, Date.now());
  return false;
}

function logCommand(robotId, userId, command, type) {
  try {
    const point = new Point('robot_commands')
      .tag('robotId', robotId)
      .tag('userId', userId)
      .tag('type', type)
      .stringField('command', JSON.stringify(command))
      .timestamp(new Date());
    writeApi.writePoint(point);
    writeApi.flush();
  } catch (e) {
    console.error('Error writing to InfluxDB:', e);
  }
}

function authenticateToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.get(username);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({ token, username, role: user.role });
});

app.get('/api/robots', (req, res) => {
  const robotList = Array.from(robots.values()).map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    controller: controlOwners.get(r.id)
  }));
  res.json(robotList);
});

app.get('/api/logs/:robotId', async (req, res) => {
  const { robotId } = req.params;
  const fluxQuery = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "robot_commands" and r.robotId == "${robotId}")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 100)
  `;
  
  try {
    const records = await queryApi.collectRows(fluxQuery);
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token === 'robot-client') {
    socket.userType = 'robot';
    return next();
  }
  const user = authenticateToken(token);
  if (user) {
    socket.userType = 'user';
    socket.user = user;
    return next();
  }
  next(new Error('Authentication failed'));
});

io.on('connection', (socket) => {
  console.log('Connected:', socket.userType, socket.user?.username || socket.id);

  if (socket.userType === 'robot') {
    socket.on('robot_register', (data) => {
      const robotId = data.robotId || `robot_${socket.id}`;
      robots.set(robotId, {
        id: robotId,
        name: data.name || robotId,
        socketId: socket.id,
        status: 'online',
        pose: data.pose || { x: 0, y: 0, yaw: 0 },
        armAngles: data.armAngles || [0, 0, 0, 0, 0, 0]
      });
      socket.robotId = robotId;
      io.emit('robot_list_update', Array.from(robots.values()).map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
        controller: controlOwners.get(r.id)
      })));
      console.log('Robot registered:', robotId);
    });

    socket.on('robot_pose_update', (data) => {
      const robot = robots.get(socket.robotId);
      if (robot) {
        robot.pose = data.pose;
        robot.armAngles = data.armAngles;
        socket.to('controllers').emit('robot_pose', {
          robotId: socket.robotId,
          pose: data.pose,
          armAngles: data.armAngles
        });
      }
    });

    socket.on('webrtc_offer', (data) => {
      const controller = controlOwners.get(data.robotId);
      if (controller) {
        io.to(controller.socketId).emit('webrtc_offer', {
          robotId: data.robotId,
          offer: data.offer
        });
      }
    });

    socket.on('webrtc_answer', (data) => {
      io.to(data.controllerSocketId).emit('webrtc_answer', {
        robotId: socket.robotId,
        answer: data.answer
      });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      if (data.toController) {
        const controller = controlOwners.get(socket.robotId);
        if (controller) {
          io.to(controller.socketId).emit('webrtc_ice_candidate', {
            robotId: socket.robotId,
            candidate: data.candidate
          });
        }
      } else {
        const robot = robots.get(data.robotId);
        if (robot) {
          io.to(robot.socketId).emit('webrtc_ice_candidate', {
            candidate: data.candidate,
            controllerSocketId: socket.id
          });
        }
      }
    });

    socket.on('disconnect', () => {
      const robotId = socket.robotId;
      robots.delete(robotId);
      controlOwners.delete(robotId);
      io.emit('robot_list_update', Array.from(robots.values()).map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
        controller: controlOwners.get(r.id)
      })));
      console.log('Robot disconnected:', robotId);
    });
  }

  if (socket.userType === 'user') {
    socket.join('controllers');

    socket.on('request_control', (data) => {
      const { robotId } = data;
      const robot = robots.get(robotId);
      const currentController = controlOwners.get(robotId);

      if (!robot) {
        socket.emit('control_response', { success: false, error: 'Robot not found' });
        return;
      }

      if (socket.user.role === 'admin' || !currentController) {
        controlOwners.set(robotId, {
          userId: socket.user.username,
          socketId: socket.id
        });
        socket.emit('control_response', { success: true, robotId });
        io.to(robot.socketId).emit('controller_connected', {
          controllerSocketId: socket.id,
          userId: socket.user.username
        });
        io.emit('robot_list_update', Array.from(robots.values()).map(r => ({
          id: r.id,
          name: r.name,
          status: r.status,
          controller: controlOwners.get(r.id)
        })));
      } else {
        socket.emit('control_response', { 
          success: false, 
          error: 'Robot is already being controlled' 
        });
      }
    });

    socket.on('release_control', (data) => {
      const { robotId } = data;
      const controller = controlOwners.get(robotId);
      if (controller && controller.socketId === socket.id) {
        controlOwners.delete(robotId);
        const robot = robots.get(robotId);
        if (robot) {
          io.to(robot.socketId).emit('controller_disconnected');
        }
        io.emit('robot_list_update', Array.from(robots.values()).map(r => ({
          id: r.id,
          name: r.name,
          status: r.status,
          controller: controlOwners.get(r.id)
        })));
      }
    });

    socket.on('velocity_command', (data) => {
      if (isDuplicateCommand(data.seq)) {
        console.log('Duplicate velocity command dropped:', data.seq?.slice(-8));
        return;
      }
      const controller = controlOwners.get(data.robotId);
      if (controller && controller.socketId === socket.id) {
        const robot = robots.get(data.robotId);
        if (robot) {
          io.to(robot.socketId).emit('velocity_command', {
            linear: data.linear,
            angular: data.angular,
            seq: data.seq,
            timestamp: data.timestamp
          });
          logCommand(data.robotId, socket.user.username, data, 'velocity');
        }
      }
    });

    socket.on('arm_command', (data) => {
      if (isDuplicateCommand(data.seq)) {
        console.log('Duplicate arm command dropped:', data.seq?.slice(-8));
        return;
      }
      const controller = controlOwners.get(data.robotId);
      if (controller && controller.socketId === socket.id) {
        const robot = robots.get(data.robotId);
        if (robot) {
          io.to(robot.socketId).emit('arm_command', {
            position: data.position,
            gripper: data.gripper,
            seq: data.seq,
            timestamp: data.timestamp
          });
          logCommand(data.robotId, socket.user.username, data, 'arm');
        }
      }
    });

    socket.on('webrtc_offer', (data) => {
      const robot = robots.get(data.robotId);
      if (robot) {
        io.to(robot.socketId).emit('webrtc_offer', {
          offer: data.offer,
          controllerSocketId: socket.id
        });
      }
    });

    socket.on('webrtc_answer', (data) => {
      const robot = robots.get(data.robotId);
      if (robot) {
        io.to(robot.socketId).emit('webrtc_answer', {
          answer: data.answer
        });
      }
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const robot = robots.get(data.robotId);
      if (robot) {
        io.to(robot.socketId).emit('webrtc_ice_candidate', {
          candidate: data.candidate,
          controllerSocketId: socket.id
        });
      }
    });

    socket.on('disconnect', () => {
      controlOwners.forEach((controller, robotId) => {
        if (controller.socketId === socket.id) {
          controlOwners.delete(robotId);
          const robot = robots.get(robotId);
          if (robot) {
            io.to(robot.socketId).emit('controller_disconnected');
          }
        }
      });
      io.emit('robot_list_update', Array.from(robots.values()).map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
        controller: controlOwners.get(r.id)
      })));
    });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
