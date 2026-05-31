import type { Span, ErrorLog, SpanEvent, SpanStatusCode, SpanKind } from '../../shared/types.ts';

const NANOSECONDS_PER_MILLISECOND = 1e6;

/**
 * 将 UnixNano 时间戳转换为 ISO 字符串
 */
function unixNanoToIsoString(nano: number | string | undefined): string {
  if (!nano) return new Date().toISOString();
  const ms = Number(nano) / NANOSECONDS_PER_MILLISECOND;
  return new Date(ms).toISOString();
}

/**
 * 从 resource attributes 中提取 service.name
 */
function extractServiceName(resource: any): string {
  const attributes = resource?.attributes ?? [];
  const serviceAttr = attributes.find((attr: any) => attr.key === 'service.name');
  return serviceAttr?.value?.stringValue ?? 'unknown';
}

/**
 * 将 OTLP attributes 转换为普通对象
 */
function transformAttributes(attributes: any[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const attr of attributes ?? []) {
    const key = attr.key;
    const value = attr.value;
    if (value?.stringValue !== undefined) {
      result[key] = value.stringValue;
    } else if (value?.intValue !== undefined) {
      result[key] = Number(value.intValue);
    } else if (value?.boolValue !== undefined) {
      result[key] = value.boolValue;
    } else if (value?.doubleValue !== undefined) {
      result[key] = value.doubleValue;
    } else if (value?.arrayValue !== undefined) {
      result[key] = value.arrayValue.values ?? [];
    }
  }
  return result;
}

/**
 * 转换 OTLP events
 */
function transformEvents(events: any[]): SpanEvent[] {
  return (events ?? []).map((event) => ({
    time: unixNanoToIsoString(event.timeUnixNano),
    name: event.name ?? '',
    attributes: transformAttributes(event.attributes),
  }));
}

/**
 * 转换 SpanKind
 */
function transformSpanKind(kind: number | undefined): SpanKind {
  const kindMap: Record<number, SpanKind> = {
    0: 'internal',
    1: 'server',
    2: 'client',
    3: 'producer',
    4: 'consumer',
  };
  return kindMap[kind ?? 0] ?? 'internal';
}

/**
 * 转换 SpanStatusCode
 */
function transformStatusCode(code: number | undefined): SpanStatusCode {
  const codeMap: Record<number, SpanStatusCode> = {
    0: 'UNSET',
    1: 'OK',
    2: 'ERROR',
  };
  return codeMap[code ?? 0] ?? 'UNSET';
}

/**
 * 计算 Span 持续时间（毫秒）
 */
function calculateDuration(startNano: number | string, endNano: number | string): number {
  const start = Number(startNano);
  const end = Number(endNano);
  return Math.max(0, (end - start) / NANOSECONDS_PER_MILLISECOND);
}

/**
 * OTLP 数据转换服务
 *
 * 提供 OpenTelemetry OTLP v1/traces 格式数据的转换功能，
 * 将 OTLP 协议格式转换为系统内部的 Span 和 ErrorLog 格式。
 */
export const OTLPTransformerService = {
  /**
   * 将 OTLP v1/traces 格式的 payload 转换为 Span 数组
   *
   * 处理 resourceSpans -> scopeSpans -> spans 的三层嵌套结构，
   * 提取 service.name、转换时间戳、解析 attributes 和 events。
   *
   * @param payload - OTLP v1/traces 格式的请求体
   * @returns 转换后的 Span 数组
   *
   * @example
   * ```ts
   * const spans = OTLPTransformerService.transformOTLPToSpans(otlpPayload);
   * ```
   */
  transformOTLPToSpans(payload: any): Span[] {
    const spans: Span[] = [];
    const resourceSpans = payload?.resourceSpans ?? [];

    for (const resourceSpan of resourceSpans) {
      const serviceName = extractServiceName(resourceSpan.resource);
      const scopeSpans = resourceSpan.scopeSpans ?? [];

      for (const scopeSpan of scopeSpans) {
        const otlpSpans = scopeSpan.spans ?? [];

        for (const otlpSpan of otlpSpans) {
          const startTime = unixNanoToIsoString(otlpSpan.startTimeUnixNano);
          const endTime = unixNanoToIsoString(otlpSpan.endTimeUnixNano);
          const duration = calculateDuration(otlpSpan.startTimeUnixNano, otlpSpan.endTimeUnixNano);

          spans.push({
            id: otlpSpan.spanId ?? '',
            traceId: otlpSpan.traceId ?? '',
            parentSpanId: otlpSpan.parentSpanId || undefined,
            serviceName,
            name: otlpSpan.name ?? '',
            kind: transformSpanKind(otlpSpan.kind),
            startTime,
            endTime,
            duration,
            statusCode: transformStatusCode(otlpSpan.status?.code),
            statusMessage: otlpSpan.status?.message || undefined,
            attributes: transformAttributes(otlpSpan.attributes),
            events: transformEvents(otlpSpan.events),
          });
        }
      }
    }

    return spans;
  },

  /**
   * 从 Span 数组中提取错误日志
   *
   * 筛选出 statusCode 为 ERROR 的 Span，提取错误信息、堆栈跟踪等，
   * 转换为 ErrorLog 格式。
   *
   * @param spans - Span 数组
   * @returns 错误日志数组
   *
   * @example
   * ```ts
   * const errors = OTLPTransformerService.extractErrorsFromSpans(spans);
   * ```
   */
  extractErrorsFromSpans(spans: Span[]): ErrorLog[] {
    return spans
      .filter((span) => span.statusCode === 'ERROR')
      .map((span) => {
        const exceptionEvent = span.events?.find((e) => e.name === 'exception');
        const errorType = exceptionEvent?.attributes?.['exception.type'] ?? 'UnknownError';
        const message = exceptionEvent?.attributes?.['exception.message'] ?? span.statusMessage ?? span.name;
        const stackTrace = exceptionEvent?.attributes?.['exception.stacktrace'];

        return {
          id: `error-${span.id}-${Date.now()}`,
          traceId: span.traceId,
          spanId: span.id,
          serviceName: span.serviceName,
          errorType,
          message,
          stackTrace,
          timestamp: span.startTime,
          attributes: span.attributes,
        };
      });
  },
};
