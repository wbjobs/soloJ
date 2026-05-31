const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const axios = require('axios');
require('dotenv').config();

router.get('/', async (req, res) => {
  try {
    const notes = await Note.find().sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: '笔记不存在' });
    }
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  const note = new Note({
    title: req.body.title,
    content: req.body.content,
    folder: req.body.folder,
    tags: req.body.tags || []
  });

  try {
    const newNote = await note.save();
    res.status(201).json(newNote);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: '笔记不存在' });
    }

    const clientVersion = req.body.version;
    if (clientVersion !== undefined && clientVersion !== note.version) {
      return res.status(409).json({
        message: '版本冲突：该笔记已被其他窗口修改',
        serverNote: note,
        clientVersion: clientVersion,
        serverVersion: note.version
      });
    }

    if (req.body.title !== undefined) {
      note.title = req.body.title;
    }
    if (req.body.content !== undefined) {
      note.content = req.body.content;
    }
    if (req.body.folder !== undefined) {
      note.folder = req.body.folder;
    }
    if (req.body.tags !== undefined) {
      note.tags = req.body.tags;
    }
    if (req.body.isSynced !== undefined) {
      note.isSynced = req.body.isSynced;
    }

    const updatedNote = await note.save();
    res.json(updatedNote);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: '笔记不存在' });
    }

    await Note.findByIdAndDelete(req.params.id);
    res.json({ message: '笔记已删除' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const unsyncedNotes = await Note.find({ isSynced: false });
    
    const syncResults = [];
    for (const note of unsyncedNotes) {
      try {
        const response = await axios.post(process.env.CLOUD_SYNC_URL, {
          title: note.title,
          content: note.content,
          folder: note.folder,
          tags: note.tags,
          localId: note._id
        });

        note.isSynced = true;
        note.cloudId = response.data.id || `cloud_${note._id}`;
        await note.save();
        syncResults.push({ id: note._id, status: 'synced' });
      } catch (syncErr) {
        syncResults.push({ id: note._id, status: 'failed', error: syncErr.message });
      }
    }

    res.json({
      message: `同步完成，成功 ${syncResults.filter(r => r.status === 'synced').length} 条，失败 ${syncResults.filter(r => r.status === 'failed').length} 条`,
      results: syncResults
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/folders/list', async (req, res) => {
  try {
    const folders = await Note.distinct('folder');
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
