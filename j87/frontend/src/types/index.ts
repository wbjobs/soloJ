export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
  streaming?: boolean;
}

export interface Source {
  chunk_id: string;
  content: string;
  source: string;
  page: number;
  index?: number;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface DocumentInfo {
  filename: string;
  chunks: number;
  raw_pages: number;
}

export interface DocumentsList {
  documents: string[];
  total_chunks: number;
}

export interface DocumentChunk {
  chunk_id: string;
  content: string;
  page: number;
  index: number;
}

export interface DocumentPage {
  page: number;
  source: string;
  content: string;
  chunks: DocumentChunk[];
}

export interface DocumentContent {
  filename: string;
  pages: DocumentPage[];
}

export interface CitationMarker {
  chunkId: string;
  start: number;
  end: number;
}
