import { useState, useRef, useEffect, useCallback } from 'react'
import { useDevice } from '../../context/DeviceContext.jsx'

const QUICK_COMMANDS = [
  { category: 'Memory', commands: [
    { label: 'Read Mem', cmd: 'mem read 0x100' },
    { label: 'Dump Mem', cmd: 'mem dump 0x100 256' },
    { label: 'Fill Mem', cmd: 'mem fill 0x100 0xFF 256' },
  ]},
  { category: 'Register', commands: [
    { label: 'Read Reg', cmd: 'reg read 0x00' },
    { label: 'Write Reg', cmd: 'reg write 0x00 0x55' },
  ]},
  { category: 'JTAG', commands: [
    { label: 'Reset', cmd: 'jtag reset' },
    { label: 'IR Scan', cmd: 'jtag ir_scan' },
    { label: 'DR Scan', cmd: 'jtag dr_scan' },
    { label: 'Shift', cmd: 'jtag shift 0x01' },
  ]},
  { category: 'Debug', commands: [
    { label: 'Step', cmd: 'debug step' },
    { label: 'Continue', cmd: 'debug continue' },
    { label: 'Halt', cmd: 'debug halt' },
    { label: 'Break', cmd: 'debug break' },
  ]},
]

function formatTimestamp() {
  const now = new Date()
  return now.toLocaleTimeString('en-US', { hour12: false }) +
    '.' + String(now.getMilliseconds()).padStart(3, '0')
}

function parseCommand(cmd) {
  const parts = cmd.trim().split(/\s+/)
  const command = parts[0].toLowerCase()
  const args = parts.slice(1)
  return { command, args, raw: cmd.trim() }
}

