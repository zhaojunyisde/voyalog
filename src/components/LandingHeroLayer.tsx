import React from 'react';
import { motion } from 'framer-motion';
import { useIsMobile } from '../hooks/useMobile';

interface Props {
    heroOpacity: any;
    heroScale: any;
    heroY: any;
    isMapFocused: boolean;
}

const LandingHeroLayer: React.FC<Props> = ({ heroOpacity, heroScale, heroY, isMapFocused }) => {
    const isMobile = useIsMobile();

    return (
        <motion.div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: heroOpacity,
                scale: heroScale,
                y: heroY,
                zIndex: 2,
                padding: '0 1.5rem',
                pointerEvents: 'none',
            }}
        >
            <motion.div
                initial={false}
                animate={{
                    opacity: isMapFocused ? 0 : 1,
                    scale: isMapFocused ? 1.05 : 1,
                    filter: isMapFocused ? 'blur(8px)' : 'blur(0px)',
                }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                style={{
                    pointerEvents: 'none',
                    textAlign: 'center',
                    maxWidth: '800px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: isMobile ? '0.75rem' : '1.25rem',
                    background: 'rgba(253, 252, 240, 0.6)',
                    padding: isMobile ? '1.5rem 1rem' : '2.5rem 1.5rem',
                    borderRadius: isMobile ? '1.5rem' : '2rem',
                    backdropFilter: 'blur(10px)',
                }}
            >
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        background: 'var(--accent-light)',
                        color: 'var(--accent)',
                        fontWeight: '600',
                        fontSize: '0.75rem',
                        marginBottom: '0.5rem',
                        border: '1px solid var(--border-color)',
                    }}
                >
                    <img src="/logo.svg" alt="" style={{ width: '16px', height: '16px' }} /> NEXT GEN TRAVEL LOG
                </div>
                <h1 className="hero-title" style={{ fontSize: isMobile ? '1.75rem' : undefined, lineHeight: isMobile ? '1.2' : undefined }}>
                    <span style={{ textDecoration: 'underline wavy var(--accent)', textUnderlineOffset: isMobile ? '4px' : '8px' }}>Map</span> your memories.
                    <br />Share your world.
                </h1>
                <p className="hero-paragraph" style={{ fontSize: isMobile ? '0.9rem' : undefined, maxWidth: isMobile ? '280px' : undefined }}>
                    Upload your travel photos, pin them on a beautifully rendered vintage map, and share your adventures visually.
                </p>
                {!isMobile && (
                    <motion.div
                        animate={{ y: [0, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        style={{
                            marginTop: '3rem',
                            opacity: 0.5,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}
                    >
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Scroll to explore
                        </span>
                        <div style={{ width: '1px', height: '30px', background: 'var(--text-primary)' }} />
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default LandingHeroLayer;
