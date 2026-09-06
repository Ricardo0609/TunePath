import { useEffect, useState } from 'react';
import {
  getArtistAlbums,
  getArtistPool,
  getArtistImage,
  getAlbumImage,
  getTrackImage,
  getSpotifyUrl,
  pickDiverse,
} from '../utils/spotify';

const MIX_SIZE = 15;

export default function ArtistView({ artists }) {
  const [activeId, setActiveId] = useState(artists[0]?.id || null);
  const [shuffle, setShuffle] = useState(false);

  const [albums, setAlbums] = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);

  const [pool, setPool] = useState([]);
  const [mix, setMix] = useState([]);
  const [mixLoading, setMixLoading] = useState(false);

  const activeArtist = artists.find(a => a.id === activeId);

  useEffect(() => {
    setAlbums([]);
    setPool([]);
    setMix([]);
  }, [activeId]);

  useEffect(() => {
    if (!activeId || shuffle) return;
    let cancelled = false;
    setAlbumsLoading(true);
    getArtistAlbums(activeId)
      .then(data => { if (!cancelled) setAlbums(data); })
      .catch(() => { if (!cancelled) setAlbums([]); })
      .finally(() => { if (!cancelled) setAlbumsLoading(false); });
    return () => { cancelled = true; };
  }, [activeId, shuffle]);

  useEffect(() => {
    if (!activeArtist || !shuffle) return;
    let cancelled = false;
    setMixLoading(true);
    getArtistPool(activeArtist, { minTracks: MIX_SIZE })
      .then(unique => {
        if (cancelled) return;
        setPool(unique);
        setMix(pickDiverse(unique, Math.min(MIX_SIZE, unique.length)));
      })
      .catch(() => { if (!cancelled) setPool([]); })
      .finally(() => { if (!cancelled) setMixLoading(false); });
    return () => { cancelled = true; };
  }, [activeArtist?.id, shuffle]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewShuffle() {
    if (!pool.length) return;
    setMix(pickDiverse(pool, Math.min(MIX_SIZE, pool.length)));
  }

  const displayedAlbums = albums;

  return (
    <div className="artist-view">
      <div className="artist-selector">
        {artists.map(artist => (
          <div
            key={artist.id}
            className={`artist-pill${artist.id === activeId ? ' active' : ''}`}
            onClick={() => setActiveId(artist.id)}
          >
            {getArtistImage(artist) && <img src={getArtistImage(artist)} alt="" />}
            <span>{artist.name}</span>
          </div>
        ))}
      </div>

      {activeArtist && (
        <>
          <div className="artist-content-header">
            <h2 className="artist-content-title">{activeArtist.name}</h2>
            <div className="artist-controls">
              <button
                className={`toggle-btn${!shuffle ? ' active' : ''}`}
                onClick={() => setShuffle(false)}
              >
                Chronological
              </button>
              <button
                className={`toggle-btn${shuffle ? ' active' : ''}`}
                onClick={() => setShuffle(true)}
              >
                Shuffle
              </button>
            </div>
          </div>

          {shuffle ? (
            <>
              <div className="track-grid stagger">
                {mixLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <div className="track-card track-card-skeleton" key={i}>
                        <div className="skeleton skeleton-img" />
                        <div className="skeleton skeleton-line" />
                        <div className="skeleton skeleton-line-short" />
                      </div>
                    ))
                  : mix.map(track => (
                      <a
                        className="track-card"
                        key={track.id}
                        href={getSpotifyUrl('track', track.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {getTrackImage(track) ? (
                          <img className="track-card-img" src={getTrackImage(track)} alt="" />
                        ) : (
                          <div className="track-card-img skeleton" />
                        )}
                        <div className="track-card-info">
                          <p className="track-card-name">{track.name}</p>
                          <p className="track-card-artist">{track.album?.name}</p>
                        </div>
                      </a>
                    ))}
              </div>

              {!mixLoading && !mix.length && (
                <div className="empty-state">
                  <span className="empty-state-icon">🎵</span>
                  <span className="empty-state-text">No tracks found</span>
                  <span className="empty-state-sub">Try another artist</span>
                </div>
              )}

              <div className="mix-action-bar">
                <a
                  className="btn btn-spotify"
                  href={
                    mix[0]
                      ? getSpotifyUrl('track', mix[0].id)
                      : getSpotifyUrl('artist', activeArtist.id)
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  ▶ Play on Spotify
                </a>
                <button
                  className="btn btn-ghost"
                  onClick={handleNewShuffle}
                  disabled={mixLoading || pool.length < 2}
                >
                  🔀 New Shuffle
                </button>
                <span className="spacer" />
                <span className="text-sm text-muted">
                  {mix.length} track{mix.length === 1 ? '' : 's'}
                </span>
              </div>
            </>
          ) : (
            <>
              {albumsLoading ? (
                <div className="albums-grid">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div className="album-card" key={i}>
                      <div className="skeleton skeleton-img" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="albums-grid">
                  {displayedAlbums.map(album => (
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
                        <span className="album-card-type">{album.album_type}</span>
                        <p className="album-card-name">{album.name}</p>
                        <p className="album-card-meta">{album.release_date?.slice(0, 4)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {!albumsLoading && !albums.length && (
                <div className="empty-state">
                  <span className="empty-state-icon">💿</span>
                  <span className="empty-state-text">No releases found</span>
                </div>
              )}

              <div className="artist-open-bar">
                <a
                  className="btn btn-spotify"
                  href={getSpotifyUrl('artist', activeArtist.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on Spotify
                </a>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
