import express, { type Request, type Response } from 'express'
import { calculateVisibleTiles, DEFAULT_VIEW_RADIUS } from '../utils/visibility.js'
import type { VisibilityResponse } from '../../shared/types.js'

const router = express.Router()

router.post('/', (req: Request, res: Response): void => {
  try {
    const { map, playerX, playerY, viewRadius } = req.body

    if (!map || !Array.isArray(map)) {
      res.status(400).json({
        success: false,
        error: 'Map is required and must be a 2D array',
      })
      return
    }

    if (typeof playerX !== 'number' || typeof playerY !== 'number') {
      res.status(400).json({
        success: false,
        error: 'playerX and playerY are required numbers',
      })
      return
    }

    const radius = viewRadius ?? DEFAULT_VIEW_RADIUS
    const visibleTiles = calculateVisibleTiles(map, playerX, playerY, radius)

    const response: VisibilityResponse = {
      visibleTiles,
      viewRadius: radius,
    }

    res.status(200).json(response)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to calculate visibility',
    })
  }
})

export default router
