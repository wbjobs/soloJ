import { useState, useEffect, useRef, useCallback } from 'react'
import ClusterTopology from '../components/Cluster/ClusterTopology.jsx'
import ClusterToolbar from '../components/Cluster/ClusterToolbar.jsx'
import LoadMonitorPanel from '../components/Cluster/LoadMonitorPanel.jsx'
import TaskSchedulerPanel from '../components/Cluster/TaskSchedulerPanel.jsx'
import NodeDetailPanel from '../components/Cluster/NodeDetailPanel.jsx'
import { nodeApi, taskApi } from '../services/clusterApi.js'

const mockNodes = [
  { id: 1, name: 'FPGA-001', status: 'idle', load: 25, temperature: 42, voltage: 3.3, current: 125, tasksCompleted: 147, x: 100, y: 100, serial: 'FPGA20240001', vid: '0x1234', pid: '0x5678', usbHandle: 'usb:1.2.3' },
  { id: 2, name: 'FPGA-002', status: 'busy', load: 78, temperature: 58, voltage: 3.28, current: 210, tasksCompleted: 89, currentTask: 'design_v1.0.bit', x: 250, y: 100, serial: 'FPGA20240002', vid: '0x1234', pid: '0x5678', usbHandle: 'usb:1.2.4' },
  { id: 3, name: 'FPGA-003', status: 'idle', load: 12, temperature: 38, voltage: 3.31, current: 95, tasksCompleted: 234, x: 400, y: 100, serial: 'FPGA20240003', vid: '0x1234', pid: '0x5678', usbHandle: 'usb:1.2.5' },
  { id: 4, name: 'FPGA-004', status: 'offline', load: 0, temperature: 25, voltage: 0, current: 0, tasksCompleted: 56, x: 100, y: 250, serial: 'FPGA20240004', vid: '0x1234', pid: '0x5678', usbHandle: 'N/A' },
  { id: 5, name: 'FPGA-005', status: 'idle', load: 33, temperature: 45, voltage: 3.29, current: 145, tasksCompleted: 178, x: 250, y: 250, serial: 'FPGA20240005', vid: '0x1234', pid: '0x5678', usbHandle: 'usb:1.2.6' },
  { id: 6, name: 'FPGA-006', status: 'error', load: 0, temperature: 72, voltage: 2.1, current: 5, tasksCompleted: 45, x: 400, y: 250, serial: 'FPGA20240006', vid: '0x1234', pid: '0x5678', usbHandle: 'usb:1.2.7' },
]

const mockConnections = [
  { source: 1, target: 2 },
  { source: 2, target: 3 },
  { source: 1, target: 5 },
  { source: 5, target: 6 },
  { source: 2, target: 5 },
]

const mockTasks = [
  { id: 1, name: 'design_v1.0.bit', status: 'running', priority: 'high', progress: 67 },
  { id: 2, name: 'accelerator_core.bit', status: 'pending', priority: 'normal', progress: 0 },
  { id: 3, name: 'neural_network.bit', status: 'pending', priority: 'low', progress: 0 },
  { id: 4, name: 'test_suite.bit', status: 'completed', priority: 'normal', progress: 100 },
]

const tabs = [
  { id: 'load', label: 'Load Monitor' },
  { id: 'scheduler', label: 'Task Scheduler' },
  { id: 'tasks', label: 'Task Status' },
]

