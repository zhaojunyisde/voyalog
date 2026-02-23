import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { SAMPLE_PHOTOS } from '../data/photographyData';
import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

// Custom Marker Icon generated per photo
const createPhotoIcon = (url: string) => L.divIcon({
    className: 'custom-photo-marker',
    html: `<div style="
        width: 45px; 
        height: 45px; 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        background-image: url(${url});
        background-size: cover;
        background-position: center;
        opacity: 0.8;
        cursor: pointer;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
    " onmouseover="this.style.transform='scale(1.2) translateY(-5px)'; this.style.opacity='1'; window.dispatchEvent(new Event('map-hover-start'))" onmouseout="this.style.transform='scale(1) translateY(0)'; this.style.opacity='0.8'; window.dispatchEvent(new Event('map-hover-end'))"></div>`,
    iconSize: [45, 45],
    iconAnchor: [22, 22]
});

const PhotoMarkers = () => {
    const map = useMap();
    const [offsets, setOffsets] = useState([-360, 0, 360]);

    useEffect(() => {
        const updateOffsets = () => {
            const centerLng = map.getCenter().lng;
            const centerWorld = Math.round(centerLng / 360);

            const newOffsets = [
                (centerWorld - 2) * 360,
                (centerWorld - 1) * 360,
                centerWorld * 360,
                (centerWorld + 1) * 360,
                (centerWorld + 2) * 360
            ];

            setOffsets(prev =>
                prev.length === newOffsets.length && prev.every((v, i) => v === newOffsets[i])
                    ? prev
                    : newOffsets
            );
        };

        map.on('move', updateOffsets);
        updateOffsets();

        return () => {
            map.off('move', updateOffsets);
        };
    }, [map]);

    return (
        <>
            {SAMPLE_PHOTOS.flatMap(photo => {
                const [lat, lng] = photo.coordinates;
                return offsets.map(offset => (
                    <Marker
                        key={`${photo.id}-${offset}`}
                        position={[lat, lng + offset]}
                        icon={createPhotoIcon(photo.thumbnailUrl)}
                        eventHandlers={{
                            click: () => {
                                map.panTo([map.getCenter().lat, lng + offset], { animate: true });
                            }
                        }}
                    >
                        <Popup
                            className={`voyalog-photo-popup ${lat > 20 ? 'popup-down' : ''}`}
                            minWidth={620}
                            offset={lat > 20 ? [0, 20] : [0, -20]}
                            autoPan={false}
                        >
                            <div style={{ display: 'flex', flexDirection: 'row', margin: '0', minWidth: '620px' }}>
                                {/* Left: Image */}
                                <div style={{ position: 'relative', flex: '1 1 60%', minWidth: 0 }}>
                                    <img
                                        src={photo.fullImageUrl}
                                        alt={photo.locationName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                    <a
                                        href={photo.fullImageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            position: 'absolute',
                                            bottom: '12px', right: '12px',
                                            background: 'rgba(0,0,0,0.5)',
                                            backdropFilter: 'blur(4px)',
                                            color: 'white',
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <ExternalLink size={14} /> Full Res
                                    </a>
                                </div>
                                {/* Right: Metadata Panel */}
                                <div style={{
                                    flex: '0 0 220px',
                                    padding: '28px 24px',
                                    background: 'var(--bg-primary)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    borderLeft: '1px solid var(--border-color)'
                                }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        color: 'var(--accent)', fontSize: '0.75rem',
                                        fontWeight: '700', letterSpacing: '0.1em',
                                        textTransform: 'uppercase'
                                    }}>
                                        <span style={{ width: '20px', height: '1px', background: 'var(--accent)', display: 'inline-block' }}></span>
                                        {photo.date}
                                    </div>
                                    <h4 style={{
                                        margin: '0', fontWeight: '800',
                                        color: 'var(--text-primary)', fontSize: '1.3rem',
                                        fontFamily: 'var(--font-main)', lineHeight: '1.3'
                                    }}>{photo.locationName}</h4>
                                    {photo.description && (
                                        <p style={{
                                            fontSize: '0.88rem', color: 'var(--text-secondary)',
                                            fontStyle: 'italic', lineHeight: '1.6', margin: '0'
                                        }}>"{photo.description}"</p>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ));
            })}
        </>
    );
};


const AutoPan = () => {
    const map = useMap();

    useEffect(() => {
        let animationId: number;
        let isInteracting = false;
        let lastTime = performance.now();
        let xAccumulator = 0;
        const pixelsPerSecond = 15; // Slow, smooth pan

        let isPopupOpen = false;

        const handleInteractionStart = () => { isInteracting = true; };
        const handleInteractionEnd = () => {
            if (!isPopupOpen) {
                isInteracting = false;
                lastTime = performance.now();
            }
        };

        const handlePopupOpen = () => {
            isPopupOpen = true;
            isInteracting = true;
            window.dispatchEvent(new Event('map-focus-start'));
        };

        const handlePopupClose = () => {
            isPopupOpen = false;
            isInteracting = false;
            lastTime = performance.now();
            window.dispatchEvent(new Event('map-focus-end'));
        };

        map.on('dragstart mousedown touchstart', handleInteractionStart);
        map.on('dragend mouseup touchend', handleInteractionEnd);
        map.on('popupopen', handlePopupOpen);
        map.on('popupclose', handlePopupClose);

        window.addEventListener('map-hover-start', handleInteractionStart);
        window.addEventListener('map-hover-end', handleInteractionEnd);

        const pan = (time: number) => {
            const deltaTime = (time - lastTime) / 1000;
            lastTime = time;

            if (!isInteracting && deltaTime < 0.1) { // Cap delta time to prevent large jumps if tab is inactive
                xAccumulator += pixelsPerSecond * deltaTime;
                if (xAccumulator >= 1) {
                    const pixelsToPan = Math.floor(xAccumulator);
                    map.panBy([pixelsToPan, 0], { animate: false });
                    xAccumulator -= pixelsToPan;
                }
            }
            animationId = requestAnimationFrame(pan);
        };

        animationId = requestAnimationFrame(pan);

        return () => {
            cancelAnimationFrame(animationId);
            map.off('dragstart mousedown touchstart', handleInteractionStart);
            map.off('dragend mouseup touchend', handleInteractionEnd);
            map.off('popupopen', handlePopupOpen);
            map.off('popupclose', handlePopupClose);
            window.removeEventListener('map-hover-start', handleInteractionStart);
            window.removeEventListener('map-hover-end', handleInteractionEnd);
        };
    }, [map]);

    return null;
};

export default function MapBackground() {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 0,
            pointerEvents: 'auto' // Make map interactable
        }}>
            <MapContainer
                center={[20, 0]}
                zoom={3.0}
                zoomControl={false} // Hidden for cleaner map background
                dragging={false} // User cannot move map
                scrollWheelZoom={false} // Disabled so users don't zoom in while scrolling
                doubleClickZoom={false}
                touchZoom={false}
                keyboard={false} // Disable keyboard navigation
                attributionControl={false}
                style={{ height: '100%', width: '100%' }}
                className="map-sepia-filter bg-map"
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                <AutoPan />
                <PhotoMarkers />
            </MapContainer>

            {/* White overlay to soften the map slightly and make text pop */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(253, 252, 240, 0.45)', // matching --bg-primary but transparent
                zIndex: 10,
                pointerEvents: 'none' // Ensure clicks pass through the overlay to the map
            }}></div>
        </div>
    );
}
