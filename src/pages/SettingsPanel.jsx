import { useState } from 'react';
import { getArtistImage, getVibeList } from '../utils/spotify';

const VIBES = getVibeList();

const PER_ARTIST_PRESETS = [1, 3, 5];
const TOTAL_PRESETS = [10, 20, 30];

/** Fila de presets + opción Custom con input numérico */
function PresetRow({ label, value, presets, min, max, onChange }) {
  const isPreset = presets.includes(value);
  const [custom, setCustom] = useState(!isPreset);

  function handleCustomChange(e) {
    const raw = e.target.value;
    if (raw === '') {
      onChange('');
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    onChange(Math.max(min, Math.min(max, n)));
  }

  return (
    <div className="settings-preset-block">
      <p className="settings-row-label">{label}</p>
      <div className="preset-row">
        {presets.map(p => (
          <button
            key={p}
            className={`preset-btn${!custom && value === p ? ' active' : ''}`}
            onClick={() => { setCustom(false); onChange(p); }}
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
      </div>

      {custom && (
        <input
          className="preset-input"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={handleCustomChange}
          placeholder={`${min}–${max}`}
          autoFocus
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
  const [localVibe, setLocalVibe] = useState(vibe);
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
            <span className="btn-icon sm" onClick={onClose}>✕</span>
          </div>

          <div className="settings-section">
            <p className="settings-section-label">Mix size</p>

            <PresetRow
              label="Songs per artist"
              value={localSongsPerArtist}
              presets={PER_ARTIST_PRESETS}
              min={1}
              max={20}
              onChange={setLocalSongsPerArtist}
            />

            <PresetRow
              label="Total songs"
              value={localTotalSongs}
              presets={TOTAL_PRESETS}
              min={5}
              max={100}
              onChange={setLocalTotalSongs}
            />
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
