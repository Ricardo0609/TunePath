import { getTrackImage, getAlbumImage, getArtistImage, getSpotifyUrl } from '../utils/spotify';

function TrackCard({ track, onReplace }) {
  return (
    <div className="track-card">
      {getTrackImage(track) ? (
        <img className="track-card-img" src={getTrackImage(track)} alt="" />
      ) : (
        <div className="track-card-img skeleton" />
      )}
      <div className="track-card-info">
        <p className="track-card-name">{track.name}</p>
        <p className="track-card-artist">{track.artists?.map(a => a.name).join(', ')}</p>
      </div>
      <div className="track-card-actions">
        <span className="track-card-replace" onClick={onReplace} title="Replace track">⟳</span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="track-card track-card-skeleton">
      <div className="skeleton skeleton-img" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line-short" />
    </div>
  );
}

export default function MixView({
  tracks = [],
  loading,
  playlistName,
  onPlaylistNameChange,
  onRefresh,
  onSave,
  saving,
  onReplaceTrack,
  discoverArtists = [],
  discoverLoading,
  onRefreshDiscover,
  history = [],
}) {
  return (
    <div className="mix-view">
      <div className="mix-top-bar">
        <input
          className="mix-playlist-name input"
          style={{ background: 'transparent', border: 'none', padding: 0 }}
          value={playlistName}
          onChange={e => onPlaylistNameChange(e.target.value)}
        />
      </div>

      <div className="mix-action-bar mix-action-bar-top">
        <button
          className="btn btn-accent btn-pill"
          onClick={onRefresh}
          disabled={loading}
        >
          <span className="btn-emoji">🎲</span> NEW MIX
        </button>

        <button
          className="btn btn-spotify btn-pill"
          onClick={onSave}
          disabled={saving || !tracks.length}
        >
          {saving ? <span className="spinner" /> : <span className="btn-emoji">💿</span>}
          {saving ? ' Guardando…' : ' Save to Spotify'}
        </button>

        <span className="spacer" />
        <span className="text-sm text-muted">
          {tracks.length} track{tracks.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="track-grid stagger">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
          : tracks.map((track, i) => (
              <TrackCard key={track.id} track={track} onReplace={() => onReplaceTrack(i)} />
            ))}
      </div>

      {!loading && !tracks.length && (
        <div className="empty-state">
          <span className="empty-state-icon">🎵</span>
          <span className="empty-state-text">No tracks yet</span>
          <span className="empty-state-sub">Try refreshing or picking a few artists in Settings</span>
        </div>
      )}

      <div className="discover-section">
        <div className="discover-header">
          <span className="discover-title">🔭 <span>Discover</span></span>
          <button
            className="btn btn-ghost btn-pill"
            onClick={onRefreshDiscover}
            disabled={discoverLoading}
          >
            {discoverLoading ? <span className="spinner" /> : '🔀'} Descubrir bandas
          </button>
        </div>

        {discoverLoading && (
          <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
            Buscando bandas emergentes en tus géneros… la primera vez tarda un poco más.
          </p>
        )}

        {discoverLoading && (
          <div className="albums-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="album-card" key={i}>
                <div className="skeleton skeleton-img" />
              </div>
            ))}
          </div>
        )}

        {!discoverLoading && !discoverArtists.length && (
          <p className="text-sm text-muted">
            Toca “Descubrir bandas” para ver artistas emergentes de tus géneros.
          </p>
        )}

        {!discoverLoading && discoverArtists.length > 0 && (
          <div className="albums-grid">
            {discoverArtists.map(({ artist, album }) => (
              <a
                className="album-card"
                key={artist.id}
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
                  <span className="album-card-type">{artist.name}</span>
                  <p className="album-card-name">{album.name}</p>
                  <p className="album-card-meta">
                    {album.release_date?.slice(0, 4)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="history-section">
          <div className="history-header">
            <span className="history-title">Recent playlists</span>
          </div>
          <div className="history-list">
            {history.map(item => (
              <div className="history-item" key={item.id}>
                <span className="history-item-icon">📜</span>
                <div className="history-item-info">
                  <p className="history-item-name">{item.name}</p>
                  <p className="history-item-date">
                    {new Date(item.date).toLocaleDateString()} · {item.trackCount} tracks
                  </p>
                </div>
                {item.url && (
                  <a className="history-item-link" href={item.url} target="_blank" rel="noreferrer">↗</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
