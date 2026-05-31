import React, { useState } from 'react';
import { NoteSummary, NoteSearchResult } from '../../shared/types';
import HighlightText from './HighlightText';

interface SidebarProps {
  vaultPath: string | null;
  notes: NoteSummary[];
  searchResults: NoteSearchResult[];
  searchQuery: string;
  selectedNoteTitle: string | null;
  backlinks: NoteSummary[];
  onOpenVault: () => void;
  onSelectNote: (title: string) => void;
  onSearch: (query: string) => void;
  currentView: 'editor' | 'graph';
  onViewChange: (view: 'editor' | 'graph') => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  vaultPath,
  notes,
  searchResults,
  searchQuery,
  selectedNoteTitle,
  backlinks,
  onOpenVault,
  onSelectNote,
  onSearch,
  currentView,
  onViewChange,
}) => {
  const [backlinksCollapsed, setBacklinksCollapsed] = useState(false);
  const isSearching = searchQuery.trim().length > 0;
  const displayItems = isSearching ? searchResults : notes;

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const getMatchBadge = (matchedIn: 'title' | 'content' | 'both') => {
    switch (matchedIn) {
      case 'title':
        return <span className="match-badge match-title">标题</span>;
      case 'content':
        return <span className="match-badge match-content">正文</span>;
      case 'both':
        return <span className="match-badge match-both">标题+正文</span>;
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">📒 双链笔记</h1>
        <button className="btn-open-vault" onClick={onOpenVault}>
          {vaultPath ? '切换笔记库' : '打开笔记库'}
        </button>
      </div>

      <div className="view-toggle">
        <button
          className={`toggle-btn ${currentView === 'editor' ? 'active' : ''}`}
          onClick={() => onViewChange('editor')}
        >
          📝 笔记
        </button>
        <button
          className={`toggle-btn ${currentView === 'graph' ? 'active' : ''}`}
          onClick={() => onViewChange('graph')}
        >
          🕸 图谱
        </button>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="搜索笔记..."
          value={searchQuery}
          onChange={handleSearchInputChange}
          className="search-input"
        />
        {isSearching && (
          <div className="search-meta">
            找到 {searchResults.length} 个结果
          </div>
        )}
      </div>

      {selectedNoteTitle && backlinks.length > 0 && (
        <div className="backlinks-panel">
          <div
            className="panel-header"
            onClick={() => setBacklinksCollapsed(!backlinksCollapsed)}
          >
            <span className="panel-title">
              🔗 引用「{selectedNoteTitle}」的反向链接
            </span>
            <span className="panel-count">{backlinks.length}</span>
            <span className={`panel-arrow ${backlinksCollapsed ? 'collapsed' : ''}`}>
              ▼
            </span>
          </div>
          {!backlinksCollapsed && (
            <div className="panel-content">
              {backlinks.map((bl) => (
              <div
                key={bl.id}
                className="backlink-item sidebar-backlink"
                onClick={() => onSelectNote(bl.title)}
              >
                <span className="backlink-arrow">←</span>
                <span className="backlink-title">{bl.title}</span>
              </div>
            ))}
            </div>
          )}
        </div>
      )}

      <div className="note-list">
          {displayItems.map((note) => {
            const isSelected = selectedNoteTitle === note.title;
            const isSearchResult = 'matched_in' in note;

            return (
              <div
                key={note.id}
                className={`note-item ${isSelected ? 'selected' : ''} ${isSearchResult ? 'search-result-item' : ''}`}
                onClick={() => onSelectNote(note.title)}
              >
                <div className="note-item-main">
                  <div className="note-item-header">
                    {isSearchResult ? (
                      <HighlightText
                        text={note.title}
                        query={searchQuery}
                        className="note-title"
                      />
                    ) : (
                      <span className="note-title">{note.title}</span>
                    )}
                    {isSearchResult && getMatchBadge((note as NoteSearchResult).matched_in)}
                  </div>
                  {isSearchResult && (note as NoteSearchResult).snippet && (
                    <div className="note-snippet">
                      <HighlightText
                        text={(note as NoteSearchResult).snippet}
                        query={searchQuery}
                      />
                    </div>
                  )}
                </div>
                {note.updated_at && (
                  <span className="note-date">
                    {new Date(note.updated_at).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>
            );
          })}

          {displayItems.length === 0 && vaultPath && (
            <div className="empty-state">
              {isSearching ? '没有找到匹配的笔记' : '暂无笔记'}
            </div>
          )}
          {!vaultPath && (
            <div className="empty-state">请先打开一个笔记库文件夹</div>
          )}
        </div>
    </aside>
  );
};

export default Sidebar;
