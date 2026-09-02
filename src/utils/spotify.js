// ─────────────────────────────────────────────
// TUNEPATH — Spotify Web API Utilities
// ─────────────────────────────────────────────
//
// CONTEXTO DE LOS CAMBIOS DE LA API DE SPOTIFY
//
// 1) Nov 2024 — /recommendations, /audio-features y /related-artists
//    quedaron deprecados. No hay reemplazo oficial.
// 2) Feb 2026 — para apps en Development Mode:
//      - GET /artists/{id}/top-tracks fue eliminado.
//      - /search limit maximo bajo de 50 a 10.
//      - POST /users/{id}/playlists -> POST /me/playlists
//      - POST /playlists/{id}/tracks -> POST /playlists/{id}/items
//      - el campo `popularity` fue eliminado.
//
// POR QUE SE REESCRIBIO ESTE ARCHIVO
//
// La version anterior obtenia las canciones de un artista con /search
// (`artist:"Nombre"`). Eso causaba el bug de las portadas equivocadas:
// /search es una coincidencia de TEXTO, no un lookup por ID, asi que
// devolvia covers, tributos y recopilatorios de otros artistas. Y si el
// filtro estricto por ID se quedaba vacio, habia un fallback que
// aceptaba esos resultados equivocados.
//
// Ahora se usa el CATALOGO REAL del artista:
//     /artists/{id}/albums  ->  /albums/{id}/tracks
// Eso garantiza que cada cancion pertenece al artista y que su portada
// es la del album al que realmente pertenece.
//
// NOTA: /albums/{id}/tracks devuelve "simplified track objects", que NO
// incluyen el campo `album`. Por eso aqui se le adjunta el album a mano
// (ver attachAlbum) — de ahi salen las portadas correctas.

import { getToken } from './auth';

const BASE = 'https://api.spotify.com/v1';
const SEARCH_LIMIT_MAX = 10; // tope duro desde Feb 2026

// Cache en memoria por sesion: evita repetir decenas de requests al
// regenerar el mix o al volver a abrir un artista. Se limpia al recargar.
const catalogCache = new Map();

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

// ── User ──────────────────────────────────────

export const getMe = () => api('/me');

// ── Search ────────────────────────────────────

export async function searchArtists(query) {
  if (!query?.trim()) return [];
  const data = await api(
    `/search?q=${encodeURIComponent(query)}&type=artist&limit=${SEARCH_LIMIT_MAX}`
  );
  return (data.artists?.items || []).filter(a => a.name);
}

// ── Albums (orden cronologico) ────────────────

