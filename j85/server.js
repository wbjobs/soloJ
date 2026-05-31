const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const UDP_PORT = 5140;
const HTTP_PORT = 3000;
const LOG_FILE = path.join(__dirname, 'logs', 'nginx_access.log');

const MAX_LINE_LENGTH = 8192;
const BATCH_INTERVAL_MS = 100;
const BATCH_MAX_SIZE = 500;
const BACKPRESSURE_THRESHOLD = 65536;
const MAX_CUSTOM_RULES = 20;
const MAX_REGEX_LENGTH = 512;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

const batchBuffer = [];

function enqueueLog(parsed) {
  batchBuffer.push(parsed);
  if (batchBuffer.length >= BATCH_MAX_SIZE) {
    flushBatch();
  }
}

function flushBatch() {
  if (batchBuffer.length === 0) return;
  const payload = JSON.stringify({ type: 'batch', data: batchBuffer });
  batchBuffer.length = 0;

  for (const ws of clients) {
    if (ws.readyState !== 1) continue;
    if (ws.bufferedAmount > BACKPRESSURE_THRESHOLD) {
      continue;
    }
    ws.send(payload);
  }
}

setInterval(flushBatch, BATCH_INTERVAL_MS);

function wsBroadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === 1 && ws.bufferedAmount <= BACKPRESSURE_THRESHOLD) {
      ws.send(payload);
    }
  }
}

const customRules = new Map();

function validateRegex(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > MAX_REGEX_LENGTH) {
    return { valid: false, error: '正则表达式长度需在 1~512 之间' };
  }
  let regex;
  try {
    regex = new RegExp(pattern, 'm');
  } catch (e) {
    return { valid: false, error: '正则语法错误: ' + e.message };
  }
  const source = regex.source;
  const evilQuantifiers = /(\+|\*|\{[^}]+\})\s*(\+|\*|\{[^}]+\})/;
  if (evilQuantifiers.test(source)) {
    return { valid: false, error: '禁止嵌套量词，可能导致灾难性回溯' };
  }
  const namedGroups = source.match(/\(\?<(\w+)>/g);
  if (!namedGroups || namedGroups.length === 0) {
    return { valid: false, error: '正则必须包含至少一个命名捕获组，如 (?<userid>\\w+)' };
  }
  return { valid: true, regex, namedGroups };
}

function addRule(name, pattern, source) {
  if (customRules.size >= MAX_CUSTOM_RULES) {
    return { ok: false, error: '自定义规则数量已达上限 (' + MAX_CUSTOM_RULES + ')' };
  }
  const v = validateRegex(pattern);
  if (!v.valid) return { ok: false, error: v.error };

  const id = crypto.randomBytes(8).toString('hex');
  const fields = v.namedGroups.map(g => g.match(/\(\?<(\w+)>/)[1]);

  const rule = { id, name, pattern, source, fields, regex: v.regex };
  customRules.set(id, rule);

  wsBroadcast({ type: 'rules_update', rules: getRulesList() });

  return { ok: true, id, fields };
}

function removeRule(id) {
  const removed = customRules.delete(id);
  if (removed) {
    wsBroadcast({ type: 'rules_update', rules: getRulesList() });
  }
  return removed;
}

function getRulesList() {
  const list = [];
  for (const [, rule] of customRules) {
    list.push({ id: rule.id, name: rule.name, pattern: rule.pattern, source: rule.source, fields: rule.fields });
  }
  return list;
}

function applyCustomRules(parsed, rawLine) {
  if (customRules.size === 0) return;
  const custom = {};
  let hasMatch = false;
  for (const [, rule] of customRules) {
    if (rule.source !== 'both' && rule.source !== parsed.source) continue;
    try {
      const m = rule.regex.exec(rawLine);
      if (m && m.groups) {
        for (const field of rule.fields) {
          if (m.groups[field] !== undefined) {
            custom[field] = m.groups[field];
            hasMatch = true;
          }
        }
      }
    } catch (_) {}
  }
  if (hasMatch) {
    parsed.custom = custom;
  }
}

app.get('/api/rules', (req, res) => {
  res.json({ rules: getRulesList() });
});

app.post('/api/rules', (req, res) => {
  const { name, pattern, source } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 64) {
    return res.status(400).json({ error: '规则名称长度需在 1~64 之间' });
  }
  if (!pattern) {
    return res.status(400).json({ error: '正则表达式不能为空' });
  }
  const src = source === 'nginx' || source === 'syslog' ? source : 'both';
  const result = addRule(name.trim(), pattern, src);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ id: result.id, fields: result.fields });
});

