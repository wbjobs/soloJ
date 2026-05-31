import express from 'express';
import { Op, fn, col, literal } from 'sequelize';
import ABTest from '../models/ABTest.js';
import ABTestAssignment from '../models/ABTestAssignment.js';
import ModelVersion from '../models/ModelVersion.js';

const router = express.Router();

function calculateZTest(conversionA, totalA, conversionB, totalB) {
  if (totalA === 0 || totalB === 0) return null;
  
  const pA = conversionA / totalA;
  const pB = conversionB / totalB;
  const pPooled = (conversionA + conversionB) / (totalA + totalB);
  
  const standardError = Math.sqrt(pPooled * (1 - pPooled) * (1 / totalA + 1 / totalB));
  
  if (standardError === 0) return null;
  
  const zScore = (pA - pB) / standardError;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));
  
  return { zScore, pValue };
}

function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) return 1 - prob;
  return prob;
}

async function calculateStatistics(abTestId) {
  const assignments = await ABTestAssignment.findAll({
    where: { abTestId },
    attributes: [
      'variant',
      [fn('COUNT', col('id')), 'totalTasks'],
      [fn('AVG', col('offsetError')), 'avgOffsetError'],
      [fn('SUM', literal('CASE WHEN "isConverted" = true THEN 1 ELSE 0 END')), 'convertedCount']
    ],
    group: ['variant']
  });

  const stats = {
    A: { totalTasks: 0, avgOffsetError: 0, conversionRate: 0, convertedCount: 0 },
    B: { totalTasks: 0, avgOffsetError: 0, conversionRate: 0, convertedCount: 0 }
  };

  assignments.forEach(stat => {
    const variant = stat.variant;
    if (stats[variant]) {
      stats[variant] = {
        totalTasks: parseInt(stat.dataValues.totalTasks) || 0,
        avgOffsetError: parseFloat(stat.dataValues.avgOffsetError) || 0,
        convertedCount: parseInt(stat.dataValues.convertedCount) || 0,
        conversionRate: parseInt(stat.dataValues.totalTasks) > 0
          ? (parseInt(stat.dataValues.convertedCount) || 0) / parseInt(stat.dataValues.totalTasks)
          : 0
      };
    }
  });

  let pValue = null;
  if (stats.A.totalTasks > 0 && stats.B.totalTasks > 0) {
    const result = calculateZTest(
      stats.A.convertedCount,
      stats.A.totalTasks,
      stats.B.convertedCount,
      stats.B.totalTasks
    );
    pValue = result ? result.pValue : null;
  }

  return {
    groups: stats,
    pValue
  };
}

router.get('/ab-tests', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }

    const { count, rows } = await ABTest.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: ModelVersion, as: 'modelA', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'modelB', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'winner', attributes: ['id', 'name', 'version'] }
      ]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get AB tests error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/ab-tests', async (req, res) => {
  try {
    const { name, description, modelAId, modelBId, trafficSplitA = 50, trafficSplitB = 50 } = req.body;

    if (!name || !modelAId || !modelBId) {
      return res.status(400).json({
        success: false,
        error: '名称、模型A和模型B为必填项'
      });
    }

    if (trafficSplitA + trafficSplitB !== 100) {
      return res.status(400).json({
        success: false,
        error: '流量分配比例之和必须为100'
      });
    }

    const modelA = await ModelVersion.findByPk(modelAId);
    const modelB = await ModelVersion.findByPk(modelBId);

    if (!modelA || !modelB) {
      return res.status(404).json({
        success: false,
        error: '指定的模型不存在'
      });
    }

    const abTest = await ABTest.create({
      name,
      description,
      modelAId,
      modelBId,
      trafficSplitA,
      trafficSplitB
    });

    const result = await ABTest.findByPk(abTest.id, {
      include: [
        { model: ModelVersion, as: 'modelA', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'modelB', attributes: ['id', 'name', 'version'] }
      ]
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Create AB test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/ab-tests/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const abTest = await ABTest.findByPk(id, {
      include: [
        { model: ModelVersion, as: 'modelA', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'modelB', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'winner', attributes: ['id', 'name', 'version'] }
      ]
    });

    if (!abTest) {
      return res.status(404).json({
        success: false,
        error: 'A/B测试不存在'
      });
    }

    const statistics = await calculateStatistics(id);

    res.json({
      success: true,
      data: {
        ...abTest.toJSON(),
        statistics
      }
    });
  } catch (error) {
    console.error('Get AB test detail error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/ab-tests/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const abTest = await ABTest.findByPk(id, {
      include: [
        { model: ModelVersion, as: 'modelA' },
        { model: ModelVersion, as: 'modelB' }
      ]
    });

    if (!abTest) {
      return res.status(404).json({
        success: false,
        error: 'A/B测试不存在'
      });
    }

    if (abTest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: '只有待启动状态的测试才能启动'
      });
    }

    if (!abTest.modelA.isActive || !abTest.modelB.isActive) {
      return res.status(400).json({
        success: false,
        error: '两个模型都必须处于激活状态才能启动测试'
      });
    }

    await abTest.update({
      status: 'running',
      startTime: new Date()
    });

    const result = await ABTest.findByPk(id, {
      include: [
        { model: ModelVersion, as: 'modelA', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'modelB', attributes: ['id', 'name', 'version'] }
      ]
    });

    res.json({
      success: true,
      data: result,
      message: 'A/B测试已启动'
    });
  } catch (error) {
    console.error('Start AB test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/ab-tests/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    const abTest = await ABTest.findByPk(id);

    if (!abTest) {
      return res.status(404).json({
        success: false,
        error: 'A/B测试不存在'
      });
    }

    if (abTest.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: '只有运行中的测试才能停止'
      });
    }

    const statistics = await calculateStatistics(id);

    await abTest.update({
      status: 'stopped',
      endTime: new Date(),
      results: statistics
    });

    const result = await ABTest.findByPk(id, {
      include: [
        { model: ModelVersion, as: 'modelA', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'modelB', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'winner', attributes: ['id', 'name', 'version'] }
      ]
    });

    res.json({
      success: true,
      data: {
        ...result.toJSON(),
        statistics
      },
      message: 'A/B测试已停止'
    });
  } catch (error) {
    console.error('Stop AB test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/ab-tests/:id/winner', async (req, res) => {
  try {
    const { id } = req.params;
    const { winnerId } = req.body;

    if (!winnerId) {
      return res.status(400).json({
        success: false,
        error: '获胜模型ID为必填项'
      });
    }

    const abTest = await ABTest.findByPk(id);

    if (!abTest) {
      return res.status(404).json({
        success: false,
        error: 'A/B测试不存在'
      });
    }

    if (abTest.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: '测试已完成，不能重复设置获胜者'
      });
    }

    if (winnerId !== abTest.modelAId && winnerId !== abTest.modelBId) {
      return res.status(400).json({
        success: false,
        error: '获胜模型必须是测试中的模型之一'
      });
    }

    const statistics = await calculateStatistics(id);

    await abTest.update({
      status: 'completed',
      endTime: new Date(),
      winnerId,
      results: statistics
    });

    const result = await ABTest.findByPk(id, {
      include: [
        { model: ModelVersion, as: 'modelA', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'modelB', attributes: ['id', 'name', 'version'] },
        { model: ModelVersion, as: 'winner', attributes: ['id', 'name', 'version'] }
      ]
    });

    res.json({
      success: true,
      data: {
        ...result.toJSON(),
        statistics
      },
      message: 'A/B测试已完成，获胜模型已设置'
    });
  } catch (error) {
    console.error('Set AB test winner error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