function executeSimulated(parsed) {
  const { command, args } = parsed

  switch (command) {
    case 'help':
      return {
        type: 'response',
        content: `Available commands:
  mem read <addr>            - Read memory at address
  mem write <addr> <data>    - Write memory at address
  mem dump <addr> <length>   - Dump memory range
  mem fill <addr> <val> <len>- Fill memory range
  reg read <addr>            - Read register
  reg write <addr> <data>    - Write register
  reg modify <addr> <mask>   - Modify register bits
  jtag reset                 - Reset JTAG chain
  jtag shift <data>          - Shift JTAG data
  jtag ir_scan               - Scan JTAG IR
  jtag dr_scan               - Scan JTAG DR
  debug step                 - Single step
  debug continue             - Continue execution
  debug halt                 - Halt execution
  debug break                - Break at current position
  help                       - Show this help
  clear                      - Clear console output`,
      }

    case 'mem': {
      const sub = args[0]?.toLowerCase()
      const addr = args[1] ? parseInt(args[1], 16) : 0x100

      if (sub === 'read') {
        return {
          type: 'data',
          content: `[0x${addr.toString(16).padStart(8, '0').toUpperCase()}] = 0x${
            Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase()
          }`,
        }
      } else if (sub === 'write') {
        const data = args[2] || '0x00'
        return {
          type: 'response',
          content: `Write ${data} to 0x${addr.toString(16).padStart(8, '0').toUpperCase()}`,
        }
      } else if (sub === 'dump') {
        const length = args[2] ? parseInt(args[2], 10) : 64
        let dump = ''
        for (let i = 0; i < length; i += 16) {
          const rowAddr = addr + i
          let hexRow = ''
          let asciiRow = ''
          for (let j = 0; j < 16 && i + j < length; j++) {
            const val = Math.floor(Math.random() * 256)
            hexRow += val.toString(16).padStart(2, '0') + ' '
            asciiRow += val >= 32 && val < 127 ? String.fromCharCode(val) : '.'
          }
          dump += `${rowAddr.toString(16).padStart(8, '0').toUpperCase()}  ${hexRow.padEnd(48)} |${asciiRow}|\n`
        }
        return { type: 'data', content: dump }
      } else if (sub === 'fill') {
        const val = args[2] || '0xFF'
        const len = args[3] ? parseInt(args[3], 10) : 64
        return {
          type: 'response',
          content: `Filled ${len} bytes at 0x${addr.toString(16).padStart(8, '0').toUpperCase()} with ${val}`,
        }
      }
      return { type: 'error', content: `Unknown mem subcommand: ${sub || '(none)'}` }
    }

    case 'reg': {
      const sub = args[0]?.toLowerCase()
      const addr = args[1] || '0x00'

      if (sub === 'read') {
        return {
          type: 'data',
          content: `REG[${addr}] = 0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase()}`,
        }
      } else if (sub === 'write') {
        const data = args[2] || '0x00'
        return { type: 'response', content: `REG[${addr}] <- ${data}` }
      } else if (sub === 'modify') {
        const mask = args[2] || '0xFF'
        return { type: 'response', content: `REG[${addr}] modified with mask ${mask}` }
      }
      return { type: 'error', content: `Unknown reg subcommand: ${sub || '(none)'}` }
    }

    case 'jtag': {
      const sub = args[0]?.toLowerCase()

      if (sub === 'reset') {
        return { type: 'response', content: 'JTAG chain reset complete' }
      } else if (sub === 'shift') {
        const data = args[1] || '0x00'
        return { type: 'response', content: `JTAG shift: TX=${data} RX=0x${Math.floor(Math.random() * 0xFF).toString(16).padStart(2, '0').toUpperCase()}` }
      } else if (sub === 'ir_scan') {
        return { type: 'data', content: `JTAG IR Scan:\n  IDCODE: 0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase()}\n  USERCODE: 0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase()}` }
      } else if (sub === 'dr_scan') {
        return { type: 'data', content: `JTAG DR Scan: 0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase()}` }
      }
      return { type: 'error', content: `Unknown jtag subcommand: ${sub || '(none)'}` }
    }

    case 'debug': {
      const sub = args[0]?.toLowerCase()

      if (sub === 'step') {
        return { type: 'response', content: 'Single step executed. PC = 0x00000104' }
      } else if (sub === 'continue') {
        return { type: 'response', content: 'Execution resumed' }
      } else if (sub === 'halt') {
        return { type: 'response', content: 'Execution halted. PC = 0x00000104' }
      } else if (sub === 'break') {
        return { type: 'response', content: 'Breakpoint set at current PC' }
      }
      return { type: 'error', content: `Unknown debug subcommand: ${sub || '(none)'}` }
    }

    case 'clear':
      return { type: 'clear' }

    default:
      return { type: 'error', content: `Unknown command: ${command}. Type 'help' for available commands.` }
  }
}

