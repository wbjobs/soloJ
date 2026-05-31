import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import NoteEditor from './components/NoteEditor';
import KnowledgeGraph from './components/KnowledgeGraph';
import { NoteSummary, NoteDetail, NoteSearchResult } from '../shared/types';
import { useNoteCache } from './hooks/useNoteCache';

type View = 'editor' | 'graph';

const App: React.FC = () => {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [searchResults, setSearchResults] = useState<NoteSearchResult[]>([]);
  const [selectedNoteTitle, setSelectedNoteTitle] = useState<string | null>(null);
  const [backlinks, setBacklinks] = useState<NoteSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<View>('editor');
  const noteCache = useNoteCache();
  const selectNoteAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const refreshNotes = useCallback(async () => {
    const allNotes = await window.electronAPI.getAllNotes();
    setNotes(allNotes);
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onVaultChanged(() => {
      refreshNotes();
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      }
    });
    return unsubscribe;
  }, [refreshNotes, searchQuery]);

  const handleOpenVault = async () => {
    const path = await window.electronAPI.openVault();
    if (path) {
      noteCache.clearAll();
      setVaultPath(path);
      setSelectedNoteTitle(null);
      setBacklinks([]);
      setSearchQuery('');
      setSearchResults([]);
      await refreshNotes();
    }
  };

  const handleSelectNote = useCallback(async (title: string) => {
    if (selectNoteAbortRef.current) {
      selectNoteAbortRef.current.abort();
    }
    selectNoteAbortRef.current = new AbortController();
    const signal = selectNoteAbortRef.current.signal;

    try {
      const cached = noteCache.getByTitle(title);
      if (cached) {
        setSelectedNoteTitle(title);
        setCurrentView('editor');
        const bl = await window.electronAPI.getBacklinks(title);
        if (!signal.aborted) {
          setBacklinks(bl);
        }
        return;
      }

      const note = await window.electronAPI.getNote(title);
      if (signal.aborted) return;

      if (note) {
        noteCache.set(note);
        setSelectedNoteTitle(title);
        setCurrentView('editor');
        const bl = await window.electronAPI.getBacklinks(title);
        if (!signal.aborted) {
          setBacklinks(bl);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Failed to load note:', err);
    }
  }, [noteCache]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchAbortRef.current = new AbortController();
    const signal = searchAbortRef.current.signal;

    try {
      const results = await window.electronAPI.searchNotes(query);
      if (!signal.aborted) {
        setSearchResults(results);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Search failed:', err);
    }
  }, []);

  const selectedNote: NoteDetail | null = selectedNoteTitle
    ? noteCache.getByTitle(selectedNoteTitle)?.note || null
    : null;

  return (
    <div className="app-container">
      <Sidebar
        vaultPath={vaultPath}
        notes={notes}
        searchResults={searchResults}
        searchQuery={searchQuery}
        selectedNoteTitle={selectedNoteTitle}
        backlinks={backlinks}
        onOpenVault={handleOpenVault}
        onSelectNote={handleSelectNote}
        onSearch={handleSearch}
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      <main className="main-content">
        {currentView === 'graph' ? (
          <KnowledgeGraph onNavigate={handleSelectNote} />
        ) : (
          <NoteEditor
            note={selectedNote}
            backlinks={backlinks}
            onNavigate={handleSelectNote}
            noteCache={noteCache}
          />
        )}
      </main>
    </div>
  );
};

export default App;
