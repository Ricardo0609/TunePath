import { getTrackImage } from '../utils/spotify';

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
  tracks,
  loading,
  playlistName,
  onPlaylistNameChange,
  onRefresh,
  onSave,
  saving,
  onReplaceTrack,
  discoverTracks,
  discoverLoading,
  onAddDiscoverTrack,
  history,
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
        <div className="mix-top-bar-right">
          <button className="btn-icon" onClick={onRefresh} disabled={loading} title="Refresh mix">🔄</button>
        </div>
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

      <div className="mix-action-bar">
        <button className="btn btn-spotify" onClick={onSave} disabled={saving || !tracks.length}>
          {saving ? <span className="spinner" /> : '💿'} Save to Spotify
        </button>
        <span className="spacer" />
        <span className="text-sm text-muted">{tracks.length} track{tracks.length === 1 ? '' : 's'}</span>
      </div>

      <div className="discover-section">
        <div className="discover-header">
          <span className="discover-title">🔭 <span>Discover</span></span>
        </div>
        <div className="discover-list">
          {discoverLoading && <p className="text-sm text-muted">Finding new tracks…</p>}
          {!discoverLoading && !discoverTracks.length && (
            <p className="text-sm text-muted">No new suggestions right now — try different artists.</p>
          )}
          {discoverTracks.map(track => (
            <div className="discover-item" key={track.id}>
              {getTrackImage(track) ? (
                <img className="discover-item-img" src={getTrackImage(track)} alt="" />
              ) : (
                <div className="discover-item-img skeleton" />
              )}
              <div className="discover-item-info">
                <p className="discover-item-name">{track.name}</p>
                <p className="discover-item-artist">{track.artists?.map(a => a.name).join(', ')}</p>
              </div>
              <span className="discover-add-btn" onClick={() => onAddDiscoverTrack(track)} title="Add to mix">+</span>
            </div>
          ))}
        </div>
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
