import neo4j, { Driver, int } from 'neo4j-driver';
import type {
  Span,
  ErrorLog,
  ServiceNode,
  TopologyData,
  CallEdge,
} from '../../shared/types.js';
import type { ITraceStore, TopologyQueryOptions } from './types.js';

const toNum = (v: any): number => v?.toNumber?.() || 0;
const toArr = (arr: any[]): number[] => (arr || []).map((v) => v.toNumber());
const getStatus = (r: number): 'healthy' | 'warning' | 'error' =>
  r > 0.2 ? 'error' : r > 0.05 ? 'warning' : 'healthy';
const pct = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(idx, sorted.length - 1)];
};
const calcStats = (nodes: ServiceNode[]): TopologyData['statistics'] => {
  const tc = nodes.reduce((s, n) => s + n.callCount, 0);
  const te = nodes.reduce((s, n) => s + n.errorCount, 0);
  const al = tc > 0 ? nodes.reduce((s, n) => s + n.avgLatency * n.callCount, 0) / tc : 0;
  const ac = nodes.filter((n) => n.anomaly).length;
  return {
    totalServices: nodes.length, totalCalls: tc, totalErrors: te,
    errorRate: Math.round((tc > 0 ? te / tc : 0) * 10000) / 10000,
    avgLatency: Math.round(al),
    anomalyCount: ac,
  };
};

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_TIMEOUT_MS = 5000;

export class Neo4jStore implements ITraceStore {
  private driver: Driver;

  constructor(uri: string, username: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }

  private async withSession<T>(fn: (s: any) => Promise<T>, _timeoutMs?: number): Promise<T> {
    const session = this.driver.session();
    try {
      const result = await fn(session);
      return result;
    } finally {
      await session.close();
    }
  }

  private mapSpan(n: any): Span {
    const p = n.properties;
    return {
      id: p.id, traceId: p.traceId, parentSpanId: p.parentSpanId,
      serviceName: p.serviceName, name: p.name, kind: p.kind,
      startTime: p.startTime, endTime: p.endTime, duration: p.duration.toNumber(),
      statusCode: p.statusCode, statusMessage: p.statusMessage,
      attributes: JSON.parse(p.attributes),
      events: p.events ? JSON.parse(p.events) : undefined,
    };
  }

  private mapError(n: any): ErrorLog {
    const p = n.properties;
    return {
      id: p.id, traceId: p.traceId, spanId: p.spanId,
      serviceName: p.serviceName, errorType: p.errorType, message: p.message,
      stackTrace: p.stackTrace, timestamp: p.timestamp,
      attributes: JSON.parse(p.attributes),
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.withSession((s) => s.run('RETURN 1'));
      return true;
    } catch {
      return false;
    }
  }

  async createIndexes(): Promise<void> {
    await this.withSession(async (s) => {
      const indexes = [
        'CREATE INDEX span_id IF NOT EXISTS FOR (s:Span) ON (s.id)',
        'CREATE INDEX span_traceId IF NOT EXISTS FOR (s:Span) ON (s.traceId)',
        'CREATE INDEX span_serviceName IF NOT EXISTS FOR (s:Span) ON (s.serviceName)',
        'CREATE INDEX service_name IF NOT EXISTS FOR (svc:Service) ON (svc.name)',
        'CREATE INDEX error_id IF NOT EXISTS FOR (e:ErrorLog) ON (e.id)',
      ];
      for (const q of indexes) await s.run(q);
    });
  }

