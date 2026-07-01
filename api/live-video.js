// api/live-video.js — Vercel Serverless Function
// Descobre o ID do video AO VIVO no momento no canal da CazeTV, usando a
// YouTube Data API v3 (busca oficial, ao contrario do truque nao-oficial
// "embed/live_stream?channel=" que so funciona as vezes).
//
// Requer a variavel de ambiente YOUTUBE_API_KEY (gratuita, criada no
// Google Cloud Console habilitando "YouTube Data API v3").

const API_KEY    = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCZiYbVptd3PVPf4f6eR6UaQ'; // CazeTV
const YT_BASE    = 'https://www.googleapis.com/youtube/v3';

// Cache em memoria (persiste entre invocacoes "quentes" da funcao na
// Vercel) — evita gastar cota da API a cada refresh do app. A cota
// gratuita da YouTube Data API e de 10.000 unidades/dia, e um
// search.list custa 100 unidades, entao sem cache daria pra estourar
// rapido com varios usuarios abrindo o app.
let cache = { at: 0, videoId: null, title: null };
const CACHE_MS = 30000; // 30s

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!API_KEY) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY nao configurada nas variaveis de ambiente da Vercel.' });
    return;
  }

  if (Date.now() - cache.at < CACHE_MS) {
    res.status(200).json({ live: !!cache.videoId, videoId: cache.videoId, title: cache.title, cached: true });
    return;
  }

  try {
    const url = `${YT_BASE}/search?part=snippet&channelId=${CHANNEL_ID}&eventType=live&type=video&key=${API_KEY}`;
    const r = await fetch(url);
    const data = await r.json();

    if (data.error) {
      // Nao derruba o app — so informa que nao da pra saber se esta ao
      // vivo agora (cota estourada, chave invalida, etc.)
      res.status(200).json({ live: false, videoId: null, title: null, error: data.error.message });
      return;
    }

    const item = (data.items || [])[0];
    const videoId = item ? item.id.videoId : null;
    const title   = item ? item.snippet.title : null;

    cache = { at: Date.now(), videoId, title };

    res.status(200).json({ live: !!videoId, videoId, title });
  } catch (err) {
    res.status(200).json({ live: false, videoId: null, title: null, error: err.message });
  }
}
