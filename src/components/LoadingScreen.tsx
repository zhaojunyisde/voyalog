export function LoadingScreen() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-main)',
            gap: '1.25rem',
        }}>
            <div style={{
                width: '48px', height: '48px',
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'dashSpin 0.8s linear infinite',
            }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.08em' }}>
                LOADING YOUR MEMORIES…
            </span>
        </div>
    );
}
