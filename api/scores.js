// api/scores.js — Vercel Serverless Function (CommonJS)

const API_KEY  = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const LEAGUE   = 1;
const SEASON   = 2026;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

let cache = { data: null, ts: 0 };

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const json = await res.json();
  console.log(`[API] ${path} → status:${res.status} results:${json.results} errors:${JSON.stringify(json.errors)}`);
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API error: ${JSON.stringify(json.errors)}`);
  }
  return json;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Rota de debug: /api/scores?debug=1
  if (req.query && req.query.debug === '1') {
    try {
      const test = await apiFetch(`/fixtures?league=${LEAGUE}&season=${SEASON}&last=3`);
      return res.status(200).json({
        debug: true,
        apiKey: API_KEY ? `${API_KEY.substring(0,8)}...` : 'NAO CONFIGURADA',
        errors: test.errors,
        results: test.results,
        sample: test.response ? test.response[0] : null,
      });
    } catch(e) {
      return res.status(200).json({
        debug: true,
        error: e.message,
        apiKey: API_KEY ? `${API_KEY.substring(0,8)}...` : 'NAO CONFIGURADA',
      });
    }
  }

  // Cache válido
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const [fixturesData, standingsData, scorersData] = await Promise.all([
      apiFetch(`/fixtures?league=${LEAGUE}&season=${SEASON}`),
      apiFetch(`/standings?league=${LEAGUE}&season=${SEASON}`),
      apiFetch(`/players/topscorers?league=${LEAGUE}&season=${SEASON}`),
    ]);

    const payload = {
      fixtures:  fixturesData.response  || [],
      standings: standingsData.response || [],
      scorers:   scorersData.response   || [],
      meta: {
        fixtures:  fixturesData.results,
        standings: standingsData.results,
        scorers:   scorersData.results,
      },
      fetchedAt: new Date().toISOString(),
      cached: false,
    };

    cache = { data: payload, ts: Date.now() };
    return res.status(200).json(payload);

  } catch (err) {
    console.error('[copa-api] ERRO:', err.message);
    if (cache.data) {
      return res.status(200).json({ ...cache.data, cached: true, fallback: true });
    }
    return res.status(500).json({ error: err.message });
  }
};
