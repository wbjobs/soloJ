import type { Request, Response } from 'express';
import { store } from '../store.js';
import type { ApiResponse, Span } from '../../shared/types.js';

/**
 * Span 控制器
 * 处理链路追踪 Span 相关的 API 请求
 */
export const SpanController = {
  /**
   * 获取服务的 Span 列表
   * GET /api/v1/services/:serviceId/spans
   */
  async getServiceSpans(req: Request, res: Response<ApiResponse<{ spans: Span[]; total: number }>>): Promise<void> {
    try {
      const { serviceId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const result = await store.getServiceSpans(serviceId, limit, offset);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get service spans',
      });
    }
  },

  /**
   * 根据 ID 获取 Span
   * GET /api/v1/spans/:spanId
   */
  async getSpanById(req: Request, res: Response<ApiResponse<Span | null>>): Promise<void> {
    try {
      const { spanId } = req.params;
      const span = await store.getSpanById(spanId);

      if (!span) {
        res.status(404).json({
          success: false,
          error: 'Span not found',
        });
        return;
      }

      res.json({ success: true, data: span });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get span',
      });
    }
  },

  /**
   * 根据 Trace ID 获取完整调用链
   * GET /api/v1/traces/:traceId
   */
  async getTraceById(req: Request, res: Response<ApiResponse<Span[]>>): Promise<void> {
    try {
      const { traceId } = req.params;
      const spans = await store.getTraceById(traceId);

      if (spans.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Trace not found',
        });
        return;
      }

      res.json({ success: true, data: spans });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get trace',
      });
    }
  },
};
