import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLatestResult } from '../services/api';

const Success = () => {
    const { user, stepFlags, logout, checkAuth } = useAuth();
    const navigate = useNavigate();
    const [assessmentPassed, setAssessmentPassed] = useState(stepFlags?.has_passed_assessment || false);
    const [assessmentStatus, setAssessmentStatus] = useState(null);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth().then(() => setLoading(false)).catch(() => setLoading(false));
        getLatestResult()
            .then(data => {
                if (data?.passed) setAssessmentPassed(true);
                if (data?.status) setAssessmentStatus(data.status);
                if (data?.disqualified) setIsDisqualified(true);
            })
            .catch(() => { });
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const hasIdentity = stepFlags?.has_identity_doc;
    const isVerified = user?.is_verified;
    const isFlagged = assessmentStatus === 'flagged';

    // Disqualified if flagged OR explicitly disqualified by max attempts
    const disqualified = isFlagged || isDisqualified;

    const steps = [
        { label: 'Profile Details', desc: 'Personal & practice information', done: user?.is_onboarded, icon: '👤' },
        { label: 'Identity Verification', desc: 'Upload government-issued ID', done: hasIdentity, action: () => navigate('/onboarding/identity'), icon: '🪪' },
        { label: 'Face Verification', desc: 'Verify your identity via camera', done: isVerified, requires: hasIdentity, action: () => navigate('/onboarding/face-verification'), icon: '📸' },
        {
            label: disqualified ? 'Assessment Disqualified' : 'Domain Assessment',
            desc: disqualified ? 'Maximum attempts exceeded or violations detected.' : '50 MCQs + Video questions',
            done: assessmentPassed || stepFlags?.has_passed_assessment,
            requires: isVerified && !disqualified,
            action: disqualified ? null : () => navigate('/assessment/select'),
            icon: disqualified ? '🚫' : '📝',
            customStatus: disqualified ? <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, background: '#fef2f2', padding: '6px 14px', borderRadius: 20, border: '1px solid #fecaca' }}>🚫 Disqualified</span> : null
        },
        { label: 'Qualification Upload', desc: 'Upload certificates & degrees', done: stepFlags?.has_documents, requires: assessmentPassed || stepFlags?.has_passed_assessment, action: () => navigate(stepFlags?.has_documents ? '/onboarding/complete' : '/onboarding/documentation'), icon: '📄' },
    ];

    const currentStepIndex = steps.findIndex((s, i) => {
        if (s.done) return false;
        if (i === 0) return true;
        for (let j = 0; j < i; j++) { if (!steps[j].done) return false; }
        return true;
    });

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Header */}
            <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 30 }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, background: '#059669', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>T</span>
                        </div>
                        <span style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>Taxplan Advisor</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 13, color: '#9ca3af' }}>{user?.email}</span>
                        <button onClick={handleLogout} style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', padding: '6px 12px', borderRadius: 6 }}
                            onMouseEnter={e => e.target.style.color = '#dc2626'} onMouseLeave={e => e.target.style.color = '#6b7280'}>
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px' }}>
                {/* Welcome */}
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: 0 }}>
                        Welcome back, {user?.first_name || user?.email?.split('@')[0]}
                    </h1>
                    <p style={{ fontSize: 15, color: '#6b7280', marginTop: 6 }}>
                        Complete the steps below to finish your consultant onboarding.
                    </p>
                </div>

                {/* Steps */}
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    {steps.map((step, i) => {
                        const isActive = i === currentStepIndex;
                        const isLocked = !step.done && !isActive;

                        return (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 20,
                                padding: '20px 28px',
                                borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                                background: isActive ? '#f0fdf4' : '#fff',
                                opacity: isLocked ? 0.45 : 1,
                                transition: 'all 0.2s'
                            }}>
                                {/* Step number/check */}
                                <div style={{
                                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14, fontWeight: 700,
                                    background: step.done ? '#dcfce7' : isActive ? '#059669' : '#f3f4f6',
                                    color: step.done ? '#16a34a' : isActive ? '#fff' : '#9ca3af',
                                }}>
                                    {step.done ? '✓' : i + 1}
                                </div>

                                {/* Icon */}
                                <span style={{ fontSize: 24, flexShrink: 0 }}>{step.icon}</span>

                                {/* Text */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{
                                        fontSize: 15, fontWeight: 600, margin: 0,
                                        color: step.done ? '#16a34a' : isActive ? '#111827' : '#9ca3af'
                                    }}>{step.label}</h3>
                                    <p style={{ fontSize: 13, color: step.done ? '#86efac' : '#9ca3af', margin: '2px 0 0' }}>
                                        {step.desc}
                                    </p>
                                </div>

                                {/* Action */}
                                <div style={{ flexShrink: 0 }}>
                                    {step.done ? (
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 14px', borderRadius: 20 }}>
                                            ✓ Complete
                                        </span>
                                    ) : isActive && step.action ? (
                                        <button onClick={step.action} style={{
                                            fontSize: 13, fontWeight: 600, background: '#059669', color: '#fff',
                                            padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                            onMouseEnter={e => e.target.style.background = '#047857'}
                                            onMouseLeave={e => e.target.style.background = '#059669'}>
                                            Start →
                                        </button>
                                    ) : (
                                        step.customStatus || <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500 }}>🔒 Locked</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {stepFlags?.has_documents && assessmentPassed && isVerified && hasIdentity && (
                <div style={{ marginTop: 32, textAlign: 'center', background: '#ecfdf5', borderRadius: 12, padding: 24, border: '1px solid #d1fae5' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#065f46', margin: '0 0 8px' }}>Onboarding Complete!</h2>
                    <p style={{ fontSize: 15, color: '#047857', margin: 0, lineHeight: 1.6 }}>
                        You have completed the onboarding process. Once verification is complete, you will receive your login credentials on your email ID.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Success;