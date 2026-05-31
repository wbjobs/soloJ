import { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../requestLogger.js';

export const requestLoggingMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/logs')) {
    return next();
  }

  try {
    process.nextTick(() => {
      const headers = { ...req.headers };
      delete headers.authorization;
      delete headers.cookie;

      const bodyContent = JSON.stringify(req.body || {});
      const queryContent = JSON.stringify(req.query || {});
      const fullPayload = `${bodyContent} ${queryContent} ${req.path}`;

      const analysis = requestLogger.analyzePayload(fullPayload);

      requestLogger.addLog({
        method: req.method,
        path: req.path,
        headers,
        body: req.body || {},
        query: req.query || {},
        matchedKeywords: analysis.matchedKeywords,
        dangerLevel: analysis.dangerLevel,
        dangerScore: analysis.dangerScore,
      });
    });
  } catch (error) {
    console.error('Error logging request:', error);
  }

  next();
};
