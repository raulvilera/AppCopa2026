// api/match-stats.js — Vercel Serverless Function
// Busca estatísticas detalhadas de uma partida (posse de bola, chutes,
// cartões, escanteios, substituições e, quando disponível, destaques
// individuais) via ESPN (gratuita, sem chave).
//
// IMPORTANTE: mapa de calor NÃO está disponível aqui de propósito.
// Isso exige dado de rastreamento posicional (tipo Opta/StatsPerform),
// que é vendido só pra emissoras/clubes — nenhuma API pública e
// gratuita disponibiliza isso. Preferimos não mostrar essa seção a
// mostrar um mapa de calor inventado.

const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=';

// Nomes de estatística que a ESPN usa (variam um pouco) → nosso rótulo em PT.
const STAT_LABELS = {
  'possessionpct':        'Posse de bola',
  'ballpossession':       'Posse de bola',
  'totalshots':           'Finalizações',
  'shotsontarget':        'Finalizações no gol',
  'shotsongoal':          'Finalizações no gol',
  'shotsofftarget':       'Finalizações para fora',
  'woncorners':           'Escanteios',
  'cornerkicks':          'Escanteios',
  'foulscommitted':       'Faltas cometidas',
  'fouls':                'Faltas cometidas',
  'offsides':             'Impedimentos',
  'yellowcards':          'Cartões amarelos',
  'redcards':             'Cartões vermelhos',
  'saves':                'Defesas do goleiro',
  'totalpasses':          'Passes',
  'passaccuracy':         'Precisão de passe',
  'passpct':              'Precisão de passe',
};

function statKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z]/g, '');
}

function normName(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const eventId = (req.query && req.query.id) || '';
  if (!eventId) {
    res.status(400).json({ error: 'missing id' });
    return;
  }

  try {
    const r = await fetch(SUMMARY_URL + encodeURIComponent(eventId));
    if (!r.ok) throw new Error('ESPN ' + r.status);
    const data = await r.json();

    const comp = data.header?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];

    // --- ESTATÍSTICAS DE TIME (posse, chutes, cartões, escanteios...) ---
    const boxTeams = data.boxscore?.teams || [];
    const teamStatsFor = (teamId) => {
      const entry = boxTeams.find(t => t.team?.id === teamId);
      if (!entry) return [];
      return (entry.statistics || [])
        .map(s => ({
          key: statKey(s.name),
          label: STAT_LABELS[statKey(s.name)] || s.label || s.displayName || s.name,
          value: s.displayValue ?? s.value ?? '',
        }))
        .filter(s => STAT_LABELS[s.key]); // só mostra o que sabemos rotular com confiança
    };
    const homeStats = home ? teamStatsFor(home.team?.id) : [];
    const awayStats = away ? teamStatsFor(away.team?.id) : [];

    // --- SUBSTITUIÇÕES E CARTÕES (via lista de lances, quando disponível) ---
    const plays = data.plays || comp?.details || [];
    const events = plays
      .map(p => {
        const typeText = p.type?.text || p.text || '';
        const isSub = /substitution/i.test(typeText);
        const isCard = /yellow card|red card/i.test(typeText);
        const isGoal = p.scoringPlay || /goal/i.test(typeText);
        if (!isSub && !isCard && !isGoal) return null;
        const teamId = p.team?.id;
        const side = home && teamId === home.team?.id ? 'home' : (away && teamId === away.team?.id ? 'away' : null);
        const athletes = p.athletesInvolved || [];
        return {
          minute: p.clock?.displayValue || '',
          side,
          kind: isSub ? 'SUB' : isCard ? (/red/i.test(typeText) ? 'RED' : 'YELLOW') : 'GOAL',
          playerIn:  isSub ? (athletes[0]?.displayName || '') : '',
          playerOut: isSub ? (athletes[1]?.displayName || '') : '',
          player:    !isSub ? (athletes[0]?.displayName || '') : '',
        };
      })
      .filter(Boolean);

    // --- DESTAQUES INDIVIDUAIS (só se a ESPN realmente disponibilizar) ---
    // A ESPN nem sempre expõe estatística individual detalhada (passes,
    // desarmes) pra jogos de seleção — quando não tem, deixamos vazio
    // em vez de inventar número.
    function topPlayerByStat(statNameRegex) {
      const players = data.boxscore?.players || [];
      let best = null;
      for (const teamBlock of players) {
        const side = home && teamBlock.team?.id === home.team?.id ? 'home' : 'away';
        for (const group of (teamBlock.statistics || [])) {
          const idx = (group.names || group.labels || []).findIndex(n => statNameRegex.test(n));
          if (idx === -1) continue;
          for (const athleteRow of (group.athletes || [])) {
            const raw = athleteRow.stats?.[idx];
            const val = parseFloat(raw);
            if (!isNaN(val) && (!best || val > best.value)) {
              best = { player: athleteRow.athlete?.displayName || '', value: val, side };
            }
          }
        }
      }
      return best;
    }
    const highlights = {
      topPasser:  topPlayerByStat(/pass.*(completed|accurate)/i),
      mostTackles: topPlayerByStat(/tackles?/i),
      mostShots:  topPlayerByStat(/shots?(?!.*target)/i),
    };
    const hasHighlights = highlights.topPasser || highlights.mostTackles || highlights.mostShots;

    res.status(200).json({
      status: comp?.status?.type?.state || null,
      home: { name: home?.team?.displayName || '', score: home?.score ?? null, stats: homeStats },
      away: { name: away?.team?.displayName || '', score: away?.score ?? null, stats: awayStats },
      events,
      highlights: hasHighlights ? highlights : null,
      // Sinaliza pro front-end que mapa de calor não é oferecido de propósito
      // (dado proprietário, não disponível em nenhuma API pública gratuita).
      heatmapAvailable: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
