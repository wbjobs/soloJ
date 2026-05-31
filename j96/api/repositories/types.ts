import type { Span, ErrorLog, TopologyData, TimeRange, ServiceNode } from '../../shared/types.ts';

export interface TopologyQueryOptions {
  timeRange?: TimeRange;
  maxDepth?: number;
  timeoutMs?: number;
}

export interface ITraceStore {
  testConnection(): Promise<boolean>;
  createIndexes(): Promise<void>;
  saveSpan(span: Span): Promise<void>;
  saveErrorLog(error: ErrorLog): Promise<void>;
  getServiceTopology(options?: TopologyQueryOptions): Promise<TopologyData>;
  getServiceList(): Promise<ServiceNode[]>;
  getServiceSpans(serviceId: string, limit?: number, offset?: number): Promise<{ spans: Span[]; total: number }>;
  getSpanById(spanId: string): Promise<Span | null>;
  getTraceById(traceId: string): Promise<Span[]>;
  getServiceErrors(serviceId: string, limit?: number, offset?: number): Promise<{ errors: ErrorLog[]; total: number }>;
  getErrorById(errorId: string): Promise<ErrorLog | null>;
  clearAllData(): Promise<void>;
  close(): Promise<void>;
}
