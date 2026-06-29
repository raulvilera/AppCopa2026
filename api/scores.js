// api/scores.js — Vercel Serverless Function (CommonJS)
// Fonte: openfootball/worldcup.json — gratuito, sem chave, atualizado diariamente

const RAW_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let cache = { data: null, ts: 0 };

// Mapa nome completo EN → código 3 letras FIFA
const NAME_TO_CODE = {
  'Mexico':'MEX','South Africa':'RSA','Czech Republic':'CZE','South Korea':'KOR',
  'Canada':'CAN','Switzerland':'SUI','Bosnia & Herzegovina':'BIH','Bosnia and Herzegovina':'BIH','Qatar':'QAT',
  'Brazil':'BRA','Haiti':'HTI','Scotland':'SCO','Morocco':'MAR',
  'USA':'USA','United States':'USA','Turkey':'TUR','Australia':'AUS','Paraguay':'PAR',
  'Germany':'GER','Ivory Coast':'CIV',"Côte d'Ivoire":'CIV','Ecuador':'ECU','Curaçao':'CUW','Curacao':'CUW',
  'Netherlands':'NED','Japan':'JPN','Sweden':'SWE','Tunisia':'TUN',
  'Belgium':'BEL','Iran':'IRN','New Zealand':'NZL','Egypt':'EGY',
  'Spain':'ESP','Uruguay':'URU','Cape Verde':'CPV','Saudi Arabia':'KSA',
  'France':'FRA','Senegal':'SEN','Norway':'NOR','Iraq':'IRQ',
  'Argentina':'ARG','Algeria':'DZA','Austria':'AUT','Jordan':'JOR',
  'Portugal':'POR','DR Congo':'COD','Colombia':'COL','Uzbekistan':'UZB',
  'England':'ENG','Ghana':'GHA','Panama':'PAN','Croatia':'CRO',
};
function code(name) { return NAME_TO_CODE[name] || name.substring(0,3).toUpperCase(); }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Debug: /api/scores?debug=1
  if (req.query && req.query.debug === '1') {
    try {
      const r   = await fetch(RAW_URL);
      const wc  = await r.json();
      const m   = wc.matches ? wc.matches[0] : null;
      return res.status(200).json({
        debug: true,
        totalMatches: wc.matches ? wc.matches.length : 0,
        firstMatch: m,
        source: RAW_URL,
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
    const r  = await fetch(RAW_URL);
    if (!r.ok) throw new Error('GitHub HTTP ' + r.status);
    const wc = await r.json();

    // Normalizar fixtures — formato openfootball usa "matches" flat
    const fixtures = (wc.matches || []).map(function(m) {
      var homeCode = code(m.team1);
      var awayCode = code(m.team2);
      var hasFT    = m.score && m.score.ft;
      // Extrair rodada numérica do campo "round" ex: "Matchday 1", "Matchday 8", "Matchday 14"
      var rMatch = (m.round || '').match(/(\d+)/);
      var rNum   = rMatch ? Math.ceil(parseInt(rMatch[1]) / 4) : 1; // Matchdays 1-4=R1, 5-8=R2, 9-12=R3
      return {
        r:         rNum,
        group:     m.group ? m.group.replace('Group ','') : '?',
        home:      homeCode,
        away:      awayCode,
        homeName:  m.team1,
        awayName:  m.team2,
        hs:        hasFT ? m.score.ft[0] : null,
        as:        hasFT ? m.score.ft[1] : null,
        status:    hasFT ? 'final' : 'scheduled',
        date:      m.date  || '',
        time:      m.time  || '',
        venue:     '',
        city:      m.ground || '',
        goals1:    m.goals1 || [],
        goals2:    m.goals2 || [],
      };
    });

    // Calcular standings
    const standings = calcStandings(fixtures);

    // Calcular artilheiros
    const scorers = calcScorers(fixtures);

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
    if (cache.data) return res.status(200).json({ ...cache.data, cached: true, fallback: true });
    return res.status(500).json({ error: err.message });
  }
};

function calcStandings(fixtures) {
  const groups = {};
  fixtures.forEach(function(f) {
    if (f.status !== 'final' || f.group === '?') return;
    var grp = f.group;
    if (!groups[grp]) groups[grp] = {};
    [
      {abbr:f.home, name:f.homeName, gf:f.hs, gc:f.as},
      {abbr:f.away, name:f.awayName, gf:f.as, gc:f.hs},
    ].forEach(function(t) {
      if (!groups[grp][t.abbr]) {
        groups[grp][t.abbr] = {team:t.name||t.abbr, abbr:t.abbr, w:0,d:0,l:0,pts:0,gf:0,gc:0,gp:0};
      }
      var s = groups[grp][t.abbr];
      s.gf += t.gf;   // gols pró
      s.gc += t.gc;   // gols contra
      s.gp  = s.gf;   // alias para compatibilidade com o front-end (usa .gp como gols pró)
      if      (t.gf > t.gc)  { s.w++; s.pts += 3; }
      else if (t.gf === t.gc) { s.d++; s.pts += 1; }
      else                    { s.l++; }
    });
  });
  var result = {};
  Object.keys(groups).sort().forEach(function(grp) {
    result[grp] = Object.values(groups[grp]).sort(function(a,b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      return (b.gf-b.gc) - (a.gf-a.gc) || b.gf - a.gf;
    });
  });
  return result;
}

function calcScorers(fixtures) {
  var map = {};
  fixtures.forEach(function(f) {
    if (f.status !== 'final') return;
    [[f.goals1, f.home, f.homeName],[f.goals2, f.away, f.awayName]].forEach(function(pair) {
      (pair[0]||[]).forEach(function(g) {
        if (!g.name || g.owngoal) return;
        var key = g.name + '|' + pair[1];
        if (!map[key]) map[key] = {name:g.name, abbr:pair[1], team:pair[2], goals:0};
        map[key].goals++;
      });
    });
  });
  return Object.values(map).sort(function(a,b){return b.goals-a.goals}).slice(0,15);
}
