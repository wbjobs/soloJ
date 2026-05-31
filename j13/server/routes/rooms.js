const express = require('express');
const router = express.Router();
const roomManager = require('../rooms');
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const rooms = await roomManager.listRooms();
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, hostId, modelUrl } = req.body;
    const room = await roomManager.createRoom(
      name || 'Untitled Room',
      hostId || null,
      modelUrl || null
    );
    res.json({ room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM rooms WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ room: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE room_id = $1 AND connected = true ORDER BY joined_at ASC',
      [req.params.id]
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
