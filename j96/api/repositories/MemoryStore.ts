import type {
  Span,
  ErrorLog,
  ServiceNode,
  TopologyData,
  CallEdge,
  ServiceType,
  ServiceStatus,
} from '../../shared/types.js';
import type { ITraceStore, TopologyQueryOptions } from './types.js';
import { SpanAnalysisService } from '../services/SpanAnalysisService.js';

interface ServiceAggregate {
  callCount: number;
  errorCount: number;
  latencies: number[];
  lastActive: string;
  type: ServiceType;
}

interface CallRelationAggregate {
  source: string;
  target: string;
  callCount: number;
  errorCount: number;
  latencies: number[];
}

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(idx, sorted.length - 1)];
}

function getStatus(errorRate: number): ServiceStatus {
  if (errorRate > 0.2) return 'error';
  if (errorRate > 0.05) return 'warning';
  return 'healthy';
}

function detectType(attrs: Record<string, any>): ServiceType {
  const keys = Object.keys(attrs);
  if (keys.some((k) => k.includes('http'))) return 'http';
  if (keys.some((k) => k.includes('grpc'))) return 'grpc';
  if (keys.some((k) => k.includes('db'))) return 'database';
  if (keys.some((k) => k.includes('redis') || k.includes('cache'))) return 'cache';
  if (keys.some((k) => k.includes('mq') || k.includes('kafka'))) return 'message-queue';
  if (keys.some((k) => k.includes('gateway'))) return 'gateway';
  return 'other';
}

export class MemoryStore implements ITraceStore {
  private spans = new Map<string, Span>();
  private errors = new Map<string, ErrorLog>();
  private serviceIndex = new Map<string, Set<string>>();
  private traceIndex = new Map<string, Set<string>>();

  private serviceAgg = new Map<string, ServiceAggregate>();
  private callAgg = new Map<string, CallRelationAggregate>();

  private callGraph = new Map<string, Set<string>>();
  private dirty = false;
  private cachedTopology: TopologyData | null = null;

  async testConnection(): Promise<boolean> { return true; }
  async createIndexes(): Promise<void> {}
  async close(): Promise<void> {}

  async saveSpan(span: Span): Promise<void> {
    this.spans.set(span.id, span);
    this.dirty = true;
    this.cachedTopology = null;

    if (!this.serviceIndex.has(span.serviceName)) {
      this.serviceIndex.set(span.serviceName, new Set());
      this.serviceAgg.set(span.serviceName, {
        callCount: 0, errorCount: 0, latencies: [], lastActive: span.startTime, type: 'other',
      });
      this.callGraph.set(span.serviceName, new Set());
    }
    this.serviceIndex.get(span.serviceName)!.add(span.id);

    if (!this.traceIndex.has(span.traceId)) {
      this.traceIndex.set(span.traceId, new Set());
    }
    this.traceIndex.get(span.traceId)!.add(span.id);

    const agg = this.serviceAgg.get(span.serviceName)!;
    agg.callCount++;
    if (span.statusCode === 'ERROR') agg.errorCount++;
    agg.latencies.push(span.duration);
    if (span.startTime > agg.lastActive) agg.lastActive = span.startTime;
    agg.type = detectType(span.attributes);

    if (span.parentSpanId) {
      const parent = this.spans.get(span.parentSpanId);
      if (parent && parent.serviceName !== span.serviceName) {
        const key = `${parent.serviceName}->${span.serviceName}`;
        if (!this.callAgg.has(key)) {
          this.callAgg.set(key, {
            source: parent.serviceName,
            target: span.serviceName,
            callCount: 0,
            errorCount: 0,
            latencies: [],
          });
        }
        const rel = this.callAgg.get(key)!;
        rel.callCount++;
        if (span.statusCode === 'ERROR') rel.errorCount++;
        rel.latencies.push(span.duration);

        if (!this.callGraph.has(parent.serviceName)) {
          this.callGraph.set(parent.serviceName, new Set());
        }
        this.callGraph.get(parent.serviceName)!.add(span.serviceName);
      }
    }
  }

  async saveErrorLog(error: ErrorLog): Promise<void> {
    this.errors.set(error.id, error);
  }

