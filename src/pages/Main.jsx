import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';
import {
  getMe,
  buildMix,
  getDiscoverArtists,
  getArtistPoolLight,
  createSpotifyPlaylist,
  generatePlaylistName,
  pickRandom,
} from '../utils/spotify';
import MixView from './MixView';
import ArtistView from './ArtistView';
import SettingsPanel from './SettingsPanel';
import AddArtistsPanel from './AddArtistsPanel';

const HISTORY_KEY = 'ws_history';
const MAX_HISTORY = 10;
const PREFS_KEY = 'ws_mix_prefs';

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
  const [artists] = useState(() => readJSON('ws_artists', []));
  const [activeIds, setActiveIds] = useState(() => artists.map(a => a.id));

  const [mode, setMode] = useState('mix');           // 'mix' | 'artist'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Preferencias del mix: se guardan y sobreviven a recargas, hasta que
  // el usuario las cambie manualmente en Settings.
  const savedPrefs = readJSON(PREFS_KEY, {});
  const [songsPerArtist, setSongsPerArtist] = useState(savedPrefs.songsPerArtist ?? 3);
  const [totalSongs, setTotalSongs] = useState(savedPrefs.totalSongs ?? 20);
  const [vibe, setVibe] = useState(savedPrefs.vibe ?? null);

  const [mixTracks, setMixTracks] = useState([]);
  const [playlistName, setPlaylistName] = useState('');
  const [mixLoading, setMixLoading] = useState(false);

  const [discoverArtists, setDiscoverArtists] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const [history, setHistory] = useState(() => readJSON(HISTORY_KEY, []));

  // Identifica cada generación de mix: si llega la respuesta de una
  // ejecución vieja (StrictMode dispara los efectos dos veces en dev),
  // se descarta en vez de pisar la buena.
  const mixRunRef = useRef(0);
  const discoverRunRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Sin artistas no hay nada que hacer aquí
  useEffect(() => {
    if (!artists.length) navigate('/select', { replace: true });
  }, [artists, navigate]);

  // Datos del usuario
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

  const generateMix = useCallback(async (opts = {}) => {
    const pool = opts.artists || activeArtists;
    if (!pool.length) return;

    const runId = ++mixRunRef.current;
    setMixLoading(true);
    try {
      const tracks = await buildMix(pool, {
        songsPerArtist: opts.songsPerArtist ?? songsPerArtist,
        totalSongs: opts.totalSongs ?? totalSongs,
        vibe: opts.vibe !== undefined ? opts.vibe : vibe,
      });
      // Otra generación arrancó después: esta ya no vale
      if (runId !== mixRunRef.current) return;
      setMixTracks(tracks);
      setPlaylistName(prev => prev || generatePlaylistName(pool));
    } catch (err) {
      if (runId !== mixRunRef.current) return;
      showToast(err.message || 'No se pudo generar el mix', 'error');
    } finally {
      if (runId === mixRunRef.current) setMixLoading(false);
    }
  }, [activeArtists, songsPerArtist, totalSongs, vibe]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDiscover = useCallback(async () => {
    if (!activeArtists.length) return;
    const runId = ++discoverRunRef.current;
    setDiscoverLoading(true);
    try {
      const found = await getDiscoverArtists(activeArtists, 5);
      if (runId !== discoverRunRef.current) return;
      setDiscoverArtists(found);
    } catch {
      if (runId === discoverRunRef.current) setDiscoverArtists([]);
    } finally {
      if (runId === discoverRunRef.current) setDiscoverLoading(false);
    }
  }, [activeArtists]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mix inicial (Discover se carga sólo cuando el usuario lo pide).
  // El ref evita que StrictMode lo dispare dos veces en desarrollo.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!artists.length || didInitRef.current) return;
    didInitRef.current = true;
    generateMix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists.length]);

  async function handleReplaceTrack(index) {
    if (!activeArtists.length) return;
    const randomArtist = pickRandom(activeArtists, 1)[0];
    try {
      const catalog = await getArtistPoolLight(randomArtist);
      const existingIds = new Set(mixTracks.map(t => t.id));
      const candidates = catalog.filter(t => !existingIds.has(t.id));
      if (!candidates.length) return;
      const [newTrack] = pickRandom(candidates, 1);
      setMixTracks(prev => prev.map((t, i) => (i === index ? newTrack : t)));
    } catch {
      showToast('No se pudo reemplazar esa canción', 'error');
    }
  }

  async function handleSaveToSpotify() {
    if (!user || !mixTracks.length) return;

    // La pestaña se abre ANTES del await: si se abre después, el
    // navegador la bloquea por no venir de un clic directo.
    const win = window.open('', '_blank');

    setSaving(true);
    try {
      const playlist = await createSpotifyPlaylist(mixTracks, playlistName);
      const url = playlist.external_urls?.spotify;

      const entry = {
        id: playlist.id,
        name: playlist.name,
        url,
        date: new Date().toISOString(),
        trackCount: mixTracks.length,
      };
      const nextHistory = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(nextHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));

      if (win && url) win.location.href = url;
      else if (win) win.close();

      showToast('Playlist guardada en Spotify 🎉');
    } catch (err) {
      if (win) win.close();
      showToast(err.message || 'No se pudo guardar la playlist', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleApplySettings(next) {
    setSongsPerArtist(next.songsPerArtist);
    setTotalSongs(next.totalSongs);
    setVibe(next.vibe);
    setActiveIds(next.activeIds);

    // Persistimos para que sigan igual la próxima vez que abras la app
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        songsPerArtist: next.songsPerArtist,
        totalSongs: next.totalSongs,
        vibe: next.vibe,
      }));
    } catch { /* storage lleno o bloqueado */ }
    setSettingsOpen(false);
    setPlaylistName('');
    const pool = artists.filter(a => next.activeIds.includes(a.id));
    generateMix({ ...next, artists: pool });
  }

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  if (!artists.length) return null;

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="header-logo">WAVE<span>SET</span></span>
        <div className="header-right">
          {user && (
            <div className="header-user">
              {user.images?.[0]?.url && (
                <img className="header-avatar" src={user.images[0].url} alt="" />
              )}
              <span className="header-username">{user.display_name}</span>
            </div>
          )}
          <button className="btn-icon sm" onClick={() => setSettingsOpen(true)} title="Settings">⚙️</button>
          <button className="btn-icon sm" onClick={handleLogout} title="Cerrar sesión">⏻</button>
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
                {mode === 'artist' && (
          <button
            className="mode-tab tab-add"
            onClick={() => setAddOpen(true)}
            title="Añadir más artistas"
          >
            +
          </button>
        )}
      </div>

      {mode === 'mix' ? (
        <MixView
          tracks={mixTracks}
          loading={mixLoading}
          playlistName={playlistName}
          onPlaylistNameChange={setPlaylistName}
          onRefresh={() => generateMix()}
          onSave={handleSaveToSpotify}
          saving={saving}
          onReplaceTrack={handleReplaceTrack}
          discoverArtists={discoverArtists}
          discoverLoading={discoverLoading}
          onRefreshDiscover={loadDiscover}
          history={history}
        />
      ) : (
        <ArtistView artists={activeArtists.length ? activeArtists : artists} />
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

      {addOpen && (
        <AddArtistsPanel
          artists={artists}
          onClose={() => setAddOpen(false)}
          onApply={next => {
            localStorage.setItem('ws_artists', JSON.stringify(next));
            setAddOpen(false);
            window.location.reload();
          }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
