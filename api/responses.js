const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

function aggregateResponses(rows) {
  const summary = {byQuestion: {}, respondents: []};
  rows.forEach(row => {
    if (row.respondent) {
      if (!summary.respondents.includes(row.respondent)) {
        summary.respondents.push(row.respondent);
      }
    }
    if (!Array.isArray(row.answers)) return;
    row.answers.forEach(answer => {
      if (!answer || !answer.id) return;
      summary.byQuestion[answer.id] = summary.byQuestion[answer.id] || {counts: {}, total: 0};
      const key = answer.answer || '__empty__';
      summary.byQuestion[answer.id].counts[key] = (summary.byQuestion[answer.id].counts[key] || 0) + 1;
      summary.byQuestion[answer.id].total += 1;
    });
  });
  return summary;
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'GET') {
      const raw = req.query.raw === 'true' || req.url.includes('raw=true');
      const rows = await supabaseFetch('responses?select=id,respondent,answers,created_at&order=created_at.desc');
      if (raw) {
        return sendJson(res, {responses: rows});
      }
      const summary = aggregateResponses(Array.isArray(rows) ? rows : []);
      return sendJson(res, {summary, responses: Array.isArray(rows) ? rows : []});
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object' || !body.id || !Array.isArray(body.answers)) {
        return sendError(res, 'Response payload must contain id and answers array', 400);
      }
      const saved = await supabaseFetch('responses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return sendJson(res, saved);
    }

    res.setHeader('Allow', 'GET, POST');
    sendError(res, `Method ${req.method} not allowed`, 405);
  } catch (error) {
    sendError(res, error.message || 'Server error', 500);
  }
};
