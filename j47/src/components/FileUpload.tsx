import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { usePointCloudStore, type PointCloudData } from '@/store/pointCloudStore'
import { uploadPointCloudFile } from '@/api/upload'

export default function FileUpload() {
  const setIsLoading = usePointCloudStore((s) => s.setIsLoading)
  const setFileName = usePointCloudStore((s) => s.setFileName)
  const setPointCloudData = usePointCloudStore((s) => s.setPointCloudData)
  const isLoading = usePointCloudStore((s) => s.isLoading)
  const fileName = usePointCloudStore((s) => s.fileName)
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase().split('.').pop()
      if (ext !== 'ply' && ext !== 'obj') {
        alert('仅支持 .ply 和 .obj 格式的文件')
        return
      }

      setIsLoading(true)
      setFileName(file.name)

      try {
        const res = await uploadPointCloudFile(file)
        if (res.success && res.data) {
          const data: PointCloudData = {
            positions: new Float32Array(res.data.positions),
            colors: res.data.colors ? new Float32Array(res.data.colors) : null,
            normals: res.data.normals ? new Float32Array(res.data.normals) : null,
            boundingBox: res.data.boundingBox,
            pointCount: res.data.pointCount,
          }
          setPointCloudData(data)
        } else {
          alert(res.error || '文件解析失败')
        }
      } catch (err: any) {
        alert(err.message || '上传失败')
      } finally {
        setIsLoading(false)
      }
    },
    [setIsLoading, setFileName, setPointCloudData]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const onClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  if (pointCloudData) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1f2e] border border-[#2a3040] rounded-xl">
        <FileText size={18} className="text-[#00ffa3]" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate font-mono">{fileName}</p>
          <p className="text-xs text-gray-500 font-mono">
            {pointCloudData.pointCount.toLocaleString()} 个点
          </p>
        </div>
        <button
          onClick={onClick}
          className="text-xs text-[#00ffa3] hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#2a3040]"
        >
          更换文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ply,.obj"
          onChange={onFileChange}
          className="hidden"
        />
      </div>
    )
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center gap-4 p-8
        border-2 border-dashed rounded-2xl cursor-pointer
        transition-all duration-300 ease-out
        ${isDragOver
          ? 'border-[#00ffa3] bg-[#00ffa3]/5 scale-[1.02]'
          : 'border-[#2a3040] bg-[#0d1117] hover:border-[#00ffa3]/50 hover:bg-[#0d1117]/80'
        }
        ${isLoading ? 'pointer-events-none' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".ply,.obj"
        onChange={onFileChange}
        className="hidden"
      />

      {isLoading ? (
        <>
          <Loader2 size={40} className="text-[#00ffa3] animate-spin" />
          <p className="text-sm text-gray-400">正在解析文件...</p>
        </>
      ) : (
        <>
          <div className={`
            p-4 rounded-2xl transition-colors duration-300
            ${isDragOver ? 'bg-[#00ffa3]/10' : 'bg-[#1a1f2e]'}
          `}>
            <Upload size={32} className={isDragOver ? 'text-[#00ffa3]' : 'text-gray-500'} />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-300 mb-1">
              拖拽文件到此处，或 <span className="text-[#00ffa3]">点击上传</span>
            </p>
            <p className="text-xs text-gray-600">支持 .ply / .obj 格式</p>
          </div>
        </>
      )}
    </div>
  )
}
