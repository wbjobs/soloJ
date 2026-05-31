import type { Span, SpanWithChildren, AnomalyType, ServiceNode } from '../../shared/types.ts';
import { TopologyService } from './TopologyService.ts';

/**
 * 按开始时间对 Span 进行排序
 */
function sortSpansByTime<T extends Span>(spans: T[]): T[] {
  return [...spans].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

/**
 * Span 分析服务
 *
 * 提供 Span 数据的分析功能，包括树形结构构建、延迟统计和服务分组分析。
 */
export const SpanAnalysisService = {
  /**
   * 构建 Span 树形结构
   *
   * 根据 parentSpanId 将 Span 组织成父子关系的树形结构，
   * 根节点为没有父 Span 的节点，按开始时间排序。
   *
   * @param spans - Span 数组
   * @returns 带 children 属性的 Span 树数组
   *
   * @example
   * ```ts
   * const tree = SpanAnalysisService.buildSpanTree(spans);
   * ```
   */
  buildSpanTree(spans: Span[]): SpanWithChildren[] {
    const spanMap = new Map<string, SpanWithChildren>();
    const childrenMap = new Map<string, SpanWithChildren[]>();
    const roots: SpanWithChildren[] = [];

    for (const span of spans) {
      const spanWithChildren: SpanWithChildren = { ...span, children: [] };
      spanMap.set(span.id, spanWithChildren);
      childrenMap.set(span.id, []);
    }

    for (const span of spans) {
      const node = spanMap.get(span.id)!;
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        const parent = spanMap.get(span.parentSpanId)!;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortChildren = (nodes: SpanWithChildren[]): SpanWithChildren[] => {
      return sortSpansByTime(nodes).map((node) => ({
        ...node,
        children: node.children ? sortChildren(node.children) : [],
      }));
    };

    return sortChildren(roots);
  },

  /**
   * 计算 Span 持续时间统计
   *
   * 计算延迟的平均值、P95、P99、最小值和最大值。
   *
   * @param spans - Span 数组
   * @returns 延迟统计对象
   *
   * @example
   * ```ts
   * const stats = SpanAnalysisService.calculateSpanDurationStats(spans);
   * console.log(stats.p95);
   * ```
   */
  calculateSpanDurationStats(spans: Span[]): {
    avg: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  } {
    if (spans.length === 0) {
      return { avg: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const durations = spans.map((s) => s.duration);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      avg: sum / durations.length,
      p95: TopologyService.calculatePercentile(durations, 95),
      p99: TopologyService.calculatePercentile(durations, 99),
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  },

  /**
   * 按服务分组统计 Span
   *
   * 将 Span 按服务名分组，并计算每组的延迟统计。
   *
   * @param spans - Span 数组
   * @returns 按服务名分组的统计结果
   *
   * @example
   * ```ts
   * const byService = SpanAnalysisService.groupSpansByService(spans);
   * ```
   */
  groupSpansByService(spans: Span[]): Record<string, {
    spans: Span[];
    count: number;
    errorCount: number;
    stats: { avg: number; p95: number; p99: number; min: number; max: number };
  }> {
    const groups = new Map<string, Span[]>();

    for (const span of spans) {
      if (!groups.has(span.serviceName)) {
        groups.set(span.serviceName, []);
      }
      groups.get(span.serviceName)!.push(span);
    }

    const result: Record<string, {
      spans: Span[];
      count: number;
      errorCount: number;
      stats: { avg: number; p95: number; p99: number; min: number; max: number };
    }> = {};

    for (const [serviceName, serviceSpans] of groups.entries()) {
      result[serviceName] = {
        spans: serviceSpans,
        count: serviceSpans.length,
        errorCount: serviceSpans.filter((s) => s.statusCode === 'ERROR').length,
        stats: SpanAnalysisService.calculateSpanDurationStats(serviceSpans),
      };
    }

    return result;
  },

  /**
   * 检测调用链中的异常节点
   *
   * 分析 Trace 数据，识别调用链中最早出现异常或耗时突增的节点：
   * 1. error: 服务出现错误（statusCode === 'ERROR'）
   * 2. latency_spike: 耗时突增（超过基线 2 倍）
   * 3. error_spike: 错误率突增（>10%）
   *
   * @param spans - 所有 Span 数组
   * @returns 检测到的异常节点 Map<serviceName, AnomalyInfo>
   */
  detectAnomalies(spans: Span[]): Map<string, ServiceNode['anomaly']> {
    const anomalies = new Map<string, ServiceNode['anomaly']>();
    if (spans.length === 0) return anomalies;

    const byService = new Map<string, Span[]>();
    for (const span of spans) {
      if (!byService.has(span.serviceName)) {
        byService.set(span.serviceName, []);
      }
      byService.get(span.serviceName)!.push(span);
    }

    const allDurations = spans.map(s => s.duration);
    const baselineP95 = TopologyService.calculatePercentile(allDurations, 95);

    for (const [serviceName, serviceSpans] of byService.entries()) {
      const errorSpans = serviceSpans.filter(s => s.statusCode === 'ERROR');
      const errorCount = errorSpans.length;
      const errorRate = errorCount / serviceSpans.length;

      const serviceP95 = TopologyService.calculatePercentile(
        serviceSpans.map(s => s.duration),
        95,
      );
      const latencySpikeRatio = baselineP95 > 0 ? serviceP95 / baselineP95 : 1;

      let anomalyType: AnomalyType | null = null;
      let severity: ServiceNode['anomaly']['severity'] = 'low';
      let message = '';

      if (errorCount > 0) {
        anomalyType = 'error';
        if (errorRate >= 0.5) severity = 'critical';
        else if (errorRate >= 0.2) severity = 'high';
        else if (errorRate >= 0.1) severity = 'medium';
        message = `检测到 ${errorCount} 个错误，错误率 ${(errorRate * 100).toFixed(1)}%`;
      } else if (errorRate > 0.1) {
        anomalyType = 'error_spike';
        severity = errorRate > 0.3 ? 'high' : 'medium';
        message = `错误率突增: ${(errorRate * 100).toFixed(1)}%`;
      } else if (latencySpikeRatio >= 2) {
        anomalyType = 'latency_spike';
        if (latencySpikeRatio >= 5) severity = 'critical';
        else if (latencySpikeRatio >= 3) severity = 'high';
        else severity = 'medium';
        message = `耗时突增: P95 ${serviceP95.toFixed(0)}ms，超出基线 ${(latencySpikeRatio - 1) * 100}%`;
      }

      if (anomalyType) {
        const firstError = errorSpans.sort((a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )[0] || serviceSpans[0];

        const affectedTraceIds = [...new Set(serviceSpans.slice(0, 5).map(s => s.traceId))];

        anomalies.set(serviceName, {
          type: anomalyType,
          severity,
          message,
          firstOccurredAt: firstError.startTime,
          affectedTraceIds,
        });
      }
    }

    return anomalies;
  },

  /**
   * 查找调用链的根异常节点
   *
   * 在检测到异常的服务中，查找调用链中最早（最上游）出现异常的节点。
   * 这些根异常节点是问题的根源，需要高亮闪烁警示。
   *
   * @param spans - 所有 Span 数组
   * @param anomalies - 已检测到的异常 Map
   * @returns 根异常服务名称数组（按出现时间排序）
   */
  findRootAnomalyServices(
    spans: Span[],
    anomalies: Map<string, ServiceNode['anomaly']>,
  ): string[] {
    if (anomalies.size === 0) return [];

    const spanMap = new Map(spans.map(s => [s.id, s]));
    const serviceErrorTimes = new Map<string, number>();

    for (const [serviceName] of anomalies) {
      const serviceSpans = spans.filter(
        s => s.serviceName === serviceName && s.statusCode === 'ERROR',
      );
      if (serviceSpans.length > 0) {
        const firstTime = Math.min(...serviceSpans.map(s => new Date(s.startTime).getTime()));
        serviceErrorTimes.set(serviceName, firstTime);
      }
    }

    const parentMap = new Map<string, Set<string>>();
    for (const span of spans) {
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        const parent = spanMap.get(span.parentSpanId)!;
        if (parent.serviceName !== span.serviceName) {
          if (!parentMap.has(span.serviceName)) {
            parentMap.set(span.serviceName, new Set());
          }
          parentMap.get(span.serviceName)!.add(parent.serviceName);
        }
      }
    }

    const rootServices: string[] = [];
    for (const [serviceName] of anomalies) {
      const parents = parentMap.get(serviceName) || new Set();
      const hasAnomalyParent = [...parents].some(p => anomalies.has(p));
      if (!hasAnomalyParent) {
        rootServices.push(serviceName);
      }
    }

    return rootServices.sort((a, b) => {
      const timeA = serviceErrorTimes.get(a) || 0;
      const timeB = serviceErrorTimes.get(b) || 0;
      return timeA - timeB;
    });
  },
};
