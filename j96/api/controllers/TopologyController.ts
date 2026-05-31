import type { Request, Response } from 'express';
import { store } from '../store.js';
import type { ApiResponse, TopologyData, ServiceNode } from '../../shared/types.js';
import type { TopologyQueryOptions } from '../repositories/types.js';

export const TopologyController = {
  async getTopology(req: Request, res: Response<ApiResponse<TopologyData>>): Promise<void> {
    try {
      const { startTime, endTime, maxDepth, timeoutMs } = req.query;
      const options: TopologyQueryOptions = {};

      if (startTime && endTime) {
        options.timeRange = { startTime: String(startTime), endTime: String(endTime) };
      }
      if (maxDepth) {
        options.maxDepth = Math.min(Math.max(parseInt(String(maxDepth)) || 10, 1), 50);
      }
      if (timeoutMs) {
        options.timeoutMs = Math.min(Math.max(parseInt(String(timeoutMs)) || 5000, 1000), 30000);
      }

      const topology = await store.getServiceTopology(options);
      res.json({ success: true, data: topology });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get topology';
      const isTimeout = message.includes('timed out') || message.includes('timeout');
      res.status(isTimeout ? 504 : 500).json({
        success: false,
        error: isTimeout
          ? `拓扑查询超时，请尝试减小 maxDepth 参数（当前默认为 10）或缩短时间范围`
          : message,
      });
    }
  },

  async getServices(req: Request, res: Response<ApiResponse<ServiceNode[]>>): Promise<void> {
    try {
      const services = await store.getServiceList();
      res.json({ success: true, data: services });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get services',
      });
    }
  },
};
