import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const ConsultantDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [credentialsPopup, setCredentialsPopup] = useState(null);
    const [error, setError] = useState('');
    const [openSections, setOpenSections] = useState({
        profile: true, identity: true, face: true, assessment: true, documents: true,
    });
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedVideoCard, setSelectedVideoCard] = useState(null);

    const token = localStorage.getItem('admin_token');

    useEffect(() => {
        if (!token) { navigate('/admin'); return; }
        fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/admin-panel/consultants/${id}/`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.status === 401 || res.status === 403) { localStorage.removeItem('admin_token'); navigate('/admin'); return; }
            if (res.status === 404) { setError('Consultant not found'); setLoading(false); return; }
            const d = await res.json();
            setData(d);
        } catch { setError('Failed to load data'); }
        finally { setLoading(false); }
    };

    const handleGenerateCredentials = async () => {
        if (!window.confirm("Are you sure you want to generate and email credentials to this consultant?")) return;
        setGenerating(true);
        try {
            const res = await fetch(`http://localhost:8000/api/admin-panel/consultants/${id}/generate-credentials/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const d = await res.json();
            if (res.ok) {
                setCredentialsPopup({ username: d.username, password: d.password, message: d.message });
                fetchDetail();
            } else {
                alert(`Error: ${d.error}`);
            }
        } catch (err) {
            alert('Failed to connect to server');
        } finally {
            setGenerating(false);
        }
    };

    const handleRefresh = () => {
        fetchDetail();
    };

    const toggle = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

    // Styles
    const sectionStyle = {
        background: 'rgba(30,41,59,0.5)', borderRadius: 14,
        border: '1px solid rgba(148,163,184,0.1)', marginBottom: 16, overflow: 'hidden',
    };

    const sectionHeader = (title, key, icon, action = null) => (
        <div onClick={() => toggle(key)} style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', borderBottom: openSections[key] ? '1px solid rgba(148,163,184,0.08)' : 'none',
            transition: 'background 0.15s',
        }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.03)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', flex: 1 }}>{title}</span>
            {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
            <span style={{
                color: '#64748b', fontSize: 18, fontWeight: 300,
                transform: openSections[key] ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
            }}>▾</span>
        </div>
    );

    const fieldRow = (label, value) => (
        <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
            <span style={{ width: 180, fontSize: 13, color: '#64748b', fontWeight: 500, flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, wordBreak: 'break-all' }}>
                {value || <span style={{ color: '#475569' }}>—</span>}
            </span>
        </div>
    );

    const statusTag = (val, trueText, falseText) => (
        <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: val ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
            color: val ? '#34d399' : '#f87171',
        }}>
            {val ? trueText : falseText}
        </span>
    );

    const isPdf = (url) => url && url.split('?')[0].toLowerCase().endsWith('.pdf');

    const imgStyle = {
        maxWidth: '100%', maxHeight: 300, borderRadius: 8,
        border: '1px solid rgba(148,163,184,0.15)', objectFit: 'contain',
        background: 'rgba(15,23,42,0.6)',
    };

    if (loading) return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: "'Inter', system-ui, sans-serif", color: '#64748b',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: 40, height: 40, border: '3px solid #334155', borderTopColor: '#10b981',
                    borderRadius: '50%', margin: '0 auto 16px',
                    animation: 'spin 0.8s linear infinite',
                }} />
                Loading consultant data...
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        </div>
    );

    if (error) return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: "'Inter', system-ui, sans-serif", color: '#f87171',
        }}>
            {error}
        </div>
    );

    const p = data?.profile || {};
    const identityDocs = data?.identity_documents || [];
    const faceRecords = data?.face_verification || [];
    const sessions = data?.assessment_sessions || [];
    const qualDocs = data?.documents?.qualification_documents || [];
    const consultDocs = data?.documents?.consultant_documents || [];

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: "'Inter', system-ui, sans-serif", color: '#f1f5f9',
        }}>
            {/* Header */}
            <header style={{
                background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(148,163,184,0.1)',
                position: 'sticky', top: 0, zIndex: 30,
            }}>
                <div style={{
                    maxWidth: 1000, margin: '0 auto', padding: '0 32px',
                    height: 60, display: 'flex', alignItems: 'center', gap: 14,
                }}>
                    <button onClick={() => navigate('/admin/dashboard')} style={{
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                        border: '1px solid rgba(148,163,184,0.15)', cursor: 'pointer',
                    }}>
                        ← Back
                    </button>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>{p.full_name || p.email}</span>
                        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10 }}>{p.email}</span>
                    </div>

                </div>
            </header>

            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 32px' }}>

                {/* ===== PROFILE ===== */}
                <div style={sectionStyle}>
                    {sectionHeader('Profile Details', 'profile', '👤',
                        p.is_verified && (
                            !p.has_credentials ? (
                                <button
                                    onClick={handleGenerateCredentials}
                                    disabled={generating}
                                    style={{
                                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                        background: generating ? '#94a3b8' : '#3b82f6', color: '#fff',
                                        border: 'none', cursor: generating ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.2s',
                                        boxShadow: '0 2px 4px rgba(59,130,246,0.3)',
                                    }}
                                >
                                    {generating ? 'Generating...' : 'Generate Credentials'}
                                </button>
                            ) : (
                                <span style={{
                                    padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                    background: 'rgba(16,185,129,0.15)', color: '#34d399',
                                    border: '1px solid rgba(16,185,129,0.25)', display: 'inline-flex', alignItems: 'center', gap: 6
                                }}>
                                    ✓ Credentials Sent
                                </span>
                            )
                        )
                    )}
                    {openSections.profile && (
                        <div style={{ padding: '12px 20px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
                                <div>
                                    {fieldRow('First Name', p.first_name)}
                                    {fieldRow('Middle Name', p.middle_name)}
                                    {fieldRow('Last Name', p.last_name)}
                                    {fieldRow('Date of Birth', p.dob)}
                                    {fieldRow('Age', p.age)}
                                    {fieldRow('Phone', p.phone_number)}
                                    {fieldRow('Email', p.email)}
                                </div>
                                <div>
                                    {fieldRow('Address Line 1', p.address_line1)}
                                    {fieldRow('Address Line 2', p.address_line2)}
                                    {fieldRow('City', p.city)}
                                    {fieldRow('State', p.state)}
                                    {fieldRow('Pincode', p.pincode)}
                                    {fieldRow('Practice Type', p.practice_type)}
                                    {fieldRow('Experience', p.years_of_experience ? `${p.years_of_experience} years` : null)}
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
                                {fieldRow('Joined', p.created_at ? new Date(p.created_at).toLocaleString() : null)}
                                {fieldRow('Updated', p.updated_at ? new Date(p.updated_at).toLocaleString() : null)}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, background: p.has_accepted_declaration ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${p.has_accepted_declaration ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                                    <span style={{ fontSize: 13, color: '#94a3b8' }}>Declaration:</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: p.has_accepted_declaration ? '#34d399' : '#f87171' }}>
                                        {p.has_accepted_declaration ? '✅ Accepted' : '❌ Pending'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ===== IDENTITY DOCUMENTS ===== */}
                <div style={sectionStyle}>
                    {sectionHeader(`Identity Documents (${identityDocs.length})`, 'identity', '🪪')}
                    {openSections.identity && (
                        <div style={{ padding: '12px 20px 20px' }}>
                            {identityDocs.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: 13 }}>No identity documents uploaded.</p>
                            ) : identityDocs.map((doc, i) => (
                                <div key={i} style={{
                                    padding: 18, borderRadius: 12, marginBottom: 16,
                                    background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.1)',
                                }}>
                                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                        {/* Image Section */}
                                        <div style={{ flex: '0 0 auto', width: 200 }}>
                                            {doc.file_url ? (
                                                <div style={{ marginBottom: 8 }}>
                                                    <img src={doc.file_url} alt="Identity Document" style={{ ...imgStyle, cursor: 'pointer', height: 140, objectFit: 'cover', width: '100%' }}
                                                        onClick={() => setSelectedImage(doc.file_url)}
                                                        onError={(e) => { e.target.style.display = 'none'; }} />
                                                </div>
                                            ) : (
                                                <div style={{ height: 140, borderRadius: 8, background: 'rgba(30,41,59,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#f87171', marginBottom: 8 }}>
                                                    ⚠ Could not load image
                                                </div>
                                            )}
                                            <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                                                Uploaded: <span style={{ color: '#94a3b8' }}>{new Date(doc.uploaded_at).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* Verification Details Section */}
                                        <div style={{ flex: 1, minWidth: 250, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div style={{ padding: 16, background: 'rgba(15,23,42,0.6)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.05)', height: '100%' }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                    AI Verification Results
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Document Type Identified:</div>
                                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                                                            {doc.document_type || 'Unknown'}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Verification Status:</div>
                                                        <div>
                                                            <span style={{
                                                                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                                                background: doc.verification_status === 'Verified' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                                                                color: doc.verification_status === 'Verified' ? '#34d399' : '#f87171',
                                                                display: 'inline-block'
                                                            }}>
                                                                {doc.verification_status || 'Pending / Unverified'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {doc.gemini_raw_response && (() => {
                                                        try {
                                                            const parsed = JSON.parse(doc.gemini_raw_response);
                                                            return (
                                                                <>
                                                                    {parsed.extracted_name && (
                                                                        <div>
                                                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Extracted Name:</div>
                                                                            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{parsed.extracted_name}</div>
                                                                        </div>
                                                                    )}
                                                                    {parsed.extracted_dob && (
                                                                        <div>
                                                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Extracted DOB:</div>
                                                                            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{parsed.extracted_dob}</div>
                                                                        </div>
                                                                    )}
                                                                    {parsed.extracted_id_number && (
                                                                        <div>
                                                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Extracted ID Number:</div>
                                                                            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{parsed.extracted_id_number}</div>
                                                                        </div>
                                                                    )}
                                                                    <div style={{ marginTop: 4 }}>
                                                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>AI Notes:</div>
                                                                        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 6 }}>
                                                                            {parsed.notes || 'No additional notes.'}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            );
                                                        } catch (e) {
                                                            return (
                                                                <div style={{ marginTop: 4 }}>
                                                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>AI Notes:</div>
                                                                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 6 }}>
                                                                        Could not parse notes.
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ===== FACE VERIFICATION ===== */}
                <div style={sectionStyle}>
                    {sectionHeader(`Face Verification (${faceRecords.length})`, 'face', '📸')}
                    {openSections.face && (
                        <div style={{ padding: '12px 20px 20px' }}>
                            {faceRecords.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: 13 }}>No face verification records.</p>
                            ) : faceRecords.map((f, i) => (
                                <div key={i} style={{
                                    padding: 16, borderRadius: 10, marginBottom: 10,
                                    background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.08)',
                                }}>
                                    {/* Photos side by side */}
                                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                ID Photo
                                            </div>
                                            {f.id_image_url ? (
                                                <img src={f.id_image_url} alt="ID Photo"
                                                    onClick={() => setSelectedImage(f.id_image_url)}
                                                    style={{ width: 200, height: 240, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer' }}
                                                    onError={(e) => { e.target.outerHTML = '<div style="width:200px;height:240px;border-radius:8px;background:rgba(30,41,59,0.8);display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px">Failed to load</div>'; }} />
                                            ) : (
                                                <div style={{ width: 200, height: 240, borderRadius: 8, background: 'rgba(30,41,59,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 12 }}>
                                                    No image
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                Live Photo
                                            </div>
                                            {f.live_image_url ? (
                                                <img src={f.live_image_url} alt="Live Photo"
                                                    onClick={() => setSelectedImage(f.live_image_url)}
                                                    style={{ width: 200, height: 240, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer' }}
                                                    onError={(e) => { e.target.outerHTML = '<div style="width:200px;height:240px;border-radius:8px;background:rgba(30,41,59,0.8);display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px">Failed to load</div>'; }} />
                                            ) : (
                                                <div style={{ width: 200, height: 240, borderRadius: 8, background: 'rgba(30,41,59,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 12 }}>
                                                    No image
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Match info */}
                                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <div style={{ fontSize: 13 }}>
                                            <span style={{ color: '#64748b' }}>Match: </span>
                                            {statusTag(f.is_match, 'Match ✓', 'No Match ✗')}
                                        </div>
                                        <div style={{ fontSize: 13, color: '#64748b' }}>
                                            Confidence: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
                                                {f.confidence != null ? `${f.confidence.toFixed(2)}%` : '—'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                            Verified: <span style={{ color: '#94a3b8' }}>{new Date(f.verified_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ===== ASSESSMENT SESSIONS ===== */}
                <div style={sectionStyle}>
                    {sectionHeader(`Assessment Sessions (${sessions.length})`, 'assessment', '📝')}
                    {openSections.assessment && (
                        <div style={{ padding: '12px 20px 20px' }}>
                            {sessions.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: 13 }}>No assessment sessions.</p>
                            ) : sessions.map((s, i) => (
                                <div key={i} style={{
                                    padding: 16, borderRadius: 10, marginBottom: 14,
                                    background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.08)',
                                }}>
                                    {/* Session header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>
                                            {s.test_type || 'Unknown Test'}
                                        </span>
                                        {(() => {
                                            const isViolated = s.violation_count > 0 && s.status !== 'flagged';
                                            const displayStatus = isViolated ? 'Violated' : s.status?.charAt(0).toUpperCase() + s.status?.slice(1);
                                            const isRed = s.status === 'flagged' || isViolated;
                                            const isGreen = s.status === 'completed' && !isViolated;
                                            const isYellow = s.status === 'ongoing' && !isViolated;

                                            return (
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                                    background: isGreen ? 'rgba(16,185,129,0.15)'
                                                        : isRed ? 'rgba(239,68,68,0.12)'
                                                            : isYellow ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
                                                    color: isGreen ? '#34d399'
                                                        : isRed ? '#f87171'
                                                            : isYellow ? '#fbbf24' : '#64748b',
                                                }}>
                                                    {displayStatus}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    {/* Score cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
                                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.06)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: s.status === 'flagged' ? '#64748b' : '#10b981' }}>
                                                {s.status === 'flagged' ? 'N/A' : `${s.score}/50`}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>MCQ Score</div>
                                        </div>
                                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.06)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: s.status === 'flagged' ? '#64748b' : '#a855f7' }}>
                                                {s.status === 'flagged' ? 'N/A' : `${s.video_responses?.reduce((sum, v) => sum + (v.ai_score || 0), 0) || 0}/${(s.video_question_set?.length || 0) * 5}`}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Video Score</div>
                                        </div>
                                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.06)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: s.violation_count > 0 ? '#f87171' : '#34d399' }}>{s.violation_count}</div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Violations</div>
                                        </div>
                                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.06)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#60a5fa' }}>{s.video_responses?.length || 0}</div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Videos Submitted</div>
                                        </div>
                                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.06)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginTop: 4 }}>{s.selected_domains?.join(', ') || '—'}</div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Domains</div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
                                        <span>Started: <span style={{ color: '#94a3b8' }}>{s.start_time ? new Date(s.start_time).toLocaleString() : '—'}</span></span>
                                        <span>Ended: <span style={{ color: '#94a3b8' }}>{s.end_time ? new Date(s.end_time).toLocaleString() : '—'}</span></span>
                                    </div>

                                    {/* Violations detail */}
                                    {s.violations?.length > 0 && (
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>Violation Log</div>
                                            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(239,68,68,0.1)' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ background: 'rgba(239,68,68,0.05)' }}>
                                                            <th style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'left', fontWeight: 600 }}>Type</th>
                                                            <th style={{ padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'left', fontWeight: 600 }}>Timestamp</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {s.violations.map((v, vi) => (
                                                            <tr key={vi} style={{ borderTop: '1px solid rgba(148,163,184,0.05)' }}>
                                                                <td style={{ padding: '8px 12px', fontSize: 12, color: '#fca5a5' }}>{v.violation_type}</td>
                                                                <td style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}>{new Date(v.timestamp).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Proctoring Snapshots */}
                                    {s.proctoring_snapshots?.length > 0 && (
                                        <div style={{ marginBottom: 20 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>Proctoring Snapshots</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                                                {s.proctoring_snapshots.map((snap, si) => (
                                                    <div key={si} style={{
                                                        position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                                                        border: snap.is_violation ? '2px solid #ef4444' : '1px solid rgba(148,163,184,0.1)',
                                                        background: 'rgba(15,23,42,0.6)'
                                                    }} onClick={() => setSelectedImage(snap.image_url)}>
                                                        <img src={snap.image_url} alt="Snapshot" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Error'; }} />

                                                        {snap.is_violation && (
                                                            <div style={{
                                                                position: 'absolute', top: 0, right: 0, background: '#ef4444', color: 'white',
                                                                fontSize: 9, fontWeight: 700, padding: '2px 4px', borderBottomLeftRadius: 6,
                                                                zIndex: 10
                                                            }}>VIOLATION</div>
                                                        )}

                                                        <div style={{ padding: '6px 4px', fontSize: 9 }}>
                                                            <div style={{ color: '#94a3b8', marginBottom: 2 }}>{new Date(snap.timestamp).toLocaleTimeString()}</div>
                                                            <div style={{ color: '#e2e8f0' }}>Faces: {snap.face_count}</div>
                                                            {snap.match_score > 0 && (
                                                                <div style={{ color: snap.match_score > 80 ? '#34d399' : '#f87171' }}>match: {Math.round(snap.match_score)}%</div>
                                                            )}
                                                            {snap.is_violation && (
                                                                <div style={{ color: '#fca5a5', fontWeight: 600, marginTop: 2, lineHeight: 1.2 }}>
                                                                    {snap.violation_reason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Video Responses — List all questions */}
                                    {s.video_question_set?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>Video Responses</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                                {s.video_question_set.map((q, qi) => {
                                                    const response = s.video_responses?.find(v => v.question_identifier === q.id);
                                                    return (
                                                        <div key={qi} style={{
                                                            padding: 12, borderRadius: 10,
                                                            background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.06)',
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                                                                        Video {qi + 1}
                                                                    </span>
                                                                    {response && (
                                                                        <button
                                                                            onClick={() => {
                                                                                // Pause all videos on the page before opening the modal
                                                                                document.querySelectorAll('video').forEach(vid => vid.pause());
                                                                                setSelectedVideoCard({ ...response, question: q.text || q.question });
                                                                            }}
                                                                            style={{
                                                                                background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0,
                                                                                fontSize: 14, display: 'flex', alignItems: 'center'
                                                                            }}
                                                                            title="Expand Details"
                                                                        >
                                                                            ⤢
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {response ? (
                                                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 10 }}>Submitted</span>
                                                                ) : (
                                                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 10 }}>Missing</span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
                                                                {q.text || q.question}
                                                            </div>
                                                            {response && response.video_url ? (
                                                                <>
                                                                    <div style={{ position: 'relative' }}>
                                                                        <video
                                                                            src={response.video_url}
                                                                            controls
                                                                            style={{ width: '100%', maxHeight: 200, borderRadius: 6, background: '#000' }}
                                                                        />
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span>{new Date(response.uploaded_at).toLocaleString()}</span>

                                                                        {/* AI Evaluation Control */}
                                                                        {response.ai_status === 'failed' ? (
                                                                            <span style={{ color: '#fca5a5', fontWeight: 600, fontSize: 11 }}>⚠ Evaluation Failed</span>
                                                                        ) : (!response.ai_status || response.ai_status === 'pending' || response.ai_status === 'processing') ? (
                                                                            <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                <span style={{ animation: 'pulse 1.5s infinite' }}>⚡</span> Analyzing...
                                                                                <button onClick={handleRefresh} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>Refresh</button>
                                                                            </span>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                                <span style={{ color: '#34d399', fontWeight: 600, fontSize: 11 }}>✓ Evaluated</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* AI Results Display */}
                                                                    {response.ai_status === 'completed' && (
                                                                        <div style={{ marginTop: 12, padding: 12, background: 'rgba(139, 92, 246, 0.1)', borderRadius: 8, border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>AI SCORE</span>
                                                                                <span style={{ fontSize: 14, fontWeight: 800, color: '#ddd6fe' }}>{response.ai_score}/5</span>
                                                                            </div>
                                                                            <div style={{ marginBottom: 8 }}>
                                                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>TRANSCRIPT</div>
                                                                                <div style={{ fontSize: 11, color: '#c4b5fd', maxHeight: 60, overflowY: 'auto', fontStyle: 'italic' }}>
                                                                                    "{response.ai_transcript}"
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>FEEDBACK</div>
                                                                                <div style={{ fontSize: 11, color: '#c4b5fd' }}>
                                                                                    {response.ai_feedback?.feedback || response.ai_feedback}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12, background: 'rgba(15,23,42,0.6)', borderRadius: 6, border: '1px dashed rgba(148,163,184,0.2)' }}>
                                                                    No video response
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}


                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ===== UPLOADED DOCUMENTS ===== */}
                <div style={sectionStyle}>
                    {sectionHeader(`Uploaded Documents (${qualDocs.length + consultDocs.length})`, 'documents', '📄')}
                    {openSections.documents && (
                        <div style={{ padding: '12px 20px 20px' }}>
                            {qualDocs.length === 0 && consultDocs.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: 13 }}>No documents uploaded.</p>
                            ) : (
                                <div>
                                    {qualDocs.length > 0 && (
                                        <>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 10 }}>
                                                Qualification Documents
                                            </div>
                                            {qualDocs.map((d, i) => (
                                                <div key={i} style={{
                                                    padding: 14, borderRadius: 10, marginBottom: 10,
                                                    background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.08)',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <div>
                                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{d.document_type}</span>
                                                            {d.title && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>({d.title})</span>}
                                                        </div>
                                                        <span style={{ fontSize: 11, color: '#64748b' }}>
                                                            {new Date(d.uploaded_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    {d.file_url ? (
                                                        <div onClick={() => setSelectedImage(d.file_url)} style={{ cursor: 'pointer' }}>
                                                            {isPdf(d.file_url) ? (
                                                                <div style={{
                                                                    ...imgStyle, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                                    color: '#fca5a5', gap: 10, background: 'rgba(239,68,68,0.1)'
                                                                }}>
                                                                    <span style={{ fontSize: 48 }}>📄</span>
                                                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>PDF Document</span>
                                                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Click to preview</span>
                                                                </div>
                                                            ) : (
                                                                <img src={d.file_url} alt={d.document_type}
                                                                    style={{ ...imgStyle, maxHeight: 250 }}
                                                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                                                                />
                                                            )}
                                                            {/* Fallback container for broken images */}
                                                            <div style={{ display: 'none', padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12, background: 'rgba(15,23,42,0.6)', borderRadius: 8 }}>
                                                                ⚠ Image not available
                                                                <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    style={{ display: 'block', marginTop: 8, color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}>
                                                                    View / Download
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>⚠ File not available</div>
                                                    )}
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {consultDocs.length > 0 && (
                                        <>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 10, marginTop: qualDocs.length > 0 ? 16 : 0 }}>
                                                Consultant Documents
                                            </div>
                                            {consultDocs.map((d, i) => (
                                                <div key={i} style={{
                                                    padding: 18, borderRadius: 12, marginBottom: 16,
                                                    background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.1)',
                                                }}>
                                                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                                        {/* Document Preview Section */}
                                                        <div style={{ flex: '0 0 auto', width: 220 }}>
                                                            <div style={{ marginBottom: 10 }}>
                                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', display: 'block' }}>{d.qualification_type}</span>
                                                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.document_type}</span>
                                                            </div>
                                                            {d.file_url ? (
                                                                <div onClick={() => setSelectedImage(d.file_url)} style={{ cursor: 'pointer' }}>
                                                                    {isPdf(d.file_url) ? (
                                                                        <div style={{
                                                                            ...imgStyle, height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                                            color: '#60a5fa', gap: 10, background: 'rgba(59,130,246,0.1)', cursor: 'pointer'
                                                                        }}>
                                                                            <span style={{ fontSize: 36 }}>📄</span>
                                                                            <span style={{ fontSize: 12, fontWeight: 600 }}>PDF Document</span>
                                                                        </div>
                                                                    ) : (
                                                                        <img src={d.file_url} alt={d.document_type}
                                                                            style={{ ...imgStyle, height: 140, width: '100%', objectFit: 'cover' }}
                                                                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                                                                        />
                                                                    )}
                                                                    <div style={{ display: 'none', padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12, background: 'rgba(15,23,42,0.6)', borderRadius: 8 }}>
                                                                        ⚠ Image not available
                                                                        <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            style={{ display: 'block', marginTop: 8, color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}>
                                                                            View / Download
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div style={{ height: 140, borderRadius: 8, background: 'rgba(30,41,59,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#f87171' }}>
                                                                    ⚠ File not available
                                                                </div>
                                                            )}
                                                            <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 8 }}>
                                                                Uploaded: <span style={{ color: '#94a3b8' }}>{new Date(d.uploaded_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>

                                                        {/* Verification Details Section */}
                                                        <div style={{ flex: 1, minWidth: 250, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                            <div style={{ padding: 16, background: 'rgba(15,23,42,0.6)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.05)', height: '100%' }}>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                                    AI Verification Results
                                                                </div>

                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                                    <div>
                                                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Document Type Identified:</div>
                                                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                                                                            {(() => {
                                                                                try {
                                                                                    if (d.gemini_raw_response) {
                                                                                        return JSON.parse(d.gemini_raw_response).determined_type || 'Unknown';
                                                                                    }
                                                                                } catch (e) { }
                                                                                return 'Unknown';
                                                                            })()}
                                                                        </div>
                                                                    </div>

                                                                    <div>
                                                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Verification Status:</div>
                                                                        <div>
                                                                            <span style={{
                                                                                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                                                                background: d.verification_status === 'Verified' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                                                                                color: d.verification_status === 'Verified' ? '#34d399' : '#f87171',
                                                                                display: 'inline-block'
                                                                            }}>
                                                                                {d.verification_status || 'Pending / Unverified'}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {d.gemini_raw_response && (
                                                                        <div style={{ marginTop: 4 }}>
                                                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>AI Notes:</div>
                                                                            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 6 }}>
                                                                                {(() => {
                                                                                    try {
                                                                                        const parsed = JSON.parse(d.gemini_raw_response);
                                                                                        return parsed.notes || 'No additional notes.';
                                                                                    } catch (e) {
                                                                                        return 'Could not parse notes.';
                                                                                    }
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>

            {/* Credentials Modal */}
            {credentialsPopup && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setCredentialsPopup(null)}>
                    <div style={{
                        background: '#1e293b', padding: 32, borderRadius: 16, width: 400,
                        border: '1px solid rgba(148,163,184,0.1)', textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                        <h3 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Credentials Generated!</h3>
                        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                            {credentialsPopup.message}
                        </p>

                        <div style={{ background: 'rgba(15,23,42,0.6)', padding: 16, borderRadius: 8, marginBottom: 24, textAlign: 'left' }}>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Username</div>
                                <div style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' }}>{credentialsPopup.username}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Password</div>
                                <div style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' }}>{credentialsPopup.password}</div>
                            </div>
                        </div>

                        <button onClick={() => setCredentialsPopup(null)} style={{
                            width: '100%', padding: '10px', borderRadius: 8,
                            background: '#3b82f6', color: '#fff', border: 'none',
                            fontWeight: 600, fontSize: 14, cursor: 'pointer'
                        }}>
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* Image Modal */}
            {
                selectedImage && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40
                    }} onClick={() => setSelectedImage(null)}>
                        <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
                            <button onClick={() => setSelectedImage(null)} style={{
                                position: 'absolute', top: -50, right: 0,
                                background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(0,0,0,0.5)', borderRadius: 20
                            }}>
                                ✕ Close
                            </button>
                            {isPdf(selectedImage) ? (
                                <iframe src={selectedImage} title="Document Preview" style={{
                                    width: '80vw', height: '80vh', borderRadius: 8, border: 'none', background: '#fff'
                                }} />
                            ) : (
                                <img src={selectedImage} alt="Full view" style={{
                                    maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain',
                                    borderRadius: 8, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                                }} />
                            )}
                        </div>
                    </div>
                )
            }
            {/* Expanded Video Card Modal */}
            {
                selectedVideoCard && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                    }} onClick={() => setSelectedVideoCard(null)}>
                        <div style={{
                            position: 'relative', width: '100%', maxWidth: 800, maxHeight: '90vh',
                            background: '#1e293b', borderRadius: 16, border: '1px solid rgba(148,163,184,0.1)',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden'
                        }} onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div style={{
                                padding: '16px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.5)'
                            }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Video Analysis</h3>
                                <button onClick={() => setSelectedVideoCard(null)} style={{
                                    background: 'none', border: 'none', color: '#94a3b8', fontSize: 24, cursor: 'pointer',
                                    padding: 0, display: 'flex', alignItems: 'center'
                                }}>
                                    ✕
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div style={{ padding: 24, overflowY: 'auto' }}>
                                {/* Question */}
                                <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 20, lineHeight: 1.5 }}>
                                    {selectedVideoCard.question}
                                </div>

                                {/* Video Player */}
                                <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden', background: '#000', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                    <video
                                        controls
                                        style={{ width: '100%', maxHeight: 400, display: 'block' }}
                                    >
                                        <source src={selectedVideoCard.video_url} type="video/webm" />
                                        Your browser does not support the video tag.
                                    </video>
                                </div>

                                {/* Results Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 2fr', gap: 24 }}>
                                    {/* Score Column */}
                                    <div style={{
                                        padding: 20, background: 'rgba(15,23,42,0.4)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.08)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8
                                    }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>AI Score</div>
                                        <div style={{ fontSize: 48, fontWeight: 800, color: '#10b981' }}>{selectedVideoCard.ai_score}/5</div>
                                        <div style={{
                                            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                            background: 'rgba(16,185,129,0.1)', color: '#34d399'
                                        }}>
                                            {selectedVideoCard.ai_status === 'completed' ? 'Evaluated' : selectedVideoCard.ai_status}
                                        </div>
                                    </div>

                                    {/* Feedback Column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div style={{ padding: 16, background: 'rgba(15,23,42,0.4)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.08)' }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>Transcript</div>
                                            <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, fontStyle: 'italic', maxHeight: 150, overflowY: 'auto' }}>
                                                "{selectedVideoCard.ai_transcript}"
                                            </div>
                                        </div>

                                        <div style={{ padding: 16, background: 'rgba(59,130,246,0.05)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.1)' }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 8, textTransform: 'uppercase' }}>AI Feedback</div>
                                            <div style={{ fontSize: 14, color: '#bfdbfe', lineHeight: 1.6 }}>
                                                {selectedVideoCard.ai_feedback?.feedback || selectedVideoCard.ai_feedback}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ConsultantDetail;
