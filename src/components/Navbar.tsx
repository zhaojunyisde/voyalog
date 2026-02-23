import React from 'react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => (
    <nav className="glass" style={{
        position: 'fixed',
        top: '0', left: '0', right: '0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--nav-pad)',
        zIndex: 100,
        pointerEvents: 'none'
    }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800', fontSize: '1.25rem', fontFamily: 'var(--font-main)' }}>
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <img src="/logo.svg" alt="Voyalog Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ letterSpacing: '-0.02em' }}>VOYALOG</span>
        </div>
        <div className="nav-links" style={{ pointerEvents: 'auto' }}>
            <Link to="/explore" className="nav-link">Explore</Link>
            <Link to="/about" className="nav-link">About</Link>
            <Link to="/login" style={{
                padding: '0.5rem 1.2rem',
                borderRadius: '2rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                transition: 'all 0.3s ease',
                color: 'var(--text-primary)',
                fontSize: '0.9rem'
            }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--text-primary)';
                    e.currentTarget.style.color = 'var(--bg-primary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                }}
            >Sign In</Link>
            <Link to="/signup" style={{
                padding: '0.5rem 1.2rem',
                borderRadius: '2rem',
                background: 'var(--accent)',
                color: 'var(--bg-primary)',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                fontSize: '0.9rem'
            }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >Join</Link>
        </div>
    </nav>
);
