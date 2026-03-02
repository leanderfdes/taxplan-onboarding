import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/api/admin-panel/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('admin_token', data.token);
                navigate('/admin/dashboard');
            } else {
                setError(data.error || 'Invalid credentials');
            }
        } catch {
            setError('Server unavailable. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Inter', system-ui, sans-serif",
        }}>
            {/* Decorative background elements */}
            <div style={{
                position: 'fixed', top: -120, right: -120,
                width: 400, height: 400, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'fixed', bottom: -100, left: -100,
                width: 350, height: 350, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{
                width: 400, padding: 40, borderRadius: 16,
                background: 'rgba(30, 41, 59, 0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(148,163,184,0.1)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 56, height: 56, margin: '0 auto 16px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                    }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>T</span>
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Admin Panel</h1>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>TaxplanAdvisor Management Console</p>
                </div>

                {error && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 8, marginBottom: 20,
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#fca5a5', fontSize: 13, textAlign: 'center',
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 18 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Username
                        </label>
                        <input
                            value={username} onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: 10,
                                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)',
                                color: '#f1f5f9', fontSize: 14, outline: 'none',
                                transition: 'border 0.2s',
                                boxSizing: 'border-box',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#10b981'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(148,163,184,0.2)'}
                        />
                    </div>
                    <div style={{ marginBottom: 28 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Password
                        </label>
                        <input
                            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: 10,
                                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)',
                                color: '#f1f5f9', fontSize: 14, outline: 'none',
                                transition: 'border 0.2s',
                                boxSizing: 'border-box',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#10b981'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(148,163,184,0.2)'}
                        />
                    </div>
                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '13px 0', borderRadius: 10,
                        background: loading ? '#334155' : 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff', fontWeight: 600, fontSize: 14, border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: loading ? 'none' : '0 4px 16px rgba(16,185,129,0.3)',
                        transition: 'all 0.2s',
                    }}>
                        {loading ? 'Signing in...' : 'Sign In →'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
