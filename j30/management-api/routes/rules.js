const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const Joi = require('joi');

const config = require('../src/config');

const router = express.Router();

const ruleSchema = Joi.object({
  id: Joi.string().required(),
  path_pattern: Joi.string().required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH', '*').default('*'),
  model_name: Joi.string().required(),
  input_source: Joi.string().valid('body', 'body_base64', 'headers').default('body'),
  output_mode: Joi.string().valid('header', 'body').default('header'),
  header_name: Joi.string().default('X-Inference-Result'),
  enabled: Joi.boolean().default(true),
  priority: Joi.number().integer().default(0)
});

const getRulesConfig = async () => {
  const rulesPath = path.join(config.configDir, 'routes.json');
  if (await fs.pathExists(rulesPath)) {
    return await fs.readJson(rulesPath);
  }
  return { rules: [] };
};

const saveRulesConfig = async (data) => {
  const rulesPath = path.join(config.configDir, 'routes.json');
  await fs.ensureDir(path.dirname(rulesPath));
  await fs.writeJson(rulesPath, data, { spaces: 2 });
};

router.get('/', async (req, res, next) => {
  try {
    const configData = await getRulesConfig();
    res.json({
      count: configData.rules.length,
      rules: configData.rules
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = ruleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const configData = await getRulesConfig();
    
    const existingIndex = configData.rules.findIndex(r => r.id === value.id);
    if (existingIndex >= 0) {
      return res.status(409).json({ error: 'Rule with this ID already exists' });
    }
    
    configData.rules.push(value);
    await saveRulesConfig(configData);
    
    res.status(201).json({
      message: 'Rule created successfully',
      rule: value
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const ruleId = req.params.id;
    const { error, value } = ruleSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    if (value.id !== ruleId) {
      return res.status(400).json({ error: 'ID in path and body must match' });
    }
    
    const configData = await getRulesConfig();
    const existingIndex = configData.rules.findIndex(r => r.id === ruleId);
    
    if (existingIndex < 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    configData.rules[existingIndex] = value;
    await saveRulesConfig(configData);
    
    res.json({
      message: 'Rule updated successfully',
      rule: value
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ruleId = req.params.id;
    const configData = await getRulesConfig();
    
    const existingIndex = configData.rules.findIndex(r => r.id === ruleId);
    if (existingIndex < 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    configData.rules.splice(existingIndex, 1);
    await saveRulesConfig(configData);
    
    res.json({
      message: 'Rule deleted successfully',
      deleted: ruleId
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ruleId = req.params.id;
    const configData = await getRulesConfig();
    
    const rule = configData.rules.find(r => r.id === ruleId);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

router.post('/validate', async (req, res, next) => {
  try {
    const { path: reqPath, method } = req.body;
    
    if (!reqPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const configData = await getRulesConfig();
    
    const matchingRules = configData.rules.filter(rule => {
      if (!rule.enabled) return false;
      if (method && rule.method !== '*' && rule.method !== method) return false;
      
      const pattern = rule.path_pattern;
      if (pattern === reqPath) return true;
      if (pattern === '/*' || pattern === '/**') return true;
      
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\/\*/g, '/[^/]*')
        .replace(/\./g, '\\.');
      
      try {
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(reqPath);
      } catch {
        return false;
      }
    });
    
    res.json({
      path: reqPath,
      method: method || 'ANY',
      matching_rules: matchingRules.length,
      rules: matchingRules
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
