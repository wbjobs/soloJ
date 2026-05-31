import { Router, Request, Response } from 'express';
import { requestLogger } from '../requestLogger.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const logs = requestLogger.getLogs();
  res.json({
    success: true,
    logs,
    dangerKeywords: requestLogger.getDangerKeywords(),
  });
});

router.delete('/', (_req: Request, res: Response) => {
  requestLogger.clearLogs();
  res.json({ success: true, message: '日志已清空' });
});

export default router;
