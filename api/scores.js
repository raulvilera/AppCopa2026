// api/scores.js — Vercel Serverless Function (CommonJS)
// Usa openfootball/worldcup.json — 100% gratuito, sem chave, atualizado diariamente

const BASE_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let cache = { data: null, ts: 0 };

async function ghFetch(file) {
  const res = await fetch(`${BASE_URL}/${file}`);
  if (!res.ok) throw new Error(`GitHub fetch error ${res.status}: ${file}`);
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Debug
  if (req.query && req.query.debug === '1') {
    try {
      const test = await ghFetch('worldcup.json');
      return res.status(200).json({
        debug: true,
        rounds: test.rounds ? test.rounds.length : 0,
        firstMatch: test.rounds && test.rounds[0] && test.rounds[0].matches ? test.rounds[0].matches[0] : null,
        source: BASE_URL + '/worldcup.json',
      });
    } catch(e) {
      return res.status(200).json({ debug: true, error: e.message });
    }
  }

  // Cache válido
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    // openfootball tem worldcup.json com rounds + matches
    const wc = await ghFetch('worldcup.json');

    // Normalizar fixtures
    const fixtures = [];
    (wc.rounds || []).forEach(function(round) {
      (round.matches || []).forEach(function(m) {
        fixtures.push({
          round:    round.name || '',
          date:     m.date || '',
          time:     m.time || '',
          home:     m.team1 ? (m.team1.code || m.team1.name) : '?',
          away:     m.team2 ? (m.team2.code || m.team2.name) : '?',
          homeName: m.team1 ? m.team1.name : '?',
          awayName: m.team2 ? m.team2.name : '?',
          homeScore: m.score && m.score.ft ? m.score.ft[0] : null,
          awayScore: m.score && m.score.ft ? m.score.ft[1] : null,
          group:    m.group || round.name || '',
          venue:    m.stadium ? (m.stadium.name || '') : '',
          city:     m.city || '',
          status:   (m.score && m.score.ft) ? 'final' : 'scheduled',
        });
      });
    });

    // Calcular standings a partir dos resultados
    const standings = calcStandings(fixtures);

    // Calcular artilheiros a partir dos scorers
    const scorers = calcScorers(wc);

    const payload = {
      fixtures,
      standings,
      scorers,
      fetchedAt: new Date().toISOString(),
      cached: false,
      source: 'openfootball',
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

// Calcula standings dos grupos a partir dos fixtures
function calcStandings(fixtures) {
  const groups = {};

  fixtures.forEach(function(f) {
    if (f.status !== 'final') return;
    var grp = extractGroup(f.group || f.round);
    if (!grp) return;

    if (!groups[grp]) groups[grp] = {};

    [
      {code: f.home, name: f.homeName, gf: f.homeScore, gc: f.awayScore},
      {code: f.away, name: f.awayName, gf: f.awayScore, gc: f.homeScore},
    ].forEach(function(t) {
      if (!groups[grp][t.code]) {
        groups[grp][t.code] = {team: t.name || t.code, abbr: t.code, w:0, d:0, l:0, pts:0, gp:0, gc:0};
      }
      var s = groups[grp][t.code];
      s.gp += t.gf;
      s.gc += t.gc;
      if (t.gf > t.gc)      { s.w++; s.pts += 3; }
      else if (t.gf === t.gc){ s.d++; s.pts += 1; }
      else                   { s.l++; }
    });
  });

  // Converter para formato esperado pelo index.html e ordenar
  var result = {};
  Object.keys(groups).sort().forEach(function(grp) {
    var teams = Object.values(groups[grp]);
    teams.sort(function(a,b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      var sgA = a.gp - a.gc, sgB = b.gp - b.gc;
      if (sgB !== sgA) return sgB - sgA;
      return b.gp - a.gp;
    });
    result[grp] = teams;
  });
  return result;
}

function extractGroup(str) {
  if (!str) return null;
  // "Group A", "Grupo A", "Group Stage - 1" etc
  var m = str.match(/Group\s+([A-L])/i) || str.match(/Grupo\s+([A-L])/i) || str.match(/\b([A-L])\b/);
  return m ? m[1].toUpperCase() : null;
}

function calcScorers(wc) {
  var map = {};
  (wc.rounds || []).forEach(function(round) {
    (round.matches || []).forEach(function(m) {
      (m.goals || []).forEach(function(g) {
        if (!g.name) return;
        var teamCode = g.team ? (g.team.code || g.team.name || '?') : '?';
        var key = g.name + '|' + teamCode;
        if (!map[key]) map[key] = {name: g.name, abbr: teamCode, team: teamCode, goals: 0, assists: 0};
        if (!g.score) map[key].goals++; // gol normal (own goals têm score: 'og')
      });
    });
  });
  return Object.values(map)
    .sort(function(a,b){ return b.goals - a.goals; })
    .slice(0, 15);
}
