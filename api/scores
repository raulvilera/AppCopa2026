// api/scores.js — Vercel Serverless Function
// Proxy seguro: a chave fica na variável de ambiente API_FOOTBALL_KEY
// Cache em memória de 3 min para preservar as 100 req/dia do plano Free

const API_KEY  = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const LEAGUE   = 1;    // FIFA World Cup
const SEASON   = 2026;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

let cache = { data: null, ts: 0 };

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-apisports-key': API_KEY,
    },
  });
  if (!res.ok) throw new Error(`API-Football erro ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  // Serve cache se ainda válido
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    // Busca paralela: fixtures + standings
    const [fixturesData, standingsData, scorersData] = await Promise.all([
      apiFetch(`/fixtures?league=${LEAGUE}&season=${SEASON}`),
      apiFetch(`/standings?league=${LEAGUE}&season=${SEASON}`),
      apiFetch(`/players/topscorers?league=${LEAGUE}&season=${SEASON}`),
    ]);

    const payload = {
      fixtures:  fixturesData.response  || [],
      standings: standingsData.response || [],
      scorers:   scorersData.response   || [],
      fetchedAt: new Date().toISOString(),
      cached: false,
    };

    cache = { data: payload, ts: Date.now() };
    return res.status(200).json(payload);

  } catch (err) {
    console.error('[copa-api]', err.message);
    // Fallback: devolve cache expirado se disponível
    if (cache.data) {
      return res.status(200).json({ ...cache.data, cached: true, fallback: true });
    }
    return res.status(500).json({ error: err.message });
  }
}
