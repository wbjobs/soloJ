import express from 'express';
import fs from 'fs';
import path from 'path';
import Task from '../models/Task.js';

const router = express.Router();

router.get('/tasks', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (status) {
      where.status = status;
    }
    
    const { count, rows } = await Task.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: {
        exclude: ['vadSegments', 'subtitleSegments']
      }
    });
    
    res.json({
      success: true,
      tasks: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await Task.findByPk(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      task
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/tasks/:taskId/download', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { type = 'aligned' } = req.query;
    
    const task = await Task.findByPk(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    let filePath;
    let fileName;
    
    if (type === 'aligned') {
      if (!task.alignedSubtitlePath || !fs.existsSync(task.alignedSubtitlePath)) {
        return res.status(404).json({
          success: false,
          error: '校准后的字幕文件不存在'
        });
      }
      filePath = task.alignedSubtitlePath;
      fileName = `aligned_${task.subtitleFileName}`;
    } else {
      filePath = task.originalSubtitlePath;
      fileName = task.subtitleFileName;
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/x-subrip');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/tasks/:taskId/apply-offset', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { offset } = req.body;
    
    if (typeof offset !== 'number') {
      return res.status(400).json({
        success: false,
        error: '偏移量必须是数字'
      });
    }
    
    const task = await Task.findByPk(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    if (!task.originalSubtitlePath || !fs.existsSync(task.originalSubtitlePath)) {
      return res.status(404).json({
        success: false,
        error: '原始字幕文件不存在'
      });
    }
    
    const srtContent = fs.readFileSync(task.originalSubtitlePath, 'utf-8');
    const alignedContent = applyOffsetToSRT(srtContent, offset);
    
    const alignedPath = task.originalSubtitlePath.replace('.srt', `_manual_${Date.now()}.srt`);
    fs.writeFileSync(alignedPath, alignedContent, 'utf-8');
    
    await task.update({
      alignedSubtitlePath: alignedPath,
      alignmentOffset: offset,
      subtitleSegments: task.subtitleSegments ? 
        task.subtitleSegments.map(seg => ({
          ...seg,
          start: seg.start + offset,
          end: seg.end + offset
        })) : null
    });
    
    res.json({
      success: true,
      message: '偏移量已应用',
      offset,
      alignedPath
    });
  } catch (error) {
    console.error('Apply offset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function applyOffsetToSRT(srtContent, offset) {
  const timeRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
  
  return srtContent.replace(timeRegex, (match, h1, m1, s1, ms1, h2, m2, s2, ms2) => {
    const startMs = ((parseInt(h1) * 3600) + (parseInt(m1) * 60) + parseInt(s1)) * 1000 + parseInt(ms1);
    const endMs = ((parseInt(h2) * 3600) + (parseInt(m2) * 60) + parseInt(s2)) * 1000 + parseInt(ms2);
    
    const newStartMs = Math.max(0, startMs + offset * 1000);
    const newEndMs = Math.max(0, endMs + offset * 1000);
    
    return `${formatTime(newStartMs)} --> ${formatTime(newEndMs)}`;
  });
}

function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await Task.findByPk(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    if (task.metadata?.videoPath && fs.existsSync(task.metadata.videoPath)) {
      fs.unlinkSync(task.metadata.videoPath);
    }
    if (task.originalSubtitlePath && fs.existsSync(task.originalSubtitlePath)) {
      fs.unlinkSync(task.originalSubtitlePath);
    }
    if (task.alignedSubtitlePath && fs.existsSync(task.alignedSubtitlePath)) {
      fs.unlinkSync(task.alignedSubtitlePath);
    }
    
    await task.destroy();
    
    res.json({
      success: true,
      message: '任务已删除'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
