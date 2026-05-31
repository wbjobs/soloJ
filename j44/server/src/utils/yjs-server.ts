import { WebSocketServer, WebSocket } from 'ws';
import { setupWSConnection, getYDoc, docs } from 'y-websocket/bin/utils';
import * as Y from 'yjs';
import Snippet from '../models/Snippet';
import SnippetHistory from '../models/SnippetHistory';

const PERSISTENCE_INTERVAL = 5000;
const SNAPSHOT_INTERVAL = 2000;
const MAX_HISTORY_VERSIONS = 100;

const persistenceTimers = new Map<string, NodeJS.Timeout>();
const snapshotTimers = new Map<string, NodeJS.Timeout>();
const updateCounters = new Map<string, number>();
const versionCounters = new Map<string, number>();
const memoryStore = new Map<string, { content: string; title: string; language: string; updatedAt: Date }>();
const memoryHistoryStore = new Map<string, Array<{
  version: number;
  snapshot: string;
  timestamp: Date;
  content: string;
  title: string;
  language: string;
  changesCount: number;
}>>();
const docLoadedPromises = new Map<string, Promise<void>>();

function isMongoDBAvailable(): boolean {
  return (global as any).isMongoDBConnected === true;
}

function encodeStateAsBase64(ydoc: Y.Doc): string {
  const state = Y.encodeStateAsUpdate(ydoc);
  return Buffer.from(state).toString('base64');
}

function applyBase64State(ydoc: Y.Doc, base64: string): void {
  const state = new Uint8Array(Buffer.from(base64, 'base64'));
  Y.applyUpdate(ydoc, state);
}

function createTempDocFromSnapshot(base64: string): Y.Doc {
  const tempDoc = new Y.Doc();
  applyBase64State(tempDoc, base64);
  return tempDoc;
}

function getDocContent(ydoc: Y.Doc): { content: string; title: string; language: string } {
  const content = ydoc.getText('content').toString();
  const ymeta = ydoc.getMap('meta') as Y.Map<string>;
  const title = ymeta.get('title') || '未命名代码片段';
  const language = ymeta.get('language') || 'javascript';
  return { content, title, language };
}

async function getNextVersion(snippetId: string): Promise<number> {
  if (isMongoDBAvailable()) {
    const latest = await SnippetHistory.findOne({ snippetId })
      .sort({ version: -1 })
      .select('version');
    return latest ? latest.version + 1 : 1;
  } else {
    const history = memoryHistoryStore.get(snippetId) || [];
    return history.length > 0 ? history[history.length - 1].version + 1 : 1;
  }
}

async function createSnapshot(snippetId: string, ydoc: Y.Doc, changesCount: number): Promise<void> {
  try {
    const { content, title, language } = getDocContent(ydoc);
    const snapshot = encodeStateAsBase64(ydoc);
    const version = await getNextVersion(snippetId);
    const timestamp = new Date();

    const historyEntry = {
      snippetId,
      version,
      snapshot,
      timestamp,
      content,
      title,
      language,
      changesCount
    };

    if (isMongoDBAvailable()) {
      const historyDoc = new SnippetHistory(historyEntry);
      await historyDoc.save();

      const totalVersions = await SnippetHistory.countDocuments({ snippetId });
      if (totalVersions > MAX_HISTORY_VERSIONS) {
        const oldestToKeep = await SnippetHistory.findOne({ snippetId })
          .sort({ version: -1 })
          .skip(MAX_HISTORY_VERSIONS - 1)
          .select('version');
        if (oldestToKeep) {
          await SnippetHistory.deleteMany({
            snippetId,
            version: { $lt: oldestToKeep.version }
          });
        }
      }
    } else {
      const history = memoryHistoryStore.get(snippetId) || [];
      history.push(historyEntry);
      if (history.length > MAX_HISTORY_VERSIONS) {
        history.shift();
      }
      memoryHistoryStore.set(snippetId, history);
    }

    console.log(`Created snapshot v${version} for snippet ${snippetId}`);
  } catch (err) {
    console.error(`Error creating snapshot for ${snippetId}:`, err);
  }
}

