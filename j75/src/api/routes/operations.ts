import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../auth';
import { rollbackService, documentRepository } from '../../db';

const router = Router();

router.use(authMiddleware);

router.get('/:docId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const userId = req.user?.userId;

    const meta = await documentRepository.getMetadata(docId);
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    const limit = parseInt(req.query.limit as string || '50', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const fromTime = req.query.fromTime ? new Date(req.query.fromTime as string) : undefined;
    const toTime = req.query.toTime ? new Date(req.query.toTime as string) : undefined;

    const result = await rollbackService.getOperationHistory(docId, {
      limit: Math.min(limit, 100),
      offset,
      fromTime,
      toTime,
    });

    res.json(result);
  } catch (error) {
    console.error('Get operation history error:', error);
    res.status(500).json({ error: 'Failed to get operation history' });
  }
});

router.get('/:docId/:operationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId, operationId } = req.params;
    const userId = req.user?.userId;

    const meta = await documentRepository.getMetadata(docId);
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    const detail = await rollbackService.getOperationDetail(docId, operationId);
    if (!detail) {
      res.status(404).json({ error: 'Operation not found' });
      return;
    }

    res.json(detail);
  } catch (error) {
    console.error('Get operation detail error:', error);
    res.status(500).json({ error: 'Failed to get operation detail' });
  }
});

router.post('/:docId/rollback/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const { targetTime } = req.body;
    const userId = req.user?.userId;

    const meta = await documentRepository.getMetadata(docId);
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    if (!targetTime) {
      res.status(400).json({ error: 'targetTime is required' });
      return;
    }

    const preview = await rollbackService.previewRollback(docId, new Date(targetTime));
    if (!preview) {
      res.status(404).json({ error: 'No operations found for the target time' });
      return;
    }

    res.json(preview);
  } catch (error) {
    console.error('Preview rollback error:', error);
    res.status(500).json({ error: 'Failed to preview rollback' });
  }
});

router.post('/:docId/rollback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const { targetTime, targetSequence } = req.body;
    const userId = req.user?.userId;

    const meta = await documentRepository.getMetadata(docId);
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    let result;

    if (targetSequence !== undefined) {
      result = await rollbackService.rollbackToSequence(docId, targetSequence);
    } else if (targetTime) {
      result = await rollbackService.rollbackToTime(docId, new Date(targetTime));
    } else {
      res.status(400).json({ error: 'Either targetTime or targetSequence is required' });
      return;
    }

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Failed to execute rollback' });
  }
});

export default router;
