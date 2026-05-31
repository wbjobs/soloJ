import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NoteDetail, NoteSummary } from '../../shared/types';
import { NoteCache } from '../hooks/useNoteCache';
import { useImageLazyLoad } from '../hooks/useImageLazyLoad';

interface NoteEditorProps {
  note: NoteDetail | null;
  backlinks: NoteSummary[];
  onNavigate: (title: string) => void;
  noteCache: NoteCache;
}

function preprocessBidirectionalLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_match, linkTarget) => {
    return `[$${linkTarget}$](bidirectional:${linkTarget})`;
  });
}

const STORAGE_KEY = 'note-editor-scroll';

function saveScrollPosition(noteId: number, scrollTop: number): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[noteId] = scrollTop;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function loadScrollPosition(noteId: number): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;
    const data = JSON.parse(stored);
    return data[noteId] || 0;
  } catch {
    return 0;
  }
}

const LazyImage: React.FC<{
  src: string;
  alt?: string;
  title?: string;
  observer: (img: HTMLImageElement | null) => void;
}> = ({ src, alt, title, observer }) => {
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (imgRef.current) {
      observer(imgRef.current);
    }
  }, [observer]);

  return (
    <span className="lazy-image-wrapper">
      {!loaded && !error && <span className="image-placeholder" />}
      {error && <span className="image-error">⚠ 图片加载失败</span>}
      <img
        ref={imgRef}
        src=""
        data-src={src}
        alt={alt || ''}
        title={title}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{ display: loaded && !error ? 'block' : 'none' }}
      />
    </span>
  );
};

const NoteEditor: React.FC<NoteEditorProps> = ({ note, backlinks, onNavigate, noteCache }) => {
  const [displayContent, setDisplayContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNoteIdRef = useRef<number | null>(null);
  const { observe: observeImage } = useImageLazyLoad();

  const processedContent = useMemo(() => {
    return preprocessBidirectionalLinks(displayContent);
  }, [displayContent]);

  useEffect(() => {
    if (!note) {
      currentNoteIdRef.current = null;
      setDisplayContent('');
      setIsEditing(false);
      setHasUnsaved(false);
      return;
    }

    if (currentNoteIdRef.current === note.id) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    currentNoteIdRef.current = note.id;

    const cached = noteCache.get(note.id);
    const contentToUse = cached?.draftContent ?? note.content;
    const editingToUse = cached?.isEditing ?? false;

    setDisplayContent(contentToUse);
    setIsEditing(editingToUse);
    setHasUnsaved(!!cached && cached.draftContent !== null && cached.draftContent !== cached.note.content);

    requestAnimationFrame(() => {
      if (editorContainerRef.current) {
        const savedScroll = loadScrollPosition(note.id);
        editorContainerRef.current.scrollTop = savedScroll;
        noteCache.updateScroll(note.id, savedScroll);
      }
      if (editingToUse && textareaRef.current && cached) {
        textareaRef.current.focus();
        try {
          textareaRef.current.setSelectionRange(cached.cursorPosition, cached.cursorPosition);
        } catch {
          // ignore
        }
      }
    });
  }, [note, noteCache]);

  const handleEditorScroll = useCallback(() => {
    if (!note || !editorContainerRef.current) return;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    const noteId = note.id;
    scrollTimeoutRef.current = setTimeout(() => {
      const scrollTop = editorContainerRef.current?.scrollTop || 0;
      saveScrollPosition(noteId, scrollTop);
      noteCache.updateScroll(noteId, scrollTop);
    }, 100);
  }, [note, noteCache]);

  const scheduleSave = useCallback((content: string) => {
    if (!note) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setHasUnsaved(true);
    noteCache.updateDraft(note.id, content, textareaRef.current?.selectionStart ?? content.length);

    saveTimeoutRef.current = setTimeout(async () => {
      const success = await window.electronAPI.saveNote(note.file_path, content);
      if (success) {
        noteCache.commitSave(note.id);
        setHasUnsaved(false);
      }
      saveTimeoutRef.current = null;
    }, 1000);
  }, [note, noteCache]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDisplayContent(value);
    scheduleSave(value);
  }, [scheduleSave]);

  const toggleEditMode = useCallback(() => {
    if (!note) return;
    const newEditing = !isEditing;
    setIsEditing(newEditing);
    noteCache.setEditing(note.id, newEditing);

    if (newEditing && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [note, isEditing, noteCache]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (note && hasUnsaved && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        window.electronAPI.saveNote(note.file_path, displayContent).then((success) => {
          if (success) {
            noteCache.commitSave(note.id);
            setHasUnsaved(false);
          }
        });
        saveTimeoutRef.current = null;
      }
    }
    if (e.key === 'Escape' && isEditing) {
      e.preventDefault();
      toggleEditMode();
    }
  }, [note, hasUnsaved, displayContent, isEditing, toggleEditMode, noteCache]);

  if (!note) {
    return (
      <div className="editor-empty">
        <div className="empty-illustration">📖</div>
        <p>选择一篇笔记开始阅读</p>
        <p className="hint">或创建新的 Markdown 文件到笔记库中</p>
      </div>
    );
  }

  return (
    <div className="note-editor" ref={editorContainerRef} onScroll={handleEditorScroll}>
      <div className="editor-header">
        <div className="editor-title-row">
          <h1 className="editor-title">{note.title}</h1>
          <div className="editor-actions">
            {hasUnsaved && <span className="unsaved-badge">● 未保存</span>}
            <button className="btn-edit" onClick={toggleEditMode}>
              {isEditing ? '👁 预览' : '✏ 编辑'}
            </button>
          </div>
        </div>
        <span className="editor-path">{note.file_path}</span>
      </div>

      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="note-textarea"
          value={displayContent}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="开始编写笔记，使用 [[笔记标题]] 创建双向链接..."
        />
      ) : (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                if (href && href.startsWith('bidirectional:')) {
                  const title = href.slice('bidirectional:'.length);
                  const label = typeof children === 'string'
                    ? children.replace(/^\$/, '').replace(/\$$/, '')
                    : title;
                  return (
                    <span
                      className="bidirectional-link"
                      onClick={() => onNavigate(title)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onNavigate(title); }}
                    >
                      {label}
                    </span>
                  );
                }
                return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
              },
              img: ({ src, alt, title }) => {
                if (!src) return null;
                if (src.startsWith('http') || src.startsWith('data:')) {
                  return <LazyImage src={src} alt={alt} title={title} observer={observeImage} />;
                }
                return <LazyImage src={src} alt={alt} title={title} observer={observeImage} />;
              },
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      )}

      {backlinks.length > 0 && (
        <div className="backlinks-section">
          <h3 className="backlinks-title">反向链接 ({backlinks.length})</h3>
          <div className="backlinks-list">
            {backlinks.map((bl) => (
              <div
                key={bl.id}
                className="backlink-item"
                onClick={() => onNavigate(bl.title)}
                role="button"
                tabIndex={0}
              >
                <span className="backlink-arrow">←</span>
                <span className="backlink-title">{bl.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;
