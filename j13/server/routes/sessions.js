const express = require('express');
const router = express.Router();
const db = require('../db');
const opLog = require('../services/operationLog');

router.get('/room/:roomId/operations', async (req, res) => {
  try {
    const { roomId } = req.params;
    const fromSeq = parseInt(req.query.fromSeq) || 0;
    const toSeq = req.query.toSeq !== undefined ? parseInt(req.query.toSeq) : null;
    const branch = req.query.branch || 'main';
    const limit = parseInt(req.query.limit) || 500;

    const ops = await opLog.getOperations(roomId, fromSeq, toSeq, branch, limit);
    const currentSeq = await opLog.getCurrentSeq(roomId, branch);

    res.json({ operations: ops, currentSeq, branch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/room/:roomId/snapshots', async (req, res) => {
  try {
    const { roomId } = req.params;
    const branch = req.query.branch || 'main';

    const result = await db.query(
      'SELECT * FROM session_snapshots WHERE room_id = $1 AND branch = $2 ORDER BY up_to_seq ASC',
      [roomId, branch]
    );

    res.json({ snapshots: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/room/:roomId/snapshots/latest', async (req, res) => {
  try {
    const { roomId } = req.params;
    const upToSeq = parseInt(req.query.upToSeq) || Infinity;
    const branch = req.query.branch || 'main';

    const snapshot = await opLog.getLatestSnapshot(roomId, upToSeq, branch);

    if (!snapshot) {
      return res.json({ snapshot: null, state: opLog.createInitialState() });
    }

    res.json({ snapshot, state: snapshot.state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/room/:roomId/state', async (req, res) => {
  try {
    const { roomId } = req.params;
    const upToSeq = req.query.upToSeq !== undefined ? parseInt(req.query.upToSeq) : null;
    const branch = req.query.branch || 'main';

    let targetSeq = upToSeq;
    if (targetSeq === null) {
      targetSeq = await opLog.getCurrentSeq(roomId, branch);
    }

    const state = await opLog.computeState(roomId, targetSeq, branch);
    res.json({ state, seq: targetSeq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/room/:roomId/operations', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { opType, userId, userSessionId, payload, branch } = req.body;

    if (!opType) {
      return res.status(400).json({ error: 'opType is required' });
    }

    const operation = await opLog.recordOperation(
      opType,
      roomId,
      userId || null,
      userSessionId || null,
      payload || {},
      branch || 'main'
    );

    res.json({ operation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/room/:roomId/operations/batch', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { operations, branch } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'operations must be an array' });
    }

    const results = [];
    for (const op of operations) {
      const operation = await opLog.recordOperation(
        op.opType,
        roomId,
        op.userId || null,
        op.userSessionId || null,
        op.payload || {},
        branch || 'main'
      );
      results.push(operation);
    }

    res.json({ operations: results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/room/:roomId/fork', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { sourceSeq, sourceBranch, newRoomName, forkedByUserId } = req.body;

    const seq = sourceSeq !== undefined ? parseInt(sourceSeq) : await opLog.getCurrentSeq(roomId, sourceBranch || 'main');

    const result = await opLog.forkSession(
      roomId,
      seq,
      sourceBranch || 'main',
      newRoomName,
      forkedByUserId || null
    );

    res.json({
      forkedRoomId: result.forkedRoom.id,
      forkedRoom: result.forkedRoom,
      branch: result.branch,
      sourceOpId: result.sourceOpId,
      copiedCount: result.copiedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/room/:roomId/forks', async (req, res) => {
  try {
    const { roomId } = req.params;
    const forks = await opLog.getForks(roomId);
    res.json({ forks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/room/:roomId/fork-source', async (req, res) => {
  try {
    const { roomId } = req.params;
    const source = await opLog.getForkSource(roomId);
    if (!source) {
      return res.json({ source: null, isForked: false });
    }
    res.json({ source, isForked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/room/:roomId/branches', async (req, res) => {
  try {
    const { roomId } = req.params;
    const branches = await opLog.getBranches(roomId);
    res.json({ branches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/room/:roomId/snapshot', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { seq, branch } = req.body;
    const upToSeq = seq || await opLog.getCurrentSeq(roomId, branch || 'main');
    const state = await opLog.createSnapshot(roomId, upToSeq, branch || 'main');
    res.json({ success: true, seq: upToSeq, state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;