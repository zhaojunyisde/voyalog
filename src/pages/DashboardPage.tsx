import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getBoard,
  getUploadUrl,
  uploadToS3,
  confirmPhoto,
  deletePhoto,
  type Board,
  type Photo,
} from '../services/api';

const PHOTO_LIMIT = 100;

export function DashboardPage() {
  const { user, tokens, logout, loading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [board, setBoard] = useState<Board | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!loading && !tokens) navigate('/');
  }, [loading, tokens, navigate]);

  useEffect(() => {
    if (!tokens || !user?.board_id) return;
    getBoard(user.board_id, tokens.access_token)
      .then(({ board, photos }) => { setBoard(board); setPhotos(photos); })
      .catch(() => {})
      .finally(() => setBoardLoading(false));
  }, [tokens, user?.board_id]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length || !tokens || !user?.board_id) return;
    setUploadError('');
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const { photo_id, upload_url } = await getUploadUrl(user.board_id, file.name, tokens.access_token);
        await uploadToS3(upload_url, file);
        await confirmPhoto(user.board_id, photo_id, tokens.access_token);
      }
      // Refresh board
      const { board, photos } = await getBoard(user.board_id, tokens.access_token);
      setBoard(board);
      setPhotos(photos);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
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

  if (loading || boardLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-main)', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    );
  }

  const atLimit = (board?.photo_count ?? 0) >= PHOTO_LIMIT;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'var(--font-main)' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '1rem 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            VOYALOG
          </span>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {user?.username}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {board?.photo_count ?? 0} / {PHOTO_LIMIT} photos
          </span>
          <button onClick={handleLogout} style={{
            padding: '0.4rem 1rem', borderRadius: '2rem',
            background: 'transparent', border: '1px solid var(--border-color)',
            color: 'var(--text-primary)', cursor: 'pointer',
            fontSize: '0.85rem', fontFamily: 'var(--font-main)',
          }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Board title + upload */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {board?.name ?? 'My Board'}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
            <button
              onClick={() => !atLimit && fileInputRef.current?.click()}
              disabled={uploading || atLimit}
              style={{
                padding: '0.6rem 1.4rem', borderRadius: '2rem',
                background: (uploading || atLimit) ? 'rgba(0,128,128,0.4)' : 'var(--accent)',
                color: 'var(--bg-primary)', fontWeight: 700,
                fontSize: '0.9rem', border: 'none',
                cursor: (uploading || atLimit) ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-main)',
              }}
            >
              {uploading ? 'Uploading…' : atLimit ? 'Limit reached' : '+ Upload'}
            </button>
            {uploadError && (
              <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{uploadError}</span>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleUpload(e.target.files)}
        />

        {/* Drop zone (shown when no photos) */}
        {photos.length === 0 && !uploading && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-color)'}`,
              borderRadius: '1.5rem',
              padding: '4rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              background: dragOver ? 'var(--accent-light)' : 'transparent',
            }}
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              Drop photos here or click to upload
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Up to {PHOTO_LIMIT} photos per board
            </p>
          </div>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.75rem',
              outline: dragOver ? '2px dashed var(--accent)' : 'none',
              borderRadius: '1rem',
              padding: dragOver ? '0.5rem' : '0',
              transition: 'all 0.2s',
            }}
          >
            {photos.map(photo => (
              <div
                key={photo.photo_id}
                onMouseEnter={() => setHoveredId(photo.photo_id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Delete button on hover */}
                {hoveredId === photo.photo_id && (
                  <button
                    onClick={() => handleDelete(photo.photo_id)}
                    disabled={deletingId === photo.photo_id}
                    style={{
                      position: 'absolute', top: '0.5rem', right: '0.5rem',
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'rgba(220,38,38,0.9)', border: 'none',
                      color: '#fff', cursor: 'pointer', fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-main)',
                    }}
                  >
                    {deletingId === photo.photo_id ? '…' : '×'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
