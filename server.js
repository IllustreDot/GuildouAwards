const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');

// Load .env file if present (simple loader, no external deps)
try {
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const envRaw = fs.readFileSync(envPath, 'utf8');
    envRaw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) return;
      const key = m[1];
      let val = m[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (typeof process.env[key] === 'undefined') process.env[key] = val;
    });
  }
} catch (err) {
  console.warn('Failed to load .env', err);
}

// In-memory admin token store: token -> expiry timestamp (ms)
const adminTokens = new Map();
function generateAdminToken() {
  return crypto.randomBytes(24).toString('hex');
}
function cleanupTokens() {
  const now = Date.now();
  for (const [t, exp] of adminTokens.entries()) if (exp <= now) adminTokens.delete(t);
}
setInterval(cleanupTokens, 60 * 1000);
function isValidAdminToken(token) {
  if (!token) return false;
  const exp = adminTokens.get(token);
  if (!exp) return false;
  if (exp <= Date.now()) { adminTokens.delete(token); return false; }
  return true;
}

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(QUESTIONS_FILE)) fs.writeFileSync(QUESTIONS_FILE, '[]');
  if (!fs.existsSync(RESPONSES_FILE)) fs.writeFileSync(RESPONSES_FILE, '[]');
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function sendJson(res, payload, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret, x-admin-token'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, text, statusCode = 200, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(text);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
  };
  return map[ext] || 'application/octet-stream';
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    sendText(res, 'Forbidden', 403);
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (pathname === '/') {
        sendText(res, 'index.html not found', 404);
      } else {
        sendText(res, 'Not found', 404);
      }
      return;
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        sendText(res, 'Read error', 500);
        return;
      }
      res.writeHead(200, {
        'Content-Type': getMimeType(filePath),
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
  });
}

function handleApi(req, res, urlObj) {
  const pathname = urlObj.pathname;

  // helper: check admin via secret or token header
  function isAdminRequest(r) {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) return false;
    const providedSecret = r.headers['x-admin-secret'];
    if (providedSecret && providedSecret === secret) return true;
    const providedToken = r.headers['x-admin-token'];
    if (providedToken && isValidAdminToken(providedToken)) return true;
    return false;
  }

  // Auth endpoint: POST { password }
  if (pathname === '/api/auth' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const pw = payload && payload.password ? String(payload.password) : '';
        const secret = process.env.ADMIN_SECRET;
        if (!secret) { sendJson(res, { error: 'Server admin secret not configured' }, 500); return; }
        if (pw !== secret) { sendJson(res, { error: 'Invalid password' }, 401); return; }
        const token = generateAdminToken();
        const ttl = 60 * 60 * 1000; // 1h
        adminTokens.set(token, Date.now() + ttl);
        sendJson(res, { token });
      } catch (err) {
        sendJson(res, { error: 'Invalid JSON body' }, 400);
      }
    });
    return;
  }

  if (pathname === '/api/questions') {
    if (req.method === 'OPTIONS') {
      sendJson(res, { ok: true }, 204);
      return;
    }

    if (req.method === 'GET') {
      const questions = readJson(QUESTIONS_FILE, []);
      sendJson(res, questions);
      return;
    }

    if (req.method === 'POST') {
      if (!isAdminRequest(req)) { sendJson(res, { error: 'Admin secret required' }, 401); return; }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const item = JSON.parse(body || '{}');
          if (!item || !item.id) {
            sendJson(res, { error: 'Question with id is required' }, 400);
            return;
          }
          const questions = readJson(QUESTIONS_FILE, []);
          const idx = questions.findIndex(q => q.id === item.id);
          if (idx >= 0) questions[idx] = item; else questions.unshift(item);
          writeJson(QUESTIONS_FILE, questions);
          sendJson(res, item);
        } catch (error) {
          sendJson(res, { error: 'Invalid JSON body' }, 400);
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      if (!isAdminRequest(req)) { sendJson(res, { error: 'Admin secret required' }, 401); return; }
      const id = urlObj.searchParams.get('id');
      if (!id) {
        sendJson(res, { error: 'id is required' }, 400);
        return;
      }
      const questions = readJson(QUESTIONS_FILE, []);
      const next = questions.filter(q => q.id !== id);
      writeJson(QUESTIONS_FILE, next);
      sendJson(res, { success: true });
      return;
    }
  }

  if (pathname === '/api/responses') {
    if (req.method === 'OPTIONS') {
      sendJson(res, { ok: true }, 204);
      return;
    }

    if (req.method === 'GET') {
      const responses = readJson(RESPONSES_FILE, []);
      sendJson(res, { responses });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload || !payload.id || !Array.isArray(payload.answers)) {
            sendJson(res, { error: 'payload must contain id and answers' }, 400);
            return;
          }
          const responses = readJson(RESPONSES_FILE, []);
          responses.unshift(payload);
          writeJson(RESPONSES_FILE, responses);
          sendJson(res, payload);
        } catch (error) {
          sendJson(res, { error: 'Invalid JSON body' }, 400);
        }
      });
      return;
    }
  }

  sendJson(res, { error: 'Not found' }, 404);
}

ensureDataFiles();

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (reqUrl.pathname.startsWith('/api/')) {
    handleApi(req, res, reqUrl);
    return;
  }
  serveStatic(req, res, reqUrl.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Guildou Awards server listening on http://${HOST}:${PORT}`);
});
