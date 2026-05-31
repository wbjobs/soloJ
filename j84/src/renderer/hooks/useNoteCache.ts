import { useCallback, useRef, useState } from 'react';
import { NoteDetail } from '../../shared/types';

interface NoteCacheEntry {
  note: NoteDetail;
  draftContent: string | null;
  cursorPosition: number;
  scrollTop: number;
  isEditing: boolean;
  lastSaved: number | null;
  lastModified: number;
}

export interface NoteCache {
  get: (noteId: number) => NoteCacheEntry | undefined;
  getByTitle: (title: string) => NoteCacheEntry | undefined;
  set: (note: NoteDetail) => void;
  updateDraft: (noteId: number, content: string, cursorPos: number) => void;
  updateScroll: (noteId: number, scrollTop: number) => void;
  setEditing: (noteId: number, isEditing: boolean) => void;
  commitSave: (noteId: number) => void;
  clearAll: () => void;
  hasUnsavedChanges: (noteId: number) => boolean;
}

export function useNoteCache(): NoteCache {
  const cacheRef = useRef<Map<number, NoteCacheEntry>>(new Map());
  const titleIndexRef = useRef<Map<string, number>>(new Map());
  const [, forceUpdate] = useState(0);

  const get = useCallback((noteId: number) => {
    return cacheRef.current.get(noteId);
  }, []);

  const getByTitle = useCallback((title: string) => {
    const noteId = titleIndexRef.current.get(title);
    return noteId !== undefined ? cacheRef.current.get(noteId) : undefined;
  }, []);

  const set = useCallback((note: NoteDetail) => {
    const existing = cacheRef.current.get(note.id);
    if (existing) {
      if (note.content !== existing.note.content && !existing.draftContent) {
        existing.note = note;
        existing.lastModified = Date.now();
      }
    } else {
      cacheRef.current.set(note.id, {
        note,
        draftContent: null,
        cursorPosition: 0,
        scrollTop: 0,
        isEditing: false,
        lastSaved: null,
        lastModified: Date.now(),
      });
    }
    titleIndexRef.current.set(note.title, note.id);
    forceUpdate((n) => n + 1);
  }, []);

  const updateDraft = useCallback((noteId: number, content: string, cursorPos: number) => {
    const entry = cacheRef.current.get(noteId);
    if (entry) {
      entry.draftContent = content;
      entry.cursorPosition = cursorPos;
      entry.lastModified = Date.now();
    }
  }, []);

  const updateScroll = useCallback((noteId: number, scrollTop: number) => {
    const entry = cacheRef.current.get(noteId);
    if (entry) {
      entry.scrollTop = scrollTop;
    }
  }, []);

  const setEditing = useCallback((noteId: number, isEditing: boolean) => {
    const entry = cacheRef.current.get(noteId);
    if (entry) {
      entry.isEditing = isEditing;
    }
  }, []);

  const commitSave = useCallback((noteId: number) => {
    const entry = cacheRef.current.get(noteId);
    if (entry && entry.draftContent !== null) {
      entry.note = {
        ...entry.note,
        content: entry.draftContent,
      };
      entry.draftContent = null;
      entry.lastSaved = Date.now();
    }
  }, []);

  const clearAll = useCallback(() => {
    cacheRef.current.clear();
    titleIndexRef.current.clear();
    forceUpdate((n) => n + 1);
  }, []);

  const hasUnsavedChanges = useCallback((noteId: number) => {
    const entry = cacheRef.current.get(noteId);
    if (!entry || entry.draftContent === null) return false;
    return entry.draftContent !== entry.note.content;
  }, []);

  return {
    get,
    getByTitle,
    set,
    updateDraft,
    updateScroll,
    setEditing,
    commitSave,
    clearAll,
    hasUnsavedChanges,
  };
}
