import { useState, useRef, useEffect, useCallback } from 'react'
import { calculateGridLayout, calculateCircularLayout, calculateForceLayout, findNodeAtPosition, calculateConnectionPaths } from '../../utils/clusterTopology.js'

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

export default function ClusterTopology({
  nodes = [],
  connections = [],
  selectedNode,
  onNodeSelect,
  onNodeMove,
  layoutMode = 'grid',
}) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [draggingNode, setDraggingNode] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [positionedNodes, setPositionedNodes] = useState([])
  const [connectionPaths, setConnectionPaths] = useState([])

  useEffect(() => {
    let newNodes
    const edges = connections.map((c) => ({ source: c.source, target: c.target }))

    switch (layoutMode) {
      case 'circular':
        newNodes = calculateCircularLayout(nodes)
        break
      case 'force':
        newNodes = calculateForceLayout(nodes, edges)
        break
      case 'grid':
      default:
        newNodes = calculateGridLayout(nodes, 4, 4)
    }

    setPositionedNodes(newNodes)
  }, [nodes, layoutMode, connections.length])

  useEffect(() => {
    const paths = calculateConnectionPaths(positionedNodes, connections)
    setConnectionPaths(paths)
  }, [positionedNodes, connections])

  const getSVGCoords = useCallback(
    (clientX, clientY) => {
      if (!svgRef.current) return { x: 0, y: 0 }
      const rect = svgRef.current.getBoundingClientRect()
      return {
        x: (clientX - rect.left - transform.x) / transform.scale,
        y: (clientY - rect.top - transform.y) / transform.scale,
      }
    },
    [transform]
  )

  const handleMouseDown = (e) => {
    const coords = getSVGCoords(e.clientX, e.clientY)
    const node = findNodeAtPosition(positionedNodes, coords.x, coords.y)

    if (node && e.button === 0) {
      setDraggingNode(node)
      onNodeSelect?.(node)
    } else {
      setIsDragging(true)
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
    }
  }

  const handleMouseMove = (e) => {
    const coords = getSVGCoords(e.clientX, e.clientY)
    setTooltipPos({ x: e.clientX, y: e.clientY })

    const hovered = findNodeAtPosition(positionedNodes, coords.x, coords.y)
    setHoveredNode(hovered)

    if (draggingNode) {
      setPositionedNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNode.id ? { ...n, x: coords.x, y: coords.y } : n
        )
      )
    } else if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }))
    }
  }

  const handleMouseUp = () => {
    if (draggingNode) {
      const updatedNode = positionedNodes.find((n) => n.id === draggingNode.id)
      if (updatedNode) {
        onNodeMove?.(updatedNode)
      }
      setDraggingNode(null)
    }
    setIsDragging(false)
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.5, Math.min(3, transform.scale * scaleFactor))
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    setTransform((prev) => ({
      scale: newScale,
      x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
      y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
    }))
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-800 rounded-lg overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.5" />
          </pattern>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          <rect width="1000" height="800" fill="url(#grid)" />

          <g className="connections">
            {connectionPaths.map((conn, i) => (
              <path
                key={i}
                d={conn.path}
                fill="none"
                stroke="#475569"
                strokeWidth="2"
                strokeOpacity={selectedNode && (conn.source === selectedNode.id || conn.target === selectedNode.id) ? 1 : 0.5}
              />
            ))}
          </g>

          <g className="nodes">
            {positionedNodes.map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer"
              >
                <circle
                  r={28}
                  fill={statusColors[node.status] || statusColors.offline}
                  stroke={selectedNode?.id === node.id ? '#3b82f6' : '#1e293b'}
                  strokeWidth={selectedNode?.id === node.id ? 4 : 2}
                  className="transition-all duration-200"
                  style={{
                    filter: hoveredNode?.id === node.id ? 'brightness(1.2)' : 'none',
                  }}
                />
                <circle
                  r={20}
                  fill="#1e293b"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {node.name?.charAt(0) || node.id?.toString().charAt(0)}
                </text>
                <circle
                  r={8}
                  cx={20}
                  cy={-20}
                  fill={statusColors[node.status]}
                  stroke="#1e293b"
                  strokeWidth="2"
                />
              </g>
            ))}
          </g>
        </g>
      </svg>

      {hoveredNode && (
        <div
          className="absolute pointer-events-none bg-slate-900 text-white px-3 py-2 rounded-lg shadow-lg z-10 text-sm border border-slate-700"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold">{hoveredNode.name}</div>
          <div className="text-slate-400">Status: {statusLabels[hoveredNode.status]}</div>
          {hoveredNode.load !== undefined && (
            <div className="text-slate-400">Load: {hoveredNode.load}%</div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur px-4 py-3 rounded-lg border border-slate-700">
        <div className="text-xs text-slate-400 mb-2 font-medium">Node Status</div>
        <div className="flex gap-4">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-300">{statusLabels[status]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={() => setTransform((prev) => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-white transition-colors"
        >
          +
        </button>
        <button
          onClick={() => setTransform((prev) => ({ ...prev, scale: Math.max(0.5, prev.scale / 1.2) }))}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-white transition-colors"
        >
          −
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="px-3 h-8 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-white text-sm transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
