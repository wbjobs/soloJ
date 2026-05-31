import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Button, Tag, Space } from 'antd';

const CausalNetworkChart = ({ data, onNodeClick, onEdgeClick }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(width, 400), height: Math.max(height - 20, 350) });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!data || !data.nodes || !data.edges || !svgRef.current) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'container');

    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const defs = svg.append('defs');

    const gradient = defs.append('linearGradient')
      .attr('id', 'edgeGradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#1890ff');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#52c41a');

    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#1890ff')
      .attr('stroke', 'none');

    defs.append('marker')
      .attr('id', 'arrowhead-highlight')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#faad14')
      .attr('stroke', 'none');

    const nodeMap = new Map(data.nodes.map((n, i) => [n.id, { ...n, index: i }]));

    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.edges).id(d => d.id).distance(d => 120 + (1 - d.strength) * 80))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    const edges = g.append('g').attr('class', 'edges').selectAll('g')
      .data(data.edges)
      .enter()
      .append('g')
      .attr('class', 'edge-group')
      .style('cursor', 'pointer');

    edges.append('path')
      .attr('class', 'edge')
      .attr('stroke', d => d.significant ? '#1890ff' : '#d9d9d9')
      .attr('stroke-width', d => Math.max(1.5, d.normalized_strength * 6))
      .attr('stroke-opacity', d => d.significant ? 0.8 : 0.4)
      .attr('fill', 'none')
      .attr('marker-end', d => d.significant ? 'url(#arrowhead)' : null)
      .on('mouseover', (event, d) => {
        setHoveredEdge(d);
        d3.select(event.currentTarget)
          .attr('stroke', '#faad14')
          .attr('stroke-opacity', 1)
          .attr('stroke-width', Math.max(2, d.normalized_strength * 8))
          .attr('marker-end', 'url(#arrowhead-highlight)');
      })
      .on('mouseout', (event, d) => {
        setHoveredEdge(null);
        d3.select(event.currentTarget)
          .attr('stroke', d.significant ? '#1890ff' : '#d9d9d9')
          .attr('stroke-opacity', d.significant ? 0.8 : 0.4)
          .attr('stroke-width', Math.max(1.5, d.normalized_strength * 6))
          .attr('marker-end', d.significant ? 'url(#arrowhead)' : null);
      })
      .on('click', (event, d) => onEdgeClick && onEdgeClick(d));

    edges.append('text')
      .attr('class', 'edge-label')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .text(d => `${d.delay_ms.toFixed(1)}ms`);

    const nodes = g.append('g').attr('class', 'nodes').selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'grab')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    nodes.append('circle')
      .attr('class', 'node')
      .attr('r', d => 20 + Math.min(d.rms * 10, 15))
      .attr('fill', d => {
        const colorScale = d3.scaleSequential(d3.interpolateYlOrRd);
        return colorScale(Math.min(d.kurtosis / 10, 1));
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))')
      .on('mouseover', (event, d) => {
        setHoveredNode(d);
        d3.select(event.currentTarget).attr('stroke', '#faad14').attr('stroke-width', 4);
      })
      .on('mouseout', (event, d) => {
        setHoveredNode(null);
        d3.select(event.currentTarget).attr('stroke', '#fff').attr('stroke-width', 3);
      })
      .on('click', (event, d) => onNodeClick && onNodeClick(d));

    nodes.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .text(d => d.id.replace('ch_', ''));

    nodes.append('text')
      .attr('class', 'node-subtitle')
      .attr('text-anchor', 'middle')
      .attr('dy', '2.5em')
      .attr('font-size', '9px')
      .attr('fill', '#888')
      .text(d => `RMS: ${d.rms.toFixed(2)}`);

    simulation.on('tick', () => {
      edges.selectAll('.edge').attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 0.3;
        return `M ${d.source.x} ${d.source.y} A ${dr} ${dr} 0 0 1 ${d.target.x} ${d.target.y}`;
      });

      edges.selectAll('.edge-label').attr('transform', d => {
        const midX = (d.source.x + d.target.x) / 2;
        const midY = (d.source.y + d.target.y) / 2 - 10;
        return `translate(${midX}, ${midY})`;
      });

      nodes.attr('transform', d => `translate(${d.x}, ${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, onNodeClick, onEdgeClick]);

  const highlightPath = useCallback((path) => {
    setSelectedPath(path);
    if (!svgRef.current || !path) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('.edge').attr('stroke-opacity', 0.2);
    svg.selectAll('.node').attr('opacity', 0.3);

    path.forEach((nodeId, i) => {
      svg.selectAll('.node')
        .filter(d => d.id === nodeId)
        .attr('opacity', 1)
        .attr('stroke', '#52c41a')
        .attr('stroke-width', 4);

      if (i < path.length - 1) {
        svg.selectAll('.edge')
          .filter(d => d.source.id === nodeId && d.target.id === path[i + 1])
          .attr('stroke', '#52c41a')
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 4);
      }
    });
  }, []);

  const clearHighlight = useCallback(() => {
    setSelectedPath(null);
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('.edge').each(function(d) {
      d3.select(this)
        .attr('stroke', d.significant ? '#1890ff' : '#d9d9d9')
        .attr('stroke-opacity', d.significant ? 0.8 : 0.4)
        .attr('stroke-width', Math.max(1.5, d.normalized_strength * 6));
    });
    svg.selectAll('.node')
      .attr('opacity', 1)
      .attr('stroke', '#fff')
      .attr('stroke-width', 3);
  }, [data]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space size="small">
          <Tag color="blue">节点: {data?.nodes?.length || 0}</Tag>
          <Tag color="green">显著边: {data?.edges?.filter(e => e.significant).length || 0}</Tag>
          <Tag color="orange">总边: {data?.edges?.length || 0}</Tag>
        </Space>
        {selectedPath && (
          <Button size="small" onClick={clearHighlight}>清除高亮</Button>
        )}
      </div>

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ background: '#fafafa', borderRadius: 8 }}
      />

      {hoveredNode && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(255,255,255,0.95)',
          padding: 12,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: 180,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{hoveredNode.id}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            <div>RMS: {hoveredNode.rms.toFixed(4)}</div>
            <div>Energy: {hoveredNode.energy.toFixed(2)}</div>
            <div>Kurtosis: {hoveredNode.kurtosis.toFixed(2)}</div>
          </div>
        </div>
      )}

      {hoveredEdge && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(255,255,255,0.95)',
          padding: 12,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: 200,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
            {hoveredEdge.source} → {hoveredEdge.target}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            <div>强度: {(hoveredEdge.strength * 100).toFixed(1)}%</div>
            <div>延迟: {hoveredEdge.delay_ms.toFixed(2)}ms</div>
            <div>传递熵: {hoveredEdge.te_net.toFixed(4)}</div>
            <div>Granger F值: {hoveredEdge.gc_f_stat.toFixed(2)}</div>
            <div>P值: {hoveredEdge.gc_p_value.toFixed(4)}</div>
            <div>显著: {hoveredEdge.significant ? '是' : '否'}</div>
          </div>
        </div>
      )}

      {data?.propagation_paths && data.propagation_paths.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>主要传播路径:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.propagation_paths.slice(0, 5).map((path, idx) => (
              <Tag
                key={idx}
                color={selectedPath === path.path ? 'green' : 'blue'}
                style={{ cursor: 'pointer', padding: '4px 8px' }}
                onClick={() => highlightPath(path.path)}
              >
                {path.path.join(' → ')}
                <span style={{ marginLeft: 8, opacity: 0.8 }}>
                  ({path.total_delay.toFixed(1)}ms)
                </span>
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CausalNetworkChart;
