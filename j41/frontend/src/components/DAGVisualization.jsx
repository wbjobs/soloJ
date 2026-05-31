import React, { useMemo } from 'react';

function DAGVisualization({ graph, visible, onToggle }) {
  const { nodes, edges } = graph;

  const nodePositions = useMemo(() => {
    const positions = new Map();
    if (nodes.length === 0) return positions;

    const inDegree = new Map();
    const adjacency = new Map();
    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    });

    edges.forEach(edge => {
      adjacency.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    });

    const levels = [];
    const visited = new Set();
    let queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
    
    while (queue.length > 0) {
      levels.push(queue);
      queue.forEach(id => visited.add(id));
      
      const nextLevel = [];
      queue.forEach(nodeId => {
        adjacency.get(nodeId)?.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            const newInDegree = (inDegree.get(neighbor) || 1) - 1;
            inDegree.set(neighbor, newInDegree);
            if (newInDegree === 0) {
              nextLevel.push(neighbor);
            }
          }
        });
      });
      queue = nextLevel;
    }

    const unleveledNodes = nodes.filter(n => !visited.has(n.id));
    if (unleveledNodes.length > 0) {
      levels.push(unleveledNodes.map(n => n.id));
    }

    const nodeWidth = 160;
    const nodeHeight = 60;
    const horizontalGap = 40;
    const verticalGap = 80;
    const padding = 50;

    let maxWidth = 0;
    levels.forEach(level => {
      const levelWidth = level.length * nodeWidth + (level.length - 1) * horizontalGap;
      maxWidth = Math.max(maxWidth, levelWidth);
    });

    levels.forEach((level, levelIndex) => {
      const levelWidth = level.length * nodeWidth + (level.length - 1) * horizontalGap;
      const levelStartX = padding + (maxWidth - levelWidth) / 2;

      level.forEach((nodeId, nodeIndex) => {
        positions.set(nodeId, {
          x: levelStartX + nodeIndex * (nodeWidth + horizontalGap),
          y: padding + levelIndex * (nodeHeight + verticalGap),
          width: nodeWidth,
          height: nodeHeight,
        });
      });
    });

    return positions;
  }, [nodes, edges]);

  const canvasSize = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    nodePositions.forEach(pos => {
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });
    return {
      width: Math.max(maxX + 50, 400),
      height: Math.max(maxY + 50, 200),
    };
  }, [nodePositions]);

  const getNodeColor = (node) => {
    if (node.status === 'inactive') {
      return { bg: '#e2e8f0', border: '#a0aec0', text: '#718096' };
    }
    
    switch (node.lastStatus) {
      case 'success':
        return { bg: '#c6f6d5', border: '#48bb78', text: '#22543d' };
      case 'failed':
        return { bg: '#fed7d7', border: '#fc8181', text: '#742a2a' };
      case 'conflict':
        return { bg: '#feebc8', border: '#ed8936', text: '#7c2d12' };
      default:
        return { bg: '#bee3f8', border: '#4299e1', text: '#2a4365' };
    }
  };

  const getEdgeColor = (fromNode, toNode) => {
    if (!fromNode || !toNode) return '#cbd5e0';
    if (fromNode.lastStatus === 'success' && toNode.lastStatus === 'success') {
      return '#48bb78';
    }
    if (fromNode.lastStatus === 'failed') {
      return '#fc8181';
    }
    return '#a0aec0';
  };

  const renderArrowPath = (fromPos, toPos) => {
    const fromCenterX = fromPos.x + fromPos.width / 2;
    const fromCenterY = fromPos.y + fromPos.height / 2;
    const toCenterX = toPos.x + toPos.width / 2;
    const toCenterY = toPos.y + toPos.height / 2;

    const startX = fromCenterX;
    const startY = fromPos.y + fromPos.height;
    const endX = toCenterX;
    const endY = toPos.y;

    const midY = (startY + endY) / 2;

    return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  };

  if (!visible) {
    return (
      <div className="section" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>📊 依赖关系图 (DAG)</h2>
          <button className="btn btn-secondary" onClick={onToggle}>
            展开
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>📊 依赖关系图 (DAG)</h2>
        <button className="btn btn-secondary" onClick={onToggle}>
          收起
        </button>
      </div>

      {nodes.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px' }}>
          <p>暂无任务数据</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <svg width={canvasSize.width} height={canvasSize.height} style={{ minWidth: '100%' }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#a0aec0" />
              </marker>
              <marker
                id="arrowhead-success"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#48bb78" />
              </marker>
              <marker
                id="arrowhead-failed"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#fc8181" />
              </marker>
            </defs>

            {edges.map((edge, index) => {
              const fromPos = nodePositions.get(edge.from);
              const toPos = nodePositions.get(edge.to);
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              
              if (!fromPos || !toPos) return null;

              const edgeColor = getEdgeColor(fromNode, toNode);
              const markerId = edgeColor === '#48bb78' ? 'arrowhead-success' : 
                               edgeColor === '#fc8181' ? 'arrowhead-failed' : 'arrowhead';

              return (
                <path
                  key={`edge-${index}`}
                  d={renderArrowPath(fromPos, toPos)}
                  fill="none"
                  stroke={edgeColor}
                  strokeWidth="2"
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}

            {nodes.map(node => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const colors = getNodeColor(node);
              const statusText = node.status === 'inactive' ? '已停止' :
                                node.lastStatus === 'success' ? '成功' :
                                node.lastStatus === 'failed' ? '失败' :
                                node.lastStatus === 'conflict' ? '冲突' : '等待';

              return (
                <g key={node.id}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.width}
                    height={pos.height}
                    rx="8"
                    fill={colors.bg}
                    stroke={colors.border}
                    strokeWidth="2"
                  />
                  <text
                    x={pos.x + pos.width / 2}
                    y={pos.y + 25}
                    textAnchor="middle"
                    fill={colors.text}
                    fontSize="12"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.name.length > 12 ? node.name.substring(0, 12) + '...' : node.name}
                  </text>
                  <text
                    x={pos.x + pos.width / 2}
                    y={pos.y + 45}
                    textAnchor="middle"
                    fill={colors.text}
                    fontSize="10"
                    opacity="0.8"
                    style={{ pointerEvents: 'none' }}
                  >
                    {statusText}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div style={{ marginTop: '15px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#bee3f8', border: '2px solid #4299e1' }}></div>
          <span style={{ fontSize: '12px', color: '#718096' }}>等待执行</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#c6f6d5', border: '2px solid #48bb78' }}></div>
          <span style={{ fontSize: '12px', color: '#718096' }}>执行成功</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#fed7d7', border: '2px solid #fc8181' }}></div>
          <span style={{ fontSize: '12px', color: '#718096' }}>执行失败</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#feebc8', border: '2px solid #ed8936' }}></div>
          <span style={{ fontSize: '12px', color: '#718096' }}>执行冲突</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#e2e8f0', border: '2px solid #a0aec0' }}></div>
          <span style={{ fontSize: '12px', color: '#718096' }}>已停止</span>
        </div>
      </div>
    </div>
  );
}

export default DAGVisualization;
