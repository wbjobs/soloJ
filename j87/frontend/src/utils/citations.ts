import type { Source } from '../types';

export interface ParsedCitation {
  type: 'text' | 'citation';
  content: string;
  chunkId?: string;
  source?: Source;
}

const CITATION_PATTERN = /\[([a-f0-9]{16})\]/g;

export function parseCitations(
  content: string,
  sources: Source[] = []
): ParsedCitation[] {
  if (!content) return [];

  const sourceMap = new Map<string, Source>();
  sources.forEach((s) => sourceMap.set(s.chunk_id, s));

  const result: ParsedCitation[] = [];
  let lastIndex = 0;
  let match;

  CITATION_PATTERN.lastIndex = 0;

  while ((match = CITATION_PATTERN.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }

    const chunkId = match[1];
    result.push({
      type: 'citation',
      content: chunkId,
      chunkId,
      source: sourceMap.get(chunkId),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    result.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return result;
}

export function extractChunkIds(content: string): string[] {
  const ids: string[] = [];
  let match;
  CITATION_PATTERN.lastIndex = 0;
  while ((match = CITATION_PATTERN.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}
