import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import TestQuestion from './TestQuestion';
import VideoQuestion from './VideoQuestion';
import { submitTest, logViolation, processProctoringSnapshot } from '../../services/api';

const TestEngine = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { session } = location.state || {};
    const [questions, setQuestions] = useState([]);
    const [videoQuestions, setVideoQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);

    const [questionTimeLeft, setQuestionTimeLeft] = useState(30);
    const [isVideoSection, setIsVideoSection] = useState(false);
    const [webcamWarnings, setWebcamWarnings] = useState(0);
    const [tabWarnings, setTabWarnings] = useState(0);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [violationMessage, setViolationMessage] = useState('');

    const [currentVideoQuestionIndex, setCurrentVideoQuestionIndex] = useState(0);
    const [videoCompleted, setVideoCompleted] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(() => !!document.fullscreenElement);
    const [submissionResult, setSubmissionResult] = useState(null);
    const lastViolationTime = useRef(0);

    // Proctoring Refs
    const webcamRef = useRef(null);
    const snapshotIntervalRef = useRef(null);

    // Load session data
    useEffect(() => {
        if (!session) { navigate('/assessment/select'); return; }
        if (session.question_set) setQuestions(session.question_set);
        else if (session.questions) setQuestions(session.questions);
        if (session.video_question_set) setVideoQuestions(session.video_question_set);
        else if (session.video_questions) setVideoQuestions(session.video_questions);
        else if (session.videoQuestions) setVideoQuestions(session.videoQuestions);
        setLoading(false);
    }, [session, navigate]);

    // MCQ next
    const handleNext = useCallback(() => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setQuestionTimeLeft(30);
        } else {
            setIsVideoSection(true);
            setCurrentVideoQuestionIndex(0);
        }
    }, [currentQuestionIndex, questions.length]);

    // MCQ 30s timer
    useEffect(() => {
        if (loading || isVideoSection || questions.length === 0 || submissionResult) return;
        setQuestionTimeLeft(30);
        const t = setInterval(() => {
            setQuestionTimeLeft(prev => {
                if (prev <= 1) return 0;
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [currentQuestionIndex, isVideoSection, questions.length, loading, submissionResult]);

    // MCQ timeout → next
    useEffect(() => {
        if (!isVideoSection && questionTimeLeft === 0 && questions.length > 0 && !loading && !submissionResult) handleNext();
    }, [questionTimeLeft, isVideoSection, questions.length, loading, handleNext, submissionResult]);

    // Snapshot Loop (Strictly for MCQ Section)
    useEffect(() => {
        // Clear existing interval if any
        if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);

        // ONLY run if NOT in video section, NOT loading, and NOT submitted
        if (!isVideoSection && !loading && !submissionResult && session?.id) {
            snapshotIntervalRef.current = setInterval(() => {
                captureAndAnalyzeSnapshot();
            }, 30000); // 30 seconds
        }

        return () => {
            if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
        };
    }, [isVideoSection, loading, submissionResult, session?.id]);

    const captureAndAnalyzeSnapshot = async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        // Convert base64 to blob
        const blob = await (await fetch(imageSrc)).blob();
        const formData = new FormData();
        formData.append('image', blob, 'snapshot.jpg');

        try {
            const res = await processProctoringSnapshot(session.id, formData);

            if (res.status === 'terminated') {
                handleTermination();
            } else if (res.status === 'warning') {
                triggerViolation(res.reason, 'webcam');
            }
        } catch (err) {
            console.error("Proctoring Error:", err);
        }
    };

    const handleTermination = () => {
        setWebcamWarnings(100); // Trigger disqualification
        setShowWarningModal(false);
        if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
        handleSubmitTest();
    };

    // Client-side Proctoring (Tab switch, etc.)
    useEffect(() => {
        const onVisChange = () => { if (document.hidden) triggerViolation('Tab switch detected', 'tab'); };
        const onFsChange = () => setIsFullScreen(!!document.fullscreenElement);
        const prevent = (e) => { e.preventDefault(); return false; };
        const onKey = (e) => {
            if (e.key === 'F12') { e.preventDefault(); return false; }
            if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) { e.preventDefault(); return false; }
            if (e.ctrlKey && e.key === 'U') { e.preventDefault(); return false; }
        };
        document.addEventListener('visibilitychange', onVisChange);
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('contextmenu', prevent);
        document.addEventListener('copy', prevent);
        document.addEventListener('paste', prevent);
        document.addEventListener('cut', prevent);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('visibilitychange', onVisChange);
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('contextmenu', prevent);
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('cut', prevent);
            document.removeEventListener('keydown', onKey);
            if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
        };
    }, []);

    const triggerViolation = async (reason = 'Tab switch', type = 'tab') => {
        const now = Date.now();
        if (now - lastViolationTime.current < 2000) return;
        lastViolationTime.current = now;

        let currentWarnings = 0;
        if (type === 'tab') {
            setTabWarnings(prev => { currentWarnings = prev + 1; return currentWarnings; });
        } else {
            setWebcamWarnings(prev => { currentWarnings = prev + 1; return currentWarnings; });
        }

        setViolationMessage(reason);
        setShowWarningModal(true);

        // We only log client-side violations here (like tab switch). 
        // Snapshot violations are logged by the server.
        if (session?.id && type === 'tab') {
            try {
                const res = await logViolation(session.id, { violation_type: 'tab_switch' });
                if (res.status === 'terminated') {
                    handleTermination();
                }
            } catch (error) {
                console.error('Failed to log violation:', error);
            }
        }
    };

    const enterFullScreen = () => {
        document.documentElement.requestFullscreen().catch(console.error);
        setIsFullScreen(true);
    };

    const handleAnswer = (optionKey) => {
        setAnswers(prev => ({ ...prev, [questions[currentQuestionIndex].id]: optionKey }));
    };

    const handleVideoComplete = () => {
        if (currentVideoQuestionIndex < videoQuestions.length - 1) {
            setCurrentVideoQuestionIndex(prev => prev + 1);
        } else {
            setVideoCompleted(true);
            handleSubmitTest();
        }
    };

    const handleSubmitTest = async () => {
        try {
            if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current); // Stop snapshots

            // Exit fullscreen and wait for it to complete
            if (document.fullscreenElement) {
                try {
                    await document.exitFullscreen();
                } catch (e) { /* ignore */ }
                // Small delay to ensure browser finishes exiting fullscreen
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const res = await submitTest(session.id, { answers });
            navigate('/assessment/result', {
                state: { result: { ...res, passed: res.passed ?? (res.score >= 0) } }
            });
        } catch (err) {
            console.error('Failed to submit test:', err);
            alert('Submission failed. Please try again.');
        }
    };

    // --- Styles ---
    const s = {
        page: { minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif", userSelect: 'none' },
        center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: "'Inter', system-ui, sans-serif", padding: 32 },
        card: { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '48px 40px', maxWidth: 500, width: '100%', textAlign: 'center' },
        header: { position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: '#fff', borderBottom: '1px solid #e5e7eb', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' },
        btnPrimary: { padding: '14px 32px', borderRadius: 10, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', background: '#059669', color: '#fff' },
        btnDanger: { padding: '14px 32px', borderRadius: 10, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff', width: '100%' },
        webcamContainer: { position: 'fixed', bottom: 20, right: 20, width: 140, height: 105, background: '#000', borderRadius: 8, overflow: 'hidden', zIndex: 50, border: '2px solid #fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }
    };

    if (loading || !session) {
        return (
            <div style={s.center}>
                <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }

    // Disqualified
    if (webcamWarnings >= 3 || tabWarnings >= 3) {
        return (
            <div style={s.center}>
                <div style={s.card}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>🚫</div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#dc2626', margin: '0 0 12px' }}>Assessment Terminated</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>
                        You exceeded the maximum proctoring violations. Your assessment has been automatically concluded, and your current progress has been submitted.
                    </p>
                    <button onClick={handleSubmitTest} style={s.btnPrimary}>View Assessment Result</button>
                </div>
            </div>
        );
    }

    // Fullscreen prompt
    if (!isFullScreen && !submissionResult) {
        return (
            <div style={s.center}>
                <div style={s.card}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>🖥️</div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Fullscreen Required</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>
                        This assessment must be taken in fullscreen mode. Exiting fullscreen will count as a violation.
                    </p>
                    <button onClick={enterFullScreen} style={s.btnPrimary}>🖥️ Enter Fullscreen & Begin</button>
                </div>
            </div>
        );
    }

    const progressPct = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

    return (
        <div style={s.page} onContextMenu={e => e.preventDefault()} onCopy={e => e.preventDefault()} onCut={e => e.preventDefault()} onPaste={e => e.preventDefault()}>

            {/* Warning Modal */}
            {showWarningModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                    <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', margin: 16, textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Proctoring Warning</h2>
                        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>{violationMessage || 'Violation detected.'}</p>
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', fontSize: 16, fontWeight: 700, color: '#dc2626', marginBottom: 20 }}>
                            {violationMessage.includes('Tab') ? `Tab Violations Remaining: ${Math.max(0, 3 - tabWarnings)}` : `Webcam Violations Remaining: ${Math.max(0, 3 - webcamWarnings)}`}
                        </div>
                        <button onClick={() => setShowWarningModal(false)} style={s.btnDanger}>I Understand & Resume</button>
                    </div>
                </div>
            )}

            {/* Webcam (always active during MCQ, except when submitted) */}
            {!isVideoSection && !submissionResult && (
                <div style={s.webcamContainer}>
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ width: 1280, height: 720, facingMode: "user" }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onUserMedia={() => console.log('Webcam started')}
                        onUserMediaError={(err) => console.error('Webcam error:', err)}
                    />
                </div>
            )}

            {/* Header */}
            <header style={s.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, background: '#059669', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>T</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 15 }}>Taxplan Advisor</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* MCQ timer only — video timer is inside VideoQuestion */}
                    {!isVideoSection && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13 }}>⏱</span>
                            <span style={{
                                fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
                                color: questionTimeLeft < 10 ? '#dc2626' : '#111827',
                            }}>
                                {String(questionTimeLeft).padStart(2, '0')}s
                            </span>
                        </div>
                    )}

                    <span style={{
                        fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                        background: isVideoSection ? '#f5f3ff' : '#ecfdf5',
                        color: isVideoSection ? '#7c3aed' : '#059669',
                    }}>
                        {isVideoSection ? '🎥 Video' : '📝 MCQ'}
                    </span>

                    {(webcamWarnings > 0 || tabWarnings > 0) && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            {tabWarnings > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                    ⚠ Tab: {tabWarnings}/3
                                </span>
                            )}
                            {webcamWarnings > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                    ⚠ Cam: {webcamWarnings}/3
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Progress bar */}
            {!isVideoSection && questions.length > 0 && (
                <div style={{ position: 'fixed', top: 56, left: 0, right: 0, height: 4, background: '#e5e7eb', zIndex: 30 }}>
                    <div style={{ height: '100%', background: '#059669', transition: 'width 0.5s ease', width: `${progressPct}%` }}></div>
                </div>
            )}

            {/* Main content */}
            <main style={{ flex: 1, marginTop: 56, padding: '40px 24px', maxWidth: 800, margin: '56px auto 0', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 'calc(100vh - 56px)' }}>

                {/* MCQ Section */}
                {!isVideoSection && questions.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '32px 28px' }}>
                        <TestQuestion
                            question={questions[currentQuestionIndex]}
                            questionIndex={currentQuestionIndex}
                            totalQuestions={questions.length}
                            onSelectAnswer={handleAnswer}
                            selectedAnswer={answers[questions[currentQuestionIndex]?.id]}
                        />
                        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={handleNext} style={s.btnPrimary}>
                                {currentQuestionIndex === questions.length - 1 ? 'Proceed to Video →' : 'Next Question →'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Video Section*/}
                {isVideoSection && !videoCompleted && videoQuestions.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '32px 28px' }}>
                        <VideoQuestion
                            key={`video-${currentVideoQuestionIndex}`}
                            question={videoQuestions[currentVideoQuestionIndex]}
                            questionIndex={currentVideoQuestionIndex}
                            totalVideoQuestions={videoQuestions.length}
                            sessionId={session.id}
                            onVideoUploaded={handleVideoComplete}
                        />
                    </div>
                )}

                {/* No video questions → submit */}
                {isVideoSection && videoQuestions.length === 0 && !submissionResult && (
                    <div style={{ ...s.card, margin: '0 auto' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Review & Submit</h2>
                        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>All questions completed. Ready to submit.</p>
                        <button onClick={handleSubmitTest} style={s.btnPrimary}>Submit Assessment</button>
                    </div>
                )}

                {/* No MCQs */}
                {!isVideoSection && questions.length === 0 && (
                    <div style={{ ...s.card, margin: '0 auto' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>No Questions Available</h2>
                        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>No MCQ questions for the selected domains.</p>
                        {videoQuestions.length > 0 && (
                            <button onClick={() => { setIsVideoSection(true); setCurrentVideoQuestionIndex(0); }} style={s.btnPrimary}>
                                Proceed to Video Questions
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default TestEngine;