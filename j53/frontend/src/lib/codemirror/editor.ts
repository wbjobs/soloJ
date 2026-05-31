import { EditorState, StateEffect, StateField, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { yCollab } from 'y-codemirror.next';
import type { YjsProvider } from '../yjsProvider';
import type { Awareness } from 'y-protocols/awareness';

export interface EditorOptions {
  container: HTMLElement;
  yjsProvider: YjsProvider;
  language?: 'javascript' | 'python' | 'html' | 'css' | 'plaintext';
  readOnly?: boolean;
}

export interface EditorInstance {
  view: EditorView;
  destroy: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  isDestroyed: boolean;
}

let editorCount = 0;

function getLanguageExtension(language: string) {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return javascript({ jsx: true, typescript: true });
    case 'python':
      return python();
    case 'html':
      return html();
    case 'css':
      return css();
    default:
      return [];
  }
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    contain: 'strict'
  },
  '.cm-content': {
    caretColor: '#ffffff',
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '8px 0'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#ffffff',
    borderLeftWidth: '2px',
    marginLeft: '-1px'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#264f78'
  },
  '.cm-gutters': {
    backgroundColor: '#252526',
    color: '#858585',
    border: 'none',
    borderRight: '1px solid #3e3e42'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#2a2d2e',
    color: '#c6c6c6'
  },
  '.cm-activeLine': {
    backgroundColor: '#2a2d2e'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 8px',
    minWidth: '40px',
    textAlign: 'right'
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888'
  },
  '.cm-tooltip': {
    backgroundColor: '#252526',
    border: '1px solid #454545'
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: '#04395e',
      color: '#ffffff'
    }
  },
  '.cm-ySelection': {
    caretColor: 'var(--y-caret-color)',
    position: 'relative'
  },
  '.cm-ySelectionCaret': {
    position: 'relative',
    borderLeft: '2px solid var(--y-caret-color)',
    marginLeft: '-1px',
    animation: 'cm-y-blink 1s steps(1) infinite'
  },
  '@keyframes cm-y-blink': {
    '50%': { opacity: '0' }
  },
  '.cm-ySelectionInfo': {
    position: 'absolute',
    top: '-1.2em',
    left: '0',
    backgroundColor: 'var(--y-caret-color)',
    color: 'white',
    fontSize: '0.75em',
    padding: '1px 4px',
    borderRadius: '3px 3px 3px 0',
    whiteSpace: 'nowrap',
    opacity: '0.9',
    zIndex: '1000',
    pointerEvents: 'none'
  }
}, { dark: true });

export function createEditor(options: EditorOptions): EditorInstance {
  const { container, yjsProvider, language = 'javascript', readOnly = false } = options;

  editorCount++;
  const editorId = editorCount;
  console.log(`[Editor #${editorId}] Creating editor for language: ${language}`);

  const ytext = yjsProvider.getText('codemirror');
  const awareness = yjsProvider.getAwareness() as Awareness;
  const userInfo = yjsProvider.getUserInfo();

  const yCollabCompartment = new Compartment();

  const yCollabExtensions = yCollab(ytext, awareness, {
    userColor: userInfo.color,
    userName: userInfo.name,
    cursorBuilder: (cursor: { anchor: number; head: number }, user: any) => {
      const color = user.color || '#ffb454';
      const name = user.name || 'Unknown';
      const cursorSpan = document.createElement('span');
      cursorSpan.className = 'cm-ySelectionCaret';
      cursorSpan.style.setProperty('--y-caret-color', color);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'cm-ySelectionInfo';
      infoDiv.textContent = name;
      infoDiv.style.backgroundColor = color;
      cursorSpan.appendChild(infoDiv);

      return cursorSpan;
    },
    selectionBuilder: (ranges: any[], user: any) => {
      const color = user.color || '#ffb454';
      return [{
        anchor: ranges[0].anchor,
        head: ranges[0].head,
        class: 'cm-ySelection',
        style: `--y-caret-color: ${color}; --y-selection-color: ${color}33;`,
        inclusiveStart: true,
        inclusiveEnd: true
      }];
    }
  });

  const extensions = [
    editorTheme,
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    foldGutter(),
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    getLanguageExtension(language),
    readOnly ? EditorView.editable.of(false) : [],
    yCollabCompartment.of(yCollabExtensions),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      ...lintKeymap,
      indentWithTab
    ])
  ];

  const state = EditorState.create({
    doc: '',
    extensions: extensions
  });

  const view = new EditorView({
    state,
    parent: container,
    root: document
  });

  let destroyed = false;

  const instance: EditorInstance = {
    view,
    isDestroyed: false,
    destroy: () => {
      if (destroyed) {
        console.log(`[Editor #${editorId}] Already destroyed, skipping`);
        return;
      }
      destroyed = true;
      instance.isDestroyed = true;

      console.log(`[Editor #${editorId}] Destroying editor`);

      try {
        view.dispatch({
          effects: yCollabCompartment.reconfigure([])
        });
        console.log(`[Editor #${editorId}] yCollab extensions removed`);
      } catch (e) {
        console.warn(`[Editor #${editorId}] Error removing yCollab extensions:`, e);
      }

      setTimeout(() => {
        try {
          view.destroy();
          console.log(`[Editor #${editorId}] EditorView destroyed`);
        } catch (e) {
          console.warn(`[Editor #${editorId}] Error destroying EditorView:`, e);
        }
      }, 50);
    },
    getValue: () => {
      if (destroyed) return '';
      return ytext.toString();
    },
    setValue: (value: string) => {
      if (destroyed) return;
      ytext.delete(0, ytext.length);
      ytext.insert(0, value);
    },
    focus: () => {
      if (destroyed) return;
      view.focus();
    }
  };

  console.log(`[Editor #${editorId}] Editor created successfully`);
  return instance;
}
