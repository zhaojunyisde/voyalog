import React, { useRef, useState, useEffect } from 'react';
import { Map, Camera, Users, ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import MapBackground from '../components/MapBackground';
import { Navbar } from '../components/Navbar';

export const LandingPage: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMapFocused, setIsMapFocused] = useState(false);

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

    // Track scroll position within the container
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    // Apple-like animations based on scrollYProgress (0 to 1 over the 350vh container)
    const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.9]);
    const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -100]);

    // Map is always visible in the background, but scales down slightly
    const mapScale = useTransform(scrollYProgress, [0, 0.3], [1.1, 1]);

    const featuresOpacity = useTransform(scrollYProgress, [0.6, 0.8], [0, 1]);
    const featuresY = useTransform(scrollYProgress, [0.6, 0.8], [100, 0]);
    const cardPointerEvents = useTransform(scrollYProgress, (v) => v > 0.5 ? 'auto' : 'none') as any;


    return (
        <div ref={containerRef} style={{ position: 'relative', height: '350vh', backgroundColor: 'var(--bg-primary)' }}>
            <Navbar />

            {/* STICKY CONTAINER - Holds the layers that animate based on scroll */}
            <div style={{ position: 'sticky', top: 0, height: '100vh', width: '100vw', overflow: 'hidden' }}>

                {/* LAYER 1: The Map Background */}
                <motion.div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    scale: mapScale,
                    pointerEvents: 'auto',
                    zIndex: 1
                }}>
                    <MapBackground />
                </motion.div>

                {/* LAYER 2: Introduction Hero (Fades out First) */}
                <motion.div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    opacity: heroOpacity,
                    scale: heroScale,
                    y: heroY,
                    zIndex: 2,
                    padding: '0 2rem',
                    pointerEvents: 'none'
                }}>
                    <motion.div
                        initial={false}
                        animate={{
                            opacity: isMapFocused ? 0 : 1,
                            scale: isMapFocused ? 1.05 : 1,
                            filter: isMapFocused ? 'blur(8px)' : 'blur(0px)'
                        }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                        style={{ pointerEvents: 'none', textAlign: 'center', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', background: 'rgba(253, 252, 240, 0.6)', padding: '2rem', borderRadius: '2rem', backdropFilter: 'blur(10px)' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 1rem', borderRadius: '2rem',
                            background: 'var(--accent-light)', color: 'var(--accent)',
                            fontWeight: '600', fontSize: '0.875rem', marginBottom: '1rem',
                            border: '1px solid var(--border-color)'
                        }}>
                            <img src="/logo.svg" alt="" style={{ width: '18px', height: '18px' }} /> NEXT GENERATION TRAVEL LOG
                        </div>

                        <h1 style={{ fontSize: '5rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                            <span style={{ textDecoration: 'underline wavy var(--accent)', textUnderlineOffset: '12px' }}>Map</span> your memories.<br />Share your world.
                        </h1>

                        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: '1.6', marginTop: '1rem' }}>
                            Upload your travel photos, pin them on a beautifully rendered vintage map, and share your adventures visually.
                        </p>

                        <motion.div
                            animate={{ y: [0, 10, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            style={{ marginTop: '4rem', opacity: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scroll to explore</span>
                            <div style={{ width: '1px', height: '40px', background: 'var(--text-primary)' }}></div>
                        </motion.div>
                    </motion.div>
                </motion.div>

                {/* LAYER 3: Feature Cards overlay (Fades in Last) */}
                <motion.div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '4rem 2rem',
                    background: 'linear-gradient(to top, var(--bg-primary) 20%, transparent)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    opacity: featuresOpacity,
                    y: featuresY,
                    pointerEvents: 'none',
                    zIndex: 3
                }}>
                    <motion.div
                        initial={false}
                        animate={{
                            opacity: isMapFocused ? 0 : 1,
                            scale: isMapFocused ? 1.05 : 1,
                            filter: isMapFocused ? 'blur(8px)' : 'blur(0px)'
                        }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                    >
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '2rem', width: '100%', maxWidth: '1000px',
                            pointerEvents: 'none' // Default to none, let children be auto
                        }}>
                            {[
                                { icon: <Map size={32} color="var(--accent)" />, title: 'Interactive Maps', desc: 'Beautifully rendered vintage maps tailored to showcase your travel routes and photo spots.' },
                                { icon: <Camera size={32} color="var(--accent)" />, title: 'High-Res Galleries', desc: 'Securely upload your photos with their EXIF data intact to automatically plot locations.' },
                                { icon: <Users size={32} color="var(--accent)" />, title: 'Multi-User Sync', desc: 'Invite friends to collaborative albums. See everyone’s paths intersect on a single map.' }
                            ].map((feat, i) => (
                                <div key={i} className="glass-panel" style={{
                                    padding: '2.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                    pointerEvents: cardPointerEvents // Make cards interactable only when visible
                                }}>
                                    <div style={{
                                        background: 'var(--accent-light)', width: '64px', height: '64px',
                                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        {feat.icon}
                                    </div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginTop: '0.5rem' }}>{feat.title}</h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>{feat.desc}</p>
                                </div>
                            ))}
                        </div>
                        <motion.div style={{ marginTop: '4rem', marginBottom: '2rem', pointerEvents: cardPointerEvents }}>
                            <Link to="/signup" style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '1rem 2.5rem', borderRadius: '3rem',
                                background: 'var(--accent)', color: 'var(--bg-primary)',
                                fontWeight: '700', fontSize: '1.1rem',
                                boxShadow: '0 10px 30px rgba(0, 128, 128, 0.3)',
                                transition: 'all 0.3s ease'
                            }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 15px 35px rgba(0, 128, 128, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 128, 128, 0.3)';
                                }}
                            >
                                Join Voyalog <ArrowRight size={20} />
                            </Link>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </div>

            <footer style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)',
                zIndex: 10, fontSize: '0.85rem', pointerEvents: 'none'
            }}>
                <p>&copy; 2026 Voyalog. All rights reserved.</p>
            </footer>
        </div>
    );
};
