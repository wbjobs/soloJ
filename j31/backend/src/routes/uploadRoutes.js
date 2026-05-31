import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import Task from '../models/Task.js';
import { addAlignmentTask } from '../queues/taskQueue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadDir = path.resolve(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('不支持的视频格式'), false);
      }
    } else if (file.fieldname === 'subtitle') {
      if (file.originalname.endsWith('.srt')) {
        cb(null, true);
      } else {
        cb(new Error('字幕文件必须是SRT格式'), false);
      }
    } else {
      cb(new Error('未知文件类型'), false);
    }
  }
});

router.post(
  '/upload',
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'subtitle', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { video, subtitle } = req.files;
      
      if (!video || !subtitle) {
        return res.status(400).json({
          success: false,
          error: '请同时上传视频和字幕文件'
        });
      }

      const videoFile = video[0];
      const subtitleFile = subtitle[0];

      const task = await Task.create({
        status: 'pending',
        videoFileName: videoFile.originalname,
        videoFileSize: videoFile.size,
        subtitleFileName: subtitleFile.originalname,
        originalSubtitlePath: subtitleFile.path,
        metadata: {
          videoPath: videoFile.path,
          subtitlePath: subtitleFile.path
        }
      });

      await addAlignmentTask(
        task.id,
        videoFile.path,
        subtitleFile.path
      );

      res.json({
        success: true,
        taskId: task.id,
        message: '文件上传成功，任务已开始处理'
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '文件上传失败'
      });
    }
  }
);

router.post('/upload/chunk', async (req, res) => {
  try {
    const { chunkIndex, totalChunks, fileName, fileSize, taskId } = req.body;
    
    const taskDir = path.join(uploadDir, taskId);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }

    const chunkPath = path.join(taskDir, `chunk_${chunkIndex}`);
    const writeStream = fs.createWriteStream(chunkPath);
    
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      res.json({
        success: true,
        chunkIndex,
        received: true
      });
    });

    writeStream.on('error', (error) => {
      res.status(500).json({
        success: false,
        error: error.message
      });
    });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/upload/merge', async (req, res) => {
  try {
    const { taskId, fileName, totalChunks, isVideo } = req.body;
    const taskDir = path.join(uploadDir, taskId);
    const finalPath = path.join(uploadDir, `${taskId}_${fileName}`);
    
    const writeStream = fs.createWriteStream(finalPath);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(taskDir, `chunk_${i}`);
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
      fs.unlinkSync(chunkPath);
    }
    
    writeStream.end();
    
    fs.rmSync(taskDir, { recursive: true, force: true });
    
    res.json({
      success: true,
      filePath: finalPath
    });
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
