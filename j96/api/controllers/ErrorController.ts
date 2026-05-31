import type { Request, Response } from 'express';
import { store } from '../store.js';
import type { ApiResponse, ErrorLog } from '../../shared/types.js';

/**
 * 错误控制器
 * 处理错误日志相关的 API 请求
 */
export const ErrorController = {
  /**
   * 获取服务的错误日志
   * GET /api/v1/services/:serviceId/errors
   */
  async getServiceErrors(req: Request, res: Response<ApiResponse<{ errors: ErrorLog[]; total: number }>>): Promise<void> {
    try {
      const { serviceId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const result = await store.getServiceErrors(serviceId, limit, offset);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get service errors',
      });
    }
  },

  /**
   * 根据 ID 获取错误日志
   * GET /api/v1/errors/:errorId
   */
  async getErrorById(req: Request, res: Response<ApiResponse<ErrorLog | null>>): Promise<void> {
    try {
      const { errorId } = req.params;
      const error = await store.getErrorById(errorId);

      if (!error) {
        res.status(404).json({
          success: false,
          error: 'Error log not found',
        });
        return;
      }

      res.json({ success: true, data: error });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get error log',
      });
    }
  },
};
