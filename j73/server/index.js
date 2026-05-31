const Koa = require('koa')
const cors = require('@koa/cors')
const { koaBody } = require('koa-body')
const path = require('path')
const { createServer } = require('./routes')
const { StorageManager } = require('./storage')

const DEFAULT_PORT = 3200
const DEFAULT_DATA_DIR = path.join(process.cwd(), 'lfs-data')

class LFSServer {
  constructor(options = {}) {
    this.port = options.port || DEFAULT_PORT
    this.dataDir = options.dataDir || DEFAULT_DATA_DIR
    this.storage = new StorageManager(this.dataDir)
    this.app = new Koa()
    this.server = null
    this._setupMiddleware()
    this._setupRoutes()
  }

  _setupMiddleware() {
    this.app.use(cors())
    this.app.use(async (ctx, next) => {
      try {
        ctx.path = decodeURIComponent(ctx.path)
      } catch {}
      await next()
    })
    this.app.use(async (ctx, next) => {
      if (
        ctx.request.type === 'application/octet-stream' &&
        (ctx.method === 'PUT' || ctx.method === 'PATCH')
      ) {
        const chunks = []
        for await (const chunk of ctx.req) {
          chunks.push(chunk)
        }
        ctx.request.rawBody = Buffer.concat(chunks)
        await next()
        return
      }
      await next()
    })
    this.app.use(koaBody({
      jsonLimit: '10mb',
      textLimit: '10mb',
      formidable: {
        maxFileSize: 10 * 1024 * 1024 * 1024
      }
    }))
  }

  _setupRoutes() {
    createServer(this.app, this.storage, this.port)
  }

  start() {
    return new Promise((resolve, reject) => {
      this.storage.init()
      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`Git LFS Server running on http://0.0.0.0:${this.port}`)
        resolve(this.port)
      })
      this.server.on('error', reject)
    })
  }

  stop() {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }

  getPort() {
    return this.port
  }
}

module.exports = { LFSServer }

if (require.main === module) {
  const server = new LFSServer()
  server.start().catch(console.error)
}
