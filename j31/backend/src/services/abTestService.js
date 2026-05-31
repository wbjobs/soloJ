import { createHash } from 'crypto';
import { ABTest, ABTestAssignment, ModelVersion } from '../models/index.js';

class ABTestService {
  static async getAssignmentForTask(taskId) {
    try {
      if (!taskId) {
        throw new Error('taskId 为必填项');
      }

      const runningTests = await ABTest.getRunningTests();

      if (runningTests.length === 0) {
        console.log(`[ABTestService] 没有运行中的A/B测试，任务 ${taskId} 使用默认模型`);
        const defaultModel = await ModelVersion.getDefaultModel();
        if (!defaultModel) {
          throw new Error('未找到可用的默认模型');
        }
        return {
          variant: 'A',
          modelId: defaultModel.id,
          modelVersion: defaultModel.version,
          abTestId: null
        };
      }

      if (runningTests.length > 1) {
        console.warn(`[ABTestService] 检测到 ${runningTests.length} 个运行中的测试，只允许一个运行，使用第一个`);
      }

      const abTest = runningTests[0];
      const existingAssignment = await ABTestAssignment.findOne({
        where: { taskId, abTestId: abTest.id },
        include: [{ model: ModelVersion, as: 'assignedModel', attributes: ['id', 'version'] }]
      });

      if (existingAssignment) {
        console.log(`[ABTestService] 任务 ${taskId} 已存在分配，变体: ${existingAssignment.variant}`);
        return {
          variant: existingAssignment.variant,
          modelId: existingAssignment.assignedModelId,
          modelVersion: existingAssignment.assignedModel.version,
          abTestId: abTest.id
        };
      }

      const hash = createHash('sha256')
        .update(taskId + abTest.id)
        .digest('hex');
      const hashValue = parseInt(hash.substring(0, 8), 16);
      const percentile = (hashValue % 100) + 1;

      const variant = percentile <= abTest.trafficSplitA ? 'A' : 'B';
      const modelId = variant === 'A' ? abTest.modelAId : abTest.modelBId;

      const model = await ModelVersion.findByPk(modelId, {
        attributes: ['id', 'version']
      });

      if (!model) {
        throw new Error(`模型 ${modelId} 不存在`);
      }

      console.log(`[ABTestService] 任务 ${taskId} 分配到变体 ${variant}，模型: ${model.version}`);

      return {
        variant,
        modelId: model.id,
        modelVersion: model.version,
        abTestId: abTest.id
      };
    } catch (error) {
      console.error('[ABTestService] 获取任务分配失败:', error);
      throw error;
    }
  }

  static async recordAssignment(abTestId, taskId, modelId, variant) {
    try {
      if (!abTestId || !taskId || !modelId || !variant) {
        throw new Error('abTestId, taskId, modelId, variant 均为必填项');
      }

      const abTest = await ABTest.findByPk(abTestId);
      if (!abTest) {
        throw new Error(`A/B测试 ${abTestId} 不存在`);
      }

      const existingAssignment = await ABTestAssignment.findOne({
        where: { abTestId, taskId }
      });

      if (existingAssignment) {
        console.log(`[ABTestService] 任务 ${taskId} 的分配记录已存在，跳过创建`);
        return existingAssignment;
      }

      const assignment = await ABTestAssignment.create({
        abTestId,
        taskId,
        assignedModelId: modelId,
        variant
      });

      console.log(`[ABTestService] 已记录任务 ${taskId} 的分配，变体: ${variant}`);
      return assignment;
    } catch (error) {
      console.error('[ABTestService] 记录分配失败:', error);
      throw error;
    }
  }

  static async updateAssignmentResult(taskId, offsetError, isConverted) {
    try {
      if (!taskId) {
        throw new Error('taskId 为必填项');
      }

      const assignment = await ABTestAssignment.findOne({
        where: { taskId },
        order: [['createdAt', 'DESC']]
      });

      if (!assignment) {
        console.warn(`[ABTestService] 未找到任务 ${taskId} 的分配记录`);
        return null;
      }

      const updateData = {};
      if (offsetError !== undefined && offsetError !== null) {
        updateData.offsetError = offsetError;
      }
      if (isConverted !== undefined && isConverted !== null) {
        updateData.isConverted = isConverted;
      }

      if (Object.keys(updateData).length === 0) {
        console.warn(`[ABTestService] 没有需要更新的结果数据`);
        return assignment;
      }

      await assignment.update(updateData);

      console.log(`[ABTestService] 已更新任务 ${taskId} 的分配结果，offsetError: ${offsetError}, isConverted: ${isConverted}`);
      return assignment;
    } catch (error) {
      console.error('[ABTestService] 更新分配结果失败:', error);
      throw error;
    }
  }
}

export default ABTestService;
