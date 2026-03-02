import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadDocument } from '../services/api';

const DocumentUpload = () => {
    const navigate = useNavigate();

    // Individual file states
    const [bachelors, setBachelors] = useState(null);
    const [masters, setMasters] = useState(null);
    const [certificates, setCertificates] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [error, setError] = useState('');

    const bachelorRef = useRef(null);
    const masterRef = useRef(null);
    const certRef = useRef(null);

    const validateFile = (file) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowed.includes(file.type)) return 'Only PDF, JPG, PNG allowed.';
        if (file.size > 10 * 1024 * 1024) return 'File must be under 10MB.';
        return null;
    };

    const handleBachelors = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const err = validateFile(file);
        if (err) { setError(err); return; }
        setError(''); setBachelors(file);
    };

    const handleMasters = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const err = validateFile(file);
        if (err) { setError(err); return; }
        setError(''); setMasters(file);
    };

    const handleCertificates = (e) => {
        const newFiles = Array.from(e.target.files);
        if (certificates.length + newFiles.length > 5) { setError('Maximum 5 certificates allowed.'); return; }
        for (const f of newFiles) {
            const err = validateFile(f);
            if (err) { setError(err); return; }
        }
        setError('');
        setCertificates(prev => [...prev, ...newFiles]);
    };

    const removeCert = (i) => setCertificates(prev => prev.filter((_, idx) => idx !== i));

    const handleUpload = async () => {
        if (!bachelors) { setError("Please upload your Bachelor's degree."); return; }
        setUploading(true); setError('');

        const allFiles = [];
        allFiles.push({ file: bachelors, type: 'bachelors_degree' });
        if (masters) allFiles.push({ file: masters, type: 'masters_degree' });
        certificates.forEach(f => allFiles.push({ file: f, type: 'certificate' }));

        try {
            for (let i = 0; i < allFiles.length; i++) {
                setUploadProgress(`Uploading ${i + 1} of ${allFiles.length}...`);
                const formData = new FormData();
                formData.append('file', allFiles[i].file);
                formData.append('document_type', allFiles[i].type);
                formData.append('qualification_type', 'Education'); 
                await uploadDocument(formData);
            }
            navigate('/onboarding/complete');
        } catch (err) {
            setError('Upload failed. Please try again.');
            console.error(err);
        } finally {
            setUploading(false);
            setUploadProgress('');
        }
    };

    const totalFiles = (bachelors ? 1 : 0) + (masters ? 1 : 0) + certificates.length;

    // Styles
    const uploadZone = (hasFile) => ({
        border: hasFile ? '2px solid #059669' : '2px dashed #d1d5db',
        borderRadius: 10, padding: hasFile ? '14px 18px' : '32px 20px',
        display: 'flex', flexDirection: hasFile ? 'row' : 'column',
        alignItems: 'center', justifyContent: hasFile ? 'space-between' : 'center',
        cursor: 'pointer', background: hasFile ? '#f0fdf4' : '#fff',
        gap: hasFile ? 8 : 0,
    });

    const fileTag = { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 };

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
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>Step 5 of 5</span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Upload Qualifications</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Upload your degree certificates and any additional qualifications.</p>
                </div>

                {/* 1. Bachelor's Degree (Required) */}
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 20 }}>🎓</span>
                            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Bachelor's Degree</h2>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', background: '#fef2f2', padding: '3px 10px', borderRadius: 12 }}>Required</span>
                    </div>
                    <div onClick={() => bachelorRef.current?.click()} style={uploadZone(!!bachelors)}>
                        {bachelors ? (
                            <>
                                <div style={fileTag}>
                                    <span>📎</span>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: '#047857', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bachelors.name}</span>
                                    <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>({(bachelors.size / 1024).toFixed(0)} KB)</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setBachelors(null); }} style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                            </>
                        ) : (
                            <>
                                <span style={{ fontSize: 28, marginBottom: 6 }}>📂</span>
                                <p style={{ fontWeight: 500, color: '#374151', margin: '0 0 2px', fontSize: 14 }}>Click to upload bachelor's degree</p>
                                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>PDF, JPG, PNG • Max 10MB</p>
                            </>
                        )}
                    </div>
                    <input ref={bachelorRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleBachelors} style={{ display: 'none' }} />
                </div>

                {/* 2. Master's Degree (Optional) */}
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 20 }}>📜</span>
                            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Master's Degree</h2>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '3px 10px', borderRadius: 12 }}>Optional</span>
                    </div>
                    <div onClick={() => masterRef.current?.click()} style={uploadZone(!!masters)}>
                        {masters ? (
                            <>
                                <div style={fileTag}>
                                    <span>📎</span>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: '#047857', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{masters.name}</span>
                                    <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>({(masters.size / 1024).toFixed(0)} KB)</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setMasters(null); }} style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                            </>
                        ) : (
                            <>
                                <span style={{ fontSize: 28, marginBottom: 6 }}>📂</span>
                                <p style={{ fontWeight: 500, color: '#374151', margin: '0 0 2px', fontSize: 14 }}>Click to upload master's degree</p>
                                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>PDF, JPG, PNG • Max 10MB</p>
                            </>
                        )}
                    </div>
                    <input ref={masterRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleMasters} style={{ display: 'none' }} />
                </div>

                {/* 3. Certificates (up to 5) */}
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 20 }}>📋</span>
                            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Certificates</h2>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '3px 10px', borderRadius: 12 }}>
                            {certificates.length}/5 • Optional
                        </span>
                    </div>

                    {certificates.length < 5 && (
                        <div onClick={() => certRef.current?.click()} style={{ ...uploadZone(false), padding: '24px 20px', marginBottom: certificates.length > 0 ? 12 : 0 }}>
                            <span style={{ fontSize: 24, marginBottom: 4 }}>➕</span>
                            <p style={{ fontWeight: 500, color: '#374151', margin: '0 0 2px', fontSize: 14 }}>Add certificate</p>
                            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>PDF, JPG, PNG • Max 10MB each</p>
                        </div>
                    )}
                    <input ref={certRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={handleCertificates} style={{ display: 'none' }} />

                    {certificates.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: certificates.length < 5 ? 0 : 0 }}>
                            {certificates.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', background: '#e5e7eb', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                                        <span style={{ fontSize: 14, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                        <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>({(f.size / 1024).toFixed(0)} KB)</span>
                                    </div>
                                    <button onClick={() => removeCert(i)} style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {error && <div style={{ marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#dc2626' }}>{error}</div>}

                <button onClick={handleUpload} disabled={uploading || !bachelors}
                    style={{
                        width: '100%', padding: '14px 0', borderRadius: 10, fontWeight: 600, fontSize: 14, border: 'none',
                        background: (uploading || !bachelors) ? '#e5e7eb' : '#059669',
                        color: (uploading || !bachelors) ? '#9ca3af' : '#fff',
                        cursor: (uploading || !bachelors) ? 'not-allowed' : 'pointer',
                    }}>
                    {uploading ? uploadProgress : `Upload ${totalFiles} Document${totalFiles !== 1 ? 's' : ''} & Complete →`}
                </button>
            </div>
        </div>
    );
};

export default DocumentUpload;