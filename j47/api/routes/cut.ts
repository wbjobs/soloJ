import { Router, type Request, type Response } from 'express'
import { generatePLY } from '../services/plyGenerator.js'

const router = Router()

interface CutRequest {
  positions: number[]
  colors: number[] | null
  normals: number[] | null
  pointCount: number
  selectedIndices: number[]
  fileName?: string
}

router.post(
  '/cut',
  (req: Request, res: Response): void => {
    try {
      const { positions, colors, normals, pointCount, selectedIndices, fileName } = req.body as CutRequest

      if (!positions || !selectedIndices || selectedIndices.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Missing required data: positions and selectedIndices are required',
        })
        return
      }

      if (selectedIndices.length > pointCount) {
        res.status(400).json({
          success: false,
          error: 'Selected indices count exceeds total point count',
        })
        return
      }

      const plyBuffer = generatePLY(
        {
          positions,
          colors,
          normals,
          pointCount,
        },
        selectedIndices
      )

      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'pointcloud'
      const downloadFileName = `${baseName}_selected_${selectedIndices.length}.ply`

      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`)
      res.setHeader('Content-Length', plyBuffer.length.toString())

      res.status(200).send(plyBuffer)
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to generate PLY file',
      })
    }
  }
)

export default router
