import { MemoryStore } from './MemoryStore.js';
import { Neo4jStore } from './Neo4jStore.js';
import type { ITraceStore } from './types.js';

export function createStore(): ITraceStore {
  const storageType = process.env.STORAGE_TYPE?.toLowerCase() || 'memory';

  if (storageType === 'neo4j') {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const username = process.env.NEO4J_USERNAME || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'neo4j';
    return new Neo4jStore(uri, username, password);
  }

  return new MemoryStore();
}

export { MemoryStore, Neo4jStore };
export type { ITraceStore };
