import { useState } from 'react';
import type { FlameGraphNode } from '@/types/debugger';
import { Flame, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface FlameGraphProps {
  data: FlameGraphNode | null;
  totalTime: number;
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e'
];

function getColor(name: string, _index: number) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface FlameBarProps {
  node: FlameGraphNode;
  x: number;
  width: number;
  totalTime: number;
  depth: number;
  maxDepth: number;
  onHover: (node: FlameGraphNode | null) => void;
}

function FlameBar({ node, x, width, totalTime, depth, maxDepth, onHover }: FlameBarProps) {
  const color = getColor(node.name, depth);
  const barHeight = 24;
  const y = (maxDepth - depth) * barHeight;
  const percentage = (node.value / totalTime) * 100;

  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={barHeight - 1}
        fill={color}
        rx={2}
        className="cursor-pointer transition-opacity hover:opacity-80"
        onMouseEnter={() => onHover(node)}
        onMouseLeave={() => onHover(null)}
      />
      {width > 50 && (
        <text
          x={x + 5}
          y={y + barHeight / 2 + 4}
          fontSize={11}
          fill="white"
          className="pointer-events-none select-none"
        >
          {node.name} ({percentage.toFixed(1)}%)
        </text>
      )}
      {node.children?.map((child, i) => {
        const childX = x + (child.value / totalTime) * 100;
        const childWidth = (child.value / totalTime) * 100;
        return (
          <FlameBar
            key={`${child.name}-${i}`}
            node={child}
            x={childX}
            width={childWidth}
            totalTime={totalTime}
            depth={depth + 1}
            maxDepth={maxDepth}
            onHover={onHover}
          />
        );
      })}
    </>
  );
}

export function FlameGraph({ data, totalTime }: FlameGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<FlameGraphNode | null>(null);
  const [zoom, setZoom] = useState(1);

  const getMaxDepth = (node: FlameGraphNode, depth = 0): number => {
    if (!node.children || node.children.length === 0) return depth;
    return Math.max(...node.children.map(child => getMaxDepth(child, depth + 1)));
  };

  if (!data || totalTime === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-500">
        <Flame className="w-12 h-12 mb-2 opacity-50" />
        <p>暂无性能数据</p>
        <p className="text-xs mt-1">运行代码后将显示火焰图</p>
      </div>
    );
  }

  const maxDepth = getMaxDepth(data);
  const chartHeight = (maxDepth + 2) * 24;

  return (
    <div className="bg-debug-panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <h3 className="text-white font-medium">火焰图</h3>
          <span className="text-xs text-gray-400">
            总执行时间: {totalTime.toFixed(2)} ms
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            onClick={() => setZoom(1)}
            title="重置"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {hoveredNode && (
        <div className="mb-3 p-2 bg-gray-700/50 rounded text-sm">
          <span className="text-white font-medium">{hoveredNode.name}</span>
          <span className="text-gray-400 ml-2">
            {hoveredNode.value.toFixed(2)} ms ({((hoveredNode.value / totalTime) * 100).toFixed(1)}%)
          </span>
        </div>
      )}

      <div 
        className="overflow-x-auto border border-gray-700 rounded bg-gray-900"
        style={{ height: chartHeight + 20 }}
      >
        <svg
          width={`${100 * zoom}%`}
          height={chartHeight}
          viewBox={`0 0 100 ${chartHeight}`}
          preserveAspectRatio="none"
          style={{ minWidth: '100%' }}
        >
          {data.children?.map((child, i) => {
            const x = (child.value / totalTime) * 100;
            const width = (child.value / totalTime) * 100;
            return (
              <FlameBar
                key={`${child.name}-${i}`}
                node={child}
                x={x}
                width={width}
                totalTime={totalTime}
                depth={0}
                maxDepth={maxDepth}
                onHover={setHoveredNode}
              />
            );
          })}
        </svg>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        <p>提示：将鼠标悬停在火焰块上查看详细信息，横向宽度表示执行时间占比</p>
      </div>
    </div>
  );
}
