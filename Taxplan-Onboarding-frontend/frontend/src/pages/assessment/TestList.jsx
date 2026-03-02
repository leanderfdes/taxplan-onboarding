import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTestTypes, getLatestResult } from '../../services/api';

const domainIcons = { 'Income Tax': '💰', 'GST': '📊', 'TDS': '📋', 'Professional Tax': '🏢' };

const TestList = () => {
    const navigate = useNavigate();
    const [testTypes, setTestTypes] = useState([]);
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [disqualified, setDisqualified] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [types, result] = await Promise.all([
                    getTestTypes(),
                    getLatestResult().catch(() => ({ disqualified: false }))
                ]);
                setTestTypes(types);
                if (result && result.disqualified) {
                    setDisqualified(true);
                }
                setLoading(false);
            } catch (err) {
                setError('Failed to load data.');
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const toggleSelect = (tt) => {
        if (disqualified) return;
        setSelected(prev =>
            prev.find(s => s.id === tt.id)
                ? prev.filter(s => s.id !== tt.id)
                : [...prev, tt]
        );
    };

    const handleContinue = () => {
        if (selected.length === 0 || disqualified) return;
        navigate('/assessment/instructions', { state: { selectedTests: selected } });
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 30 }}>
                <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, background: '#059669', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>T</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>Taxplan Advisor</span>
                </div>
            </header>

            <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 32px 60px' }}>
                <div style={{ marginBottom: 28 }}>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>Step 4 of 5</span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Select Assessment Domains</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Choose one or more domains. Questions will be split evenly across your selections (50 MCQs total).</p>
                </div>

                {/* Disqualification Banner */}
                {disqualified && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ fontSize: 48 }}>🚫</div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#991b1b', margin: '0 0 6px' }}>Assessment Access Revoked</h3>
                            <p style={{ fontSize: 14, color: '#b91c1c', margin: 0 }}>
                                You have been disqualified from taking further assessments due to exceeding the maximum number of failed attempts or proctoring violations.
                            </p>
                        </div>
                    </div>
                )}

                {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#dc2626', marginBottom: 16 }}>{error}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, opacity: disqualified ? 0.6 : 1, pointerEvents: disqualified ? 'none' : 'auto' }}>
                    {testTypes.map(tt => {
                        const isSelected = selected.find(s => s.id === tt.id);
                        return (
                            <button key={tt.id} onClick={() => toggleSelect(tt)}
                                disabled={disqualified}
                                style={{
                                    background: isSelected ? '#ecfdf5' : '#fff',
                                    borderRadius: 12,
                                    border: isSelected ? '2px solid #059669' : '2px solid #e5e7eb',
                                    padding: 24, textAlign: 'left', cursor: disqualified ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                    position: 'relative',
                                }}>
                                {/* Checkbox */}
                                <div style={{
                                    position: 'absolute', top: 12, right: 12,
                                    width: 22, height: 22, borderRadius: 6,
                                    border: isSelected ? 'none' : '2px solid #d1d5db',
                                    background: isSelected ? '#059669' : '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {isSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
                                </div>
                                <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>{domainIcons[tt.name] || '📝'}</span>
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: isSelected ? '#047857' : '#111827', margin: 0 }}>{tt.name}</h3>
                                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{tt.total_questions || 50} questions available</p>
                            </button>
                        );
                    })}
                </div>

                {/* Selected count + continue */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, color: '#6b7280' }}>
                        {selected.length === 0 ? 'No domains selected' : `${selected.length} domain${selected.length > 1 ? 's' : ''} selected`}
                    </span>
                    <button onClick={handleContinue} disabled={selected.length === 0 || disqualified}
                        style={{
                            padding: '12px 32px', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none',
                            background: (selected.length === 0 || disqualified) ? '#e5e7eb' : '#059669',
                            color: (selected.length === 0 || disqualified) ? '#9ca3af' : '#fff',
                            cursor: (selected.length === 0 || disqualified) ? 'not-allowed' : 'pointer',
                        }}>
                        Continue →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TestList;
