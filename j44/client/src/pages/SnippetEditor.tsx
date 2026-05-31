import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Editor } from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import * as monaco from 'monaco-editor'
import { createYjsProvider, getYText, YjsConnection } from '../utils/yjs'
import * as Y from 'yjs'
import TimelineSlider, { HistoryVersion } from '../components/TimelineSlider'
import { getHistoryList, getHistoryVersion, getVersionDiff, HistoryVersionData } from '../services/api'
import { computeDiff, DiffResult, DiffLine } from '../utils/diffUtils'

function SnippetEditor() {
  const { id } = useParams<{ id: string }>()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const previewEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const yjsConnectionRef = useRef<YjsConnection | null>(null)
  const bindingRef = useRef<MonacoBinding | null>(null)
  const yMetaRef = useRef<Y.Map<string> | null>(null)
  const isInitializedRef = useRef(false)
  const isYjsSyncedRef = useRef(false)
  const editorMountedRef = useRef(false)
  const localUpdateRef = useRef(false)
  const historyPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const decorationRef = useRef<string[]>([])

  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [language, setLanguage] = useState('javascript')
  const [title, setTitle] = useState('代码片段')
  const [isEditorReady, setIsEditorReady] = useState(false)

  const [historyVersions, setHistoryVersions] = useState<HistoryVersion[]>([])
  const [previewVersion, setPreviewVersion] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<HistoryVersionData | null>(null)
  const [isHistoryMode, setIsHistoryMode] = useState(false)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [showDiff, setShowDiff] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!id) return
    try {
      const versions = await getHistoryList(id)
      setHistoryVersions(versions)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }, [id])

  useEffect(() => {
    if (!id || !isEditorReady) return

    fetchHistory()
    historyPollingRef.current = setInterval(fetchHistory, 3000)

    return () => {
      if (historyPollingRef.current) {
        clearInterval(historyPollingRef.current)
      }
    }
  }, [id, isEditorReady, fetchHistory])

  const handlePreviewChange = useCallback(async (version: number | null) => {
    if (!id || !id) return
    
    setPreviewVersion(version)
    setIsHistoryMode(version !== null)

    if (version !== null) {
      setIsLoadingHistory(true)
      try {
        const [versionData, diffData] = await Promise.all([
          getHistoryVersion(id, version),
          getVersionDiff(id, version)
        ])
        
        setPreviewData(versionData)
        
        if (previewEditorRef.current) {
          previewEditorRef.current.setValue(versionData.content)
        }
        
        const diff = computeDiff(diffData.content, diffData.currentContent)
        setDiffResult(diff)
        updateDiffDecorations(diff, diffData.content, diffData.currentContent)
      } catch (err) {
        console.error('Failed to load history version:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    } else {
      setPreviewData(null)
      setDiffResult(null)
      clearDiffDecorations()
    }
  }, [id])

  const handleSeek = useCallback(async (version: number) => {
    if (!id) return
    
    setIsLoadingHistory(true)
    try {
      const [versionData, diffData] = await Promise.all([
        getHistoryVersion(id, version),
        getVersionDiff(id, version)
      ])
      
      setPreviewData(versionData)
      
      if (previewEditorRef.current) {
        previewEditorRef.current.setValue(versionData.content)
      }
      
      const diff = computeDiff(diffData.content, diffData.currentContent)
      setDiffResult(diff)
      updateDiffDecorations(diff, diffData.content, diffData.currentContent)
    } catch (err) {
      console.error('Failed to load history version:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [id])

  const updateDiffDecorations = useCallback((diff: DiffResult, _oldContent: string, _newContent: string) => {
    if (editorRef.current) {
      const model = editorRef.current.getModel()
      if (!model) return
      
      const decorations: monaco.editor.IModelDeltaDecoration[] = []
      
      let oldLineIdx = 0
      let newLineIdx = 0
      
      diff.lines.forEach((line: DiffLine) => {
        if (line.type === 'added') {
          decorations.push({
            range: new monaco.Range(
              newLineIdx + 1,
              1,
              newLineIdx + 1,
              line.content.length + 1
            ),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: 'line-added',
              inlineClassName: 'text-added'
            }
          })
          newLineIdx++
        } else if (line.type === 'removed') {
          decorations.push({
            range: new monaco.Range(
              newLineIdx + 1,
              1,
              newLineIdx + 1,
              1
            ),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: 'line-removed',
              beforeContentClassName: 'text-removed'
            }
          })
          oldLineIdx++
        } else {
          oldLineIdx++
          newLineIdx++
        }
      })

      decorationRef.current = model.deltaDecorations(decorationRef.current, decorations)
    }
  }, [])

  const clearDiffDecorations = useCallback(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel()
      if (model && decorationRef.current.length > 0) {
        model.deltaDecorations(decorationRef.current, [])
        decorationRef.current = []
      }
    }
  }, [])

  const handleExitHistoryMode = useCallback(() => {
    setPreviewVersion(null)
    setPreviewData(null)
    setIsHistoryMode(false)
    setDiffResult(null)
    clearDiffDecorations()
  }, [clearDiffDecorations])

  useEffect(() => {
    if (!id) return

    const yjsConnection = createYjsProvider(id)
    yjsConnectionRef.current = yjsConnection

    const { doc, provider, awareness } = yjsConnection

    const yMeta = doc.getMap('meta') as Y.Map<string>
    yMetaRef.current = yMeta

    const yMetaObserver = (event: Y.YMapEvent<string>) => {
      if (!isInitializedRef.current) return
      if (event.keysChanged.has('title')) {
        localUpdateRef.current = true
        setTitle(yMeta.get('title') || '代码片段')
        setTimeout(() => { localUpdateRef.current = false }, 0)
      }
      if (event.keysChanged.has('language')) {
        localUpdateRef.current = true
        setLanguage(yMeta.get('language') || 'javascript')
        setTimeout(() => { localUpdateRef.current = false }, 0)
      }
    }

    yMeta.observe(yMetaObserver)

    const tryCreateBinding = () => {
      if (
        isYjsSyncedRef.current &&
        editorMountedRef.current &&
        !bindingRef.current &&
        editorRef.current
      ) {
        const ytext = getYText(doc)
        const monacoModel = editorRef.current.getModel()

        if (monacoModel) {
          if (ytext.toString() !== monacoModel.getValue()) {
            monacoModel.setValue(ytext.toString())
          }

          const binding = new MonacoBinding(
            ytext,
            monacoModel,
            new Set([editorRef.current]),
            awareness
          )
          bindingRef.current = binding
          setIsEditorReady(true)
        }
      }
    }

    const initFromYjs = () => {
      if (isInitializedRef.current) return
      
      const currentTitle = yMeta.get('title')
      const currentLanguage = yMeta.get('language')
      if (currentTitle) setTitle(currentTitle)
      if (currentLanguage) setLanguage(currentLanguage)
      
      isInitializedRef.current = true
      isYjsSyncedRef.current = true
      
      tryCreateBinding()
    }

    provider.on('sync', (isSynced: boolean) => {
      if (isSynced && !isYjsSyncedRef.current) {
        initFromYjs()
      }
    })

    if (provider.synced && !isYjsSyncedRef.current) {
      initFromYjs()
    }

    provider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected')
    })

    const updateAwareness = () => {
      const states = awareness.getStates()
      const users: Array<{ id: string; name: string; color: string }> = []
      states.forEach((state, clientId) => {
        if (state.user) {
          users.push({
            id: String(clientId),
            name: state.user.name,
            color: state.user.color,
          })
        }
      })
      setOnlineUsers(users)
    }

    awareness.on('change', updateAwareness)
    updateAwareness()

    return () => {
      awareness.off('change', updateAwareness)
      yMeta.unobserve(yMetaObserver)
      if (bindingRef.current) {
        bindingRef.current.destroy()
        bindingRef.current = null
      }
      isInitializedRef.current = false
      isYjsSyncedRef.current = false
      editorMountedRef.current = false
      yjsConnection.disconnect()
      if (historyPollingRef.current) {
        clearInterval(historyPollingRef.current)
      }
      clearDiffDecorations()
    }
  }, [id, clearDiffDecorations])

  const handleEditorMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    editorMountedRef.current = true

    if (yjsConnectionRef.current && isYjsSyncedRef.current && !bindingRef.current) {
      const { doc, awareness } = yjsConnectionRef.current
      const ytext = getYText(doc)
      const monacoModel = editor.getModel()

      if (monacoModel) {
        if (ytext.toString() !== monacoModel.getValue()) {
          monacoModel.setValue(ytext.toString())
        }

        const binding = new MonacoBinding(
          ytext,
          monacoModel,
          new Set([editor]),
          awareness
        )
        bindingRef.current = binding
        setIsEditorReady(true)
      }
    }
  }

  const handlePreviewEditorMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    previewEditorRef.current = editor
    if (previewData) {
      editor.setValue(previewData.content)
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    
    if (yMetaRef.current && isInitializedRef.current && !localUpdateRef.current && yjsConnectionRef.current) {
      yjsConnectionRef.current.doc.transact(() => {
        yMetaRef.current!.set('title', newTitle)
      })
    }
  }

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value
    setLanguage(newLanguage)
    
    if (yMetaRef.current && isInitializedRef.current && !localUpdateRef.current && yjsConnectionRef.current) {
      yjsConnectionRef.current.doc.transact(() => {
        yMetaRef.current!.set('language', newLanguage)
      })
    }
  }

  const handleCopyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      alert('链接已复制到剪贴板！')
    })
  }

  const currentVersion = historyVersions.length > 0 
    ? Math.max(...historyVersions.map(v => v.version))
    : 0

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <input
            type="text"
            value={isHistoryMode && previewData ? previewData.title : title}
            onChange={handleTitleChange}
            style={styles.titleInput}
            placeholder="代码片段标题"
            disabled={!isEditorReady || isHistoryMode}
          />
          <select
            value={isHistoryMode && previewData ? previewData.language : language}
            onChange={handleLanguageChange}
            style={styles.languageSelect}
            disabled={!isEditorReady || isHistoryMode}
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="csharp">C#</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="sql">SQL</option>
          </select>
          {isHistoryMode && (
            <label style={styles.diffToggle}>
              <input
                type="checkbox"
                checked={showDiff}
                onChange={(e) => setShowDiff(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.diffToggleText}>显示差异</span>
            </label>
          )}
        </div>
        <div style={styles.toolbarRight}>
          {isHistoryMode && (
            <button onClick={handleExitHistoryMode} style={styles.exitButton}>
              ← 返回编辑
            </button>
          )}
          <div style={styles.statusContainer}>
            <span style={{
              ...styles.statusDot,
              backgroundColor: isConnected ? '#4caf50' : '#f44336',
            }} />
            <span style={styles.statusText}>
              {isConnected ? '已连接' : '连接中...'}
            </span>
          </div>
          <div style={styles.usersContainer}>
            {onlineUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  ...styles.userAvatar,
                  backgroundColor: user.color,
                }}
                title={user.name}
              >
                {user.name.charAt(0)}
              </div>
            ))}
            <span style={styles.userCount}>{onlineUsers.length} 在线</span>
          </div>
          <button onClick={handleCopyLink} style={styles.copyButton}>
            分享链接
          </button>
        </div>
      </div>

      <div style={styles.editorContainer} onClick={isHistoryMode ? handleExitHistoryMode : undefined}>
        {!isEditorReady && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingSpinner}></div>
            <p style={styles.loadingText}>正在同步文档...</p>
          </div>
        )}
        
        {isLoadingHistory && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingSpinner}></div>
            <p style={styles.loadingText}>正在加载历史版本...</p>
          </div>
        )}
        
        {isHistoryMode && previewData ? (
          <Editor
            height="100%"
            language={previewData.language}
            value={previewData.content}
            theme="vs-dark"
            onMount={handlePreviewEditorMount}
            options={{
              fontSize: 14,
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
              lineNumbers: 'on',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 10, bottom: 10 },
              readOnly: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            defaultLanguage="javascript"
            language={language}
            theme="vs-dark"
            onMount={handleEditorMount}
            options={{
              fontSize: 14,
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
              lineNumbers: 'on',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 10, bottom: 10 },
              readOnly: !isEditorReady,
            }}
          />
        )}
        
        {isHistoryMode && diffResult && showDiff && (
          <div style={styles.diffPanel}>
            <div style={styles.diffHeader}>
              <span style={styles.diffTitle}>与当前版本差异</span>
              <div style={styles.diffStats}>
                <span style={styles.addedStat}>+{diffResult.addedCount} 新增</span>
                <span style={styles.removedStat}>-{diffResult.removedCount} 删除</span>
              </div>
            </div>
            <div style={styles.diffContent}>
              {diffResult.lines.slice(0, 100).map((line, index) => (
                <div
                  key={index}
                  style={{
                    ...styles.diffLine,
                    ...(line.type === 'added' ? styles.diffLineAdded : 
                       line.type === 'removed' ? styles.diffLineRemoved : 
                       styles.diffLineUnchanged),
                  }}
                >
                  <span style={styles.diffLineNum}>
                    {line.type === 'removed' ? line.originalLineNumber : line.newLineNumber}
                  </span>
                  <span style={styles.diffLineSign}>
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <pre style={styles.diffLineText}>
                    {line.content || ' '}
                  </pre>
                </div>
              ))}
              {diffResult.lines.length > 100 && (
                <div style={styles.diffMore}>... 更多差异已省略</div>
              )}
            </div>
          </div>
        )}
      </div>

      {!isHistoryMode && (
        <TimelineSlider
          versions={historyVersions}
          currentVersion={currentVersion}
          previewVersion={previewVersion}
          onPreviewChange={handlePreviewChange}
          onSeek={handleSeek}
          disabled={!isEditorReady || historyVersions.length === 0}
        />
      )}

      <style>{`
        .line-added {
          background: rgba(46, 160, 67, 0.2) !important;
        }
        .line-removed {
          background: rgba(248, 81, 73, 0.2) !important;
        }
        .text-added {
          color: #4ec9b0;
          text-decoration: none;
        }
        .text-removed {
          color: #f44747;
          text-decoration: line-through;
          opacity: 0.6;
        }
      `}</style>
    </div>
  )
}

