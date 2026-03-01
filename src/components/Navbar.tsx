import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

interface NavbarProps {
    onSignIn?: () => void;
    onJoin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSignIn, onJoin }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!dropdownOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [dropdownOpen]);

    const handleLogout = async () => {
        setDropdownOpen(false);
        await logout();
        navigate('/');
    };

    // Derive initials from username
    const initials = user?.username
        ? user.username.slice(0, 2).toUpperCase()
        : '?';

    return (
        <nav className="glass" style={{
            position: 'fixed',
            top: '0', left: '0', right: '0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--nav-pad)',
            zIndex: 100,
            pointerEvents: 'none',
        }}>
            {/* Logo */}
            <Link to="/" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800', fontSize: '1.25rem', fontFamily: 'var(--font-main)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/logo.svg" alt="Voyalog Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{ letterSpacing: '-0.02em' }}>VOYALOG</span>
            </Link>

            {/* Right side nav */}
            <div className="nav-links" style={{ pointerEvents: 'auto' }}>
                <Link to="/explore" className="nav-link">Explore</Link>
                <Link to="/about" className="nav-link">About</Link>

                {user ? (
                    /* ── Logged-in: Avatar + Dropdown ── */
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setDropdownOpen((o) => !o)}
                            aria-label="User menu"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.55rem',
                                padding: '0.4rem 0.9rem 0.4rem 0.45rem',
                                borderRadius: '2rem',
                                background: dropdownOpen ? 'var(--text-primary)' : 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-main)',
                                transition: 'all 0.2s ease',
                                color: dropdownOpen ? 'var(--bg-primary)' : 'var(--text-primary)',
                            }}
                            onMouseEnter={(e) => {
                                if (!dropdownOpen) {
                                    e.currentTarget.style.background = 'var(--text-primary)';
                                    e.currentTarget.style.color = 'var(--bg-primary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!dropdownOpen) {
                                    e.currentTarget.style.background = 'var(--bg-secondary)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }
                            }}
                        >
                            {/* Avatar circle */}
                            <span style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                color: 'var(--bg-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                letterSpacing: '0.02em',
                                flexShrink: 0,
                            }}>
                                {initials}
                            </span>
                            {/* Username */}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user.username}
                            </span>
                            {/* Chevron */}
                            <span style={{
                                fontSize: '0.6rem',
                                opacity: 0.7,
                                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                                marginLeft: '2px',
                            }}>▼</span>
                        </button>

                        {/* Dropdown menu */}
                        {dropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 0.5rem)',
                                right: 0,
                                minWidth: '160px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '1rem',
                                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                                overflow: 'hidden',
                                animation: 'fadeIn 0.15s ease',
                                zIndex: 200,
                            }}>
                                <button
                                    onClick={() => { setDropdownOpen(false); navigate('/dashboard'); }}
                                    style={dropdownItemStyle}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--accent-light)';
                                        e.currentTarget.style.color = 'var(--accent)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }}
                                >
                                    <span style={{ fontSize: '1rem' }}>🗺️</span>
                                    Dashboard
                                </button>
                                <div style={{ height: '1px', background: 'var(--border-color)', margin: '0 0.75rem' }} />
                                <button
                                    onClick={handleLogout}
                                    style={dropdownItemStyle}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(220,38,38,0.07)';
                                        e.currentTarget.style.color = '#dc2626';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }}
                                >
                                    <span style={{ fontSize: '1rem' }}>↩︎</span>
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Guest: Sign In + Join ── */
                    <>
                        <button
                            onClick={onSignIn}
                            style={{
                                padding: '0.5rem 1.2rem',
                                borderRadius: '2rem',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                transition: 'all 0.3s ease',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                fontFamily: 'var(--font-main)',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--text-primary)';
                                e.currentTarget.style.color = 'var(--bg-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                        >Sign In</button>
                        <button
                            onClick={onJoin}
                            style={{
                                padding: '0.5rem 1.2rem',
                                borderRadius: '2rem',
                                background: 'var(--accent)',
                                color: 'var(--bg-primary)',
                                fontWeight: '600',
                                transition: 'all 0.3s ease',
                                fontSize: '0.9rem',
                                fontFamily: 'var(--font-main)',
                                cursor: 'pointer',
                                border: 'none',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '0.9';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '1';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >Join</button>
                    </>
                )}
            </div>
        </nav>
    );
};

const dropdownItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    width: '100%',
    padding: '0.7rem 1rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-main)',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    textAlign: 'left',
    transition: 'background 0.15s, color 0.15s',
};
