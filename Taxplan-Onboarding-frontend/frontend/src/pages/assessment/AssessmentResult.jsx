import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLatestResult } from '../../services/api';

const AssessmentResult = () => {
    const navigate = useNavigate();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isPolling = true;

        const fetchData = async () => {
            try {
                const data = await getLatestResult();
                setResult(data);
                setLoading(false);

                // If video evaluation is not complete yet, poll every 5 seconds
                if (data?.video_total_possible > 0 && !data?.video_evaluation_complete && isPolling) {
                    setTimeout(fetchData, 5000);
                }
            } catch (err) {
                setError('Failed to load results.');
                setLoading(false);
            }
        };

        fetchData();

        return () => { isPolling = false; };
    }, []);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 24 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 400, width: '100%' }}>
                    <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>
                    <button onClick={() => navigate('/success')}
                        style={{ padding: '10px 24px', borderRadius: 8, background: '#059669', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const passed = result?.passed;
    const isDisqualified = result?.status === 'flagged' || result?.hide_marks;
    const score = result?.score || 0;
    const total = result?.total || result?.total_questions || 50;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 30 }}>
                <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, background: '#059669', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>T</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>Taxplan Advisor</span>
                </div>
            </header>

            <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px 40px' }}>
                <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 40, textAlign: 'center' }}>
                    {/* Status */}
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: passed ? '#dcfce7' : '#fef2f2',
                        fontSize: 28,
                    }}>
                        {passed ? '✅' : '🚫'}
                    </div>

                    {isDisqualified ? (
                        <>
                            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#dc2626', margin: '0 0 8px' }}>
                                Assessment Terminated
                            </h1>
                            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
                                Your assessment was ended due to policy violations.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 style={{ fontSize: 22, fontWeight: 700, color: passed ? '#16a34a' : '#dc2626', margin: '0 0 8px' }}>
                                {passed ? 'Assessment Passed!' : 'Assessment Not Passed'}
                            </h1>
                            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
                                {passed ? 'Great work! You can proceed to the next step.' : 'You can retry the assessment from the dashboard.'}
                            </p>

                            {/* Score */}
                            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 32 }}>
                                <div style={{ fontSize: 40, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{percentage}%</div>
                                <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>{score} out of {total} correct</p>
                            </div>
                        </>
                    )}

                    <button onClick={() => navigate('/success')}
                        style={{ width: '100%', padding: '14px 0', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer' }}>
                        Back to Dashboard →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssessmentResult;
