/**
 * API 路由主文件
 * 定义所有 API 端点路由
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import {
  TopologyController,
  SpanController,
  ErrorController,
  OTLPController,
  MockController,
} from '../controllers/index.js';

const router = Router();

router.use(cors());

/**
 * 健康检查
 */
router.get('/health', (req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' });
});

/**
 * 拓扑相关路由
 */
router.get('/v1/topology', TopologyController.getTopology);
router.get('/v1/services', TopologyController.getServices);

/**
 * Span 相关路由
 */
router.get('/v1/services/:serviceId/spans', SpanController.getServiceSpans);
router.get('/v1/spans/:spanId', SpanController.getSpanById);
router.get('/v1/traces/:traceId', SpanController.getTraceById);

/**
 * 错误相关路由
 */
router.get('/v1/services/:serviceId/errors', ErrorController.getServiceErrors);
router.get('/v1/errors/:errorId', ErrorController.getErrorById);

/**
 * OTLP 数据接收路由
 */
router.post('/v1/otlp/v1/traces', OTLPController.receiveTraces);

/**
 * Mock 数据路由
 */
router.post('/v1/mock/generate', MockController.generateMockData);
router.post('/v1/mock/clear', MockController.clearData);

/**
 * 错误处理中间件
 */
router.use((error: Error, req: Request, res: Response, next: NextFunction): void => {
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  });
});

export default router;
