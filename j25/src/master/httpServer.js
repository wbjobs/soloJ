const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { generatePNG, generateStatsJSON } = require('./imageGenerator');
const { ensureDir, formatTime } = require('../common/utils');
const PreviewService = require('./previewService');

class HttpServer {
  constructor(taskManager, port = 3000) {
    this.taskManager = taskManager;
    this.port = port;
    this.app = express();
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.previewService = new PreviewService();
  }

  start() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));

    this.app.use('/output', express.static(path.join(__dirname, '../../output')));
    this.app.use(express.static(path.join(__dirname, '../../frontend/build')));

    this.app.post('/api/tasks', (req, res) => {
      try {
        const scene = req.body;
        const taskId = this.taskManager.createTask(scene);
        console.log(`New task created: ${taskId}`);
        
        const lowResPreview = this.previewService.generateLowResPreview(scene, taskId, 64);
        
        const task = this.taskManager.tasks.get(taskId);
        if (task) {
          task.previewUrl = lowResPreview.url;
          task.previewWidth = lowResPreview.width;
          task.previewHeight = lowResPreview.height;
        }
        
        this.broadcastUpdate();
        res.json({ 
          taskId, 
          status: 'accepted',
          previewUrl: lowResPreview.url
        });
      } catch (err) {
        console.error('Error creating task:', err);
        res.status(400).json({ error: err.message });
      }
    });
    
    this.app.post('/api/preview/adaptive', async (req, res) => {
      try {
        const scene = req.body;
        const taskId = `preview-${Date.now()}`;
        
        console.log(`Generating adaptive preview for ${scene.width}x${scene.height}...`);
        
        const result = await this.previewService.generateAdaptivePreview(scene, taskId);
        
        res.json({
          taskId,
          previewUrl: result.url,
          sampleMapUrl: result.sampleMapUrl,
          width: result.width,
          height: result.height,
          totalSamples: result.totalSamples,
          renderTimeMs: result.renderTimeMs
        });
      } catch (err) {
        console.error('Error generating adaptive preview:', err);
        res.status(500).json({ error: err.message });
      }
    });
    
    this.app.post('/api/preview/lowres', (req, res) => {
      try {
        const scene = req.body;
        const taskId = `preview-${Date.now()}`;
        const size = req.body.size || 64;
        
        const result = this.previewService.generateLowResPreview(scene, taskId, size);
        
        res.json({
          taskId,
          previewUrl: result.url,
          width: result.width,
          height: result.height
        });
      } catch (err) {
        console.error('Error generating low-res preview:', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/tasks', (req, res) => {
      const tasks = this.taskManager.getAllTasks();
      res.json(tasks);
    });

    this.app.get('/api/tasks/:taskId', (req, res) => {
      const status = this.taskManager.getTaskStatus(req.params.taskId);
      if (!status) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(status);
    });

    this.app.get('/api/tasks/:taskId/stats', (req, res) => {
      const stats = this.taskManager.getTaskStats(req.params.taskId);
      if (!stats) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(stats);
    });

    this.app.get('/api/tasks/:taskId/download', async (req, res) => {
      const taskId = req.params.taskId;
      const pixelData = this.taskManager.getTaskPixelData(taskId);
      const taskStatus = this.taskManager.getTaskStatus(taskId);
      
      if (!pixelData || !taskStatus) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = this.taskManager.tasks.get(taskId);
      const outputPath = path.join(__dirname, '../../output', taskId, 'render.png');
      
      try {
        if (!fs.existsSync(outputPath) || taskStatus.status === 'completed') {
          await generatePNG(task.scene.width, task.scene.height, pixelData, outputPath);
        }
        res.download(outputPath, `${taskId}.png`);
      } catch (err) {
        console.error('Error generating PNG:', err);
        res.status(500).json({ error: 'Failed to generate PNG' });
      }
    });

    this.app.get('/api/tasks/:taskId/export-stats', async (req, res) => {
      const taskId = req.params.taskId;
      const stats = this.taskManager.getTaskStats(taskId);
      
      if (!stats) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const outputPath = path.join(__dirname, '../../output', taskId, 'stats.json');
      try {
        generateStatsJSON(stats, outputPath);
        res.download(outputPath, `${taskId}-stats.json`);
      } catch (err) {
        console.error('Error exporting stats:', err);
        res.status(500).json({ error: 'Failed to export stats' });
      }
    });

    this.app.get('/api/workers', (req, res) => {
      const workers = this.taskManager.getWorkerStatus();
      res.json(workers);
    });

    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
    });

    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('WebSocket client connected');
      
      this.sendUpdate(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('WebSocket client disconnected');
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'subscribe') {
            this.sendUpdate(ws);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      });
    });

    this.server.listen(this.port, () => {
      console.log(`HTTP server listening on port ${this.port}`);
    });

    this.startBroadcastInterval();
  }

  sendUpdate(ws) {
    const tasks = this.taskManager.getAllTasks();
    const workers = this.taskManager.getWorkerStatus();
    
    const detailedTasks = tasks.map(task => {
      const status = this.taskManager.getTaskStatus(task.taskId);
      const fullTask = this.taskManager.tasks.get(task.taskId);
      return {
        ...task,
        etaFormatted: status?.eta ? formatTime(status.eta) : null,
        totalSamples: status?.totalSamples || 0,
        previewUrl: fullTask?.previewUrl || null,
        previewWidth: fullTask?.previewWidth || null,
        previewHeight: fullTask?.previewHeight || null
      };
    });

    const update = {
      type: 'statusUpdate',
      tasks: detailedTasks,
      workers,
      timestamp: Date.now()
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(update));
    }
  }

  broadcastUpdate() {
    const tasks = this.taskManager.getAllTasks();
    const workers = this.taskManager.getWorkerStatus();
    
    const detailedTasks = tasks.map(task => {
      const status = this.taskManager.getTaskStatus(task.taskId);
      const fullTask = this.taskManager.tasks.get(task.taskId);
      return {
        ...task,
        etaFormatted: status?.eta ? formatTime(status.eta) : null,
        totalSamples: status?.totalSamples || 0,
        previewUrl: fullTask?.previewUrl || null,
        previewWidth: fullTask?.previewWidth || null,
        previewHeight: fullTask?.previewHeight || null
      };
    });

    const update = {
      type: 'statusUpdate',
      tasks: detailedTasks,
      workers,
      timestamp: Date.now()
    };

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(update));
      }
    });
  }

  startBroadcastInterval() {
    setInterval(() => {
      this.broadcastUpdate();
    }, 1000);
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = HttpServer;
