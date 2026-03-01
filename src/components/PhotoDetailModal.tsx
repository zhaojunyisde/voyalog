import { useState, useEffect } from 'react';
import { updatePhoto } from '../services/api';
import type { Photo, PhotoMeta } from '../services/api';
import { useIsMobile } from '../hooks/useMobile';

export interface PhotoDetailModalProps {
    photo: Photo | null;
    boardId: string;
    accessToken: string;
    onClose: () => void;
    onSaved: (updated: Photo) => void;
    onDelete: (photoId: string) => void;
}

export function PhotoDetailModal({ photo, boardId, accessToken, onClose, onSaved, onDelete }: PhotoDetailModalProps) {
    const isMobile = useIsMobile();
    const [form, setForm] = useState<PhotoMeta>({ title: '', date: '', location: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Sync form when photo changes
    useEffect(() => {
        if (!photo) return;
        setForm({
            title: photo.title ?? '',
            date: photo.date ?? '',
            location: photo.location ?? '',
            description: photo.description ?? '',
        });
        setError('');
        setConfirmDelete(false);
    }, [photo]);

    if (!photo) return null;

    const isDirty =
        form.title !== (photo.title ?? '') ||
        form.date !== (photo.date ?? '') ||
        form.location !== (photo.location ?? '') ||
        form.description !== (photo.description ?? '');

    const handleSave = async () => {
        if (!form.title.trim()) { setError('Title is required.'); return; }
        setSaving(true);
        setError('');
        try {
            await updatePhoto(boardId, photo.photo_id, accessToken, form);
            onSaved({ ...photo, ...form });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        onDelete(photo.photo_id);
        onClose();
    };

    const field = (label: string, key: keyof PhotoMeta, type = 'text', required = false) => (
        <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {label}{required && <span style={{ color: '#e05252', marginLeft: '2px' }}>*</span>}
            </label>
            <input
                type={type}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                disabled={saving}
                style={{
                    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.6rem',
                    border: `1px solid ${key === 'title' && !form.title.trim() && error ? '#e05252' : 'var(--border-color)'}`,
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                    fontSize: '0.85rem', fontFamily: 'var(--font-main)', outline: 'none',
                    boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = key === 'title' && !form.title.trim() && error ? '#e05252' : 'var(--border-color)')}
            />
        </div>
    );

    return (
        <div
            onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem',
                animation: 'fadeInBackdrop 0.2s ease',
            }}
        >
            <div style={{
                width: '100%', maxWidth: '820px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: isMobile ? '1rem' : '1.5rem',
                boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
                overflow: 'hidden',
                display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
                fontFamily: 'var(--font-main)',
                maxHeight: '95vh',
                height: isMobile ? '95vh' : 'auto',
            }}>

                {/* Left: image */}
                <div style={{ flex: isMobile ? '0 0 40%' : '0 0 55%', position: 'relative', background: '#000', minHeight: isMobile ? '0' : '420px', display: 'flex' }}>
                    <img
                        src={photo.url}
                        alt={photo.title ?? photo.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', margin: 'auto' }}
                    />
                </div>

                {/* Right: form */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '1rem 1.25rem',
                        borderBottom: '1px solid var(--border-color)',
                        flexShrink: 0,
                    }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            Photo Details
                        </span>
                        <button
                            onClick={onClose}
                            disabled={saving}
                            style={{
                                width: '26px', height: '26px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'pointer',
                            }}
                        >×</button>
                    </div>

                    {/* Form */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {field('Title', 'title', 'text', true)}
                        {field('Date', 'date', 'date')}
                        {field('📍 Location', 'location')}

                        {/* Description textarea */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                Description <span style={{ fontWeight: 400, opacity: 0.55, textTransform: 'none', letterSpacing: 0 }}>· optional</span>
                            </label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                disabled={saving}
                                rows={4}
                                style={{
                                    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.6rem',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                    fontSize: '0.85rem', fontFamily: 'var(--font-main)', outline: 'none',
                                    resize: 'none', lineHeight: '1.5', boxSizing: 'border-box',
                                }}
                                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                                onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
                            />
                        </div>

                        {/* Timestamps */}
                        {(photo.created_at || photo.updated_at) && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: '0.25rem' }}>
                                {photo.created_at && <div>Created: {new Date(photo.created_at).toLocaleString()}</div>}
                                {photo.updated_at && <div>Updated: {new Date(photo.updated_at).toLocaleString()}</div>}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{
                        flexShrink: 0, padding: isMobile ? '0.75rem 1rem' : '0.85rem 1.25rem',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        flexWrap: 'wrap',
                    }}>
                        {/* Delete */}
                        {confirmDelete ? (
                            <>
                                <span style={{ fontSize: '0.75rem', color: '#dc2626', flex: 1, whiteSpace: 'nowrap' }}>Delete this photo?</span>
                                <button onClick={() => setConfirmDelete(false)} style={{ padding: '0.4rem 0.9rem', borderRadius: '2rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>No</button>
                                <button onClick={handleDelete} style={{ padding: '0.4rem 0.9rem', borderRadius: '2rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-main)' }}>Yes, delete</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setConfirmDelete(true)} disabled={saving} style={{ padding: '0.4rem 0.75rem', borderRadius: '2rem', border: '1px solid rgba(220,38,38,0.4)', background: 'transparent', color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>Delete</button>
                                <span style={{ flex: 1, fontSize: '0.75rem', color: '#dc2626' }}>{error}</span>
                                <button onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.9rem', borderRadius: '2rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>Cancel</button>
                                <button onClick={handleSave} disabled={saving || !isDirty} style={{ padding: '0.4rem 1.1rem', borderRadius: '2rem', border: 'none', background: saving || !isDirty ? 'rgba(0,128,128,0.35)' : 'var(--accent)', color: 'var(--bg-primary)', fontSize: '0.8rem', fontWeight: 700, cursor: saving || !isDirty ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-main)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
