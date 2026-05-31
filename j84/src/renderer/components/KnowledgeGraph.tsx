import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { GraphData } from '../../shared/types';

interface KnowledgeGraphProps {
  onNavigate: (title: string) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ onNavigate }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getGraphData().then(setGraphData);
  }, []);

  useEffect(() => {
    if (!graphData || !svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const nodes: SimNode[] = graphData.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = graphData.edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    const linkDegree: Record<string, number> = {};
    for (const link of links) {
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      linkDegree[src] = (linkDegree[src] || 0) + 1;
      linkDegree[tgt] = (linkDegree[tgt] || 0) + 1;
    }

    const maxDegree = Math.max(...Object.values(linkDegree), 1);
    const radiusScale = d3.scaleSqrt().domain([0, maxDegree]).range([6, 24]);

    const container = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => radiusScale(linkDegree[d.id] || 0) + 4));

    const linkElements = container.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'graph-link')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5);

    const nodeGroups = container.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'graph-node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimNode>()
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
        })
      );

    nodeGroups.append('circle')
      .attr('r', (d) => radiusScale(linkDegree[d.id] || 0))
      .attr('fill', (d) => {
        const degree = linkDegree[d.id] || 0;
        if (degree > maxDegree * 0.7) return '#ff6b6b';
        if (degree > maxDegree * 0.3) return '#feca57';
        return '#54a0ff';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 3);
        setHoveredNode(d.title);
        linkElements.attr('stroke-opacity', (l) => {
          const src = typeof l.source === 'string' ? l.source : l.source.id;
          const tgt = typeof l.target === 'string' ? l.target : l.target.id;
          return src === d.id || tgt === d.id ? 0.8 : 0.1;
        }).attr('stroke', (l) => {
          const src = typeof l.source === 'string' ? l.source : l.source.id;
          const tgt = typeof l.target === 'string' ? l.target : l.target.id;
          return src === d.id || tgt === d.id ? '#ff6b6b' : '#555';
        });
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke-width', 2);
        setHoveredNode(null);
        linkElements.attr('stroke-opacity', 0.4).attr('stroke', '#555');
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        onNavigate(d.title);
      });

    nodeGroups.append('text')
      .text((d) => d.title.length > 12 ? d.title.slice(0, 12) + '…' : d.title)
      .attr('dy', (d) => radiusScale(linkDegree[d.id] || 0) + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ccc')
      .attr('font-size', '11px')
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => (d.source as SimNode).x || 0)
        .attr('y1', (d) => (d.source as SimNode).y || 0)
        .attr('x2', (d) => (d.target as SimNode).x || 0)
        .attr('y2', (d) => (d.target as SimNode).y || 0);

      nodeGroups.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, onNavigate]);

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="graph-empty">
        <div className="empty-illustration">🕸</div>
        <p>知识图谱为空</p>
        <p className="hint">打开笔记库并创建带有 [[双向链接]] 的笔记后，图谱将自动生成</p>
      </div>
    );
  }

  return (
    <div className="knowledge-graph">
      {hoveredNode && <div className="graph-tooltip">{hoveredNode}</div>}
      <div className="graph-legend">
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#ff6b6b' }}></span> 高连接</span>
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#feca57' }}></span> 中连接</span>
        <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#54a0ff' }}></span> 低连接</span>
      </div>
      <svg ref={svgRef} className="graph-svg" />
    </div>
  );
};

export default KnowledgeGraph;
