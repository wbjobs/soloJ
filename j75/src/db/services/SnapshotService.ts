import { DocumentManager, documentManager } from '../../crdt';
import { DocumentRepository, documentRepository } from '../repositories/DocumentRepository';
import { config } from '../../config';

export class SnapshotService {
  private docManager: DocumentManager;
  private docRepository: DocumentRepository;
  private intervalId: NodeJS.Timeout | null = null;
  private snapshotInterval: number;
  private isRunning: boolean = false;

  constructor(
    docManager: DocumentManager = documentManager,
    docRepository: DocumentRepository = documentRepository,
    intervalMs: number = config.snapshotIntervalMs
  ) {
    this.docManager = docManager;
    this.docRepository = docRepository;
    this.snapshotInterval = intervalMs;
  }

  start(): void {
    if (this.isRunning) return;

    console.log(`Starting periodic snapshot service (interval: ${this.snapshotInterval}ms)`);
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.takeAllSnapshots().catch((error) => {
        console.error('Error during periodic snapshot:', error);
      });
    }, this.snapshotInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Snapshot service stopped');
  }

  async takeAllSnapshots(): Promise<number> {
    const allMeta = this.docManager.getAllMetadata();
    let snapshotCount = 0;

    for (const meta of allMeta) {
      try {
        await this.takeSnapshot(meta.id);
        snapshotCount++;
      } catch (error) {
        console.error(`Failed to snapshot document ${meta.id}:`, error);
      }
    }

    if (snapshotCount > 0) {
      console.log(`Periodic snapshot complete: ${snapshotCount} documents saved`);
    }

    return snapshotCount;
  }

  async takeSnapshot(docId: string): Promise<void> {
    if (!this.docManager.hasDocument(docId)) {
      throw new Error(`Document ${docId} not found in memory`);
    }

    const docState = this.docManager.getDocumentSnapshot(docId);
    await this.docRepository.saveSnapshot(docState);
    console.log(`Snapshot taken for document: ${docId}`);
  }

  async loadAllDocuments(): Promise<number> {
    const documents = await this.docRepository.listDocuments();
    let loadedCount = 0;

    for (const meta of documents) {
      try {
        const docState = await this.docRepository.getSnapshot(meta.id);
        if (docState && !this.docManager.hasDocument(meta.id)) {
          this.docManager.loadDocument(meta.id, docState.meta, docState.update);
          loadedCount++;
        }
      } catch (error) {
        console.error(`Failed to load document ${meta.id}:`, error);
      }
    }

    console.log(`Loaded ${loadedCount} documents from database into memory`);
    return loadedCount;
  }

  async loadDocument(docId: string): Promise<boolean> {
    if (this.docManager.hasDocument(docId)) {
      return true;
    }

    const docState = await this.docRepository.getSnapshot(docId);
    if (!docState) {
      return false;
    }

    this.docManager.loadDocument(docId, docState.meta, docState.update);
    return true;
  }
}

export const snapshotService = new SnapshotService();
