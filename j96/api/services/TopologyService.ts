import type { Span, TopologyData, ServiceNode, CallEdge, ServiceStatus, ServiceType } from '../../shared/types.ts';

/**
 * 从 Span 属性推断服务类型
 */
function inferServiceType(span: Span): ServiceType {
  const attrs = span.attributes;
  if (attrs['http.method'] || attrs['http.url'] || attrs['http.route']) return 'http';
  if (attrs['rpc.service'] || attrs['rpc.method'] || attrs['grpc.method']) return 'grpc';
  if (attrs['db.system'] || attrs['db.name']) return 'database';
  if (attrs['cache.key'] || attrs['cache.system']) return 'cache';
  if (attrs['messaging.system'] || attrs['messaging.destination']) return 'message-queue';
  if (attrs['gateway.id'] || attrs['api.id']) return 'gateway';
  return 'other';
}

/**
 * 拓扑图构建服务
 *
 * 提供从 Span 数据构建服务拓扑图的功能，包括服务节点聚合、
 * 调用关系分析、延迟统计和服务健康状态评估。
 */
export const TopologyService = {
  /**
   * 计算百分位数值
   *
   * 使用线性插值法计算指定百分位的数值，用于 P95/P99 等延迟统计。
   *
   * @param values - 数值数组
   * @param percentile - 百分位（0-100）
   * @returns 百分位数值
   *
   * @example
   * ```ts
   * const p95 = TopologyService.calculatePercentile(latencies, 95);
   * ```
   */
  calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] + weight * (sorted[upper] - sorted[lower]);
  },

  /**
   * 根据错误率计算服务状态
   *
   * 错误率阈值：
   * - < 1%: healthy（健康）
   * - 1%-5%: warning（警告）
   * - >= 5%: error（错误）
   *
   * @param errorRate - 错误率（0-1）
   * @returns 服务状态
   *
   * @example
   * ```ts
   * const status = TopologyService.calculateServiceStatus(0.03);
   * ```
   */
  calculateServiceStatus(errorRate: number): ServiceStatus {
    if (errorRate >= 0.05) return 'error';
    if (errorRate >= 0.01) return 'warning';
    return 'healthy';
  },

  /**
   * 从 Span 数据构建拓扑图
   *
   * 聚合服务节点和调用边，计算各服务的调用次数、错误次数、
   * 平均延迟、P95/P99 延迟等统计指标。
   *
   * @param spans - Span 数组
   * @returns 拓扑图数据
   *
   * @example
   * ```ts
   * const topology = TopologyService.buildTopology(spans);
   * ```
   */
  buildTopology(spans: Span[]): TopologyData {
    const serviceMap = new Map<string, {
      callCount: number;
      errorCount: number;
      latencies: number[];
      lastActive: string;
      type: ServiceType;
    }>();

    const edgeMap = new Map<string, {
      callCount: number;
      errorCount: number;
      latencies: number[];
    }>();

    const parentMap = new Map<string, Span>();
    for (const span of spans) {
      parentMap.set(span.id, span);
    }

    for (const span of spans) {
      const serviceName = span.serviceName;

      if (!serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, {
          callCount: 0,
          errorCount: 0,
          latencies: [],
          lastActive: span.startTime,
          type: inferServiceType(span),
        });
      }

      const service = serviceMap.get(serviceName)!;
      service.callCount++;
      service.latencies.push(span.duration);
      if (span.startTime > service.lastActive) {
        service.lastActive = span.startTime;
      }
      if (span.statusCode === 'ERROR') {
        service.errorCount++;
      }

      if (span.parentSpanId) {
        const parentSpan = parentMap.get(span.parentSpanId);
        if (parentSpan && parentSpan.serviceName !== serviceName) {
          const edgeId = `${parentSpan.serviceName}->${serviceName}`;
          if (!edgeMap.has(edgeId)) {
            edgeMap.set(edgeId, {
              callCount: 0,
              errorCount: 0,
              latencies: [],
            });
          }
          const edge = edgeMap.get(edgeId)!;
          edge.callCount++;
          edge.latencies.push(span.duration);
          if (span.statusCode === 'ERROR') {
            edge.errorCount++;
          }
        }
      }
    }

    const nodes: ServiceNode[] = Array.from(serviceMap.entries()).map(([name, data]) => {
      const errorRate = data.callCount > 0 ? data.errorCount / data.callCount : 0;
      return {
        id: name,
        name,
        type: data.type,
        status: TopologyService.calculateServiceStatus(errorRate),
        callCount: data.callCount,
        errorCount: data.errorCount,
        avgLatency: data.callCount > 0
          ? data.latencies.reduce((a, b) => a + b, 0) / data.callCount
          : 0,
        p95Latency: TopologyService.calculatePercentile(data.latencies, 95),
        p99Latency: TopologyService.calculatePercentile(data.latencies, 99),
        lastActive: data.lastActive,
      };
    });

    const edges: CallEdge[] = Array.from(edgeMap.entries()).map(([id, data]) => {
      const [source, target] = id.split('->');
      return {
        id,
        source,
        target,
        callCount: data.callCount,
        errorCount: data.errorCount,
        avgLatency: data.callCount > 0
          ? data.latencies.reduce((a, b) => a + b, 0) / data.callCount
          : 0,
        minLatency: data.callCount > 0 ? Math.min(...data.latencies) : 0,
        maxLatency: data.callCount > 0 ? Math.max(...data.latencies) : 0,
      };
    });

    const totalCalls = spans.length;
    const totalErrors = spans.filter((s) => s.statusCode === 'ERROR').length;
    const allLatencies = spans.map((s) => s.duration);
    const anomalyCount = nodes.filter((n) => n.anomaly).length;

    return {
      nodes,
      edges,
      statistics: {
        totalServices: nodes.length,
        totalCalls,
        totalErrors,
        errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
        avgLatency: totalCalls > 0
          ? allLatencies.reduce((a, b) => a + b, 0) / totalCalls
          : 0,
        anomalyCount,
      },
    };
  },
};
