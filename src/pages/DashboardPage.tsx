import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function DashboardPage() {
  const { user, tokens, logout, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !tokens) navigate('/login');
  }, [loading, tokens, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-main)',
        color: 'var(--text-secondary)',
      }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      fontFamily: 'var(--font-main)',
      padding: '2rem 1rem',
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          boxShadow: '0 8px 32px rgba(47, 79, 79, 0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
                Dashboard
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                You're logged in
              </p>
            </div>
            <button onClick={handleLogout} style={{
              padding: '0.5rem 1.2rem',
              borderRadius: '2rem',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontFamily: 'var(--font-main)',
            }}>
              Sign Out
            </button>
          </div>

          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-color)',
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Account Info
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Row label="Username" value={user?.username ?? '—'} />
              <Row label="User ID" value={user?.user_id ?? '—'} mono />
            </div>
          </div>

          <div style={{
            marginTop: '1.5rem',
            background: 'rgba(0,128,128,0.06)',
            border: '1px solid rgba(0,128,128,0.15)',
            borderRadius: '1rem',
            padding: '1.25rem 1.5rem',
            color: 'var(--accent)',
            fontSize: '0.9rem',
          }}>
            Auth flow working end-to-end.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{label}</span>
      <span style={{
        color: 'var(--text-primary)',
        fontSize: mono ? '0.78rem' : '0.9rem',
        fontFamily: mono ? 'monospace' : 'inherit',
        fontWeight: 600,
        wordBreak: 'break-all',
        textAlign: 'right',
      }}>{value}</span>
    </div>
  );
}
