import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../../auth';
import { documentManager, DocumentMeta } from '../../crdt';
import { documentRepository, snapshotService } from '../../db';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const docs = await documentRepository.listDocuments(userId);
    res.json({ documents: docs });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Title is required and must be a string' });
      return;
    }

    const docId = uuidv4();
    const meta = documentManager.createDocument(docId, title, userId);

    const docState = documentManager.getDocumentSnapshot(docId);
    await documentRepository.saveSnapshot(docState);

    res.status(201).json({
      document: meta,
    });
  } catch (error) {
    console.error('Create document error:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create document' });
    }
  }
});

router.get('/:docId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const userId = req.user?.userId;

    let meta = documentManager.getMetadata(docId);
    if (!meta) {
      const loaded = await snapshotService.loadDocument(docId);
      if (!loaded) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      meta = documentManager.getMetadata(docId);
    }

    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    const content = documentManager.getDocumentContent(docId);

    res.json({
      document: meta,
      content,
      stateVector: documentManager.encodeStateVectorToBase64(docId),
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

router.put('/:docId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const { title } = req.body;
    const userId = req.user?.userId;

    let meta = documentManager.getMetadata(docId);
    if (!meta) {
      const loaded = await snapshotService.loadDocument(docId);
      if (!loaded) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      meta = documentManager.getMetadata(docId);
    }

    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    if (title && typeof title === 'string') {
      meta.title = title;
      meta.updatedAt = new Date();
    }

    res.json({
      document: meta,
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/:docId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const userId = req.user?.userId;

    const meta = documentManager.getMetadata(docId) || await documentRepository.getMetadata(docId);
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    const deletedFromMemory = documentManager.deleteDocument(docId);
    const deletedFromDb = await documentRepository.deleteSnapshot(docId);

    if (!deletedFromMemory && !deletedFromDb) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

router.post('/:docId/snapshot', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const userId = req.user?.userId;

    const meta = documentManager.getMetadata(docId);
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    await snapshotService.takeSnapshot(docId);

    const updatedMeta = documentManager.getMetadata(docId);
    res.json({
      message: 'Snapshot taken successfully',
      document: updatedMeta,
    });
  } catch (error) {
    console.error('Manual snapshot error:', error);
    res.status(500).json({ error: 'Failed to take snapshot' });
  }
});

router.get('/:docId/snapshot', async (req: Request, res: Response): Promise<void> => {
  try {
    const { docId } = req.params;
    const userId = req.user?.userId;

    const meta = documentManager.getMetadata(docId) || await documentRepository.getMetadata(docId);
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (meta.createdBy !== userId) {
      res.status(403).json({ error: 'Access forbidden' });
      return;
    }

    const snapshot = await documentRepository.getSnapshot(docId);
    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    res.json({
      document: snapshot.meta,
      snapshotBase64: Buffer.from(snapshot.update).toString('base64'),
    });
  } catch (error) {
    console.error('Get snapshot error:', error);
    res.status(500).json({ error: 'Failed to get snapshot' });
  }
});

export default router;
