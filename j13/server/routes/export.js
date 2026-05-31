const express = require('express');
const router = express.Router();
const db = require('../db');
const { pdfService } = require('../services/pdf');

router.get('/room/:roomId/annotations', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { format } = req.query;

    const roomResult = await db.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const annotationsResult = await db.query(
      'SELECT a.*, u.name as user_name, u.color as user_color FROM annotations a LEFT JOIN users u ON a.user_id = u.id WHERE a.room_id = $1 ORDER BY a.created_at ASC',
      [roomId]
    );

    if (format === 'json') {
      return res.json({
        room: roomResult.rows[0],
        annotations: annotationsResult.rows
      });
    }

    const pdfBuffer = await pdfService.generateAnnotationReport(
      roomResult.rows[0],
      annotationsResult.rows
    );

    const filename = `annotations_${roomId}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/room/:roomId/annotations/json', async (req, res) => {
  try {
    const { roomId } = req.params;

    const roomResult = await db.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const annotationsResult = await db.query(
      'SELECT a.*, u.name as user_name, u.color as user_color FROM annotations a LEFT JOIN users u ON a.user_id = u.id WHERE a.room_id = $1 ORDER BY a.created_at ASC',
      [roomId]
    );

    res.json({
      room: {
        id: roomResult.rows[0].id,
        name: roomResult.rows[0].name,
        modelUrl: roomResult.rows[0].model_url
      },
      annotations: annotationsResult.rows.map(a => ({
        id: a.id,
        position: { x: a.position_x, y: a.position_y, z: a.position_z },
        textContent: a.text_content,
        audioUrl: a.audio_url,
        audioDuration: a.audio_duration,
        cameraView: a.camera_view,
        createdAt: a.created_at,
        resolved: a.resolved,
        resolvedAt: a.resolved_at,
        userName: a.user_name,
        userColor: a.user_color
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
