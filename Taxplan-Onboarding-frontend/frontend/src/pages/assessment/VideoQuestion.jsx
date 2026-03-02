import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

const TOTAL_TIME = 90; // 1 min 30 sec

export default function VideoQuestion({ question, onVideoUploaded, sessionId, questionIndex, totalVideoQuestions }) {
    const webcamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const autoSubmitRef = useRef(false);

    const [recording, setRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploaded, setUploaded] = useState(false);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
    const [hasStartedRecording, setHasStartedRecording] = useState(false);

    // Single countdown timer — starts immediately when question appears
    useEffect(() => {
        setTimeLeft(TOTAL_TIME);
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Handle time running out
    useEffect(() => {
        if (timeLeft > 0) return;

        if (hasStartedRecording && recording) {
            // Case 2: User started recording but didn't submit — auto-stop & auto-submit
            autoSubmitRef.current = true;
            stopRecording();
        } else if (!hasStartedRecording) {
            // Case 1: User never started recording — skip to next
            onVideoUploaded && onVideoUploaded();
        }
        // If recordedBlob exists but not recording (already stopped), auto-submit is handled below
    }, [timeLeft]);

    // Auto-submit after auto-stop produces a blob
    useEffect(() => {
        if (autoSubmitRef.current && recordedBlob && !uploading && !uploaded) {
            autoSubmitRef.current = false;
            handleUpload(recordedBlob);
        }
    }, [recordedBlob]);

    // Cleanup preview URLs
    useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);

    const startRecording = useCallback(() => {
        chunksRef.current = [];
        setRecordedBlob(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setError('');

        const stream = webcamRef.current?.video?.srcObject;
        if (!stream) { setError('Cannot access camera. Please allow camera permissions.'); return; }

        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setRecordedBlob(blob);
            setPreview(URL.createObjectURL(blob));
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setRecording(true);
        setHasStartedRecording(true);
    }, [preview]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setRecording(false);
    }, []);

    const handleUpload = async (blob) => {
        const uploadBlob = blob || recordedBlob;
        if (!uploadBlob) return;

        setUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('video', uploadBlob, `video_${question.id}.webm`);
            formData.append('question_id', question.id);

            const apiModule = await import('../../services/api');
            await apiModule.submitVideo(sessionId, formData);

            setUploaded(true);
            setTimeout(() => onVideoUploaded && onVideoUploaded(), 800);
        } catch (err) {
            setError('Upload failed. Please try again.');
            console.error('Video upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const pct = ((TOTAL_TIME - timeLeft) / TOTAL_TIME) * 100;
    const isLow = timeLeft < 15;

    return (
        <div>
            {/* Header with numbering */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '5px 14px', borderRadius: 20 }}>
                        🎥 Video {questionIndex + 1} / {totalVideoQuestions}
                    </span>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: isLow ? '#fef2f2' : '#f9fafb', padding: '6px 14px', borderRadius: 20,
                    border: `1px solid ${isLow ? '#fecaca' : '#e5e7eb'}`,
                }}>
                    <span style={{ fontSize: 13 }}>⏱</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: isLow ? '#dc2626' : '#111827' }}>
                        {formatTime(timeLeft)}
                    </span>
                </div>
            </div>

            {/* Question text */}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', lineHeight: 1.5, margin: '0 0 16px' }}>
                {question.question || question.text}
            </h2>

            {/* Camera / Preview */}
            <div style={{ background: '#111827', borderRadius: 12, overflow: 'hidden', position: 'relative', aspectRatio: '16/9', marginBottom: 8 }}>
                {uploaded ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4' }}>
                        <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                        <p style={{ fontWeight: 600, color: '#059669', fontSize: 16 }}>Video Submitted</p>
                    </div>
                ) : preview ? (
                    <video src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                ) : (
                    <>
                        <Webcam audio={true} muted={true} ref={webcamRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} mirrored={true} />
                        {recording && (
                            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12, padding: '4px 10px', borderRadius: 20 }}>
                                    <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
                                    REC
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: 2, transition: 'width 1s linear',
                    background: isLow ? '#dc2626' : '#059669',
                    width: `${pct}%`,
                }}></div>
            </div>

            {/* Error */}
            {error && <div style={{ marginBottom: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#dc2626' }}>{error}</div>}

            {/* Controls */}
            {!uploaded && (
                <div style={{ display: 'flex', gap: 12 }}>
                    {!recording && !recordedBlob && timeLeft > 0 && (
                        <button onClick={startRecording} style={{
                            flex: 1, padding: '14px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                            background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                            🎙 Start Recording
                        </button>
                    )}

                    {recording && (
                        <button onClick={stopRecording} style={{
                            flex: 1, padding: '14px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                            background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                            ⏹ Stop Recording
                        </button>
                    )}

                    {recordedBlob && !recording && (
                        <>
                            {timeLeft > 0 && (
                                <button onClick={() => { setRecordedBlob(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); }} style={{
                                    flex: 1, padding: '14px 0', borderRadius: 10, fontWeight: 500, fontSize: 14,
                                    background: '#fff', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer',
                                }}>
                                    🔄 Re-record
                                </button>
                            )}
                            <button onClick={() => handleUpload()} disabled={uploading} style={{
                                flex: 1, padding: '14px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                                background: uploading ? '#e5e7eb' : '#059669', color: uploading ? '#9ca3af' : '#fff',
                                border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                            }}>
                                {uploading ? '⏳ Uploading...' : '📤 Submit Video'}
                            </button>
                        </>
                    )}

                    {!recording && !recordedBlob && timeLeft === 0 && (
                        <div style={{ textAlign: 'center', width: '100%', padding: 16, color: '#6b7280', fontSize: 14 }}>
                            Time expired — moving to next question...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}