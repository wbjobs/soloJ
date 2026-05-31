import { GameEngine } from './game';

const PORT = parseInt(process.env.PORT || '8080', 10);
const DB_PATH = process.env.DB_PATH || './data/game.db';

const engine = new GameEngine(PORT, DB_PATH);

process.on('SIGINT', () => {
  console.log('\n[Main] Received SIGINT, shutting down...');
  engine.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Main] Received SIGTERM, shutting down...');
  engine.stop();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});

engine.start();

console.log('[Main] ====================================');
console.log('[Main] Roguelike Game Backend Server Running');
console.log('[Main] ====================================');
console.log(`[Main] Port: ${PORT}`);
console.log(`[Main] Database: ${DB_PATH}`);
console.log(`[Main] PID: ${process.pid}`);
console.log('[Main] ====================================');

setInterval(() => {
  console.log(`[Main] Status - Players: ${engine.getPlayerCount()}, Entities: ${engine.getEntityCount()}, Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
}, 30000);
