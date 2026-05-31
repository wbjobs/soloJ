import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const statusColors = {
  offline: '#64748b',
  idle: '#22c55e',
  busy: '#f59e0b',
  error: '#ef4444',
}

const statusLabels = {
  offline: 'Offline',
  idle: 'Idle',
  busy: 'Busy',
  error: 'Error',
}

function generateMetricHistory() {
  const now = new Date()
  const labels = []
  const tempData = []
  const loadData = []

  for (let i = 29; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 2000)
    labels.push(time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tempData.push(Math.round(35 + Math.random() * 30))
    loadData.push(Math.round(Math.random() * 100))
  }

  return { labels, tempData, loadData }
}

export default function NodeDetailPanel({ node, onClose, onUpdate }) {
  const [positionX, setPositionX] = useState(node?.x || 0)
  const [positionY, setPositionY] = useState(node?.y || 0)
  const [metricHistory, setMetricHistory] = useState(generateMetricHistory())

  useEffect(() => {
    if (node) {
      setPositionX(node.x || 0)
      setPositionY(node.y || 0)
    }
  }, [node])

  useEffect(() => {
    const interval = setInterval(() => {
      setMetricHistory((prev) => {
        const now = new Date()
        const newLabel = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const newTemp = Math.round(35 + Math.random() * 30)
        const newLoad = Math.round(Math.random() * 100)

        return {
          labels: [...prev.labels.slice(1), newLabel],
          tempData: [...prev.tempData.slice(1), newTemp],
          loadData: [...prev.loadData.slice(1), newLoad],
        }
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  if (!node) return null

  const chartData = {
    labels: metricHistory.labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: metricHistory.tempData,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'Load (%)',
        data: metricHistory.loadData,
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
        fill: true,
        yAxisID: 'y1',
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#94a3b8', usePointStyle: true, padding: 12 },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(71, 85, 105, 0.3)' },
        ticks: { color: '#94a3b8', maxTicksLimit: 6 },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: { color: 'rgba(71, 85, 105, 0.3)' },
        ticks: { color: '#94a3b8' },
        title: { display: true, text: 'Temperature (°C)', color: '#94a3b8' },
        min: 0,
        max: 100,
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { color: '#94a3b8' },
        title: { display: true, text: 'Load (%)', color: '#94a3b8' },
        min: 0,
        max: 100,
      },
    },
  }

  const taskHistory = [
    { id: 1, name: 'design_v1.0.bit', status: 'completed', duration: '2m 30s', time: '5 min ago' },
    { id: 2, name: 'accelerator_core.bit', status: 'completed', duration: '1m 45s', time: '12 min ago' },
    { id: 3, name: 'neural_network.bit', status: 'completed', duration: '3m 15s', time: '25 min ago' },
  ]

  const handleSavePosition = () => {
    onUpdate?.({ ...node, x: positionX, y: positionY })
  }

  return (
    <div className="bg-slate-800 border-t border-slate-700">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: statusColors[node.status] || statusColors.offline }}
          />
          <div>
            <h2 className="text-lg font-semibold text-white">{node.name}</h2>
            <p className="text-sm text-slate-400">{statusLabels[node.status] || 'Offline'}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 max-h-80 overflow-y-auto">
        <div className="space-y-4">
          <div className="bg-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Device Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Serial</span>
                <span className="text-white font-mono">{node.serial || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">VID</span>
                <span className="text-white font-mono">{node.vid || '0x0000'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PID</span>
                <span className="text-white font-mono">{node.pid || '0x0000'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">USB Handle</span>
                <span className="text-white font-mono">{node.usbHandle || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Position</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">X Coordinate</label>
                <input
                  type="number"
                  value={positionX}
                  onChange={(e) => setPositionX(parseFloat(e.target.value))}
                  className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Y Coordinate</label>
                <input
                  type="number"
                  value={positionY}
                  onChange={(e) => setPositionY(parseFloat(e.target.value))}
                  className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <button
                onClick={handleSavePosition}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white text-sm py-2 rounded-lg transition-colors"
              >
                Save Position
              </button>
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Controls</h3>
            <div className="space-y-2">
              <button className="w-full bg-amber-600 hover:bg-amber-500 text-white text-sm py-2 rounded-lg transition-colors">
                Reboot Node
              </button>
              <button className="w-full bg-slate-600 hover:bg-slate-500 text-white text-sm py-2 rounded-lg transition-colors">
                Reset Device
              </button>
              <button className="w-full bg-rose-600 hover:bg-rose-500 text-white text-sm py-2 rounded-lg transition-colors">
                Remove from Cluster
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-700/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-white mb-3">Real-time Metrics</h3>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-white mb-3">Task History</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {taskHistory.map((task) => (
              <div key={task.id} className="p-2 bg-slate-600/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white truncate">{task.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    {task.status}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{task.duration}</span>
                  <span>{task.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
