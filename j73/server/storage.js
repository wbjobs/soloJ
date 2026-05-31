const path = require('path')
const fs = require('fs')
const os = require('os')
const Database = require('better-sqlite3')
const crypto = require('crypto')

const DEFAULT_MAX_STORAGE_GB = 0

class StorageManager {
  constructor(dataDir) {
    this.dataDir = dataDir
    this.objectsDir = path.join(dataDir, 'objects')
    this.tempDir = path.join(dataDir, 'temp')
    this.dbPath = path.join(dataDir, 'metadata.db')
    this.db = null
  }

  init() {
    fs.mkdirSync(this.objectsDir, { recursive: true })
    fs.mkdirSync(this.tempDir, { recursive: true })
    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this._createTables()
    this._migrateTables()
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS objects (
        oid TEXT PRIMARY KEY,
        size INTEGER NOT NULL,
        filename TEXT,
        uploaded_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'complete',
        ref_count INTEGER NOT NULL DEFAULT 1
      )
    `)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        oid TEXT NOT NULL,
        size INTEGER NOT NULL,
        filename TEXT,
        uploaded_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
  }

  _migrateTables() {
    const cols = this.db.prepare("PRAGMA table_info(objects)").all()
    const hasRefCount = cols.some(c => c.name === 'ref_count')
    if (!hasRefCount) {
      this.db.exec('ALTER TABLE objects ADD COLUMN ref_count INTEGER NOT NULL DEFAULT 1')
    }
  }

  objectPath(oid) {
    const prefix = oid.substring(0, 2)
    const suffix = oid.substring(2)
    const dir = path.join(this.objectsDir, prefix)
    fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, suffix)
  }

  tempPath(id) {
    return path.join(this.tempDir, id)
  }

  objectExists(oid) {
    const filePath = this.objectPath(oid)
    return fs.existsSync(filePath)
  }

  getObjectSize(oid) {
    const row = this.db.prepare('SELECT size FROM objects WHERE oid = ?').get(oid)
    return row ? row.size : 0
  }

  verifyObject(oid, expectedSize) {
    const filePath = this.objectPath(oid)
    if (!fs.existsSync(filePath)) return false
    const stats = fs.statSync(filePath)
    return stats.size === expectedSize
  }

  getConfig(key, defaultValue) {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key)
    if (!row) return defaultValue
    return row.value
  }

  setConfig(key, value) {
    this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value))
  }

  getMaxStorageBytes() {
    const gb = parseFloat(this.getConfig('maxStorageGB', String(DEFAULT_MAX_STORAGE_GB)))
    if (!gb || gb <= 0) return 0
    return gb * 1024 * 1024 * 1024
  }

  setMaxStorageGB(gb) {
    this.setConfig('maxStorageGB', String(gb))
  }

  checkStorageAvailable(incomingSize) {
    const maxBytes = this.getMaxStorageBytes()
    if (maxBytes <= 0) return true
    const currentTotal = this.totalUniqueSize()
    return (currentTotal + incomingSize) <= maxBytes
  }

  checkStorageAvailableForBatch(objects) {
    const maxBytes = this.getMaxStorageBytes()
    if (maxBytes <= 0) return { ok: true, exceeded: [] }

    const currentTotal = this.totalUniqueSize()
    let projectedTotal = currentTotal
    const exceeded = []

    for (const obj of objects) {
      if (this.objectExists(obj.oid)) continue
      projectedTotal += obj.size
      if (projectedTotal > maxBytes) {
        exceeded.push(obj.oid)
      }
    }

    return { ok: exceeded.length === 0, exceeded }
  }

  createUpload(oid, size, filename) {
    if (!this.checkStorageAvailable(size)) {
      const err = new Error('Storage limit exceeded')
      err.code = 'STORAGE_LIMIT'
      err.maxBytes = this.getMaxStorageBytes()
      err.currentBytes = this.totalUniqueSize()
      throw err
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    this.db.prepare(
      'INSERT INTO uploads (id, oid, size, filename, uploaded_bytes, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
    ).run(id, oid, size, filename, now, now)

    const tempFilePath = this.tempPath(id)
    fs.writeFileSync(tempFilePath, '')

    return id
  }

  getUpload(id) {
    return this.db.prepare('SELECT * FROM uploads WHERE id = ?').get(id)
  }

  appendUpload(id, data) {
    const upload = this.getUpload(id)
    if (!upload) throw new Error('Upload not found')

    const tempFilePath = this.tempPath(id)
    fs.appendFileSync(tempFilePath, data)

    const newSize = upload.uploaded_bytes + data.length
    const now = new Date().toISOString()
    this.db.prepare(
      'UPDATE uploads SET uploaded_bytes = ?, updated_at = ? WHERE id = ?'
    ).run(newSize, now, id)

    return newSize
  }

  completeUpload(id) {
    return new Promise((resolve, reject) => {
      const upload = this.getUpload(id)
      if (!upload) {
        reject(new Error('Upload not found'))
        return
      }

      const tempFilePath = this.tempPath(id)
      if (!fs.existsSync(tempFilePath)) {
        reject(new Error('Temp file not found'))
        return
      }

      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(tempFilePath)

      stream.on('data', (chunk) => {
        hash.update(chunk)
      })

      stream.on('end', () => {
        const actualOid = hash.digest('hex')

        if (actualOid !== upload.oid) {
          fs.unlinkSync(tempFilePath)
          reject(new Error(`SHA256 mismatch: expected ${upload.oid}, got ${actualOid}`))
          return
        }

        const existingObject = this.db.prepare('SELECT ref_count FROM objects WHERE oid = ?').get(upload.oid)

        if (existingObject) {
          fs.unlinkSync(tempFilePath)
          this.db.prepare(
            'UPDATE objects SET ref_count = ref_count + 1, filename = ? WHERE oid = ?'
          ).run(upload.filename, upload.oid)
          this.db.prepare('DELETE FROM uploads WHERE id = ?').run(id)
          resolve(upload.oid)
          return
        }

        const destPath = this.objectPath(upload.oid)
        fs.renameSync(tempFilePath, destPath)

        const now = new Date().toISOString()
        this.db.prepare(
          'INSERT INTO objects (oid, size, filename, uploaded_at, status, ref_count) VALUES (?, ?, ?, ?, ?, 1)'
        ).run(upload.oid, upload.size, upload.filename, now, 'complete')

        this.db.prepare('DELETE FROM uploads WHERE id = ?').run(id)

        resolve(upload.oid)
      })

      stream.on('error', (err) => {
        reject(err)
      })
    })
  }

  incrementRefCount(oid, filename) {
    const existing = this.db.prepare('SELECT ref_count FROM objects WHERE oid = ?').get(oid)
    if (existing) {
      this.db.prepare(
        'UPDATE objects SET ref_count = ref_count + 1, filename = ? WHERE oid = ?'
      ).run(filename || null, oid)
      return true
    }
    return false
  }

  deleteObject(oid) {
    const row = this.db.prepare('SELECT ref_count FROM objects WHERE oid = ?').get(oid)
    if (!row) return

    if (row.ref_count > 1) {
      this.db.prepare('UPDATE objects SET ref_count = ref_count - 1 WHERE oid = ?').run(oid)
      return
    }

    const filePath = this.objectPath(oid)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    this.db.prepare('DELETE FROM objects WHERE oid = ?').run(oid)
  }

  listObjects(offset = 0, limit = 100) {
    return this.db.prepare(
      'SELECT * FROM objects ORDER BY uploaded_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset)
  }

  countObjects() {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM objects').get()
    return row.count
  }

  totalSize() {
    const row = this.db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM objects').get()
    return row.total
  }

  totalUniqueSize() {
    const row = this.db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM objects').get()
    return row.total
  }

  totalRefCount() {
    const row = this.db.prepare('SELECT COALESCE(SUM(ref_count), 0) as total FROM objects').get()
    return row.total
  }

  savedByDedup() {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(size * (ref_count - 1)), 0) as saved FROM objects WHERE ref_count > 1'
    ).get()
    return row.saved
  }

  getStats() {
    return {
      fileCount: this.countObjects(),
      totalSize: this.totalSize(),
      totalRefCount: this.totalRefCount(),
      savedByDedup: this.savedByDedup(),
      diskAvailable: this._getDiskSpace(),
      maxStorageGB: parseFloat(this.getConfig('maxStorageGB', String(DEFAULT_MAX_STORAGE_GB))),
      maxStorageBytes: this.getMaxStorageBytes()
    }
  }

  _getDiskSpace() {
    try {
      if (typeof fs.statfsSync === 'function') {
        const stat = fs.statfsSync(this.dataDir)
        return stat.bavail * stat.bsize
      }
      const platform = os.platform()
      if (platform === 'win32') {
        const drive = path.parse(this.dataDir).root
        try {
          const { execSync } = require('child_process')
          const result = execSync(`fsutil volume diskfree "${drive}"`, {
            encoding: 'utf8'
          })
          const match = result.match(/可用字节数\s*:\s*(\d+)/) ||
                        result.match(/Available free bytes\s*:\s*(\d+)/)
          if (match) return parseInt(match[1], 10)
        } catch {}
      }
    } catch {}
    return 0
  }

  getObjectReadStream(oid) {
    const filePath = this.objectPath(oid)
    if (!fs.existsSync(filePath)) return null
    return fs.createReadStream(filePath)
  }

  getObjectSizeOnDisk(oid) {
    const filePath = this.objectPath(oid)
    if (!fs.existsSync(filePath)) return 0
    return fs.statSync(filePath).size
  }
}

module.exports = { StorageManager }
