import { Router, Request, Response } from 'express';
import { documentManager } from '../../crdt';

const router = Router();

router.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    documentsInMemory: documentManager.getAllMetadata().length,
  });
});

export default router;
