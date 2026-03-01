import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Navbar } from '../components/Navbar';
import { getBoard, deletePhoto, type Board, type Photo } from '../services/api';

import { LoadingScreen } from '../components/LoadingScreen';
import { UploadModal } from '../components/UploadModal';
import { PhotoDetailModal } from '../components/PhotoDetailModal';
import { DashboardMapView } from '../components/DashboardMapView';

export function DashboardPage() {
  const { user, tokens, loading } = useAuth();
  const navigate = useNavigate();

  const [board, setBoard] = useState<Board | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  useEffect(() => {
    if (!loading && !tokens) navigate('/');
  }, [loading, tokens, navigate]);

  useEffect(() => {
    if (!tokens || !user?.board_id) return;
    getBoard(user.board_id, tokens.access_token)
      .then((res) => { setBoard(res.board); setPhotos(res.photos); })
      .catch(() => { })
      .finally(() => setBoardLoading(false));
  }, [tokens, user?.board_id]);

  const refreshBoard = async () => {
    if (!tokens || !user?.board_id) return;
    const res = await getBoard(user.board_id, tokens.access_token);
    setBoard(res.board);
    setPhotos(res.photos);
  };

  const handleDelete = async (photoId: string) => {
    if (!tokens || !user?.board_id) return;
    setDeletingId(photoId);
    try {
      await deletePhoto(user.board_id, photoId, tokens.access_token);
      setPhotos(p => p.filter(ph => ph.photo_id !== photoId));
      setBoard(b => b ? { ...b, photo_count: b.photo_count - 1 } : b);
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  // Derived stats
  const uniqueLocations = new Set(photos.map(p => p.location).filter(Boolean)).size;
  const dates = photos.map(p => p.date).filter(Boolean).sort();
  const earliestYear = dates.length ? dates[0]!.slice(0, 4) : null;
  const latestYear = dates.length ? dates[dates.length - 1]!.slice(0, 4) : null;
  const dateSpan = earliestYear && latestYear && earliestYear !== latestYear
    ? `${earliestYear} – ${latestYear}`
    : earliestYear ?? null;

  if (loading || boardLoading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'var(--font-main)' }}>
      <style>{`
        @keyframes dashSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .photo-card {
          position: relative;
          overflow: hidden;
          border-radius: 1rem;
          cursor: pointer;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          animation: cardIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1),
                      box-shadow 0.25s ease,
                      border-color 0.25s ease;
        }
        .photo-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 20px 50px rgba(0,0,0,0.18);
          border-color: var(--accent);
          z-index: 2;
        }
        .photo-card .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .photo-card:hover .card-img {
          transform: scale(1.06);
        }
        .photo-card .card-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .photo-card:hover .card-overlay {
          opacity: 1;
        }
        .photo-card .card-meta {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 2rem 0.85rem 0.75rem;
          transform: translateY(6px);
          opacity: 0;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .photo-card:hover .card-meta {
          transform: translateY(0);
          opacity: 1;
        }
        .photo-card .card-title-always {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 1.75rem 0.85rem 0.65rem;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
          transition: opacity 0.25s ease;
        }
        .photo-card:hover .card-title-always {
          opacity: 0;
        }
        .photo-card .card-delete-btn {
          position: absolute; top: 0.6rem; right: 0.6rem;
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(220,38,38,0.92);
          border: none; color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.9rem;
          opacity: 0;
          transform: scale(0.8);
          transition: opacity 0.2s ease, transform 0.2s ease;
          font-family: var(--font-main);
          backdrop-filter: blur(4px);
        }
        .photo-card:hover .card-delete-btn {
          opacity: 1;
          transform: scale(1);
        }
        .card-delete-btn:hover {
          background: rgba(185,28,28,1) !important;
          transform: scale(1.1) !important;
        }
        .stat-pill {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          font-size: 0.78rem;
          color: var(--text-secondary);
          font-family: var(--font-main);
          white-space: nowrap;
          transition: border-color 0.2s, background 0.2s;
        }
        .stat-pill:hover {
          border-color: var(--accent);
          background: var(--accent-light);
        }
        .stat-pill strong {
          color: var(--text-primary);
          font-weight: 700;
        }
        .upload-btn {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.65rem 1.5rem;
          border-radius: 2rem;
          background: var(--accent);
          color: var(--bg-primary);
          font-weight: 700;
          font-size: 0.88rem;
          border: none;
          cursor: pointer;
          font-family: var(--font-main);
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s;
          box-shadow: 0 4px 14px rgba(0,128,128,0.3);
          letter-spacing: 0.02em;
        }
        .upload-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,128,128,0.4);
          opacity: 0.92;
        }
        .upload-btn:active {
          transform: translateY(0);
          box-shadow: 0 4px 14px rgba(0,128,128,0.3);
        }
        .empty-zone {
          border: 2px dashed var(--border-color);
          border-radius: 2rem;
          padding: 5rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.25s, background 0.25s, transform 0.25s;
        }
        .empty-zone:hover {
          border-color: var(--accent);
          background: var(--accent-light);
          transform: scale(1.01);
        }
        .section-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, var(--border-color), transparent);
          margin: 2rem 0;
        }
        .view-toggle {
          display: flex;
          gap: 0;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 2rem;
          padding: 3px;
          backdrop-filter: blur(8px);
        }
        .view-toggle-btn {
          padding: 0.45rem 1.1rem;
          border-radius: 2rem;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--font-main);
          transition: background 0.2s, color 0.2s;
          display: flex; align-items: center; gap: 0.4rem;
          white-space: nowrap;
        }
        .view-toggle-btn.active {
          background: var(--accent);
          color: var(--bg-primary);
        }
        .view-toggle-btn:not(.active):hover {
          background: var(--accent-light);
          color: var(--accent);
        }
      `}</style>

      <Navbar />

      {tokens && user?.board_id && (
        <UploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onUploadDone={refreshBoard}
          boardId={user.board_id}
          accessToken={tokens.access_token}
        />
      )}

      {tokens && user?.board_id && (
        <PhotoDetailModal
          photo={selectedPhoto}
          boardId={user.board_id}
          accessToken={tokens.access_token}
          onClose={() => setSelectedPhoto(null)}
          onSaved={updated => setPhotos(ps => ps.map(p => p.photo_id === updated.photo_id ? updated : p))}
          onDelete={photoId => {
            handleDelete(photoId);
            setSelectedPhoto(null);
          }}
        />
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '5rem 1.5rem 4rem' }}>

        {/* ── Hero Header ── */}
        <div style={{
          position: 'relative',
          borderRadius: '2rem',
          overflow: 'hidden',
          marginBottom: '2rem',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          /* fallback bg in case photos haven't loaded */
          background: 'var(--bg-secondary)',
        }}>

          {/* Blurred mosaic background — kicks in for any photo count >= 1 */}
          {photos.length >= 1 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(photos.length, 5)}, 1fr)`,
              zIndex: 0,
              filter: 'blur(28px) saturate(1.3)',
              transform: 'scale(1.1)',
            }}>
              {photos.slice(0, 5).map(p => (
                <div key={p.photo_id} style={{
                  backgroundImage: `url(${p.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }} />
              ))}
            </div>
          )}

          {/* No-photo state: teal gradient fallback */}
          {photos.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 0,
              background: 'linear-gradient(135deg, #006666 0%, #008080 40%, #004d4d 100%)',
            }} />
          )}

          {/* Banner content — always dark overlay so text is always readable */}
          <div style={{
            position: 'relative', zIndex: 1,
            background: 'linear-gradient(135deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.38) 100%)',
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>

            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{
                  fontSize: '0.65rem', fontWeight: 700,
                  color: 'rgba(255,255,255,0.6)',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  marginBottom: '0.4rem',
                }}>
                  My Travel Board
                </div>
                <h1 style={{
                  fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: '#fff',
                  lineHeight: 1.1,
                  margin: 0,
                  textTransform: 'none',
                }}>
                  {board?.name ?? 'My Board'}
                </h1>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* View toggle */}
                <div
                  className="view-toggle"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <button
                    className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                    style={viewMode !== 'grid' ? { color: 'rgba(255,255,255,0.75)' } : {}}
                    onClick={() => setViewMode('grid')}
                  >
                    <span>⊞</span> Grid
                  </button>
                  <button
                    className={`view-toggle-btn${viewMode === 'map' ? ' active' : ''}`}
                    style={viewMode !== 'map' ? { color: 'rgba(255,255,255,0.75)' } : {}}
                    onClick={() => setViewMode('map')}
                  >
                    <span>🗺</span> Map
                  </button>
                </div>

                <button
                  className="upload-btn"
                  onClick={() => setUploadModalOpen(true)}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>＋</span>
                  Upload Photos
                </button>
              </div>
            </div>

            {/* Stats pills row — always white/glassmorphic since bg is always dark */}
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className="stat-pill" style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(8px)',
                }}>
                  <span>📸</span>
                  <span><strong>{photos.length}</strong> {photos.length === 1 ? 'photo' : 'photos'}</span>
                </div>
                {uniqueLocations > 0 && (
                  <div className="stat-pill" style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(8px)',
                  }}>
                    <span>📍</span>
                    <span><strong>{uniqueLocations}</strong> {uniqueLocations === 1 ? 'place' : 'places'}</span>
                  </div>
                )}
                {dateSpan && (
                  <div className="stat-pill" style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(8px)',
                  }}>
                    <span>📅</span>
                    <span><strong>{dateSpan}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Empty State ── */}
        {photos.length === 0 && (
          <div
            className="empty-zone"
            onClick={() => setUploadModalOpen(true)}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem', lineHeight: 1 }}>🌍</div>
            <h2 style={{
              color: 'var(--text-primary)', fontSize: '1.15rem',
              fontWeight: 800, marginBottom: '0.5rem',
              textTransform: 'none', letterSpacing: '-0.02em',
            }}>
              Your adventure starts here
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.75rem', maxWidth: '360px', margin: '0.5rem auto 1.75rem' }}>
              Upload your travel photos to build a beautiful visual journal with an interactive map.
            </p>
            <button
              className="upload-btn"
              onClick={e => { e.stopPropagation(); setUploadModalOpen(true); }}
              style={{ margin: '0 auto' }}
            >
              <span style={{ fontSize: '1rem' }}>＋</span>
              Upload Your First Photo
            </button>
          </div>
        )}

        {/* ── Grid View ── */}
        {photos.length > 0 && viewMode === 'grid' && (
          <>
            <div className="section-divider" />

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1rem',
            }}>
              {photos.map((photo, i) => {
                // Every ~6th card gets a "tall" span for masonry feel
                const isTall = i % 7 === 3;
                return (
                  <div
                    key={photo.photo_id}
                    className="photo-card"
                    onClick={() => setSelectedPhoto(photo)}
                    style={{
                      aspectRatio: isTall ? '3/4' : '1',
                      animationDelay: `${Math.min(i * 0.04, 0.4)}s`,
                    }}
                  >
                    <img
                      className="card-img"
                      src={photo.url}
                      alt={photo.title ?? photo.filename}
                    />

                    {/* Always-visible subtle title bar */}
                    {photo.title && (
                      <div className="card-title-always">
                        <p style={{
                          color: '#fff', fontWeight: 700, fontSize: '0.75rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{photo.title}</p>
                      </div>
                    )}

                    {/* Hover overlay gradient */}
                    <div className="card-overlay" />

                    {/* Hover metadata */}
                    <div className="card-meta">
                      {photo.title && (
                        <p style={{
                          color: '#fff', fontWeight: 700, fontSize: '0.82rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: '0.25rem',
                        }}>{photo.title}</p>
                      )}
                      {(photo.location || photo.date) && (
                        <p style={{
                          color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                        }}>
                          {photo.location && <><span>📍</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{photo.location}</span></>}
                          {photo.location && photo.date && <span style={{ opacity: 0.5 }}>·</span>}
                          {photo.date && <><span>📅</span><span>{photo.date}</span></>}
                        </p>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      className="card-delete-btn"
                      onClick={e => { e.stopPropagation(); handleDelete(photo.photo_id); }}
                      disabled={deletingId === photo.photo_id}
                      title="Delete photo"
                    >
                      {deletingId === photo.photo_id ? '…' : '×'}
                    </button>

                    {/* Deleting spinner overlay */}
                    {deletingId === photo.photo_id && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(2px)',
                      }}>
                        <div style={{
                          width: '28px', height: '28px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                          animation: 'dashSpin 0.7s linear infinite',
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Map View ── */}
        {viewMode === 'map' && (
          <>
            <div className="section-divider" />
            <DashboardMapView
              photos={photos}
              onPhotoClick={setSelectedPhoto}
            />
          </>
        )}
      </div>
    </div>
  );
}
