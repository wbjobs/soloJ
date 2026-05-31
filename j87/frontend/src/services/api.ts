import axios from 'axios';
import type { ChatResponse, DocumentInfo, DocumentsList, Source, DocumentContent } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

export const healthCheck = async (): Promise<{ status: string; vectorstore_size: number }> => {
  const response = await api.get('/health');
  return response.data;
};

export const uploadDocument = async (file: File): Promise<DocumentInfo> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const chat = async (question: string): Promise<ChatResponse> => {
  const response = await api.post('/chat', { question });
  return response.data;
};

export interface StreamCallbacks {
  onSources: (sources: Source[]) => void;
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export const chatStream = async (question: string, callbacks: StreamCallbacks): Promise<AbortController> => {
  const controller = new AbortController();

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });

    if (!response.ok) {
      callbacks.onError(`请求失败: ${response.status} ${response.statusText}`);
      return controller;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('无法获取响应流');
      return controller;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const processChunk = async (): Promise<void> => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (buffer.trim()) {
              parseSSEData(buffer, callbacks);
            }
            callbacks.onDone();
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const currentData = trimmed.slice(6);
              parseSSEData(currentData, callbacks);
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          callbacks.onDone();
          return;
        }
        callbacks.onError(err instanceof Error ? err.message : '流式读取错误');
      }
    };

    processChunk();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      callbacks.onDone();
      return controller;
    }
    callbacks.onError(err instanceof Error ? err.message : '请求失败');
  }

  return controller;
};

function parseSSEData(data: string, callbacks: StreamCallbacks): void {
  if (!data.trim()) return;

  try {
    const event = JSON.parse(data);

    switch (event.type) {
      case 'sources':
        callbacks.onSources(event.data || []);
        break;
      case 'token':
        callbacks.onToken(event.data || '');
        break;
      case 'answer':
        callbacks.onToken(event.data || '');
        break;
      case 'done':
        callbacks.onDone();
        break;
      case 'error':
        callbacks.onError(event.data || '未知错误');
        break;
    }
  } catch {
    // ignore malformed JSON
  }
}

export const listDocuments = async (): Promise<DocumentsList> => {
  const response = await api.get('/documents');
  return response.data;
};

export const getDocumentContent = async (filename: string): Promise<DocumentContent> => {
  const response = await api.get(`/document/${encodeURIComponent(filename)}`);
  return response.data;
};

export const clearVectorstore = async (): Promise<{ message: string }> => {
  const response = await api.post('/clear');
  return response.data;
};
