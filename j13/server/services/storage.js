const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

class StorageService {
  constructor() {
    this.storageDir = process.env.STORAGE_DIR || path.join(__dirname, '..', '..', 'storage');
    this.audioDir = path.join(this.storageDir, 'audio');
    this.modelsDir = path.join(this.storageDir, 'models');
    this._ensureDirs();
  }

  _ensureDirs() {
    [this.storageDir, this.audioDir, this.modelsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  getStoragePath() {
    return this.storageDir;
  }

  getMulterStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const subDir = file.mimetype.startsWith('audio/') ? this.audioDir : this.modelsDir;
        cb(null, subDir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
      }
    });
  }

  saveAudio(buffer, extension = 'webm') {
    const filename = `${uuidv4()}.${extension}`;
    const filepath = path.join(this.audioDir, filename);
    fs.writeFileSync(filepath, buffer);
    return {
      url: `/storage/audio/${filename}`,
      filename,
      filepath
    };
  }

  saveModelFile(buffer, originalName) {
    const ext = path.extname(originalName);
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(this.modelsDir, filename);
    fs.writeFileSync(filepath, buffer);
    return {
      url: `/storage/models/${filename}`,
      filename,
      filepath
    };
  }

  getFileUrl(filename, type = 'audio') {
    return `/storage/${type}/${filename}`;
  }

  deleteFile(filepath) {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }
    return false;
  }
}

module.exports = { storageService: new StorageService() };
