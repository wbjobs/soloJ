const Router = require('@koa/router')

function createServer(app, storage, port) {
  const router = new Router()

  function buildBaseUrl(repo, oid) {
    const encodedRepo = encodeURIComponent(repo)
    return `http://0.0.0.0:${port}/${encodedRepo}/.git/info/lfs/objects/${oid}`
  }

  function buildSimpleUrl(oid) {
    return `http://0.0.0.0:${port}/objects/${oid}`
  }

  router.post('/:repo+.git/info/lfs/objects/batch', handleBatch)
  router.post('/objects/batch', handleBatch)

  async function handleBatch(ctx) {
    const body = ctx.request.body
    const { operation, objects, transfers } = body

    if (!operation || !objects || !Array.isArray(objects)) {
      ctx.status = 422
      ctx.body = { message: 'Invalid batch request' }
      return
    }

    const repoParam = ctx.params.repo || ''
    const repo = repoParam.replace(/\/$/, '')

    if (operation === 'upload') {
      const check = storage.checkStorageAvailableForBatch(objects)
      if (!check.ok) {
        ctx.status = 413
        ctx.set('Content-Type', 'application/vnd.git-lfs+json')
        ctx.body = {
          message: 'Storage limit exceeded',
          exceeded_oids: check.exceeded,
          max_storage_bytes: storage.getMaxStorageBytes(),
          current_storage_bytes: storage.totalUniqueSize()
        }
        return
      }
    }

    const transfer = (transfers && transfers.includes('basic')) ? 'basic' : 'basic'
    const response = { transfer, objects: [] }

    for (const obj of objects) {
      const { oid, size } = obj
      const item = { oid, size, actions: {} }

      if (operation === 'upload') {
        if (storage.objectExists(oid) && storage.verifyObject(oid, size)) {
          storage.incrementRefCount(oid, obj.path || null)
          item.actions = {}
        } else {
          let uploadId
          try {
            uploadId = storage.createUpload(oid, size, obj.path || null)
          } catch (e) {
            if (e.code === 'STORAGE_LIMIT') {
              item.error = {
                code: 413,
                message: `Storage limit exceeded: ${e.currentBytes}/${e.maxBytes} bytes`
              }
              response.objects.push(item)
              continue
            }
            throw e
          }

          const uploadUrl = repo
            ? `${buildBaseUrl(repo, oid)}/upload?upload_id=${uploadId}`
            : `${buildSimpleUrl(oid)}/upload?upload_id=${uploadId}`
          const verifyUrl = repo
            ? `${buildBaseUrl(repo, oid)}/verify`
            : `${buildSimpleUrl(oid)}/verify`

          item.actions.upload = {
            href: uploadUrl,
            header: {
              'Content-Type': 'application/octet-stream',
              'Upload-ID': uploadId
            },
            expires_in: 86400
          }
          item.actions.verify = {
            href: verifyUrl,
            header: { 'Content-Type': 'application/json' },
            expires_in: 86400
          }
        }
      } else if (operation === 'download') {
        if (storage.objectExists(oid)) {
          const downloadUrl = repo
            ? `${buildBaseUrl(repo, oid)}/download`
            : `${buildSimpleUrl(oid)}/download`
          item.actions.download = {
            href: downloadUrl,
            header: {},
            expires_in: 86400
          }
        } else {
          item.error = {
            code: 404,
            message: 'Object not found'
          }
        }
      }

      response.objects.push(item)
    }

    ctx.set('Content-Type', 'application/vnd.git-lfs+json')
    ctx.body = response
  }

  router.put('/:repo+.git/info/lfs/objects/:oid/upload', handleUpload)
  router.put('/objects/:oid/upload', handleUpload)
  router.patch('/:repo+.git/info/lfs/objects/:oid/upload', handleUploadResume)
  router.patch('/objects/:oid/upload', handleUploadResume)

  async function handleUpload(ctx) {
    const { oid } = ctx.params
    const uploadId = ctx.query.upload_id

    if (!uploadId) {
      ctx.status = 400
      ctx.body = { message: 'Missing upload_id' }
      return
    }

    const upload = storage.getUpload(uploadId)
    if (!upload || upload.oid !== oid) {
      ctx.status = 404
      ctx.body = { message: 'Upload session not found' }
      return
    }

    const data = ctx.request.rawBody || Buffer.alloc(0)
    if (data.length === 0) {
      ctx.status = 400
      ctx.body = { message: 'Empty body' }
      return
    }

    storage.appendUpload(uploadId, data)
    const totalWritten = upload.uploaded_bytes + data.length

    if (totalWritten >= upload.size) {
      try {
        await storage.completeUpload(uploadId)
        ctx.status = 200
        ctx.body = { message: 'Upload complete', oid }
      } catch (e) {
        ctx.status = 422
        ctx.body = { message: e.message }
      }
    } else {
      ctx.status = 202
      ctx.body = {
        message: 'Partial upload accepted',
        oid,
        uploaded_bytes: totalWritten,
        total_size: upload.size
      }
    }
  }

  async function handleUploadResume(ctx) {
    const { oid } = ctx.params
    const uploadId = ctx.query.upload_id
    const contentRange = ctx.headers['content-range']

    if (!uploadId) {
      ctx.status = 400
      ctx.body = { message: 'Missing upload_id' }
      return
    }

    const upload = storage.getUpload(uploadId)
    if (!upload || upload.oid !== oid) {
      ctx.status = 404
      ctx.body = { message: 'Upload session not found' }
      return
    }

    let startByte = 0
    if (contentRange) {
      const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/)
      if (match) {
        startByte = parseInt(match[1], 10)
      }
    }

    const data = ctx.request.rawBody || Buffer.alloc(0)
    const currentUploaded = upload.uploaded_bytes

    if (startByte !== currentUploaded) {
      ctx.status = 409
      ctx.body = {
        message: 'Range mismatch',
        expected_start: currentUploaded,
        uploaded_bytes: currentUploaded
      }
      return
    }

    storage.appendUpload(uploadId, data)
    const totalWritten = currentUploaded + data.length

    if (totalWritten >= upload.size) {
      try {
        await storage.completeUpload(uploadId)
        ctx.status = 200
        ctx.body = { message: 'Upload complete', oid }
      } catch (e) {
        ctx.status = 422
        ctx.body = { message: e.message }
      }
    } else {
      ctx.status = 202
      ctx.body = {
        message: 'Partial upload accepted',
        oid,
        uploaded_bytes: totalWritten,
        total_size: upload.size
      }
    }
  }

  router.post('/:repo+.git/info/lfs/objects/:oid/verify', handleVerify)
  router.post('/objects/:oid/verify', handleVerify)

  async function handleVerify(ctx) {
    const { oid } = ctx.params
    const body = ctx.request.body

    if (!body || body.oid !== oid) {
      ctx.status = 422
      ctx.body = { message: 'Invalid verify request' }
      return
    }

    if (storage.objectExists(oid) && storage.verifyObject(oid, body.size)) {
      ctx.status = 200
      ctx.body = { message: 'Verified' }
    } else {
      ctx.status = 404
      ctx.body = { message: 'Object not found or size mismatch' }
    }
  }

  router.get('/:repo+.git/info/lfs/objects/:oid/download', handleDownload)
  router.get('/objects/:oid/download', handleDownload)

  async function handleDownload(ctx) {
    const { oid } = ctx.params

    if (!storage.objectExists(oid)) {
      ctx.status = 404
      ctx.body = { message: 'Object not found' }
      return
    }

    const size = storage.getObjectSizeOnDisk(oid)
    const range = ctx.headers['range']

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : size - 1

        if (start >= size || end >= size) {
          ctx.status = 416
          ctx.set('Content-Range', `bytes */${size}`)
          ctx.body = { message: 'Range not satisfiable' }
          return
        }

        const stream = storage.getObjectReadStream(oid)
        stream.start = start
        stream.end = end

        ctx.status = 206
        ctx.set('Content-Range', `bytes ${start}-${end}/${size}`)
        ctx.set('Content-Length', end - start + 1)
        ctx.set('Content-Type', 'application/octet-stream')
        ctx.body = stream
        return
      }
    }

    ctx.set('Content-Length', size)
    ctx.set('Content-Type', 'application/octet-stream')
    ctx.body = storage.getObjectReadStream(oid)
  }

  router.get('/api/files', handleListFiles)
  async function handleListFiles(ctx) {
    const page = parseInt(ctx.query.page || '1', 10)
    const limit = parseInt(ctx.query.limit || '50', 10)
    const offset = (page - 1) * limit
    const files = storage.listObjects(offset, limit)
    ctx.body = { files, page, limit, total: storage.countObjects() }
  }

  router.delete('/api/files/:oid', handleDeleteFile)
  async function handleDeleteFile(ctx) {
    const { oid } = ctx.params
    storage.deleteObject(oid)
    ctx.body = { message: 'Deleted', oid }
  }

  router.get('/api/stats', handleStats)
  async function handleStats(ctx) {
    ctx.body = storage.getStats()
  }

  router.get('/api/config', handleGetConfig)
  async function handleGetConfig(ctx) {
    ctx.body = {
      port: port,
      dataDir: storage.dataDir,
      maxStorageGB: parseFloat(storage.getConfig('maxStorageGB', '0'))
    }
  }

  router.put('/api/config', handleUpdateConfig)
  async function handleUpdateConfig(ctx) {
    const body = ctx.request.body
    if (typeof body.maxStorageGB === 'number') {
      storage.setMaxStorageGB(body.maxStorageGB)
    }
    ctx.body = {
      message: 'Config updated',
      maxStorageGB: parseFloat(storage.getConfig('maxStorageGB', '0'))
    }
  }

  app.use(router.routes())
  app.use(router.allowedMethods())
}

module.exports = { createServer }
