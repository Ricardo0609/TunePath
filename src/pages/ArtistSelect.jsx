import { useEffect, useRef, useState } from 'react';
import {
  getArtistAlbums,
  getArtistShuffle,
  searchArtists,
  getArtistImage,
  getAlbumImage,
  getTrackImage,
  getSpotifyUrl,
} from '../utils/spotify';

export default function ArtistView({ artists, onAddArtist, onRemoveArtist, onSaveShuffle, saving }) {
  const [activeId, setActiveId] = useState(artists[0]?.id || null);
  const [view, setView] = useState('chronological'); // 'chronological' | 'shuffle'

  const [albums, setAlbums] = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);

  const [shuffleTracks, setShuffleTracks] = useState([]);
  const [shuffleLoading, setShuffleLoading] = useState(false);

  // Buscador para agregar bandas
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const activeArtist = artists.find(a => a.id === activeId) || artists[0];

  // Si el artista activo se elimina, saltamos al primero disponible
  useEffect(() => {
    if (!artists.some(a => a.id === activeId)) {
      setActiveId(artists[0]?.id || null);
    }
  }, [artists, activeId]);

  // Cargar álbumes (cronológico)
  useEffect(() => {
    if (!activeArtist) return;
    setAlbumsLoading(true);
    getArtistAlbums(activeArtist.id)
      .then(setAlbums)
      .catch(() => setAlbums([]))
      .finally(() => setAlbumsLoading(false));
  }, [activeArtist?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar shuffle solo cuando se entra a esa vista
  useEffect(() => {
    if (!activeArtist || view !== 'shuffle') return;
    setShuffleLoading(true);
    getArtistShuffle(activeArtist, 25)
      .then(setShuffleTracks)
      .catch(() => setShuffleTracks([]))
      .finally(() => setShuffleLoading(false));
  }, [activeArtist?.id, view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Búsqueda de artistas con debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchArtists(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handlePick(artist) {
    onAddArtist(artist);
    setQuery('');
    setResults([]);
    setSearchOpen(false);
    setActiveId(artist.id);
  }

  function reshuffle() {
    if (!activeArtist) return;
    setShuffleLoading(true);
    getArtistShuffle(activeArtist, 25)
      .then(setShuffleTracks)
      .catch(() => setShuffleTracks([]))
      .finally(() => setShuffleLoading(false));
  }

  return (
    <div className="artist-view">
      {/* ── Selector de bandas + botón de agregar ── */}
      <div className="artist-selector">
        {artists.map(artist => (
          <div
            key={artist.id}
            className={`artist-pill${artist.id === activeArtist?.id ? ' active' : ''}`}
            onClick={() => setActiveId(artist.id)}
          >
            {getArtistImage(artist) && <img src={getArtistImage(artist)} alt="" />}
            <span>{artist.name}</span>
            {artists.length > 1 && (
              <span
                className="artist-pill-remove"
                title="Quitar"
                onClick={e => {
                  e.stopPropagation();
                  onRemoveArtist(artist.id);
                }}
              >
                ✕
              </span>
            )}
          </div>
        ))}
        <button
          className={`artist-pill artist-pill-add${searchOpen ? ' active' : ''}`}
          onClick={() => setSearchOpen(o => !o)}
        >
          <span>＋</span>
        </button>
      </div>

      {/* ── Buscador ── */}
      {searchOpen && (
        <div className="artist-search fade-in">
          <input
            className="input"
            placeholder="Buscar banda o artista…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {searching && <p className="text-sm text-muted">Buscando…</p>}
          {results.length > 0 && (
            <div className="artist-search-results">
              {results.map(a => {
                const already = artists.some(x => x.id === a.id);
                return (
                  <div
                    key={a.id}
                    className={`artist-search-item${already ? ' disabled' : ''}`}
                    onClick={() => !already && handlePick(a)}
                  >
                    {getArtistImage(a) ? (
                      <img src={getArtistImage(a)} alt="" />
                    ) : (
                      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                    )}
                    <div className="artist-search-info">
                      <p className="artist-search-name">{a.name}</p>
                      {a.genres?.[0] && <p className="artist-search-genre">{a.genres[0]}</p>}
                    </div>
                    <span className="artist-search-add">{already ? '✓' : '＋'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeArtist && (
        <>
          <h2 className="artist-content-title">{activeArtist.name}</h2>

          <div className="artist-controls">
            <button
              className={`toggle-btn${view === 'chronological' ? ' active' : ''}`}
              onClick={() => setView('chronological')}
            >
              CHRONOLOGICAL
            </button>
            <button
              className={`toggle-btn${view === 'shuffle' ? ' active' : ''}`}
              onClick={() => setView('shuffle')}
            >
              SHUFFLE
            </button>
          </div>

          {/* ── Vista cronológica: álbumes con link ── */}
          {view === 'chronological' && (
            <>
              {albumsLoading ? (
                <div className="albums-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="album-card" key={i}>
                      <div className="skeleton album-card-img" />
                    </div>
                  ))}
                </div>
              ) : albums.length ? (
                <div className="albums-grid">
                  {albums.map(album => (
                    <a
                      className="album-card"
                      key={album.id}
                      href={getSpotifyUrl('album', album.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {getAlbumImage(album) ? (
                        <img className="album-card-img" src={getAlbumImage(album)} alt="" />
                      ) : (
                        <div className="album-card-img skeleton" />
                      )}
                      <div className="album-card-overlay">
                        <span className="album-play-btn">▶</span>
                      </div>
                      <div className="album-card-info">
                        <p className="album-card-name">{album.name}</p>
                        <p className="album-card-meta">{album.release_date?.slice(0, 4)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-icon">💿</span>
                  <span className="empty-state-text">No se encontraron álbumes</span>
                </div>
              )}
            </>
          )}

          {/* ── Vista shuffle: canciones del artista ── */}
          {view === 'shuffle' && (
            <>
              <div className="mix-sticky-bar artist-shuffle-bar">
                <div className="mix-actions">
                  <button className="btn btn-accent" onClick={reshuffle} disabled={shuffleLoading}>
                    <span>⊞</span> RESHUFFLE
                  </button>
                  <button
                    className="btn btn-spotify"
                    disabled={saving || !shuffleTracks.length}
                    onClick={() => onSaveShuffle(shuffleTracks, `${activeArtist.name} Shuffle`)}
                  >
                    {saving ? <span className="spinner" /> : <span>💿</span>} Save to Spotify
                  </button>
                  <span className="mix-count">{shuffleTracks.length} tracks</span>
                </div>
              </div>

              {shuffleLoading ? (
                <div className="track-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="track-card" key={i}>
                      <div className="skeleton track-card-img" />
                      <div className="track-card-info">
                        <div className="skeleton skeleton-line" />
                        <div className="skeleton skeleton-line-short" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : shuffleTracks.length ? (
                <div className="track-grid">
                  {shuffleTracks.map((track, i) => (
                    <a
                      className="track-card"
                      key={`${track.id}-${i}`}
                      href={getSpotifyUrl('track', track.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="track-card-media">
                        {getTrackImage(track) ? (
                          <img className="track-card-img" src={getTrackImage(track)} alt="" />
                        ) : (
                          <div className="track-card-img skeleton" />
                        )}
                      </div>
                      <div className="track-card-info">
                        <p className="track-card-name">{track.name}</p>
                        <p className="track-card-artist">{track.album?.name}</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-icon">🎲</span>
                  <span className="empty-state-text">No se pudieron cargar canciones</span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
