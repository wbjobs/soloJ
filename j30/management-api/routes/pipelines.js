const express = require('express');
const fs = require('fs');
const path = require('path');

const config = require('../src/config');

const router = express.Router();

const pipelinesConfigPath = path.join(config.modelsDir, 'pipelines.json');

function loadPipelines() {
  try {
    if (fs.existsSync(pipelinesConfigPath)) {
      const data = fs.readFileSync(pipelinesConfigPath, 'utf8');
      const config = JSON.parse(data);
      return config.pipelines || [];
    }
  } catch (error) {
    console.error('Error loading pipelines:', error);
  }
  return [];
}

function savePipelines(pipelines) {
  try {
    const config = { pipelines };
    fs.writeFileSync(pipelinesConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving pipelines:', error);
    return false;
  }
}

router.get('/', (req, res) => {
  const pipelines = loadPipelines();
  res.json({
    success: true,
    count: pipelines.length,
    pipelines
  });
});

router.get('/:id', (req, res) => {
  const pipelines = loadPipelines();
  const pipeline = pipelines.find(p => p.id === req.params.id);
  
  if (!pipeline) {
    return res.status(404).json({
      success: false,
      error: 'Pipeline not found'
    });
  }
  
  res.json({
    success: true,
    pipeline
  });
});

router.post('/', (req, res) => {
  const { id, name, path_pattern, method, steps, step_order, enabled = true, priority = 0, description = '' } = req.body;
  
  if (!id || !path_pattern || !steps || !step_order) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: id, path_pattern, steps, step_order'
    });
  }
  
  const pipelines = loadPipelines();
  
  if (pipelines.find(p => p.id === id)) {
    return res.status(400).json({
      success: false,
      error: 'Pipeline with this id already exists'
    });
  }
  
  const newPipeline = {
    id,
    name: name || id,
    path_pattern,
    method: method || 'POST',
    steps,
    step_order,
    enabled,
    priority,
    description
  };
  
  pipelines.push(newPipeline);
  
  if (savePipelines(pipelines)) {
    res.json({
      success: true,
      message: 'Pipeline created successfully',
      pipeline: newPipeline
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to save pipeline'
    });
  }
});

router.put('/:id', (req, res) => {
  const pipelines = loadPipelines();
  const index = pipelines.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Pipeline not found'
    });
  }
  
  const { name, path_pattern, method, steps, step_order, enabled, priority, description } = req.body;
  
  if (name) pipelines[index].name = name;
  if (path_pattern) pipelines[index].path_pattern = path_pattern;
  if (method) pipelines[index].method = method;
  if (steps) pipelines[index].steps = steps;
  if (step_order) pipelines[index].step_order = step_order;
  if (typeof enabled !== 'undefined') pipelines[index].enabled = enabled;
  if (typeof priority !== 'undefined') pipelines[index].priority = priority;
  if (typeof description !== 'undefined') pipelines[index].description = description;
  
  if (savePipelines(pipelines)) {
    res.json({
      success: true,
      message: 'Pipeline updated successfully',
      pipeline: pipelines[index]
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to save pipeline'
    });
  }
});

router.delete('/:id', (req, res) => {
  let pipelines = loadPipelines();
  const initialLength = pipelines.length;
  
  pipelines = pipelines.filter(p => p.id !== req.params.id);
  
  if (pipelines.length === initialLength) {
    return res.status(404).json({
      success: false,
      error: 'Pipeline not found'
    });
  }
  
  if (savePipelines(pipelines)) {
    res.json({
      success: true,
      message: 'Pipeline deleted successfully'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to save pipelines'
    });
  }
});

router.post('/:id/enable', (req, res) => {
  const pipelines = loadPipelines();
  const pipeline = pipelines.find(p => p.id === req.params.id);
  
  if (!pipeline) {
    return res.status(404).json({
      success: false,
      error: 'Pipeline not found'
    });
  }
  
  pipeline.enabled = true;
  
  if (savePipelines(pipelines)) {
    res.json({
      success: true,
      message: 'Pipeline enabled'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to save pipelines'
    });
  }
});

router.post('/:id/disable', (req, res) => {
  const pipelines = loadPipelines();
  const pipeline = pipelines.find(p => p.id === req.params.id);
  
  if (!pipeline) {
    return res.status(404).json({
      success: false,
      error: 'Pipeline not found'
    });
  }
  
  pipeline.enabled = false;
  
  if (savePipelines(pipelines)) {
    res.json({
      success: true,
      message: 'Pipeline disabled'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to save pipelines'
    });
  }
});

module.exports = router;
