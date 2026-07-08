const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'guildou';

function sendJson(res, payload, status = 200) {
  res.status(status).json(payload);
}

function sendError(res, message, status = 500) {
  sendJson(res, {error: message}, status);
}

async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel env.');
  }
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...options.headers,
  };
  const response = await fetch(url, {...options, headers});
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request failed ${response.status}: ${body}`);
  }
  return response.json();
}

function requireAdmin(req) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== ADMIN_SECRET) {
    return false;
  }
  return true;
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'GET') {
      const questions = await supabaseFetch('questions?select=*');
      return sendJson(res, Array.isArray(questions) ? questions : []);
    }

    if (req.method === 'POST') {
      if (!requireAdmin(req)) {
        return sendError(res, 'Admin secret required', 401);
      }
      const item = req.body;
      if (!item || typeof item !== 'object' || !item.id) {
        return sendError(res, 'Question item with id is required', 400);
      }
      const saved = await supabaseFetch('questions?on_conflict=id', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      return sendJson(res, saved);
    }

    if (req.method === 'DELETE') {
      if (!requireAdmin(req)) {
        return sendError(res, 'Admin secret required', 401);
      }
      const id = req.query.id || req.url.split('?')[1]?.split('=')[1];
      if (!id) {
        return sendError(res, 'Question id is required', 400);
      }
      await supabaseFetch(`questions?id=eq.${encodeURIComponent(id)}`, {method: 'DELETE'});
      return sendJson(res, {success: true});
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    sendError(res, `Method ${req.method} not allowed`, 405);
  } catch (error) {
    sendError(res, error.message || 'Server error', 500);
  }
};