export default function Cluster() {
  const [nodes, setNodes] = useState(mockNodes)
  const [connections] = useState(mockConnections)
  const [selectedNode, setSelectedNode] = useState(null)
  const [tasks, setTasks] = useState(mockTasks)
  const [layoutMode, setLayoutMode] = useState('grid')
  const [activeTab, setActiveTab] = useState('load')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sseStatus, setSseStatus] = useState('connecting')
  const eventSourceRef = useRef(null)

  const clusterId = 'default'

  const refreshMetrics = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const { data } = await nodeApi.getAllMetrics(clusterId)
      if (data?.metrics) {
        setNodes((prev) =>
          prev.map((node) => {
            const metric = data.metrics.find((m) => m.nodeId === node.id)
            return metric ? { ...node, ...metric } : node
          })
        )
      }
    } catch (err) {
      setNodes((prev) =>
        prev.map((node) => ({
          ...node,
          load: Math.max(0, Math.min(100, node.load + (Math.random() - 0.5) * 20)),
          temperature: Math.max(25, Math.min(85, node.temperature + (Math.random() - 0.5) * 5)),
          voltage: node.status !== 'offline' ? 3.25 + Math.random() * 0.1 : 0,
          current: node.status !== 'offline' ? 100 + Math.random() * 100 : 0,
        }))
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [clusterId])

  const refreshTasks = useCallback(async () => {
    try {
      const { data } = await taskApi.getQueue(clusterId)
      if (data?.tasks) {
        setTasks(data.tasks)
      }
    } catch (err) {
      setTasks((prev) =>
        prev.map((task) =>
          task.status === 'running'
            ? { ...task, progress: Math.min(100, task.progress + Math.random() * 5) }
            : task
        )
      )
    }
  }, [clusterId])

  useEffect(() => {
    const metricsInterval = setInterval(refreshMetrics, 5000)
    const tasksInterval = setInterval(refreshTasks, 2000)

    return () => {
      clearInterval(metricsInterval)
      clearInterval(tasksInterval)
    }
  }, [refreshMetrics, refreshTasks])

  useEffect(() => {
    const sseUrl = `/api/clusters/${clusterId}/stream`
    
    try {
      eventSourceRef.current = new EventSource(sseUrl)

      eventSourceRef.current.onopen = () => {
        setSseStatus('connected')
      }

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'metrics') {
            setNodes((prev) =>
              prev.map((node) =>
                node.id === data.nodeId ? { ...node, ...data.metrics } : node
              )
            )
          } else if (data.type === 'task') {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === data.taskId ? { ...task, ...data.task } : task
              )
            )
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      eventSourceRef.current.onerror = () => {
        setSseStatus('disconnected')
        eventSourceRef.current?.close()
      }
    } catch (err) {
      setSseStatus('disconnected')
    }

    return () => {
      eventSourceRef.current?.close()
    }
  }, [clusterId])

  const handleNodeSelect = (node) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node))
  }

  const handleNodeMove = (node) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, x: node.x, y: node.y } : n))
    )
  }

  const handleNodeUpdate = (updatedNode) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    )
    setSelectedNode(updatedNode)
  }

  const handleSubmitTask = async (taskData) => {
    try {
      const { data } = await taskApi.submit(clusterId, taskData)
      setTasks((prev) => [...prev, data.task || { ...taskData, id: Date.now(), status: 'pending', progress: 0 }])
    } catch (err) {
      setTasks((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: taskData.name,
          status: 'pending',
          priority: taskData.priority,
          progress: 0,
        },
      ])
    }
  }

  const handleAddNode = () => {
    const newId = Math.max(...nodes.map((n) => n.id)) + 1
    const newNode = {
      id: newId,
      name: `FPGA-${String(newId).padStart(3, '0')}`,
      status: 'idle',
      load: 0,
      temperature: 35,
      voltage: 3.3,
      current: 50,
      tasksCompleted: 0,
      x: 150 + (newId % 4) * 120,
      y: 150 + Math.floor(newId / 4) * 120,
      serial: `FPGA2024${String(newId).padStart(4, '0')}`,
      vid: '0x1234',
      pid: '0x5678',
      usbHandle: `usb:1.${newId}.0`,
    }
    setNodes((prev) => [...prev, newNode])
  }

  const handleRemoveNode = () => {
    if (selectedNode) {
      setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id))
      setSelectedNode(null)
    }
  }

  const clusterStatus = nodes.some((n) => n.status === 'error')
    ? 'degraded'
    : nodes.every((n) => n.status === 'offline')
    ? 'offline'
    : 'online'

  return (
    <div className="h-full flex flex-col">
      <ClusterToolbar
        clusterName="FPGA Compute Cluster"
        clusterStatus={clusterStatus}
        onAddNode={handleAddNode}
        onRemoveNode={handleRemoveNode}
        onRefresh={refreshMetrics}
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
        nodeCount={nodes.length}
      />

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-3/5 flex flex-col min-h-0">
          <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <ClusterTopology
              nodes={nodes}
              connections={connections}
              selectedNode={selectedNode}
              onNodeSelect={handleNodeSelect}
              onNodeMove={handleNodeMove}
              layoutMode={layoutMode}
            />
          </div>
        </div>

        <div className="w-2/5 flex flex-col min-h-0 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex border-b border-slate-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary-400 border-b-2 border-primary-400 bg-slate-700/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden p-4">
            {activeTab === 'load' && (
              <LoadMonitorPanel
                nodes={nodes}
                selectedNode={selectedNode}
                onNodeSelect={handleNodeSelect}
              />
            )}
            {activeTab === 'scheduler' && (
              <TaskSchedulerPanel
                clusterId={clusterId}
                nodes={nodes}
                onSubmitTask={handleSubmitTask}
                tasks={tasks.filter((t) => t.status === 'pending' || t.status === 'running')}
              />
            )}
            {activeTab === 'tasks' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">All Tasks</h2>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${sseStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-xs text-slate-400 capitalize">{sseStatus}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{task.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            task.status === 'running'
                              ? 'bg-amber-500/20 text-amber-400'
                              : task.status === 'pending'
                              ? 'bg-slate-500/20 text-slate-400'
                              : task.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              task.status === 'completed'
                                ? 'bg-emerald-500'
                                : task.status === 'error'
                                ? 'bg-rose-500'
                                : 'bg-primary-500'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-10 text-right">
                          {Math.round(task.progress)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={handleNodeUpdate}
        />
      )}
    </div>
  )
}
