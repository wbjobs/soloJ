import * as Y from 'yjs';

export interface DocumentMeta {
  id: string;
  title: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentState {
  meta: DocumentMeta;
  update: Uint8Array;
}

export type GlobalUpdateHandler = (update: Uint8Array, docId: string, sourceClientId: string | null) => void;

export class DocumentManager {
  private documents: Map<string, Y.Doc> = new Map();
  private metadata: Map<string, DocumentMeta> = new Map();
  private updateListeners: Map<string, (update: Uint8Array, docId: string) => void> = new Map();
  public globalUpdateHandler: GlobalUpdateHandler | null = null;

  createDocument(docId: string, title: string, createdBy: string): DocumentMeta {
    if (this.documents.has(docId)) {
      throw new Error(`Document ${docId} already exists`);
    }

    const doc = new Y.Doc();
    doc.guid = docId;

    const meta: DocumentMeta = {
      id: docId,
      title,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.documents.set(docId, doc);
    this.metadata.set(docId, meta);

    this.setupUpdateListener(docId, doc);

    return meta;
  }

  loadDocument(docId: string, meta: DocumentMeta, snapshot: Uint8Array): void {
    if (this.documents.has(docId)) {
      return;
    }

    const doc = new Y.Doc();
    doc.guid = docId;
    Y.applyUpdate(doc, snapshot, 'load');

    this.documents.set(docId, doc);
    this.metadata.set(docId, meta);

    this.setupUpdateListener(docId, doc);
  }

  getDocument(docId: string): Y.Doc | undefined {
    return this.documents.get(docId);
  }

  getMetadata(docId: string): DocumentMeta | undefined {
    return this.metadata.get(docId);
  }

  getAllMetadata(): DocumentMeta[] {
    return Array.from(this.metadata.values());
  }

  hasDocument(docId: string): boolean {
    return this.documents.has(docId);
  }

  applyUpdate(docId: string, update: Uint8Array, sourceClientId: string | null = null): void {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    Y.applyUpdate(doc, update, sourceClientId);

    const meta = this.metadata.get(docId);
    if (meta) {
      meta.updatedAt = new Date();
    }
  }

  getStateVector(docId: string): Uint8Array {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    return Y.encodeStateVector(doc);
  }

  getStateAsUpdate(docId: string, targetStateVector?: Uint8Array): Uint8Array {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    return Y.encodeStateAsUpdate(doc, targetStateVector);
  }

  getDocumentContent(docId: string): unknown {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    const sharedTypes: Record<string, unknown> = {};
    doc.share.forEach((type, name) => {
      if (type instanceof Y.Text) {
        sharedTypes[name] = type.toString();
      } else if (type instanceof Y.Map) {
        sharedTypes[name] = type.toJSON();
      } else if (type instanceof Y.Array) {
        sharedTypes[name] = type.toJSON();
      } else {
        sharedTypes[name] = 'unsupported-type';
      }
    });

    return sharedTypes;
  }

  getDocumentSnapshot(docId: string): DocumentState {
    const meta = this.metadata.get(docId);
    if (!meta) {
      throw new Error(`Document ${docId} metadata not found`);
    }

    const update = this.getStateAsUpdate(docId);
    return { meta: { ...meta }, update };
  }

  onUpdate(docId: string, listener: (update: Uint8Array, docId: string) => void): void {
    this.updateListeners.set(docId, listener);
  }

  offUpdate(docId: string): void {
    this.updateListeners.delete(docId);
  }

  deleteDocument(docId: string): boolean {
    const doc = this.documents.get(docId);
    if (doc) {
      doc.destroy();
    }
    this.updateListeners.delete(docId);
    this.documents.delete(docId);
    return this.metadata.delete(docId);
  }

  private setupUpdateListener(docId: string, doc: Y.Doc): void {
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'load') return;

      const sourceClientId = typeof origin === 'string' ? origin : null;

      const listener = this.updateListeners.get(docId);
      if (listener) {
        listener(update, docId);
      }

      if (this.globalUpdateHandler) {
        this.globalUpdateHandler(update, docId, sourceClientId);
      }

      const meta = this.metadata.get(docId);
      if (meta) {
        meta.updatedAt = new Date();
      }
    });
  }

  encodeUpdateToBase64(update: Uint8Array): string {
    return Buffer.from(update).toString('base64');
  }

  decodeBase64ToUpdate(base64: string): Uint8Array {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  encodeStateVectorToBase64(docId: string): string {
    const sv = this.getStateVector(docId);
    return Buffer.from(sv).toString('base64');
  }
}

export const documentManager = new DocumentManager();
