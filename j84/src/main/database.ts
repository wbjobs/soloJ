import Database from 'better-sqlite3';
import path from 'path';
import { fuzzyMatch, extractSnippet } from './search';
import { NoteSearchResult } from '../shared/types';

export class NoteDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        file_path TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        target_title TEXT NOT NULL,
        FOREIGN KEY (source_id) REFERENCES notes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);
      CREATE INDEX IF NOT EXISTS idx_notes_file_path ON notes(file_path);
      CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);
      CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_title);
    `);
  }

  upsertNote(filePath: string, title: string, content: string, linkTargets: string[]): void {
    const existing = this.db.prepare('SELECT id FROM notes WHERE file_path = ?').get(filePath) as { id: number } | undefined;

    const upsert = this.db.transaction(() => {
      let noteId: number;

      if (existing) {
        this.db.prepare(
          'UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(title, content, existing.id);
        noteId = existing.id;
        this.db.prepare('DELETE FROM links WHERE source_id = ?').run(noteId);
      } else {
        const result = this.db.prepare(
          'INSERT INTO notes (title, file_path, content) VALUES (?, ?, ?)'
        ).run(title, filePath, content);
        noteId = result.lastInsertRowid as number;
      }

      const insertLink = this.db.prepare('INSERT INTO links (source_id, target_title) VALUES (?, ?)');
      for (const target of linkTargets) {
        insertLink.run(noteId, target);
      }
    });

    upsert();
  }

  deleteNote(filePath: string): void {
    this.db.prepare('DELETE FROM notes WHERE file_path = ?').run(filePath);
  }

  getNoteByTitle(title: string): { id: number; title: string; file_path: string; content: string } | undefined {
    return this.db.prepare('SELECT * FROM notes WHERE title = ?').get(title) as any;
  }

  getNoteByPath(filePath: string): { id: number; title: string; file_path: string; content: string } | undefined {
    return this.db.prepare('SELECT * FROM notes WHERE file_path = ?').get(filePath) as any;
  }

  getAllNotes(): { id: number; title: string; file_path: string; updated_at: string }[] {
    return this.db.prepare('SELECT id, title, file_path, updated_at FROM notes ORDER BY updated_at DESC').all() as any[];
  }

  getBacklinks(title: string): { id: number; title: string; file_path: string }[] {
    return this.db.prepare(`
      SELECT n.id, n.title, n.file_path
      FROM notes n
      INNER JOIN links l ON l.source_id = n.id
      WHERE l.target_title = ?
    `).all(title) as any[];
  }

  getOutlinks(noteId: number): { target_title: string }[] {
    return this.db.prepare('SELECT target_title FROM links WHERE source_id = ?').all(noteId) as any[];
  }

  getGraphData(): { nodes: { id: string; title: string }[]; edges: { source: string; target: string }[] } {
    const nodes = this.db.prepare('SELECT title AS id, title FROM notes').all() as { id: string; title: string }[];
    const edges = this.db.prepare(`
      SELECT n.title AS source, l.target_title AS target
      FROM links l
      INNER JOIN notes n ON l.source_id = n.id
    `).all() as { source: string; target: string }[];

    return { nodes, edges };
  }

  searchNotes(query: string): NoteSearchResult[] {
    const allNotes = this.db.prepare(
      'SELECT id, title, file_path, content, updated_at FROM notes'
    ).all() as { id: number; title: string; file_path: string; content: string; updated_at: string }[];

    const results: NoteSearchResult[] = [];
    const trimmedQuery = query.trim();

    for (const note of allNotes) {
      const titleMatch = fuzzyMatch(trimmedQuery, note.title);
      const contentMatch = fuzzyMatch(trimmedQuery, note.content);

      let matched = false;
      let finalScore = 0;
      let matchedIn: 'title' | 'content' | 'both' = 'content';

      if (titleMatch.matched) {
        matched = true;
        finalScore += titleMatch.score * 2.5;
        matchedIn = 'title';
      }
      if (contentMatch.matched) {
        matched = true;
        finalScore += contentMatch.score;
        matchedIn = titleMatch.matched ? 'both' : 'content';
      }

      if (matched && finalScore > 0) {
        const snippet = extractSnippet(note.content, trimmedQuery, 120);
        results.push({
          id: note.id,
          title: note.title,
          file_path: note.file_path,
          updated_at: note.updated_at,
          snippet,
          score: Math.round(finalScore * 100) / 100,
          matched_in: matchedIn,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 50);
  }

  close(): void {
    this.db.close();
  }
}
