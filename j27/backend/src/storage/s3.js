const AWS = require('aws-sdk');
const config = require('../config');

class S3Storage {
  constructor() {
    this.s3 = new AWS.S3({
      endpoint: config.s3.endpoint,
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
    this.bucket = config.s3.bucket;
  }

  async ensureBucket() {
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise();
    } catch (error) {
      if (error.statusCode === 404) {
        await this.s3.createBucket({ Bucket: this.bucket }).promise();
      } else {
        throw error;
      }
    }
  }

  async upload(key, data, contentType = 'application/octet-stream') {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    };
    return this.s3.putObject(params).promise();
  }

  async uploadStream(key, stream, contentType = 'application/octet-stream') {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: stream,
      ContentType: contentType,
    };
    return this.s3.upload(params, { partSize: 8 * 1024 * 1024, queueSize: 5 }).promise();
  }

  async download(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };
    return this.s3.getObject(params).promise();
  }

  async getDownloadStream(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };
    return this.s3.getObject(params).createReadStream();
  }

  async delete(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };
    return this.s3.deleteObject(params).promise();
  }

  async deleteMultiple(keys) {
    if (keys.length === 0) return;
    const params = {
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map(Key => ({ Key })),
      },
    };
    return this.s3.deleteObjects(params).promise();
  }
}

module.exports = new S3Storage();
