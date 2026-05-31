const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

const UDP_PORT = 5140;
const UDP_HOST = '127.0.0.1';
const LOG_FILE = path.join(__dirname, 'logs', 'nginx_access.log');

const IPS = ['192.168.1.10', '10.0.0.5', '172.16.0.100', '203.0.113.42', '198.51.100.7'];
const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];
const URIS = ['/api/users', '/api/orders', '/api/products', '/health', '/login', '/api/search', '/static/app.js', '/favicon.ico'];
const STATUSES = [200, 200, 200, 200, 200, 301, 302, 400, 401, 403, 404, 404, 500, 502, 503];
const AGENTS = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'curl/7.84.0', 'python-requests/2.28.0'];

const SYSLOG_HOSTS = ['web-server-01', 'db-primary', 'cache-redis-01', 'lb-nginx-02'];
const SYSLOG_APPS = ['sshd', 'nginx', 'mysqld', 'redis-server', 'kernel'];
const SYSLOG_MESSAGES = [
  'Connection accepted from 10.0.0.5',
  'Failed login attempt from 203.0.113.42',
  'Query took 2.3s - slow query warning',
  'Memory usage at 85% - threshold approaching',
  'Upstream timed out (110: Connection timed out)',
  'SSL certificate will expire in 7 days',
  'Disk usage at 92% on /var/log',
  'Rate limit exceeded for client 198.51.100.7',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatNginxTimestamp() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${dd}/${months[now.getMonth()]}/${now.getFullYear()}:${hh}:${mm}:${ss} +0000`;
}

function generateNginxLine() {
  const ip = pick(IPS);
  const ts = formatNginxTimestamp();
  const method = pick(METHODS);
  const uri = pick(URIS);
  const status = pick(STATUSES);
  const bytes = Math.floor(Math.random() * 10000) + 100;
  const agent = pick(AGENTS);
  return `${ip} - - [${ts}] "${method} ${uri} HTTP/1.1" ${status} ${bytes} "https://example.com${uri}" "${agent}"`;
}

function formatSyslogTimestamp() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${months[now.getMonth()]} ${dd} ${hh}:${mm}:${ss}`;
}

function generateSyslogLine() {
  const facility = Math.floor(Math.random() * 8);
  const severity = Math.floor(Math.random() * 7);
  const pri = facility * 8 + severity;
  const ts = formatSyslogTimestamp();
  const host = pick(SYSLOG_HOSTS);
  const app = pick(SYSLOG_APPS);
  const msg = pick(SYSLOG_MESSAGES);
  return `<${pri}>${ts} ${host} ${app}: ${msg}`;
}

const client = dgram.createSocket('udp4');

function ensureLogFile() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
  }
}

ensureLogFile();

console.log('Log simulator started. Press Ctrl+C to stop.');
console.log('  - Writing Nginx logs to: ' + LOG_FILE);
console.log('  - Sending Syslog via UDP to: ' + UDP_HOST + ':' + UDP_PORT);

function tick() {
  const roll = Math.random();

  if (roll < 0.7) {
    const line = generateNginxLine();
    fs.appendFileSync(LOG_FILE, line + '\n');
  } else {
    const line = generateSyslogLine();
    const msg = Buffer.from(line);
    client.send(msg, 0, msg.length, UDP_PORT, UDP_HOST);
  }

  const delay = Math.floor(Math.random() * 400) + 100;
  setTimeout(tick, delay);
}

tick();
