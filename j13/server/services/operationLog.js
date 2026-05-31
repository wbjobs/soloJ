const db = require('../db');

const SNAPSHOT_INTERVAL = 50;

async function getCurrentSeq(roomId, branch = 'main') {
  const result = await db.query(
    'SELECT COALESCE(MAX(seq), 0) as max_seq FROM operation_logs WHERE room_id = $1 AND parent_branch = $2',
    [roomId, branch]
  );
  return parseInt(result.rows[0].max_seq) || 0;
}

async function recordOperation(opType, roomId, userId, userSessionId, payload, branch = 'main') {
  const seq = (await getCurrentSeq(roomId, branch)) + 1;
  const result = await db.query(
    `INSERT INTO operation_logs (room_id, op_type, user_id, user_session_id, seq, payload, parent_branch)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [roomId, opType, userId, userSessionId, seq, payload, branch]
  );

  if (seq % SNAPSHOT_INTERVAL === 0) {
    createSnapshot(roomId, seq, branch);
  }

  return result.rows[0];
}

async function getOperations(roomId, fromSeq = 0, toSeq = null, branch = 'main', limit = 500) {
  let query = 'SELECT * FROM operation_logs WHERE room_id = $1 AND parent_branch = $2 AND seq >= $3';
  const params = [roomId, branch, fromSeq];

  if (toSeq !== null) {
    query += ' AND seq <= $4';
    params.push(toSeq);
  }

  query += ' ORDER BY seq ASC LIMIT $' + (params.length + 1);
  params.push(limit);

  const result = await db.query(query, params);
  return result.rows;
}

async function getOperationById(opId) {
  const result = await db.query('SELECT * FROM operation_logs WHERE id = $1', [opId]);
  return result.rows[0] || null;
}

async function createSnapshot(roomId, upToSeq, branch = 'main') {
  const existing = await db.query(
    'SELECT id FROM session_snapshots WHERE room_id = $1 AND up_to_seq = $2 AND branch = $3',
    [roomId, upToSeq, branch]
  );
  if (existing.rows.length > 0) return;

  const state = await computeState(roomId, upToSeq, branch);

  await db.query(
    'INSERT INTO session_snapshots (room_id, up_to_seq, state, branch) VALUES ($1, $2, $3, $4)',
    [roomId, upToSeq, state, branch]
  );

  return state;
}

async function getLatestSnapshot(roomId, upToSeq, branch = 'main') {
  const result = await db.query(
    'SELECT * FROM session_snapshots WHERE room_id = $1 AND up_to_seq <= $2 AND branch = $3 ORDER BY up_to_seq DESC LIMIT 1',
    [roomId, upToSeq, branch]
  );
  return result.rows[0] || null;
}

async function computeState(roomId, upToSeq, branch = 'main') {
  const snapshot = await getLatestSnapshot(roomId, upToSeq, branch);

  let state;
  let startSeq;

  if (snapshot) {
    state = snapshot.state;
    startSeq = snapshot.up_to_seq + 1;
  } else {
    state = createInitialState();
    startSeq = 1;
  }

  if (startSeq <= upToSeq) {
    const ops = await getOperations(roomId, startSeq, upToSeq, branch, 10000);
    for (const op of ops) {
      applyOperation(state, op);
    }
  }

  return state;
}

function createInitialState() {
  return {
    camera: null,
    annotations: [],
    modelTransform: null,
    lockedView: null,
    users: [],
    seq: 0
  };
}

function applyOperation(state, op) {
  state.seq = op.seq;

  switch (op.op_type) {
    case 'camera_move':
      state.camera = op.payload.camera;
      break;

    case 'annotation_add': {
      const existing = state.annotations.find(a => a.id === op.payload.annotation_id);
      if (!existing) {
        state.annotations.push({
          id: op.payload.annotation_id,
          ...op.payload
        });
      }
      break;
    }

    case 'annotation_delete': {
      state.annotations = state.annotations.filter(a => a.id !== op.payload.annotation_id);
      break;
    }

    case 'annotation_resolve': {
      const ann = state.annotations.find(a => a.id === op.payload.annotation_id);
      if (ann) {
        ann.resolved = op.payload.resolved;
        ann.resolved_at = op.payload.resolved_at || null;
      }
      break;
    }

    case 'voice_start':
      break;

    case 'voice_stop': {
      const ann = state.annotations.find(a => a.id === op.payload.annotation_id);
      if (ann) {
        ann.audio_url = op.payload.audio_url;
        ann.audio_duration = op.payload.audio_duration;
      }
      break;
    }

    case 'model_transform':
      state.modelTransform = op.payload.transform;
      break;

    case 'view_lock':
      state.lockedView = {
        view: op.payload.view,
        lockedBy: op.payload.locked_by
      };
      break;

    case 'view_unlock':
      state.lockedView = null;
      break;

    case 'user_join': {
      const existing = state.users.find(u => u.id === op.payload.user_id);
      if (!existing) {
        state.users.push({
          id: op.payload.user_id,
          session_id: op.payload.session_id,
          name: op.payload.name,
          color: op.payload.color,
          role: op.payload.role,
          joined_at: op.payload.joined_at
        });
      }
      break;
    }

    case 'user_leave':
      state.users = state.users.filter(u => u.id !== op.payload.user_id);
      break;
  }
}

async function forkSession(sourceRoomId, sourceSeq, sourceBranch, newRoomName, forkedByUserId) {
  const newRoomId = require('uuid').v4();

  const roomResult = await db.query(
    'INSERT INTO rooms (id, name) VALUES ($1, $2) RETURNING *',
    [newRoomId, newRoomName || 'Forked Session']
  );
  const newRoom = roomResult.rows[0];

  const sourceOpResult = await db.query(
    'SELECT id FROM operation_logs WHERE room_id = $1 AND seq = $2 AND parent_branch = $3',
    [sourceRoomId, sourceSeq, sourceBranch]
  );
  const sourceOpId = sourceOpResult.rows[0] ? sourceOpResult.rows[0].id : null;

  await db.query(
    `INSERT INTO session_forks (source_room_id, forked_room_id, source_op_id, source_seq, source_branch, forked_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sourceRoomId, newRoomId, sourceOpId, sourceSeq, sourceBranch, forkedByUserId]
  );

  const newBranch = `fork_${newRoomId.substring(0, 8)}`;

  const opsToCopy = await getOperations(sourceRoomId, 1, sourceSeq, sourceBranch, 100000);

  for (const op of opsToCopy) {
    await db.query(
      `INSERT INTO operation_logs (room_id, op_type, user_id, user_session_id, seq, payload, parent_branch, branch_root, is_branch)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      [newRoomId, op.op_type, op.user_id, op.user_session_id, op.seq, op.payload, newBranch, sourceOpId]
    );
  }

  await createSnapshot(newRoomId, sourceSeq, newBranch);

  return {
    forkedRoom: newRoom,
    branch: newBranch,
    sourceOpId,
    copiedCount: opsToCopy.length
  };
}

async function getForks(roomId) {
  const result = await db.query(
    `SELECT f.*, r.name as forked_room_name, u.name as forked_by_name
     FROM session_forks f
     LEFT JOIN rooms r ON f.forked_room_id = r.id
     LEFT JOIN users u ON f.forked_by = u.id
     WHERE f.source_room_id = $1
     ORDER BY f.created_at DESC`,
    [roomId]
  );
  return result.rows;
}

async function getForkSource(forkedRoomId) {
  const result = await db.query(
    `SELECT f.*, r.name as source_room_name
     FROM session_forks f
     LEFT JOIN rooms r ON f.source_room_id = r.id
     WHERE f.forked_room_id = $1`,
    [forkedRoomId]
  );
  return result.rows[0] || null;
}

async function getBranches(roomId) {
  const result = await db.query(
    'SELECT DISTINCT parent_branch as branch, MIN(seq) as start_seq, MAX(seq) as end_seq FROM operation_logs WHERE room_id = $1 GROUP BY parent_branch',
    [roomId]
  );
  return result.rows;
}

module.exports = {
  recordOperation,
  getOperations,
  getOperationById,
  getCurrentSeq,
  createSnapshot,
  getLatestSnapshot,
  computeState,
  applyOperation,
  createInitialState,
  forkSession,
  getForks,
  getForkSource,
  getBranches,
  SNAPSHOT_INTERVAL
};