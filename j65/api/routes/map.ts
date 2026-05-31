import express, { type Request, type Response } from 'express'
import { generate as generateDrunkard } from '../generators/DrunkardsWalk.js'
import { generate as generateBSP } from '../generators/BSPTree.js'
import type { MapResponse } from '../../shared/types.js'

const router = express.Router()

router.get('/', (req: Request, res: Response): void => {
  const algorithm = (req.query.algorithm as string) || 'bsp'
  const width = parseInt(req.query.width as string, 10) || 50
  const height = parseInt(req.query.height as string, 10) || 50

  if (algorithm !== 'drunkard' && algorithm !== 'bsp') {
    res.status(400).json({
      success: false,
      error: "Invalid algorithm. Must be 'drunkard' or 'bsp'",
    })
    return
  }

  if (width < 30 || width > 100 || height < 30 || height > 100) {
    res.status(400).json({
      success: false,
      error: 'Width and height must be between 30 and 100',
    })
    return
  }

  try {
    let result
    if (algorithm === 'drunkard') {
      result = generateDrunkard(width, height)
    } else {
      result = generateBSP(width, height)
    }

    const response: MapResponse = {
      map: result.map,
      width,
      height,
      algorithm,
      startPosition: result.startPosition,
      chestCount: result.chestCount,
    }

    res.status(200).json(response)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate map',
    })
  }
})

export default router
