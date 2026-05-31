import axios from 'axios';
import { HistoryVersion } from '../components/TimelineSlider';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export interface SnippetData {
  id: string;
  title: string;
  language: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoryVersionData {
  version: number;
  timestamp: Date;
  content: string;
  title: string;
  language: string;
  snapshot: string;
}

export interface DiffData {
  version: number;
  content: string;
  currentContent: string;
}

export async function createSnippet(data: {
  title: string;
  language: string;
  content?: string;
}): Promise<SnippetData> {
  const response = await api.post('/snippets', data);
  return response.data;
}

export async function getSnippet(id: string): Promise<SnippetData> {
  const response = await api.get(`/snippets/${id}`);
  return response.data;
}

export async function getHistoryList(snippetId: string): Promise<HistoryVersion[]> {
  const response = await api.get(`/snippets/${snippetId}/history`);
  return response.data.map((item: any) => ({
    ...item,
    timestamp: new Date(item.timestamp)
  }));
}

export async function getHistoryVersion(
  snippetId: string,
  version: number
): Promise<HistoryVersionData> {
  const response = await api.get(`/snippets/${snippetId}/history/${version}`);
  return {
    ...response.data,
    timestamp: new Date(response.data.timestamp)
  };
}

export async function getVersionDiff(
  snippetId: string,
  version: number
): Promise<DiffData> {
  const response = await api.get(`/snippets/${snippetId}/diff/${version}`);
  return response.data;
}

export default api;
