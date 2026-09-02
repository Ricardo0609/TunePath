// ─────────────────────────────────────────────
// TUNEPATH — Spotify Web API Utilities
// ─────────────────────────────────────────────
//
// LIMITE CLAVE (causa de los errores 400):
// En apps en Development Mode, los endpoints de catalogo aceptan
// como maximo limit=10 (default 5). Pedir limit=50 devuelve
// 400 Bad Request. Aplica a /search, /artists/{id}/albums y
// /albums/{id}/tracks. Por eso aqui NUNCA se pide mas de 10 por
// request: para traer mas datos se pagina con offset.
//
// OJO: Spotify a veces responde 400 con el mensaje "Invalid limit"
// aunque la causa real sea falta de acceso al catalogo para apps sin
// Extended Quota Mode. Por eso api() imprime el mensaje real de
// Spotify en consola — si algo falla, ahi esta el motivo exacto.
//
// OTROS CAMBIOS DE LA API YA CONTEMPLADOS:
//   - /recommendations, /audio-features, /related-artists: deprecados.
//   - GET /artists/{id}/top-tracks: eliminado.
//   - POST /users/{id}/playlists  -> POST /me/playlists
//   - POST /playlists/{id}/tracks -> POST /playlists/{id}/items
//   - campo `popularity`: eliminado.
//
// Se quito `market=US`: con un token de usuario valido, el pais de la
// cuenta tiene prioridad sobre ese parametro, asi que solo agregaba
// superficie para fallar.

import { getToken } from './auth';

const BASE = 'https://api.spotify.com/v1';
const PAGE_LIMIT = 10; // tope duro de la API

// Cache en memoria por sesion (evita repetir decenas de requests)
const catalogCache = new Map();
const albumsCache = new Map();

async function api(path, opts = {}, retries = 2) {
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

  // Rate limit: Spotify manda Retry-After en segundos
  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get('Retry-After') || 1) * 1000;
    await new Promise(r => setTimeout(r, Math.min(wait, 5000)));
    return api(path, opts, retries - 1);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error?.message || `Spotify API error ${res.status}`;
    // Mensaje real de Spotify, para no diagnosticar a ciegas
    console.error(`[Spotify ${res.status}] ${path} → ${msg}`);
    throw new Error(msg);
  }

  return res.json();
}

/**
 * Pagina un endpoint que devuelve { items, next } respetando el tope
 * de 10 por request. `max` corta el total para no disparar el rate limit.
 */
async function getPaged(path, { max = 50, key = null } = {}) {
  const items = [];
  let offset = 0;

  while (items.length < max) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await api(`${path}${sep}limit=${PAGE_LIMIT}&offset=${offset}`);
    const bucket = key ? page?.[key] : page;
    const batch = bucket?.items || [];

    items.push(...batch);
    if (batch.length < PAGE_LIMIT || !bucket?.next) break;
    offset += PAGE_LIMIT;
  }

  return items.slice(0, max);
}

// ── User ──────────────────────────────────────

export const getMe = () => api('/me');

// ── Search ────────────────────────────────────

export async function searchArtists(query) {
  if (!query?.trim()) return [];
  const data = await api(
    `/search?q=${encodeURIComponent(query)}&type=artist&limit=${PAGE_LIMIT}`
  );
  return (data.artists?.items || []).filter(a => a.name);
}

// ── Albums (orden cronologico) ────────────────