function scheduleSnapshot(snippetId: string, ydoc: Y.Doc): void {
  const currentCount = (updateCounters.get(snippetId) || 0) + 1;
  updateCounters.set(snippetId, currentCount);

  if (currentCount % 10 === 0) {
    const existingTimer = snapshotTimers.get(snippetId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      const changesCount = updateCounters.get(snippetId) || 0;
      updateCounters.set(snippetId, 0);
      await createSnapshot(snippetId, ydoc, changesCount);
      snapshotTimers.delete(snippetId);
    }, SNAPSHOT_INTERVAL);

    snapshotTimers.set(snippetId, timer);
  }
}

export async function getHistoryList(snippetId: string): Promise<Array<{
  version: number;
  timestamp: Date;
  title: string;
  language: string;
  changesCount: number;
}>> {
  if (isMongoDBAvailable()) {
    const history = await SnippetHistory.find({ snippetId })
      .sort({ version: 1 })
      .select('version timestamp title language changesCount');
    return history.map(h => ({
      version: h.version,
      timestamp: h.timestamp,
      title: h.title,
      language: h.language,
      changesCount: h.changesCount
    }));
  } else {
    const history = memoryHistoryStore.get(snippetId) || [];
    return history.map(h => ({
      version: h.version,
      timestamp: h.timestamp,
      title: h.title,
      language: h.language,
      changesCount: h.changesCount
    }));
  }
}

export async function getHistoryVersion(snippetId: string, version: number): Promise<{
  version: number;
  timestamp: Date;
  content: string;
  title: string;
  language: string;
  snapshot: string;
} | null> {
  let historyEntry: any = null;

  if (isMongoDBAvailable()) {
    historyEntry = await SnippetHistory.findOne({ snippetId, version });
  } else {
    const history = memoryHistoryStore.get(snippetId) || [];
    historyEntry = history.find(h => h.version === version) || null;
  }

  if (!historyEntry) return null;

  return {
    version: historyEntry.version,
    timestamp: historyEntry.timestamp,
    content: historyEntry.content,
    title: historyEntry.title,
    language: historyEntry.language,
    snapshot: historyEntry.snapshot
  };
}

export async function getVersionDiff(snippetId: string, version: number): Promise<{
  version: number;
  content: string;
  currentContent: string;
} | null> {
  const historyEntry = await getHistoryVersion(snippetId, version);
  if (!historyEntry) return null;

  const ydoc = getYDoc(snippetId);
  const currentContent = ydoc.getText('content').toString();

  return {
    version,
    content: historyEntry.content,
    currentContent
  };
}

async function loadSnippetFromDB(docName: string, ydoc: Y.Doc): Promise<void> {
  if (docLoadedPromises.has(docName)) {
    return docLoadedPromises.get(docName)!;
  }

  const loadPromise = (async () => {
    try {
      if (isMongoDBAvailable()) {
        const snippet = await Snippet.findOne({ id: docName });
        if (snippet) {
          ydoc.transact(() => {
            const ytext = ydoc.getText('content');
            if (ytext.toString() === '' && snippet.content) {
              ytext.insert(0, snippet.content);
            }
            const ymeta = ydoc.getMap('meta') as Y.Map<string>;
            if (!ymeta.get('title') && snippet.title) {
              ymeta.set('title', snippet.title);
            }
            if (!ymeta.get('language') && snippet.language) {
              ymeta.set('language', snippet.language);
            }
          });
          return;
        }
      }
      
      const memorySnippet = memoryStore.get(docName);
      if (memorySnippet) {
        ydoc.transact(() => {
          const ytext = ydoc.getText('content');
          if (ytext.toString() === '' && memorySnippet.content) {
            ytext.insert(0, memorySnippet.content);
          }
          const ymeta = ydoc.getMap('meta') as Y.Map<string>;
          if (!ymeta.get('title') && memorySnippet.title) {
            ymeta.set('title', memorySnippet.title);
          }
          if (!ymeta.get('language') && memorySnippet.language) {
            ymeta.set('language', memorySnippet.language);
          }
        });
      }
    } catch (err) {
      console.error(`Error loading snippet ${docName}:`, err);
    }
  })();

  docLoadedPromises.set(docName, loadPromise);
  return loadPromise;
}

