/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import type { LogLevel } from '../shared/types.js'
import { getLogStore } from './db/singleton.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)

app.get('/api/logs', (req: Request, res: Response) => {
  const logStore = getLogStore()
  const { serviceName, level, limit = '100', offset = '0' } = req.query

  const params: {
    serviceName?: string
    level?: LogLevel
    limit?: number
    offset?: number
  } = {
    limit: parseInt(limit as string, 10),
    offset: parseInt(offset as string, 10),
  }

  if (serviceName) {
    params.serviceName = serviceName as string
  }
  if (level) {
    params.level = level as LogLevel
  }

  const result = logStore.query(params)
  res.json(result)
})

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
