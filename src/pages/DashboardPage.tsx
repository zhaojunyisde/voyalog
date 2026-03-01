import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Navbar } from '../components/Navbar';
import ExifReader from 'exifreader';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
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

    // ── GPS → store raw coords + reverse geocode for display name ──────────
    const lat = tags.gps?.Latitude;
    const lon = tags.gps?.Longitude;
    if (lat != null && lon != null) {
      result.latitude = lat;
      result.longitude = lon;
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

/* ─── Location picker mini-map ─────────────────────────────────────────────────────────── */

// Marker icon that supports drag
const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:32px; height:32px; border-radius:50% 50% 50% 0;
    transform: rotate(-45deg);
    background: var(--accent, #008080);
    border: 3px solid #fff;
    box-shadow: 0 3px 12px rgba(0,0,0,0.35);
    cursor: grab;
  "></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
}
function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [map, onMapClick]);
  return null;
}

interface LocationPickerMapProps {
  lat?: number;
  lng?: number;
  geocoding: boolean;
  locationName: string;
  onPinChange: (lat: number, lng: number) => void;
}

function LocationPickerMap({ lat, lng, geocoding, locationName, onPinChange }: LocationPickerMapProps) {
  const hasPin = lat != null && lng != null;
  const center: L.LatLngExpression = hasPin ? [lat!, lng!] : [20, 0];

  return (
    <div>
      {/* Map container */}
      <div style={{
        height: '160px',
        borderRadius: '0.7rem',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        position: 'relative',
        marginBottom: '0.5rem',
      }}>
        <MapContainer
          key={`locpicker-${hasPin}`}   /* remount when pin appears/disappears */
          center={center}
          zoom={hasPin ? 8 : 2}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
          className="map-sepia-filter"
        >
          <ZoomControl position="bottomright" />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <MapClickHandler onMapClick={onPinChange} />
          {hasPin && (
            <Marker
              position={[lat!, lng!]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  onPinChange(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>

        {/* Hint overlay when no pin */}
        {!hasPin && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 500,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.28)',
            pointerEvents: 'none',
            gap: '0.35rem',
          }}>
            <span style={{ fontSize: '1.5rem' }}>📍</span>
            <span style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'var(--font-main)', letterSpacing: '0.04em' }}>
              Click map to pinpoint location
            </span>
          </div>
        )}
      </div>

      {/* Generated location name */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          readOnly
          value={geocoding ? '' : locationName}
          placeholder={geocoding ? 'Looking up location…' : hasPin ? 'Location not found' : 'No location set'}
          style={{
            ...inputStyle,
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            cursor: 'default',
            paddingRight: '2rem',
          }}
        />
        {geocoding && (
          <span style={{
            position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
            width: '14px', height: '14px',
            border: '2px solid var(--border-color)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'dashSpin 0.7s linear infinite',
            display: 'inline-block',
          }} />
        )}
        {hasPin && !geocoding && (
          <span style={{
            position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
            fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-main)',
          }}>GPS ✓</span>
        )}
      </div>
    </div>
  );
}

/* ─── Upload Modal ───────────────────────────────────────────────────────────── */

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadDone: () => void;
  boardId: string;
  accessToken: string;
}

