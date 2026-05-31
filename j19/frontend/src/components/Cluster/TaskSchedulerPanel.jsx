import { useState, useEffect } from 'react'

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-slate-500' },
  { value: 'normal', label: 'Normal', color: 'bg-emerald-500' },
  { value: 'high', label: 'High', color: 'bg-amber-500' },
  { value: 'critical', label: 'Critical', color: 'bg-rose-500' },
]

const bitstreamOptions = [
  { id: 1, name: 'design_v1.0.bit', size: '4.2 MB' },
  { id: 2, name: 'design_v2.1.bit', size: '5.1 MB' },
  { id: 3, name: 'accelerator_core.bit', size: '3.8 MB' },
  { id: 4, name: 'neural_network.bit', size: '6.7 MB' },
]

function formatEstimatedTime(chunks, nodes) {
  const availableNodes = nodes.filter(n => n.status !== 'offline').length
  if (availableNodes === 0) return 'N/A'
  const chunksPerNode = Math.ceil(chunks / availableNodes)
  const seconds = chunksPerNode * 15
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} min`
}

function getNodeAssignments(chunks, nodes) {
  const availableNodes = nodes.filter(n => n.status !== 'offline')
  if (availableNodes.length === 0) return []
  const assignments = []
  for (let i = 0; i < chunks; i++) {
    assignments.push(availableNodes[i % availableNodes.length])
  }
  return assignments
}

export default function TaskSchedulerPanel({ clusterId, nodes = [], onSubmitTask, tasks = [] }) {
  const [selectedBitstream, setSelectedBitstream] = useState('')
  const [taskName, setTaskName] = useState('')
  const [priority, setPriority] = useState('normal')
  const [chunkCount, setChunkCount] = useState(4)
  const [errors, setErrors] = useState({})

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!selectedBitstream) newErrors.bitstream = 'Please select a bitstream'
    if (!taskName.trim()) newErrors.taskName = 'Please enter a task name'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const taskData = {
      bitstreamId: selectedBitstream,
      name: taskName,
      priority,
      chunks: chunkCount,
    }

    onSubmitTask?.(taskData)
    setTaskName('')
    setSelectedBitstream('')
    setChunkCount(4)
    setPriority('normal')
    setErrors({})
  }

  const nodeAssignments = getNodeAssignments(chunkCount, nodes)
  const estimatedTime = formatEstimatedTime(chunkCount, nodes)

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-semibold text-white mb-4">Task Scheduler</h2>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-white mb-4">Submit New Task</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Bitstream</label>
              <select
                value={selectedBitstream}
                onChange={(e) => setSelectedBitstream(e.target.value)}
                className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.bitstream ? 'border-rose-500' : 'border-slate-600'
                }`}
              >
                <option value="">Select a bitstream...</option>
                {bitstreamOptions.map((bs) => (
                  <option key={bs.id} value={bs.id}>
                    {bs.name} ({bs.size})
                  </option>
                ))}
              </select>
              {errors.bitstream && <p className="text-xs text-rose-400 mt-1">{errors.bitstream}</p>}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Task Name</label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Enter task name..."
                className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.taskName ? 'border-rose-500' : 'border-slate-600'
                }`}
              />
              {errors.taskName && <p className="text-xs text-rose-400 mt-1">{errors.taskName}</p>}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      priority === opt.value
                        ? `${opt.color} text-white`
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-slate-400">Chunk Count</label>
                <span className="text-xs text-white font-medium">{chunkCount} chunks</span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                value={chunkCount}
                onChange={(e) => setChunkCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span>16</span>
              </div>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-2">Node Assignment Preview</div>
              <div className="flex flex-wrap gap-1.5">
                {nodeAssignments.length > 0 ? nodeAssignments.map((node, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs"
                  >
                    {node.name}
                  </div>
                )) : (
                  <span className="text-xs text-slate-500">No available nodes</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
              <span className="text-xs text-slate-400">Estimated Time</span>
              <span className="text-sm font-semibold text-white">{estimatedTime}</span>
            </div>

            <button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-500 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={nodes.filter(n => n.status !== 'offline').length === 0}
            >
              Submit Task
            </button>
          </div>
        </form>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-white mb-4">Task Queue</h3>
          
          {tasks.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No pending tasks</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2 font-medium">Task</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Priority</th>
                    <th className="pb-2 font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-b border-slate-700/50">
                      <td className="py-2 text-white">{task.name}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          task.status === 'running' ? 'bg-amber-500/20 text-amber-400' :
                          task.status === 'pending' ? 'bg-slate-500/20 text-slate-400' :
                          task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          priorityOptions.find(p => p.value === task.priority)?.color || 'bg-slate-500'
                        } bg-opacity-20 text-white`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500"
                              style={{ width: `${task.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-8">{task.progress || 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
