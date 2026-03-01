import { Navbar } from '../components/Navbar';

export function AboutPage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-primary)',
            fontFamily: 'var(--font-main)'
        }}>
            <Navbar />

            <main style={{
                flex: 1,
                maxWidth: '800px',
                margin: '0 auto',
                padding: '8rem 2rem 4rem',
            }}>
                <h1 style={{
                    fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.03em',
                    marginBottom: '2rem',
                    lineHeight: 1.1,
                }}>
                    About Voyalog
                </h1>

                <div style={{
                    fontSize: '1.1rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                }}>
                    <p>
                        Voyalog was born out of a simple idea: that our travel memories deserve a better home than a scrolling grid of endless, context-less photos.
                    </p>

                    <p>
                        We wanted a way to truly <strong>map our memories</strong>. To see where we've been, remember exactly where that perfect sunset was, and build a cohesive, visual journal of our adventures around the globe.
                    </p>

                    <h2 style={{
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginTop: '1.5rem',
                        marginBottom: '0.5rem',
                        letterSpacing: '-0.02em',
                    }}>
                        How it Works
                    </h2>

                    <p>
                        When you upload your photos, Voyalog automatically reads the location data tucked inside the image file (EXIF data). We use this to instantly place your photos on your personal, interactive world map. Even if your camera doesn't save location data, you can easily pinpoint the exact spot manually.
                    </p>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderLeft: '4px solid var(--accent)',
                        padding: '1.5rem',
                        borderRadius: '0 1rem 1rem 0',
                        marginTop: '1rem',
                        marginBottom: '1rem',
                    }}>
                        <h3 style={{
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            marginBottom: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            ⚠️ Important Note on Privacy
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.5 }}>
                            By design, <strong>Voyalog is a public travel journal</strong>. Any photo you upload to your board, including its location data, title, and description, will be visible to anyone who visits the site. Please keep this in mind when choosing which memories to share with the world!
                        </p>
                    </div>

                    <p>
                        Whether it's a bustling market in Tokyo or a quiet corner of your hometown, every photo tells a part of your story. We're excited to see where your map takes you.
                    </p>
                </div>
            </main>

            <footer style={{
                marginTop: 'auto',
                padding: '2rem',
                textAlign: 'center',
                borderTop: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
            }}>
                <p>&copy; {new Date().getFullYear()} Voyalog. All rights reserved.</p>
            </footer>
        </div>
    );
}
