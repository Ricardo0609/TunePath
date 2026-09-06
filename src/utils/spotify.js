// ─────────────────────────────────────────────
// WAVESET — Spotify Web API Utilities
// ─────────────────────────────────────────────
//
// Cambios de la API que este archivo maneja:
//
// 1) Nov 2024 — /recommendations, /audio-features y /related-artists
//    fueron deprecados. "Discover" usa /search por género en su lugar.
//
// 2) Feb 2026 — para apps en Development Mode:
//      - GET /artists/{id}/top-tracks fue ELIMINADO. Se reemplaza por
//        /search con filtro artist:"Nombre".
//      - /artists/{id}/albums: el límite bajó a 5 (más da 400 "Invalid limit"),
//        por eso la discografía se pagina con offset.
//      - POST /users/{id}/playlists → POST /me/playlists
//      - POST /playlists/{id}/tracks → POST /playlists/{id}/items
//      - Se eliminó el campo `popularity`.

import { getToken } from './auth';

const BASE = 'https://api.spotify.com/v1';
const SEARCH_LIMIT_MAX = 10;
const ALBUM_LIMIT = 5; // tope actual de /artists/{id}/albums

async function api(path, opts = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Spotify API error ${res.status}`);
  }

  return res.json();
}

// ── Ejecución en serie con pausa (evita saturar el rate limit) ──

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Ejecuta tareas una por una con `gap` ms entre cada una. */
async function runSerial(tasks, gap = 250) {
  const out = [];
  for (let i = 0; i < tasks.length; i++) {
    try {
      out.push(await tasks[i]());
    } catch {
      out.push(null);
    }
    if (i < tasks.length - 1) await sleep(gap);
  }
  return out;
}

// ── Caché en memoria (vive mientras la pestaña esté abierta) ──

const _cache = new Map();

function _cached(key, fn) {
  if (_cache.has(key)) return _cache.get(key);
  const p = fn().catch(err => { _cache.delete(key); throw err; });
  _cache.set(key, p);
  return p;
}

export function clearCache() {
  _cache.clear();
}

// ── User ──────────────────────────────────────

export const getMe = () => api('/me');

// ── Search ────────────────────────────────────

export async function searchArtists(query) {
  if (!query?.trim()) return [];
  const data = await api(`/search?q=${encodeURIComponent(query)}&type=artist&limit=${SEARCH_LIMIT_MAX}`);
  return data.artists?.items?.filter(a => a.name) || [];
}

// ── Vibes ─────────────────────────────────────

const VIBES = {
  party:     { label: 'Party',     icon: '🎉', keyword: 'party' },
  energetic: { label: 'Energetic', icon: '⚡', keyword: 'workout' },
  happy:     { label: 'Happy',     icon: '😊', keyword: 'happy' },
  chill:     { label: 'Chill',     icon: '🌙', keyword: 'chill' },
  focus:     { label: 'Focus',     icon: '🎯', keyword: 'focus' },
  moody:     { label: 'Moody',     icon: '🕶️', keyword: 'moody' },
};

export function getVibeList() {
  return Object.entries(VIBES).map(([id, v]) => ({ id, ...v }));
}

// ── Tracks de un artista (reemplaza al /top-tracks eliminado) ──

/**
 * Busca tracks de un artista vía /search. Filtra por ID exacto para
 * evitar colisiones de nombre; si el filtro deja la lista vacía,
 * devuelve los resultados sin filtrar.
 */
export async function getArtistTracks(artist, { vibeId = null, term = null, limit = SEARCH_LIMIT_MAX } = {}) {
  const keyword = term || VIBES[vibeId]?.keyword || null;
  const key = `tracks:${artist.id}:${keyword || '_'}`;

  return _cached(key, async () => {
    const q = keyword ? `artist:"${artist.name}" ${keyword}` : `artist:"${artist.name}"`;
    const data = await api(`/search?q=${encodeURIComponent(q)}&type=track&limit=${Math.min(limit, SEARCH_LIMIT_MAX)}`);
    const items = data.tracks?.items || [];
    const matched = items.filter(t => t.artists.some(a => a.id === artist.id));
    return matched.length ? matched : items;
  });
}

// ── Pool grande de UN artista (para el Shuffle) ──
// Se usan varios términos para que cada búsqueda devuelva resultados
// distintos, y se corren EN SERIE con pausa para no saturar el límite.
// Queda cacheado: la segunda vez que entras al mismo artista es instantáneo.

// ── Pool de UN artista para el Shuffle ──
//
// Se arma desde la DISCOGRAFÍA real, no desde /search: la búsqueda
// siempre devuelve los mismos hits (casi siempre del mismo álbum), así
// que el shuffle salía repetitivo.
//
// Método: se toman algunos álbumes del artista y se pide el tracklist
// de cada uno, para que el pool cubra toda la carrera y no solo los hits.

// El endpoint de lote (/albums?ids=) devuelve 403 en Development Mode,
// así que se piden los álbumes de uno en uno, en serie y con pausa.
// Cada álbum trae su tracklist completo (~12 canciones), por lo que con
// pocos álbumes ya se junta un pool amplio y bien repartido.
const MAX_ALBUMS_FOR_POOL = 6;

export async function getArtistPool(artist, { minTracks = 15 } = {}) {
  return _cached(`pool:${artist.id}`, async () => {
    let albums = [];
    try {
      albums = await getArtistAlbums(artist.id);
    } catch {
      albums = [];
    }

    if (albums.length) {
      // Muestreo aleatorio para que cada artista no dé siempre los mismos discos
      const chosen = albums.length > MAX_ALBUMS_FOR_POOL
        ? pickRandom(albums, MAX_ALBUMS_FOR_POOL)
        : albums;

      const tracks = [];

      for (let i = 0; i < chosen.length; i++) {
        const album = chosen[i];
        try {
          const data = await api(`/albums/${album.id}/tracks`);
          for (const t of data.items || []) {
            if (!t.artists?.some(a => a.id === artist.id)) continue;
            // El endpoint de tracks no trae la portada: la tomamos del
            // álbum que ya teníamos de la discografía.
            tracks.push({
              ...t,
              album: {
                id: album.id,
                name: album.name,
                images: album.images,
                release_date: album.release_date,
              },
            });
          }
        } catch {
          // un álbum fallido no rompe el resto
        }
        if (i < chosen.length - 1) await sleep(250);
      }

      // Dedup por nombre normalizado: evita que remasters y ediciones
      // deluxe metan la misma canción varias veces
      const seenName = new Set();
      const unique = tracks.filter(t => {
        const key = t.name.toLowerCase().replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
        if (seenName.has(key)) return false;
        seenName.add(key);
        return true;
      });

      if (unique.length) return unique;
    }

    // Respaldo: si la discografía falla, volvemos a /search
    const seen = new Set();
    const fallback = [];
    for (const term of [null, 'live', 'acoustic']) {
      try {
        const tracks = await getArtistTracks(artist, { term });
        for (const t of tracks) {
          if (!seen.has(t.id)) { seen.add(t.id); fallback.push(t); }
        }
      } catch { /* seguimos */ }
      if (fallback.length >= minTracks) break;
      await sleep(250);
    }
    return fallback;
  });
}

/**
 * Elige `count` canciones repartidas entre álbumes distintos.
 * Va tomando una de cada álbum por ronda, así el resultado no queda
 * dominado por un solo disco.
 */
export function pickDiverse(tracks, count) {
  const byAlbum = new Map();
  for (const t of tracks) {
    const key = t.album?.id || t.album?.name || '_';
    if (!byAlbum.has(key)) byAlbum.set(key, []);
    byAlbum.get(key).push(t);
  }

  // Baraja dentro de cada álbum y el orden de los álbumes
  const groups = [...byAlbum.values()].map(g => [...g].sort(() => Math.random() - 0.5));
  groups.sort(() => Math.random() - 0.5);

  const out = [];
  let round = 0;
  while (out.length < count) {
    let added = false;
    for (const g of groups) {
      if (g[round]) {
        out.push(g[round]);
        added = true;
        if (out.length >= count) break;
      }
    }
    if (!added) break; // ya no queda nada en ninguna ronda
    round++;
  }
  return out;
}

// ── Álbumes de un artista (paginado, límite de 5 por página) ──

export async function getArtistAlbums(artistId, maxAlbums = 30) {
  return _cached(`albums:${artistId}`, () => _fetchArtistAlbums(artistId, maxAlbums));
}

async function _fetchArtistAlbums(artistId, maxAlbums) {
  const all = [];

  for (let offset = 0; offset < maxAlbums; offset += ALBUM_LIMIT) {
    try {
      const data = await api(
        `/artists/${artistId}/albums?include_groups=album,single&limit=${ALBUM_LIMIT}&offset=${offset}`
      );
      const items = data.items || [];
      all.push(...items);
      if (!data.next || items.length < ALBUM_LIMIT) break;
    } catch {
      break;
    }
  }

  // Dedup por nombre normalizado (Spotify devuelve variantes regionales)
  const seen = new Set();
  const unique = all.filter(album => {
    const key = album.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Orden cronológico (más antiguo primero)
  return unique.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
}

// ── Helpers de arrays ─────────────────────────

/** Pick `count` random unique items from array */
export function pickRandom(arr, count) {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, count);
}

// ── Mix de varios artistas ────────────────────

export async function buildMix(artists, { songsPerArtist = 3, totalSongs = 20, vibe = null } = {}) {
  if (!artists.length) return [];

  const perArtist = await Promise.all(
    artists.map(async artist => {
      try {
        const tracks = await getArtistTracks(artist, { vibeId: vibe });
        return pickRandom(tracks, songsPerArtist);
      } catch {
        return [];
      }
    })
  );

  let pool = perArtist.flat();

  const seen = new Set();
  pool = pool.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  if (pool.length > totalSongs) {
    pool = pickRandom(pool, totalSongs);
  } else if (pool.length < totalSongs) {
    const extra = perArtist.flat().filter(t => !pool.find(p => p.id === t.id));
    pool = [...pool, ...pickRandom(extra, totalSongs - pool.length)];
  }

  return pickRandom(pool, Math.min(totalSongs, pool.length));
}

// ── Discover (reemplaza al /recommendations deprecado) ──

/**
 * Discover — artistas EMERGENTES relacionados a tus gustos.
 *
 * Estrategia (la API ya no ofrece /recommendations ni /related-artists):
 *   1. Toma los géneros de tus artistas seleccionados.
 *   2. Busca tracks de esos géneros priorizando lanzamientos recientes
 *      (filtro `year:`) y usando `tag:hipster`, que Spotify define como
 *      el 10% menos popular — buena señal de "todavía no explotó".
 *   3. Consulta los artistas encontrados en lote (1 sola petición) para
 *      leer sus `followers`, y se queda con los que están CRECIENDO:
 *      ni desconocidos totales ni ya masivos.
 *
 * Las búsquedas corren en serie con pausa para no saturar el rate limit.
 */

// Rango de seguidores considerado "emergente pero con buenos números"
const EMERGING_MIN_FOLLOWERS = 1000;
const EMERGING_MAX_FOLLOWERS = 500000;

export async function getDiscoverTracks(seedArtists, limit = 8) {
  const genres = [...new Set(seedArtists.flatMap(a => a.genres || []))];
  if (!genres.length) return [];

  const seedIds = new Set(seedArtists.map(a => a.id));
  const year = new Date().getFullYear();
  const sampledGenres = pickRandom(genres, Math.min(2, genres.length));

  // Dos variantes por género: recientes, y "hipster" (baja popularidad)
  const queries = [];
  for (const g of sampledGenres) {
    queries.push(`genre:"${g}" year:${year - 2}-${year}`);
    queries.push(`genre:"${g}" tag:hipster`);
  }

  const tasks = queries.map(q => () =>
    _cached(`discover:${q}`, async () => {
      const data = await api(
        `/search?q=${encodeURIComponent(q)}&type=track&limit=${SEARCH_LIMIT_MAX}`
      );
      return data.tracks?.items || [];
    })
  );

  const results = await runSerial(tasks, 250);
  let tracks = results.filter(Boolean).flat();

  // Fuera lo que ya escuchas
  tracks = tracks.filter(t => !t.artists.some(a => seedIds.has(a.id)));
  if (!tracks.length) return [];

  // Dedup por track y quedarnos con un track por artista
  const seenTrack = new Set();
  const byArtist = new Map();
  for (const t of tracks) {
    if (seenTrack.has(t.id)) continue;
    seenTrack.add(t.id);
    const aid = t.artists[0]?.id;
    if (aid && !byArtist.has(aid)) byArtist.set(aid, t);
  }

  // Consultar followers en lote (máx 50 ids por petición)
  const artistIds = [...byArtist.keys()].slice(0, 50);
  let emerging = [...byArtist.values()];

  try {
    const data = await api(`/artists?ids=${artistIds.join(',')}`);
    const info = new Map((data.artists || []).filter(Boolean).map(a => [a.id, a]));

    const scored = [];
    for (const [aid, track] of byArtist) {
      const a = info.get(aid);
      if (!a) continue;
      const followers = a.followers?.total;

      // Si followers no viene, no descartamos (la API puede omitirlo)
      if (typeof followers === 'number') {
        if (followers < EMERGING_MIN_FOLLOWERS) continue;
        if (followers > EMERGING_MAX_FOLLOWERS) continue;
      }
      scored.push({ track, followers: followers ?? 0 });
    }

    if (scored.length) {
      // Más seguidores primero dentro del rango = "creciendo con buenos números"
      scored.sort((x, y) => y.followers - x.followers);
      emerging = scored.map(s => s.track);
    }
  } catch {
    // Si falla el lote, seguimos con lo que tengamos sin filtrar
  }

  return emerging.slice(0, limit);
}

// ── Crear playlist ────────────────────────────

export async function createSpotifyPlaylist(tracks, name) {
  // POST /me/playlists — /users/{id}/playlists fue eliminado
  const playlist = await api('/me/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name: name || 'Waveset Mix 🎵',
      description: `Auto-generated by Waveset on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      public: false,
    }),
  });

  // POST /playlists/{id}/items — renombrado desde /tracks
  const uris = tracks.map(t => t.uri);
  for (let i = 0; i < uris.length; i += 100) {
    await api(`/playlists/${playlist.id}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }

  return playlist;
}

// ── Helpers de UI ─────────────────────────────

export function getArtistImage(artist) {
  return artist?.images?.[0]?.url || null;
}

export function getAlbumImage(album) {
  return album?.images?.[0]?.url || null;
}

export function getTrackImage(track) {
  return track?.album?.images?.[0]?.url || null;
}

export function getSpotifyUrl(type, id) {
  return `https://open.spotify.com/${type}/${id}`;
}

export function generatePlaylistName(artists) {
  const hour = new Date().getHours();

  const byTime =
    hour < 5  ? ['Late Night Spiral', 'After Dark Mix', 'Midnight Mode'] :
    hour < 12 ? ['Morning Fuel', 'Rise & Grind Mix', 'AM Energy'] :
    hour < 17 ? ['Afternoon Session', 'Midday Groove', 'Work Mode'] :
    hour < 20 ? ['Golden Hour Mix', 'Sunset Session', 'Evening Unwind'] :
    ['Night Vibes', 'After Hours', 'Late Loop'];

  const first = artists[0]?.name?.split(' ')[0] || 'My';
  const second = artists[1]?.name?.split(' ')[0];

  const options = [
    byTime[Math.floor(Math.random() * byTime.length)],
    `The ${first} Takeover`,
    second ? `${first} × ${second}` : `${first}'s World`,
    'Curated Chaos',
    'Deep Cuts Only',
    'Waveset Generated',
  ];

  return options[Math.floor(Math.random() * options.length)];
}
