import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { inputStyle } from '../utils/styles';

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

export interface LocationPickerMapProps {
    lat?: number;
    lng?: number;
    geocoding: boolean;
    locationName: string;
    onPinChange: (lat: number, lng: number) => void;
}

export function LocationPickerMap({ lat, lng, geocoding, locationName, onPinChange }: LocationPickerMapProps) {
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
                                    const { lat: markerLat, lng: markerLng } = (e.target as L.Marker).getLatLng();
                                    onPinChange(markerLat, markerLng);
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
