import Database from 'better-sqlite3';
import type { LogEntry, LogLevel } from '../../shared/types.js';

export class LogStore {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private queryStmt: Database.Statement;
  private countStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = db.prepare(
      'INSERT INTO logs (id, timestamp, service_name, level, message) VALUES (?, ?, ?, ?, ?)'
    );
    this.queryStmt = db.prepare(
      'SELECT id, timestamp, service_name as serviceName, level, message FROM logs WHERE 1=1'
    );
    this.countStmt = db.prepare('SELECT COUNT(*) as count FROM logs WHERE 1=1');
  }

  insert(log: LogEntry): void {
    this.insertStmt.run(
      log.id,
      log.timestamp,
      log.serviceName,
      log.level,
      log.message
    );
  }

  query(params?: {
    serviceName?: string;
    level?: LogLevel;
    limit?: number;
    offset?: number;
  }): { logs: LogEntry[]; total: number } {
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (params?.serviceName) {
      conditions.push('service_name = ?');
      args.push(params.serviceName);
    }
    if (params?.level) {
      conditions.push('level = ?');
      args.push(params.level);
    }

    const whereClause = conditions.length
      ? ' AND ' + conditions.join(' AND ')
      : '';
    const orderBy = ' ORDER BY timestamp DESC';
    const limitClause = params?.limit ? ` LIMIT ${params.limit}` : '';
    const offsetClause = params?.offset ? ` OFFSET ${params.offset}` : '';

    const logs = this.db
      .prepare(this.queryStmt.source + whereClause + orderBy + limitClause + offsetClause)
      .all(...args) as LogEntry[];

    const result = this.db
      .prepare(this.countStmt.source + whereClause)
      .get(...args) as { count: number };

    return { logs, total: result.count };
  }

  getCountByService(): Record<string, number> {
    const rows = this.db
      .prepare(
        'SELECT service_name as serviceName, COUNT(*) as count FROM logs GROUP BY service_name'
      )
      .all() as { serviceName: string; count: number }[];

    return rows.reduce(
      (acc, row) => {
        acc[row.serviceName] = row.count;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}