export async function getArtistAlbums(artistId, { includeSingles = true } = {}) {
  const groups = includeSingles ? 'album,single' : 'album';
  const data = await api(
    `/artists/${artistId}/albums?include_groups=${groups}&market=US&limit=50`
  );

  // Spotify devuelve variantes regionales y reediciones con el mismo
  // nombre: nos quedamos con la mas antigua de cada nombre normalizado.
  const seen = new Map();
  for (const album of data.items || []) {
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

  // Cronologico, del mas viejo al mas nuevo
  return [...seen.values()].sort(
    (a, b) => new Date(a.release_date) - new Date(b.release_date)
  );
}

// ── Catalogo de canciones de un artista ───────

/**
 * Los tracks de /albums/{id}/tracks vienen "simplificados" (sin `album`).
 * Les pegamos el album para que las portadas salgan correctas.
 */
function attachAlbum(track, album) {
  return { ...track, album };
}

async function getAlbumTracks(album) {
  const data = await api(`/albums/${album.id}/tracks?limit=50&market=US`);
  return (data.items || []).map(t => attachAlbum(t, album));
}

/**
 * Devuelve el catalogo real de canciones de un artista.
 * Limita cuantos albumes consulta para no disparar el rate limit.
 */
export async function getArtistCatalog(artist, { maxAlbums = 14 } = {}) {
  if (catalogCache.has(artist.id)) return catalogCache.get(artist.id);

  const albums = await getArtistAlbums(artist.id);
  if (!albums.length) return [];

  // Si hay muchos albumes, priorizamos los de tipo "album" y recortamos
  const prioritized = [
    ...albums.filter(a => a.album_type === 'album'),
    ...albums.filter(a => a.album_type !== 'album'),
  ].slice(0, maxAlbums);

  const perAlbum = await Promise.all(
    prioritized.map(a => getAlbumTracks(a).catch(() => []))
  );

  // Solo canciones donde el artista realmente participa
  let tracks = perAlbum.flat().filter(t => t.artists?.some(a => a.id === artist.id));

  // Dedup por nombre normalizado (live, remaster, remix duplicados)
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
// IMPORTANTE / LIMITACION REAL:
// Spotify elimino audio-features (energy, valence, danceability) y
// tambien el campo popularity. Ya NO existe forma de leer el "mood"
// real de una cancion desde la API publica.
//
// Lo que si existe y es confiable: la DURACION de cada track. Se usa
// como proxy honesto — los cortes largos tienden a ser mas lentos /
// atmosfericos, los cortos mas directos. Es una aproximacion, no una
// deteccion de animo. Documentado asi a proposito para no fingir una
// funcionalidad que la API ya no permite.

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

/**
 * Aplica el sesgo de vibra sobre el catalogo: toma la mitad
 * correspondiente (cortas o largas) y de ahi elige al azar, para que dos
 * mixes con la misma vibra no salgan identicos.
 */
function applyVibe(tracks, vibeId) {
  const bias = VIBES[vibeId]?.bias;
  if (!bias || tracks.length < 6) return tracks;

  const sorted = [...tracks].sort((a, b) => (a.duration_ms || 0) - (b.duration_ms || 0));
  const half = Math.ceil(sorted.length / 2);
  return bias === 'short' ? sorted.slice(0, half) : sorted.slice(half);
}

// ── Helpers de seleccion ──────────────────────

/** Elige `count` elementos unicos al azar */
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

/**
 * Arma un mix a partir de varios artistas usando su catalogo real.
 * @param {Array} artists - objetos artista completos (.id, .name)
 * @param {Object} opts - { songsPerArtist, totalSongs, vibe }
 */
export async function buildMix(artists, { songsPerArtist = 3, totalSongs = 20, vibe = null } = {}) {
  if (!artists.length) return [];

  const perArtist = await Promise.all(
    artists.map(async artist => {
      try {
        const catalog = await getArtistCatalog(artist);
        const pool = applyVibe(catalog, vibe);
        return pickRandom(pool, songsPerArtist);
      } catch {
        return [];
      }
    })
  );

  let pool = perArtist.flat();

  // Dedup por id
  const seen = new Set();
  pool = pool.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Si falta para llegar al total, rellenamos con mas del mismo catalogo
  if (pool.length < totalSongs) {
    const extras = await Promise.all(
      artists.map(async artist => {
        try {
          const catalog = await getArtistCatalog(artist);
          return applyVibe(catalog, vibe);
        } catch {
          return [];
        }
      })
    );
    const filler = extras.flat().filter(t => !seen.has(t.id));
    pool = [...pool, ...pickRandom(filler, totalSongs - pool.length)];
  }

  return pickRandom(pool, Math.min(totalSongs, pool.length));
}

// ── Shuffle de un solo artista ────────────────

/** Playlist aleatoria hecha solo con canciones de ese artista */
export async function getArtistShuffle(artist, count = 25) {
  const catalog = await getArtistCatalog(artist);
  return pickRandom(catalog, Math.min(count, catalog.length));
}

// ── Discover ──────────────────────────────────

/**
 * Reemplazo de /recommendations (deprecado). Usa los generos de los
 * artistas que ya elegiste y busca canciones de esos generos, excluyendo
 * a tus propios artistas para que si aparezca musica nueva.
 *
 * Si los artistas guardados no traen `genres` (por venir de una version
 * vieja del localStorage), los recarga desde /artists.
 */
export async function getDiscoverTracks(seedArtists, limit = 8) {
  if (!seedArtists.length) return [];

  let artists = seedArtists;

  // Rehidratar generos si hacen falta
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
          `/search?q=${encodeURIComponent(`genre:"${genre}"`)}&type=track&limit=${SEARCH_LIMIT_MAX}`
        );
        return data.tracks?.items || [];
      } catch {
        return [];
      }
    })
  );

  let tracks = results.flat().filter(t => !t.artists?.some(a => seedIds.has(a.id)));

  // Dedup por cancion y por artista (para no repetir el mismo descubrimiento)
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
  // 1 — Crear playlist vacia (POST /me/playlists)
  const playlist = await api('/me/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name: name || 'TunePath Mix 🎵',
      description: `Auto-generated by TunePath on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      public: false,
    }),
  });

  // 2 — Agregar en lotes de 100 (POST /playlists/{id}/items)
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

/** Nombre de playlist segun artistas y hora del dia */
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
