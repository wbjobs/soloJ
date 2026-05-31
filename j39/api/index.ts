/**
 * Vercel deploy entry handler, for serverless deployment
 * Note: Socket.io WebSocket features require a persistent server
 * For full real-time collaboration, use the local server (api/server.ts)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from './app.js';
import { roomManager } from './roomManager.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET' && req.url === '/api/rooms') {
    const rooms = roomManager.getRooms();
    return res.status(200).json({
      success: true,
      data: rooms,
    });
  }
  return app(req, res);
}
