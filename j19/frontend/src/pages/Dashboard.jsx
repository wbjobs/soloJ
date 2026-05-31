import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { bitstreamApi } from '../services/api.js'
import { useDevice } from '../context/DeviceContext.jsx'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export default function Dashboard() {
  const { usbDevices, connectionStatus, selectedDevice } = useDevice()
  const [stats, setStats] = useState({
    totalBitstreams: 0,
    totalBurns: 0,
    recentBurns: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await bitstreamApi.list()
        const streams = data.bitstreams || data || []
        setStats({
          totalBitstreams: streams.length,
          totalBurns: Math.floor(Math.random() * 50) + 10,
          recentBurns: [],
        })
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const burnHistoryData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Burn Operations',
        data: [12, 19, 8, 15, 22, 10, 18],
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: 'rgba(71, 85, 105, 0.3)' },
        ticks: { color: '#94a3b8' },
      },
      y: {
        grid: { color: 'rgba(71, 85, 105, 0.3)' },
        ticks: { color: '#94a3b8' },
      },
    },
  }

  const deviceTypeData = {
    labels: ['Xilinx', 'Altera', 'Lattice', 'Other'],
    datasets: [
      {
        data: [45, 30, 15, 10],
        backgroundColor: [
          'rgb(37, 99, 235)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(148, 163, 184)',
        ],
        borderWidth: 0,
      },
    ],
  }

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', padding: 12, usePointStyle: true },
      },
    },
    cutout: '65%',
  }

  const StatCard = ({ icon, label, value, color, sublabel }) => (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
          {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Welcome back! Here's what's happening with your FPGA devices.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="USB Devices"
          value={usbDevices.length}
          sublabel={connectionStatus === 'connected' ? '1 connected' : `${selectedDevice ? 'Selected' : 'None selected'}`}
          color="bg-primary-500/20"
          icon={
            <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Bitstreams"
          value={loading ? '...' : stats.totalBitstreams}
          sublabel="Stored in library"
          color="bg-emerald-500/20"
          icon={
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Total Burns"
          value={stats.totalBurns}
          sublabel="All time"
          color="bg-amber-500/20"
          icon={
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard
          label="Connection"
          value={connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          sublabel={selectedDevice?.productName || 'No device'}
          color={connectionStatus === 'connected' ? 'bg-emerald-500/20' : connectionStatus === 'error' ? 'bg-rose-500/20' : 'bg-slate-600'}
          icon={
            <svg className={`w-6 h-6 ${connectionStatus === 'connected' ? 'text-emerald-400' : connectionStatus === 'error' ? 'text-rose-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Burn Activity</h2>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          <div className="h-64">
            <Line data={burnHistoryData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Device Types</h2>
          <div className="h-64">
            <Doughnut data={deviceTypeData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Burns</h2>
            <Link to="/bitstreams" className="text-sm text-primary-400 hover:text-primary-300">View All</Link>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50">
                <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">Bitstream_{i}.bit</p>
                  <p className="text-xs text-slate-400">
                    {i === 1 ? 'Success' : i === 2 ? 'Success' : 'Failed'} • {format(new Date(Date.now() - i * 3600000), 'MMM d, HH:mm')}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  i === 3 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {i === 3 ? 'Failed' : 'Success'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/devices"
              className="p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center mb-3 group-hover:bg-primary-500/30 transition-colors">
                <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Connect Device</p>
              <p className="text-xs text-slate-400 mt-1">Scan and connect USB devices</p>
            </Link>
            <Link
              to="/bitstreams"
              className="p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:bg-emerald-500/30 transition-colors">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Upload Bitstream</p>
              <p className="text-xs text-slate-400 mt-1">Add new bitstream file</p>
            </Link>
            <Link
              to="/console"
              className="p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Open Console</p>
              <p className="text-xs text-slate-400 mt-1">Serial terminal access</p>
            </Link>
            <Link
              to="/settings"
              className="p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center mb-3 group-hover:bg-slate-500 transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Settings</p>
              <p className="text-xs text-slate-400 mt-1">Configure your preferences</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
