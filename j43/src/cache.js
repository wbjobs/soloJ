const Database = require('better-sqlite3');
const path = require('path');

class PackageCache {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this._init();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS packages (
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        data TEXT NOT NULL,
        tarball BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (name, version)
      );

      CREATE TABLE IF NOT EXISTS metadata (
        name TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(name);
    `);
  }

  getMetadata(name) {
    const row = this.db.prepare('SELECT data FROM metadata WHERE name = ?').get(name);
    return row ? JSON.parse(row.data) : null;
  }

  saveMetadata(name, data) {
    this.db.prepare(`
      INSERT INTO metadata (name, data, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `).run(name, JSON.stringify(data));
  }

  getPackage(name, version) {
    const row = this.db.prepare(
      'SELECT data FROM packages WHERE name = ? AND version = ?'
    ).get(name, version);
    return row ? JSON.parse(row.data) : null;
  }

  savePackage(name, version, data) {
    this.db.prepare(`
      INSERT INTO packages (name, version, data, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name, version) DO UPDATE SET
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `).run(name, version, JSON.stringify(data));
  }

  saveTarball(name, version, buffer) {
    this.db.prepare(`
      INSERT INTO packages (name, version, tarball, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name, version) DO UPDATE SET
        tarball = excluded.tarball,
        updated_at = CURRENT_TIMESTAMP
    `).run(name, version, buffer);
  }

  getTarball(name, version) {
    const row = this.db.prepare(
      'SELECT tarball FROM packages WHERE name = ? AND version = ?'
    ).get(name, version);
    return row ? row.tarball : null;
  }

  hasPackage(name, version) {
    const row = this.db.prepare(
      'SELECT 1 FROM packages WHERE name = ? AND version = ?'
    ).get(name, version);
    return !!row;
  }

  getCachedVersions(name) {
    const rows = this.db.prepare(
      'SELECT version FROM packages WHERE name = ? ORDER BY updated_at DESC'
    ).all(name);
    return rows.map(r => r.version);
  }

  close() {
    this.db.close();
  }
}

let cacheInstance = null;

function getCache(dbPath) {
  if (!cacheInstance) {
    cacheInstance = new PackageCache(dbPath);
  }
  return cacheInstance;
}

module.exports = {
  PackageCache,
  getCache
};
