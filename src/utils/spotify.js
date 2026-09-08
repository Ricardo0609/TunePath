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

// ── Pool ligero para el Mix (varios artistas) ──
//
// getArtistPool (el del Shuffle) recorre toda la discografía: perfecto
// para un solo artista, demasiado caro para un mix de 6+. Esta versión
// usa sólo la primera página de álbumes y saca canciones de discos
// DISTINTOS, que es lo que da variedad. Todo cacheado.

const LIGHT_ALBUMS = 4;

export async function getArtistPoolLight(artist) {
  return _cached(`poolLight:${artist.id}`, async () => {
    let albums = [];
    try {
      const data = await api(
        `/artists/${artist.id}/albums?include_groups=album,single&limit=${ALBUM_LIMIT}`
      );
      albums = data.items || [];
    } catch {
      albums = [];
    }

    if (!albums.length) {
      // Respaldo: búsqueda clásica
      try {
        return await getArtistTracks(artist);
      } catch {
        return [];
      }
    }

    const chosen = pickRandom(albums, Math.min(LIGHT_ALBUMS, albums.length));
    const tracks = [];

    for (let i = 0; i < chosen.length; i++) {
      const album = chosen[i];
      try {
        const data = await _cached(`albumTracks:${album.id}`, async () => {
          const r = await api(`/albums/${album.id}/tracks`);
          return r.items || [];
        });
        for (const t of data) {
          if (!t.artists?.some(a => a.id === artist.id)) continue;
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

    // Dedup por nombre normalizado (remasters, ediciones deluxe)
    const seen = new Set();
    return tracks.filter(t => {
      const key = t.name.toLowerCase().replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

// ── Mix de varios artistas ────────────────────

// Cuántos artistas aportan a un mix. Más que esto dispara demasiadas
// peticiones la primera vez (después todo sale de caché).
const MAX_ARTISTS_PER_MIX = 6;

// Memoria de canciones ya usadas, para no repetir entre mixes seguidos
const RECENT_KEY = 'ws_recent_tracks';
const RECENT_MAX = 120;

function _readRecent() {
  try {
    return new Set(JSON.parse(localStorage.getItem(RECENT_KEY)) || []);
  } catch {
    return new Set();
  }
}

function _saveRecent(ids) {
  try {
    const prev = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    const next = [...ids, ...prev].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

export function clearRecentTracks() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* noop */ }
}

export async function buildMix(artists, { songsPerArtist = 3, totalSongs = 20, vibe = null } = {}) {
  if (!artists.length) return [];

  // Rotamos qué artistas participan: cada mix suena distinto
  const participants = artists.length > MAX_ARTISTS_PER_MIX
    ? pickRandom(artists, MAX_ARTISTS_PER_MIX)
    : artists;

  const recent = _readRecent();
  const perArtist = [];

  for (let i = 0; i < participants.length; i++) {
    const artist = participants[i];
    try {
      const pool = await getArtistPoolLight(artist);
      if (!pool.length) continue;

      // Preferimos lo que no salió en mixes recientes
      const fresh = pool.filter(t => !recent.has(t.id));
      const source = fresh.length >= songsPerArtist ? fresh : pool;

      // pickDiverse reparte entre álbumes distintos
      perArtist.push(pickDiverse(source, songsPerArtist));
    } catch {
      // un artista fallido no rompe el mix
    }
    if (i < participants.length - 1) await sleep(200);
  }

  let pool = perArtist.flat();

  const seen = new Set();
  pool = pool.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Ajustamos al total pidiendo, repartiendo entre álbumes
  let final = pool.length > totalSongs
    ? pickDiverse(pool, totalSongs)
    : pickDiverse(pool, pool.length);

  _saveRecent(final.map(t => t.id));
  return final;
}

// ── Discover: bandas emergentes afines a tus gustos ──
//
// LIMITACIÓN REAL DE LA API (verificada, no supuesta):
// En Development Mode los objetos de artista YA NO traen `genres`,
// `followers` ni `popularity` — ni siquiera desde /artists/{id}.
// Por eso:
//   - No se puede leer el género de tus artistas → se DEDUCE preguntando
//     a la búsqueda (`genre:"X" artist:"Nombre"` sólo devuelve resultados
//     si ese artista está etiquetado con ese género). El perfil se guarda
//     en localStorage para no repetir el proceso.
//   - No se puede medir "seguidores" ni "está creciendo". El criterio de
//     calidad que SÍ es verificable es exigir un mínimo de álbumes.
//   - Lo "emergente" se aproxima con `tag:hipster`, que Spotify define
//     como el 10% menos popular del catálogo.

const GENRE_CANDIDATES = [
  'rock', 'metal', 'hard rock', 'heavy metal', 'punk', 'grunge',
  'alternative rock', 'indie rock', 'classic rock', 'pop', 'hip hop',
  'electronic', 'jazz', 'blues', 'folk', 'r&b', 'reggaeton', 'latin',
];

const GENRE_PROFILE_KEY = 'ws_genre_profile';
const MIN_ALBUMS = 2;

function _readGenreProfile() {
  try {
    return JSON.parse(localStorage.getItem(GENRE_PROFILE_KEY)) || { genres: [], tested: [] };
  } catch {
    return { genres: [], tested: [] };
  }
}

function _saveGenreProfile(profile) {
  try {
    localStorage.setItem(GENRE_PROFILE_KEY, JSON.stringify(profile));
  } catch { /* storage lleno o bloqueado */ }
}

/**
 * Deduce a qué géneros pertenecen tus artistas. Prueba un artista por
 * llamada (para no saturar) y acumula el perfil en localStorage.
 */
export async function buildGenreProfile(seedArtists, { onProgress } = {}) {
  const profile = _readGenreProfile();
  const pending = seedArtists.filter(a => !profile.tested.includes(a.id));
  if (!pending.length) return profile.genres;

  const artist = pending[0];
  const found = [];

  for (let i = 0; i < GENRE_CANDIDATES.length; i++) {
    const g = GENRE_CANDIDATES[i];
    if (onProgress) onProgress(i + 1, GENRE_CANDIDATES.length);
    try {
      const q = `genre:"${g}" artist:"${artist.name}"`;
      const data = await api(`/search?q=${encodeURIComponent(q)}&type=artist&limit=1`);
      const hit = data.artists?.items?.[0];
      if (hit && hit.id === artist.id) found.push(g);
    } catch {
      // si falla una, seguimos con las demás
    }
    if (i < GENRE_CANDIDATES.length - 1) await sleep(220);
  }

  profile.tested.push(artist.id);
  profile.genres = [...new Set([...profile.genres, ...found])];
  _saveGenreProfile(profile);
  return profile.genres;
}

export function getGenreProfile() {
  return _readGenreProfile().genres;
}

export function resetGenreProfile() {
  try { localStorage.removeItem(GENRE_PROFILE_KEY); } catch { /* noop */ }
}

/** Álbumes de un artista (primera página) — para validar trayectoria. */
async function getArtistFirstAlbums(artistId) {
  return _cached(`firstalbums:${artistId}`, async () => {
    const data = await api(
      `/artists/${artistId}/albums?include_groups=album&limit=${ALBUM_LIMIT}`
    );
    return data.items || [];
  });
}

/**
 * Devuelve bandas emergentes afines a tus géneros, cada una con su
 * mejor álbum. Exige al menos MIN_ALBUMS álbumes de trayectoria.
 */
export async function getDiscoverArtists(seedArtists, limit = 5) {
  let genres = getGenreProfile();

  // Si aún no hay perfil, se deduce. Se intenta con varios artistas por
  // si el primero no arroja ningún género (si no, quedaría marcado como
  // analizado y el perfil nunca se llenaría).
  let intentos = 0;
  while (!genres.length && intentos < 3) {
    const antes = getGenreProfile().length;
    genres = await buildGenreProfile(seedArtists);
    if (getGenreProfile().length === antes && genres.length === 0) {
      intentos++;
      continue;
    }
    intentos++;
  }
  if (!genres.length) return [];

  const seedIds = new Set(seedArtists.map(a => a.id));
  const sampled = pickRandom(genres, Math.min(2, genres.length));

  // Búsqueda de álbumes poco conocidos en tus géneros
  // IMPORTANTE: `genre:"X" tag:hipster` devuelve 0 resultados (verificado).
  // El filtro genre: no se puede combinar con tag:, así que el género va
  // como texto libre junto al tag.
  const queries = sampled.flatMap(g => [
    `tag:hipster ${g}`,
    `tag:new ${g}`,
  ]);

  const candidates = new Map(); // artistId -> artist resumido

  for (let i = 0; i < queries.length; i++) {
    try {
      const q = queries[i];
      const items = await _cached(`discAlbum:${q}`, async () => {
        const r = await api(`/search?q=${encodeURIComponent(q)}&type=album&limit=${SEARCH_LIMIT_MAX}`);
        return r.albums?.items || [];
      });

      for (const al of items) {
        // Fuera recopilatorios: no representan a una banda concreta
        if (al.album_type === 'compilation') continue;
        if (al.artists?.length > 1) continue;

        const a = al.artists?.[0];
        if (!a?.id || seedIds.has(a.id) || candidates.has(a.id)) continue;

        const n = a.name.toLowerCase();
        if (n.includes('varios artistas') || n.includes('various artists')) continue;

        candidates.set(a.id, a);
      }
    } catch {
      // una búsqueda fallida no rompe el resto
    }
    if (candidates.size >= limit * 3) break;
    if (i < queries.length - 1) await sleep(250);
  }

  if (!candidates.size) return [];

  // Validamos trayectoria (>= MIN_ALBUMS) y tomamos su mejor álbum
  const shortlist = pickRandom([...candidates.values()], Math.min(limit * 2, candidates.size));
  const out = [];

  for (let i = 0; i < shortlist.length && out.length < limit; i++) {
    const artist = shortlist[i];
    try {
      const albums = await getArtistFirstAlbums(artist.id);
      if (albums.length >= MIN_ALBUMS) {
        const best = [...albums].sort(
          (a, b) => new Date(b.release_date) - new Date(a.release_date)
        )[0];
        out.push({ artist, album: best, albumCount: albums.length });
      }
    } catch {
      // si falla, lo omitimos
    }
    if (i < shortlist.length - 1 && out.length < limit) await sleep(250);
  }

  return out;
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
