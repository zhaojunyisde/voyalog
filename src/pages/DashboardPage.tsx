import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/Navbar';
import ExifReader from 'exifreader';
import {
  getBoard,
  getUploadUrl,
  uploadToS3,
  confirmPhoto,
  updatePhoto,
  deletePhoto,
  type Board,
  type Photo,
  type PhotoMeta,
} from '../services/api';

const PHOTO_LIMIT = 100;

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface FileEntry {
  file: File;
  preview: string;
  meta: PhotoMeta;
  exifLoading: boolean;  // true while EXIF is being read
  status: 'idle' | 'uploading' | 'done' | 'error';
  error?: string;
}

const defaultMeta = (): PhotoMeta => ({
  title: '',
  date: new Date().toISOString().slice(0, 10),
  location: '',
  description: '',
});

/* ─── EXIF helpers ───────────────────────────────────────────────────────────── */

async function extractExifMeta(file: File): Promise<Partial<PhotoMeta>> {
  const result: Partial<PhotoMeta> = {};

  try {
    // expanded:true gives computed gps.Latitude / gps.Longitude
    const tags = await ExifReader.load(file, { expanded: true });

    // ── Date ───────────────────────────────────────────────────────────────
    const rawDate =
      tags.exif?.DateTimeOriginal?.description ??
      tags.exif?.DateTime?.description ??
      tags.exif?.DateTimeDigitized?.description;
    if (rawDate) {
      // EXIF date strings use colons: "2024:01:15 14:30:00" → normalise to ISO
      const d = new Date(String(rawDate).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
      if (!isNaN(d.getTime())) result.date = d.toISOString().slice(0, 10);
    }

    // ── GPS → reverse geocode ───────────────────────────────────────────────
    const lat = tags.gps?.Latitude;
    const lon = tags.gps?.Longitude;
    if (lat != null && lon != null) {
      result.location = await reverseGeocode(lat, lon);
    }
  } catch (err) {
    console.warn('[EXIF] extraction failed for', file.name, err);
  }

  return result;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data?.address ?? {};
    // Build a human-readable string: city/town/village, state/country
    const parts = [
      addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.county,
      addr.state ?? addr.region,
      addr.country,
    ].filter(Boolean);
    return parts.join(', ');
  } catch {
    return '';
  }
}

/* ─── Shared input style ─────────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.6rem',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  fontFamily: 'var(--font-main)',
  outline: 'none',
  transition: 'border-color 0.2s',
};

/* ─── Upload Modal ───────────────────────────────────────────────────────────── */

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadDone: () => void;
  boardId: string;
  accessToken: string;
  remaining: number;
}

