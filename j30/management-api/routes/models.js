const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const Joi = require('joi');

const config = require('../src/config');
const { validateModelConfig, reloadWasmModule } = require('../src/utils');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.ensureDirSync(config.modelsDir);
    cb(null, config.modelsDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxModelSize
  },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.tflite')) {
      cb(null, true);
    } else {
      cb(new Error('Only .tflite model files are allowed'));
    }
  }
});

const modelConfigSchema = Joi.object({
  name: Joi.string().required(),
  file: Joi.string().required(),
  type: Joi.string().valid('image_classification', 'emotion_detection', 'sentiment_analysis', 'custom').required(),
  input_width: Joi.number().integer().min(1).required(),
  input_height: Joi.number().integer().min(1).required(),
  input_channels: Joi.number().integer().min(1).max(4).required(),
  mean: Joi.number().required(),
  std: Joi.number().required(),
  use_gpu: Joi.boolean().default(false),
  num_threads: Joi.number().integer().min(1).default(4)
});

router.get('/', async (req, res, next) => {
  try {
    const modelsConfigPath = path.join(config.modelsDir, 'models.json');
    let models = [];
    
    if (await fs.pathExists(modelsConfigPath)) {
      const configData = await fs.readJson(modelsConfigPath);
      models = configData.models || [];
    }
    
    res.json({
      count: models.length,
      models: models
    });
  } catch (err) {
    next(err);
  }
});

router.post('/upload', upload.single('model'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No model file uploaded' });
    }
    
    const modelConfig = {
      name: req.body.name || path.basename(req.file.originalname, '.tflite'),
      file: req.file.originalname,
      type: req.body.type || 'image_classification',
      input_width: parseInt(req.body.input_width, 10) || 224,
      input_height: parseInt(req.body.input_height, 10) || 224,
      input_channels: parseInt(req.body.input_channels, 10) || 3,
      mean: parseFloat(req.body.mean) || 0.5,
      std: parseFloat(req.body.std) || 0.5,
      use_gpu: req.body.use_gpu === 'true',
      num_threads: parseInt(req.body.num_threads, 10) || 4
    };
    
    const { error, value } = modelConfigSchema.validate(modelConfig);
    if (error) {
      await fs.remove(path.join(config.modelsDir, req.file.originalname));
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const modelsConfigPath = path.join(config.modelsDir, 'models.json');
    let configData = { models: [] };
    
    if (await fs.pathExists(modelsConfigPath)) {
      configData = await fs.readJson(modelsConfigPath);
    }
    
    const existingIndex = configData.models.findIndex(m => m.name === value.name);
    if (existingIndex >= 0) {
      configData.models[existingIndex] = value;
    } else {
      configData.models.push(value);
    }
    
    await fs.writeJson(modelsConfigPath, configData, { spaces: 2 });
    
    res.json({
      message: 'Model uploaded and registered successfully',
      model: value
    });
  } catch (err) {
    next(err);
  }
});

router.post('/config', async (req, res, next) => {
  try {
    const { error, value } = modelConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const modelsConfigPath = path.join(config.modelsDir, 'models.json');
    let configData = { models: [] };
    
    if (await fs.pathExists(modelsConfigPath)) {
      configData = await fs.readJson(modelsConfigPath);
    }
    
    const existingIndex = configData.models.findIndex(m => m.name === value.name);
    if (existingIndex >= 0) {
      configData.models[existingIndex] = value;
    } else {
      configData.models.push(value);
    }
    
    await fs.writeJson(modelsConfigPath, configData, { spaces: 2 });
    
    res.json({
      message: 'Model configuration updated successfully',
      model: value
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:name', async (req, res, next) => {
  try {
    const modelName = req.params.name;
    const modelsConfigPath = path.join(config.modelsDir, 'models.json');
    
    if (!await fs.pathExists(modelsConfigPath)) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    let configData = await fs.readJson(modelsConfigPath);
    const modelIndex = configData.models.findIndex(m => m.name === modelName);
    
    if (modelIndex < 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    const modelFile = configData.models[modelIndex].file;
    configData.models.splice(modelIndex, 1);
    
    await fs.writeJson(modelsConfigPath, configData, { spaces: 2 });
    
    const modelPath = path.join(config.modelsDir, modelFile);
    if (await fs.pathExists(modelPath)) {
      await fs.remove(modelPath);
    }
    
    res.json({
      message: 'Model deleted successfully',
      deleted: modelName
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reload', async (req, res, next) => {
  try {
    const success = await reloadWasmModule();
    
    res.json({
      message: success ? 'Models reloaded successfully' : 'Reload initiated',
      success: success
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
