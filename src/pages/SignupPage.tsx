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

export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'signup' | 'confirm'>('signup');
  const [submittedUsername, setSubmittedUsername] = useState('');
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiPost('/auth/signup', form);
      setSubmittedUsername(form.username);
      setStep('confirm');
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
      await apiPost('/auth/confirm', { username: submittedUsername, confirmation_code: code });
      navigate('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
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
      {step === 'signup' ? (
        <div style={cardStyle}>
          <Link to="/" style={{ color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back
          </Link>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, margin: '1rem 0 0.25rem', letterSpacing: '-0.02em' }}>
            Join Voyalog
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            Create your account to start exploring
          </p>
          {errorBox}
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input type="text" required value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                style={inputStyle} placeholder="your_username" />
            </div>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input type="text" required value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                style={inputStyle} placeholder="Jane Doe" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={inputStyle} placeholder="jane@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" required value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={inputStyle} placeholder="Min 8 chars, upper, number, symbol" />
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '1.5rem', textAlign: 'center' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign In</Link>
          </p>
        </div>
      ) : (
        <div style={cardStyle}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
            Check your email
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            We sent a confirmation code to your email. Enter it below.
          </p>
          {errorBox}
          <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Confirmation Code</label>
              <input type="text" required value={code}
                onChange={e => setCode(e.target.value)}
                style={{ ...inputStyle, letterSpacing: '0.2em', fontSize: '1.1rem' }}
                placeholder="123456" maxLength={6} />
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Confirming…' : 'Confirm Account'}
            </button>
          </form>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center' }}>
            Didn't get an email? Check your spam folder.
          </p>
        </div>
      )}
    </div>
  );
}
