import { useState } from 'react'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { usePointCloudStore } from '@/store/pointCloudStore'
import { cutAndDownloadPLY } from '@/api/cut'

export default function InfoPanel() {
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)
  const fileName = usePointCloudStore((s) => s.fileName)
  const selectedPointCount = usePointCloudStore((s) => s.selectedPointCount)
  const selectedPointIndices = usePointCloudStore((s) => s.selectedPointIndices)
  const selectionMode = usePointCloudStore((s) => s.selectionMode)
  const pointSize = usePointCloudStore((s) => s.pointSize)
  const colorMode = usePointCloudStore((s) => s.colorMode)
  const isDownloading = usePointCloudStore((s) => s.isDownloading)
  const setIsDownloading = usePointCloudStore((s) => s.setIsDownloading)

  const [downloadSuccess, setDownloadSuccess] = useState(false)

  if (!pointCloudData) return null

  const { boundingBox, pointCount, positions, colors, normals } = pointCloudData
  const colorModeLabel = { original: '原始颜色', height: '高度着色', distance: '距离着色' }[colorMode]

  const fmt = (n: number) => n.toFixed(3)

  const selectedPercent = pointCount > 0 ? ((selectedPointCount / pointCount) * 100).toFixed(1) : '0.0'

  const handleDownload = async () => {
    if (!pointCloudData || !selectedPointIndices || selectedPointCount === 0) return

    setIsDownloading(true)
    setDownloadSuccess(false)

    try {
      const indicesArray: number[] = []
      for (let i = 0; i < selectedPointIndices.length; i++) {
        if (selectedPointIndices[i]) {
          indicesArray.push(i)
        }
      }

      await cutAndDownloadPLY({
        positions: Array.from(positions),
        colors: colors ? Array.from(colors) : null,
        normals: normals ? Array.from(normals) : null,
        pointCount,
        selectedIndices: indicesArray,
        fileName: fileName || 'pointcloud',
      })

      setDownloadSuccess(true)
      setTimeout(() => setDownloadSuccess(false), 2000)
    } catch (err: any) {
      alert(err.message || '下载失败')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-[10px] text-gray-600 uppercase tracking-wider">
        点云信息
      </div>

      <InfoRow label="文件名" value={fileName || '-'} mono />

      <div className="w-full bg-[#0d1117] border border-[#1a1f2e] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">
            点数统计
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-lg font-semibold text-white font-mono">
            {pointCount.toLocaleString()}
          </span>
          <span className="text-[11px] text-gray-500">总点数</span>
        </div>

        {selectedPointCount > 0 && (
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-lg font-semibold text-[#ff6b35] font-mono">
              {selectedPointCount.toLocaleString()}
            </span>
            <span className="text-[11px] text-gray-500">已选中</span>
            <span className="ml-auto text-xs text-[#ff6b35]/70 font-mono bg-[#ff6b35]/10 px-1.5 py-0.5 rounded">
              {selectedPercent}%
            </span>
          </div>
        )}

        <div className="h-1.5 w-full bg-[#1a1f2e] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${selectedPercent}%`,
              background: 'linear-gradient(90deg, #00ffa3, #ff6b35)',
            }}
          />
        </div>

        {selectedPointCount > 0 && (
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`
              w-full mt-3 flex items-center justify-center gap-2
              py-2 rounded-lg text-sm font-medium
              transition-all duration-200
              ${downloadSuccess
                ? 'bg-[#00ffa3]/20 text-[#00ffa3]'
                : isDownloading
                  ? 'bg-[#1a1f2e] text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#00ffa3] to-[#00b877] text-[#0a0e17] hover:shadow-[0_0_20px_rgba(0,255,163,0.3)] active:scale-[0.98]'
              }
            `}
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 size={16} />
                下载完成
              </>
            ) : isDownloading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download size={16} />
                导出选中点 (.ply)
              </>
            )}
          </button>
        )}
      </div>

      <div className="w-full h-px bg-[#2a3040]" />

      <div className="text-[10px] text-gray-600 uppercase tracking-wider">
        边界范围
      </div>

      <div className="grid grid-cols-3 gap-2">
        <DimBox axis="X" min={fmt(boundingBox.min[0])} max={fmt(boundingBox.max[0])} />
        <DimBox axis="Y" min={fmt(boundingBox.min[1])} max={fmt(boundingBox.max[1])} />
        <DimBox axis="Z" min={fmt(boundingBox.min[2])} max={fmt(boundingBox.max[2])} />
      </div>

      <div className="w-full h-px bg-[#2a3040]" />

      <div className="text-[10px] text-gray-600 uppercase tracking-wider">
        渲染设置
      </div>

      <InfoRow label="点大小" value={`${pointSize.toFixed(1)} px`} mono />
      <InfoRow label="颜色模式" value={colorModeLabel} />
      <InfoRow label="交互模式" value={selectionMode ? '框选' : '旋转'} />
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono = false,
  highlight = false,
  accent = false,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span
        className={`
          text-sm font-mono
          ${accent ? 'text-[#ff6b35]' : highlight ? 'text-[#00ffa3]' : 'text-gray-200'}
          ${mono ? 'font-mono' : ''}
        `}
      >
        {value}
      </span>
    </div>
  )
}

function DimBox({ axis, min, max }: { axis: string; min: string; max: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#0d1117] border border-[#1a1f2e]">
      <span className="text-[10px] text-gray-600">{axis}</span>
      <span className="text-[10px] text-gray-400 font-mono">{min}</span>
      <span className="text-[10px] text-gray-500 font-mono">~</span>
      <span className="text-[10px] text-gray-400 font-mono">{max}</span>
    </div>
  )
}
