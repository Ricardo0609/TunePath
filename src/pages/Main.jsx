import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';
import {
  getMe,
  buildMix,
  getDiscoverTracks,
  getArtistCatalog,
  createSpotifyPlaylist,
  generatePlaylistName,
  pickRandom,
} from '../utils/spotify';
import MixView from './MixView';
import ArtistView from './ArtistView';
import SettingsPanel from './SettingsPanel';

const HISTORY_KEY = 'ws_history';
const MAX_HISTORY = 10;

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function Main() {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => readJSON('ws_user', null));
  const [artists, setArtists] = useState(() => readJSON('ws_artists', []));
  const [activeIds, setActiveIds] = useState(() =>
    readJSON('ws_artists', []).map(a => a.id)
  );

  const [mode, setMode] = useState('mix'); // 'mix' | 'artist'
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [songsPerArtist, setSongsPerArtist] = useState(5);
  const [totalSongs, setTotalSongs] = useState(30);
  const [vibe, setVibe] = useState('balanced');

  const [mixTracks, setMixTracks] = useState([]);
  const [playlistName, setPlaylistName] = useState('');
  const [mixLoading, setMixLoading] = useState(false);

  const [discoverTracks, setDiscoverTracks] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const [history, setHistory] = useState(() => readJSON(HISTORY_KEY, []));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const didInit = useRef(false);

  // Sin artistas no hay nada que mostrar
  useEffect(() => {
    if (!artists.length) navigate('/select', { replace: true });
  }, [artists.length, navigate]);

  // Persistir artistas cada vez que cambien (agregar/quitar)
  useEffect(() => {
    if (artists.length) localStorage.setItem('ws_artists', JSON.stringify(artists));
  }, [artists]);

  useEffect(() => {
    getMe()
      .then(u => {
        setUser(u);
        localStorage.setItem('ws_user', JSON.stringify(u));
      })
      .catch(() => {});
  }, []);

  const activeArtists = artists.filter(a => activeIds.includes(a.id));

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Mix ──────────────────────────────────────

  const generateMix = useCallback(
    async (overrides = {}) => {
      const pool = overrides.artists || artists.filter(a => activeIds.includes(a.id));
      if (!pool.length) {
        setMixTracks([]);
        return;
      }
      setMixLoading(true);
      try {
        const tracks = await buildMix(pool, {
          songsPerArtist: overrides.songsPerArtist ?? songsPerArtist,
          totalSongs: overrides.totalSongs ?? totalSongs,
          vibe: overrides.vibe !== undefined ? overrides.vibe : vibe,
        });
        setMixTracks(tracks);
        setPlaylistName(prev => prev || generatePlaylistName(pool));
      } catch (err) {
        showToast(err.message || 'No se pudo armar el mix', 'error');
      } finally {
        setMixLoading(false);
      }
    },
    [artists, activeIds, songsPerArtist, totalSongs, vibe]
  );

  /** NEW MIX — regenera desde cero, con nombre nuevo */
  const handleNewMix = useCallback(() => {
    const pool = artists.filter(a => activeIds.includes(a.id));
    setPlaylistName(pool.length ? generatePlaylistName(pool) : '');
    generateMix({ artists: pool });
  }, [artists, activeIds, generateMix]);

  // ── Discover ─────────────────────────────────

  const loadDiscover = useCallback(async () => {
    const pool = artists.filter(a => activeIds.includes(a.id));
    if (!pool.length) return;
    setDiscoverLoading(true);
    try {
      setDiscoverTracks(await getDiscoverTracks(pool, 8));
    } catch {
      setDiscoverTracks([]);
    } finally {
      setDiscoverLoading(false);
    }
  }, [artists, activeIds]);

  // Carga inicial (una sola vez)
  useEffect(() => {
    if (artists.length && !didInit.current) {
      didInit.current = true;
      generateMix();
      loadDiscover();
    }
  }, [artists.length, generateMix, loadDiscover]);

  // ── Acciones sobre tracks ────────────────────

  async function handleReplaceTrack(index) {
    const pool = artists.filter(a => activeIds.includes(a.id));
    if (!pool.length) return;
    const randomArtist = pickRandom(pool, 1)[0];
    try {
      const catalog = await getArtistCatalog(randomArtist);
      const existingIds = new Set(mixTracks.map(t => t.id));
      const candidates = catalog.filter(t => !existingIds.has(t.id));
      if (!candidates.length) return;
      const [newTrack] = pickRandom(candidates, 1);
      setMixTracks(prev => prev.map((t, i) => (i === index ? newTrack : t)));
    } catch {
      showToast('No se pudo cambiar esa canción', 'error');
    }
  }

  function handleRemoveTrack(index) {
    setMixTracks(prev => prev.filter((_, i) => i !== index));
  }

  function handleAddDiscoverTrack(track) {
    setMixTracks(prev => [...prev, track]);
    setDiscoverTracks(prev => prev.filter(t => t.id !== track.id));
  }

  // ── Guardar ──────────────────────────────────

  async function saveTracks(tracks, name) {
    if (!tracks.length) return;
    setSaving(true);
    try {
      const playlist = await createSpotifyPlaylist(tracks, name);
      const entry = {
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls?.spotify,
        date: new Date().toISOString(),
        trackCount: tracks.length,
      };
      const nextHistory = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(nextHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      showToast('Playlist guardada en Spotify 🎉');
    } catch (err) {
      showToast(err.message || 'No se pudo guardar la playlist', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Artistas ─────────────────────────────────

  /** Agregar un artista nuevo desde el buscador de la vista Artist */
  function handleAddArtist(artist) {
    if (artists.some(a => a.id === artist.id)) {
      showToast(`${artist.name} ya está en tu lista`, 'error');
      return;
    }
    setArtists(prev => [...prev, artist]);
    setActiveIds(prev => [...prev, artist.id]);
    showToast(`${artist.name} agregado`);
  }

  function handleRemoveArtist(artistId) {
    setArtists(prev => prev.filter(a => a.id !== artistId));
    setActiveIds(prev => prev.filter(id => id !== artistId));
  }

  function handleApplySettings(next) {
    setSongsPerArtist(next.songsPerArtist);
    setTotalSongs(next.totalSongs);
    setVibe(next.vibe);
    setActiveIds(next.activeIds);
    setSettingsOpen(false);

    const pool = artists.filter(a => next.activeIds.includes(a.id));
    setPlaylistName(pool.length ? generatePlaylistName(pool) : '');
    generateMix({ ...next, artists: pool });
    setDiscoverLoading(true);
    getDiscoverTracks(pool, 8)
      .then(setDiscoverTracks)
      .catch(() => setDiscoverTracks([]))
      .finally(() => setDiscoverLoading(false));
  }

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  if (!artists.length) return null;

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="header-logo">Tune<span>Path</span></span>
        <div className="header-right">
          {user?.images?.[0]?.url && (
            <img className="header-avatar" src={user.images[0].url} alt="" />
          )}
          <button className="btn-icon sm" onClick={() => setSettingsOpen(true)} title="Settings">⚙</button>
          <button className="btn-icon sm" onClick={handleLogout} title="Log out">⏻</button>
        </div>
      </header>

      <div className="mode-tabs">
        <button
          className={`mode-tab${mode === 'mix' ? ' active' : ''}`}
          onClick={() => setMode('mix')}
        >
          MIX
        </button>
        <button
          className={`mode-tab${mode === 'artist' ? ' active' : ''}`}
          onClick={() => setMode('artist')}
        >
          ARTIST
        </button>
      </div>

      {mode === 'mix' ? (
        <MixView
          tracks={mixTracks}
          loading={mixLoading}
          playlistName={playlistName}
          onPlaylistNameChange={setPlaylistName}
          onNewMix={handleNewMix}
          onSave={() => saveTracks(mixTracks, playlistName)}
          saving={saving}
          onReplaceTrack={handleReplaceTrack}
          onRemoveTrack={handleRemoveTrack}
          discoverTracks={discoverTracks}
          discoverLoading={discoverLoading}
          onReloadDiscover={loadDiscover}
          onAddDiscoverTrack={handleAddDiscoverTrack}
          history={history}
        />
      ) : (
        <ArtistView
          artists={artists}
          onAddArtist={handleAddArtist}
          onRemoveArtist={handleRemoveArtist}
          onSaveShuffle={saveTracks}
          saving={saving}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          artists={artists}
          activeIds={activeIds}
          songsPerArtist={songsPerArtist}
          totalSongs={totalSongs}
          vibe={vibe}
          onApply={handleApplySettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
