import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import Video from '../models/Video.js';
import Room from '../models/Room.js';
import Annotation from '../models/Annotation.js';
import AnnotationReply from '../models/AnnotationReply.js';
import { uploadVideo, getVideoUrl, deleteVideo } from '../services/videoService.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only MP4 files are allowed'));
    }
  },
});

router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const videoId = uuidv4();
    await uploadVideo(req.file, videoId);

    const video = await Video.create({
      id: videoId,
      name: req.file.originalname,
      size: req.file.size,
    });

    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostId = uuidv4();

    const room = await Room.create({
      id: roomId,
      hostId,
      videoId,
    });

    res.json({
      roomId: room.id,
      hostId,
      videoId: video.id,
      videoName: video.name,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload video' });
  }
});

router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const video = await Video.findByPk(room.videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoUrl = await getVideoUrl(video.id);

    const annotations = await Annotation.findAll({
      where: { roomId },
      order: [['timestamp', 'ASC']],
    });

    const annotationIds = annotations.map(a => a.id);
    const replies = await AnnotationReply.findAll({
      where: { annotationId: { [Op.in]: annotationIds } },
      order: [['createdAt', 'ASC']],
    });

    const repliesByAnnotation = {};
    replies.forEach(reply => {
      if (!repliesByAnnotation[reply.annotationId]) {
        repliesByAnnotation[reply.annotationId] = [];
      }
      repliesByAnnotation[reply.annotationId].push({
        id: reply.id,
        userId: reply.userId,
        userName: reply.userName,
        text: reply.text,
        createdAt: reply.createdAt,
      });
    });

    res.json({
      roomId: room.id,
      video: {
        id: video.id,
        name: video.name,
        url: videoUrl,
        duration: video.duration,
      },
      annotations: annotations.map(a => ({
        id: a.id,
        userId: a.userId,
        userName: a.userName,
        timestamp: a.timestamp,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        text: a.text,
        createdAt: a.createdAt,
        replies: repliesByAnnotation[a.id] || [],
      })),
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room info' });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.findAll({
      include: [{ model: Video, attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json(rooms.map(room => ({
      id: room.id,
      videoName: room.Video?.name || 'Unknown',
      createdAt: room.createdAt,
    })));
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

router.get('/room/:roomId/export', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findByPk(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const video = await Video.findByPk(room.videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const annotations = await Annotation.findAll({
      where: { roomId },
      order: [['timestamp', 'ASC']],
    });

    const annotationIds = annotations.map(a => a.id);
    const replies = await AnnotationReply.findAll({
      where: { annotationId: { [Op.in]: annotationIds } },
      order: [['createdAt', 'ASC']],
    });

    const repliesByAnnotation = {};
    replies.forEach(reply => {
      if (!repliesByAnnotation[reply.annotationId]) {
        repliesByAnnotation[reply.annotationId] = [];
      }
      repliesByAnnotation[reply.annotationId].push({
        id: reply.id,
        userId: reply.userId,
        userName: reply.userName,
        text: reply.text,
        createdAt: reply.createdAt,
      });
    });

    const exportData = {
      roomId: room.id,
      video: {
        id: video.id,
        name: video.name,
        duration: video.duration,
      },
      exportedAt: new Date().toISOString(),
      annotations: annotations.map(a => ({
        id: a.id,
        userName: a.userName,
        timestamp: a.timestamp,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        text: a.text,
        createdAt: a.createdAt,
        replies: repliesByAnnotation[a.id] || [],
      })),
    };

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export annotations' });
  }
});

export default router;