export default function DebugConsole({ device, onCommandSubmit, onCommandResult }) {
  const { connectionStatus } = useDevice()

  const [entries, setEntries] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isExecuting, setIsExecuting] = useState(false)
  const [timeoutMs, setTimeoutMs] = useState(5000)
  const [cancelled, setCancelled] = useState(false)
  const cancelRef = useRef(null)

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const cancelTokenRef = useRef({ cancelled: false })

  useEffect(() => {
    setEntries([
      {
        type: 'info',
        content: `FPGA Remote Debug Console v1.0.0\nDevice: ${connectionStatus === 'connected' ? (device?.productName || 'Connected') : 'Not connected (simulation mode)'}\nType 'help' for available commands.`,
        timestamp: formatTimestamp(),
      },
    ])
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [entries])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const addEntry = useCallback((type, content) => {
    setEntries((prev) => [...prev, { type, content, timestamp: formatTimestamp() }])
  }, [])

  const executeCommand = useCallback(async (cmdStr) => {
    if (!cmdStr.trim()) return

    const parsed = parseCommand(cmdStr)
    cancelTokenRef.current = { cancelled: false }
    setIsExecuting(true)
    setCancelled(false)

    addEntry('command', cmdStr)

    setCommandHistory((prev) => [...prev, cmdStr])
    setHistoryIndex(-1)

    try {
      if (onCommandSubmit) {
        await onCommandSubmit(parsed)
      }

      if (parsed.command === 'clear') {
        setEntries([])
        setIsExecuting(false)
        return
      }

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!cancelTokenRef.current.cancelled) {
            resolve()
          }
        }, Math.random() * 500 + 100)
        cancelRef.current = timer
      })

      if (cancelTokenRef.current.cancelled) {
        addEntry('error', 'Command cancelled')
        setIsExecuting(false)
        return
      }

      const result = executeSimulated(parsed)

      if (result.type !== 'clear') {
        addEntry(result.type, result.content)
      } else {
        setEntries([])
      }

      if (onCommandResult) {
        onCommandResult(parsed, result)
      }
    } catch (err) {
      addEntry('error', err.message || 'Command execution failed')
    } finally {
      setIsExecuting(false)
    }
  }, [addEntry, onCommandSubmit, onCommandResult])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isExecuting) {
      const cmd = inputValue
      setInputValue('')
      executeCommand(cmd)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < 0 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setInputValue(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setInputValue('')
        } else {
          setHistoryIndex(newIndex)
          setInputValue(commandHistory[newIndex])
        }
      }
    } else if (e.key === 'Escape' && isExecuting) {
      cancelTokenRef.current.cancelled = true
      setCancelled(true)
      if (cancelRef.current) {
        clearTimeout(cancelRef.current)
      }
    }
  }

  const handleQuickCommand = (cmd) => {
    setInputValue(cmd)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleExportLog = () => {
    const log = entries
      .map((e) => `[${e.timestamp}] ${e.type.toUpperCase()}: ${e.content}`)
      .join('\n')
    const blob = new Blob([log], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `debug_console_${Date.now()}.log`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    setEntries([])
  }

  const getEntryClass = (type) => {
    switch (type) {
      case 'command': return 'text-primary-400'
      case 'response': return 'text-slate-300'
      case 'data': return 'text-emerald-400'
      case 'error': return 'text-rose-400'
      case 'info': return 'text-slate-500'
      default: return 'text-slate-400'
    }
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">Debug Console</h3>
            <span className={`flex items-center gap-1.5 text-xs ${
              connectionStatus === 'connected' ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-500'
              }`} />
              {connectionStatus === 'connected' ? 'Hardware' : 'Simulation'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              title="Clear output"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={handleExportLog}
              disabled={entries.length === 0}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-50"
              title="Export log"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 flex-wrap">
          {QUICK_COMMANDS.map((group) => (
            <div key={group.category} className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">{group.category}:</span>
              {group.commands.map((qc) => (
                <button
                  key={qc.label}
                  onClick={() => handleQuickCommand(qc.cmd)}
                  disabled={isExecuting}
                  className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  {qc.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-slate-900"
      >
        {entries.map((entry, i) => (
          <div key={i} className="mb-1">
            <span className="text-slate-600 mr-2">[{entry.timestamp}]</span>
            {entry.type === 'command' && (
              <span className="text-primary-500 mr-1">{'>'}</span>
            )}
            <pre className={`inline whitespace-pre-wrap ${getEntryClass(entry.type)}`}>
              {entry.content}
            </pre>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <span className={`text-sm ${isExecuting ? 'text-amber-400' : 'text-primary-400'}`}>
            {isExecuting ? '...' : '>'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder={isExecuting ? 'Command executing...' : "Enter command (type 'help' for list)"}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-mono"
          />
          {isExecuting && (
            <button
              onClick={() => {
                cancelTokenRef.current.cancelled = true
                setCancelled(true)
                if (cancelRef.current) {
                  clearTimeout(cancelRef.current)
                }
              }}
              className="px-2 py-1 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <span>Use ↑↓ for history | Enter to execute | Esc to cancel</span>
          <span>{entries.length} entries</span>
        </div>
      </div>
    </div>
  )
}
