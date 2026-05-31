const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const activeRooms = new Map();

class Room {
  constructor(id, name, hostId, modelUrl, modelTransform = null) {
    this.id = id;
    this.name = name;
    this.hostId = hostId;
    this.modelUrl = modelUrl;
    this.modelTransform = modelTransform;
    this.users = new Map();
    this.lockedView = null;
    this.annotations = [];
    this.createdAt = new Date();
  }

  addUser(user) {
    this.users.set(user.sessionId, user);
  }

  removeUser(sessionId) {
    this.users.delete(sessionId);
  }

  getUser(sessionId) {
    return this.users.get(sessionId);
  }

  getUsers() {
    return Array.from(this.users.values());
  }

  setLockedView(view) {
    this.lockedView = view;
  }

  clearLockedView() {
    this.lockedView = null;
  }

  setModelTransform(transform) {
    this.modelTransform = transform;
  }

  addAnnotation(annotation) {
    this.annotations.push(annotation);
  }
}

async function createRoom(name, hostId, modelUrl) {
  const id = uuidv4();
  const result = await db.query(
    'INSERT INTO rooms (id, name, host_id, model_url) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, name, hostId, modelUrl]
  );

  const room = new Room(id, name, hostId, modelUrl);
  activeRooms.set(id, room);
  return result.rows[0];
}

async function getRoom(roomId) {
  if (activeRooms.has(roomId)) {
    return activeRooms.get(roomId);
  }

  const result = await db.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
  if (result.rows.length > 0) {
    const row = result.rows[0];
    const room = new Room(row.id, row.name, row.host_id, row.model_url, row.model_transform);
    room.lockedView = row.locked_view;
    activeRooms.set(roomId, room);
    return room;
  }
  return null;
}

async function getOrCreateRoom(roomId, name, hostId, modelUrl) {
  let room = await getRoom(roomId);
  if (!room) {
    room = await createRoom(name || 'Untitled Room', hostId, modelUrl);
  }
  return room;
}

function removeRoom(roomId) {
  activeRooms.delete(roomId);
}

async function listRooms() {
  const result = await db.query(
    'SELECT r.*, COUNT(u.id) as user_count FROM rooms r LEFT JOIN users u ON u.room_id = r.id AND u.connected = true GROUP BY r.id ORDER BY r.created_at DESC'
  );
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    hostId: row.host_id,
    modelUrl: row.model_url,
    userCount: parseInt(row.user_count),
    createdAt: row.created_at
  }));
}

async function saveLockedView(roomId, view) {
  await db.query(
    'UPDATE rooms SET locked_view = $1, updated_at = NOW() WHERE id = $2',
    [view, roomId]
  );
}

async function clearLockedView(roomId) {
  await db.query(
    'UPDATE rooms SET locked_view = NULL, updated_at = NOW() WHERE id = $1',
    [roomId]
  );
}

async function saveModelTransform(roomId, transform) {
  await db.query(
    'UPDATE rooms SET model_transform = $1, updated_at = NOW() WHERE id = $2',
    [transform, roomId]
  );

  const room = activeRooms.get(roomId);
  if (room) {
    room.setModelTransform(transform);
  }
}

module.exports = {
  Room,
  createRoom,
  getRoom,
  getOrCreateRoom,
  removeRoom,
  listRooms,
  saveLockedView,
  clearLockedView,
  saveModelTransform,
  activeRooms
};
