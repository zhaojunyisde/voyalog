import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { SAMPLE_PHOTOS } from '../data/photographyData';
import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useIsMobile } from '../hooks/useMobile';

// Custom Marker Icon generated per photo - Memoized cache
const iconCache: Record<string, L.DivIcon> = {};
const getPhotoIcon = (url: string, isMobile: boolean) => {
    const key = `${url}-${isMobile}`;
    if (iconCache[key]) return iconCache[key];

    const size = isMobile ? 36 : 45;
    const icon = L.divIcon({
        className: 'custom-photo-marker',
        html: `<div style="
        width: ${size}px; 
        height: ${size}px; 
        border-radius: 50%; 
        border: ${isMobile ? '2px' : '3px'} solid white; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        background-image: url(${url});
        background-size: cover;
        background-position: center;
        opacity: 0.8;
        cursor: pointer;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
    " onmouseover="this.style.transform='scale(1.2) translateY(-5px)'; this.style.opacity='1'; window.dispatchEvent(new Event('map-hover-start'))" onmouseout="this.style.transform='scale(1) translateY(0)'; this.style.opacity='0.8'; window.dispatchEvent(new Event('map-hover-end'))"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
    iconCache[key] = icon;
    return icon;
};

const PhotoMarkers = () => {
    const map = useMap();
    const isMobile = useIsMobile();
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

    const [popupDirections, setPopupDirections] = useState<Record<string, boolean>>({});
    const [popupMaxHeights, setPopupMaxHeights] = useState<Record<string, number>>({});

    useEffect(() => {
        let throttleTimer: ReturnType<typeof setTimeout> | null = null;
        const updateDirections = () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                throttleTimer = null;
                const mapHeight = map.getSize().y;
                const directions: Record<string, boolean> = {};
                const maxHeights: Record<string, number> = {};
                SAMPLE_PHOTOS.forEach(photo => {
                    const [lat, lng] = photo.coordinates;
                    offsets.forEach(offset => {
                        const key = `${photo.id}-${offset}`;
                        const point = map.latLngToContainerPoint([lat, lng + offset]);
                        const isInTopHalf = point.y < mapHeight / 2;
                        directions[key] = isInTopHalf;
                        const availableH = isInTopHalf
                            ? mapHeight - point.y - 60
                            : point.y - 60;
                        maxHeights[key] = Math.max(availableH, 150);
                    });
                });
                setPopupDirections(prev => {
                    const changed = Object.keys(directions).some(k => prev[k] !== directions[k]);
                    return changed ? directions : prev;
                });
                setPopupMaxHeights(prev => {
                    const changed = Object.keys(maxHeights).some(k => Math.abs((prev[k] ?? 0) - maxHeights[k]) > 20);
                    return changed ? maxHeights : prev;
                });
            }, 500);
        };
        map.on('move', updateDirections);
        updateDirections();
        return () => {
            map.off('move', updateDirections);
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [map, offsets]);

    return (
        <>
            {SAMPLE_PHOTOS.flatMap(photo => {
                const [lat, lng] = photo.coordinates;
                return offsets.map(offset => {
                    const key = `${photo.id}-${offset}`;
                    const openDown = popupDirections[key] ?? false;
                    const maxH = popupMaxHeights[key] ?? 400;
                    // Scale width proportionally when height is constrained
                    const idealH = 350;
                    const scale = Math.min(1, maxH / idealH);
                    const popupW = isMobile ? `${Math.round(75 * scale)}vw` : 'auto';
                    return (
                        <Marker
                            key={key}
                            position={[lat, lng + offset]}
                            icon={getPhotoIcon(photo.thumbnailUrl, isMobile)}
                            zIndexOffset={1000}
                            eventHandlers={{
                                click: () => {
                                    map.panTo([map.getCenter().lat, lng + offset], { animate: true });
                                }
                            }}
                        >
                            <Popup
                                key={`popup-${key}-${openDown}`}
                                className={`voyalog-photo-popup ${openDown ? 'popup-down' : ''} ${isMobile ? 'popup-mobile' : ''}`}
                                minWidth={isMobile ? undefined : 620}
                                maxWidth={isMobile ? undefined : 700}
                                offset={openDown ? [0, 20] : [0, -20]}
                                autoPan={false}
                            >
                                <div style={{
                                    display: 'flex',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    margin: '0',
                                    minWidth: isMobile ? 'auto' : '620px',
                                    width: isMobile ? popupW : 'auto',
                                    maxWidth: isMobile ? popupW : 'none',
                                    maxHeight: isMobile ? `${maxH}px` : 'none',
                                    overflow: 'hidden'
                                }}>
                                    {/* Left: Image */}
                                    <div style={{
                                        position: 'relative',
                                        flex: isMobile ? 'none' : '1 1 60%',
                                        minWidth: 0
                                    }}>
                                        <img
                                            src={photo.fullImageUrl}
                                            alt={photo.locationName}
                                            style={{
                                                width: '100%',
                                                height: isMobile ? 'auto' : '100%',
                                                maxHeight: isMobile ? `${Math.max(maxH - 80, 100)}px` : 'none',
                                                objectFit: 'cover',
                                                display: 'block'
                                            }}
                                        />
                                        <a
                                            href={photo.fullImageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                position: 'absolute',
                                                bottom: isMobile ? '8px' : '12px',
                                                right: isMobile ? '8px' : '12px',
                                                background: 'rgba(0,0,0,0.5)',
                                                backdropFilter: 'blur(4px)',
                                                color: 'white',
                                                padding: isMobile ? '8px' : '6px 12px',
                                                borderRadius: '20px',
                                                textDecoration: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: isMobile ? '0' : '6px',
                                                fontSize: '0.75rem',
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
                                            <ExternalLink size={isMobile ? 16 : 14} />{!isMobile && ' Full Res'}
                                        </a>
                                    </div>
                                    {/* Right: Metadata Panel */}
                                    <div style={{
                                        flex: isMobile ? 'none' : '0 0 220px',
                                        padding: isMobile ? '0.75rem 1rem' : '28px 24px',
                                        background: 'var(--bg-primary)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        gap: isMobile ? '0.25rem' : '0.5rem',
                                        borderLeft: isMobile ? 'none' : '1px solid var(--border-color)',
                                        borderTop: isMobile ? '1px solid var(--border-color)' : 'none'
                                    }}>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            color: 'var(--accent)', fontSize: isMobile ? '0.6rem' : '0.7rem',
                                            fontWeight: '700', letterSpacing: '0.1em',
                                            textTransform: 'uppercase'
                                        }}>
                                            <span style={{ width: '16px', height: '1px', background: 'var(--accent)', display: 'inline-block' }}></span>
                                            {photo.date}
                                        </div>
                                        <h4 style={{
                                            margin: '0', fontWeight: '800',
                                            color: 'var(--text-primary)', fontSize: isMobile ? '0.9rem' : '1.3rem',
                                            fontFamily: 'var(--font-main)', lineHeight: '1.3'
                                        }}>{photo.locationName}</h4>
                                        {photo.description && (
                                            <p style={{
                                                fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'var(--text-secondary)',
                                                fontStyle: 'italic', lineHeight: isMobile ? '1.3' : '1.5', margin: '0'
                                            }}>"{photo.description}"</p>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                });
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
    const isMobile = useIsMobile();
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            pointerEvents: 'auto' // Make map interactable
        }}>
            <MapContainer
                center={[20, 0]}
                zoom={isMobile ? 2.2 : 3.0}
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
