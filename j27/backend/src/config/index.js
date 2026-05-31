require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pointcloud'
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'pointcloud-chunks',
    useSSL: process.env.S3_USE_SSL === 'true'
  },
  pointCloud: {
    maxPointsPerChunk: parseInt(process.env.MAX_POINTS_PER_CHUNK) || 65536,
    maxLODLevel: parseInt(process.env.MAX_LOD_LEVEL) || 8,
    memoryLimitGB: parseInt(process.env.MEMORY_LIMIT_GB) || 2
  }
};
