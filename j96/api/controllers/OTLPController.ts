import type { Request, Response } from 'express';
import type { Span, ErrorLog, ApiResponse } from '../../shared/types.ts';
import type { ITraceStore } from '../repositories/types.ts';
import { OTLPTransformerService } from '../services/index.ts';

export const OTLPController = {
  async receiveTraces(req: Request, res: Response): Promise<void> {
    try {
      const store = req.app.locals.store as ITraceStore;
      const payload = req.body;

      if (!payload || !payload.resourceSpans) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid OTLP format: missing resourceSpans',
        };
        res.status(400).json(response);
        return;
      }

      if (!Array.isArray(payload.resourceSpans)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid OTLP format: resourceSpans must be an array',
        };
        res.status(400).json(response);
        return;
      }

      const spans: Span[] = OTLPTransformerService.transformOTLPToSpans(payload);
      const errors: ErrorLog[] = OTLPTransformerService.extractErrorsFromSpans(spans);

      for (const span of spans) {
        await store.saveSpan(span);
      }

      for (const error of errors) {
        await store.saveErrorLog(error);
      }

      const response: ApiResponse<{ spanCount: number; errorCount: number }> = {
        success: true,
        data: {
          spanCount: spans.length,
          errorCount: errors.length,
        },
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process OTLP traces',
      };
      res.status(500).json(response);
    }
  },
};
