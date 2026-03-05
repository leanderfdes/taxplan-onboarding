import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createSession, getProctoringPolicy } from '../../services/api';

const Instructions = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedTests = location.state?.selectedTests || [];
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [deviceChecking, setDeviceChecking] = useState(false);
    const [cameraStatus, setCameraStatus] = useState('Not tested');
    const [micStatus, setMicStatus] = useState('Not tested');
    const [micLevel, setMicLevel] = useState(0);
    const [deviceError, setDeviceError] = useState('');
    const previewVideoRef = useRef(null);
    const testStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const audioDataRef = useRef(null);
    const rafRef = useRef(null);
    const [policy, setPolicy] = useState({
        max_tab_warnings: 3,
        max_webcam_warnings: 3,
        max_fullscreen_exits: 3,
    });
    if (selectedTests.length === 0) { navigate('/assessment/select'); return null; }

    useEffect(() => {
        let mounted = true;
        const loadPolicy = async () => {
            try {
                const res = await getProctoringPolicy();
                if (!mounted) return;
                setPolicy({
                    max_tab_warnings: res?.thresholds?.max_tab_warnings ?? 3,
                    max_webcam_warnings: res?.thresholds?.max_webcam_warnings ?? 3,
                    max_fullscreen_exits: res?.thresholds?.max_fullscreen_exits ?? 3,
                });
            } catch (err) {
                console.error('Failed to load proctoring policy:', err);
            }
        };
        loadPolicy();
        return () => { mounted = false; };
    }, []);

    const stopDeviceTest = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (testStreamRef.current) {
            testStreamRef.current.getTracks().forEach(track => track.stop());
            testStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        audioDataRef.current = null;
        setMicLevel(0);
        if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = null;
        }
    }, []);

    useEffect(() => {
        return () => stopDeviceTest();
    }, [stopDeviceTest]);

    const handleDeviceTest = useCallback(async () => {
        stopDeviceTest();
        setDeviceChecking(true);
        setDeviceError('');
        setCameraStatus('Checking...');
        setMicStatus('Checking...');

        if (!navigator?.mediaDevices?.getUserMedia) {
            setCameraStatus('Not supported');
            setMicStatus('Not supported');
            setDeviceError('This browser does not support camera/microphone testing.');
            setDeviceChecking(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            testStreamRef.current = stream;

            if (previewVideoRef.current) {
                previewVideoRef.current.srcObject = stream;
                await previewVideoRef.current.play().catch(() => { });
            }

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            audioDataRef.current = new Uint8Array(analyser.fftSize);

            const updateMicMeter = () => {
                if (!analyserRef.current || !audioDataRef.current) return;
                analyserRef.current.getByteTimeDomainData(audioDataRef.current);
                let sumSquares = 0;
                for (let i = 0; i < audioDataRef.current.length; i += 1) {
                    const normalized = (audioDataRef.current[i] - 128) / 128;
                    sumSquares += normalized * normalized;
                }
                const rms = Math.sqrt(sumSquares / audioDataRef.current.length);
                setMicLevel(Math.min(100, Math.round(rms * 280)));
                rafRef.current = requestAnimationFrame(updateMicMeter);
            };
            rafRef.current = requestAnimationFrame(updateMicMeter);

            setCameraStatus('Working');
            setMicStatus('Working');
        } catch (err) {
            const errorName = String(err?.name || '').toLowerCase();
            if (errorName.includes('notallowed') || errorName.includes('permission')) {
                setCameraStatus('Permission denied');
                setMicStatus('Permission denied');
                setDeviceError('Camera/microphone permission was denied. Please allow access and retry.');
            } else if (errorName.includes('notfound') || errorName.includes('devicesnotfound')) {
                setCameraStatus('No device found');
                setMicStatus('No device found');
                setDeviceError('No camera or microphone device was detected.');
            } else {
                setCameraStatus('Error');
                setMicStatus('Error');
                setDeviceError('Unable to test camera/microphone. Please retry.');
            }
        } finally {
            setDeviceChecking(false);
        }
    }, [stopDeviceTest]);

    const handleStart = async () => {
        setLoading(true); setError('');
        try {
            const data = await createSession({ selected_tests: selectedTests.map(t => t.name) });
            navigate('/assessment/test', { state: { session: data } });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to start session.');
            console.error(err);
        }
        finally { setLoading(false); }
    };

    const rules = [
        'The assessment contains 50 MCQ questions and video-based questions.',
        'Questions are distributed evenly across your selected domains.',
        'Each MCQ has 4 options with one correct answer.',
        'You cannot go back to a previous question.',
        'The test must be completed in fullscreen mode.',
        'Proctoring is active. You must keep your camera ON during the MCQ section.',
        `${policy.max_webcam_warnings} webcam violations (multiple faces, face mismatch, no face) or ${policy.max_tab_warnings} tab switches will lead to disqualification.`,
        'Fullscreen mode is required during the assessment.',
        'Video questions require camera and microphone access.',
        'Maximum 2 attempts allowed. Failing twice leads to disqualification.',
        'Your responses are recorded and cannot be changed after submission.',
    ];

    const domainLabel = selectedTests.map(t => t.name).join(', ');

    const btnStyle = (primary, disabled) => ({
        flex: 1, padding: '14px 0', borderRadius: 8, fontWeight: primary ? 600 : 500, fontSize: 14,
        border: primary ? 'none' : '1px solid #d1d5db', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#e5e7eb' : primary ? '#059669' : '#fff',
        color: disabled ? '#9ca3af' : primary ? '#fff' : '#374151',
    });

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
                <div style={{ marginBottom: 24 }}>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>
                        {domainLabel}
                    </span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Instructions</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Please read carefully before starting.</p>
                </div>

                {/* Selected domains summary */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', margin: '0 0 6px' }}>Selected Domains ({selectedTests.length})</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selectedTests.map(t => (
                            <span key={t.id} style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 6, fontWeight: 500 }}>{t.name}</span>
                        ))}
                    </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
                    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {rules.map((rule, i) => (
                            <li key={i} style={{ display: 'flex', gap: 12, fontSize: 14, color: '#374151' }}>
                                <span style={{
                                    width: 24, height: 24, borderRadius: '50%', background: '#f3f4f6',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    fontSize: 12, fontWeight: 700, color: '#6b7280'
                                }}>{i + 1}</span>
                                <span style={{ paddingTop: 2 }}>{rule}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Device Check (Recommended)</p>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Test your camera and microphone before starting.</p>
                        </div>
                        <button
                            onClick={handleDeviceTest}
                            disabled={deviceChecking}
                            style={{ ...btnStyle(true, deviceChecking), flex: 'none', padding: '10px 14px' }}
                        >
                            {deviceChecking ? 'Checking...' : 'Test Camera & Mic'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: '#f3f4f6', padding: '5px 10px', borderRadius: 999 }}>
                            Camera: {cameraStatus}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: '#f3f4f6', padding: '5px 10px', borderRadius: 999 }}>
                            Microphone: {micStatus}
                        </span>
                    </div>

                    <div style={{ background: '#111827', borderRadius: 10, overflow: 'hidden', marginBottom: 10, aspectRatio: '16/9' }}>
                        <video ref={previewVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    <div style={{ marginBottom: 4, fontSize: 12, color: '#6b7280' }}>Mic input level</div>
                    <div style={{ height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${micLevel}%`, background: micLevel > 10 ? '#059669' : '#9ca3af', transition: 'width 120ms linear' }} />
                    </div>
                    {deviceError && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#dc2626' }}>{deviceError}</p>}
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 16, marginTop: 2 }}>⚠️</span>
                        <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#92400e', margin: 0 }}>Important</p>
                            <p style={{ fontSize: 13, color: '#a16207', margin: '4px 0 0' }}>Once you start, you cannot pause or restart. Ensure stable internet and camera access.</p>
                        </div>
                    </div>
                </div>

                {error && <div style={{ marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#dc2626' }}>{error}</div>}

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => navigate('/assessment/select')} style={btnStyle(false, false)}>← Back</button>
                    <button onClick={handleStart} disabled={loading} style={btnStyle(true, loading)}>
                        {loading ? 'Starting...' : 'Start Assessment →'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Instructions;
