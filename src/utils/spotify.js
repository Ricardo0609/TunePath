// ─────────────────────────────────────────────
// WAVESET — Spotify Web API Utilities
// ─────────────────────────────────────────────
//
// TWO rounds of Spotify breaking changes are baked into this file:
//
// 1) Nov 27, 2024 — /v1/recommendations, /v1/audio-features and
//    /v1/related-artists were deprecated for any app not already in
//    Extended Quota Mode. "Discover" below works around this with a
//    genre-based /search instead of /recommendations.
//
// 2) Feb 2026 "Dev Mode" migration — for apps in Development Mode
//    (which is what a personal PKCE app like this one runs in):
//      - GET /artists/{id}/top-tracks was REMOVED entirely.
//      - /search limit max dropped from 50 to 10.
//      - POST /users/{id}/playlists → POST /me/playlists
//      - POST /playlists/{id}/tracks → POST /playlists/{id}/items
//      - `popularity` was removed from track/album/artist objects.
//    See: developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
//
// Because top-tracks is gone, "an artist's tracks" here means: search
// for tracks with an `artist:"Name"` filter, then keep only the ones
// whose artist id actually matches (search is a text match, not an
// exact-ID lookup, so this guards against near-name collisions).
//
// Because `popularity` is gone, "Vibe" can no longer sort by it. It now
// nudges the search query itself with a mood keyword (e.g. "chill") and
// lets Spotify's own search relevance do the work. It's a best-effort
// approximation, not a real audio-feature filter — that data no longer
// exists in the public API for Development Mode apps.

import { getToken } from './auth';

const BASE = 'https://api.spotify.com/v1';
const SEARCH_LIMIT_MAX = 10; // hard cap since Feb 2026

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
  const data = await api(`/search?q=${encodeURIComponent(query)}&type=artist&limit=${SEARCH_LIMIT_MAX}`);
  return data.artists.items.filter(a => a.name);
}

// ── Artist tracks (replacement for the removed /top-tracks) ──

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

/**
 * Gets tracks for a given artist via /search (top-tracks endpoint no
 * longer exists in Dev Mode). Optionally biases the query with a vibe
 * keyword. Falls back to the unfiltered result set if the strict
 * artist-id match comes back empty (can happen when the vibe keyword
 * narrows things too much).
 */
export async function getArtistTracks(artist, { vibeId = null, limit = SEARCH_LIMIT_MAX } = {}) {
  const keyword = VIBES[vibeId]?.keyword;
  const q = keyword ? `artist:"${artist.name}" ${keyword}` : `artist:"${artist.name}"`;
  const data = await api(`/search?q=${encodeURIComponent(q)}&type=track&limit=${Math.min(limit, SEARCH_LIMIT_MAX)}`);
  const items = data.tracks?.items || [];
  const matched = items.filter(t => t.artists.some(a => a.id === artist.id));
  return matched.length ? matched : items;
}

/**
 * Shuffle tracks for an artist.
 */
export async function getArtistShuffle(artist, count = 5) {
  const tracks = await getArtistTracks(artist, { limit: SEARCH_LIMIT_MAX });
  return pickRandom(tracks, count);
}

/**
 * Alias for getArtistTracks to preserve compatibility.
 */
export async function getArtistTopTracks(artist) {
  return getArtistTracks(artist);
}

// ── Artist albums (still available, unaffected by the Feb 2026 changes) ──

export async function getArtistAlbums(artistId) {
  const data = await api(
    `/artists/${artistId}/albums?include_groups=album,single&market=US&limit=50`
  );

  // Deduplicate by normalized name (Spotify returns region variants)
  const seen = new Set();
  const unique = data.items.filter(album => {
    const key = album.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort chronologically (oldest first)
  return unique.sort((a, b) => {
    const da = new Date(a.release_date);
    const db = new Date(b.release_date);
    return da - db;
  });
}

// ── Mix building ──────────────────────────────

/** Pick `count` random unique items from array */
export function pickRandom(arr, count) {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, count);
}

/**
 * Builds a mix of tracks from a pool of artists.
 * @param {Array} artists - full artist objects (must include .id, .name)
 * @param {Object} opts - { songsPerArtist, totalSongs, vibe }
 */
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

  // Dedup by track id
  const seen = new Set();
  pool = pool.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Trim or top-up to totalSongs
  if (pool.length > totalSongs) {
    pool = pickRandom(pool, totalSongs);
  } else if (pool.length < totalSongs) {
    const extra = perArtist.flat().filter(t => !pool.find(p => p.id === t.id));
    pool = [...pool, ...pickRandom(extra, totalSongs - pool.length)];
  }

  return pickRandom(pool, Math.min(totalSongs, pool.length));
}

// ── Discover (replacement for the deprecated /recommendations) ──

/**
 * Finds new tracks using the genres of the artists you already picked,
 * via /search, excluding your own seed artists so it actually surfaces
 * something new.
 */
export async function getDiscoverTracks(seedArtists, limit = 8) {
  const genres = [...new Set(seedArtists.flatMap(a => a.genres || []))];
  if (!genres.length) return [];

  const seedIds = new Set(seedArtists.map(a => a.id));
  const sampledGenres = pickRandom(genres, Math.min(3, genres.length));

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

  let tracks = results.flat().filter(t => !t.artists.some(a => seedIds.has(a.id)));

  // Dedup by track id, then by artist (avoid several songs from the same "new" artist)
  const seenTrack = new Set();
  const seenArtist = new Set();
  tracks = tracks.filter(t => {
    if (seenTrack.has(t.id)) return false;
    const artistKey = t.artists[0]?.id;
    if (artistKey && seenArtist.has(artistKey)) return false;
    seenTrack.add(t.id);
    if (artistKey) seenArtist.add(artistKey);
    return true;
  });

  return pickRandom(tracks, Math.min(limit, tracks.length));
}

// ── Playlist creation ─────────────────────────

export async function createSpotifyPlaylist(tracks, name) {
  // 1 — Create empty playlist (POST /me/playlists — /users/{id}/playlists was removed)
  const playlist = await api('/me/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name: name || 'Waveset Mix 🎵',
      description: `Auto-generated by Waveset on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      public: false,
    }),
  });

  // 2 — Add tracks in batches of 100 (POST /playlists/{id}/items — renamed from /tracks)
  const uris = tracks.map(t => t.uri);
  for (let i = 0; i < uris.length; i += 100) {
    await api(`/playlists/${playlist.id}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }

  return playlist;
}

// ── Helpers ───────────────────────────────────

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

/** Generate a fun playlist name based on artists and time of day */
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