  async saveSpan(span: Span): Promise<void> {
    await this.withSession((s) => s.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (svc:Service {name: $serviceName})
         SET svc.lastActive = $startTime
         CREATE (s:Span $spanProps)
         CREATE (s)-[:BELONGS_TO]->(svc)`,
        {
          serviceName: span.serviceName,
          startTime: span.startTime,
          spanProps: {
            ...span,
            events: span.events ? JSON.stringify(span.events) : null,
            attributes: JSON.stringify(span.attributes),
          },
        }
      );

      if (span.parentSpanId) {
        await tx.run(
          `MATCH (parent:Span {id: $parentSpanId})
           MATCH (child:Span {id: $childSpanId})
           MERGE (parent)-[:PARENT_OF]->(child)
           WITH parent, child
           MATCH (parentSvc:Service)<-[:BELONGS_TO]-(parent)
           MATCH (childSvc:Service)<-[:BELONGS_TO]-(child)
           WHERE parentSvc.name <> childSvc.name
           MERGE (parentSvc)-[r:CALLS]->(childSvc)
           ON CREATE SET r.callCount = 1, r.errorCount = $isError, r.latencies = [$duration]
           ON MATCH SET r.callCount = r.callCount + 1,
                       r.errorCount = r.errorCount + $isError,
                       r.latencies = r.latencies + $duration`,
          {
            parentSpanId: span.parentSpanId,
            childSpanId: span.id,
            isError: span.statusCode === 'ERROR' ? 1 : 0,
            duration: span.duration,
          }
        );
      }
    }));
  }

  async saveErrorLog(error: ErrorLog): Promise<void> {
    await this.withSession((s) => s.executeWrite((tx) =>
      tx.run(
        `CREATE (e:ErrorLog $errorProps)
         WITH e
         MATCH (span:Span {id: $spanId})
         MERGE (e)-[:ASSOCIATED_WITH]->(span)
         WITH e
         MATCH (svc:Service {name: $serviceName})
         MERGE (e)-[:BELONGS_TO]->(svc)`,
        {
          errorProps: { ...error, attributes: JSON.stringify(error.attributes) },
          spanId: error.spanId,
          serviceName: error.serviceName,
        }
      )
    ));
  }

  async getServiceTopology(options?: TopologyQueryOptions): Promise<TopologyData> {
    const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return this.withSession(async (s) => s.executeRead(async (tx) => {
      const depthLimitClause = maxDepth > 0
        ? `WHERE ALL(path IN paths WHERE length(path) <= $maxDepth)`
        : '';

      const nodeResult = await tx.run(
        `MATCH (svc:Service)
         RETURN svc.name AS name, svc.lastActive AS lastActive`,
        {},
        { timeout: timeoutMs }
      );

      const edgeResult = await tx.run(
        `MATCH paths = (src:Service)-[r:CALLS*1..${maxDepth}]->(tgt:Service)
         WITH DISTINCT src, tgt, r
         UNWIND r AS rel
         WITH src, tgt, rel
         RETURN src.name AS source, tgt.name AS target,
                rel.callCount AS callCount, rel.errorCount AS errorCount,
                rel.latencies AS latencies`,
        { maxDepth: int(maxDepth) },
        { timeout: timeoutMs }
      );

      const nodes: ServiceNode[] = nodeResult.records.map((rec) => {
        const name = rec.get('name');
        const relatedEdges = edgeResult.records.filter(
          (e) => e.get('source') === name || e.get('target') === name
        );
        const cc = relatedEdges.reduce((s, e) => s + toNum(e.get('callCount')), 0) || 1;
        const ec = relatedEdges.reduce((s, e) => s + toNum(e.get('errorCount')), 0);
        const lat = relatedEdges.flatMap((e) => toArr(e.get('latencies')));
        const sorted = [...lat].sort((a, b) => a - b);
        const er = cc > 0 ? ec / cc : 0;
        const avg = lat.length > 0 ? lat.reduce((a, b) => a + b, 0) / lat.length : 0;
        return {
          id: name, name, type: 'other', status: getStatus(er),
          callCount: cc, errorCount: ec, avgLatency: Math.round(avg),
          p95Latency: pct(sorted, 95), p99Latency: pct(sorted, 99),
          lastActive: rec.get('lastActive') || new Date().toISOString(),
        };
      });

      const seen = new Set<string>();
      const edges: CallEdge[] = [];
      edgeResult.records.forEach((rec) => {
        const source = rec.get('source');
        const target = rec.get('target');
        const key = `${source}->${target}`;
        if (seen.has(key)) return;
        seen.add(key);
        const cc = toNum(rec.get('callCount'));
        const ec = toNum(rec.get('errorCount'));
        const lat = toArr(rec.get('latencies'));
        const avg = lat.length > 0 ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
        edges.push({
          id: `${source}-${target}`, source, target,
          callCount: cc, errorCount: ec, avgLatency: avg,
          minLatency: lat.length > 0 ? Math.min(...lat) : 0,
          maxLatency: lat.length > 0 ? Math.max(...lat) : 0,
        });
      });

      const nodeIds = new Set(nodes.map((n) => n.id));
      const filteredNodes = nodes.filter((n) => nodeIds.has(n.id));
      const filteredEdges = edges.filter(
        (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
      );

      return { nodes: filteredNodes, edges: filteredEdges, statistics: calcStats(filteredNodes) };
    }), timeoutMs);
  }

  async getServiceList(): Promise<ServiceNode[]> {
    return this.withSession((s) => s.executeRead((tx) =>
      tx.run(
        `MATCH (svc:Service)
         OPTIONAL MATCH (svc)<-[:BELONGS_TO]-(s:Span)
         WITH svc, COUNT(s) AS callCount,
              SUM(CASE WHEN s.statusCode = 'ERROR' THEN 1 ELSE 0 END) AS errorCount,
              COLLECT(s.duration) AS latencies,
              MAX(s.startTime) AS lastActive
         RETURN svc.name AS name, callCount, errorCount, latencies, lastActive`
      ).then((r) => r.records.map((rec) => {
        const name = rec.get('name');
        const cc = toNum(rec.get('callCount'));
        const ec = toNum(rec.get('errorCount'));
        const lat = toArr(rec.get('latencies'));
        const sorted = [...lat].sort((a, b) => a - b);
        const er = cc > 0 ? ec / cc : 0;
        const avg = cc > 0 ? lat.reduce((a, b) => a + b, 0) / cc : 0;
        return {
          id: name, name, type: 'other', status: getStatus(er),
          callCount: cc, errorCount: ec, avgLatency: Math.round(avg),
          p95Latency: pct(sorted, 95), p99Latency: pct(sorted, 99),
          lastActive: rec.get('lastActive') || new Date().toISOString(),
        };
      }))
    ));
  }

  async getServiceSpans(serviceId: string, limit = 20, offset = 0): Promise<{ spans: Span[]; total: number }> {
    return this.withSession((s) => s.executeRead(async (tx) => {
      const countResult = await tx.run(
        `MATCH (:Service {name: $serviceId})<-[:BELONGS_TO]-(s:Span)
         RETURN COUNT(s) AS total`,
        { serviceId }
      );
      const spansResult = await tx.run(
        `MATCH (:Service {name: $serviceId})<-[:BELONGS_TO]-(s:Span)
         RETURN s ORDER BY s.startTime DESC
         SKIP $offset LIMIT $limit`,
        { serviceId, offset: int(offset), limit: int(limit) }
      );
      return {
        total: countResult.records[0]?.get('total')?.toNumber() || 0,
        spans: spansResult.records.map((r) => this.mapSpan(r.get('s'))),
      };
    }));
  }

  async getSpanById(spanId: string): Promise<Span | null> {
    return this.withSession((s) => s.executeRead((tx) =>
      tx.run('MATCH (s:Span {id: $spanId}) RETURN s', { spanId })
        .then((r) => r.records[0] ? this.mapSpan(r.records[0].get('s')) : null)
    ));
  }

  async getTraceById(traceId: string): Promise<Span[]> {
    return this.withSession((s) => s.executeRead((tx) =>
      tx.run(
        `MATCH (s:Span {traceId: $traceId})
         RETURN s ORDER BY s.startTime ASC`,
        { traceId }
      ).then((r) => r.records.map((rec) => this.mapSpan(rec.get('s'))))
    ));
  }

  async getServiceErrors(serviceId: string, limit = 20, offset = 0): Promise<{ errors: ErrorLog[]; total: number }> {
    return this.withSession((s) => s.executeRead(async (tx) => {
      const countResult = await tx.run(
        `MATCH (:Service {name: $serviceId})<-[:BELONGS_TO]-(e:ErrorLog)
         RETURN COUNT(e) AS total`,
        { serviceId }
      );
      const errorsResult = await tx.run(
        `MATCH (:Service {name: $serviceId})<-[:BELONGS_TO]-(e:ErrorLog)
         RETURN e ORDER BY e.timestamp DESC
         SKIP $offset LIMIT $limit`,
        { serviceId, offset: int(offset), limit: int(limit) }
      );
      return {
        total: countResult.records[0]?.get('total')?.toNumber() || 0,
        errors: errorsResult.records.map((r) => this.mapError(r.get('e'))),
      };
    }));
  }

  async getErrorById(errorId: string): Promise<ErrorLog | null> {
    return this.withSession((s) => s.executeRead((tx) =>
      tx.run('MATCH (e:ErrorLog {id: $errorId}) RETURN e', { errorId })
        .then((r) => r.records[0] ? this.mapError(r.records[0].get('e')) : null)
    ));
  }

  async clearAllData(): Promise<void> {
    await this.withSession((s) => s.executeWrite((tx) =>
      tx.run('MATCH (n) DETACH DELETE n')
    ));
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
