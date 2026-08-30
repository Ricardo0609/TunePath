import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';
import {
  getMe,
  buildMix,
  getDiscoverTracks,
  getArtistTracks,
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
  const [artists] = useState(() => readJSON('ws_artists', []));
  const [activeIds, setActiveIds] = useState(() => artists.map(a => a.id));

  const [mode, setMode] = useState('mix'); // 'mix' | 'artist'
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [songsPerArtist, setSongsPerArtist] = useState(3);
  const [totalSongs, setTotalSongs] = useState(20);
  const [vibe, setVibe] = useState(null);

  const [mixTracks, setMixTracks] = useState([]);
  const [playlistName, setPlaylistName] = useState('');
  const [mixLoading, setMixLoading] = useState(false);

  const [discoverTracks, setDiscoverTracks] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const [history, setHistory] = useState(() => readJSON(HISTORY_KEY, []));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Redirect if there's no artist pool yet
  useEffect(() => {
    if (!artists.length) {
      navigate('/select', { replace: true });
    }
  }, [artists, navigate]);

  // Load the current user once
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
    setMixLoading(true);
    try {
      const tracks = await buildMix(pool, {
        songsPerArtist: opts.songsPerArtist ?? songsPerArtist,
        totalSongs: opts.totalSongs ?? totalSongs,
        vibe: opts.vibe !== undefined ? opts.vibe : vibe,
      });
      setMixTracks(tracks);
      setPlaylistName(prev => prev || generatePlaylistName(pool));
    } catch (err) {
      showToast(err.message || 'Could not build the mix', 'error');
    } finally {
      setMixLoading(false);
    }
  }, [activeArtists, songsPerArtist, totalSongs, vibe]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDiscover = useCallback(async () => {
    if (!activeArtists.length) return;
    setDiscoverLoading(true);
    try {
      const tracks = await getDiscoverTracks(activeArtists, 8);
      setDiscoverTracks(tracks);
    } catch {
      setDiscoverTracks([]);
    } finally {
      setDiscoverLoading(false);
    }
  }, [activeArtists]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial mix + discover once artists are ready
  useEffect(() => {
    if (artists.length) {
      generateMix();
      loadDiscover();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists.length]);

  async function handleReplaceTrack(index) {
    if (!activeArtists.length) return;
    const randomArtist = pickRandom(activeArtists, 1)[0];
    try {
      const tracks = await getArtistTracks(randomArtist, { vibeId: vibe });
      const existingIds = new Set(mixTracks.map(t => t.id));
      const candidates = tracks.filter(t => !existingIds.has(t.id));
      if (!candidates.length) return;
      const [newTrack] = pickRandom(candidates, 1);
      setMixTracks(prev => prev.map((t, i) => (i === index ? newTrack : t)));
    } catch {
      showToast('Could not replace that track', 'error');
    }
  }

  function handleAddDiscoverTrack(track) {
    setMixTracks(prev => [...prev, track]);
    setDiscoverTracks(prev => prev.filter(t => t.id !== track.id));
  }

  async function handleSaveToSpotify() {
    if (!user || !mixTracks.length) return;
    setSaving(true);
    try {
      const playlist = await createSpotifyPlaylist(mixTracks, playlistName);
      const entry = {
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls?.spotify,
        date: new Date().toISOString(),
        trackCount: mixTracks.length,
      };
      const nextHistory = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(nextHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      showToast('Playlist saved to Spotify 🎉');
    } catch (err) {
      showToast(err.message || 'Could not save the playlist', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleApplySettings(next) {
    setSongsPerArtist(next.songsPerArtist);
    setTotalSongs(next.totalSongs);
    setVibe(next.vibe);
    setActiveIds(next.activeIds);
    setSettingsOpen(false);
    setPlaylistName('');
    const pool = artists.filter(a => next.activeIds.includes(a.id));
    generateMix({ ...next, artists: pool });
    loadDiscover();
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
              {user.images?.[0]?.url && <img className="header-avatar" src={user.images[0].url} alt="" />}
              <span className="header-username">{user.display_name}</span>
            </div>
          )}
          <button className="btn-icon sm" onClick={() => setSettingsOpen(true)} title="Settings">⚙️</button>
          <button className="btn-icon sm" onClick={handleLogout} title="Log out">⏻</button>
        </div>
      </header>

      <div className="mode-tabs">
        <button className={`mode-tab${mode === 'mix' ? ' active' : ''}`} onClick={() => setMode('mix')}>Mix</button>
        <button className={`mode-tab${mode === 'artist' ? ' active' : ''}`} onClick={() => setMode('artist')}>Artist</button>
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
          discoverTracks={discoverTracks}
          discoverLoading={discoverLoading}
          onAddDiscoverTrack={handleAddDiscoverTrack}
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

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
