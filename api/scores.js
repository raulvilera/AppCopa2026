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

// Nome em inglês → nossa abreviação (mesmo pareamento do TEAM_PT/ABBR_MAP,
// usado para resolver o time de quem fez o gol vindo da ESPN).
const TEAM_ABBR_BY_NAME = {
  'Mexico':'MEX','South Africa':'RSA','Korea Republic':'KOR','Czechia':'CZE',
  'Switzerland':'SUI','Canada':'CAN','Bosnia and Herzegovina':'BIH','Qatar':'QAT',
  'Brazil':'BRA','Morocco':'MAR','Scotland':'SCO','Haiti':'HTI',
  'USA':'USA','Australia':'AUS','Paraguay':'PAR','Türkiye':'TUR',
  'Germany':'GER','Côte d\'Ivoire':'CIV','Ecuador':'ECU','Curaçao':'CUW',
  'Netherlands':'NED','Japan':'JPN','Sweden':'SWE','Tunisia':'TUN',
  'Belgium':'BEL','Egypt':'EGY','Iran':'IRN','New Zealand':'NZL',
  'Spain':'ESP','Cape Verde':'CPV','Uruguay':'URU','Saudi Arabia':'KSA',
  'France':'FRA','Norway':'NOR','Senegal':'SEN','Iraq':'IRQ',
  'Argentina':'ARG','Austria':'AUT','Algeria':'DZA','Jordan':'JOR',
  'Colombia':'COL','Portugal':'POR','Congo DR':'COD','Uzbekistan':'UZB',
  'England':'ENG','Croatia':'CRO','Ghana':'GHA','Panama':'PAN',
};

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY }
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// --- ESPN (gratuita, sem chave, com placar/status realmente ao vivo) ---
// A football-data.org no plano free entrega placar/gols atrasados (é
// recurso pago). A ESPN expõe publicamente um "scoreboard" não-oficial
// que atualiza em tempo real e de graça — usamos ela só para
// sobrepor status/placar/gols em cima da estrutura que já vem da
// football-data.org (que continua sendo a fonte de classificação e
// artilharia, e que já está funcionando).
const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200';

// A ESPN às vezes nomeia times de forma diferente da football-data.org.
// Mapeia esses apelidos pro nome em inglês que já usamos em TEAM_PT.
const ESPN_NAME_ALIASES = {
  'South Korea': 'Korea Republic',
  'United States': 'USA',
  'Czech Republic': 'Czechia',
  'Turkey': 'Türkiye',
  'Ivory Coast': 'Côte d\'Ivoire',
  'DR Congo': 'Congo DR',
  'IR Iran': 'Iran',
  'Cabo Verde': 'Cape Verde',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
};

function normName(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

let espnCache = { at: 0, events: [] };

async function fetchEspnEvents() {
  // Cache de 20s em memória — evita rebater a ESPN a cada chamada
  // enquanto a função Vercel está "quente".
  if (Date.now() - espnCache.at < 20000 && espnCache.events.length) return espnCache.events;
  try {
    const res = await fetch(ESPN_URL);
    if (!res.ok) return espnCache.events;
    const data = await res.json();
    const events = data.events || [];
    espnCache = { at: Date.now(), events };
    return events;
  } catch (e) {
    return espnCache.events;
  }
}

function findEspnMatch(events, homeNameEn, awayNameEn, utcDate) {
  const h = normName(ESPN_NAME_ALIASES[homeNameEn] ? homeNameEn : homeNameEn);
  const a = normName(awayNameEn);
  const targetDay = (utcDate || '').slice(0, 10);
  for (const ev of events) {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp) continue;
    const evDay = (ev.date || '').slice(0, 10);
    // aceita o mesmo dia ou o dia seguinte (jogos que cruzam meia-noite UTC)
    if (targetDay && evDay && evDay !== targetDay) {
      const d1 = new Date(targetDay), d2 = new Date(evDay);
      if (Math.abs(d1 - d2) > 86400000) continue;
    }
    const names = (comp.competitors || []).map(c => normName(ESPN_NAME_ALIASES[c.team?.displayName] || c.team?.displayName));
    if (names.includes(h) && names.includes(a)) return ev;
  }
  return null;
}

function espnStatusToOurs(type) {
  if (!type) return null;
  if (type.completed) return 'FINISHED';
  if (type.state === 'in') return 'IN_PLAY';
  if (type.state === 'pre') return 'SCHEDULED';
  return null;
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
  const espnEvents = await fetchEspnEvents();

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
      let hs = m.score?.fullTime?.home ?? null;
      let as = m.score?.fullTime?.away ?? null;
      let status = m.status; // SCHEDULED, IN_PLAY, PAUSED, FINISHED, etc.
      // Goleadores do jogo (dado pago no plano free — normalmente vazio;
      // a sobreposição da ESPN abaixo é quem realmente preenche isso)
      let goals = (m.goals || []).map(g => ({
        minute: g.minute,
        team: ptAbbr(g.team?.tla || ''),
        player: g.scorer?.name || '',
        type: g.type || 'REGULAR',
      }));

      // --- Sobreposição ESPN: placar/status/gols realmente ao vivo ---
      const homeNameEn = m.homeTeam?.name || '';
      const awayNameEn = m.awayTeam?.name || '';
      const espnEv = findEspnMatch(espnEvents, homeNameEn, awayNameEn, m.utcDate);
      let espnId = null;
      if (espnEv) {
        espnId = espnEv.id;
        const comp = espnEv.competitions[0];
        const espnStatus = espnStatusToOurs(comp.status?.type);
        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');
        // Alinha home/away entre as duas fontes (podem vir invertidos)
        const homeIsOurHome = normName(ESPN_NAME_ALIASES[home?.team?.displayName] || home?.team?.displayName) === normName(homeNameEn);
        const espnHs = homeIsOurHome ? home?.score : away?.score;
        const espnAs = homeIsOurHome ? away?.score : home?.score;

        if (espnStatus) status = espnStatus;
        if (espnHs != null && espnHs !== '') hs = parseInt(espnHs, 10);
        if (espnAs != null && espnAs !== '') as = parseInt(espnAs, 10);

        if ((status === 'IN_PLAY' || status === 'FINISHED') && Array.isArray(comp.details) && comp.details.length) {
          const espnGoals = comp.details
            .filter(d => d.scoringPlay || /goal/i.test(d.type?.text || ''))
            .map(d => {
              const scorerTeamId = d.team?.id;
              const isHomeGoal = home && scorerTeamId === home.team?.id;
              const teamAbbrEn = isHomeGoal
                ? (homeIsOurHome ? homeNameEn : awayNameEn)
                : (homeIsOurHome ? awayNameEn : homeNameEn);
              return {
                minute: parseInt(d.clock?.displayValue, 10) || 0,
                team: ptAbbr((TEAM_ABBR_BY_NAME[teamAbbrEn]) || ''),
                player: (d.athletesInvolved && d.athletesInvolved[0] && d.athletesInvolved[0].displayName) || '',
                type: /own/i.test(d.type?.text || '') ? 'OWN' : 'REGULAR',
              };
            })
            .filter(g => g.player);
          if (espnGoals.length) goals = espnGoals;
        }
      }

      return {
        id:      m.id,
        espnId,
        stage,
        matchday: m.matchday,
        utcDate: m.utcDate,
        status,
        home:    ptName(homeNameEn),
        homeAbbr:ptAbbr(m.homeTeam?.tla || ''),
        away:    ptName(awayNameEn),
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
