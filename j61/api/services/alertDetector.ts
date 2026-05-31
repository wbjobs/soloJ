import type { LogEntry, AlertMessage } from '../../shared/types.js';

const ALERT_WINDOW_MS = 10000;
const ALERT_THRESHOLD = 5;
const ALERT_COOLDOWN_MS = 30000;

interface AlertCallback {
  onAlert: (alert: AlertMessage) => void;
}

export class ErrorAlertDetector {
  private errorTimestamps: number[] = [];
  private lastAlertTime: number = 0;
  private callback: AlertCallback;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(callback: AlertCallback) {
    this.callback = callback;
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      this.errorTimestamps = this.errorTimestamps.filter(
        (ts) => now - ts <= ALERT_WINDOW_MS
      );
    }, 1000);
  }

  processLog(log: LogEntry): void {
    if (log.level !== 'ERROR') {
      return;
    }

    const now = Date.now();
    this.errorTimestamps.push(now);

    this.errorTimestamps = this.errorTimestamps.filter(
      (ts) => now - ts <= ALERT_WINDOW_MS
    );

    const errorCount = this.errorTimestamps.length;

    if (
      errorCount >= ALERT_THRESHOLD &&
      now - this.lastAlertTime >= ALERT_COOLDOWN_MS
    ) {
      this.triggerAlert(errorCount);
      this.lastAlertTime = now;
    }
  }

  private triggerAlert(errorCount: number): void {
    const alert: AlertMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'error_spike',
      title: '⚠️ High Error Rate Detected',
      message: `Detected ${errorCount} ERROR logs in the last ${ALERT_WINDOW_MS / 1000} seconds`,
      errorCount,
      windowSeconds: ALERT_WINDOW_MS / 1000,
    };

    console.log(`[ALERT] ${alert.title} - ${alert.message}`);
    this.callback.onAlert(alert);
  }

  getErrorCount(): number {
    const now = Date.now();
    return this.errorTimestamps.filter(
      (ts) => now - ts <= ALERT_WINDOW_MS
    ).length;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
