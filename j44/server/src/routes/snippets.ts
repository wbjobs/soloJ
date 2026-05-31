import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import Snippet, { ISnippet } from '../models/Snippet';
import { memoryStore, getHistoryList, getHistoryVersion, getVersionDiff } from '../utils/yjs-server';

const router = Router();

function isMongoDBAvailable(): boolean {
  return (global as any).isMongoDBConnected === true;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, language, content } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const id = nanoid(10);
    const now = new Date();

    const snippetData = {
      id,
      title,
      language: language || 'javascript',
      content: content || '',
      createdAt: now,
      updatedAt: now
    };

    memoryStore.set(id, {
      content: snippetData.content,
      title: snippetData.title,
      language: snippetData.language,
      updatedAt: now
    });

    if (isMongoDBAvailable()) {
      const snippet: ISnippet = new Snippet(snippetData);
      await snippet.save();
      console.log(`Created snippet ${id} in MongoDB`);
    } else {
      console.log(`Created snippet ${id} in memory store`);
    }

    res.status(201).json(snippetData);
  } catch (err) {
    console.error('Error creating snippet:', err);
    res.status(500).json({ error: 'Failed to create snippet' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const docId = Array.isArray(id) ? id[0] : id;

    if (isMongoDBAvailable()) {
      const snippet = await Snippet.findOne({ id: docId });
      if (snippet) {
        return res.json(snippet);
      }
    }
    
    const memorySnippet = memoryStore.get(docId);
    if (memorySnippet) {
      return res.json({
        id: docId,
        title: memorySnippet.title,
        language: memorySnippet.language,
        content: memorySnippet.content,
        updatedAt: memorySnippet.updatedAt
      });
    }

    return res.status(404).json({ error: 'Snippet not found' });
  } catch (err) {
    console.error('Error fetching snippet:', err);
    res.status(500).json({ error: 'Failed to fetch snippet' });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    let snippets: any[] = [];

    if (isMongoDBAvailable()) {
      snippets = await Snippet.find()
        .sort({ updatedAt: -1 })
        .select('id title language createdAt updatedAt');
    }
    
    const memorySnippets = Array.from(memoryStore.entries()).map(([id, data]) => ({
      id,
      title: data.title,
      language: data.language,
      updatedAt: data.updatedAt
    }));
    
    const allSnippets = [...snippets, ...memorySnippets]
      .filter((snippet, index, self) => 
        index === self.findIndex(s => s.id === snippet.id)
      )
      .sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

    res.json(allSnippets);
  } catch (err) {
    console.error('Error fetching snippets:', err);
    res.status(500).json({ error: 'Failed to fetch snippets' });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const docId = Array.isArray(id) ? id[0] : id;

    const history = await getHistoryList(docId);
    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.get('/:id/history/:version', async (req: Request, res: Response) => {
  try {
    const { id, version } = req.params;
    const docId = Array.isArray(id) ? id[0] : id;
    const versionNum = parseInt(Array.isArray(version) ? version[0] : version, 10);

    if (isNaN(versionNum) || versionNum < 1) {
      return res.status(400).json({ error: 'Invalid version number' });
    }

    const historyVersion = await getHistoryVersion(docId, versionNum);
    if (!historyVersion) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(historyVersion);
  } catch (err) {
    console.error('Error fetching history version:', err);
    res.status(500).json({ error: 'Failed to fetch history version' });
  }
});

router.get('/:id/diff/:version', async (req: Request, res: Response) => {
  try {
    const { id, version } = req.params;
    const docId = Array.isArray(id) ? id[0] : id;
    const versionNum = parseInt(Array.isArray(version) ? version[0] : version, 10);

    if (isNaN(versionNum) || versionNum < 1) {
      return res.status(400).json({ error: 'Invalid version number' });
    }

    const diff = await getVersionDiff(docId, versionNum);
    if (!diff) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(diff);
  } catch (err) {
    console.error('Error fetching version diff:', err);
    res.status(500).json({ error: 'Failed to fetch version diff' });
  }
});

export default router;