const styles = {
  container: {
    height: 'calc(100vh - 60px)',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#1e1e1e',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    gap: '16px',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  titleInput: {
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    color: '#d4d4d4',
    outline: 'none',
    width: '300px',
  },
  languageSelect: {
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    color: '#d4d4d4',
    outline: 'none',
    cursor: 'pointer',
  },
  diffToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#888',
    cursor: 'pointer',
  },
  checkbox: {
    cursor: 'pointer',
  },
  diffToggleText: {
    userSelect: 'none' as const,
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '12px',
    color: '#888',
  },
  usersContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  userAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    border: '2px solid #252526',
  },
  userCount: {
    fontSize: '12px',
    color: '#888',
    marginLeft: '8px',
  },
  copyButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#0e639c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  exitButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#6c2a2a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  editorContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #3c3c3c',
    borderTop: '3px solid #007acc',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    color: '#888',
    fontSize: '14px',
  },
  diffPanel: {
    position: 'absolute' as const,
    top: '16px',
    right: '16px',
    width: '320px',
    maxHeight: 'calc(100% - 32px)',
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '6px',
    overflow: 'hidden',
    zIndex: 5,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  diffHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    backgroundColor: '#2d2d30',
    borderBottom: '1px solid #3c3c3c',
  },
  diffTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#d4d4d4',
  },
  diffStats: {
    display: 'flex',
    gap: '12px',
    fontSize: '11px',
  },
  addedStat: {
    color: '#587c0c',
  },
  removedStat: {
    color: '#ad0707',
  },
  diffContent: {
    maxHeight: 'calc(100% - 44px)',
    overflowY: 'auto' as const,
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    fontSize: '12px',
    lineHeight: '1.5',
  },
  diffLine: {
    display: 'flex',
    alignItems: 'stretch',
    padding: '2px 8px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    whiteSpace: 'pre' as const,
  },
  diffLineAdded: {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
  },
  diffLineRemoved: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
  },
  diffLineUnchanged: {
    opacity: 0.6,
  },
  diffLineNum: {
    width: '36px',
    textAlign: 'right' as const,
    paddingRight: '8px',
    color: '#858585',
    userSelect: 'none' as const,
    flexShrink: 0,
  },
  diffLineSign: {
    width: '16px',
    flexShrink: 0,
    color: '#858585',
  },
  diffLineText: {
    flex: 1,
    margin: 0,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: '#d4d4d4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'pre' as const,
  },
  diffMore: {
    padding: '8px',
    textAlign: 'center' as const,
    color: '#888',
    fontSize: '11px',
    fontStyle: 'italic',
  },
}

export default SnippetEditor