function UploadModal({ isOpen, onClose, onUploadDone, boardId, accessToken, remaining }: UploadModalProps) {
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
    const images = files.filter(f => f.type.startsWith('image/'));
    const newEntries: FileEntry[] = images.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      meta: defaultMeta(),
      exifLoading: true,
      status: 'idle',
    }));

    // Clamp to remaining slots
    setEntries(prev => [...prev, ...newEntries].slice(0, remaining));

    // Launch EXIF extraction outside the updater so it only fires once,
    // then match by stable File object reference (not by index).
    for (const entry of newEntries) {
      extractExifMeta(entry.file).then(exifMeta => {
        if (Object.keys(exifMeta).length === 0) {
          // Nothing extracted — just clear the loading flag
          setEntries(cur =>
            cur.map(e => e.file === entry.file ? { ...e, exifLoading: false } : e)
          );
          return;
        }
        setEntries(cur =>
          cur.map(e =>
            e.file === entry.file
              ? { ...e, exifLoading: false, meta: { ...e.meta, ...exifMeta } }
              : e
          )
        );
      });
    }
  }, [remaining]);

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

  const handleUpload = async () => {
    // Validate: title required for all entries
    const missingTitle = entries.findIndex(e => !e.meta.title.trim());
    if (missingTitle !== -1) {
      setActiveIdx(missingTitle);
      setGlobalError('Title is required for every photo.');
      return;
    }
    setUploading(true);
    setGlobalError('');
    let anyError = false;

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].status === 'done') continue;
      setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'uploading' } : e));
      try {
        const { photo_id, upload_url } = await getUploadUrl(boardId, entries[i].file.name, accessToken, entries[i].file.type);
        await uploadToS3(upload_url, entries[i].file);
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
                style={{ color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}
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
                    or click to browse · {remaining} slot{remaining !== 1 ? 's' : ''} remaining
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
          <div style={{ display: 'flex', height: '480px' }}>

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
                    <p style={{ color: '#fff', fontSize: '0.75rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                      <p style={{ color: '#e05252', fontSize: '0.72rem', marginTop: '0.25rem' }}>Title is required</p>
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

                  {/* Location — pre-filled from GPS EXIF */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      📍 Location {active.exifLoading && <span style={{ fontWeight: 400, opacity: 0.6 }}>· reading GPS…</span>}
                    </label>
                    <input
                      type="text"
                      placeholder={active.exifLoading ? 'Detecting from photo…' : 'e.g. Yosemite, California'}
                      value={active.meta.location}
                      onChange={e => updateMeta(activeIdx, 'location', e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={e => (e.target.style.borderColor = '')}
                    />
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

/* ─── Dashboard Page ─────────────────────────────────────────────────────────── */

/* ─── Photo Detail Modal ─────────────────────────────────────────────────────── */

interface PhotoDetailModalProps {
  photo: Photo | null;
  boardId: string;
  accessToken: string;
  onClose: () => void;
  onSaved: (updated: Photo) => void;
  onDelete: (photoId: string) => void;
}

function PhotoDetailModal({ photo, boardId, accessToken, onClose, onSaved, onDelete }: PhotoDetailModalProps) {
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
        borderRadius: '1.5rem',
        boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'row',
        animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
        fontFamily: 'var(--font-main)',
        maxHeight: '90vh',
      }}>

        {/* Left: image */}
        <div style={{ flex: '0 0 55%', position: 'relative', background: '#000', minHeight: '420px' }}>
          <img
            src={photo.url}
            alt={photo.title ?? photo.filename}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
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
            flexShrink: 0, padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            {/* Delete */}
            {confirmDelete ? (
              <>
                <span style={{ fontSize: '0.75rem', color: '#dc2626', flex: 1 }}>Delete this photo?</span>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: '0.4rem 0.9rem', borderRadius: '2rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>No</button>
                <button onClick={handleDelete} style={{ padding: '0.4rem 0.9rem', borderRadius: '2rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-main)' }}>Yes, delete</button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirmDelete(true)} disabled={saving} style={{ padding: '0.4rem 0.75rem', borderRadius: '2rem', border: '1px solid rgba(220,38,38,0.4)', background: 'transparent', color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>Delete</button>
                <span style={{ flex: 1, fontSize: '0.75rem', color: '#dc2626' }}>{error}</span>
                <button onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.9rem', borderRadius: '2rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !isDirty} style={{ padding: '0.4rem 1.1rem', borderRadius: '2rem', border: 'none', background: saving || !isDirty ? 'rgba(0,128,128,0.35)' : 'var(--accent)', color: 'var(--bg-primary)', fontSize: '0.8rem', fontWeight: 700, cursor: saving || !isDirty ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-main)', transition: 'all 0.2s' }}>
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

/* ─── Dashboard Page ─────────────────────────────────────────────────────────── */

export function DashboardPage() {
  const { user, tokens, loading } = useAuth();
  const navigate = useNavigate();

  const [board, setBoard] = useState<Board | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (!loading && !tokens) navigate('/');
  }, [loading, tokens, navigate]);

  useEffect(() => {
    if (!tokens || !user?.board_id) return;
    getBoard(user.board_id, tokens.access_token)
      .then(({ board, photos }) => { setBoard(board); setPhotos(photos); })
      .catch(() => { })
      .finally(() => setBoardLoading(false));
  }, [tokens, user?.board_id]);

  const refreshBoard = async () => {
    if (!tokens || !user?.board_id) return;
    const { board, photos } = await getBoard(user.board_id, tokens.access_token);
    setBoard(board);
    setPhotos(photos);
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
  const remaining = PHOTO_LIMIT - (board?.photo_count ?? 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'var(--font-main)' }}>

      <Navbar />

      {tokens && user?.board_id && (
        <UploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onUploadDone={refreshBoard}
          boardId={user.board_id}
          accessToken={tokens.access_token}
          remaining={remaining}
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

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '5rem 1.5rem 2rem' }}>

        {/* Board header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {board?.name ?? 'My Board'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              {board?.photo_count ?? 0} / {PHOTO_LIMIT} photos
            </p>
          </div>
          <button
            onClick={() => !atLimit && setUploadModalOpen(true)}
            disabled={atLimit}
            style={{
              padding: '0.6rem 1.4rem', borderRadius: '2rem',
              background: atLimit ? 'rgba(0,128,128,0.4)' : 'var(--accent)',
              color: 'var(--bg-primary)', fontWeight: 700,
              fontSize: '0.9rem', border: 'none',
              cursor: atLimit ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-main)',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => { if (!atLimit) e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {atLimit ? 'Limit reached' : '+ Upload'}
          </button>
        </div>

        {/* Empty state */}
        {photos.length === 0 && (
          <div
            onClick={() => !atLimit && setUploadModalOpen(true)}
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '1.5rem',
              padding: '4rem 2rem',
              textAlign: 'center',
              cursor: atLimit ? 'default' : 'pointer',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { if (!atLimit) { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-light)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = ''; (e.currentTarget as HTMLDivElement).style.background = ''; }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🖼️</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>No photos yet</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Click <strong>+ Upload</strong> to add your first photos
            </p>
          </div>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.75rem',
          }}>
            {photos.map(photo => {
              const isHovered = hoveredId === photo.photo_id;
              const hasOverlay = photo.title || photo.location || photo.date;
              return (
                <div
                  key={photo.photo_id}
                  onClick={() => setSelectedPhoto(photo)}
                  onMouseEnter={() => setHoveredId(photo.photo_id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: 'relative', aspectRatio: '1',
                    borderRadius: '0.75rem', overflow: 'hidden',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.title ?? photo.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />

                  {/* Metadata overlay */}
                  {hasOverlay && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
                      padding: '1.5rem 0.65rem 0.55rem',
                    }}>
                      {photo.title && (
                        <p style={{
                          color: '#fff', fontWeight: 700, fontSize: '0.78rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: '0.1rem',
                        }}>{photo.title}</p>
                      )}
                      {isHovered && (photo.date || photo.location) && (
                        <p style={{
                          color: 'rgba(255,255,255,0.75)', fontSize: '0.65rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {[photo.date, photo.location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Delete button */}
                  {isHovered && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(photo.photo_id); }}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
