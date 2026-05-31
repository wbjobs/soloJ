import { useEffect, useRef } from 'react';
import G6, { Graph, NodeConfig, EdgeConfig, INode } from '@antv/g6';
import type { ServiceNode, TopologyData } from '../../../shared/types';
import { Loader2 } from 'lucide-react';

interface TopologyGraphProps {
  data: TopologyData | null;
  selectedService: ServiceNode | null;
  onNodeClick: (node: ServiceNode) => void;
  loading: boolean;
}

const statusColors: Record<string, string> = {
  healthy: 'var(--color-healthy)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
};

const getNodeSize = (callCount: number): number => {
  const normalized = Math.min(Math.max(callCount, 1), 1000);
  return 30 + ((normalized - 1) / 999) * 30;
};

const getEdgeWidth = (callCount: number): number => {
  return Math.max(1, Math.min(callCount / 100, 5));
};

export default function TopologyGraph({ data, selectedService, onNodeClick, loading }: TopologyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    G6.registerNode(
      'glow-node',
      {
        draw(cfg: NodeConfig, group) {
          const size = (cfg.size as number[]) || [40, 40];
          const color = cfg.isRootAnomaly
            ? '#ff0000'
            : cfg.anomaly
              ? '#ff4444'
              : statusColors[cfg.status as string] || statusColors.healthy;
          const r = size[0] / 2;

          if (cfg.isRootAnomaly) {
            group.addShape('circle', {
              attrs: { x: 0, y: 0, r: r + 20, fill: 'transparent', stroke: '#ff0000', lineWidth: 2, opacity: 0.8 },
              name: 'warning-ring',
            });
          }

          group.addShape('circle', {
            attrs: { x: 0, y: 0, r: r + 8, fill: color, opacity: 0.3, filter: 'blur(8px)' },
            name: 'outer-glow',
          });

          group.addShape('circle', {
            attrs: { x: 0, y: 0, r, fill: color, stroke: cfg.isRootAnomaly ? '#ff3333' : 'var(--color-bg-secondary)', lineWidth: cfg.isRootAnomaly ? 3 : 2 },
            name: 'main-circle',
          });

          group.addShape('circle', {
            attrs: { x: 0, y: 0, r: r - 8, fill: 'rgba(255,255,255,0.1)' },
            name: 'inner-highlight',
          });

          if (cfg.label) {
            group.addShape('text', {
              attrs: {
                x: 0, y: r + 18, text: cfg.label, fontSize: 12,
                fill: cfg.isRootAnomaly ? '#ff6666' : 'var(--color-text-primary)',
                textAlign: 'center', textBaseline: 'top', fontWeight: cfg.isRootAnomaly ? 'bold' : 'normal',
              },
              name: 'label',
            });
          }

          if (cfg.anomaly) {
            const ex = -r - 3;
            const ey = -r + 3;
            group.addShape('text', {
              attrs: {
                x: ex, y: ey, text: '⚠', fontSize: 14, fill: cfg.isRootAnomaly ? '#ff0000' : '#ff6600',
                fontWeight: 'bold',
              },
              name: 'anomaly-icon',
            });
          }

          return group.addShape('circle', {
            attrs: { x: 0, y: 0, r: r + 5, fill: 'transparent' },
            name: 'hit-area',
          });
        },
      },
      'single-node'
    );

    G6.registerEdge(
      'gradient-edge',
      {
        draw(cfg: EdgeConfig, group) {
          const start = cfg.startPoint as { x: number; y: number };
          const end = cfg.endPoint as { x: number; y: number };
          const width = getEdgeWidth((cfg.callCount as number) || 1);
          const gradient = {
            type: 'linear' as const,
            x: 0, y: 0, x2: 1, y2: 1,
            stops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.8)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.8)' },
            ],
          };

          group.addShape('path', {
            attrs: {
              path: [['M', start.x, start.y], ['L', end.x, end.y]],
              stroke: gradient as unknown as string, lineWidth: width,
              endArrow: { path: G6.Arrow.triangle(8, 10, 0), fill: 'rgba(139, 92, 246, 0.9)' },
            },
            name: 'edge-path',
          });

          return group.addShape('path', {
            attrs: {
              path: [['M', start.x, start.y], ['L', end.x, end.y]],
              stroke: 'transparent', lineWidth: width + 10,
            },
            name: 'edge-hit',
          });
        },
      },
      'single-edge'
    );

    const graph = new G6.Graph({
      container: containerRef.current,
      width, height,
      fitView: true, fitViewPadding: 80,
      modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'] },
      layout: {
        type: 'force', linkDistance: 150, nodeStrength: -300,
        collideStrength: 0.8, alpha: 0.3, alphaDecay: 0.028, animate: true,
      },
      defaultNode: { type: 'glow-node' },
      defaultEdge: { type: 'gradient-edge' },
      nodeStateStyles: {
        selected: { 'main-circle': { stroke: 'var(--color-accent)', lineWidth: 4 }, 'outer-glow': { opacity: 0.6 } },
        active: { 'main-circle': { stroke: 'var(--color-accent)', lineWidth: 3 } },
        inactive: { 'main-circle': { opacity: 0.3 }, 'outer-glow': { opacity: 0.1 }, label: { opacity: 0.3 } },
      },
      edgeStateStyles: {
        active: { 'edge-path': { lineWidth: 3, stroke: 'var(--color-accent)' } },
        inactive: { 'edge-path': { opacity: 0.1 } },
      },
    });

    graphRef.current = graph;

    graph.on('node:click', (evt) => {
      const model = evt.item?.getModel();
      if (model?.originalData) onNodeClick(model.originalData as ServiceNode);
    });

    graph.on('node:mouseenter', (evt) => {
      const node = evt.item as INode;
      if (!node) return;
      graph.setItemState(node, 'active', true);
      node.getEdges().forEach((edge) => {
        graph.setItemState(edge, 'active', true);
        const related = edge.getSource() === node ? edge.getTarget() : edge.getSource();
        graph.setItemState(related, 'active', true);
      });
    });

    graph.on('node:mouseleave', (evt) => {
      const node = evt.item as INode;
      if (!node) return;
      graph.setItemState(node, 'active', false);
      node.getEdges().forEach((edge) => {
        graph.setItemState(edge, 'active', false);
        const related = edge.getSource() === node ? edge.getTarget() : edge.getSource();
        graph.setItemState(related, 'active', false);
      });
    });

    const handleResize = () => {
      if (!containerRef.current || !graphRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      graphRef.current.changeSize(w, h);
      graphRef.current.fitView(80);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      graph.destroy();
    };
  }, [onNodeClick]);

  useEffect(() => {
    if (!graphRef.current || !data) return;

    const rootAnomalySet = new Set(data.rootAnomalyServices || []);

    const nodes: NodeConfig[] = data.nodes.map((node) => ({
      id: node.id, label: node.name, size: getNodeSize(node.callCount),
      status: node.status, callCount: node.callCount, originalData: node,
      anomaly: node.anomaly,
      isRootAnomaly: rootAnomalySet.has(node.id),
    }));

    const edges: EdgeConfig[] = data.edges.map((edge) => ({
      id: edge.id, source: edge.source, target: edge.target,
      callCount: edge.callCount, type: 'gradient-edge',
    }));

    graphRef.current.data({ nodes, edges });
    graphRef.current.render();

    const animate = () => {
      if (!graphRef.current) return;
      graphRef.current.getNodes().forEach((item) => {
        const model = item.getModel();
        const group = item.getContainer();
        const glow = group.find((e) => e.get('name') === 'outer-glow');
        const circle = group.find((e) => e.get('name') === 'main-circle');
        const warning = group.find((e) => e.get('name') === 'warning-ring');

        if (model.isRootAnomaly && warning) {
          warning.attr('opacity', 0.3 + Math.sin(Date.now() / 250) * 0.7);
          warning.attr('lineWidth', 2 + Math.sin(Date.now() / 300) * 2);
        }
        if (glow) {
          if (model.isRootAnomaly) {
            glow.attr('opacity', 0.5 + Math.sin(Date.now() / 200) * 0.5);
            glow.attr('r', (model.size as number[])[0] / 2 + 12 + Math.sin(Date.now() / 250) * 5);
          } else if (model.anomaly) {
            glow.attr('opacity', 0.4 + Math.sin(Date.now() / 400) * 0.3);
            glow.attr('r', (model.size as number[])[0] / 2 + 10);
          } else if (model.status === 'error') {
            glow.attr('opacity', 0.5 + Math.sin(Date.now() / 800) * 0.3);
          } else {
            glow.attr('opacity', 0.3 + Math.sin(Date.now() / 800) * 0.15);
          }
        }
        if (circle) {
          if (model.isRootAnomaly) {
            circle.attr('transform', `s(${1 + Math.sin(Date.now() / 200) * 0.15})`);
          } else if (model.anomaly) {
            circle.attr('transform', `s(${1 + Math.sin(Date.now() / 400) * 0.08})`);
          } else if (model.status === 'error') {
            circle.attr('transform', `s(${1 + Math.sin(Date.now() / 400) * 0.1})`);
          }
        }
      });
      requestAnimationFrame(animate);
    };
    animate();
  }, [data]);

  useEffect(() => {
    if (!graphRef.current) return;

    graphRef.current.getNodes().forEach((node) => {
      const isSelected = selectedService?.id === node.getModel().id;
      graphRef.current?.setItemState(node, 'selected', isSelected);
      graphRef.current?.setItemState(node, 'inactive', !!selectedService && !isSelected);
    });

    graphRef.current.getEdges().forEach((edge) => {
      const sourceId = edge.getSource().getModel().id;
      const targetId = edge.getTarget().getModel().id;
      const isRelated = selectedService && (sourceId === selectedService.id || targetId === selectedService.id);
      graphRef.current?.setItemState(edge, 'inactive', !!selectedService && !isRelated);
      graphRef.current?.setItemState(edge, 'active', !!isRelated);
    });
  }, [selectedService]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: 'radial-gradient(ellipse at center, var(--color-bg-secondary) 0%, var(--color-bg-primary) 70%)' }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 text-xs text-gray-400">
        {(['healthy', 'warning', 'error'] as const).map((status) => (
          <div key={status} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[status] }} />
            <span>{status === 'healthy' ? '正常' : status === 'warning' ? '警告' : '错误'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
