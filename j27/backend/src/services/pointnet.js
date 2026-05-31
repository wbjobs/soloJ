const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

class PointNetService {
  constructor() {
    this.pythonScript = path.join(__dirname, '..', 'python', 'pointnet_classifier.py');
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.classInfo = null;
    this.classifying = new Map();
  }

  async initialize() {
    this.classInfo = await this.getClassInfo();
    console.log('PointNet service initialized');
    return this.classInfo;
  }

  getClassInfo() {
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [this.pythonScript, 'class_info']);

      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse output: ${output}`));
          }
        } else {
          reject(new Error(`Python process exited with code ${code}: ${error}`));
        }
      });

      process.on('error', reject);
    });
  }

  classifyPoints(points, bounds = null) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(points) || points.length === 0) {
        return reject(new Error('Invalid points array'));
      }

      if (points.length > 100000) {
        return this.classifyPointsBatch(points, bounds, 100000);
      }

      const inputData = JSON.stringify({
        points,
        bounds,
      });

      const process = spawn(this.pythonPath, [this.pythonScript, 'classify', inputData]);

      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(new Error(`Failed to parse output: ${output.substring(0, 200)}`));
          }
        } else {
          reject(new Error(`Classification failed: ${error.substring(0, 200)}`));
        }
      });

      process.on('error', reject);
    });
  }

  async classifyPointsBatch(points, bounds, batchSize = 100000) {
    const allLabels = new Array(points.length);

    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      const result = await this.classifyPoints(batch, bounds);
      const labels = result.labels;

      for (let j = 0; j < labels.length; j++) {
        allLabels[i + j] = labels[j];
      }

      console.log(`Classified ${Math.min(i + batchSize, points.length)} / ${points.length} points`);
    }

    return {
      labels: allLabels,
      class_names: {
        0: 'ground',
        1: 'vegetation',
        2: 'building',
        3: 'vehicle',
        4: 'powerline',
        5: 'furniture',
        6: 'others',
      },
      class_colors: {
        0: [140, 140, 140],
        1: [0, 180, 0],
        2: [200, 100, 50],
        3: [255, 0, 0],
        4: [255, 255, 0],
        5: [150, 75, 0],
        6: [255, 0, 255],
      },
    };
  }

  getClasses() {
    if (!this.classInfo) {
      return {
        classes: [
          { id: 0, name: 'ground', color: '#8c8c8c' },
          { id: 1, name: 'vegetation', color: '#00b400' },
          { id: 2, name: 'building', color: '#c86432' },
          { id: 3, name: 'vehicle', color: '#ff0000' },
          { id: 4, name: 'powerline', color: '#ffff00' },
          { id: 5, name: 'furniture', color: '#964b00' },
          { id: 6, name: 'others', color: '#ff00ff' },
        ]
      };
    }
    return this.classInfo;
  }
}

const pointNetService = new PointNetService();
module.exports = pointNetService;
module.exports.PointNetService = PointNetService;
