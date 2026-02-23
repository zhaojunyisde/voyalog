import React, { useRef, useState, useEffect } from 'react';
import { useScroll, useTransform } from 'framer-motion';
import { Navbar } from '../components/Navbar';
import LandingMapLayer from '../components/LandingMapLayer';
import LandingHeroLayer from '../components/LandingHeroLayer';
import LandingFeaturesLayer from '../components/LandingFeaturesLayer';
import { useIsMobile } from '../hooks/useMobile';

export const LandingPage: React.FC = () => {
    const isMobile = useIsMobile();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMapFocused, setIsMapFocused] = useState(false);

    // Map focus listeners
    useEffect(() => {
        const handleFocusStart = () => setIsMapFocused(true);
        const handleFocusEnd = () => setIsMapFocused(false);
        window.addEventListener('map-focus-start', handleFocusStart);
        window.addEventListener('map-focus-end', handleFocusEnd);
        return () => {
            window.removeEventListener('map-focus-start', handleFocusStart);
            window.removeEventListener('map-focus-end', handleFocusEnd);
        };
    }, []);

    // Scroll tracking
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end end'],
    });

    // Hero animations
    const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.9]);
    const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -100]);

    // Map scaling
    const mapScale = useTransform(scrollYProgress, [0, 0.3], [1.1, 1]);

    // Feature animations
    const featuresOpacity = useTransform(scrollYProgress, [0.6, 0.8], [0, 1]);
    const featuresY = useTransform(scrollYProgress, [0.6, 0.8], [100, 0]);
    const cardPointerEvents = useTransform(
        scrollYProgress,
        (v) => (v > 0.5 ? 'auto' : 'none')
    ) as any;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                height: isMobile ? '150vh' : '350vh',
                backgroundColor: 'var(--bg-primary)',
                overflow: 'clip'
            }}
        >
            <Navbar />

            {/* Sticky container that holds all animated layers */}
            <div style={{
                position: 'sticky',
                top: 0,
                height: '100vh',
                width: '100%',
                overflow: 'hidden',
                zIndex: 10
            }}>
                {/* Layer 1 – Map background */}
                <LandingMapLayer mapScale={mapScale} />

                {/* Layer 2 – Hero introduction */}
                <LandingHeroLayer
                    heroOpacity={heroOpacity}
                    heroScale={heroScale}
                    heroY={heroY}
                    isMapFocused={isMapFocused}
                />

                {/* Layer 3 – Feature cards */}
                {!isMobile && (
                    <LandingFeaturesLayer
                        featuresOpacity={featuresOpacity}
                        featuresY={featuresY}
                        cardPointerEvents={cardPointerEvents}
                    />
                )}
            </div>
        </div>
    );
};
