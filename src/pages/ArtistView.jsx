import { useEffect, useState } from 'react';
import { getArtistAlbums, getArtistImage, getAlbumImage, getSpotifyUrl } from '../utils/spotify';

export default function ArtistView({ artists }) {
  const [activeId, setActiveId] = useState(artists[0]?.id || null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    getArtistAlbums(activeId)
      .then(setAlbums)
      .catch(() => setAlbums([]))
      .finally(() => setLoading(false));
  }, [activeId]);

  const activeArtist = artists.find(a => a.id === activeId);
  const displayedAlbums = shuffle ? [...albums].sort(() => Math.random() - 0.5) : albums;

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

          {loading ? (
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

          {!loading && !albums.length && (
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
    </div>
  );
}
