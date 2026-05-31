import axios from 'axios';
import dotenv from 'dotenv';
import { SubtitleCorrection, TrainingBatch, ModelVersion } from '../models/index.js';
import redis from '../config/redis.js';

dotenv.config();

const ALGORITHM_SERVICE_URL = process.env.ALGORITHM_SERVICE_URL || 'http://localhost:8000';
const MIN_TRAINING_SAMPLES = parseInt(process.env.MIN_TRAINING_SAMPLES) || 100;
const TRAINING_STATUS_KEY = 'training:status:';

class ModelTrainingService {
  static async scheduleTraining() {
    try {
      console.log('[ModelTrainingService] 开始调度训练任务');

      const pendingBatch = await TrainingBatch.findOne({
        where: { status: 'pending' }
      });

      if (pendingBatch) {
        console.log('[ModelTrainingService] 已存在待处理的训练批次，跳过调度');
        return pendingBatch;
      }

      const runningBatch = await TrainingBatch.findOne({
        where: { status: 'running' }
      });

      if (runningBatch) {
        console.log('[ModelTrainingService] 已有训练任务正在进行，跳过调度');
        return runningBatch;
      }

      const unusedCorrections = await SubtitleCorrection.findAll({
        where: { isUsedForTraining: false },
        order: [['createdAt', 'ASC']],
        limit: 1000
      });

      if (unusedCorrections.length < MIN_TRAINING_SAMPLES) {
        console.log(`[ModelTrainingService] 未使用的修正记录不足，当前: ${unusedCorrections.length}，需要: ${MIN_TRAINING_SAMPLES}`);
        return null;
      }

      const latestModel = await ModelVersion.findOne({
        order: [['createdAt', 'DESC']]
      });

      const versionNumber = latestModel ? parseInt(latestModel.version.split('.').pop()) + 1 : 1;
      const newVersion = `v1.0.${versionNumber}`;

      const trainingBatch = await TrainingBatch.create({
        name: `训练批次 ${new Date().toISOString().split('T')[0]}`,
        sampleCount: unusedCorrections.length,
        status: 'pending',
        parameters: {
          modelType: 'rule_based',
          sampleCount: unusedCorrections.length
        }
      });

      await SubtitleCorrection.update(
        { trainingBatchId: trainingBatch.id, isUsedForTraining: true },
        { where: { id: unusedCorrections.map(c => c.id) } }
      );

      const trainingData = unusedCorrections.map(correction => ({
        id: correction.id,
        originalStart: correction.originalStart,
        originalEnd: correction.originalEnd,
        correctedStart: correction.correctedStart,
        correctedEnd: correction.correctedEnd,
        originalText: correction.originalText,
        vadStart: correction.vadStart,
        vadEnd: correction.vadEnd,
        metadata: correction.metadata
      }));

      await trainingBatch.update({ status: 'running', startedAt: new Date() });

      await redis.set(`${TRAINING_STATUS_KEY}${trainingBatch.id}`, JSON.stringify({
        status: 'running',
        progress: 0,
        startedAt: new Date().toISOString()
      }), 'EX', 86400);

      try {
        await axios.post(`${ALGORITHM_SERVICE_URL}/api/train`, {
          batchId: trainingBatch.id,
          trainingData,
          modelVersion: newVersion,
          callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/models/training/callback`
        }, { timeout: 30000 });

        console.log(`[ModelTrainingService] 训练任务已提交，批次ID: ${trainingBatch.id}，样本数: ${unusedCorrections.length}`);
      } catch (algorithmError) {
        console.error('[ModelTrainingService] 调用算法服务失败，更新批次状态:', algorithmError.message);
        await trainingBatch.update({ status: 'failed' });
        await redis.del(`${TRAINING_STATUS_KEY}${trainingBatch.id}`);
        throw algorithmError;
      }

      return trainingBatch;
    } catch (error) {
      console.error('[ModelTrainingService] 调度训练任务失败:', error);
      throw error;
    }
  }

  static async evaluateModel(modelId, testData) {
    try {
      if (!modelId || !testData || !Array.isArray(testData) || testData.length === 0) {
        throw new Error('modelId 和 testData (非空数组) 为必填项');
      }

      const model = await ModelVersion.findByPk(modelId);
      if (!model) {
        throw new Error(`模型 ${modelId} 不存在`);
      }

      console.log(`[ModelTrainingService] 开始评估模型 ${modelId}，测试样本数: ${testData.length}`);

      const response = await axios.post(`${ALGORITHM_SERVICE_URL}/api/evaluate`, {
        modelId,
        modelData: model.modelData,
        testData
      }, { timeout: 60000 });

      const { avgOffsetError, accuracy, conversionRate, detailedMetrics } = response.data;

      console.log(`[ModelTrainingService] 模型 ${modelId} 评估完成，平均偏移误差: ${avgOffsetError?.toFixed(4)}，准确率: ${accuracy?.toFixed(4)}`);

      return {
        modelId,
        modelVersion: model.version,
        avgOffsetError,
        accuracy,
        conversionRate,
        detailedMetrics,
        testSampleCount: testData.length,
        evaluatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[ModelTrainingService] 评估模型失败:', error);
      throw error;
    }
  }

  static async getTrainingStatus(batchId) {
    try {
      if (!batchId) {
        throw new Error('batchId 为必填项');
      }

      const cacheKey = `${TRAINING_STATUS_KEY}${batchId}`;
      const cachedStatus = await redis.get(cacheKey);

      if (cachedStatus) {
        return JSON.parse(cachedStatus);
      }

      const batch = await TrainingBatch.findByPk(batchId, {
        include: [{
          model: ModelVersion,
          as: 'modelVersion',
          attributes: ['id', 'version', 'name']
        }]
      });

      if (!batch) {
        throw new Error(`训练批次 ${batchId} 不存在`);
      }

      const status = {
        batchId: batch.id,
        status: batch.status,
        sampleCount: batch.sampleCount,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
        metrics: batch.metrics,
        modelVersion: batch.modelVersion ? batch.modelVersion.version : null,
        progress: batch.status === 'completed' ? 100 : batch.status === 'running' ? 50 : 0
      };

      if (batch.status === 'running') {
        await redis.set(cacheKey, JSON.stringify(status), 'EX', 3600);
      }

      return status;
    } catch (error) {
      console.error('[ModelTrainingService] 获取训练状态失败:', error);
      throw error;
    }
  }

  static async handleTrainingCallback(batchId, result) {
    try {
      const { success, modelData, metrics, error } = result;

      const batch = await TrainingBatch.findByPk(batchId);
      if (!batch) {
        throw new Error(`训练批次 ${batchId} 不存在`);
      }

      if (success) {
        const latestModel = await ModelVersion.findOne({
          order: [['createdAt', 'DESC']]
        });

        const versionNumber = latestModel ? parseInt(latestModel.version.split('.').pop()) + 1 : 1;
        const newVersion = `v1.0.${versionNumber}`;

        const newModel = await ModelVersion.create({
          version: newVersion,
          name: `自动训练模型 ${newVersion}`,
          description: `通过自动训练生成，训练批次: ${batchId}`,
          modelType: 'rule_based',
          modelData,
          isActive: false,
          isDefault: false,
          trainingSampleCount: batch.sampleCount,
          validationAccuracy: metrics?.validationAccuracy,
          testAccuracy: metrics?.testAccuracy,
          avgOffsetError: metrics?.avgOffsetError,
          trainedAt: new Date()
        });

        await batch.update({
          status: 'completed',
          completedAt: new Date(),
          modelVersionId: newModel.id,
          metrics
        });

        await redis.set(`${TRAINING_STATUS_KEY}${batchId}`, JSON.stringify({
          status: 'completed',
          progress: 100,
          modelId: newModel.id,
          modelVersion: newVersion,
          completedAt: new Date().toISOString(),
          metrics
        }), 'EX', 86400);

        console.log(`[ModelTrainingService] 训练完成，新模型版本: ${newVersion}`);
        return { success: true, modelId: newModel.id, modelVersion: newVersion };
      } else {
        await batch.update({
          status: 'failed',
          completedAt: new Date(),
          metrics: { error: error || '训练失败' }
        });

        await redis.set(`${TRAINING_STATUS_KEY}${batchId}`, JSON.stringify({
          status: 'failed',
          error: error || '训练失败',
          completedAt: new Date().toISOString()
        }), 'EX', 86400);

        console.error(`[ModelTrainingService] 训练失败，批次ID: ${batchId}，错误: ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      console.error('[ModelTrainingService] 处理训练回调失败:', error);
      throw error;
    }
  }
}

export default ModelTrainingService;
