import { useState } from 'react';
import { getArtistImage, getVibeList } from '../utils/spotify';

const VIBES = getVibeList();

export default function SettingsPanel({
  artists,
  activeIds,
  songsPerArtist,
  totalSongs,
  vibe,
  onApply,
  onClose,
}) {
  const [localSongsPerArtist, setLocalSongsPerArtist] = useState(songsPerArtist);
  const [localTotalSongs, setLocalTotalSongs] = useState(totalSongs);
  const [localVibe, setLocalVibe] = useState(vibe);
  const [localActiveIds, setLocalActiveIds] = useState(activeIds);

  function toggleArtist(id) {
    setLocalActiveIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleApply() {
    onApply({
      songsPerArtist: localSongsPerArtist,
      totalSongs: localTotalSongs,
      vibe: localVibe,
      activeIds: localActiveIds.length ? localActiveIds : artists.map(a => a.id),
    });
  }

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel fade-in">
        <div className="settings-inner">
          <div className="settings-header">
            <h2 className="settings-title">Settings</h2>
            <span className="btn-icon sm" onClick={onClose}>✕</span>
          </div>

          <div className="settings-section">
            <p className="settings-section-label">Mix size</p>

            <div className="settings-row">
              <span className="settings-row-label">Songs per artist</span>
              <span className="settings-row-value">{localSongsPerArtist}</span>
            </div>
            <div className="settings-range-wrap">
              <input
                type="range"
                min="1"
                max="8"
                value={localSongsPerArtist}
                onChange={e => setLocalSongsPerArtist(Number(e.target.value))}
              />
            </div>

            <div className="settings-row" style={{ marginTop: 20 }}>
              <span className="settings-row-label">Total songs</span>
              <span className="settings-row-value">{localTotalSongs}</span>
            </div>
            <div className="settings-range-wrap">
              <input
                type="range"
                min="5"
                max="50"
                value={localTotalSongs}
                onChange={e => setLocalTotalSongs(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="settings-section">
            <p className="settings-section-label">Vibe</p>
            <div className="settings-vibe-grid">
              <button
                className={`vibe-btn${!localVibe ? ' active' : ''}`}
                onClick={() => setLocalVibe(null)}
              >
                <span>🎲</span>
                <span>Balanced</span>
              </button>
              {VIBES.map(v => (
                <button
                  key={v.id}
                  className={`vibe-btn${localVibe === v.id ? ' active' : ''}`}
                  onClick={() => setLocalVibe(v.id)}
                >
                  <span>{v.icon}</span>
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <p className="settings-section-label">Artists in this mix</p>
            <div className="settings-artist-list">
              {artists.map(artist => {
                const checked = localActiveIds.includes(artist.id);
                return (
                  <div
                    key={artist.id}
                    className={`settings-artist-item${checked ? ' checked' : ''}`}
                    onClick={() => toggleArtist(artist.id)}
                  >
                    {getArtistImage(artist) && <img src={getArtistImage(artist)} alt="" />}
                    <span>{artist.name}</span>
                    <span className="settings-artist-check">{checked ? '✓' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-accent" onClick={handleApply} style={{ flex: 1 }}>Apply</button>
        </div>
      </div>
    </>
  );
}
