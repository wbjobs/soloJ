import type { LogEntry, LogLevel } from '../../shared/types.js';
import { SERVICES, LOG_LEVELS } from '../../shared/types.js';

interface LogTemplate {
  level: LogLevel;
  messages: string[];
}

const serviceTemplates: Record<string, LogTemplate[]> = {
  'user-service': [
    {
      level: 'INFO',
      messages: [
        'User {id} logged in successfully',
        'User {id} profile updated',
        'New user registered: {email}',
        'User {id} password changed',
        'Authentication token refreshed for user {id}',
      ],
    },
    {
      level: 'DEBUG',
      messages: [
        'Processing request to /api/users/{id}',
        'Cache hit for user data: {id}',
        'SQL query executed in {time}ms',
        'Request validation passed for endpoint /api/users',
      ],
    },
    {
      level: 'WARN',
      messages: [
        'Rate limit approaching for user {id}',
        'Deprecated API called by user {id}',
        'Slow query detected: {time}ms',
        'Session about to expire for user {id}',
      ],
    },
    {
      level: 'ERROR',
      messages: [
        'Authentication failed for user {id}',
        'Database connection timeout',
        'Invalid token provided',
        'Permission denied for user {id} accessing {resource}',
      ],
    },
  ],
  'order-service': [
    {
      level: 'INFO',
      messages: [
        'Order {id} created successfully',
        'Order {id} status updated to {status}',
        'Payment processed for order {id}',
        'Order {id} shipped to {address}',
        'Inventory updated for product {sku}',
      ],
    },
    {
      level: 'DEBUG',
      messages: [
        'Calculating tax for order {id}',
        'Applying discount code {code}',
        'Validating stock for {sku}',
        'Generating invoice for order {id}',
      ],
    },
    {
      level: 'WARN',
      messages: [
        'Low stock alert for product {sku}',
        'Order {id} processing delayed',
        'Address validation warning for order {id}',
        'Courier API response slow',
      ],
    },
    {
      level: 'ERROR',
      messages: [
        'Payment failed for order {id}',
        'Insufficient stock for {sku}',
        'Order {id} cancellation failed',
        'Refund processing error for order {id}',
      ],
    },
  ],
  'payment-service': [
    {
      level: 'INFO',
      messages: [
        'Payment transaction {id} completed',
        'Refund {id} processed successfully',
        'Subscription {id} renewed',
        'Invoice {id} paid',
        'Payment method verified for user {id}',
      ],
    },
    {
      level: 'DEBUG',
      messages: [
        'Processing payment of ${amount}',
        'Validating card details',
        'Connecting to payment gateway',
        'Generating receipt for {id}',
      ],
    },
    {
      level: 'WARN',
      messages: [
        'Card expiry approaching for user {id}',
        'Currency conversion rate fluctuating',
        'Gateway response time high: {time}ms',
        'Retry attempt {attempt} for payment {id}',
      ],
    },
    {
      level: 'ERROR',
      messages: [
        'Payment declined: insufficient funds',
        'Gateway connection failed',
        'Invalid card number',
        'Fraud detection triggered for transaction {id}',
      ],
    },
  ],
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function formatMessage(template: string): string {
  return template
    .replace('{id}', generateId())
    .replace('{email}', `user${randomInt(100, 999)}@example.com`)
    .replace('{time}', String(randomInt(50, 500)))
    .replace('{status}', randomChoice(['pending', 'processing', 'shipped', 'delivered']))
    .replace('{sku}', `SKU-${randomInt(1000, 9999)}`)
    .replace('{address}', `${randomInt(10, 999)} Main St`)
    .replace('{code}', `DISCOUNT${randomInt(10, 99)}`)
    .replace('{resource}', randomChoice(['/api/admin', '/api/payments', '/api/users']))
    .replace('${amount}', `$${randomInt(10, 1000)}.${String(randomInt(0, 99)).padStart(2, '0')}`)
    .replace('{attempt}', String(randomInt(1, 3)));
}

function weightedRandomLevel(): LogLevel {
  const weights: { level: LogLevel; weight: number }[] = [
    { level: 'DEBUG', weight: 25 },
    { level: 'INFO', weight: 50 },
    { level: 'WARN', weight: 15 },
    { level: 'ERROR', weight: 10 },
  ];

  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * total;

  for (const w of weights) {
    random -= w.weight;
    if (random <= 0) return w.level;
  }
  return 'INFO';
}

export function generateLog(serviceName: string): LogEntry {
  const templates = serviceTemplates[serviceName] || serviceTemplates['user-service'];
  const level = weightedRandomLevel();
  const templateGroup = templates.find((t) => t.level === level) || templates[0];
  const message = formatMessage(randomChoice(templateGroup.messages));

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    serviceName,
    level,
    message,
  };
}

export function generateLogMessage(): LogEntry {
  const serviceName = randomChoice([...SERVICES]);
  return generateLog(serviceName);
}

export interface SimulatorCallbacks {
  onLog: (log: LogEntry) => void;
}

export function startLogSimulator(callbacks: SimulatorCallbacks): void {
  SERVICES.forEach((serviceName) => {
    const interval = randomInt(800, 2000);
    setInterval(() => {
      const log = generateLog(serviceName);
      callbacks.onLog(log);
    }, interval);
  });
}
