import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { open } from '@tauri-apps/api/dialog'
import { listen } from '@tauri-apps/api/event'
import './App.css'

function App() {
  const [ports, setPorts] = useState([])
  const [selectedPort, setSelectedPort] = useState('')
  const [baudRate, setBaudRate] = useState('9600')
  const [dataBits, setDataBits] = useState('8')
  const [stopBits, setStopBits] = useState('1')
  const [parity, setParity] = useState('None')
  const [isOpen, setIsOpen] = useState(false)
  const [hexCommand, setHexCommand] = useState('')
  const [logEntries, setLogEntries] = useState([])
  const [isLogging, setIsLogging] = useState(false)
  const [logPath, setLogPath] = useState('')
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)

  const [replayCommands, setReplayCommands] = useState([])
  const [replayRunning, setReplayRunning] = useState(false)
  const [replayPaused, setReplayPaused] = useState(false)
  const [replayIndex, setReplayIndex] = useState(-1)
  const [activeTab, setActiveTab] = useState('terminal')

  const lastSendTime = useRef(0)
  const logEndRef = useRef(null)
  const MIN_SEND_INTERVAL = 20

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight
    }
  }, [logEntries])

  useEffect(() => {
    const unlisten = listen('replay-event', (event) => {
      const payload = event.payload
      if (payload.event_type === 'replay-step') {
        setReplayIndex(payload.index)
        if (payload.log_entry) {
          setLogEntries(prev => [...prev, { ...payload.log_entry, isReplay: true }])
        }
      } else if (payload.event_type === 'replay-done') {
        setReplayRunning(false)
        setReplayPaused(false)
        setReplayIndex(-1)
      }
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const loadPorts = useCallback(async () => {
    try {
      const availablePorts = await invoke('get_ports')
      setPorts(availablePorts)
    } catch (err) {
      console.error('获取串口列表失败:', err)
    }
  }, [])

  useEffect(() => { loadPorts() }, [loadPorts])

  useEffect(() => {
    let interval
    if (isOpen) {
      interval = setInterval(async () => {
        try {
          const result = await invoke('read_data')
          if (result) {
            setLogEntries(prev => [...prev, { ...result, isReplay: replayRunning }])
          }
        } catch (err) {
          console.error('读取数据失败:', err)
        }
      }, 50)
    }
    return () => clearInterval(interval)
  }, [isOpen, replayRunning])

  const handleOpenPort = async () => {
    if (!selectedPort) { setError('请选择串口'); return }
    try {
      setError('')
      await invoke('open_port', {
        config: {
          port_name: selectedPort,
          baud_rate: parseInt(baudRate),
          data_bits: parseInt(dataBits),
          stop_bits: parseInt(stopBits),
          parity: parity,
        },
      })
      setIsOpen(true)
      setError('串口已打开')
      setTimeout(() => setError(''), 2000)
    } catch (err) {
      setError(`${err}`)
      setIsOpen(false)
    }
  }

  const handleClosePort = async () => {
    try {
      if (replayRunning) { await invoke('stop_replay_cmd') }
      setError('')
      await invoke('close_port')
      setIsOpen(false)
      setReplayRunning(false)
      setReplayPaused(false)
      setReplayIndex(-1)
      setError('串口已关闭')
      setTimeout(() => setError(''), 2000)
    } catch (err) {
      setError(`关闭串口失败: ${err}`)
    }
  }

  const handleSendCommand = async () => {
    if (!hexCommand.trim()) { setError('请输入 Hex 指令'); return }
    const now = Date.now()
    if (now - lastSendTime.current < MIN_SEND_INTERVAL) { setError('发送过于频繁，请稍候再试'); return }
    lastSendTime.current = now
    if (isSending) { setError('正在发送中，请稍候'); return }
    try {
      setIsSending(true)
      setError('')
      const result = await invoke('send_command', { hexCommand: hexCommand.trim() })
      setLogEntries(prev => [...prev, result])
      setHexCommand('')
    } catch (err) {
      setError(`发送指令失败: ${err}`)
    } finally {
      setIsSending(false)
    }
  }

  const handleQuickSend = async (command) => {
    if (!isOpen || isSending) return
    const now = Date.now()
    if (now - lastSendTime.current < MIN_SEND_INTERVAL) return
    lastSendTime.current = now
    try {
      setIsSending(true)
      const result = await invoke('send_command', { hexCommand: command })
      setLogEntries(prev => [...prev, result])
    } catch (err) {
      setError(`发送失败: ${err}`)
    } finally {
      setIsSending(false)
    }
  }

  const handleStartLogging = async () => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (selected) {
        const path = await invoke('start_logging', { logDir: selected })
        setLogPath(path)
        setIsLogging(true)
        setError('日志记录已启动')
        setTimeout(() => setError(''), 2000)
      }
    } catch (err) {
      setError(`启动日志失败: ${err}`)
    }
  }

  const handleStopLogging = async () => {
    try {
      await invoke('stop_logging')
      setIsLogging(false)
      setLogPath('')
      setError('日志记录已停止')
      setTimeout(() => setError(''), 2000)
    } catch (err) {
      setError(`停止日志失败: ${err}`)
    }
  }

  const handleClearLog = () => { setLogEntries([]) }

  const handleLoadLogFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: '日志文件', extensions: ['log'] }],
      })
      if (selected) {
        const commands = await invoke('parse_log', { filePath: selected })
        setReplayCommands(commands)
        setReplayIndex(-1)
        setError(`已加载 ${commands.length} 条指令`)
        setTimeout(() => setError(''), 2000)
        setActiveTab('replay')
      }
    } catch (err) {
      setError(`加载日志失败: ${err}`)
    }
  }

  const handleDelayChange = (index, value) => {
    const ms = parseInt(value) || 0
    setReplayCommands(prev => prev.map((cmd, i) => i === index ? { ...cmd, delay_ms: ms } : cmd))
  }

  const handleDelayBlur = async (index, value) => {
    const ms = parseInt(value) || 0
    try {
      await invoke('update_delay', { index, delayMs: ms })
    } catch (err) {
      console.error('更新延迟失败:', err)
    }
  }

  const handleStartReplay = async () => {
    if (!isOpen) { setError('请先打开串口'); return }
    if (replayCommands.length === 0) { setError('请先加载日志文件'); return }
    try {
      setError('')
      await invoke('start_replay_cmd', { commands: replayCommands })
      setReplayRunning(true)
      setReplayPaused(false)
      setReplayIndex(0)
    } catch (err) {
      setError(`启动回放失败: ${err}`)
    }
  }

  const handleStopReplay = async () => {
    try {
      await invoke('stop_replay_cmd')
      setReplayRunning(false)
      setReplayPaused(false)
      setReplayIndex(-1)
    } catch (err) {
      setError(`停止回放失败: ${err}`)
    }
  }

  const handlePauseReplay = async () => {
    try {
      await invoke('pause_replay_cmd')
      setReplayPaused(true)
    } catch (err) {
      setError(`暂停回放失败: ${err}`)
    }
  }

  const handleResumeReplay = async () => {
    try {
      await invoke('resume_replay_cmd')
      setReplayPaused(false)
    } catch (err) {
      setError(`恢复回放失败: ${err}`)
    }
  }

  const handleDeleteCommand = (index) => {
    setReplayCommands(prev => prev.filter((_, i) => i !== index).map((cmd, i) => ({ ...cmd, index: i })))
  }

  const handleAddCommand = () => {
    const newCmd = {
      index: replayCommands.length,
      hex_data: '00',
      ascii_data: '.',
      delay_ms: 500,
      original_timestamp: '',
    }
    setReplayCommands(prev => [...prev, newCmd])
  }

  const quickCommands = [
    { label: '01 03 00 00 00 01', desc: '读寄存器' },
    { label: '01 06 00 00 00 01', desc: '写寄存器' },
  ]

  const replayProgress = replayCommands.length > 0 && replayIndex >= 0
    ? Math.round(((replayIndex + 1) / replayCommands.length) * 100)
    : 0

  return (
    <div className="app">
      <header className="header">
        <h1>串口调试工具</h1>
        <div className="header-status">
          {replayRunning && (
            <span className={`replay-badge ${replayPaused ? 'paused' : 'running'}`}>
              {replayPaused ? '⏸ 回放暂停' : '▶ 回放中'} {replayIndex + 1}/{replayCommands.length}
            </span>
          )}
          <span className={`status-indicator ${isOpen ? 'online' : 'offline'}`}>
            {isOpen ? '已连接' : '未连接'}
          </span>
        </div>
      </header>

      <div className="main-content">
        <div className="config-panel">
          <h2>串口配置</h2>

          <div className="form-group">
            <label>串口</label>
            <select value={selectedPort} onChange={(e) => setSelectedPort(e.target.value)} disabled={isOpen}>
              <option value="">选择串口</option>
              {ports.map((port) => (<option key={port} value={port}>{port}</option>))}
            </select>
            <button onClick={loadPorts} disabled={isOpen} className="refresh-btn">刷新</button>
          </div>

          <div className="form-group">
            <label>波特率</label>
            <select value={baudRate} onChange={(e) => setBaudRate(e.target.value)} disabled={isOpen}>
              <option value="9600">9600</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200">115200</option>
            </select>
          </div>

          <div className="form-group">
            <label>数据位</label>
            <select value={dataBits} onChange={(e) => setDataBits(e.target.value)} disabled={isOpen}>
              <option value="5">5</option><option value="6">6</option>
              <option value="7">7</option><option value="8">8</option>
            </select>
          </div>

          <div className="form-group">
            <label>停止位</label>
            <select value={stopBits} onChange={(e) => setStopBits(e.target.value)} disabled={isOpen}>
              <option value="1">1</option><option value="2">2</option>
            </select>
          </div>

          <div className="form-group">
            <label>校验位</label>
            <select value={parity} onChange={(e) => setParity(e.target.value)} disabled={isOpen}>
              <option value="None">无</option>
              <option value="Odd">奇校验</option>
              <option value="Even">偶校验</option>
            </select>
          </div>

          <div className="button-group">
            {!isOpen ? (
              <button onClick={handleOpenPort} className="primary-btn">打开串口</button>
            ) : (
              <button onClick={handleClosePort} className="danger-btn">关闭串口</button>
            )}
          </div>

          <div className="log-control">
            <h3>日志记录</h3>
            {!isLogging ? (
              <button onClick={handleStartLogging} className="secondary-btn">开始记录日志</button>
            ) : (
              <button onClick={handleStopLogging} className="secondary-btn">停止记录日志</button>
            )}
            {logPath && <p className="log-path">日志文件: {logPath}</p>}
          </div>

          <div className="quick-commands">
            <h3>快捷指令</h3>
            {quickCommands.map((cmd, index) => (
              <button key={index} onClick={() => handleQuickSend(cmd.label)} disabled={!isOpen || isSending} className="quick-btn" title={cmd.desc}>
                {cmd.label}
              </button>
            ))}
          </div>
        </div>

        <div className="data-panel">
          {error && (
            <div className={`error-message ${error.includes('失败') ? '' : 'success'}`}>
              {error}
            </div>
          )}

          <div className="command-input">
            <h2>发送 Hex 指令</h2>
            <input
              type="text"
              value={hexCommand}
              onChange={(e) => setHexCommand(e.target.value)}
              placeholder="输入 Hex 指令，如: 01 03 00 00 00 01"
              disabled={!isOpen || isSending || replayRunning}
              onKeyPress={(e) => e.key === 'Enter' && handleSendCommand()}
            />
            <button onClick={handleSendCommand} disabled={!isOpen || isSending || replayRunning} className="primary-btn send-btn">
              {isSending ? '发送中...' : '发送'}
            </button>
          </div>

          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>
              终端
            </button>
            <button className={`tab-btn ${activeTab === 'replay' ? 'active' : ''}`} onClick={() => setActiveTab('replay')}>
              脚本回放 {replayCommands.length > 0 && `(${replayCommands.length})`}
            </button>
          </div>

          {activeTab === 'terminal' && (
            <div className="log-display">
              <div className="log-header">
                <h2>数据日志 ({logEntries.length} 条)</h2>
                <button onClick={handleClearLog} className="secondary-btn small">清空</button>
              </div>
              <div className="log-content" ref={logEndRef}>
                {logEntries.length === 0 ? (
                  <p className="empty-log">暂无数据</p>
                ) : (
                  logEntries.map((entry, index) => (
                    <div key={index} className={`log-entry ${entry.direction === 'TX' ? 'tx' : 'rx'} ${entry.isReplay ? 'replay-highlight' : ''}`}>
                      <span className="timestamp">[{entry.timestamp}]</span>
                      <span className={`direction ${entry.direction.toLowerCase()}`}>[{entry.direction}]</span>
                      {entry.isReplay && <span className="replay-tag">回放</span>}
                      <span className="hex">HEX: {entry.hex_data}</span>
                      <span className="ascii">ASCII: {entry.ascii_data}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'replay' && (
            <div className="replay-panel">
              <div className="replay-toolbar">
                <button onClick={handleLoadLogFile} className="secondary-btn" disabled={replayRunning}>
                  加载 .log 文件
                </button>
                <button onClick={handleAddCommand} className="secondary-btn" disabled={replayRunning}>
                  添加指令
                </button>
                {!replayRunning ? (
                  <button onClick={handleStartReplay} className="primary-btn replay-start" disabled={!isOpen || replayCommands.length === 0}>
                    ▶ 开始回放
                  </button>
                ) : (
                  <>
                    {!replayPaused ? (
                      <button onClick={handlePauseReplay} className="secondary-btn">⏸ 暂停</button>
                    ) : (
                      <button onClick={handleResumeReplay} className="primary-btn">▶ 继续</button>
                    )}
                    <button onClick={handleStopReplay} className="danger-btn">⏹ 停止</button>
                  </>
                )}
              </div>

              {replayRunning && (
                <div className="replay-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${replayProgress}%` }}></div>
                  </div>
                  <span className="progress-text">{replayProgress}% ({replayIndex + 1}/{replayCommands.length})</span>
                </div>
              )}

              <div className="replay-commands-list">
                {replayCommands.length === 0 ? (
                  <p className="empty-log">请加载 .log 文件或手动添加指令</p>
                ) : (
                  replayCommands.map((cmd, index) => (
                    <div key={index} className={`replay-cmd-item ${replayIndex === index ? 'active' : ''} ${index < replayIndex && replayRunning ? 'done' : ''}`}>
                      <div className="replay-cmd-index">
                        {index < replayIndex && replayRunning ? '✓' : `#${index + 1}`}
                      </div>
                      <div className="replay-cmd-data">
                        <span className="replay-hex">{cmd.hex_data}</span>
                        <span className="replay-ascii">{cmd.ascii_data}</span>
                      </div>
                      <div className="replay-cmd-delay">
                        <label>延迟:</label>
                        <input
                          type="number"
                          value={cmd.delay_ms}
                          onChange={(e) => handleDelayChange(index, e.target.value)}
                          onBlur={(e) => handleDelayBlur(index, e.target.value)}
                          min="0"
                          max="30000"
                          step="100"
                          disabled={replayRunning}
                        />
                        <span>ms</span>
                      </div>
                      {!replayRunning && (
                        <button className="delete-cmd-btn" onClick={() => handleDeleteCommand(index)}>✕</button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App