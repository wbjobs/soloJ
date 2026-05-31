const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = (upload, UPLOAD_DIR) => {
  const router = express.Router();
  const userImages = new Map();

  router.post('/upload', upload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const username = req.user.username;
      if (!userImages.has(username)) {
        userImages.set(username, []);
      }

      const imageData = {
        id: req.file.filename,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        uploadTime: new Date().toISOString(),
        url: `/uploads/${req.file.filename}`
      };

      userImages.get(username).push(imageData);

      res.json({
        message: 'Image uploaded successfully',
        image: imageData
      });
    } catch (error) {
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  router.post('/save-stego', upload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No stego image file provided' });
      }

      const username = req.user.username;
      if (!userImages.has(username)) {
        userImages.set(username, []);
      }

      const imageData = {
        id: req.file.filename,
        originalName: req.body.originalName || 'stego-image.png',
        filename: req.file.filename,
        size: req.file.size,
        uploadTime: new Date().toISOString(),
        url: `/uploads/${req.file.filename}`,
        isStego: true,
        messageLength: parseInt(req.body.messageLength) || 0
      };

      userImages.get(username).push(imageData);

      res.json({
        message: 'Stego image saved successfully',
        image: imageData
      });
    } catch (error) {
      console.error('Save stego error:', error);
      res.status(500).json({ error: 'Failed to save stego image' });
    }
  });

  router.get('/', (req, res) => {
    try {
      const username = req.user.username;
      const images = userImages.get(username) || [];
      
      res.json({ images });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get images' });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const username = req.user.username;
      const imageId = req.params.id;
      const images = userImages.get(username) || [];
      const image = images.find(img => img.id === imageId);

      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }

      res.json({ image });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get image' });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const username = req.user.username;
      const imageId = req.params.id;
      const images = userImages.get(username) || [];
      const imageIndex = images.findIndex(img => img.id === imageId);

      if (imageIndex === -1) {
        return res.status(404).json({ error: 'Image not found' });
      }

      const image = images[imageIndex];
      const filePath = path.join(UPLOAD_DIR, image.filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      images.splice(imageIndex, 1);
      
      res.json({ message: 'Image deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete image' });
    }
  });

  return router;
};
