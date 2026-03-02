import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createSession } from '../../services/api';

const Instructions = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedTests = location.state?.selectedTests || [];
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    if (selectedTests.length === 0) { navigate('/assessment/select'); return null; }

    const handleStart = async () => {
        setLoading(true); setError('');
        try {
            const data = await createSession({ selected_tests: selectedTests.map(t => t.name) });
            navigate('/assessment/test', { state: { session: data } });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to start session.');
            console.error(err);
        }
        finally { setLoading(false); }
    };

    const rules = [
        'The assessment contains 50 MCQ questions and video-based questions.',
        'Questions are distributed evenly across your selected domains.',
        'Each MCQ has 4 options with one correct answer.',
        'You cannot go back to a previous question.',
        'The test must be completed in fullscreen mode.',
        'Proctoring is active. You must keep your camera ON during the MCQ section.',
        '3 violations (multiple faces, face mismatch, no face) or tab switching will lead to disqualification. You have a limit of 3 warnings.',
        'Video questions require camera and microphone access.',
        'Maximum 2 attempts allowed. Failing twice leads to disqualification.',
        'Your responses are recorded and cannot be changed after submission.',
    ];

    const domainLabel = selectedTests.map(t => t.name).join(', ');

    const btnStyle = (primary, disabled) => ({
        flex: 1, padding: '14px 0', borderRadius: 8, fontWeight: primary ? 600 : 500, fontSize: 14,
        border: primary ? 'none' : '1px solid #d1d5db', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#e5e7eb' : primary ? '#059669' : '#fff',
        color: disabled ? '#9ca3af' : primary ? '#fff' : '#374151',
    });

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 30 }}>
                <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, background: '#059669', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>T</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>Taxplan Advisor</span>
                </div>
            </header>

            <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 32px 60px' }}>
                <div style={{ marginBottom: 24 }}>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>
                        {domainLabel}
                    </span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Instructions</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Please read carefully before starting.</p>
                </div>

                {/* Selected domains summary */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', margin: '0 0 6px' }}>Selected Domains ({selectedTests.length})</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selectedTests.map(t => (
                            <span key={t.id} style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 6, fontWeight: 500 }}>{t.name}</span>
                        ))}
                    </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
                    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {rules.map((rule, i) => (
                            <li key={i} style={{ display: 'flex', gap: 12, fontSize: 14, color: '#374151' }}>
                                <span style={{
                                    width: 24, height: 24, borderRadius: '50%', background: '#f3f4f6',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    fontSize: 12, fontWeight: 700, color: '#6b7280'
                                }}>{i + 1}</span>
                                <span style={{ paddingTop: 2 }}>{rule}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 16, marginTop: 2 }}>⚠️</span>
                        <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#92400e', margin: 0 }}>Important</p>
                            <p style={{ fontSize: 13, color: '#a16207', margin: '4px 0 0' }}>Once you start, you cannot pause or restart. Ensure stable internet and camera access.</p>
                        </div>
                    </div>
                </div>

                {error && <div style={{ marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#dc2626' }}>{error}</div>}

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => navigate('/assessment/select')} style={btnStyle(false, false)}>← Back</button>
                    <button onClick={handleStart} disabled={loading} style={btnStyle(true, loading)}>
                        {loading ? 'Starting...' : 'Start Assessment →'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Instructions;
