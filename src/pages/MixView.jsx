import { getTrackImage } from '../utils/spotify';

function TrackCard({ track, onReplace, onRemove }) {
  return (
    <div className="track-card">
      <div className="track-card-media">
        {getTrackImage(track) ? (
          <img className="track-card-img" src={getTrackImage(track)} alt="" />
        ) : (
          <div className="track-card-img skeleton" />
        )}
        <div className="track-card-actions">
          <button className="track-action" onClick={onReplace} title="Cambiar canción">⟳</button>
          <button className="track-action" onClick={onRemove} title="Quitar del mix">✕</button>
        </div>
      </div>
      <div className="track-card-info">
        <p className="track-card-name">{track.name}</p>
        <p className="track-card-artist">
          {track.album?.name || track.artists?.map(a => a.name).join(', ')}
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="track-card">
      <div className="skeleton track-card-img" />
      <div className="track-card-info">
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line-short" />
      </div>
    </div>
  );
}

export default function MixView({
  tracks,
  loading,
  playlistName,
  onPlaylistNameChange,
  onNewMix,
  onSave,
  saving,
  onReplaceTrack,
  onRemoveTrack,
  discoverTracks,
  discoverLoading,
  onReloadDiscover,
  onAddDiscoverTrack,
  history,
}) {
  return (
    <div className="mix-view">
      {/* Barra fija: nombre + acciones. Se queda visible al hacer scroll */}
      <div className="mix-sticky-bar">
        <input
          className="mix-playlist-name"
          value={playlistName}
          placeholder="Nombre de la playlist"
          onChange={e => onPlaylistNameChange(e.target.value)}
        />
        <div className="mix-actions">
          <button className="btn btn-accent" onClick={onNewMix} disabled={loading}>
            <span>⊞</span> NEW MIX
          </button>
          <button className="btn btn-spotify" onClick={onSave} disabled={saving || !tracks.length}>
            {saving ? <span className="spinner" /> : <span>💿</span>} Save to Spotify
          </button>
          <span className="mix-count">{tracks.length} tracks</span>
        </div>
      </div>

      <div className="track-grid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : tracks.map((track, i) => (
              <TrackCard
                key={`${track.id}-${i}`}
                track={track}
                onReplace={() => onReplaceTrack(i)}
                onRemove={() => onRemoveTrack(i)}
              />
            ))}
      </div>

      {!loading && !tracks.length && (
        <div className="empty-state">
          <span className="empty-state-icon">🎵</span>
          <span className="empty-state-text">No hay canciones todavía</span>
          <span className="empty-state-sub">Dale a NEW MIX o revisa tus artistas en Settings</span>
        </div>
      )}

      {/* ── Discover ── */}
      <div className="discover-section">
        <div className="discover-header">
          <span className="discover-title">⌁ DISCOVER</span>
          <button className="btn-icon sm" onClick={onReloadDiscover} title="Buscar otras">⟳</button>
        </div>

        {discoverLoading && (
          <div className="discover-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="discover-item" key={i}>
                <div className="skeleton discover-item-img" />
                <div className="discover-item-info">
                  <div className="skeleton skeleton-line" />
                  <div className="skeleton skeleton-line-short" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!discoverLoading && !discoverTracks.length && (
          <p className="text-sm text-muted discover-empty">
            No hay sugerencias ahora mismo. Prueba con ⟳ o agrega más artistas.
          </p>
        )}

        {!discoverLoading && discoverTracks.length > 0 && (
          <div className="discover-list">
            {discoverTracks.map(track => (
              <div className="discover-item" key={track.id}>
                {getTrackImage(track) ? (
                  <img className="discover-item-img" src={getTrackImage(track)} alt="" />
                ) : (
                  <div className="discover-item-img skeleton" />
                )}
                <div className="discover-item-info">
                  <p className="discover-item-name">{track.name}</p>
                  <p className="discover-item-artist">
                    {track.artists?.map(a => a.name).join(', ')}
                  </p>
                </div>
                <button
                  className="discover-add-btn"
                  onClick={() => onAddDiscoverTrack(track)}
                  title="Agregar al mix"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Historial ── */}
      {history.length > 0 && (
        <div className="history-section">
          <div className="history-header">
            <span className="history-title">Playlists recientes</span>
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
