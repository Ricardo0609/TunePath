import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchArtists, getArtistImage } from '../utils/spotify';

export default function ArtistSelect() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ws_artists') || '[]');
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchArtists(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function toggleArtist(artist) {
    setSelected(prev => {
      const exists = prev.find(a => a.id === artist.id);
      return exists ? prev.filter(a => a.id !== artist.id) : [...prev, artist];
    });
  }

  function handleContinue() {
    localStorage.setItem('ws_artists', JSON.stringify(selected));
    navigate('/app');
  }

  const isSelected = id => selected.some(a => a.id === id);

  return (
    <div className="select-page">
      <div className="select-header">
        <h1 className="select-title">Pick your <span>artists</span></h1>
        <p className="select-subtitle">Search and select the artists you want Waveset to mix from. You can change this later.</p>
      </div>

      <div className="select-search input-wrap">
        <input
          className="input has-icon"
          placeholder="Search an artist…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {selected.length > 0 && (
        <div className="select-selected">
          <p className="select-results-label">Selected ({selected.length})</p>
          <div className="select-selected-chips">
            {selected.map(a => (
              <span className="chip" key={a.id}>
                {getArtistImage(a) && <img src={getArtistImage(a)} alt="" />}
                {a.name}
                <span className="chip-remove" onClick={() => toggleArtist(a)}>✕</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="select-results-label">Searching…</p>}

      {results.length > 0 && (
        <>
          <p className="select-results-label">Results</p>
          <div className="artist-grid fade-in">
            {results.map(artist => (
              <div
                key={artist.id}
                className={`artist-card${isSelected(artist.id) ? ' selected' : ''}`}
                onClick={() => toggleArtist(artist)}
              >
                {getArtistImage(artist) ? (
                  <img className="artist-card-img" src={getArtistImage(artist)} alt="" />
                ) : (
                  <div className="artist-card-img skeleton" />
                )}
                <span className="artist-card-name">{artist.name}</span>
                {artist.genres?.[0] && <span className="artist-card-genre">{artist.genres[0]}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !results.length && !query && (
        <div className="empty-state">
          <span className="empty-state-icon">🎧</span>
          <span className="empty-state-text">Start typing to find artists</span>
          <span className="empty-state-sub">Try an artist name you already love</span>
        </div>
      )}

      <div className="select-footer">
        <div className="select-footer-inner">
          <span className="select-count">
            <strong>{selected.length}</strong> artist{selected.length === 1 ? '' : 's'} selected
          </span>
          <button className="btn btn-accent" disabled={!selected.length} onClick={handleContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
