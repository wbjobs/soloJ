const draco3d = require('draco3d');

class DracoCompressor {
  constructor() {
    this.encoderModule = null;
    this.decoderModule = null;
    this.encoder = null;
    this.decoder = null;
  }

  async init() {
    if (this.encoderModule) return;

    this.encoderModule = await draco3d.createEncoderModule({});
    this.decoderModule = await draco3d.createDecoderModule({});
    this.encoder = new this.encoderModule.Encoder();
    this.decoder = new this.decoderModule.Decoder();
  }

  async compressPointCloud(points, options = {}) {
    await this.init();

    const {
      compressionLevel = 7,
      positionQuantizationBits = 11,
      colorQuantizationBits = 8,
      intensityQuantizationBits = 8,
    } = options;

    const pointCloud = new this.encoderModule.PointCloud();
    const numPoints = points.length;

    const positionArray = new Float32Array(numPoints * 3);
    let colorArray = null;
    let intensityArray = null;
    let hasRGB = false;
    let hasIntensity = false;

    for (let i = 0; i < numPoints; i++) {
      const p = points[i];
      positionArray[i * 3] = p.x;
      positionArray[i * 3 + 1] = p.y;
      positionArray[i * 3 + 2] = p.z;

      if (p.rgb && !hasRGB) {
        hasRGB = true;
        colorArray = new Uint8Array(numPoints * 3);
      }
      if (p.intensity !== undefined && !hasIntensity) {
        hasIntensity = true;
        intensityArray = new Float32Array(numPoints);
      }

      if (hasRGB && p.rgb) {
        colorArray[i * 3] = Math.round(p.rgb.r / 256);
        colorArray[i * 3 + 1] = Math.round(p.rgb.g / 256);
        colorArray[i * 3 + 2] = Math.round(p.rgb.b / 256);
      }
      if (hasIntensity && p.intensity !== undefined) {
        intensityArray[i] = p.intensity;
      }
    }

    const positions = new this.encoderModule.DracoFloat32Array();
    for (let i = 0; i < positionArray.length; i++) {
      positions.SetValue(i, positionArray[i]);
    }
    const posId = pointCloud.AddAttribute(
      this.encoderModule.POSITION,
      numPoints,
      positions
    );

    if (hasRGB) {
      const colors = new this.encoderModule.DracoUInt8Array();
      for (let i = 0; i < colorArray.length; i++) {
        colors.SetValue(i, colorArray[i]);
      }
      pointCloud.AddAttribute(
        this.encoderModule.COLOR,
        numPoints,
        colors
      );
    }

    if (hasIntensity) {
      const intensities = new this.encoderModule.DracoFloat32Array();
      for (let i = 0; i < intensityArray.length; i++) {
        intensities.SetValue(i, intensityArray[i]);
      }
      pointCloud.AddAttribute(
        this.encoderModule.SPECULAR,
        numPoints,
        intensities
      );
    }

    this.encoder.SetAttributeQuantization(
      this.encoderModule.POSITION,
      positionQuantizationBits
    );
    if (hasRGB) {
      this.encoder.SetAttributeQuantization(
        this.encoderModule.COLOR,
        colorQuantizationBits
      );
    }

    this.encoder.SetSpeedOptions(10 - compressionLevel, compressionLevel);

    const encodedData = new this.encoderModule.DracoInt8Array();
    const encodedLen = this.encoder.EncodePointCloudToDracoBuffer(
      pointCloud,
      false,
      encodedData
    );

    if (encodedLen <= 0) {
      throw new Error('Failed to compress point cloud');
    }

    const buffer = Buffer.alloc(encodedLen);
    for (let i = 0; i < encodedLen; i++) {
      buffer[i] = encodedData.GetValue(i);
    }

    this.encoderModule.destroy(pointCloud);
    this.encoderModule.destroy(positions);
    this.encoderModule.destroy(encodedData);
    if (hasRGB) this.encoderModule.destroy(colors);
    if (hasIntensity) this.encoderModule.destroy(intensities);

    const originalSize = numPoints * (hasRGB ? 15 : 12);

    return {
      buffer,
      pointCount: numPoints,
      compressedSize: encodedLen,
      originalSize,
      compressionRatio: originalSize / encodedLen,
      hasRGB,
      hasIntensity,
    };
  }

  async decompressPointCloud(buffer) {
    await this.init();

    const dracoBuffer = new this.decoderModule.DecoderBuffer();
    dracoBuffer.Init(new Int8Array(buffer), buffer.length);

    const geometryType = this.decoder.GetEncodedGeometryType(dracoBuffer);
    if (geometryType !== this.decoderModule.POINT_CLOUD) {
      throw new Error('Input buffer is not a point cloud');
    }

    const pointCloud = new this.decoderModule.PointCloud();
    const status = this.decoder.DecodeBufferToPointCloud(dracoBuffer, pointCloud);

    if (!status.ok()) {
      throw new Error(`Failed to decode point cloud: ${status.error_msg()}`);
    }

    const numPoints = pointCloud.num_points();
    const points = [];

    const posAttr = this.decoder.GetAttribute(
      pointCloud,
      this.decoderModule.POSITION
    );
    const colorAttr = this.decoder.GetAttribute(
      pointCloud,
      this.decoderModule.COLOR
    );
    const intensityAttr = this.decoder.GetAttribute(
      pointCloud,
      this.decoderModule.SPECULAR
    );

    const posData = new this.decoderModule.DracoFloat32Array();
    const colorData = colorAttr ? new this.decoderModule.DracoUInt8Array() : null;
    const intensityData = intensityAttr ? new this.decoderModule.DracoFloat32Array() : null;

    this.decoder.GetAttributeFloatForAllPoints(
      pointCloud,
      posAttr,
      posData
    );

    if (colorAttr) {
      this.decoder.GetAttributeUInt8ForAllPoints(
        pointCloud,
        colorAttr,
        colorData
      );
    }

    if (intensityAttr) {
      this.decoder.GetAttributeFloatForAllPoints(
        pointCloud,
        intensityAttr,
        intensityData
      );
    }

    for (let i = 0; i < numPoints; i++) {
      const point = {
        x: posData.GetValue(i * 3),
        y: posData.GetValue(i * 3 + 1),
        z: posData.GetValue(i * 3 + 2),
      };

      if (colorAttr) {
        point.rgb = {
          r: colorData.GetValue(i * 3) * 256,
          g: colorData.GetValue(i * 3 + 1) * 256,
          b: colorData.GetValue(i * 3 + 2) * 256,
        };
      }

      if (intensityAttr) {
        point.intensity = intensityData.GetValue(i);
      }

      points.push(point);
    }

    this.decoderModule.destroy(dracoBuffer);
    this.decoderModule.destroy(pointCloud);
    this.decoderModule.destroy(posData);
    if (colorData) this.decoderModule.destroy(colorData);
    if (intensityData) this.decoderModule.destroy(intensityData);

    return {
      points,
      pointCount: numPoints,
      hasRGB: !!colorAttr,
      hasIntensity: !!intensityAttr,
    };
  }

  async compressPointsToBuffer(points, options = {}) {
    const result = await this.compressPointCloud(points, options);
    return result.buffer;
  }

  async decompressBufferToPoints(buffer) {
    const result = await this.decompressPointCloud(buffer);
    return result.points;
  }
}

const compressor = new DracoCompressor();
module.exports = compressor;
module.exports.DracoCompressor = DracoCompressor;
