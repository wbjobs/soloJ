const express = require('express');
const classificationService = require('../services/classification');
const Annotation = require('../models/Annotation');

const router = express.Router();

router.get('/classes', (req, res) => {
  try {
    const classInfo = classificationService.getClassInfo();
    res.json(classInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/classify', async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.body || {};

    const result = await classificationService.classifyPointCloud(id, { force });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/classification/status', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await classificationService.getClassificationStatus(id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/classification/summary', async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await classificationService.getClassificationSummary(id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/annotations', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, points, color, createdBy } = req.body;

    if (!name || !category || !points || !Array.isArray(points)) {
      return res.status(400).json({ error: 'Missing required fields: name, category, points' });
    }

    const annotation = new Annotation({
      pointCloudId: id,
      name,
      description,
      category,
      points,
      color,
      createdBy: createdBy || 'anonymous',
    });

    await annotation.save();
    res.json(annotation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/annotations', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, includePoints = false } = req.query;

    let query = { pointCloudId: id };
    if (category) {
      query.category = category;
    }

    const select = includePoints ? '' : '-points';

    const annotations = await Annotation.find(query).select(select).sort({ createdAt: -1 });
    res.json(annotations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/annotations/:annotationId', async (req, res) => {
  try {
    const { annotationId } = req.params;

    const annotation = await Annotation.findById(annotationId);
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.json(annotation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/annotations/:annotationId', async (req, res) => {
  try {
    const { annotationId } = req.params;
    const update = {};

    if (req.body.name !== undefined) update.name = req.body.name;
    if (req.body.description !== undefined) update.description = req.body.description;
    if (req.body.category !== undefined) update.category = req.body.category;
    if (req.body.color !== undefined) update.color = req.body.color;
    if (req.body.points !== undefined) update.points = req.body.points;

    const annotation = await Annotation.findByIdAndUpdate(
      annotationId,
      update,
      { new: true }
    );

    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.json(annotation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/annotations/:annotationId', async (req, res) => {
  try {
    const { annotationId } = req.params;

    const annotation = await Annotation.findByIdAndDelete(annotationId);
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
