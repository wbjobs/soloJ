import type { Request, Response } from 'express';
import type { Span, ErrorLog, SpanKind, SpanStatusCode, ApiResponse } from '../../shared/types.ts';
import type { ITraceStore } from '../repositories/types.ts';

function generateId(): string {
  return Math.random().toString(16).slice(2, 18);
}

const SERVICE_CHAIN = [
  'api-gateway', 'auth-service', 'user-service', 'order-service',
  'payment-service', 'inventory-service', 'notification-service',
  'shipping-service', 'analytics-service', 'database-primary',
  'database-replica', 'redis-cache', 'kafka-broker', 'elasticsearch',
  'config-service', 'discovery-service',
];

const OPERATION_MAP: Record<string, string[]> = {
  'api-gateway': ['POST /api/v1/requests', 'GET /api/v1/status', 'PUT /api/v1/config'],
  'auth-service': ['validateToken', 'refreshSession', 'checkPermission'],
  'user-service': ['getUser', 'createUser', 'updateProfile'],
  'order-service': ['createOrder', 'getOrder', 'listOrders'],
  'payment-service': ['processPayment', 'refund', 'getTransaction'],
  'inventory-service': ['checkStock', 'reserveItem', 'updateInventory'],
  'notification-service': ['sendEmail', 'pushNotification', 'sendSMS'],
  'shipping-service': ['createShipment', 'trackPackage', 'updateDelivery'],
  'analytics-service': ['trackEvent', 'generateReport', 'aggregateMetrics'],
  'database-primary': ['db.query', 'db.insert', 'db.update'],
  'database-replica': ['db.read', 'db.scan', 'db.count'],
  'redis-cache': ['cache.get', 'cache.set', 'cache.invalidate'],
  'kafka-broker': ['mq.produce', 'mq.consume', 'mq.commit'],
  'elasticsearch': ['es.search', 'es.index', 'es.aggregate'],
  'config-service': ['getConfig', 'watchConfig', 'reloadConfig'],
  'discovery-service': ['register', 'deregister', 'heartbeat'],
};

const ERROR_TYPES = [
  { type: 'ConnectionTimeoutError', msg: 'Connection timed out after 30000ms', stack: 'at HttpClient.request (http.ts:142)\nat ServiceClient.call (client.ts:89)' },
  { type: 'DatabaseQueryError', msg: 'Query execution failed: deadlock detected', stack: 'at PgPool.query (pg.ts:231)\nat Repository.find (repo.ts:56)' },
  { type: 'CircuitBreakerOpenError', msg: 'Circuit breaker is open for service', stack: 'at CircuitBreaker.execute (breaker.ts:78)\nat Proxy.forward (proxy.ts:34)' },
  { type: 'RateLimitExceededError', msg: 'Rate limit exceeded: 429 Too Many Requests', stack: 'at RateLimiter.check (limiter.ts:112)\nat Middleware.handle (middleware.ts:45)' },
  { type: 'InternalServerError', msg: 'Internal Server Error', stack: 'at Service.process (service.ts:67)\nat Handler.dispatch (handler.ts:23)' },
];

function generateFlatTraces(
  serviceCount: number,
  traceCount: number,
  errorRate: number,
): { spans: Span[]; errors: ErrorLog[] } {
  const services = SERVICE_CHAIN.slice(0, serviceCount);
  const spans: Span[] = [];
  const errors: ErrorLog[] = [];
  const now = Date.now();

  for (let t = 0; t < traceCount; t++) {
    const traceId = generateId();
    const spanCount = Math.floor(Math.random() * 5) + 2;
    let parentSpanId: string | undefined;

    for (let s = 0; s < spanCount; s++) {
      const spanId = generateId();
      const serviceName = services[Math.floor(Math.random() * services.length)];
      const ops = OPERATION_MAP[serviceName] || ['process'];
      const startTime = now - (traceCount - t) * 60000 - s * 100 + Math.random() * 50;
      const duration = Math.random() * 500 + 10;
      const isError = Math.random() < errorRate;
      const statusCode: SpanStatusCode = isError ? 'ERROR' : 'OK';

      const span: Span = {
        id: spanId, traceId, parentSpanId, serviceName,
        name: ops[Math.floor(Math.random() * ops.length)],
        kind: s === 0 ? 'server' : 'client',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(startTime + duration).toISOString(),
        duration: Math.round(duration),
        statusCode,
        statusMessage: isError ? 'Internal Server Error' : undefined,
        attributes: { 'http.method': 'GET', 'http.url': `/${serviceName}/resource`, 'db.system': 'postgresql' },
        events: undefined,
      };

      spans.push(span);
      parentSpanId = spanId;

      if (isError) {
        const errInfo = ERROR_TYPES[Math.floor(Math.random() * ERROR_TYPES.length)];
        errors.push({
          id: `error-${spanId}-${now}`, traceId, spanId, serviceName,
          errorType: errInfo.type, message: errInfo.msg, stackTrace: errInfo.stack,
          timestamp: span.startTime, attributes: span.attributes,
        });
      }
    }
  }
  return { spans, errors };
}

