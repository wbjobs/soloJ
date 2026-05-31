import { useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useEditorStore } from '@/stores/editorStore';
import { useDebuggerStore } from '@/stores/debuggerStore';

interface CodeEditorProps {
  pyodideStatus: string;
}

export function CodeEditor({ pyodideStatus }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const { code, setCode, breakpoints, currentLine, theme, toggleBreakpoint } = useEditorStore();
  const { currentLine: debugCurrentLine, state: debugState } = useDebuggerStore();

  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    editor.onMouseDown((e) => {
      if (e.target.type === 6 && e.target.position) {
        toggleBreakpoint(e.target.position.lineNumber);
      }
    });
  }, [toggleBreakpoint]);

  useEffect(() => {
    if (!editorRef.current) return;

    const decorations: editor.IModelDeltaDecoration[] = [];

    breakpoints.forEach((bp) => {
      if (bp.enabled) {
        decorations.push({
          range: {
            startLineNumber: bp.lineNumber,
            startColumn: 1,
            endLineNumber: bp.lineNumber,
            endColumn: 1,
          },
          options: {
            isWholeLine: false,
            glyphMarginClassName: 'breakpoint-glyph',
            linesDecorationsClassName: 'breakpoint-line-decoration',
          },
        });
      }
    });

    const displayLine = debugCurrentLine ?? currentLine;
    if (displayLine && (debugState === 'paused' || debugState === 'running')) {
      decorations.push({
        range: {
          startLineNumber: displayLine,
          startColumn: 1,
          endLineNumber: displayLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'current-line-highlight',
          glyphMarginClassName: 'current-line-glyph',
          linesDecorationsClassName: 'current-line-decoration',
        },
      });
    }

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [breakpoints, currentLine, debugCurrentLine, debugState]);

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  }, [setCode]);

  return (
    <div className="h-full w-full relative">
      <style>{`
        .breakpoint-line-decoration {
          background: rgba(229, 20, 0, 0.15) !important;
        }
        .current-line-highlight {
          background: rgba(247, 216, 120, 0.2) !important;
        }
        .current-line-decoration {
          border-left: 3px solid #f7d878 !important;
        }
        .breakpoint-glyph {
          background: #e51400 !important;
          border-radius: 50% !important;
          width: 10px !important;
          height: 10px !important;
          margin-top: 4px !important;
          margin-left: 6px !important;
        }
        .current-line-glyph {
          width: 0 !important;
          height: 0 !important;
          border-top: 6px solid transparent !important;
          border-bottom: 6px solid transparent !important;
          border-left: 10px solid #f7d878 !important;
          margin-top: 4px !important;
          margin-left: 6px !important;
          background: transparent !important;
        }
      `}</style>
      
      {pyodideStatus === 'loading' && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-blue-600 text-white text-sm py-1 px-4 flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          <span>正在加载 Python WASM 运行时...</span>
        </div>
      )}

      <Editor
        height="100%"
        defaultLanguage="python"
        value={code}
        onChange={handleChange}
        theme={theme}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
          lineNumbers: 'on',
          glyphMargin: true,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: 'on',
          renderWhitespace: 'selection',
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: { top: 10, bottom: 10 },
          readOnly: pyodideStatus !== 'ready' && pyodideStatus !== 'loading',
        }}
      />
    </div>
  );
}
