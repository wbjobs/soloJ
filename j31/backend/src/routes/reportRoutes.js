import express from 'express';
import fs from 'fs';
import path from 'path';
import Task from '../models/Task.js';
import CalibrationReport from '../models/CalibrationReport.js';
import SubtitleCorrection from '../models/SubtitleCorrection.js';
import pdfReportService from '../services/pdfReportService.js';

const router = express.Router();

router.post('/tasks/:taskId/reports', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body;

    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: '任务尚未完成，无法生成报告'
      });
    }

    const subtitleCorrections = await SubtitleCorrection.findAll({
      where: { taskId },
      order: [['subtitleIndex', 'ASC']]
    });

    const metrics = pdfReportService.calculateMetrics(
      subtitleCorrections,
      task.vadSegments
    );

    const reportData = {
      ...metrics,
      taskInfo: {
        videoFileName: task.videoFileName,
        subtitleFileName: task.subtitleFileName,
        videoDuration: task.videoDuration,
        status: task.status
      },
      correctionsSummary: {
        totalCount: subtitleCorrections.length,
        averageAdjustment: subtitleCorrections.length > 0
          ? subtitleCorrections.reduce((sum, c) => sum + (c.correctedStart - c.originalStart), 0) / subtitleCorrections.length
          : 0
      }
    };

    const filePath = await pdfReportService.generatePDFReport(
      task,
      subtitleCorrections,
      reportData
    );

    const report = await CalibrationReport.create({
      taskId,
      modelVersion: task.modelVersion,
      originalOffset: metrics.originalOffset,
      correctedOffset: metrics.correctedOffset,
      confidence: metrics.confidence,
      vadSegmentCount: metrics.vadSegmentCount,
      subtitleSegmentCount: metrics.subtitleSegmentCount,
      matchRateBefore: metrics.matchRateBefore,
      matchRateAfter: metrics.matchRateAfter,
      avgOffsetErrorBefore: metrics.avgOffsetErrorBefore,
      avgOffsetErrorAfter: metrics.avgOffsetErrorAfter,
      reportData,
      filePath,
      userId
    });

    res.status(201).json({
      success: true,
      message: '报告生成成功',
      report: {
        id: report.id,
        taskId: report.taskId,
        matchRateBefore: report.matchRateBefore,
        matchRateAfter: report.matchRateAfter,
        avgOffsetErrorBefore: report.avgOffsetErrorBefore,
        avgOffsetErrorAfter: report.avgOffsetErrorAfter,
        confidence: report.confidence,
        filePath: report.filePath,
        createdAt: report.createdAt
      }
    });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/tasks/:taskId/reports', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }

    const { count, rows } = await CalibrationReport.findAndCountAll({
      where: { taskId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: {
        exclude: ['reportData']
      }
    });

    res.json({
      success: true,
      reports: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/reports/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const report = await CalibrationReport.findByPk(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报告不存在'
      });
    }

    if (!report.filePath || !fs.existsSync(report.filePath)) {
      return res.status(404).json({
        success: false,
        error: '报告文件不存在'
      });
    }

    const task = await Task.findByPk(report.taskId);
    const fileName = task
      ? `校准报告_${task.videoFileName.replace(path.extname(task.videoFileName), '')}_${report.id.substring(0, 8)}${path.extname(report.filePath)}`
      : `校准报告_${report.id}${path.extname(report.filePath)}`;

    const ext = path.extname(report.filePath).toLowerCase();
    const contentType = ext === '.pdf'
      ? 'application/pdf'
      : 'text/plain';

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', contentType);

    const fileStream = fs.createReadStream(report.filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