function UploadModal({ isOpen, onClose, onUploadDone, boardId, accessToken }: UploadModalProps) {
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

    setEntries(prev => [...prev, ...newEntries]);

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
        const { photo_id, upload_url } = await getUploadUrl(boardId, entries[i].file.name, accessToken, entries[i].file.type, entries[i].file.size);
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
                          }}>
                            {active.meta.location || 'Location found'}
                          </p>
                          <p style={{
                            fontSize: '0.65rem', color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-main)',
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

/* ─── Loading Spinner ────────────────────────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-main)',
      gap: '1.25rem',
    }}>
      <div style={{
        width: '48px', height: '48px',
        border: '3px solid var(--border-color)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'dashSpin 0.8s linear infinite',
      }} />
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.08em' }}>
        LOADING YOUR MEMORIES…
      </span>
    </div>
  );
}

/* ─── Dashboard Map View ─────────────────────────────────────────────────────── */

// Memoized icon cache keyed by url
const dashIconCache: Record<string, L.DivIcon> = {};
function getDashPhotoIcon(url: string, size = 52) {
  if (dashIconCache[url]) return dashIconCache[url];
  const icon = L.divIcon({
    className: 'custom-photo-marker',
    html: `<div style="
      width:${size}px; height:${size}px; border-radius:50%;
      border: 3px solid white;
      box-shadow: 0 4px 18px rgba(0,0,0,0.45);
      background-image: url(${url});
      background-size: cover; background-position: center;
      cursor: pointer;
      transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s;
    " onmouseover="this.style.transform='scale(1.18) translateY(-4px)';this.style.boxShadow='0 10px 30px rgba(0,0,0,0.5)'" onmouseout="this.style.transform='scale(1) translateY(0)';this.style.boxShadow='0 4px 18px rgba(0,0,0,0.45)'"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  dashIconCache[url] = icon;
  return icon;
}

// Component to auto-fit map to photo markers
function FitBounds({ photos }: { photos: Photo[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = photos.filter(p => p.latitude != null && p.longitude != null);
    if (pts.length === 0) return;
    const bounds = L.latLngBounds(pts.map(p => [p.latitude!, p.longitude!]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
  }, [map, photos]);
  return null;
}

interface DashboardMapViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

function DashboardMapView({ photos, onPhotoClick }: DashboardMapViewProps) {
  const mappable = photos.filter(p => p.latitude != null && p.longitude != null);
  const unmapped = photos.filter(p => p.latitude == null || p.longitude == null);

  const initCenter: L.LatLngExpression = mappable.length > 0
    ? [mappable[0].latitude!, mappable[0].longitude!]
    : [20, 0];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', borderRadius: '1.5rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {mappable.length === 0 ? (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-secondary)', gap: '1rem',
            fontFamily: 'var(--font-main)',
          }}>
            <span style={{ fontSize: '3rem' }}>🗺️</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No photos have location data yet.</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', opacity: 0.7 }}>Upload photos with GPS EXIF data so they appear on the map.</p>
          </div>
        ) : (
          <MapContainer
            center={initCenter}
            zoom={3}
            zoomControl={false}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
            className="map-sepia-filter"
          >
            <ZoomControl position="bottomright" />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <FitBounds photos={mappable} />
            {mappable.map(photo => (
              <Marker
                key={photo.photo_id}
                position={[photo.latitude!, photo.longitude!]}
                icon={getDashPhotoIcon(photo.url ?? photo.thumbnail_url ?? '')}
                zIndexOffset={1000}
                eventHandlers={{
                  click: () => onPhotoClick(photo),
                }}
              >
                <Popup
                  className="voyalog-photo-popup"
                  minWidth={320}
                  maxWidth={380}
                  offset={[0, -20]}
                >
                  <div style={{ fontFamily: 'var(--font-main)', minWidth: '320px' }}>
                    {/* Photo */}
                    <div style={{ position: 'relative', width: '100%', height: '200px', overflow: 'hidden' }}>
                      <img
                        src={photo.url}
                        alt={photo.title ?? photo.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)',
                        pointerEvents: 'none',
                      }} />
                    </div>
                    {/* Metadata */}
                    <div style={{ padding: '0.9rem 1rem' }}>
                      {photo.date && (
                        <div style={{
                          fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)',
                          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.3rem',
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                          <span style={{ width: '14px', height: '1px', background: 'var(--accent)', display: 'inline-block' }} />
                          {photo.date}
                        </div>
                      )}
                      <h4 style={{
                        margin: '0 0 0.3rem', fontWeight: 800,
                        color: 'var(--text-primary)', fontSize: '1rem',
                        fontFamily: 'var(--font-main)', lineHeight: 1.25,
                      }}>
                        {photo.title ?? photo.filename}
                      </h4>
                      {photo.location && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem' }}>
                          📍 {photo.location}
                        </p>
                      )}
                      {photo.description && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                          "{photo.description}"
                        </p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Sidebar: unmapped photos */}
      {unmapped.length > 0 && (
        <div style={{
          width: '200px', flexShrink: 0,
          borderLeft: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}>
            No location ({unmapped.length})
          </div>
          {unmapped.map(photo => (
            <div
              key={photo.photo_id}
              onClick={() => onPhotoClick(photo)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 0.85rem',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-color)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '0.4rem', overflow: 'hidden', flexShrink: 0,
                background: 'var(--border-color)',
              }}>
                <img src={photo.url} alt={photo.title ?? photo.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-main)' }}>
                  {photo.title ?? photo.filename}
                </p>
                {photo.date && <p style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)' }}>{photo.date}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

      {/* ── Keyframes injected via style tag ── */}
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
