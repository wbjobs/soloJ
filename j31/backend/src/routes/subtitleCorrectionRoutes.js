import express from 'express';
import SubtitleCorrection from '../models/SubtitleCorrection.js';
import Task from '../models/Task.js';

const router = express.Router();

router.get('/tasks/:taskId/corrections', async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }

    const corrections = await SubtitleCorrection.findAll({
      where: { taskId },
      order: [['subtitleIndex', 'ASC'], ['createdAt', 'ASC']]
    });

    res.json({
      success: true,
      data: corrections
    });
  } catch (error) {
    console.error('Get corrections error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/tasks/:taskId/corrections', async (req, res) => {
  try {
    const { taskId } = req.params;
    let corrections = req.body;

    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }

    const isBatch = Array.isArray(corrections);
    const correctionData = isBatch ? corrections : [corrections];

    const validCorrections = correctionData.map(c => ({
      ...c,
      taskId
    }));

    const createdCorrections = await SubtitleCorrection.bulkCreate(validCorrections, {
      returning: true
    });

    res.json({
      success: true,
      data: isBatch ? createdCorrections : createdCorrections[0],
      message: isBatch 
        ? `成功创建 ${createdCorrections.length} 条修正记录` 
        : '成功创建修正记录'
    });
  } catch (error) {
    console.error('Create corrections error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/corrections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const correction = await SubtitleCorrection.findByPk(id);
    if (!correction) {
      return res.status(404).json({
        success: false,
        error: '修正记录不存在'
      });
    }

    await correction.update(updateData);

    const updatedCorrection = await SubtitleCorrection.findByPk(id);

    res.json({
      success: true,
      data: updatedCorrection,
      message: '修正记录已更新'
    });
  } catch (error) {
    console.error('Update correction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/corrections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const correction = await SubtitleCorrection.findByPk(id);
    if (!correction) {
      return res.status(404).json({
        success: false,
        error: '修正记录不存在'
      });
    }

    await correction.destroy();

    res.json({
      success: true,
      message: '修正记录已删除'
    });
  } catch (error) {
    console.error('Delete correction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/corrections/unused', async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await SubtitleCorrection.findAndCountAll({
      where: {
        isUsedForTraining: false
      },
      order: [['createdAt', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
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
    console.error('Get unused corrections error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