function generateDeepChainTraces(
  maxDepth: number,
  chainCount: number,
  errorRate: number,
): { spans: Span[]; errors: ErrorLog[] } {
  const spans: Span[] = [];
  const errors: ErrorLog[] = [];
  const now = Date.now();
  const depth = Math.max(maxDepth, 5);

  for (let c = 0; c < chainCount; c++) {
    const traceId = generateId();
    let parentSpanId: string | undefined;

    for (let d = 0; d < depth; d++) {
      const spanId = generateId();
      const svcIdx = Math.min(d, SERVICE_CHAIN.length - 1);
      const serviceName = SERVICE_CHAIN[svcIdx];
      const ops = OPERATION_MAP[serviceName] || ['process'];
      const startTime = now - (chainCount - c) * 120000 - d * 200 + Math.random() * 30;
      const baseDuration = 50 + d * 30;
      const duration = baseDuration + Math.random() * 200;
      const isError = d > depth * 0.7 && Math.random() < errorRate * 2;
      const statusCode: SpanStatusCode = isError ? 'ERROR' : 'OK';

      const span: Span = {
        id: spanId, traceId, parentSpanId, serviceName,
        name: ops[Math.floor(Math.random() * ops.length)],
        kind: d === 0 ? 'server' : 'client',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(startTime + duration).toISOString(),
        duration: Math.round(duration),
        statusCode,
        statusMessage: isError ? 'Deep chain error' : undefined,
        attributes: {
          'http.method': d === 0 ? 'POST' : 'GET',
          'http.url': `/${serviceName}/depth-${d}`,
          'db.system': d > depth * 0.6 ? 'postgresql' : undefined,
          'call.depth': d,
        },
        events: undefined,
      };

      spans.push(span);
      parentSpanId = spanId;

      if (isError) {
        const errInfo = ERROR_TYPES[Math.floor(Math.random() * ERROR_TYPES.length)];
        errors.push({
          id: `error-${spanId}-${now}`, traceId, spanId, serviceName,
          errorType: errInfo.type, message: `Depth ${d}: ${errInfo.msg}`,
          stackTrace: `${errInfo.stack}\nat DeepChain.level${d} (chain.ts:${d * 17 + 3})`,
          timestamp: span.startTime, attributes: span.attributes,
        });
      }
    }
  }
  return { spans, errors };
}

export const MockController = {
  async generateMockData(req: Request, res: Response): Promise<void> {
    try {
      const store = req.app.locals.store as ITraceStore;
      const body = req.body || {};
      const serviceCount = parseInt(body.serviceCount) || 5;
      const traceCount = parseInt(body.traceCount) || 50;
      const errorRate = parseFloat(body.errorRate) || 0.05;
      const maxDepth = parseInt(body.maxDepth) || 0;

      let result: { spans: Span[]; errors: ErrorLog[] };

      if (maxDepth > 10) {
        result = generateDeepChainTraces(maxDepth, traceCount, errorRate);
      } else {
        result = generateFlatTraces(serviceCount, traceCount, errorRate);
      }

      for (const span of result.spans) {
        await store.saveSpan(span);
      }
      for (const error of result.errors) {
        await store.saveErrorLog(error);
      }

      const response: ApiResponse<{ spanCount: number; errorCount: number; maxDepth: number }> = {
        success: true,
        data: {
          spanCount: result.spans.length,
          errorCount: result.errors.length,
          maxDepth: maxDepth || result.spans.reduce((max, s) => {
            const d = s.attributes?.['call.depth'];
            return typeof d === 'number' ? Math.max(max, d) : max;
          }, 0),
        },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate mock data',
      };
      res.status(500).json(response);
    }
  },

  async clearData(req: Request, res: Response): Promise<void> {
    try {
      const store = req.app.locals.store as ITraceStore;
      await store.clearAllData();
      const response: ApiResponse<{ cleared: boolean }> = {
        success: true,
        data: { cleared: true },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear data',
      };
      res.status(500).json(response);
    }
  },
};
