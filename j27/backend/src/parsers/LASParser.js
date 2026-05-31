const fs = require('fs');
const path = require('path');

const LAS_HEADER_SIZE = 227;
const VLR_HEADER_SIZE = 54;

const POINT_DATA_RECORD_FORMATS = {
  0: { size: 20, hasRGB: false, hasIntensity: true, hasGPS: false },
  1: { size: 28, hasRGB: false, hasIntensity: true, hasGPS: true },
  2: { size: 26, hasRGB: true, hasIntensity: true, hasGPS: false },
  3: { size: 34, hasRGB: true, hasIntensity: true, hasGPS: true },
  4: { size: 57, hasRGB: false, hasIntensity: true, hasGPS: true, hasWaveform: true },
  5: { size: 63, hasRGB: true, hasIntensity: true, hasGPS: true, hasWaveform: true },
  6: { size: 30, hasRGB: false, hasIntensity: true, hasGPS: true, hasScanAngle: true },
  7: { size: 36, hasRGB: true, hasIntensity: true, hasGPS: true, hasScanAngle: true },
  8: { size: 38, hasRGB: true, hasNIR: true, hasIntensity: true, hasGPS: true, hasScanAngle: true },
  9: { size: 37, hasRGB: false, hasIntensity: true, hasGPS: true, hasWaveform: true, hasScanAngle: true },
  10: { size: 43, hasRGB: true, hasIntensity: true, hasGPS: true, hasWaveform: true, hasScanAngle: true },
};

class LASParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.header = null;
    this.pointFormat = null;
    this.pointsRead = 0;
  }

  async parseHeader() {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.alloc(LAS_HEADER_SIZE);
      fs.open(this.filePath, 'r', (err, fd) => {
        if (err) return reject(err);
        fs.read(fd, buffer, 0, LAS_HEADER_SIZE, 0, (err, bytesRead) => {
          if (err) return reject(err);
          if (bytesRead < LAS_HEADER_SIZE) {
            return reject(new Error('Invalid LAS file: header too short'));
          }
          this.header = this._parseHeaderBuffer(buffer);
          this.pointFormat = POINT_DATA_RECORD_FORMATS[this.header.pointDataFormatId];
          if (!this.pointFormat) {
            return reject(new Error(`Unsupported point data format: ${this.header.pointDataFormatId}`));
          }
          fs.close(fd, (err) => {
            if (err) return reject(err);
            resolve(this.header);
          });
        });
      });
    });
  }

  _parseHeaderBuffer(buffer) {
    const signature = buffer.toString('ascii', 0, 4);
    if (signature !== 'LASF') {
      throw new Error('Invalid LAS file signature');
    }

    return {
      signature,
      fileSourceId: buffer.readUInt16LE(4),
      globalEncoding: buffer.readUInt16LE(6),
      projectIdGuidData1: buffer.readUInt32LE(8),
      projectIdGuidData2: buffer.readUInt16LE(12),
      projectIdGuidData3: buffer.readUInt16LE(14),
      projectIdGuidData4: buffer.toString('hex', 16, 24),
      versionMajor: buffer.readUInt8(24),
      versionMinor: buffer.readUInt8(25),
      systemIdentifier: buffer.toString('ascii', 26, 58).trim(),
      generatingSoftware: buffer.toString('ascii', 58, 90).trim(),
      fileCreationDay: buffer.readUInt16LE(90),
      fileCreationYear: buffer.readUInt16LE(92),
      headerSize: buffer.readUInt16LE(94),
      offsetToPointData: buffer.readUInt32LE(96),
      numberOfVariableLengthRecords: buffer.readUInt32LE(100),
      pointDataFormatId: buffer.readUInt8(104),
      pointDataRecordLength: buffer.readUInt16LE(105),
      numberOfPointRecords: buffer.readUInt32LE(107),
      numberOfPointsByReturn: this._readUInt32Array(buffer, 111, 5),
      xScaleFactor: buffer.readDoubleLE(131),
      yScaleFactor: buffer.readDoubleLE(139),
      zScaleFactor: buffer.readDoubleLE(147),
      xOffset: buffer.readDoubleLE(155),
      yOffset: buffer.readDoubleLE(163),
      zOffset: buffer.readDoubleLE(171),
      maxX: buffer.readDoubleLE(179),
      minX: buffer.readDoubleLE(187),
      maxY: buffer.readDoubleLE(195),
      minY: buffer.readDoubleLE(203),
      maxZ: buffer.readDoubleLE(211),
      minZ: buffer.readDoubleLE(219),
    };
  }

  _readUInt32Array(buffer, offset, count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(buffer.readUInt32LE(offset + i * 4));
    }
    return arr;
  }

  getPointCount() {
    return this.header ? this.header.numberOfPointRecords : 0;
  }

  getBounds() {
    if (!this.header) return null;
    return {
      minX: this.header.minX,
      minY: this.header.minY,
      minZ: this.header.minZ,
      maxX: this.header.maxX,
      maxY: this.header.maxY,
      maxZ: this.header.maxZ,
    };
  }

  getAttributes() {
    if (!this.pointFormat) return null;
    return {
      hasRGB: this.pointFormat.hasRGB || false,
      hasIntensity: this.pointFormat.hasIntensity || false,
      hasClassification: true,
      hasGPS: this.pointFormat.hasGPS || false,
    };
  }

  async streamPoints(onPointsBatch, options = {}) {
    const { batchSize = 100000, startIndex = 0, endIndex = null } = options;
    const totalPoints = this.getPointCount();
    const actualEndIndex = endIndex !== null ? Math.min(endIndex, totalPoints) : totalPoints;
    const pointsToRead = actualEndIndex - startIndex;
    const pointSize = this.header.pointDataRecordLength;
    const bytesToRead = pointsToRead * pointSize;
    const startOffset = this.header.offsetToPointData + (startIndex * pointSize);

    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(this.filePath, {
        start: startOffset,
        end: startOffset + bytesToRead - 1,
        highWaterMark: batchSize * pointSize,
      });

      let buffer = Buffer.alloc(0);
      let batch = [];

      readStream.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= pointSize) {
          const pointBuffer = buffer.slice(0, pointSize);
          buffer = buffer.slice(pointSize);

          const point = this._parsePoint(pointBuffer);
          batch.push(point);

          if (batch.length >= batchSize) {
            readStream.pause();
            onPointsBatch(batch, this.pointsRead, pointsToRead)
              .then(() => {
                batch = [];
                readStream.resume();
              })
              .catch(reject);
          }
          this.pointsRead++;
        }
      });

      readStream.on('end', async () => {
        if (batch.length > 0) {
          await onPointsBatch(batch, this.pointsRead, pointsToRead);
        }
        resolve({ totalPoints: this.pointsRead });
      });

      readStream.on('error', reject);
    });
  }

  _parsePoint(buffer) {
    const point = {
      x: buffer.readInt32LE(0) * this.header.xScaleFactor + this.header.xOffset,
      y: buffer.readInt32LE(4) * this.header.yScaleFactor + this.header.yOffset,
      z: buffer.readInt32LE(8) * this.header.zScaleFactor + this.header.zOffset,
      intensity: buffer.readUInt16LE(12),
      returnNumber: buffer.readUInt8(14) & 0x07,
      numberOfReturns: (buffer.readUInt8(14) >> 3) & 0x07,
      scanDirectionFlag: (buffer.readUInt8(14) >> 6) & 0x01,
      edgeOfFlightLine: (buffer.readUInt8(14) >> 7) & 0x01,
      classification: buffer.readUInt8(15),
      scanAngleRank: buffer.readInt8(16),
      userData: buffer.readUInt8(17),
      pointSourceId: buffer.readUInt16LE(18),
    };

    let offset = 20;

    if (this.pointFormat.hasGPS) {
      point.gpsTime = buffer.readDoubleLE(offset);
      offset += 8;
    }

    if (this.pointFormat.hasRGB) {
      point.rgb = {
        r: buffer.readUInt16LE(offset),
        g: buffer.readUInt16LE(offset + 2),
        b: buffer.readUInt16LE(offset + 4),
      };
      offset += 6;
    }

    if (this.pointFormat.hasWaveform) {
      point.waveform = {
        wavePacketDescriptorIndex: buffer.readUInt8(offset),
        byteOffsetToWaveformData: buffer.readBigUInt64LE(offset + 1),
        waveformPacketSizeInBytes: buffer.readUInt32LE(offset + 9),
        returnPointWaveformLocation: buffer.readFloatLE(offset + 13),
        xT: buffer.readFloatLE(offset + 17),
        yT: buffer.readFloatLE(offset + 21),
        zT: buffer.readFloatLE(offset + 25),
      };
    }

    if (this.pointFormat.hasNIR) {
      point.nir = buffer.readUInt16LE(offset);
    }

    return point;
  }

  async readAllPoints(options = {}) {
    const points = [];
    await this.streamPoints(async (batch) => {
      points.push(...batch);
    }, options);
    return points;
  }
}

module.exports = LASParser;
