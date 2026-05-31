import { createStore, type ITraceStore } from './repositories/index.js';

export const store: ITraceStore = createStore();

export async function initializeStore(): Promise<void> {
  await store.testConnection();
  await store.createIndexes();
}