export async function getArtistAlbums(artistId, { max = 40 } = {}) {
  if (albumsCache.has(artistId)) return albumsCache.get(artistId);

  const raw = await getPaged(`/artists/${artistId}/albums?include_groups=album,single`, { max });

  // Dedup: nos quedamos con la edicion mas antigua de cada nombre
  const seen = new Map();
  for (const album of raw) {
    const key = album.name
      .toLowerCase()
      .replace(/\s*[\(\[].*?(remaster|deluxe|edition|version|anniversary).*?[\)\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const prev = seen.get(key);
    if (!prev || new Date(album.release_date) < new Date(prev.release_date)) {
      seen.set(key, album);
    }
  }

  const sorted = [...seen.values()].sort(
    (a, b) => new Date(a.release_date) - new Date(b.release_date)
  );

  albumsCache.set(artistId, sorted);
  return sorted;
}

// ── Catalogo de canciones ─────────────────────

/**
 * /albums/{id}/tracks devuelve tracks "simplificados" SIN el campo
 * `album`. Se lo adjuntamos para que las portadas salgan correctas
 * (esta era la causa del bug de portadas equivocadas).
 */
async function getAlbumTracks(album, { max = 20 } = {}) {
  const items = await getPaged(`/albums/${album.id}/tracks`, { max });
  return items.map(t => ({ ...t, album }));
}

/**
 * Catalogo real de un artista. maxAlbums se mantiene bajo a proposito:
 * con el tope de 10 por request, cada album cuesta 1-2 llamadas.
 */
export async function getArtistCatalog(artist, { maxAlbums = 8 } = {}) {
  if (catalogCache.has(artist.id)) return catalogCache.get(artist.id);

  const albums = await getArtistAlbums(artist.id);
  if (!albums.length) return [];

  // Priorizamos LPs sobre singles
  const prioritized = [
    ...albums.filter(a => a.album_type === 'album'),
    ...albums.filter(a => a.album_type !== 'album'),
  ].slice(0, maxAlbums);

  const perAlbum = await Promise.all(
    prioritized.map(a => getAlbumTracks(a).catch(() => []))
  );

  let tracks = perAlbum.flat().filter(t => t.artists?.some(a => a.id === artist.id));

  // Dedup por nombre normalizado (live / remaster / remix repetidos)
  const seen = new Set();
  tracks = tracks.filter(t => {
    const key = t.name.toLowerCase().replace(/\s*[\(\[].*?[\)\]]/g, '').replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  catalogCache.set(artist.id, tracks);
  return tracks;
}

// ── Vibes ─────────────────────────────────────
//
// LIMITACION REAL: Spotify elimino audio-features (energy, valence,
// danceability) y el campo popularity. No hay forma de leer el "mood"
// real desde la API publica. Se usa la DURACION como proxy honesto:
// los cortes largos suelen ser mas lentos/atmosfericos, los cortos mas
// directos. Es una aproximacion, no deteccion de animo.

const VIBES = {
  balanced:  { label: 'Balanced',  icon: '🎲', bias: null },
  party:     { label: 'Party',     icon: '🎉', bias: 'short' },
  energetic: { label: 'Energetic', icon: '⚡', bias: 'short' },
  happy:     { label: 'Happy',     icon: '😊', bias: 'short' },
  chill:     { label: 'Chill',     icon: '🌙', bias: 'long' },
  focus:     { label: 'Focus',     icon: '🎯', bias: 'long' },
  moody:     { label: 'Moody',     icon: '🕶️', bias: 'long' },
};

export function getVibeList() {
  return Object.entries(VIBES).map(([id, v]) => ({ id, ...v }));
}

function applyVibe(tracks, vibeId) {
  const bias = VIBES[vibeId]?.bias;
  if (!bias || tracks.length < 6) return tracks;

  const sorted = [...tracks].sort((a, b) => (a.duration_ms || 0) - (b.duration_ms || 0));
  const half = Math.ceil(sorted.length / 2);
  return bias === 'short' ? sorted.slice(0, half) : sorted.slice(half);
}

// ── Helpers de seleccion ──────────────────────

export function pickRandom(arr, count) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function shuffle(arr) {
  return pickRandom(arr, arr.length);
}

// ── Mix ───────────────────────────────────────

export async function buildMix(artists, { songsPerArtist = 3, totalSongs = 20, vibe = null } = {}) {
  if (!artists.length) return [];

  const catalogs = await Promise.all(
    artists.map(async artist => {
      try {
        return { artist, tracks: applyVibe(await getArtistCatalog(artist), vibe) };
      } catch {
        return { artist, tracks: [] };
      }
    })
  );

  let pool = catalogs.flatMap(c => pickRandom(c.tracks, songsPerArtist));

  const seen = new Set();
  pool = pool.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Relleno si no se llego al total (reusa los catalogos ya cargados)
  if (pool.length < totalSongs) {
    const filler = catalogs.flatMap(c => c.tracks).filter(t => !seen.has(t.id));
    pool = [...pool, ...pickRandom(filler, totalSongs - pool.length)];
  }

  return pickRandom(pool, Math.min(totalSongs, pool.length));
}

// ── Shuffle de un solo artista ────────────────

export async function getArtistShuffle(artist, count = 25) {
  const catalog = await getArtistCatalog(artist, { maxAlbums: 12 });
  return pickRandom(catalog, Math.min(count, catalog.length));
}

// ── Discover ──────────────────────────────────

export async function getDiscoverTracks(seedArtists, limit = 8) {
  if (!seedArtists.length) return [];

  let artists = seedArtists;

  // Rehidratar generos si los artistas guardados no los traen
  if (!artists.some(a => a.genres?.length)) {
    try {
      const ids = artists.slice(0, 20).map(a => a.id).join(',');
      const data = await api(`/artists?ids=${ids}`);
      if (data?.artists?.length) artists = data.artists;
    } catch {
      /* seguimos con lo que haya */
    }
  }

  const genres = [...new Set(artists.flatMap(a => a.genres || []))];
  if (!genres.length) return [];

  const seedIds = new Set(artists.map(a => a.id));
  const sampledGenres = pickRandom(genres, Math.min(4, genres.length));

  const results = await Promise.all(
    sampledGenres.map(async genre => {
      try {
        const data = await api(
          `/search?q=${encodeURIComponent(`genre:"${genre}"`)}&type=track&limit=${PAGE_LIMIT}`
        );
        return data.tracks?.items || [];
      } catch {
        return [];
      }
    })
  );

  let tracks = results.flat().filter(t => !t.artists?.some(a => seedIds.has(a.id)));

  const seenTrack = new Set();
  const seenArtist = new Set();
  tracks = tracks.filter(t => {
    if (seenTrack.has(t.id)) return false;
    const artistKey = t.artists?.[0]?.id;
    if (artistKey && seenArtist.has(artistKey)) return false;
    seenTrack.add(t.id);
    if (artistKey) seenArtist.add(artistKey);
    return true;
  });

  return pickRandom(tracks, Math.min(limit, tracks.length));
}

// ── Crear playlist ────────────────────────────

export async function createSpotifyPlaylist(tracks, name) {
  const playlist = await api('/me/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name: name || 'TunePath Mix 🎵',
      description: `Auto-generated by TunePath on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      public: false,
    }),
  });

  const uris = tracks.map(t => t.uri).filter(Boolean);
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
    'TunePath Mix',
  ];

  return options[Math.floor(Math.random() * options.length)];
}
