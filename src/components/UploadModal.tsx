import { useState, useRef, useEffect, useCallback } from 'react';
import heic2any from 'heic2any';
import { getUploadUrl, uploadToS3, confirmPhoto } from '../services/api';
import type { PhotoMeta } from '../services/api';
import { defaultMeta, extractExifMeta, reverseGeocode } from '../utils/photoUtils';
import type { FileEntry } from '../utils/photoUtils';
import { inputStyle } from '../utils/styles';
import { LocationPickerMap } from './LocationPickerMap';

export interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadDone: () => void;
    boardId: string;
    accessToken: string;
}

export function UploadModal({ isOpen, onClose, onUploadDone, boardId, accessToken }: UploadModalProps) {
    const [step, setStep] = useState<'pick' | 'meta'>('pick');
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [globalError, setGlobalError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset on open/close
    useEffect(() => {
        if (!isOpen) {
            setEntries(prev => { prev.forEach(e => URL.revokeObjectURL(e.preview)); return []; });
            setStep('pick');
            setDragOver(false);
            setActiveIdx(0);
            setUploading(false);
            setGlobalError('');
        }
    }, [isOpen]);

    const addFiles = useCallback((files: File[]) => {
        const isHeicFile = (f: File) =>
            f.type === 'image/heic' || f.type === 'image/heif' || /\.(heic|heif)$/i.test(f.name);

        const images = files.filter(f => f.type.startsWith('image/') || isHeicFile(f));
        const newEntries: FileEntry[] = images.map(f => ({
            file: f,
            preview: URL.createObjectURL(f),
            meta: defaultMeta(),
            exifLoading: true,
            status: 'idle',
        }));

        setEntries(prev => [...prev, ...newEntries]);

        for (const entry of newEntries) {
            const originalFile = entry.file;
            (async () => {
                // Run EXIF extraction and HEIC conversion in parallel
                const [exifMeta, jpegFile] = await Promise.all([
                    extractExifMeta(originalFile),
                    isHeicFile(originalFile)
                        ? heic2any({ blob: originalFile, toType: 'image/jpeg', quality: 0.92 })
                            .then(blob => {
                                const b = Array.isArray(blob) ? blob[0] : blob;
                                return new File([b], originalFile.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
                            })
                            .catch(() => null)
                        : Promise.resolve(null),
                ]);

                setEntries(cur => cur.map(e => {
                    if (e.file !== originalFile) return e;
                    const updated = { ...e, exifLoading: false, meta: { ...e.meta, ...exifMeta } };
                    if (jpegFile) {
                        URL.revokeObjectURL(e.preview);
                        updated.file = jpegFile;
                        updated.preview = URL.createObjectURL(jpegFile);
                    }
                    return updated;
                }));
            })();
        }
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        addFiles(Array.from(e.dataTransfer.files));
    };

    const removeEntry = (idx: number) => {
        setEntries(prev => {
            URL.revokeObjectURL(prev[idx].preview);
            const next = prev.filter((_, i) => i !== idx);
            setActiveIdx(i => Math.min(i, Math.max(0, next.length - 1)));
            return next;
        });
    };

    const updateMeta = (idx: number, field: keyof PhotoMeta, value: string) => {
        setEntries(prev => prev.map((e, i) => i === idx ? { ...e, meta: { ...e.meta, [field]: value } } : e));
    };

    // Update multiple meta fields atomically
    const updateMetaFull = (idx: number, patch: Partial<PhotoMeta>) => {
        setEntries(prev => prev.map((e, i) => i === idx ? { ...e, meta: { ...e.meta, ...patch } } : e));
    };

    // Called when user clicks/drags the location pin on the mini-map
    const [geocodingIdx, setGeocodingIdx] = useState<number | null>(null);
    const handlePinChange = useCallback(async (idx: number, lat: number, lng: number) => {
        // Immediately store the raw coords
        updateMetaFull(idx, { latitude: lat, longitude: lng, location: '' });
        setGeocodingIdx(idx);
        const name = await reverseGeocode(lat, lng);
        setGeocodingIdx(null);
        updateMetaFull(idx, { latitude: lat, longitude: lng, location: name });
    }, []);

    const handleUpload = async () => {
        // Validate: title required for all entries
        const missingTitle = entries.findIndex(e => !e.meta.title.trim());
        if (missingTitle !== -1) {
            setActiveIdx(missingTitle);
            setGlobalError('Title is required for every photo.');
            return;
        }
        // Validate: location (lat/lng) required for all entries
        const missingCoords = entries.findIndex(e => e.meta.latitude == null || e.meta.longitude == null);
        if (missingCoords !== -1) {
            setActiveIdx(missingCoords);
            setGlobalError('Location is required for every photo. Please pin a location on the map.');
            return;
        }
        setUploading(true);
        setGlobalError('');
        let anyError = false;

        for (let i = 0; i < entries.length; i++) {
            if (entries[i].status === 'done') continue;
            setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'uploading' } : e));
            try {
                const file = entries[i].file;
                const { photo_id, upload_url } = await getUploadUrl(boardId, file.name, accessToken, file.type, file.size);
                await uploadToS3(upload_url, file);
                await confirmPhoto(boardId, photo_id, accessToken, entries[i].meta);
                setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'done' } : e));
            } catch (err) {
                anyError = true;
                setEntries(prev => prev.map((e, idx) => idx === i
                    ? { ...e, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
                    : e));
            }
        }

        setUploading(false);
        onUploadDone();
        if (!anyError) {
            onClose();
        } else {
            setGlobalError('Some files failed. You can close or retry.');
        }
    };

    if (!isOpen) return null;

    const allDone = entries.length > 0 && entries.every(e => e.status === 'done');
    const active = entries[activeIdx];

    return (
        <div
            onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem',
                animation: 'fadeInBackdrop 0.2s ease',
            }}
        >
            <div style={{
                width: '100%',
                maxWidth: step === 'meta' ? '780px' : '520px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '1.5rem',
                boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
                fontFamily: 'var(--font-main)',
                transition: 'max-width 0.3s cubic-bezier(0.16,1,0.3,1)',
            }}>

                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {step === 'meta' && (
                            <button
                                onClick={() => !uploading && setStep('pick')}
                                disabled={uploading}
                                style={{ color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'pointer', lineHeight: 1, padding: '2px 4px', background: 'transparent', border: 'none' }}
                            >←</button>
                        )}
                        <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                            {step === 'pick' ? 'Select Photos' : 'Add Details'}
                        </span>
                        {/* Step indicator */}
                        <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                            {(['pick', 'meta'] as const).map((s) => (
                                <div key={s} style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: step === s ? 'var(--accent)' : 'var(--border-color)',
                                    transition: 'background 0.2s',
                                }} />
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={() => !uploading && onClose()}
                        disabled={uploading}
                        style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)', fontSize: '1rem',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                        }}
                    >×</button>
                </div>

                {/* ── Step 1: Pick files ── */}
                {step === 'pick' && (
                    <div style={{ padding: '1.25rem 1.5rem' }}>
                        {/* Drop zone */}
                        <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => inputRef.current?.click()}
                            style={{
                                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-color)'}`,
                                borderRadius: '1rem',
                                padding: entries.length ? '1rem' : '3rem 1.5rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: dragOver ? 'var(--accent-light)' : 'transparent',
                                transition: 'all 0.2s',
                                marginBottom: entries.length ? '1rem' : 0,
                            }}
                        >
                            {entries.length === 0 ? (
                                <>
                                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🖼️</div>
                                    <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                                        Drop photos here
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                        or click to browse
                                    </p>
                                </>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                    Drop more or <span style={{ color: 'var(--accent)', fontWeight: 600 }}>click to browse</span>
                                </p>
                            )}
                        </div>

                        {/* Thumbnail strip */}
                        {entries.length > 0 && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                                gap: '0.5rem',
                                maxHeight: '220px',
                                overflowY: 'auto',
                            }}>
                                {entries.map((entry, idx) => (
                                    <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '0.6rem', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                        <img src={entry.preview} alt={entry.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        <button
                                            onClick={e => { e.stopPropagation(); removeEntry(idx); }}
                                            style={{
                                                position: 'absolute', top: '4px', right: '4px',
                                                width: '20px', height: '20px', borderRadius: '50%',
                                                background: 'rgba(0,0,0,0.6)', border: 'none',
                                                color: '#fff', fontSize: '0.7rem', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}
                                        >×</button>
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            background: 'rgba(0,0,0,0.5)', padding: '2px 4px',
                                            fontSize: '0.58rem', color: '#fff',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>{entry.file.name}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
                        />

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '0.5rem 1.1rem', borderRadius: '2rem',
                                    background: 'transparent', border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer',
                                    fontFamily: 'var(--font-main)',
                                }}
                            >Cancel</button>
                            <button
                                onClick={() => { setActiveIdx(0); setStep('meta'); }}
                                disabled={entries.length === 0}
                                style={{
                                    padding: '0.5rem 1.4rem', borderRadius: '2rem',
                                    background: entries.length === 0 ? 'rgba(0,128,128,0.35)' : 'var(--accent)',
                                    color: 'var(--bg-primary)', fontWeight: 700,
                                    fontSize: '0.85rem', border: 'none',
                                    cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
                                    fontFamily: 'var(--font-main)',
                                    transition: 'all 0.2s',
                                }}
                            >
                                Next → Add Details
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Metadata ── */}
                {step === 'meta' && (
                    <div style={{ display: 'flex', height: '520px' }}>

                        {/* Left: thumbnail filmstrip */}
                        <div style={{
                            width: '110px', flexShrink: 0,
                            borderRight: '1px solid var(--border-color)',
                            overflowY: 'auto',
                            padding: '0.75rem 0.5rem',
                            display: 'flex', flexDirection: 'column', gap: '0.5rem',
                        }}>
                            {entries.map((entry, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setActiveIdx(idx)}
                                    style={{
                                        position: 'relative',
                                        aspectRatio: '1',
                                        borderRadius: '0.5rem',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        border: idx === activeIdx ? '2px solid var(--accent)' : '2px solid transparent',
                                        transition: 'border-color 0.15s',
                                        flexShrink: 0,
                                    }}
                                >
                                    <img src={entry.preview} alt={entry.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    {/* Status badge */}
                                    {entry.status === 'done' && (
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,128,128,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ color: '#fff', fontSize: '1.1rem' }}>✓</span>
                                        </div>
                                    )}
                                    {entry.status === 'uploading' && (
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,128,128,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ color: '#fff', fontSize: '1rem' }}>⏳</span>
                                        </div>
                                    )}
                                    {entry.status === 'error' && (
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(220,38,38,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ color: '#fff', fontSize: '1rem' }}>✕</span>
                                        </div>
                                    )}
                                    {/* Index badge */}
                                    <div style={{
                                        position: 'absolute', bottom: '3px', right: '5px',
                                        fontSize: '0.6rem', color: '#fff',
                                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                        fontWeight: 700,
                                    }}>{idx + 1}/{entries.length}</div>
                                </div>
                            ))}
                        </div>

                        {/* Right: form + preview */}
                        {active && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                {/* Preview strip */}
                                <div style={{ height: '180px', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                                    <img
                                        src={active.preview}
                                        alt={active.file.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)',
                                        pointerEvents: 'none',
                                    }} />
                                    <div style={{ position: 'absolute', bottom: '0.75rem', left: '1rem', right: '1rem' }}>
                                        <p style={{ color: '#fff', fontSize: '0.75rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                                            {active.file.name} · {(active.file.size / 1024).toFixed(0)} KB
                                        </p>
                                    </div>
                                </div>

                                {/* Form fields */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                                    {/* Title — required */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                            Title <span style={{ color: '#e05252' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Sunset at the peak"
                                            value={active.meta.title}
                                            onChange={e => updateMeta(activeIdx, 'title', e.target.value)}
                                            style={{
                                                ...inputStyle,
                                                borderColor: !active.meta.title.trim() && globalError ? '#e05252' : '',
                                            }}
                                            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                                            onBlur={e => (e.target.style.borderColor = !active.meta.title.trim() && globalError ? '#e05252' : '')}
                                        />
                                        {!active.meta.title.trim() && globalError && (
                                            <p style={{ color: '#e05252', fontSize: '0.72rem', marginTop: '0.25rem', marginBottom: 0 }}>Title is required</p>
                                        )}
                                    </div>

                                    {/* Date — pre-filled from EXIF */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                            Date {active.exifLoading && <span style={{ fontWeight: 400, opacity: 0.6 }}>· reading…</span>}
                                        </label>
                                        <input
                                            type="date"
                                            value={active.meta.date}
                                            onChange={e => updateMeta(activeIdx, 'date', e.target.value)}
                                            style={inputStyle}
                                            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                                            onBlur={e => (e.target.style.borderColor = '')}
                                        />
                                    </div>

                                    {/* Location — show card if GPS known, map picker if not */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                            📍 Location
                                            {active.exifLoading && <span style={{ fontWeight: 400, opacity: 0.6 }}> · reading GPS…</span>}
                                            {!active.exifLoading && active.meta.latitude == null && (
                                                <span style={{ fontWeight: 400, opacity: 0.6, textTransform: 'none', letterSpacing: 0 }}> · click map to set</span>
                                            )}
                                        </label>

                                        {/* ── Has coordinates: show compact read-only card ── */}
                                        {active.meta.latitude != null && active.meta.longitude != null ? (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                padding: '0.55rem 0.75rem',
                                                borderRadius: '0.6rem',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-secondary)',
                                            }}>
                                                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📍</span>
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <p style={{
                                                        fontSize: '0.82rem', fontWeight: 600,
                                                        color: 'var(--text-primary)', fontFamily: 'var(--font-main)',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        marginBottom: '0.1rem',
                                                        marginTop: 0,
                                                    }}>
                                                        {active.meta.location || 'Location found'}
                                                    </p>
                                                    <p style={{
                                                        fontSize: '0.65rem', color: 'var(--text-secondary)',
                                                        fontFamily: 'var(--font-main)',
                                                        margin: 0,
                                                    }}>
                                                        {active.meta.latitude.toFixed(5)}, {active.meta.longitude.toFixed(5)}
                                                    </p>
                                                </div>
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 700,
                                                    color: 'var(--accent)', fontFamily: 'var(--font-main)',
                                                    background: 'var(--accent-light)',
                                                    padding: '0.2rem 0.5rem', borderRadius: '2rem',
                                                    flexShrink: 0,
                                                }}>GPS ✓</span>
                                                {/* Allow overriding by clearing coords */}
                                                <button
                                                    onClick={() => updateMetaFull(activeIdx, { latitude: undefined, longitude: undefined, location: '' })}
                                                    title="Change location"
                                                    style={{
                                                        flexShrink: 0, padding: '0.2rem 0.5rem',
                                                        borderRadius: '2rem', border: '1px solid var(--border-color)',
                                                        background: 'transparent', color: 'var(--text-secondary)',
                                                        fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'var(--font-main)',
                                                    }}
                                                >
                                                    Change
                                                </button>
                                            </div>
                                        ) : (
                                            /* ── No coordinates: show map picker ── */
                                            <LocationPickerMap
                                                lat={active.meta.latitude}
                                                lng={active.meta.longitude}
                                                geocoding={geocodingIdx === activeIdx}
                                                locationName={active.meta.location}
                                                onPinChange={(lat, lng) => handlePinChange(activeIdx, lat, lng)}
                                            />
                                        )}
                                    </div>

                                    {/* Description — optional */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                            Description <span style={{ fontWeight: 400, opacity: 0.55, textTransform: 'none', letterSpacing: 0 }}>· optional</span>
                                        </label>
                                        <textarea
                                            placeholder="What's the story behind this photo?"
                                            value={active.meta.description}
                                            onChange={e => updateMeta(activeIdx, 'description', e.target.value)}
                                            rows={3}
                                            style={{
                                                ...inputStyle,
                                                resize: 'none',
                                                lineHeight: '1.5',
                                            }}
                                            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                                            onBlur={e => (e.target.style.borderColor = '')}
                                        />
                                    </div>

                                    {/* Next/Prev photo nav */}
                                    {entries.length > 1 && (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', paddingTop: '0.25rem' }}>
                                            <button
                                                onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                                                disabled={activeIdx === 0}
                                                style={{
                                                    padding: '0.3rem 0.8rem', borderRadius: '2rem',
                                                    border: '1px solid var(--border-color)',
                                                    background: 'transparent', color: 'var(--text-secondary)',
                                                    fontSize: '0.8rem', cursor: activeIdx === 0 ? 'not-allowed' : 'pointer',
                                                    fontFamily: 'var(--font-main)',
                                                    opacity: activeIdx === 0 ? 0.4 : 1,
                                                }}
                                            >← Prev</button>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                                                {activeIdx + 1} of {entries.length}
                                            </span>
                                            <button
                                                onClick={() => setActiveIdx(i => Math.min(entries.length - 1, i + 1))}
                                                disabled={activeIdx === entries.length - 1}
                                                style={{
                                                    padding: '0.3rem 0.8rem', borderRadius: '2rem',
                                                    border: '1px solid var(--border-color)',
                                                    background: 'transparent', color: 'var(--text-secondary)',
                                                    fontSize: '0.8rem', cursor: activeIdx === entries.length - 1 ? 'not-allowed' : 'pointer',
                                                    fontFamily: 'var(--font-main)',
                                                    opacity: activeIdx === entries.length - 1 ? 0.4 : 1,
                                                }}
                                            >Next →</button>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.85rem 1.25rem',
                                    borderTop: '1px solid var(--border-color)',
                                    gap: '0.75rem',
                                }}>
                                    <span style={{ color: globalError ? '#dc2626' : 'var(--text-secondary)', fontSize: '0.78rem', flex: 1 }}>
                                        {globalError || (uploading ? 'Uploading…' : `${entries.length} photo${entries.length !== 1 ? 's' : ''} ready`)}
                                    </span>
                                    <button
                                        onClick={() => !uploading && onClose()}
                                        disabled={uploading}
                                        style={{
                                            padding: '0.5rem 1.1rem', borderRadius: '2rem',
                                            background: 'transparent', border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)', fontSize: '0.85rem',
                                            cursor: uploading ? 'not-allowed' : 'pointer',
                                            fontFamily: 'var(--font-main)',
                                        }}
                                    >Cancel</button>
                                    <button
                                        onClick={handleUpload}
                                        disabled={uploading || allDone}
                                        style={{
                                            padding: '0.5rem 1.4rem', borderRadius: '2rem',
                                            background: (uploading || allDone) ? 'rgba(0,128,128,0.4)' : 'var(--accent)',
                                            color: 'var(--bg-primary)', fontWeight: 700,
                                            fontSize: '0.85rem', border: 'none',
                                            cursor: (uploading || allDone) ? 'not-allowed' : 'pointer',
                                            fontFamily: 'var(--font-main)',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {uploading ? 'Uploading…' : allDone ? 'Done ✓' : `Upload (${entries.length})`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