app.delete('/api/rules/:id', (req, res) => {
  const removed = removeRule(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: '规则不存在' });
  }
  res.json({ ok: true });
});

const NGINX_REGEX = /^(\S+)\s+-\s+-\s+\[([^\]]{1,64})\]\s+"([A-Z]{1,10})\s+(\S{1,2048})\s+(HTTP\/[\d.]{1,8})"\s+(\d{3})\s+(\d{1,10})\s+"([^"]{0,2048})"\s+"([^"]{0,2048})"/;

const SYSLOG_REGEX = /^<(\d{1,3})>(\w{3}\s+\d{1,2}\s+[\d:]{5,10})\s+(\S{1,64})\s+(\S{1,64}):\s+(.{0,4096})$/;

function safeParseInt(val, radix) {
  const n = parseInt(val, radix);
  return Number.isNaN(n) ? 0 : n;
}

function parseNginxLine(line) {
  if (line.length > MAX_LINE_LENGTH) return null;
  const m = NGINX_REGEX.exec(line);
  if (!m) return null;
  const [, ip, timestamp, method, uri, protocol, status, bytes, referer, userAgent] = m;
  return {
    source: 'nginx',
    ip,
    timestamp,
    method,
    uri,
    protocol,
    status: safeParseInt(status, 10),
    bytes: safeParseInt(bytes, 10),
    referer,
    userAgent,
  };
}

function parseSyslogLine(line) {
  if (line.length > MAX_LINE_LENGTH) return null;
  const m = SYSLOG_REGEX.exec(line);
  if (!m) return null;
  const [, pri, timestamp, host, app, message] = m;
  const priVal = safeParseInt(pri, 10);
  return {
    source: 'syslog',
    priority: priVal,
    facility: priVal >> 3,
    severity: priVal & 7,
    timestamp,
    host,
    app,
    message,
  };
}

function parseLine(line) {
  try {
    if (!line || typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > MAX_LINE_LENGTH) return null;

    let parsed;
    if (trimmed.startsWith('<')) {
      parsed = parseSyslogLine(trimmed);
    } else {
      parsed = parseNginxLine(trimmed);
    }

    if (parsed) {
      applyCustomRules(parsed, trimmed);
    }

    return parsed;
  } catch (err) {
    return null;
  }
}

const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg) => {
  try {
    const line = msg.toString('utf8');
    const parsed = parseLine(line);
    if (parsed) {
      enqueueLog(parsed);
    }
  } catch (_) {}
});

udpServer.on('listening', () => {
  const addr = udpServer.address();
  console.log(`[UDP] Syslog listener on ${addr.address}:${addr.port}`);
});

udpServer.on('error', (err) => {
  console.error('[UDP] Error:', err.message);
});

udpServer.bind(UDP_PORT);

function startFileWatcher() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
  }

  let lastPos = fs.statSync(LOG_FILE).size;

  console.log(`[File] Watching: ${LOG_FILE}`);

  const POLL_INTERVAL = 500;

  setInterval(() => {
    let currentSize;
    try {
      currentSize = fs.statSync(LOG_FILE).size;
    } catch {
      return;
    }

    if (currentSize < lastPos) {
      lastPos = 0;
    }

    if (currentSize > lastPos) {
      const stream = fs.createReadStream(LOG_FILE, {
        start: lastPos,
        end: currentSize - 1,
        encoding: 'utf8',
      });

      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk;
      });

      stream.on('end', () => {
        const lines = buffer.split('\n');
        for (const line of lines) {
          const parsed = parseLine(line);
          if (parsed) {
            enqueueLog(parsed);
          }
        }
        lastPos = currentSize;
      });

      stream.on('error', () => {
        lastPos = currentSize;
      });
    }
  }, POLL_INTERVAL);
}

server.listen(HTTP_PORT, () => {
  console.log(`[HTTP] Server running at http://localhost:${HTTP_PORT}`);
  startFileWatcher();
});
