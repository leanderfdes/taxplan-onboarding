import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { googleAuth } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const [error, setError] = useState('');

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const data = await googleAuth(credentialResponse.credential);
            await checkAuth(); // Sync the stepFlags after setting the session cookie
            if (data.needs_onboarding) {
                navigate('/onboarding');
            } else {
                navigate('/success');
            }
        } catch (err) {
            setError('Authentication failed. Please try again.');
            console.error('Login error:', err);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 52, height: 52, background: '#059669', borderRadius: 14, marginBottom: 16,
                    }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>T</span>
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Taxplan Advisor</h1>
                    <p style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>Consultant Onboarding Portal</p>
                </div>

                {/* Card */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center', margin: '0 0 4px' }}>Welcome</h2>
                    <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 28 }}>Sign in with your Google account to get started</p>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError('Login failed')}
                            theme="outline"
                            shape="rectangular"
                            size="large"
                            width="350"
                        />
                    </div>

                    {error && (
                        <p style={{ color: '#dc2626', fontSize: 14, textAlign: 'center', background: '#fef2f2', borderRadius: 8, padding: '8px 16px', marginTop: 16 }}>{error}</p>
                    )}

                    <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #f3f4f6' }}>
                        {['End-to-end encrypted', 'Google verified identity', 'Data securely stored'].map((text, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#6b7280', marginBottom: i < 2 ? 10 : 0 }}>
                                <span style={{ color: '#059669', fontSize: 14 }}>✓</span>
                                <span>{text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 24 }}>
                    By signing in, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
};

export default Login;
