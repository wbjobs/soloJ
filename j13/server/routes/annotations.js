const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const { storageService } = require('../services/storage');

const upload = multer({
  storage: storageService.getMulterStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const result = await db.query(
      'SELECT a.*, u.name as user_name, u.color as user_color FROM annotations a LEFT JOIN users u ON a.user_id = u.id WHERE a.room_id = $1 ORDER BY a.created_at ASC',
      [roomId]
    );
    res.json({ annotations: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      roomId,
      userId,
      position,
      localPosition,
      textContent,
      audioUrl,
      audioDuration,
      cameraView,
      modelTransform
    } = req.body;

    const result = await db.query(
      `INSERT INTO annotations (
        room_id, user_id,
        position_x, position_y, position_z,
        local_position_x, local_position_y, local_position_z,
        text_content, audio_url, audio_duration,
        camera_view, model_transform
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        roomId,
        userId,
        position.x,
        position.y,
        position.z,
        localPosition ? localPosition.x : position.x,
        localPosition ? localPosition.y : position.y,
        localPosition ? localPosition.z : position.z,
        textContent || '',
        audioUrl || null,
        audioDuration || 0,
        cameraView || null,
        modelTransform || null
      ]
    );

    res.json({ annotation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE annotations SET resolved = true, resolved_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }
    res.json({ annotation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM annotations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const url = storageService.getFileUrl(req.file.filename, 'audio');
    res.json({
      url,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