  async getServiceTopology(options?: TopologyQueryOptions): Promise<TopologyData> {
    const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeRange = options?.timeRange;

    const compute = async (): Promise<TopologyData> => {
      let nodes: ServiceNode[];
      let edges: CallEdge[];
      let allSpans: Span[] = [];

      if (timeRange) {
        const result = this.computeFromSpans(timeRange);
        nodes = result.nodes;
        edges = result.edges;
        allSpans = result.spans;
      } else {
        nodes = this.buildNodesFromAgg();
        edges = this.buildEdgesFromAgg();
        allSpans = Array.from(this.spans.values());
      }

      const anomalies = SpanAnalysisService.detectAnomalies(allSpans);
      nodes = nodes.map((node) => {
        const anomaly = anomalies.get(node.id);
        return anomaly ? { ...node, anomaly } : node;
      });

      const rootAnomalyServices = SpanAnalysisService.findRootAnomalyServices(allSpans, anomalies);

      const topology: TopologyData = {
        nodes,
        edges,
        statistics: this.calcStats(nodes, edges),
        rootAnomalyServices,
      };

      if (!timeRange) {
        this.cachedTopology = topology;
        this.dirty = false;
      }

      return this.applyDepthLimit(topology, maxDepth);
    };

    return withTimeout(compute(), timeoutMs);
  }

  async getServiceList(): Promise<ServiceNode[]> {
    return this.buildNodesFromAgg();
  }

  async getServiceSpans(serviceId: string, limit = 20, offset = 0): Promise<{ spans: Span[]; total: number }> {
    const ids = this.serviceIndex.get(serviceId) || new Set();
    const all = Array.from(ids)
      .map((id) => this.spans.get(id)!)
      .filter(Boolean)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return { spans: all.slice(offset, offset + limit), total: all.length };
  }

  async getSpanById(spanId: string): Promise<Span | null> {
    return this.spans.get(spanId) || null;
  }

  async getTraceById(traceId: string): Promise<Span[]> {
    const ids = this.traceIndex.get(traceId) || new Set();
    return Array.from(ids)
      .map((id) => this.spans.get(id)!)
      .filter(Boolean)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  async getServiceErrors(serviceId: string, limit = 20, offset = 0): Promise<{ errors: ErrorLog[]; total: number }> {
    const all = Array.from(this.errors.values())
      .filter((e) => e.serviceName === serviceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { errors: all.slice(offset, offset + limit), total: all.length };
  }

  async getErrorById(errorId: string): Promise<ErrorLog | null> {
    return this.errors.get(errorId) || null;
  }

  async clearAllData(): Promise<void> {
    this.spans.clear();
    this.errors.clear();
    this.serviceIndex.clear();
    this.traceIndex.clear();
    this.serviceAgg.clear();
    this.callAgg.clear();
    this.callGraph.clear();
    this.dirty = false;
    this.cachedTopology = null;
  }

  private buildNodesFromAgg(): ServiceNode[] {
    const nodes: ServiceNode[] = [];
    this.serviceAgg.forEach((agg, name) => {
      const sorted = [...agg.latencies].sort((a, b) => a - b);
      const er = agg.callCount > 0 ? agg.errorCount / agg.callCount : 0;
      const avg = agg.callCount > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
      nodes.push({
        id: name, name, type: agg.type, status: getStatus(er),
        callCount: agg.callCount, errorCount: agg.errorCount,
        avgLatency: Math.round(avg),
        p95Latency: computePercentile(sorted, 95),
        p99Latency: computePercentile(sorted, 99),
        lastActive: agg.lastActive,
      });
    });
    return nodes.sort((a, b) => b.callCount - a.callCount);
  }

  private buildEdgesFromAgg(): CallEdge[] {
    return Array.from(this.callAgg.values()).map((rel) => ({
      id: `${rel.source}-${rel.target}`,
      source: rel.source,
      target: rel.target,
      callCount: rel.callCount,
      errorCount: rel.errorCount,
      avgLatency: Math.round(rel.latencies.reduce((a, b) => a + b, 0) / rel.latencies.length),
      minLatency: Math.min(...rel.latencies),
      maxLatency: Math.max(...rel.latencies),
    }));
  }

  private applyDepthLimit(topology: TopologyData, maxDepth: number): TopologyData {
    if (maxDepth <= 0 || !topology.edges.length) return topology;

    const adjacency = new Map<string, string[]>();
    topology.edges.forEach((e) => {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      adjacency.get(e.source)!.push(e.target);
    });

    const reachable = new Set<string>();
    const roots = topology.nodes.filter(
      (n) => !topology.edges.some((e) => e.target === n.id),
    );
    const seedNodes = roots.length > 0 ? roots : topology.nodes.slice(0, 5);
    seedNodes.forEach((n) => reachable.add(n.id));

    const visited = new Set<string>();
    const queue: { node: string; depth: number }[] = seedNodes.map((n) => ({ node: n.id, depth: 0 }));
    visited.clear();
    seedNodes.forEach((n) => visited.add(n.id));

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;
      const neighbors = adjacency.get(node) || [];
      for (const next of neighbors) {
        reachable.add(next);
        if (!visited.has(next)) {
          visited.add(next);
          queue.push({ node: next, depth: depth + 1 });
        }
      }
    }

    const filteredNodes = topology.nodes.filter((n) => reachable.has(n.id));
    const filteredEdges = topology.edges.filter(
      (e) => reachable.has(e.source) && reachable.has(e.target),
    );
    const filteredRootAnomalies = (topology.rootAnomalyServices || []).filter((s) =>
      reachable.has(s),
    );
    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      statistics: this.calcStats(filteredNodes, filteredEdges),
      rootAnomalyServices: filteredRootAnomalies,
    };
  }

