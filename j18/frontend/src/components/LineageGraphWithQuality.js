import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Spin, Tag, Tooltip, Alert } from 'antd';
import { WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import * as d3 from 'd3';
import { getQualityColor, getAnomalyRateColor, getAlertColor } from '../utils/dataQualityApi';

const LineageGraphWithQuality = ({
  data,
  onNodeClick,
  onEdgeClick,
  showQuality = true,
  anomalyHighlight = null,
  height = 500,
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const renderGraph = useCallback(() => {
    if (!data || !data.nodes || !data.edges) return;
    if (!containerRef.current) return;

    setLoading(true);

    const container = containerRef.current;
    const width = container.clientWidth;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.edges).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    const defs = svg.append('defs');

    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 35)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999');

    defs.append('marker')
      .attr('id', 'arrowhead-warning')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 35)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#faad14');

    defs.append('marker')
      .attr('id', 'arrowhead-danger')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 35)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#f5222d');

    const edgeGroup = g.append('g')
      .attr('class', 'edges');

    const edge = edgeGroup.selectAll('line')
      .data(data.edges)
      .enter()
      .append('line')
      .attr('stroke', d => {
        if (anomalyHighlight && anomalyHighlight.paths) {
          const isInPath = anomalyHighlight.paths.some(p =>
            (p.from === d.source.id || p.from === d.source) &&
            (p.to === d.target.id || p.to === d.target)
          );
          if (isInPath) return d.anomaly_rate >= 0.1 ? '#f5222d' : '#faad14';
        }
        return '#999';
      })
      .attr('stroke-width', d => {
        if (anomalyHighlight && anomalyHighlight.paths) {
          const isInPath = anomalyHighlight.paths.some(p =>
            (p.from === d.source.id || p.from === d.source) &&
            (p.to === d.target.id || p.to === d.target)
          );
          if (isInPath) return 3 + (d.anomaly_rate || 0) * 10;
        }
        return 2;
      })
      .attr('stroke-dasharray', d => d.type === 'join' ? '5,5' : 'none')
      .attr('marker-end', d => {
        if (anomalyHighlight && anomalyHighlight.paths) {
          const isInPath = anomalyHighlight.paths.some(p =>
            (p.from === d.source.id || p.from === d.source) &&
            (p.to === d.target.id || p.to === d.target)
          );
          if (isInPath) return d.anomaly_rate >= 0.1 ? 'url(#arrowhead-danger)' : 'url(#arrowhead-warning)';
        }
        return 'url(#arrowhead)';
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onEdgeClick) onEdgeClick(d);
      });

    const nodeGroup = g.append('g')
      .attr('class', 'nodes');

    const node = nodeGroup.selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', d => {
        if (d.type === 'source') return 35;
        if (d.anomaly_rate) return 28 + d.anomaly_rate * 20;
        return 28;
      })
      .attr('fill', d => {
        if (d.anomaly_rate !== undefined) {
          return getAnomalyRateColor(d.anomaly_rate);
        }
        if (showQuality && d.quality_score !== undefined) {
          return getQualityColor(d.quality_score);
        }
        if (d.type === 'table') return '#1890ff';
        if (d.type === 'source') return '#722ed1';
        return '#13c2c2';
      })
      .attr('stroke', d => {
        if (d.has_alert) return '#f5222d';
        if (anomalyHighlight && anomalyHighlight.affectedNodes?.includes(d.id)) {
          return '#fa8c16';
        }
        return '#fff';
      })
      .attr('stroke-width', d => {
        if (d.has_alert) return 4;
        if (anomalyHighlight && anomalyHighlight.affectedNodes?.includes(d.id)) return 3;
        return 2;
      })
      .style('filter', d => d.has_alert ? 'drop-shadow(0 0 8px rgba(245, 34, 45, 0.5))' : 'none');

    node.filter(d => d.has_alert)
      .append('circle')
      .attr('r', 8)
      .attr('cx', 25)
      .attr('cy', -25)
      .attr('fill', '#f5222d');

    node.filter(d => d.has_alert)
      .append('text')
      .attr('x', 25)
      .attr('y', -22)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text('!');

    node.append('text')
      .attr('dy', -35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text(d => d.table || d.name || '');

    node.append('text')
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .text(d => {
        const label = d.column || d.label || d.id || '';
        return label.length > 10 ? label.substring(0, 10) + '...' : label;
      });

    node.filter(d => d.anomaly_rate !== undefined)
      .append('text')
      .attr('dy', 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#fff')
      .text(d => `(${(d.anomaly_rate * 100).toFixed(1)}%)`);

    node.on('click', (event, d) => {
      setSelectedNode(d);
      if (onNodeClick) onNodeClick(d);
    });

    node.append('title')
      .text(d => {
        let title = `${d.table || d.name}.${d.column || d.label || d.id}`;
        if (d.anomaly_rate !== undefined) {
          title += `\n异常率: ${(d.anomaly_rate * 100).toFixed(2)}%`;
        }
        if (d.quality_score !== undefined) {
          title += `\n质量分数: ${(d.quality_score * 100).toFixed(1)}%`;
        }
        if (d.confidence !== undefined) {
          title += `\n置信度: ${(d.confidence * 100).toFixed(0)}%`;
        }
        return title;
      });

    simulation.on('tick', () => {
      edge
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    setLoading(false);
  }, [data, height, showQuality, anomalyHighlight, onNodeClick, onEdgeClick]);

  useEffect(() => {
    renderGraph();
  }, [renderGraph]);

  useEffect(() => {
    const handleResize = () => renderGraph();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderGraph]);

  return (
    <div>
      <Card
        ref={containerRef}
        style={{ width: '100%', height: height + 20, position: 'relative' }}
        bodyStyle={{ padding: 0 }}
      >
        <Spin spinning={loading} tip="加载血缘图...">
          <svg ref={svgRef} style={{ width: '100%', height: height }} />
        </Spin>

        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <Tooltip title="绿色=正常 | 黄色=警告 | 橙色=严重 | 红色=危险">
            <InfoCircleOutlined style={{ color: '#999', fontSize: 16 }} />
          </Tooltip>
        </div>

        <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tag color="green" style={{ margin: 0 }}>正常 (≥90%)</Tag>
            <Tag color="gold" style={{ margin: 0 }}>警告 (70-89%)</Tag>
            <Tag color="orange" style={{ margin: 0 }}>严重 (50-69%)</Tag>
            <Tag color="red" style={{ margin: 0 }}>危险 (<50%)</Tag>
          </div>
        </div>
      </Card>

      {selectedNode && (
        <Alert
          message="选中节点"
          description={
            <div>
              <p><strong>ID:</strong> {selectedNode.id}</p>
              <p><strong>表:</strong> {selectedNode.table || selectedNode.name}</p>
              <p><strong>字段:</strong> {selectedNode.column || selectedNode.label}</p>
              {selectedNode.anomaly_rate !== undefined && (
                <p><strong>异常率:</strong> {(selectedNode.anomaly_rate * 100).toFixed(2)}%</p>
              )}
              {selectedNode.quality_score !== undefined && (
                <p><strong>质量分数:</strong> {(selectedNode.quality_score * 100).toFixed(1)}%</p>
              )}
              {selectedNode.confidence !== undefined && (
                <p><strong>置信度:</strong> {(selectedNode.confidence * 100).toFixed(0)}%</p>
              )}
              {selectedNode.has_alert && (
                <p style={{ color: '#f5222d' }}>
                  <WarningOutlined /> 存在质量预警
                </p>
              )}
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          closable
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};

export default LineageGraphWithQuality;
