export interface ElectronAPI {
  openVault: () => Promise<string | null>;
  getAllNotes: () => Promise<NoteSummary[]>;
  getNote: (title: string) => Promise<NoteDetail | null>;
  getBacklinks: (title: string) => Promise<NoteSummary[]>;
  getOutlinks: (noteId: number) => Promise<{ target_title: string }[]>;
  getGraphData: () => Promise<GraphData>;
  searchNotes: (query: string) => Promise<NoteSearchResult[]>;
  saveNote: (filePath: string, content: string) => Promise<boolean>;
  onVaultChanged: (callback: () => void) => () => void;
}

export interface NoteSummary {
  id: number;
  title: string;
  file_path: string;
  updated_at?: string;
}

export interface NoteDetail {
  id: number;
  title: string;
  file_path: string;
  content: string;
}

export interface NoteSearchResult {
  id: number;
  title: string;
  file_path: string;
  updated_at?: string;
  snippet: string;
  score: number;
  matched_in: 'title' | 'content' | 'both';
}

export interface GraphData {
  nodes: { id: string; title: string }[];
  edges: { source: string; target: string }[];
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