  private computeFromSpans(timeRange: { startTime: string; endTime: string }): { nodes: ServiceNode[]; edges: CallEdge[]; spans: Span[] } {
    const start = new Date(timeRange.startTime).getTime();
    const end = new Date(timeRange.endTime).getTime();
    const filtered = Array.from(this.spans.values()).filter((s) => {
      const t = new Date(s.startTime).getTime();
      return t >= start && t <= end;
    });

    const svcMap = new Map<string, { spans: Span[]; count: number; errors: number; lats: number[]; last: string; type: ServiceType }>();
    filtered.forEach((s) => {
      if (!svcMap.has(s.serviceName)) {
        svcMap.set(s.serviceName, { spans: [], count: 0, errors: 0, lats: [], last: s.startTime, type: 'other' });
      }
      const d = svcMap.get(s.serviceName)!;
      d.count++;
      d.lats.push(s.duration);
      if (s.statusCode === 'ERROR') d.errors++;
      if (s.startTime > d.last) d.last = s.startTime;
      d.type = detectType(s.attributes);
    });

    const nodes: ServiceNode[] = [];
    svcMap.forEach((d, name) => {
      const sorted = [...d.lats].sort((a, b) => a - b);
      const er = d.count > 0 ? d.errors / d.count : 0;
      const avg = d.count > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
      nodes.push({
        id: name, name, type: d.type, status: getStatus(er),
        callCount: d.count, errorCount: d.errors,
        avgLatency: Math.round(avg),
        p95Latency: computePercentile(sorted, 95),
        p99Latency: computePercentile(sorted, 99),
        lastActive: d.last,
      });
    });

    const spanMap = new Map(filtered.map((s) => [s.id, s]));
    const edgeMap = new Map<string, { source: string; target: string; count: number; errors: number; lats: number[] }>();
    filtered.forEach((s) => {
      if (s.parentSpanId) {
        const parent = spanMap.get(s.parentSpanId);
        if (parent && parent.serviceName !== s.serviceName) {
          const key = `${parent.serviceName}->${s.serviceName}`;
          const e = edgeMap.get(key) || { source: parent.serviceName, target: s.serviceName, count: 0, errors: 0, lats: [] };
          e.count++;
          if (s.statusCode === 'ERROR') e.errors++;
          e.lats.push(s.duration);
          edgeMap.set(key, e);
        }
      }
    });

    const edges: CallEdge[] = Array.from(edgeMap.values()).map((e) => ({
      id: `${e.source}-${e.target}`, source: e.source, target: e.target,
      callCount: e.count, errorCount: e.errors,
      avgLatency: Math.round(e.lats.reduce((a, b) => a + b, 0) / e.lats.length),
      minLatency: Math.min(...e.lats),
      maxLatency: Math.max(...e.lats),
    }));

    return { nodes, edges, spans: filtered };
  }

  private calcStats(nodes: ServiceNode[], edges: CallEdge[]): TopologyData['statistics'] {
    const tc = nodes.reduce((s, n) => s + n.callCount, 0);
    const te = nodes.reduce((s, n) => s + n.errorCount, 0);
    const al = tc > 0 ? nodes.reduce((s, n) => s + n.avgLatency * n.callCount, 0) / tc : 0;
    const anomalyCount = nodes.filter((n) => n.anomaly).length;
    return {
      totalServices: nodes.length, totalCalls: tc, totalErrors: te,
      errorRate: Math.round((tc > 0 ? te / tc : 0) * 10000) / 10000,
      avgLatency: Math.round(al),
      anomalyCount,
    };
  }
}
