import express from 'express';
import { ModelVersion } from '../models/index.js';
import sequelize from '../config/database.js';

const router = express.Router();

router.get('/models', async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, modelType } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (modelType) {
      where.modelType = modelType;
    }

    const { count, rows } = await ModelVersion.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      models: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/models/default', async (req, res) => {
  try {
    const defaultModel = await ModelVersion.getDefaultModel();

    if (!defaultModel) {
      return res.status(404).json({
        success: false,
        error: '未找到默认模型'
      });
    }

    res.json({
      success: true,
      model: defaultModel
    });
  } catch (error) {
    console.error('Get default model error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const model = await ModelVersion.findByPk(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: '模型不存在'
      });
    }

    res.json({
      success: true,
      model
    });
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/models', async (req, res) => {
  try {
    const {
      version,
      name,
      description,
      modelType,
      modelData,
      trainingSampleCount,
      validationAccuracy,
      testAccuracy,
      avgOffsetError,
      trainedAt
    } = req.body;

    if (!version || !name) {
      return res.status(400).json({
        success: false,
        error: '版本号和名称为必填项'
      });
    }

    const existingModel = await ModelVersion.findOne({ where: { version } });
    if (existingModel) {
      return res.status(400).json({
        success: false,
        error: '版本号已存在'
      });
    }

    const newModel = await ModelVersion.create({
      version,
      name,
      description,
      modelType: modelType || 'rule_based',
      modelData,
      trainingSampleCount,
      validationAccuracy,
      testAccuracy,
      avgOffsetError,
      trainedAt
    });

    res.status(201).json({
      success: true,
      message: '模型创建成功',
      model: newModel
    });
  } catch (error) {
    console.error('Create model error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/models/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive 必须是布尔值'
      });
    }

    const model = await ModelVersion.findByPk(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: '模型不存在'
      });
    }

    await model.update({ isActive });

    res.json({
      success: true,
      message: `模型已${isActive ? '激活' : '停用'}`,
      model
    });
  } catch (error) {
    console.error('Toggle model activation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/models/:id/default', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const model = await ModelVersion.findByPk(id, { transaction });

    if (!model) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: '模型不存在'
      });
    }

    if (!model.isActive) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: '无法将未激活的模型设置为默认模型'
      });
    }

    await ModelVersion.update(
      { isDefault: false },
      { where: { isDefault: true }, transaction }
    );

    await model.update({ isDefault: true }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: '已设置为默认模型',
      model
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Set default model error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
