import { useAuth } from '../context/AuthContext';

const OnboardingComplete = () => {
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        window.location.href = '/';
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>

                {/* Success icon */}
                <div style={{
                    width: 80, height: 80, borderRadius: '50%', background: '#dcfce7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px', fontSize: 40
                }}>
                    ✅
                </div>

                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
                    Application Submitted!
                </h1>
                <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.7, margin: '0 0 32px' }}>
                    Thank you, <strong style={{ color: '#111827' }}>{user?.first_name || user?.email?.split('@')[0]}</strong>. Your onboarding application has been submitted successfully.
                </p>

                {/* Info card */}
                <div style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                    padding: '28px 24px', textAlign: 'left', marginBottom: 24,
                }}>
                    <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📋</span> What happens next?
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%', background: '#ecfdf5',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700, color: '#059669', flexShrink: 0
                            }}>1</div>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Document Verification</p>
                                <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Our team will verify your uploaded documents and qualifications.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%', background: '#ecfdf5',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700, color: '#059669', flexShrink: 0
                            }}>2</div>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Assessment Evaluation</p>
                                <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Your assessment responses and video answers will be reviewed.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%', background: '#ecfdf5',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700, color: '#059669', flexShrink: 0
                            }}>3</div>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Login Credentials</p>
                                <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Upon successful verification, you will receive your consultant login credentials via email.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notice */}
                <div style={{
                    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
                    padding: '16px 20px', marginBottom: 28, textAlign: 'left',
                }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 16, marginTop: 1 }}>⏳</span>
                        <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#92400e', margin: 0 }}>Verification in Progress</p>
                            <p style={{ fontSize: 13, color: '#a16207', margin: '4px 0 0', lineHeight: 1.5 }}>
                                This process typically takes 2–3 business days. You will be notified via email once your application is approved.
                            </p>
                        </div>
                    </div>
                </div>

                <button onClick={handleLogout} style={{
                    padding: '14px 32px', borderRadius: 10, fontWeight: 600, fontSize: 14,
                    background: '#059669', color: '#fff', border: 'none', cursor: 'pointer',
                }}>
                    Done — Sign Out
                </button>

                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 16 }}>
                    If you have questions, contact <strong style={{ color: '#6b7280' }}>support@taxplanadvisor.com</strong>
                </p>
            </div>
        </div>
    );
};

export default OnboardingComplete;