async function persistSnippetToDB(docName: string, ydoc: Y.Doc) {
  try {
    const content = ydoc.getText('content').toString();
    const ymeta = ydoc.getMap('meta') as Y.Map<string>;
    const title = ymeta.get('title') || '';
    const language = ymeta.get('language') || '';

    const updateData: any = {
      content,
      updatedAt: new Date()
    };

    if (title) updateData.title = title;
    if (language) updateData.language = language;

    memoryStore.set(docName, {
      content,
      title: title || '未命名代码片段',
      language: language || 'javascript',
      updatedAt: new Date()
    });

    if (isMongoDBAvailable()) {
      await Snippet.findOneAndUpdate(
        { id: docName },
        updateData,
        { upsert: true, new: true }
      );
      console.log(`Persisted snippet ${docName} to MongoDB`);
    } else {
      console.log(`Persisted snippet ${docName} to memory store`);
    }
  } catch (err) {
    console.error(`Error persisting snippet ${docName}:`, err);
  }
}

function schedulePersistence(docName: string, ydoc: Y.Doc) {
  const existingTimer = persistenceTimers.get(docName);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    persistSnippetToDB(docName, ydoc);
    persistenceTimers.delete(docName);
  }, PERSISTENCE_INTERVAL);

  persistenceTimers.set(docName, timer);
}

function setupWSConnectionWithSync(
  conn: WebSocket,
  req: any,
  docName: string,
  ydoc: Y.Doc
) {
  const originalSend = conn.send.bind(conn);
  let isDocLoaded = false;
  const messageQueue: any[] = [];

  (conn as any).send = (data: any, options: any, cb: any) => {
    if (!isDocLoaded) {
      messageQueue.push({ data, options, cb });
      return;
    }
    originalSend(data, options, cb);
  };

  setupWSConnection(conn, req, {
    gc: true
  });

  loadSnippetFromDB(docName, ydoc).then(() => {
    isDocLoaded = true;
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()!;
      originalSend(msg.data, msg.options, msg.cb);
    }
  });
}

export function setupYjsServer(wss: WebSocketServer) {
  wss.on('connection', (conn: WebSocket, req) => {
    const url = req.url || '';
    const docName = url.split('/').pop() || '';

    const ydoc = getYDoc(docName);

    setupWSConnectionWithSync(conn, req, docName, ydoc);

    ydoc.on('update', () => {
      schedulePersistence(docName, ydoc);
      scheduleSnapshot(docName, ydoc);
    });

    conn.on('close', () => {
      const persistenceTimer = persistenceTimers.get(docName);
      if (persistenceTimer) {
        clearTimeout(persistenceTimer);
        persistSnippetToDB(docName, ydoc);
        persistenceTimers.delete(docName);
      }

      const snapshotTimer = snapshotTimers.get(docName);
      if (snapshotTimer) {
        clearTimeout(snapshotTimer);
        const changesCount = updateCounters.get(docName) || 0;
        if (changesCount > 0) {
          createSnapshot(docName, ydoc, changesCount);
        }
        snapshotTimers.delete(docName);
      }

      const doc = docs.get(docName);
      if (doc && doc.conns.size === 0) {
        persistSnippetToDB(docName, ydoc);
        docLoadedPromises.delete(docName);
      }
    });
  });

  console.log('Yjs WebSocket server initialized');
}

export { memoryStore, encodeStateAsBase64, createTempDocFromSnapshot };
