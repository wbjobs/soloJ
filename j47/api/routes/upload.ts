import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { memoryStorage } from 'multer'
import { parsePLY } from '../services/plyParser.js'
import { parseOBJ } from '../services/objParser.js'

const upload = multer({
  storage: memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

const router = Router()

router.post(
  '/upload',
  upload.single('file'),
  (req: Request, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    const ext = (req.file.originalname ?? '').toLowerCase().split('.').pop()

    try {
      let result

      if (ext === 'ply') {
        result = parsePLY(req.file.buffer)
      } else if (ext === 'obj') {
        result = parseOBJ(req.file.buffer)
      } else {
        res.status(400).json({
          success: false,
          error: 'Unsupported file format. Only .ply and .obj files are accepted.',
        })
        return
      }

      res.json({ success: true, data: result })
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to parse file',
      })
    }
  },
)

export default router
