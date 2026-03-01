import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Photo } from '../services/api';

// Memoized icon cache keyed by url
const dashIconCache: Record<string, L.DivIcon> = {};
export function getDashPhotoIcon(url: string, size = 52) {
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
export function FitBounds({ photos }: { photos: Photo[] }) {
    const map = useMap();
    useEffect(() => {
        const pts = photos.filter(p => p.latitude != null && p.longitude != null);
        if (pts.length === 0) return;
        const bounds = L.latLngBounds(pts.map(p => [p.latitude!, p.longitude!]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
    }, [map, photos]);
    return null;
}

export interface DashboardMapViewProps {
    photos: Photo[];
    onPhotoClick: (photo: Photo) => void;
}

export function DashboardMapView({ photos, onPhotoClick }: DashboardMapViewProps) {
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
