import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../services/api';

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

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '0.75rem',
  borderRadius: '2rem',
  background: disabled ? 'rgba(0,128,128,0.5)' : 'var(--accent)',
  color: 'var(--bg-primary)',
  fontWeight: 700,
  fontSize: '1rem',
  border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: '0.5rem',
  transition: 'all 0.2s',
  fontFamily: 'var(--font-main)',
});

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  fontWeight: 600,
  marginBottom: '0.4rem',
};

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [username, setUsername] = useState('');
  const [form, setForm] = useState({ code: '', new_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiPost('/auth/forgot-password', { username });
      setStep('reset');
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
      await apiPost('/auth/reset-password', { username, code: form.code, new_password: form.new_password });
      navigate('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '1.5rem',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 32px rgba(47, 79, 79, 0.08)',
  };

  const errorBox = error ? (
    <div style={{
      background: 'rgba(220, 38, 38, 0.08)',
      border: '1px solid rgba(220, 38, 38, 0.2)',
      borderRadius: '0.75rem',
      padding: '0.75rem 1rem',
      color: '#dc2626',
      fontSize: '0.9rem',
      marginBottom: '1.25rem',
    }}>{error}</div>
  ) : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-main)',
      padding: '1rem',
    }}>
      {step === 'request' ? (
        <div style={cardStyle}>
          <Link to="/login" style={{ color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, margin: '1rem 0 0.25rem', letterSpacing: '-0.02em' }}>
            Reset password
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            Enter your username and we'll send a reset code to your email.
          </p>
          {errorBox}
          <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input type="text" required value={username}
                onChange={e => setUsername(e.target.value)}
                style={inputStyle} placeholder="your_username" />
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Sending…' : 'Send Reset Code'}
            </button>
          </form>
        </div>
      ) : (
        <div style={cardStyle}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
            Enter new password
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            Check your email for the reset code.
          </p>
          {errorBox}
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Reset Code</label>
              <input type="text" required value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                style={{ ...inputStyle, letterSpacing: '0.2em' }}
                placeholder="123456" maxLength={6} />
            </div>
            <div>
              <label style={labelStyle}>New Password</label>
              <input type="password" required value={form.new_password}
                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                style={inputStyle} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
