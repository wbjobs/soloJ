const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const MAGIC_BYTES = {
    png:  { bytes: [0x89, 0x50, 0x4E, 0x47], label: 'PNG' },
    jpeg: { bytes: [0xFF, 0xD8, 0xFF],        label: 'JPEG' },
    gif:  { bytes: [0x47, 0x49, 0x46],        label: 'GIF' },
    bmp:  { bytes: [0x42, 0x4D],              label: 'BMP' },
    webp: { bytes: [0x52, 0x49, 0x46, 0x46],  label: 'WebP' }
};

function validateImageHeader(buffer) {
    const results = [];
    for (const [key, info] of Object.entries(MAGIC_BYTES)) {
        let match = true;
        for (let i = 0; i < info.bytes.length; i++) {
            if (buffer[i] !== info.bytes[i]) {
                match = false;
                break;
            }
        }
        if (match) {
            results.push({ format: key, label: info.label });
        }
    }
    return results;
}

app.post('/api/validate', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ valid: false, error: '未上传文件' });
    }

    const buffer = req.file.buffer;
    const matches = validateImageHeader(buffer);

    if (matches.length === 0) {
        return res.json({
            valid: false,
            error: '文件头不合法：未检测到有效的图片文件头（PNG/JPEG/GIF/BMP/WebP）',
            originalName: req.file.originalname
        });
    }

    res.json({
        valid: true,
        formats: matches,
        originalName: req.file.originalname,
        size: req.file.size
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'lsb-stego-validator' });
});

app.listen(PORT, () => {
    console.log(`LSB Stego backend running at http://localhost:${PORT}`);
    console.log(`Frontend served at http://localhost:${PORT}`);
    console.log(`Validation endpoint: POST http://localhost:${PORT}/api/validate`);
});
