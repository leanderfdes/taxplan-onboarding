import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadIdentityDocument } from '../services/api';
import { useAuth } from '../context/AuthContext';

const IdentityVerification = () => {
    const navigate = useNavigate();
    const { updateStepFlags } = useAuth();
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(selected.type)) { setError('Only JPG/PNG files accepted.'); return; }
        if (selected.size > 5 * 1024 * 1024) { setError('File must be under 5MB.'); return; }
        setError(''); setFile(selected);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(selected));
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true); setError('');
        try {
            const formData = new FormData();
            formData.append('identity_document', file);
            const response = await uploadIdentityDocument(formData);

            if (response.verification?.status === 'Verified') {
                updateStepFlags({ has_identity_doc: true });
                navigate('/onboarding/face-verification');
            } else {
                setError('Document verification failed. Please upload a clear valid Government ID.');
            }
        } catch (err) { setError('Upload failed. Please try again.'); console.error(err); }
        finally { setUploading(false); }
    };

    const containerStyle = { maxWidth: 700, margin: '0 auto', padding: '32px 32px 60px' };
    const cardStyle = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 };

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

            <div style={containerStyle}>
                <div style={{ marginBottom: 28 }}>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>Step 2 of 5</span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Identity Verification</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Upload a clear photo of your government-issued ID (Aadhaar, PAN, or Passport).</p>
                </div>

                <div style={cardStyle}>
                    {!preview ? (
                        <div onClick={() => fileInputRef.current?.click()} style={{
                            border: '2px dashed #d1d5db', borderRadius: 12, padding: '60px 24px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'border 0.2s'
                        }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                            <p style={{ fontWeight: 500, color: '#374151', marginBottom: 4 }}>Click to upload your ID</p>
                            <p style={{ fontSize: 13, color: '#9ca3af' }}>JPG, JPEG or PNG • Max 5MB</p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
                                <img src={preview} alt="ID Preview" style={{ maxHeight: 320, margin: '0 auto', display: 'block', objectFit: 'contain', padding: 16 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); }}
                                    style={{ flex: 1, padding: '12px 0', borderRadius: 8, fontWeight: 500, fontSize: 14, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                                    Choose Different
                                </button>
                                <button onClick={handleUpload} disabled={uploading}
                                    style={{
                                        flex: 1, padding: '12px 0', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none',
                                        background: uploading ? '#e5e7eb' : '#059669', color: uploading ? '#9ca3af' : '#fff', cursor: uploading ? 'not-allowed' : 'pointer'
                                    }}>
                                    {uploading ? 'Uploading...' : 'Upload & Continue →'}
                                </button>
                            </div>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleFileChange} style={{ display: 'none' }} />
                </div>

                {error && <div style={{ marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#dc2626' }}>{error}</div>}
            </div>
        </div>
    );
};

export default IdentityVerification;
