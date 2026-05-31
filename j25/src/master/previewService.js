const { renderLowResPreview, renderPreview } = require('../raytracer/raytracer');
const { generatePNG } = require('./imageGenerator');
const path = require('path');
const fs = require('fs');
const { ensureDir } = require('../common/utils');

class PreviewService {
  constructor() {
    this.previewTasks = new Map();
  }

  generateLowResPreview(scene, taskId, targetSize = 64) {
    const result = renderLowResPreview(scene, targetSize);
    const previewDir = path.join(__dirname, '../../output', taskId);
    ensureDir(previewDir);
    
    const previewPath = path.join(previewDir, 'preview.png');
    generatePNG(result.previewWidth, result.previewHeight, result.pixels, previewPath);
    
    return {
      path: previewPath,
      width: result.previewWidth,
      height: result.previewHeight,
      url: `/output/${taskId}/preview.png`
    };
  }

  generateAdaptivePreview(scene, taskId, onProgress) {
    return new Promise((resolve, reject) => {
      try {
        const result = renderPreview(scene, (progress) => {
          if (onProgress) onProgress(progress);
        });
        
        const previewDir = path.join(__dirname, '../../output', taskId);
        ensureDir(previewDir);
        
        const previewPath = path.join(previewDir, 'adaptive_preview.png');
        generatePNG(scene.width, scene.height, result.pixels, previewPath);
        
        const sampleMapPath = path.join(previewDir, 'sample_map.png');
        this.generateSampleHeatmap(result.pixels, scene.width, scene.height, sampleMapPath);
        
        resolve({
          path: previewPath,
          sampleMapPath,
          width: scene.width,
          height: scene.height,
          totalSamples: result.totalSamples,
          renderTimeMs: result.renderTimeMs,
          url: `/output/${taskId}/adaptive_preview.png`,
          sampleMapUrl: `/output/${taskId}/sample_map.png`,
          pixels: result.pixels
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  generateSampleHeatmap(pixels, width, height, outputPath) {
    const { PNG } = require('pngjs');
    const png = new PNG({ width, height });
    const maxSamples = Math.max(...pixels.map(p => p.samples));
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = pixels.find(p => p.x === x && p.y === y);
        const idx = (png.width * y + x) << 2;
        
        if (pixel) {
          const ratio = Math.min(1, pixel.samples / 8);
          png.data[idx] = Math.round(ratio * 255);
          png.data[idx + 1] = Math.round((1 - ratio) * 150);
          png.data[idx + 2] = 100;
          png.data[idx + 3] = 255;
        } else {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 255;
        }
      }
    }

    fs.writeFileSync(outputPath, PNG.sync.write(png));
    return outputPath;
  }
}

module.exports = PreviewService;
