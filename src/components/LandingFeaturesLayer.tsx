import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Map, Camera, Users, ArrowRight } from 'lucide-react';

interface Props {
    featuresOpacity: any;
    featuresY: any;
    cardPointerEvents: any;
}

const LandingFeaturesLayer: React.FC<Props> = ({ featuresOpacity, featuresY, cardPointerEvents }) => {
    return (
        <motion.div
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '4rem 1rem',
                background: 'linear-gradient(to top, var(--bg-primary) 20%, transparent)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                opacity: featuresOpacity,
                y: featuresY,
                pointerEvents: 'none',
                zIndex: 3,
            }}
        >
            <motion.div
                initial={false}
                animate={{
                    opacity: 1,
                }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
                <div className="feature-grid" style={{ pointerEvents: 'auto' }}>
                    {[
                        {
                            icon: <Map size={28} color="var(--accent)" />,
                            title: 'Interactive Maps',
                            desc: 'Beautifully rendered vintage maps tailored to showcase your travel routes.'
                        },
                        {
                            icon: <Camera size={28} color="var(--accent)" />,
                            title: 'High-Res Galleries',
                            desc: 'Securely upload your photos with EXIF data to automatically plot locations.'
                        },
                        {
                            icon: <Users size={28} color="var(--accent)" />,
                            title: 'Multi-User Sync',
                            desc: 'Invite friends to collaborative albums. See everyone’s paths intersect.'
                        },
                    ].map((feat, i) => (
                        <div key={i} className="glass-panel" style={{
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                            pointerEvents: cardPointerEvents,
                        }}>
                            <div style={{
                                background: 'var(--accent-light)',
                                width: '52px',
                                height: '52px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--border-color)'
                            }}>
                                {feat.icon}
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.25rem' }}>{feat.title}</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.85rem' }}>{feat.desc}</p>
                        </div>
                    ))}
                </div>
                <motion.div style={{ marginTop: '3rem', marginBottom: '1.5rem', pointerEvents: cardPointerEvents }}>
                    <Link
                        to="/signup"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.8rem 2rem',
                            borderRadius: '3rem',
                            background: 'var(--accent)',
                            color: 'var(--bg-primary)',
                            fontWeight: '700',
                            fontSize: '1rem',
                            boxShadow: '0 10px 25px rgba(0, 128, 128, 0.25)',
                            transition: 'all 0.3s ease',
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
    );
};

export default LandingFeaturesLayer;
