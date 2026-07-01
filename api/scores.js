// api/scores.js — Vercel Serverless Function
// Busca dados ao vivo da Copa do Mundo 2026 via football-data.org v4

const API_KEY = '6fdc2bc97fe042e787cb01979b7beeed';
const BASE    = 'https://api.football-data.org/v4';
const COMP_ID = 2000; // FIFA World Cup (código WC)

// Mapeamento abreviações football-data → suas abreviações
const ABBR_MAP = {
  'MEX':'MEX','RSA':'RSA','KOR':'KOR','CZE':'CZE',
  'SUI':'SUI','CAN':'CAN','BIH':'BIH','QAT':'QAT',
  'BRA':'BRA','MAR':'MAR','SCO':'SCO','HTI':'HTI',
  'USA':'USA','AUS':'AUS','PAR':'PAR','TUR':'TUR',
  'GER':'GER','CIV':'CIV','ECU':'ECU','CUW':'CUW',
  'NED':'NED','JPN':'JPN','SWE':'SWE','TUN':'TUN',
  'BEL':'BEL','EGY':'EGY','IRN':'IRN','NZL':'NZL',
  'ESP':'ESP','CPV':'CPV','URU':'URU','KSA':'KSA',
  'FRA':'FRA','NOR':'NOR','SEN':'SEN','IRQ':'IRQ',
  'ARG':'ARG','AUT':'AUT','DZA':'DZA','JOR':'JOR',
  'COL':'COL','POR':'POR','COD':'COD','UZB':'UZB',
  'ENG':'ENG','CRO':'CRO','GHA':'GHA','PAN':'PAN',
};

const TEAM_PT = {
  'Mexico':'México','South Africa':'África do Sul','Korea Republic':'Coreia do Sul',
  'Czechia':'Tchéquia','Switzerland':'Suíça','Canada':'Canadá','Bosnia and Herzegovina':'Bósnia',
  'Qatar':'Catar','Brazil':'Brasil','Morocco':'Marrocos','Scotland':'Escócia','Haiti':'Haiti',
  'USA':'Estados Unidos','Australia':'Austrália','Paraguay':'Paraguai','Türkiye':'Turquia',
  'Germany':'Alemanha','Côte d\'Ivoire':'C. Marfim','Ecuador':'Equador','Curaçao':'Curaçao',
  'Netherlands':'Holanda','Japan':'Japão','Sweden':'Suécia','Tunisia':'Tunísia',
  'Belgium':'Bélgica','Egypt':'Egito','Iran':'Irã','New Zealand':'Nova Zelândia',
  'Spain':'Espanha','Cape Verde':'Cabo Verde','Uruguay':'Uruguai','Saudi Arabia':'Ar. Saudita',
  'France':'França','Norway':'Noruega','Senegal':'Senegal','Iraq':'Iraque',
  'Argentina':'Argentina','Austria':'Áustria','Algeria':'Argélia','Jordan':'Jordânia',
  'Colombia':'Colômbia','Portugal':'Portugal','Congo DR':'Congo (RD)','Uzbekistan':'Uzbequistão',
  'England':'Inglaterra','Croatia':'Croácia','Ghana':'Gana','Panama':'Panamá',
};

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY }
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// Cache em memória (persiste entre invocações "quentes" da função na Vercel).
// Os gols de uma partida ENCERRADA nunca mudam, então uma vez buscados
// não precisamos gastar cota da API de novo pro mesmo jogo.
const goalsCache = new Map();

// A lista de partidas (bulk) não traz os goleadores — isso só vem
// ao buscar uma partida específica pelo id. Por isso, para jogos do
// mata-mata já finalizados/ao vivo, buscamos o detalhe individual.
async function fetchMatchGoals(matchId, isFinished) {
  if (goalsCache.has(matchId)) return goalsCache.get(matchId);
  try {
    const data = await fetchJson(`/matches/${matchId}`);
    const goals = (data.goals || []).map(g => ({
      minute: g.minute,
      team: ptAbbr(g.team?.tla || ''),
      player: g.scorer?.name || '',
      type: g.type || 'REGULAR',
    }));
    // Só guarda em cache permanente se o jogo já encerrou (dado definitivo).
    if (isFinished && goals.length) goalsCache.set(matchId, goals);
    return goals;
  } catch (e) {
    return [];
  }
}

