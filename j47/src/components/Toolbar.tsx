import {
  BoxSelect,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Palette,
  MousePointer2,
} from 'lucide-react'
import { usePointCloudStore, type ColorMode } from '@/store/pointCloudStore'

export default function Toolbar() {
  const selectionMode = usePointCloudStore((s) => s.selectionMode)
  const setSelectionMode = usePointCloudStore((s) => s.setSelectionMode)
  const pointSize = usePointCloudStore((s) => s.pointSize)
  const setPointSize = usePointCloudStore((s) => s.setPointSize)
  const colorMode = usePointCloudStore((s) => s.colorMode)
  const setColorMode = usePointCloudStore((s) => s.setColorMode)
  const triggerCameraReset = usePointCloudStore((s) => s.triggerCameraReset)
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)

  const colorModes: { mode: ColorMode; label: string }[] = [
    { mode: 'original', label: '原始颜色' },
    { mode: 'height', label: '高度着色' },
    { mode: 'distance', label: '距离着色' },
  ]

  const cycleColorMode = () => {
    const idx = colorModes.findIndex((m) => m.mode === colorMode)
    const next = colorModes[(idx + 1) % colorModes.length]
    setColorMode(next.mode)
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="text-[10px] text-gray-600 uppercase tracking-wider text-center mb-1">
        工具
      </div>

      <ToolButton
        icon={<MousePointer2 size={18} />}
        active={!selectionMode}
        onClick={() => setSelectionMode(false)}
        tooltip="旋转/缩放/平移"
      />

      <ToolButton
        icon={<BoxSelect size={18} />}
        active={selectionMode}
        onClick={() => setSelectionMode(!selectionMode)}
        tooltip="框选模式"
        highlight
      />

      <div className="w-8 h-px bg-[#2a3040] mx-auto my-1" />

      <ToolButton
        icon={<RotateCcw size={18} />}
        active={false}
        onClick={triggerCameraReset}
        tooltip="重置视角"
        disabled={!pointCloudData}
      />

      <div className="w-8 h-px bg-[#2a3040] mx-auto my-1" />

      <ToolButton
        icon={<ZoomIn size={18} />}
        active={false}
        onClick={() => setPointSize(Math.min(10, pointSize + 0.5))}
        tooltip="增大点大小"
        disabled={!pointCloudData}
      />

      <ToolButton
        icon={<ZoomOut size={18} />}
        active={false}
        onClick={() => setPointSize(Math.max(0.5, pointSize - 0.5))}
        tooltip="减小点大小"
        disabled={!pointCloudData}
      />

      <div className="w-8 h-px bg-[#2a3040] mx-auto my-1" />

      <ToolButton
        icon={<Palette size={18} />}
        active={false}
        onClick={cycleColorMode}
        tooltip={colorModes.find((m) => m.mode === colorMode)?.label || '切换颜色'}
        disabled={!pointCloudData}
      />

      {pointCloudData && (
        <div className="text-[9px] text-gray-500 text-center mt-1 font-mono">
          {pointSize.toFixed(1)}px
        </div>
      )}
    </div>
  )
}

function ToolButton({
  icon,
  active,
  onClick,
  tooltip,
  highlight = false,
  disabled = false,
}: {
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  tooltip: string
  highlight?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`
        relative w-10 h-10 flex items-center justify-center rounded-xl
        transition-all duration-200 group
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
        ${active
          ? highlight
            ? 'bg-[#00ffa3]/15 text-[#00ffa3] shadow-[0_0_12px_rgba(0,255,163,0.2)]'
            : 'bg-[#2a3040] text-white'
          : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1f2e]'
        }
      `}
    >
      {icon}
      <div className="
        absolute left-full ml-2 px-2 py-1 rounded-md
        bg-[#1a1f2e] text-xs text-gray-300 whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none
        transition-opacity duration-150 z-50
        border border-[#2a3040]
      ">
        {tooltip}
      </div>
    </button>
  )
}
