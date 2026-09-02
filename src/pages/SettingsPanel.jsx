import { useState } from 'react';
import { getArtistImage, getVibeList } from '../utils/spotify';

const VIBES = getVibeList();
const SONGS_PRESETS = [1, 3, 5];
const TOTAL_PRESETS = [10, 20, 30];

/** Grupo de presets + Custom (input numérico que aparece al elegirlo) */
function PresetGroup({ presets, value, min, max, onChange }) {
  const isPreset = presets.includes(value);
  const [custom, setCustom] = useState(!isPreset);

  function handleCustomInput(raw) {
    const n = Number(raw);
    if (!raw) return onChange('');
    if (Number.isNaN(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  }

  return (
    <div className="preset-group">
      {presets.map(p => (
        <button
          key={p}
          className={`preset-btn${!custom && value === p ? ' active' : ''}`}
          onClick={() => {
            setCustom(false);
            onChange(p);
          }}
        >
          {p}
        </button>
      ))}
      <button
        className={`preset-btn preset-btn-custom${custom ? ' active' : ''}`}
        onClick={() => setCustom(true)}
      >
        Custom
      </button>
      {custom && (
        <input
          className="preset-input"
          type="number"
          min={min}
          max={max}
          value={value}
          autoFocus
          onChange={e => handleCustomInput(e.target.value)}
        />
      )}
    </div>
  );
}

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
  const [localVibe, setLocalVibe] = useState(vibe || 'balanced');
  const [localActiveIds, setLocalActiveIds] = useState(activeIds);

  function toggleArtist(id) {
    setLocalActiveIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleApply() {
    onApply({
      songsPerArtist: Number(localSongsPerArtist) || 3,
      totalSongs: Number(localTotalSongs) || 20,
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
            <button className="btn-icon sm" onClick={onClose}>✕</button>
          </div>

          <div className="settings-section">
            <p className="settings-section-label">MIX SIZE</p>

            <p className="settings-field-label">Songs per artist</p>
            <PresetGroup
              presets={SONGS_PRESETS}
              value={localSongsPerArtist}
              min={1}
              max={20}
              onChange={setLocalSongsPerArtist}
            />

            <p className="settings-field-label">Total songs</p>
            <PresetGroup
              presets={TOTAL_PRESETS}
              value={localTotalSongs}
              min={5}
              max={100}
              onChange={setLocalTotalSongs}
            />
          </div>

          <div className="settings-section">
            <p className="settings-section-label">VIBE</p>
            <div className="settings-vibe-grid">
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
            <p className="settings-section-label">ARTIST IN THIS MIX</p>
            <div className="settings-artist-list">
              {artists.map(artist => {
                const checked = localActiveIds.includes(artist.id);
                return (
                  <button
                    key={artist.id}
                    type="button"
                    className={`settings-artist-item${checked ? ' checked' : ''}`}
                    onClick={() => toggleArtist(artist.id)}
                  >
                    {getArtistImage(artist) && <img src={getArtistImage(artist)} alt="" />}
                    <span>{artist.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" onClick={handleApply}>APPLY</button>
        </div>
      </div>
    </>
  );
}