function ptName(name) { return TEAM_PT[name] || name; }
function ptAbbr(tla)  { return ABBR_MAP[tla] || tla; }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Busca standings, matches e scorers em paralelo, mas sem deixar
  // uma falha isolada (ex: rate limit 429 do plano free) derrubar a
  // resposta inteira — cada uma cai pra vazio se falhar, e seguimos
  // com o que der certo. Isso é essencial pro placar ao vivo continuar
  // atualizando mesmo se, por exemplo, só o /scorers falhar.
  const [standResult, matchResult, scorerResult] = await Promise.allSettled([
    fetchJson(`/competitions/${COMP_ID}/standings`),
    fetchJson(`/competitions/${COMP_ID}/matches`),
    fetchJson(`/competitions/${COMP_ID}/scorers?limit=20`),
  ]);

  const errors = [];
  const standData  = standResult.status  === 'fulfilled' ? standResult.value  : (errors.push('standings: '+standResult.reason?.message), {});
  const matchData  = matchResult.status  === 'fulfilled' ? matchResult.value  : (errors.push('matches: '+matchResult.reason?.message), {});
  const scorerData = scorerResult.status === 'fulfilled' ? scorerResult.value : (errors.push('scorers: '+scorerResult.reason?.message), {});

  try {
    // --- STANDINGS ---
    const standings = {};
    for (const grpObj of (standData.standings || [])) {
      const grpName = grpObj.group; // ex: "GROUP_A"
      if (!grpName) continue;
      const letter = grpName.replace('GROUP_',''); // "A"
      standings[letter] = grpObj.table.map(row => ({
        team: ptName(row.team.name),
        abbr: ptAbbr(row.team.tla),
        w:   row.won,
        d:   row.draw,
        l:   row.lost,
        pts: row.points,
        gp:  row.goalsFor,
        gc:  row.goalsAgainst,
      }));
    }

    // --- MATCHES (fixtures + results) ---
    const fixtures = (matchData.matches || []).map(m => {
      const stage = m.stage || '';
      const hs = m.score?.fullTime?.home ?? null;
      const as = m.score?.fullTime?.away ?? null;
      const status = m.status; // SCHEDULED, IN_PLAY, PAUSED, FINISHED, etc.
      // Goleadores do jogo
      const goals = (m.goals || []).map(g => ({
        minute: g.minute,
        team: ptAbbr(g.team?.tla || ''),
        player: g.scorer?.name || '',
        type: g.type || 'REGULAR',
      }));
      return {
        id:      m.id,
        stage,
        matchday: m.matchday,
        utcDate: m.utcDate,
        status,
        home:    ptName(m.homeTeam?.name || ''),
        homeAbbr:ptAbbr(m.homeTeam?.tla || ''),
        away:    ptName(m.awayTeam?.name || ''),
        awayAbbr:ptAbbr(m.awayTeam?.tla || ''),
        hs, as, goals,
      };
    });

    // --- GOLEADORES DO MATA-MATA (busca individual, pois a lista bulk não traz) ---
    const knockoutStages = ['LAST_32','LAST_16','QUARTER_FINALS','SEMI_FINALS','THIRD_PLACE','FINAL'];
    const MAX_DETAIL_FETCHES = 5; // margem extra de segurança dentro do limite de 10 req/min do plano free
    const needGoals = fixtures.filter(f =>
      knockoutStages.includes(f.stage) &&
      (f.status === 'FINISHED' || f.status === 'IN_PLAY' || f.status === 'PAUSED') &&
      (!f.goals || f.goals.length === 0) &&
      (f.hs > 0 || f.as > 0) // só vale a pena buscar se houve gol
    ).slice(0, MAX_DETAIL_FETCHES);

    for (const f of needGoals) {
      const detailGoals = await fetchMatchGoals(f.id, f.status === 'FINISHED');
      if (detailGoals.length) f.goals = detailGoals;
    }

    // --- SCORERS ---
    const scorers = (scorerData.scorers || []).map(s => ({
      name:  s.player?.name || '',
      abbr:  ptAbbr(s.team?.tla || ''),
      team:  ptName(s.team?.name || ''),
      goals: s.goals || 0,
    }));

    res.status(200).json({
      fetchedAt: new Date().toISOString(),
      standings,
      fixtures,
      scorers,
      partialErrors: errors.length ? errors : undefined,
    });

  } catch (err) {
    res.status(500).json({ error: err.message, partialErrors: errors });
  }
}
