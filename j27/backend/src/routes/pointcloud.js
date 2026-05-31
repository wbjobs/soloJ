const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const processor = require('../processing/PointCloudProcessor');

const router = express.Router();

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pointcloud-uploads-'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.las' || ext === '.laz') {
      cb(null, true);
    } else {
      cb(new Error('Only LAS/LAZ files are allowed'));
    }
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name } = req.body;
    const filePath = req.file.path;
    const jobId = uuidv4();

    res.json({
      message: 'File accepted, processing started',
      jobId,
    });

    processor.processLASFile(filePath, { name: name || req.file.originalname })
      .then((result) => {
        fs.unlink(filePath, () => {});
        processor.emit('job-complete', { jobId, result });
        console.log(`Processing complete for ${result.pointCloudId}`);
      })
      .catch((error) => {
        fs.unlink(filePath, () => {});
        processor.emit('job-error', { jobId, error: error.message });
        console.error('Processing error:', error);
      });

  } catch (error) {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;

    const pointClouds = await processor.listPointClouds({ skip, limit, status });

    res.json(pointClouds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pointCloud = await processor.getPointCloudInfo(req.params.id);
    res.json(pointCloud);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await processor.deletePointCloud(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/chunks/query', async (req, res) => {
  try {
    const { id } = req.params;
    const { cameraPosition, viewFrustum, minLOD, maxLOD } = req.body;

    if (!cameraPosition) {
      return res.status(400).json({ error: 'cameraPosition is required' });
    }

    const chunks = await processor.getChunksForCamera(id, cameraPosition, viewFrustum, {
      minLOD, maxLOD });

    res.json(chunks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/chunks/:lodLevel/:octreeKey', async (req, res) => {
  try {
    const { id, lodLevel, octreeKey } = req.params;

    const { chunk, buffer } = await processor.getChunkDataByKey(id, parseInt(lodLevel), octreeKey);

    res.set('Content-Type', 'application/octet-stream');
    res.set('X-Chunk-Data', JSON.stringify({
      pointCount: chunk.pointCount,
      hasRGB: chunk.hasRGB,
      hasIntensity: chunk.hasIntensity,
      bounds: JSON.stringify(chunk.bounds),
    }));

    res.send(buffer);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/chunk/:chunkId', async (req, res) => {
  try {
    const { chunkId } = req.params;

    const { chunk, buffer } = await processor.getChunkData(chunkId);

    res.set('Content-Type', 'application/octet-stream');
    res.set('X-Chunk-Data', JSON.stringify({
      pointCount: chunk.pointCount,
      hasRGB: chunk.hasRGB,
      hasIntensity: chunk.hasIntensity,
      bounds: JSON.stringify(chunk.bounds),
    }));

    res.send(buffer);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

module.exports = router;
