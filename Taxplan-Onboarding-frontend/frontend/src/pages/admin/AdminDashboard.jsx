import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [consultants, setConsultants] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [metricsRange, setMetricsRange] = useState('30d');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [refreshingMetrics, setRefreshingMetrics] = useState(false);
    const [error, setError] = useState('');

    const token = localStorage.getItem('admin_token');

    useEffect(() => {
        if (!token) { navigate('/admin'); return; }
        fetchConsultants();
    }, []);

    useEffect(() => {
        if (!token) return;
        fetchMetrics(metricsRange);
    }, [metricsRange]);

    const fetchConsultants = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/admin-panel/consultants/', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.status === 401 || res.status === 403) { localStorage.removeItem('admin_token'); navigate('/admin'); return; }
            const data = await res.json();
            setConsultants(data.consultants || []);
        } catch { setError('Failed to load consultants'); }
        finally { setLoading(false); }
    };

    const fetchMetrics = async (range = metricsRange) => {
        try {
            const res = await fetch(`http://localhost:8000/api/admin-panel/metrics/?range=${encodeURIComponent(range)}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('admin_token');
                navigate('/admin');
                return;
            }
            const data = await res.json();
            setMetrics(data);
        } catch {
            // Keep dashboard usable even if metrics endpoint fails.
            setMetrics(null);
        } finally {
            setMetricsLoading(false);
            setRefreshingMetrics(false);
        }
    };

    const filtered = consultants.filter(c =>
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.phone_number?.includes(search)
    );

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        navigate('/admin');
    };

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
                    maxWidth: 1300, margin: '0 auto', padding: '0 32px',
                    height: 60, display: 'flex', alignItems: 'center', gap: 14,
                }}>
                    <div style={{
                        width: 36, height: 36,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>T</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>Admin Dashboard</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 4 }}>TaxplanAdvisor</span>

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: 'rgba(16,185,129,0.15)', color: '#34d399',
                            border: '1px solid rgba(16,185,129,0.25)',
                        }}>
                            {consultants.length} Consultants
                        </span>
                        <button onClick={handleLogout} style={{
                            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: 'rgba(239,68,68,0.1)', color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 32px' }}>
                {/* Search */}
                <div style={{ marginBottom: 24 }}>
                    <input
                        placeholder="Search by name, email, or phone..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%', maxWidth: 420, padding: '11px 16px', borderRadius: 10,
                            background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)',
                            color: '#f1f5f9', fontSize: 13, outline: 'none',
                            boxSizing: 'border-box',
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#10b981'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(148,163,184,0.15)'}
                    />
                </div>

                {/* Metrics */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Proctoring Metrics</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select
                            value={metricsRange}
                            onChange={(e) => {
                                setMetricsLoading(true);
                                setMetricsRange(e.target.value);
                            }}
                            style={{
                                padding: '7px 10px',
                                borderRadius: 8,
                                border: '1px solid rgba(148,163,184,0.2)',
                                background: 'rgba(30,41,59,0.6)',
                                color: '#e2e8f0',
                                fontSize: 12,
                                outline: 'none',
                            }}
                        >
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                            <option value="all">All time</option>
                        </select>
                        <button
                            onClick={() => {
                                setRefreshingMetrics(true);
                                setMetricsLoading(true);
                                fetchMetrics(metricsRange);
                            }}
                            disabled={refreshingMetrics}
                            style={{
                                padding: '7px 12px',
                                borderRadius: 8,
                                border: '1px solid rgba(96,165,250,0.35)',
                                background: refreshingMetrics ? 'rgba(96,165,250,0.08)' : 'rgba(96,165,250,0.12)',
                                color: '#bfdbfe',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: refreshingMetrics ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {refreshingMetrics ? 'Refreshing...' : 'Refresh Metrics'}
                        </button>
                    </div>
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                    marginBottom: 20,
                }}>
                    <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.1)', padding: 14 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Flag Rate</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#fca5a5' }}>
                            {metricsLoading ? '...' : `${metrics?.sessions?.flag_rate_pct ?? 0}%`}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            Flagged: {metrics?.sessions?.flagged ?? 0} / {metrics?.sessions?.total ?? 0}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.1)', padding: 14 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Snapshot Violation Rate</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24' }}>
                            {metricsLoading ? '...' : `${metrics?.snapshots?.violation_rate_pct ?? 0}%`}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            Violations: {metrics?.snapshots?.violations ?? 0} / {metrics?.snapshots?.total ?? 0}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.1)', padding: 14 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Detector Fallback Rate</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#93c5fd' }}>
                            {metricsLoading ? '...' : `${metrics?.fallback?.rate_pct ?? 0}%`}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            Fallback count: {metrics?.fallback?.count ?? 0}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.1)', padding: 14 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Permission Issue Rate</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#f87171' }}>
                            {metricsLoading ? '...' : `${metrics?.permission_issues?.rate_pct ?? 0}%`}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            Webcam {metrics?.permission_issues?.webcam_issue_count ?? 0} | Mic {metrics?.permission_issues?.mic_issue_count ?? 0}
                        </div>
                    </div>
                </div>

                {metrics?.top_violation_reasons?.length > 0 && (
                    <div style={{
                        background: 'rgba(30,41,59,0.5)', borderRadius: 12, border: '1px solid rgba(148,163,184,0.1)',
                        padding: 14, marginBottom: 20,
                    }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Top Violation Reasons</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {metrics.top_violation_reasons.slice(0, 6).map((row, idx) => (
                                <span key={`${row.reason}-${idx}`} style={{
                                    fontSize: 12,
                                    color: '#fca5a5',
                                    background: 'rgba(239,68,68,0.12)',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    borderRadius: 16,
                                    padding: '4px 10px',
                                    fontWeight: 600,
                                }}>
                                    {row.reason} ({row.count})
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {loading && (
                    <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
                        <div style={{
                            width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#10b981',
                            borderRadius: '50%', margin: '0 auto 16px',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                        Loading consultants...
                        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    </div>
                )}

                {error && <div style={{ textAlign: 'center', padding: 40, color: '#f87171' }}>{error}</div>}

                {!loading && !error && (
                    <div style={{
                        background: 'rgba(30,41,59,0.5)', borderRadius: 14,
                        border: '1px solid rgba(148,163,184,0.1)',
                        overflow: 'hidden',
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                    {['Name', 'Email', 'Phone', 'Assessment', 'Score', 'Video', 'Docs', 'Credentials', 'Joined'].map(h => (
                                        <th key={h} style={{
                                            padding: '14px 16px', textAlign: 'left', fontSize: 11,
                                            fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
                                            letterSpacing: 0.8,
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((c, i) => (
                                    <tr key={c.id}
                                        onClick={() => navigate(`/admin/consultant/${c.id}`)}
                                        style={{
                                            borderBottom: '1px solid rgba(148,163,184,0.06)',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s',
                                            background: i % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.3)',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.3)'}
                                    >
                                        <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                                            {c.full_name || '—'}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8' }}>{c.email}</td>
                                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8' }}>{c.phone_number || '—'}</td>

                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                                background: c.assessment_status === 'Completed' ? 'rgba(59,130,246,0.12)' :
                                                    c.assessment_status === 'Ongoing' ? 'rgba(245,158,11,0.12)' :
                                                        c.assessment_status === 'Violated' || c.assessment_status === 'Flagged' ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.12)',
                                                color: c.assessment_status === 'Completed' ? '#60a5fa' :
                                                    c.assessment_status === 'Ongoing' ? '#fbbf24' :
                                                        c.assessment_status === 'Violated' || c.assessment_status === 'Flagged' ? '#f87171' : '#64748b',
                                            }}>
                                                {c.assessment_status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                                            {c.assessment_score != null ? `${c.assessment_score}/50` : '—'}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                                            {c.video_score != null ? `${c.video_score}/${c.video_total || '?'}` : '—'}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8' }}>
                                            {c.document_count}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                                background: c.has_credentials ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)',
                                                color: c.has_credentials ? '#34d399' : '#64748b',
                                                border: `1px solid ${c.has_credentials ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.15)'}`,
                                            }}>
                                                {c.has_credentials ? '✓ Sent' : '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748b' }}>
                                            {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                                            {search ? 'No consultants match your search.' : 'No consultants found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
