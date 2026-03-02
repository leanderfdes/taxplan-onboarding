import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { verifyFace } from '../services/api';
import { useAuth } from '../context/AuthContext';

const FaceVerification = () => {
    const navigate = useNavigate();
    const { user, updateUser, updateStepFlags } = useAuth();
    const webcamRef = useRef(null);

    // State
    const [capturedImage, setCapturedImage] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) setCapturedImage(imageSrc);
    }, []);

    const handleVerify = async () => {
        if (!capturedImage) return;
        setVerifying(true); setError('');
        try {
            const result = await verifyFace(user?.id, { live_photo_base64: capturedImage });
            if (result.match) {
                updateUser({ ...user, is_verified: true });
                navigate('/success');
            } else {
                setError(`Face did not match (similarity: ${result.similarity?.toFixed(1)}%). Please retry live photo or change your uploaded ID.`);
                setCapturedImage(null);
            }
        } catch (err) {
            setError('Verification failed. Please retry live photo or change your uploaded ID.');
            setCapturedImage(null);
            console.error(err);
        }
        finally { setVerifying(false); }
    };

    const btnPrimary = (disabled) => ({
        flex: 1, padding: '12px 0', borderRadius: 8, fontWeight: 600, fontSize: 14,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#e5e7eb' : '#059669', color: disabled ? '#9ca3af' : '#fff',
    });

    const btnSecondary = {
        flex: 1, padding: '12px 0', borderRadius: 8, fontWeight: 500, fontSize: 14,
        border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer',
    };

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
                <div style={{ marginBottom: 28 }}>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>Step 3 of 5</span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Face Verification</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
                        Now take a live photo using your webcam to verify your identity against the ID you uploaded.
                    </p>
                </div>

                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>📸 Live Capture</h2>
                        <button
                            onClick={() => navigate('/onboarding/identity')}
                            style={{ fontSize: 13, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                        >
                            ← Change Uploaded ID
                        </button>
                    </div>

                    <div style={{ aspectRatio: '16/9', background: '#111827', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                        {capturedImage ? (
                            <img src={capturedImage} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} mirrored={true} />
                        )}
                    </div>

                    {!capturedImage ? (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280', background: '#f9fafb', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e7eb', marginBottom: 16 }}>
                                <span>💡</span><span>Position your face clearly in the frame with good lighting.</span>
                            </div>
                            <button onClick={capture} style={{ ...btnPrimary(false), width: '100%', flex: 'none' }}>
                                📸 Capture Photo
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setCapturedImage(null)} style={btnSecondary}>Retake</button>
                            <button onClick={handleVerify} disabled={verifying} style={btnPrimary(verifying)}>
                                {verifying ? 'Verifying...' : 'Verify Face →'}
                            </button>
                        </div>
                    )}
                </div>

                {error && <div style={{ marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#dc2626' }}>{error}</div>}
            </div>
        </div>
    );
};

export default FaceVerification;
