export type ServiceStatus = 'healthy' | 'warning' | 'error';
export type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR';
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export type ServiceType = 'http' | 'grpc' | 'database' | 'cache' | 'message-queue' | 'gateway' | 'other';
export type AnomalyType = 'error' | 'latency_spike' | 'error_spike';

export interface SpanEvent {
  time: string;
  name: string;
  attributes: Record<string, any>;
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  serviceName: string;
  name: string;
  kind: SpanKind;
  startTime: string;
  endTime: string;
  duration: number;
  statusCode: SpanStatusCode;
  statusMessage?: string;
  attributes: Record<string, any>;
  events?: SpanEvent[];
}

export interface ServiceNode {
  id: string;
  name: string;
  type: ServiceType;
  status: ServiceStatus;
  callCount: number;
  errorCount: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  lastActive: string;
  anomaly?: {
    type: AnomalyType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    firstOccurredAt: string;
    affectedTraceIds?: string[];
  };
}

export interface CallEdge {
  id: string;
  source: string;
  target: string;
  callCount: number;
  errorCount: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
}

export interface TopologyData {
  nodes: ServiceNode[];
  edges: CallEdge[];
  statistics: {
    totalServices: number;
    totalCalls: number;
    totalErrors: number;
    errorRate: number;
    avgLatency: number;
    anomalyCount: number;
  };
  rootAnomalyServices?: string[];
}

export interface ErrorLog {
  id: string;
  traceId: string;
  spanId: string;
  serviceName: string;
  errorType: string;
  message: string;
  stackTrace?: string;
  timestamp: string;
  attributes: Record<string, any>;
}

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export interface SpanWithChildren extends Span {
  children?: SpanWithChildren[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
