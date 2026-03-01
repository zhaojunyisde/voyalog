import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPost } from '../services/api';

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 1rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-main)',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
};

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '0.75rem',
    borderRadius: '2rem',
    background: disabled ? 'rgba(0,128,128,0.45)' : 'var(--accent)',
    color: 'var(--bg-primary)',
    fontWeight: 700,
    fontSize: '1rem',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginTop: '0.5rem',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-main)',
});

const linkBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-main)',
};

// ─── Types & Props ────────────────────────────────────────────────────────────

type ModalView = 'login' | 'signup' | 'confirm' | 'forgot' | 'reset';

interface AuthModalProps {
    isOpen: boolean;
    initialView?: 'login' | 'signup';
    onClose: () => void;
}

// ─── Error Box ────────────────────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
    if (!message) return null;
    return (
        <div style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            color: '#dc2626',
            fontSize: '0.9rem',
            marginBottom: '1.25rem',
        }}>{message}</div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, initialView = 'login', onClose }) => {
    const { login } = useAuth();
    const navigate = useNavigate();

    // View state
    const [view, setView] = useState<ModalView>(initialView);

    // Animate in/out
    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Login state
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });

    // Signup state
    const [signupForm, setSignupForm] = useState({ username: '', email: '', full_name: '', password: '' });
    const [signupUsername, setSignupUsername] = useState('');
    const [confirmCode, setConfirmCode] = useState('');

    // Forgot password state
    const [forgotEmail, setForgotEmail] = useState('');
    const [resetForm, setResetForm] = useState({ code: '', new_password: '' });

    // Shared
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const firstInputRef = useRef<HTMLInputElement>(null);

    // Handle open/close animation
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            // Small delay to trigger CSS transition
            requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
        } else {
            setVisible(false);
            const timer = setTimeout(() => setMounted(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Reset view when opener changes initial view
    useEffect(() => {
        if (isOpen) {
            setView(initialView);
            setError('');
        }
    }, [isOpen, initialView]);

    // Prevent background scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Focus first input on view change
    useEffect(() => {
        if (visible) {
            const t = setTimeout(() => firstInputRef.current?.focus(), 50);
            return () => clearTimeout(t);
        }
    }, [view, visible]);

    const resetAll = () => {
        setLoginForm({ username: '', password: '' });
        setSignupForm({ username: '', email: '', full_name: '', password: '' });
        setConfirmCode('');
        setForgotEmail('');
        setResetForm({ code: '', new_password: '' });
        setError('');
        setLoading(false);
    };

    const handleClose = () => {
        resetAll();
        onClose();
    };

    const switchView = (v: ModalView) => {
        setError('');
        setView(v);
    };

    // ── Login ──────────────────────────────────────────────────────────────────

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(loginForm.username, loginForm.password);
            handleClose();
            navigate('/dashboard');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.toLowerCase().includes('notauthorized') || msg.toLowerCase().includes('incorrect username or password')) {
                setError('Incorrect email or password. Please try again.');
            } else if (msg.toLowerCase().includes('usernotfound') || msg.toLowerCase().includes('user does not exist')) {
                setError('No account found with that email.');
            } else {
                setError(msg || 'Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Signup ─────────────────────────────────────────────────────────────────

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await apiPost('/auth/signup', signupForm);
            setSignupUsername(signupForm.username);
            setView('confirm');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await apiPost('/auth/confirm', { username: signupUsername, confirmation_code: confirmCode });
            // After confirm, go to login view
            resetAll();
            setView('login');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Confirmation failed');
        } finally {
            setLoading(false);
        }
    };

    // ── Forgot Password ────────────────────────────────────────────────────────

    const handleForgotRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await apiPost('/auth/forgot-password', { email: forgotEmail });
            setView('reset');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Request failed');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await apiPost('/auth/reset-password', {
                email: forgotEmail,
                code: resetForm.code,
                new_password: resetForm.new_password,
            });
            resetAll();
            setView('login');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Reset failed');
        } finally {
            setLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    if (!mounted) return null;

    return (
        <div
            onClick={handleClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
                backdropFilter: visible ? 'blur(6px)' : 'blur(0px)',
                WebkitBackdropFilter: visible ? 'blur(6px)' : 'blur(0px)',
                transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
            }}
        >
            {/* Modal card */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '1.5rem',
                    padding: '2.5rem',
                    width: '100%',
                    maxWidth: '420px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
                    fontFamily: 'var(--font-main)',
                    position: 'relative',
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
                    transition: 'opacity 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1)',
                }}
            >
                {/* Close button */}
                <button
                    onClick={handleClose}
                    aria-label="Close"
                    style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: '1.25rem',
                        lineHeight: 1,
                        padding: '0.25rem',
                        borderRadius: '0.5rem',
                        transition: 'color 0.2s, background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                        e.currentTarget.style.background = 'var(--border-color)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.background = 'none';
                    }}
                >
                    ✕
                </button>

                {/* ── LOGIN VIEW ── */}
                {view === 'login' && (
                    <>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                            Welcome back
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.9rem' }}>
                            Sign in to your Voyalog account
                        </p>
                        <ErrorBox message={error} />
                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Email</label>
                                <input
                                    ref={firstInputRef}
                                    type="email"
                                    required
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Password</label>
                                <input
                                    type="password"
                                    required
                                    value={loginForm.password}
                                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="••••••••"
                                />
                            </div>
                            <button type="submit" disabled={loading} style={btnPrimary(loading)}>
                                {loading ? 'Signing in…' : 'Sign In'}
                            </button>
                        </form>
                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Don't have an account?{' '}
                                <button style={linkBtn} onClick={() => switchView('signup')}>Join Voyalog</button>
                            </p>
                            <button style={{ ...linkBtn, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 400 }} onClick={() => switchView('forgot')}>
                                Forgot password?
                            </button>
                        </div>
                    </>
                )}

                {/* ── SIGNUP VIEW ── */}
                {view === 'signup' && (
                    <>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                            Join Voyalog
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.9rem' }}>
                            Create your account to start exploring
                        </p>
                        <ErrorBox message={error} />
                        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Username</label>
                                <input
                                    ref={firstInputRef}
                                    type="text"
                                    required
                                    value={signupForm.username}
                                    onChange={(e) => setSignupForm((f) => ({ ...f, username: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="your_username"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={signupForm.full_name}
                                    onChange={(e) => setSignupForm((f) => ({ ...f, full_name: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="Jane Doe"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Email</label>
                                <input
                                    type="email"
                                    required
                                    value={signupForm.email}
                                    onChange={(e) => setSignupForm((f) => ({ ...f, email: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="jane@example.com"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Password</label>
                                <input
                                    type="password"
                                    required
                                    value={signupForm.password}
                                    onChange={(e) => setSignupForm((f) => ({ ...f, password: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="Min 8 chars, upper, number, symbol"
                                />
                            </div>
                            <button type="submit" disabled={loading} style={btnPrimary(loading)}>
                                {loading ? 'Creating account…' : 'Create Account'}
                            </button>
                        </form>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '1.5rem', textAlign: 'center' }}>
                            Already have an account?{' '}
                            <button style={linkBtn} onClick={() => switchView('login')}>Sign In</button>
                        </p>
                    </>
                )}

                {/* ── CONFIRM VIEW ── */}
                {view === 'confirm' && (
                    <>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                            Check your email
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.9rem' }}>
                            We sent a confirmation code to your email. Enter it below.
                        </p>
                        <ErrorBox message={error} />
                        <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Confirmation Code</label>
                                <input
                                    ref={firstInputRef}
                                    type="text"
                                    required
                                    value={confirmCode}
                                    onChange={(e) => setConfirmCode(e.target.value)}
                                    style={{ ...inputStyle, letterSpacing: '0.2em', fontSize: '1.1rem' }}
                                    placeholder="123456"
                                    maxLength={6}
                                />
                            </div>
                            <button type="submit" disabled={loading} style={btnPrimary(loading)}>
                                {loading ? 'Confirming…' : 'Confirm Account'}
                            </button>
                        </form>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center' }}>
                            Didn't get an email? Check your spam folder.
                        </p>
                    </>
                )}

                {/* ── FORGOT PASSWORD VIEW ── */}
                {view === 'forgot' && (
                    <>
                        <button style={{ ...linkBtn, fontSize: '0.875rem', marginBottom: '1rem' }} onClick={() => switchView('login')}>
                            ← Back to Sign In
                        </button>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                            Reset password
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.9rem' }}>
                            Enter your email and we'll send a reset code.
                        </p>
                        <ErrorBox message={error} />
                        <form onSubmit={handleForgotRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Email</label>
                                <input
                                    ref={firstInputRef}
                                    type="email"
                                    required
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    style={inputStyle}
                                    placeholder="you@example.com"
                                />
                            </div>
                            <button type="submit" disabled={loading} style={btnPrimary(loading)}>
                                {loading ? 'Sending…' : 'Send Reset Code'}
                            </button>
                        </form>
                    </>
                )}

                {/* ── RESET PASSWORD VIEW ── */}
                {view === 'reset' && (
                    <>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                            Enter new password
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.9rem' }}>
                            Check your email for the reset code.
                        </p>
                        <ErrorBox message={error} />
                        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Reset Code</label>
                                <input
                                    ref={firstInputRef}
                                    type="text"
                                    required
                                    value={resetForm.code}
                                    onChange={(e) => setResetForm((f) => ({ ...f, code: e.target.value }))}
                                    style={{ ...inputStyle, letterSpacing: '0.2em' }}
                                    placeholder="123456"
                                    maxLength={6}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={resetForm.new_password}
                                    onChange={(e) => setResetForm((f) => ({ ...f, new_password: e.target.value }))}
                                    style={inputStyle}
                                    placeholder="••••••••"
                                />
                            </div>
                            <button type="submit" disabled={loading} style={btnPrimary(loading)}>
                                {loading ? 'Resetting…' : 'Reset Password'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};
