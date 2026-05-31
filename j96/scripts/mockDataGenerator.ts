/**
 * Mock 数据生成器
 * 生成模拟的链路追踪数据用于演示和测试
 */
import type { Span, ErrorLog, SpanKind, SpanStatusCode } from '../shared/types.js';
import type { ITraceStore } from '../api/repositories/types.js';

interface MockConfig {
  serviceCount?: number;
  traceCount?: number;
  errorRate?: number;
}

interface GeneratedData {
  spans: Span[];
  errors: ErrorLog[];
}

const SERVICES = [
  'api-gateway',
  'user-service',
  'order-service',
  'payment-service',
  'inventory-service',
  'notification-service',
  'database',
  'redis',
  'kafka',
];

const SPAN_TYPES: Array<{ name: string; kind: SpanKind; attributes: Record<string, any> }> = [
  { name: 'HTTP 请求', kind: 'server', attributes: { 'http.method': 'GET', 'http.url': '/api/v1/users' } },
  { name: 'gRPC 调用', kind: 'client', attributes: { 'rpc.service': 'UserService', 'rpc.method': 'GetUser' } },
  { name: 'DB 查询', kind: 'client', attributes: { 'db.system': 'postgresql', 'db.statement': 'SELECT * FROM users' } },
  { name: '缓存操作', kind: 'client', attributes: { 'cache.system': 'redis', 'cache.operation': 'GET' } },
  { name: '消息发送', kind: 'producer', attributes: { 'messaging.system': 'kafka', 'messaging.destination': 'order-events' } },
];

const ERROR_TYPES = [
  { type: 'DatabaseError', message: 'Connection timeout', stack: 'Error: Connection timeout\n    at Query.execute (/app/db/query.js:42:15)\n    at UserRepository.findById (/app/repositories/user.js:89:21)' },
  { type: 'NetworkError', message: 'Request failed with status 503', stack: 'Error: Request failed with status 503\n    at HttpClient.request (/app/http/client.js:67:13)\n    at OrderService.createOrder (/app/services/order.js:123:34)' },
  { type: 'ValidationError', message: 'Invalid input data', stack: 'Error: Invalid input data\n    at Validator.validate (/app/validation/user.js:34:11)\n    at UserController.create (/app/controllers/user.js:56:28)' },
  { type: 'CacheMissError', message: 'Cache key not found', stack: 'Error: Cache key not found\n    at RedisCache.get (/app/cache/redis.js:45:19)\n    at CacheService.getOrSet (/app/services/cache.js:78:41)' },
  { type: 'TimeoutError', message: 'Operation timed out after 30000ms', stack: 'Error: Operation timed out after 30000ms\n    at Timeout.<anonymous> (/app/utils/timeout.js:23:15)\n    at listOnTimeout (node:internal/timers:569:17)' },
];

/**
 * 生成十六进制 ID
 */
function generateHexId(length: number): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * 生成 Trace ID (32 位十六进制)
 */
function generateTraceId(): string {
  return generateHexId(32);
}

/**
 * 生成 Span ID (16 位十六进制)
 */
function generateSpanId(): string {
  return generateHexId(16);
}

/**
 * 生成随机延迟时间
 */
function randomDuration(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成随机延迟 (毫秒)
 */
function randomLatency(type: string): number {
  switch (type) {
    case 'HTTP 请求': return randomDuration(50, 500);
    case 'gRPC 调用': return randomDuration(10, 200);
    case 'DB 查询': return randomDuration(20, 300);
    case '缓存操作': return randomDuration(1, 50);
    case '消息发送': return randomDuration(5, 100);
    default: return randomDuration(10, 100);
  }
}

/**
 * 生成调用链路径
 */
function generateCallPath(serviceCount: number): string[] {
  const availableServices = SERVICES.slice(0, serviceCount);
  const path: string[] = ['api-gateway'];
  const remaining = availableServices.filter(s => s !== 'api-gateway');

  const stepCount = Math.floor(Math.random() * 4) + 2;
  for (let i = 0; i < stepCount && remaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    path.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  return path;
}

/**
 * 生成模拟 Trace 数据
 * @param config - 配置参数
 * @returns 生成的 Span 和错误日志
 */
export function generateMockTraces(config: MockConfig = {}): GeneratedData {
  const { serviceCount = 9, traceCount = 50, errorRate = 0.1 } = config;
  const actualServiceCount = Math.min(serviceCount, SERVICES.length);
  const spans: Span[] = [];
  const errors: ErrorLog[] = [];
  const now = Date.now();

  for (let traceIdx = 0; traceIdx < traceCount; traceIdx++) {
    const traceId = generateTraceId();
    const callPath = generateCallPath(actualServiceCount);
    const traceStartTime = now - (traceCount - traceIdx) * 60000 - Math.random() * 30000;
    let currentTime = traceStartTime;
    let parentSpanId: string | undefined;

    for (let stepIdx = 0; stepIdx < callPath.length; stepIdx++) {
      const serviceName = callPath[stepIdx];
      const spanType = SPAN_TYPES[Math.floor(Math.random() * SPAN_TYPES.length)];
      const spanId = generateSpanId();
      const duration = randomLatency(spanType.name);
      const hasError = Math.random() < errorRate;
      const statusCode: SpanStatusCode = hasError ? 'ERROR' : (Math.random() < 0.9 ? 'OK' : 'UNSET');

      const span: Span = {
        id: spanId,
        traceId,
        parentSpanId,
        serviceName,
        name: spanType.name,
        kind: spanType.kind,
        startTime: new Date(currentTime).toISOString(),
        endTime: new Date(currentTime + duration).toISOString(),
        duration,
        statusCode,
        statusMessage: hasError ? 'Operation failed' : undefined,
        attributes: {
          ...spanType.attributes,
          'service.name': serviceName,
          'http.status_code': hasError ? 500 : 200,
        },
        events: hasError ? [
          {
            time: new Date(currentTime + Math.floor(duration / 2)).toISOString(),
            name: 'error',
            attributes: { 'error.type': ERROR_TYPES[Math.floor(Math.random() * ERROR_TYPES.length)].type },
          },
        ] : undefined,
      };

      spans.push(span);

      if (hasError) {
        const errorInfo = ERROR_TYPES[Math.floor(Math.random() * ERROR_TYPES.length)];
        const error: ErrorLog = {
          id: generateSpanId(),
          traceId,
          spanId,
          serviceName,
          errorType: errorInfo.type,
          message: errorInfo.message,
          stackTrace: errorInfo.stack,
          timestamp: new Date(currentTime + Math.floor(duration / 2)).toISOString(),
          attributes: {
            'http.url': span.attributes['http.url'],
            'db.statement': span.attributes['db.statement'],
          },
        };
        errors.push(error);
      }

      parentSpanId = spanId;
      currentTime += duration + Math.random() * 10;
    }
  }

  return { spans, errors };
}

/**
 * 将生成的模拟数据注入存储
 * @param store - 存储实例
 * @param config - 配置参数
 * @returns 注入统计结果
 */
export async function injectMockData(store: ITraceStore, config: MockConfig = {}): Promise<{ traces: number; spans: number; errors: number }> {
  const { traceCount = 50 } = config;
  const { spans, errors } = generateMockTraces(config);

  for (const span of spans) {
    await store.saveSpan(span);
  }

  for (const error of errors) {
    await store.saveErrorLog(error);
  }

  return {
    traces: traceCount,
    spans: spans.length,
    errors: errors.length,
  };
}
