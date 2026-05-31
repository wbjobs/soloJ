const fs = require('fs');
const path = require('path');

function writeString(buffer, offset, str, length) {
  for (let i = 0; i < length; i++) {
    buffer[offset + i] = i < str.length ? str.charCodeAt(i) : 0;
  }
}

function generateLASFile(filePath, pointCount, options = {}) {
  const {
    hasRGB = true,
    hasIntensity = true,
    bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100, minZ: 0, maxZ: 100 },
  } = options;

  const pointFormat = hasRGB ? 2 : 0;
  const pointSize = hasRGB ? 26 : 20;
  const headerSize = 227;
  const totalSize = headerSize + pointCount * pointSize;

  const buffer = Buffer.alloc(totalSize);

  buffer.write('LASF', 0, 4, 'ascii');

  buffer.writeUInt16LE(0, 4);
  buffer.writeUInt16LE(0, 6);

  buffer.writeUInt32LE(0, 8);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt16LE(0, 14);
  writeString(buffer, 16, '00000000-0000-0000-0000-000000000000', 8);

  buffer.writeUInt8(1, 24);
  buffer.writeUInt8(4, 25);

  writeString(buffer, 26, 'GENERATOR', 32);
  writeString(buffer, 58, 'Test Data Generator', 32);

  buffer.writeUInt16LE(1, 90);
  buffer.writeUInt16LE(2024, 92);

  buffer.writeUInt16LE(headerSize, 94);
  buffer.writeUInt32LE(headerSize, 96);
  buffer.writeUInt32LE(0, 100);

  buffer.writeUInt8(pointFormat, 104);
  buffer.writeUInt16LE(pointSize, 105);
  buffer.writeUInt32LE(pointCount, 107);

  for (let i = 0; i < 5; i++) {
    buffer.writeUInt32LE(0, 111 + i * 4);
  }

  const scaleFactor = 0.001;
  buffer.writeDoubleLE(scaleFactor, 131);
  buffer.writeDoubleLE(scaleFactor, 139);
  buffer.writeDoubleLE(scaleFactor, 147);

  buffer.writeDoubleLE(0, 155);
  buffer.writeDoubleLE(0, 163);
  buffer.writeDoubleLE(0, 171);

  buffer.writeDoubleLE(bounds.maxX, 179);
  buffer.writeDoubleLE(bounds.minX, 187);
  buffer.writeDoubleLE(bounds.maxY, 195);
  buffer.writeDoubleLE(bounds.minY, 203);
  buffer.writeDoubleLE(bounds.maxZ, 211);
  buffer.writeDoubleLE(bounds.minZ, 219);

  let offset = headerSize;
  for (let i = 0; i < pointCount; i++) {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

    buffer.writeInt32LE(Math.round(x / scaleFactor), offset);
    buffer.writeInt32LE(Math.round(y / scaleFactor), offset + 4);
    buffer.writeInt32LE(Math.round(z / scaleFactor), offset + 8);

    if (hasIntensity) {
      buffer.writeUInt16LE(Math.floor(Math.random() * 65536), offset + 12);
    } else {
      buffer.writeUInt16LE(0, offset + 12);
    }

    buffer.writeUInt8(0, offset + 14);
    buffer.writeUInt8(0, offset + 15);
    buffer.writeInt8(0, offset + 16);
    buffer.writeUInt8(0, offset + 17);
    buffer.writeUInt16LE(0, offset + 18);

    if (hasRGB) {
      buffer.writeUInt16LE(Math.floor(Math.random() * 65536), offset + 20);
      buffer.writeUInt16LE(Math.floor(Math.random() * 65536), offset + 22);
      buffer.writeUInt16LE(Math.floor(Math.random() * 65536), offset + 24);
    }

    offset += pointSize;
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`Generated ${filePath} with ${pointCount.toLocaleString()} points`);
  console.log(`File size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  return {
    filePath,
    pointCount,
    fileSize: totalSize,
    bounds,
    hasRGB,
    hasIntensity,
  };
}

const args = process.argv.slice(2);
const outputPath = args[0] || path.join(__dirname, '..', 'test_data.las');
const pointCount = parseInt(args[1]) || 100000;

generateLASFile(outputPath, pointCount, {
  hasRGB: true,
  hasIntensity: true,
  bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000, minZ: 0, maxZ: 1000 },
});

module.exports = { generateLASFile };
