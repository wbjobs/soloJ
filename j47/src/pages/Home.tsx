import { useState } from 'react'
import { usePointCloudStore } from '@/store/pointCloudStore'
import SceneViewer from '@/components/SceneViewer'
import FileUpload from '@/components/FileUpload'
import Toolbar from '@/components/Toolbar'
import InfoPanel from '@/components/InfoPanel'

export default function Home() {
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)
  const selectionMode = usePointCloudStore((s) => s.selectionMode)
  const [showInfo, setShowInfo] = useState(true)

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0e17] overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 bg-[#0d1117] border-b border-[#1a1f2e] z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ffa3] to-[#00b877] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="4" cy="4" r="1.5" fill="#0a0e17" />
              <circle cx="8" cy="3" r="1.5" fill="#0a0e17" />
              <circle cx="12" cy="5" r="1.5" fill="#0a0e17" />
              <circle cx="3" cy="8" r="1.5" fill="#0a0e17" />
              <circle cx="7" cy="9" r="1.5" fill="#0a0e17" />
              <circle cx="11" cy="8" r="1.5" fill="#0a0e17" />
              <circle cx="5" cy="12" r="1.5" fill="#0a0e17" />
              <circle cx="9" cy="13" r="1.5" fill="#0a0e17" />
              <circle cx="13" cy="11" r="1.5" fill="#0a0e17" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-white tracking-tight">
            PointCloud Viewer
          </h1>
          <span className="text-[10px] text-gray-600 border border-[#2a3040] px-1.5 py-0.5 rounded font-mono">
            v1.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectionMode && (
            <span className="text-[11px] text-[#00ffa3] bg-[#00ffa3]/10 border border-[#00ffa3]/20 px-2 py-0.5 rounded animate-pulse">
              框选模式
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!pointCloudData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md px-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-white mb-2">点云查看器</h2>
                <p className="text-sm text-gray-500">
                  上传 PLY 或 OBJ 文件以开始可视化
                </p>
              </div>
              <FileUpload />
            </div>
          </div>
        ) : (
          <>
            <div className="w-14 flex-shrink-0 bg-[#0d1117] border-r border-[#1a1f2e] flex items-start justify-center pt-2">
              <Toolbar />
            </div>

            <div className="flex-1 relative">
              <SceneViewer />

              <div className="absolute top-3 left-3 right-3 pointer-events-none">
                <FileUpload />
              </div>

              {selectionMode && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="bg-[#1a1f2e]/90 border border-[#00ffa3]/20 px-4 py-2 rounded-full backdrop-blur-sm">
                    <p className="text-xs text-[#00ffa3] text-center">
                      在3D视图中拖拽以创建框选区域
                    </p>
                  </div>
                </div>
              )}
            </div>

            {showInfo && (
              <div className="w-56 flex-shrink-0 bg-[#0d1117] border-l border-[#1a1f2e] overflow-y-auto">
                <InfoPanel />
              </div>
            )}

            <button
              onClick={() => setShowInfo(!showInfo)}
              className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1f2e]/80 border border-[#2a3040] text-gray-500 hover:text-white transition-colors backdrop-blur-sm"
              style={{ right: showInfo ? '14.5rem' : '1rem' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="12" height="12" rx="2" />
                <line x1="9" y1="1" x2="9" y2="13" />
                <line x1="2" y1="5" x2="8" y2="5" />
                <line x1="2" y1="9" x2="8" y2="9" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
