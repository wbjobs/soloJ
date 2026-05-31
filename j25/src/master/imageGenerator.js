const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');
const { ensureDir } = require('../common/utils');

function generatePNG(width, height, pixelData, outputPath) {
  const png = new PNG({ width, height });
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = pixelData.find(p => p.x === x && p.y === y);
      const idx = (png.width * y + x) << 2;
      
      if (pixel) {
        png.data[idx] = pixel.r;
        png.data[idx + 1] = pixel.g;
        png.data[idx + 2] = pixel.b;
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 255;
      }
    }
  }

  ensureDir(path.dirname(outputPath));
  
  return new Promise((resolve, reject) => {
    png.pack()
      .pipe(fs.createWriteStream(outputPath))
      .on('finish', () => resolve(outputPath))
      .on('error', reject);
  });
}

function generateStatsJSON(taskStats, outputPath) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(taskStats, null, 2));
  return outputPath;
}

module.exports = { generatePNG, generateStatsJSON };
