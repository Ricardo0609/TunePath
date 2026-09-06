import { useEffect, useRef, useState } from 'react';
import { searchArtists, getArtistImage } from '../utils/spotify';

export default function AddArtistsPanel({ artists, onApply, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(artists);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchArtists(query));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function toggleArtist(artist) {
    setSelected(prev =>
      prev.find(a => a.id === artist.id)
        ? prev.filter(a => a.id !== artist.id)
        : [...prev, artist]
    );
  }

  const isSelected = id => selected.some(a => a.id === id);

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="add-panel">
        <div className="settings-inner">
          <div className="settings-header">
            <h2 className="settings-title">Añadir artistas</h2>
            <span className="btn-icon sm" onClick={onClose}>✕</span>
          </div>

          <div className="input-wrap" style={{ marginBottom: 20 }}>
            <input
              className="input"
              placeholder="Buscar un artista…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {selected.length > 0 && (
            <div className="settings-section">
              <p className="settings-section-label">Seleccionados ({selected.length})</p>
              <div className="settings-artist-list">
                {selected.map(a => (
                  <div
                    key={a.id}
                    className="settings-artist-item checked"
                    onClick={() => toggleArtist(a)}
                  >
                    {getArtistImage(a) && <img src={getArtistImage(a)} alt="" />}
                    <span>{a.name}</span>
                   
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && <p className="text-sm text-muted">Buscando…</p>}

          {results.length > 0 && (
            <div className="settings-section">
              <p className="settings-section-label">Resultados</p>
              <div className="settings-artist-list">
                {results.map(artist => (
                  <div
                    key={artist.id}
                    className={`settings-artist-item${isSelected(artist.id) ? ' checked' : ''}`}
                    onClick={() => toggleArtist(artist)}
                  >
                    {getArtistImage(artist) && <img src={getArtistImage(artist)} alt="" />}
                    <span>{artist.name}</span>
                    
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={() => onApply(selected)}
            disabled={!selected.length}
            style={{ flex: 1 }}
          >
            Guardar
          </button>
        </div>
      </div>
    </>
  );
}