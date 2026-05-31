import { createServer } from 'http';
import app from './app.js';
import { getDb, getLogStore } from './db/singleton.js';
import { LogWebSocketServer } from './services/websocket.js';
import { startLogSimulator } from './services/logSimulator.js';
import { ErrorAlertDetector } from './services/alertDetector.js';

const PORT = process.env.PORT || 3001;

const db = getDb();
const logStore = getLogStore();

const server = createServer(app);

const wsServer = new LogWebSocketServer(server, logStore);

const alertDetector = new ErrorAlertDetector({
  onAlert: (alert) => {
    wsServer.broadcastAlert(alert);
  },
});

startLogSimulator({
  onLog: (log) => {
    logStore.insert(log);
    wsServer.broadcastLog(log);
    alertDetector.processLog(log);
  },
});

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`Database: logs.db`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  wsServer.close();
  server.close(() => {
    db.close();
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  wsServer.close();
  server.close(() => {
    db.close();
    console.log('Server closed');
    process.exit(0);
  });
});

export { logStore };
export default app;
