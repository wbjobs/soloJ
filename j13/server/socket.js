const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const roomManager = require('./rooms');
const opLog = require('./services/operationLog');

let ioInstance;
const connectionPool = new Map();

function init(io, roomMgr) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    connectionPool.set(socket.id, {
      socket,
      sessionId: socket.id,
      roomId: null,
      user: null
    });

    socket.on('join-room', handleJoinRoom);
    socket.on('leave-room', handleLeaveRoom);
    socket.on('camera-update', handleCameraUpdate);
    socket.on('annotation-add', handleAnnotationAdd);
    socket.on('annotation-delete', handleAnnotationDelete);
    socket.on('annotation-resolve', handleAnnotationResolve);
    socket.on('lock-view', handleLockView);
    socket.on('unlock-view', handleUnlockView);
    socket.on('signal', handleSignal);
    socket.on('voice-memo', handleVoiceMemo);
    socket.on('request-peer-list', handleRequestPeerList);
    socket.on('model-transform', handleModelTransform);
    socket.on('disconnect', handleDisconnect);
  });
}

async function handleJoinRoom(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn) return;

  const { roomId, roomName, userName, role, color, modelUrl } = data;

  try {
    const room = await roomManager.getOrCreateRoom(
      roomId,
      roomName,
      this.id,
      modelUrl
    );

    const userResult = await db.query(
      'INSERT INTO users (session_id, room_id, name, role, color) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (session_id) DO UPDATE SET room_id = $2, name = $3, role = $4, color = $5, connected = true, last_active = NOW() RETURNING *',
      [this.id, room.id, userName || 'Anonymous', role || 'viewer', color || '#4CAF50']
    );

    const user = userResult.rows[0];
    conn.roomId = room.id;
    conn.user = user;

    room.addUser({
      sessionId: this.id,
      id: user.id,
      name: user.name,
      role: user.role,
      color: user.color
    });

    this.join(room.id);

    const usersInRoom = room.getUsers();

    const annotationsResult = await db.query(
      'SELECT a.*, u.name as user_name, u.color as user_color FROM annotations a LEFT JOIN users u ON a.user_id = u.id WHERE a.room_id = $1 ORDER BY a.created_at ASC',
      [room.id]
    );

    if (callback) {
      callback({
        success: true,
        room: {
          id: room.id,
          name: room.name,
          modelUrl: room.modelUrl,
          modelTransform: room.modelTransform,
          lockedView: room.lockedView
        },
        user: {
          id: user.id,
          sessionId: this.id,
          name: user.name,
          role: user.role,
          color: user.color
        },
        users: usersInRoom,
        annotations: annotationsResult.rows
      });
    }

    this.to(room.id).emit('user-joined', {
      user: {
        id: user.id,
        sessionId: this.id,
        name: user.name,
        role: user.role,
        color: user.color
      },
      users: usersInRoom
    });

    await opLog.recordOperation(
      'user_join',
      room.id,
      user.id,
      this.id,
      {
        user_id: user.id,
        session_id: this.id,
        name: user.name,
        color: user.color,
        role: user.role,
        joined_at: new Date().toISOString()
      }
    );
  } catch (err) {
    console.error('join-room error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

async function handleLeaveRoom(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  try {
    await db.query(
      'UPDATE users SET connected = false WHERE session_id = $1',
      [this.id]
    );

    const room = await roomManager.getRoom(conn.roomId);
    if (room) {
      room.removeUser(this.id);
      const remainingUsers = room.getUsers();

      if (remainingUsers.length === 0) {
        roomManager.removeRoom(conn.roomId);
      } else {
        ioInstance.to(conn.roomId).emit('user-left', {
          sessionId: this.id,
          users: remainingUsers
        });
      }
    }

    this.leave(conn.roomId);
    conn.roomId = null;
    conn.user = null;

    if (callback) callback({ success: true });
  } catch (err) {
    console.error('leave-room error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

function handleCameraUpdate(data) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  this.to(conn.roomId).emit('camera-update', {
    sessionId: this.id,
    camera: data.camera
  });

  if (data.recordOp !== false) {
    opLog.recordOperation(
      'camera_move',
      conn.roomId,
      conn.user ? conn.user.id : null,
      this.id,
      {
        camera: data.camera
      }
    ).catch(err => console.error('Failed to record camera_move:', err));
  }
}

async function handleAnnotationAdd(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  try {
    const result = await db.query(
      `INSERT INTO annotations (
        room_id, user_id,
        position_x, position_y, position_z,
        local_position_x, local_position_y, local_position_z,
        text_content, audio_url, audio_duration,
        camera_view, model_transform
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        conn.roomId,
        conn.user.id,
        data.position.x,
        data.position.y,
        data.position.z,
        data.localPosition ? data.localPosition.x : data.position.x,
        data.localPosition ? data.localPosition.y : data.position.y,
        data.localPosition ? data.localPosition.z : data.position.z,
        data.textContent || '',
        data.audioUrl || null,
        data.audioDuration || 0,
        data.cameraView || null,
        data.modelTransform || null
      ]
    );

    const annotation = result.rows[0];

    ioInstance.to(conn.roomId).emit('annotation-added', {
      annotation: {
        ...annotation,
        user_name: conn.user.name,
        user_color: conn.user.color
      }
    });

    await opLog.recordOperation(
      'annotation_add',
      conn.roomId,
      conn.user ? conn.user.id : null,
      this.id,
      {
        annotation_id: annotation.id,
        position: { x: annotation.position_x, y: annotation.position_y, z: annotation.position_z },
        local_position: { x: annotation.local_position_x, y: annotation.local_position_y, z: annotation.local_position_z },
        text_content: annotation.text_content,
        audio_url: annotation.audio_url,
        audio_duration: annotation.audio_duration,
        user_name: conn.user.name,
        user_color: conn.user.color,
        created_at: annotation.created_at
      }
    );

    if (callback) callback({ success: true, annotation });
  } catch (err) {
    console.error('annotation-add error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

async function handleAnnotationDelete(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  try {
    const result = await db.query(
      'DELETE FROM annotations WHERE id = $1 AND room_id = $2 RETURNING *',
      [data.annotationId, conn.roomId]
    );

    if (result.rows.length > 0) {
      ioInstance.to(conn.roomId).emit('annotation-deleted', {
        annotationId: data.annotationId
      });

      await opLog.recordOperation(
        'annotation_delete',
        conn.roomId,
        conn.user ? conn.user.id : null,
        this.id,
        {
          annotation_id: data.annotationId
        }
      );

      if (callback) callback({ success: true });
    }
  } catch (err) {
    console.error('annotation-delete error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

async function handleAnnotationResolve(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  try {
    const result = await db.query(
      'UPDATE annotations SET resolved = true, resolved_at = NOW() WHERE id = $1 AND room_id = $2 RETURNING *',
      [data.annotationId, conn.roomId]
    );

    if (result.rows.length > 0) {
      ioInstance.to(conn.roomId).emit('annotation-resolved', {
        annotationId: data.annotationId,
        annotation: result.rows[0]
      });

      await opLog.recordOperation(
        'annotation_resolve',
        conn.roomId,
        conn.user ? conn.user.id : null,
        this.id,
        {
          annotation_id: data.annotationId,
          resolved: true,
          resolved_at: result.rows[0].resolved_at
        }
      );

      if (callback) callback({ success: true, annotation: result.rows[0] });
    }
  } catch (err) {
    console.error('annotation-resolve error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

async function handleLockView(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  try {
    const room = await roomManager.getRoom(conn.roomId);
    if (room) {
      room.setLockedView(data.view);
      await roomManager.saveLockedView(conn.roomId, data.view);

      ioInstance.to(conn.roomId).emit('view-locked', {
        view: data.view,
        lockedBy: {
          sessionId: this.id,
          name: conn.user.name
        }
      });

      await opLog.recordOperation(
        'view_lock',
        conn.roomId,
        conn.user ? conn.user.id : null,
        this.id,
        {
          view: data.view,
          locked_by: conn.user.name
        }
      );

      if (callback) callback({ success: true });
    }
  } catch (err) {
    console.error('lock-view error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

async function handleUnlockView(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  try {
    const room = await roomManager.getRoom(conn.roomId);
    if (room) {
      room.clearLockedView();
      await roomManager.clearLockedView(conn.roomId);

      ioInstance.to(conn.roomId).emit('view-unlocked', {
        unlockedBy: {
          sessionId: this.id,
          name: conn.user.name
        }
      });

      await opLog.recordOperation(
        'view_unlock',
        conn.roomId,
        conn.user ? conn.user.id : null,
        this.id,
        {
          unlocked_by: conn.user.name
        }
      );

      if (callback) callback({ success: true });
    }
  } catch (err) {
    console.error('unlock-view error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

function handleSignal(data) {
  const { to, type, payload } = data;
  const targetConn = connectionPool.get(to);

  if (targetConn) {
    targetConn.socket.emit('signal', {
      from: this.id,
      type,
      payload
    });
  }
}

async function handleVoiceMemo(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  try {
    if (data.annotationId && data.audioUrl) {
      await db.query(
        'UPDATE annotations SET audio_url = $1, audio_duration = $2 WHERE id = $3 AND room_id = $4',
        [data.audioUrl, data.audioDuration || 0, data.annotationId, conn.roomId]
      );

      ioInstance.to(conn.roomId).emit('voice-memo-updated', {
        annotationId: data.annotationId,
        audioUrl: data.audioUrl,
        audioDuration: data.audioDuration || 0
      });

      await opLog.recordOperation(
        'voice_stop',
        conn.roomId,
        conn.user ? conn.user.id : null,
        this.id,
        {
          annotation_id: data.annotationId,
          audio_url: data.audioUrl,
          audio_duration: data.audioDuration || 0
        }
      );
    }

    if (callback) callback({ success: true });
  } catch (err) {
    console.error('voice-memo error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

async function handleRequestPeerList(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  const room = await roomManager.getRoom(conn.roomId);
  if (room) {
    const peers = room.getUsers().filter(u => u.sessionId !== this.id);
    if (callback) {
      callback({ peers });
    }
  }
}

async function handleDisconnect() {
  const conn = connectionPool.get(this.id);
  if (!conn) return;

  if (conn.roomId) {
    await db.query(
      'UPDATE users SET connected = false WHERE session_id = $1',
      [this.id]
    );

    const room = await roomManager.getRoom(conn.roomId);
    if (room) {
      room.removeUser(this.id);
      const remainingUsers = room.getUsers();

      if (remainingUsers.length === 0) {
        roomManager.removeRoom(conn.roomId);
      } else {
        ioInstance.to(conn.roomId).emit('user-left', {
          sessionId: this.id,
          users: remainingUsers
        });
      }
    }
  }

  connectionPool.delete(this.id);
  console.log(`Client disconnected: ${this.id}`);
}

function getConnection(sessionId) {
  return connectionPool.get(sessionId);
}

async function handleModelTransform(data, callback) {
  const conn = connectionPool.get(this.id);
  if (!conn || !conn.roomId) return;

  try {
    await roomManager.saveModelTransform(conn.roomId, data.transform);

    ioInstance.to(conn.roomId).emit('model-transform-updated', {
      transform: data.transform,
      updatedBy: {
        sessionId: this.id,
        name: conn.user.name
      }
    });

    await opLog.recordOperation(
      'model_transform',
      conn.roomId,
      conn.user ? conn.user.id : null,
      this.id,
      {
        transform: data.transform
      }
    );

    if (callback) callback({ success: true });
  } catch (err) {
    console.error('model-transform error:', err);
    if (callback) callback({ success: false, error: err.message });
  }
}

module.exports = { init, getConnection, connectionPool };
