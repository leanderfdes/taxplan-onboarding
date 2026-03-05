import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { acceptDeclaration, getProctoringPolicy } from '../services/api';

const DEFAULT_PROCTORING_DECLARATION_POLICY = {
    TAB_WARNINGS_LIMIT: 3,
    WEBCAM_WARNINGS_LIMIT: 3,
    FULLSCREEN_EXITS_LIMIT: 3,
};

const Declaration = () => {
    const navigate = useNavigate();
    const { checkAuth, user } = useAuth();

    const [agreements, setAgreements] = useState({
        accuracy: null,
        integrity: null,
        proctoring: null,
        finalDecision: null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [policy, setPolicy] = useState(DEFAULT_PROCTORING_DECLARATION_POLICY);

    const allAgreed = Object.values(agreements).every(v => v === true);
    const anyDisagreed = Object.values(agreements).some(v => v === false);

    const handleRadioChange = (key, value) => {
        setAgreements(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        let mounted = true;
        const loadPolicy = async () => {
            try {
                const policyRes = await getProctoringPolicy();
                const thresholds = policyRes?.thresholds || {};
                if (!mounted) return;
                setPolicy({
                    TAB_WARNINGS_LIMIT: thresholds.max_tab_warnings ?? DEFAULT_PROCTORING_DECLARATION_POLICY.TAB_WARNINGS_LIMIT,
                    WEBCAM_WARNINGS_LIMIT: thresholds.max_webcam_warnings ?? DEFAULT_PROCTORING_DECLARATION_POLICY.WEBCAM_WARNINGS_LIMIT,
                    FULLSCREEN_EXITS_LIMIT: thresholds.max_fullscreen_exits ?? DEFAULT_PROCTORING_DECLARATION_POLICY.FULLSCREEN_EXITS_LIMIT,
                });
            } catch (err) {
                console.error('Failed to load proctoring policy:', err);
            }
        };
        loadPolicy();
        return () => { mounted = false; };
    }, []);

    const handleSubmit = async () => {
        if (!allAgreed) return;

        setLoading(true);
        setError(null);
        try {
            await acceptDeclaration();
            await checkAuth();
            navigate('/onboarding');
        } catch (err) {
            console.error('Error accepting declaration:', err);
            setError('Failed to submit declaration. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const boxStyle = {
        display: 'flex', flexDirection: 'column', gap: 12,
        background: '#fff', padding: '16px 20px', borderRadius: 12,
        border: '1px solid #e5e7eb', transition: 'border 0.2s, box-shadow 0.2s',
    };

    const titleStyle = { fontWeight: 600, color: '#111827', marginBottom: 4, fontSize: 15 };
    const descStyle = { fontSize: 13, color: '#6b7280', lineHeight: 1.5 };

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Header matching Onboarding */}
            <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 30 }}>
                <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, background: '#059669', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>T</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>Taxplan Advisor</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>{user?.email}</span>
                </div>
            </header>

            <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 32px 60px' }}>

                {/* Title */}
                <div style={{ marginBottom: 32 }}>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>Required Step</span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Consultant Declaration</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>Please read and carefully agree to all terms before proceeding to the assessment platform.</p>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
                    <strong>Proctoring policy highlights:</strong>
                    <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                        <li>Tab-switch warnings allowed: {policy.TAB_WARNINGS_LIMIT}</li>
                        <li>Webcam/proctoring warnings allowed: {policy.WEBCAM_WARNINGS_LIMIT}</li>
                        <li>Assessment must be taken in fullscreen mode.</li>
                        <li>Violations are logged and can lead to auto-submission or disqualification.</li>
                    </ul>
                </div>


                {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: 14 }}>
                        {error}
                    </div>
                )}

                {anyDisagreed && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: 14, fontWeight: 500 }}>
                        You have not agreed to all our terms, cannot proceed further.
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    <div style={{ ...boxStyle, borderColor: agreements.accuracy === true ? '#059669' : agreements.accuracy === false ? '#ef4444' : '#e5e7eb', boxShadow: agreements.accuracy === true ? '0 0 0 1px #059669' : agreements.accuracy === false ? '0 0 0 1px #ef4444' : 'none' }}>
                        <div>
                            <div style={titleStyle}>1. Accuracy of Information</div>
                            <div style={descStyle}>I declare that all personal information, identity documents, and qualifications I have uploaded or will upload are true, accurate, and belong entirely to me. I understand that submitting forged or altered documents will lead to immediate disqualification.</div>
                        </div>
                        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="accuracy" checked={agreements.accuracy === true} onChange={() => handleRadioChange('accuracy', true)} style={{ width: 18, height: 18, accentColor: '#059669', cursor: 'pointer' }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Yes</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="accuracy" checked={agreements.accuracy === false} onChange={() => handleRadioChange('accuracy', false)} style={{ width: 18, height: 18, accentColor: '#ef4444', cursor: 'pointer' }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>No</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ ...boxStyle, borderColor: agreements.integrity === true ? '#059669' : agreements.integrity === false ? '#ef4444' : '#e5e7eb', boxShadow: agreements.integrity === true ? '0 0 0 1px #059669' : agreements.integrity === false ? '0 0 0 1px #ef4444' : 'none' }}>
                        <div>
                            <div style={titleStyle}>2. Assessment Integrity</div>
                            <div style={descStyle}>I agree to complete the assessment entirely on my own, without the assistance of any other person, external devices, AI tools, or unauthorized materials.</div>
                        </div>
                        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="integrity" checked={agreements.integrity === true} onChange={() => handleRadioChange('integrity', true)} style={{ width: 18, height: 18, accentColor: '#059669', cursor: 'pointer' }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Yes</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="integrity" checked={agreements.integrity === false} onChange={() => handleRadioChange('integrity', false)} style={{ width: 18, height: 18, accentColor: '#ef4444', cursor: 'pointer' }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>No</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ ...boxStyle, borderColor: agreements.proctoring === true ? '#059669' : agreements.proctoring === false ? '#ef4444' : '#e5e7eb', boxShadow: agreements.proctoring === true ? '0 0 0 1px #059669' : agreements.proctoring === false ? '0 0 0 1px #ef4444' : 'none' }}>
                        <div>
                            <div style={titleStyle}>3. Proctoring Consent</div>
                            <div style={descStyle}>I consent to video, audio, and screen-monitoring (proctoring) during the assessment. I understand that any attempts to switch tabs, minimize the window, or obscure my webcam will be logged as violations and may result in my test being flagged or rejected.</div>
                        </div>
                        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="proctoring" checked={agreements.proctoring === true} onChange={() => handleRadioChange('proctoring', true)} style={{ width: 18, height: 18, accentColor: '#059669', cursor: 'pointer' }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Yes</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="proctoring" checked={agreements.proctoring === false} onChange={() => handleRadioChange('proctoring', false)} style={{ width: 18, height: 18, accentColor: '#ef4444', cursor: 'pointer' }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>No</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ ...boxStyle, borderColor: agreements.finalDecision === true ? '#059669' : agreements.finalDecision === false ? '#ef4444' : '#e5e7eb', boxShadow: agreements.finalDecision === true ? '0 0 0 1px #059669' : agreements.finalDecision === false ? '0 0 0 1px #ef4444' : 'none' }}>
                        <div>
                            <div style={titleStyle}>4. Final Decision</div>
                            <div style={descStyle}>I acknowledge that the evaluation of my assessment, including video analysis and document verification, is at the sole discretion of the TaxPlan Advisor administrative team, and their passing or disqualification decisions are final.</div>
                        </div>
                        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="finalDecision" checked={agreements.finalDecision === true} onChange={() => handleRadioChange('finalDecision', true)} style={{ width: 18, height: 18, accentColor: '#059669', cursor: 'pointer' }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Yes</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="finalDecision" checked={agreements.finalDecision === false} onChange={() => handleRadioChange('finalDecision', false)} style={{ width: 18, height: 18, accentColor: '#ef4444', cursor: 'pointer' }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>No</span>
                            </label>
                        </div>
                    </div>

                </div>

                <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
                    <button
                        onClick={handleSubmit}
                        disabled={!allAgreed || loading}
                        style={{
                            padding: '12px 32px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                            border: 'none', cursor: allAgreed && !loading ? 'pointer' : 'not-allowed',
                            background: allAgreed ? '#059669' : '#e5e7eb',
                            color: allAgreed ? '#fff' : '#9ca3af',
                            transition: 'background 0.2s',
                            display: 'flex', alignItems: 'center', gap: 8
                        }}
                    >
                        {loading ? 'Submitting...' : 'I Agree & Proceed'}
                        <span style={{ fontSize: 16 }}>→</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Declaration;
