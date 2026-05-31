import { Router } from 'express';
import { TrainingBatch, SubtitleCorrection, ModelVersion } from '../models/index.js';
import schedulerService from '../services/schedulerService.js';

const router = Router();

router.get('/training/status', async (req, res) => {
  try {
    const stats = await getTrainingStats();
    res.json({
      success: true,
      data: {
        scheduler: schedulerService.getStatus(),
        stats
      }
    });
  } catch (error) {
    console.error('[Training] Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/training/trigger', async (req, res) => {
  try {
    const result = await schedulerService.triggerManualTraining();
    
    if (!result) {
      return res.json({
        success: false,
        message: 'Not enough training samples or training in progress'
      });
    }

    res.json({
      success: true,
      message: 'Training completed successfully',
      data: result
    });
  } catch (error) {
    console.error('[Training] Manual training failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/training/batches', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await TrainingBatch.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [{
        model: ModelVersion,
        as: 'modelVersion',
        attributes: ['id', 'version', 'name', 'isActive']
      }]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('[Training] Failed to get batches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/training/batches/:id', async (req, res) => {
  try {
    const batch = await TrainingBatch.findByPk(req.params.id, {
      include: [{
        model: ModelVersion,
        as: 'modelVersion',
        attributes: ['id', 'version', 'name', 'isActive', 'validationAccuracy', 'avgOffsetError']
      }, {
        model: SubtitleCorrection,
        as: 'subtitleCorrections',
        limit: 10,
        attributes: ['id', 'subtitleIndex', 'originalStart', 'correctedStart']
      }]
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Training batch not found'
      });
    }

    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    console.error('[Training] Failed to get batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/training/corrections/unused', async (req, res) => {
  try {
    const count = await SubtitleCorrection.count({
      where: { isUsedForTraining: false }
    });

    const sample = await SubtitleCorrection.findAll({
      where: { isUsedForTraining: false },
      order: [['createdAt', 'ASC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        totalUnused: count,
        minRequired: parseInt(process.env.MIN_TRAINING_SAMPLES || '100'),
        canTrain: count >= parseInt(process.env.MIN_TRAINING_SAMPLES || '100'),
        sample
      }
    });
  } catch (error) {
    console.error('[Training] Failed to get unused corrections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/training/scheduler/start', (req, res) => {
  try {
    schedulerService.start();
    res.json({
      success: true,
      message: 'Training scheduler started',
      data: schedulerService.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/training/scheduler/stop', (req, res) => {
  try {
    schedulerService.stop();
    res.json({
      success: true,
      message: 'Training scheduler stopped',
      data: schedulerService.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function getTrainingStats() {
  const [totalCorrections, usedCorrections, unusedCorrections, totalModels, totalBatches, completedBatches, failedBatches, activeModels] = await Promise.all([
    SubtitleCorrection.count(),
    SubtitleCorrection.count({ where: { isUsedForTraining: true } }),
    SubtitleCorrection.count({ where: { isUsedForTraining: false } }),
    ModelVersion.count(),
    TrainingBatch.count(),
    TrainingBatch.count({ where: { status: 'completed' } }),
    TrainingBatch.count({ where: { status: 'failed' } }),
    ModelVersion.count({ where: { isActive: true } })
  ]);

  const defaultModel = await ModelVersion.findOne({ where: { isDefault: true } });
  const latestModel = await ModelVersion.findOne({
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'version', 'name', 'validationAccuracy', 'avgOffsetError', 'createdAt']
  });

  return {
    corrections: {
      total: totalCorrections,
      usedForTraining: usedCorrections,
      unused: unusedCorrections
    },
    models: {
      total: totalModels,
      active: activeModels,
      default: defaultModel,
      latest: latestModel
    },
    batches: {
      total: totalBatches,
      completed: completedBatches,
      failed: failedBatches,
      successRate: totalBatches > 0 ? (completedBatches / totalBatches) : 0
    }
  };
}

export default router;
