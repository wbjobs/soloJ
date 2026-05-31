import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs';
import path from 'path';
import { NoteDatabase } from './database';
import { parseMarkdownFile } from './parser';

export class VaultWatcher {
  private watcher: FSWatcher | null = null;
  private db: NoteDatabase;
  private vaultPath: string;
  private onChangeCallback: (() => void) | null = null;

  constructor(db: NoteDatabase, vaultPath: string) {
    this.db = db;
    this.vaultPath = vaultPath;
  }

  onChange(callback: () => void): void {
    this.onChangeCallback = callback;
  }

  async start(): Promise<void> {
    await this.initialScan();

    this.watcher = chokidar.watch(path.join(this.vaultPath, '**/*.md'), {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => this.handleFile(filePath));
    this.watcher.on('change', (filePath) => this.handleFile(filePath));
    this.watcher.on('unlink', (filePath) => this.handleDelete(filePath));
  }

  private async initialScan(): Promise<void> {
    const mdFiles = this.walkDir(this.vaultPath);
    for (const filePath of mdFiles) {
      this.handleFile(filePath);
    }
  }

  private walkDir(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.walkDir(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private handleFile(filePath: string): void {
    try {
      const parsed = parseMarkdownFile(filePath);
      const relativePath = path.relative(this.vaultPath, filePath);
      this.db.upsertNote(relativePath, parsed.title, parsed.content, parsed.linkTargets);
      this.notifyChange();
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err);
    }
  }

  private handleDelete(filePath: string): void {
    const relativePath = path.relative(this.vaultPath, filePath);
    this.db.deleteNote(relativePath);
    this.notifyChange();
  }

  private notifyChange(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
