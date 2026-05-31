import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './init.js';
import { LogStore } from '../services/logStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | null = null;
let logStore: LogStore | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(__dirname, '../../logs.db');
    db = initDatabase(dbPath);
  }
  return db;
}

export function getLogStore(): LogStore {
  if (!logStore) {
    logStore = new LogStore(getDb());
  }
  return logStore;
}
