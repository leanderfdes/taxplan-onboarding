import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import TestQuestion from './TestQuestion';
import VideoQuestion from './VideoQuestion';
import { submitTest, submitVideo, logViolation, processProctoringSnapshot, getProctoringPolicy } from '../../services/api';

const DEFAULT_PROCTORING_POLICY = {
    MAX_SESSION_VIOLATIONS: 9,
    MAX_TAB_WARNINGS: 3,
    MAX_WEBCAM_WARNINGS: 3,
    FULLSCREEN_REENTRY_GRACE_SECONDS: 10,
};
const ENABLE_DEV_DIAGNOSTICS = import.meta.env.DEV && String(
    import.meta.env.VITE_PROCTORING_DEBUG ?? 'false'
).toLowerCase() === 'true';
const SHOW_PROCTORING_DEBUG = ENABLE_DEV_DIAGNOSTICS;
const SHOW_DETECTOR_FALLBACK_NOTICE = ENABLE_DEV_DIAGNOSTICS;
const MCQ_SNAPSHOT_BASE_MS = 10000;
const VIDEO_SNAPSHOT_BASE_MS = 15000;
const SNAPSHOT_QUEUE_DB_NAME = 'taxplan-proctoring';
const SNAPSHOT_QUEUE_STORE_NAME = 'snapshot-upload-queue';
const VIDEO_QUEUE_STORE_NAME = 'video-upload-queue';
const MAX_QUEUED_SNAPSHOTS = 120;
const MAX_QUEUED_VIDEOS = 25;
const SNAPSHOT_MAX_RETRIES = 8;
const SNAPSHOT_RETRY_BASE_MS = 2000;
const SNAPSHOT_RETRY_MAX_MS = 60000;

const computeSnapshotRetryDelayMs = (retryCount) => {
    const exponent = Math.max(0, Number(retryCount) - 1);
    const delayMs = SNAPSHOT_RETRY_BASE_MS * (2 ** exponent);
    return Math.min(delayMs, SNAPSHOT_RETRY_MAX_MS);
};

const supportsIndexedDb = () => typeof window !== 'undefined' && !!window.indexedDB;

const idbRequest = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const openSnapshotQueueDb = () => new Promise((resolve, reject) => {
    if (!supportsIndexedDb()) {
        reject(new Error('IndexedDB is not supported'));
        return;
    }
    const req = window.indexedDB.open(SNAPSHOT_QUEUE_DB_NAME, 2);
    req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(SNAPSHOT_QUEUE_STORE_NAME)) {
            const store = db.createObjectStore(SNAPSHOT_QUEUE_STORE_NAME, { keyPath: 'snapshot_id' });
            store.createIndex('session_created_at', ['session_id', 'created_at'], { unique: false });
            store.createIndex('created_at', 'created_at', { unique: false });
        }
        if (!db.objectStoreNames.contains(VIDEO_QUEUE_STORE_NAME)) {
            const store = db.createObjectStore(VIDEO_QUEUE_STORE_NAME, { keyPath: 'upload_id' });
            store.createIndex('session_created_at', ['session_id', 'created_at'], { unique: false });
            store.createIndex('created_at', 'created_at', { unique: false });
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

const snapshotQueueGetAll = async () => {
    const db = await openSnapshotQueueDb();
    try {
        const tx = db.transaction(SNAPSHOT_QUEUE_STORE_NAME, 'readonly');
        const store = tx.objectStore(SNAPSHOT_QUEUE_STORE_NAME);
        return await idbRequest(store.getAll());
    } finally {
        db.close();
    }
};

const snapshotQueueUpsert = async (item) => {
    const db = await openSnapshotQueueDb();
    try {
        const tx = db.transaction(SNAPSHOT_QUEUE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(SNAPSHOT_QUEUE_STORE_NAME);
        await idbRequest(store.put(item));
    } finally {
        db.close();
    }
};

const snapshotQueueDelete = async (snapshotId) => {
    const db = await openSnapshotQueueDb();
    try {
        const tx = db.transaction(SNAPSHOT_QUEUE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(SNAPSHOT_QUEUE_STORE_NAME);
        await idbRequest(store.delete(snapshotId));
    } finally {
        db.close();
    }
};

const videoQueueGetAll = async () => {
    const db = await openSnapshotQueueDb();
    try {
        const tx = db.transaction(VIDEO_QUEUE_STORE_NAME, 'readonly');
        const store = tx.objectStore(VIDEO_QUEUE_STORE_NAME);
        return await idbRequest(store.getAll());
    } finally {
        db.close();
    }
};

const videoQueueUpsert = async (item) => {
    const db = await openSnapshotQueueDb();
    try {
        const tx = db.transaction(VIDEO_QUEUE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(VIDEO_QUEUE_STORE_NAME);
        await idbRequest(store.put(item));
    } finally {
        db.close();
    }
};

const videoQueueDelete = async (uploadId) => {
    const db = await openSnapshotQueueDb();
    try {
        const tx = db.transaction(VIDEO_QUEUE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(VIDEO_QUEUE_STORE_NAME);
        await idbRequest(store.delete(uploadId));
    } finally {
        db.close();
    }
};

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
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [violationMessage, setViolationMessage] = useState('');
    const [proctoringPolicy, setProctoringPolicy] = useState(DEFAULT_PROCTORING_POLICY);
    const [serverViolationCount, setServerViolationCount] = useState(0);
    const [serverViolationCounters, setServerViolationCounters] = useState({});
    const [lastViolationType, setLastViolationType] = useState('');
    const [lastViolationTypeCount, setLastViolationTypeCount] = useState(0);
    const [lastServerViolationReason, setLastServerViolationReason] = useState('');
    const [lastServerViolationAt, setLastServerViolationAt] = useState(null);
    const [violationEvents, setViolationEvents] = useState([]);
    const [debugTelemetry, setDebugTelemetry] = useState({
        lastClientTimestamp: null,
        audioDetected: false,
        audioLevel: 0,
        micStatus: 'idle',
        gazeViolation: false,
        poseYaw: null,
        posePitch: null,
        poseRoll: null,
        mouthState: 'unknown',
        labelCount: 0,
        detectorStatus: 'idle',
        fullscreenState: false,
        lastSnapshotStatus: 'idle',
        snapshotCadenceMs: MCQ_SNAPSHOT_BASE_MS,
        lastSnapshotDurationMs: 0,
        lastViolationCount: 0,
        lastReason: null,
        lastError: null,
    });

    const [currentVideoQuestionIndex, setCurrentVideoQuestionIndex] = useState(0);
    const [videoCompleted, setVideoCompleted] = useState(false);
    const [pendingVideoUploads, setPendingVideoUploads] = useState(0);
    const [failedVideoUploads, setFailedVideoUploads] = useState(0);
    const [pendingSnapshotUploads, setPendingSnapshotUploads] = useState(0);
    const [failedSnapshotUploads, setFailedSnapshotUploads] = useState(0);
    const [isOnline, setIsOnline] = useState(() => navigator?.onLine !== false);
    const [webcamStatus, setWebcamStatus] = useState('idle');
    const [permissionRetrying, setPermissionRetrying] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(() => !!document.fullscreenElement);
    const [submissionResult] = useState(null);
    const lastViolationTime = useRef(0);
    const hasStartedAssessmentRef = useRef(false);
    const fullscreenGraceTimerRef = useRef(null);

    // Proctoring Refs
    const webcamRef = useRef(null);
    const snapshotIntervalRef = useRef(null);
    const micStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const audioDataArrayRef = useRef(null);
    const faceDetectorRef = useRef(null);
    const lastSnapshotDurationRef = useRef(0);
    const videoSnapshotGetterRef = useRef(null);
    const isVideoUploadWorkerRunningRef = useRef(false);
    const isSnapshotUploadWorkerRunningRef = useRef(false);
    const violationTypeLabel = useCallback((rawType) => {
        const v = String(rawType || '').toLowerCase();
        const map = {
            tab_switch: 'Tab',
            fullscreen_exit: 'Fullscreen',
            face: 'Face',
            pose: 'Pose',
            voice: 'Voice',
            webcam: 'Webcam',
        };
        return map[v] || (v ? v.replace(/_/g, ' ') : 'Violation');
    }, []);

    const applyBackendViolationMeta = useCallback((res) => {
        if (!res) return;
        const context = res?.context || {};
        setServerViolationCount(prev => res?.violation_count ?? prev);
        if (context?.violation_counters && typeof context.violation_counters === 'object') {
            setServerViolationCounters(context.violation_counters);
        }
        if (context?.violation_type) {
            setLastViolationType(context.violation_type);
        }
        if (context?.violation_type_count != null) {
            setLastViolationTypeCount(Number(context.violation_type_count) || 0);
        }
        if (res?.reason) {
            setLastServerViolationReason(res.reason);
            setLastServerViolationAt(new Date());
            setViolationEvents(prev => {
                const event = {
                    at: new Date().toISOString(),
                    reason: res.reason,
                    type: context?.violation_type || 'unknown',
                    status: res.status || 'warning',
                    total: res?.violation_count ?? 0,
                };
                return [event, ...prev].slice(0, 8);
            });
        }
    }, []);

    // Load session data
    useEffect(() => {
        if (!session) { navigate('/assessment/select'); return; }
        if (session.question_set) setQuestions(session.question_set);
        else if (session.questions) setQuestions(session.questions);
        if (session.video_question_set) setVideoQuestions(session.video_question_set);
        else if (session.video_questions) setVideoQuestions(session.video_questions);
        else if (session.videoQuestions) setVideoQuestions(session.videoQuestions);
        setServerViolationCount(session?.violation_count || 0);
        if (session?.violation_counters && typeof session.violation_counters === 'object') {
            setServerViolationCounters(session.violation_counters);
        }
        setLoading(false);
    }, [session, navigate]);

    useEffect(() => {
        let mounted = true;
        const loadPolicy = async () => {
            try {
                const policyRes = await getProctoringPolicy();
                const thresholds = policyRes?.thresholds || {};
                if (!mounted) return;
                setProctoringPolicy({
                    MAX_SESSION_VIOLATIONS: thresholds.max_session_violations ?? DEFAULT_PROCTORING_POLICY.MAX_SESSION_VIOLATIONS,
                    MAX_TAB_WARNINGS: thresholds.max_tab_warnings ?? DEFAULT_PROCTORING_POLICY.MAX_TAB_WARNINGS,
                    MAX_WEBCAM_WARNINGS: thresholds.max_webcam_warnings ?? DEFAULT_PROCTORING_POLICY.MAX_WEBCAM_WARNINGS,
                    FULLSCREEN_REENTRY_GRACE_SECONDS: thresholds.fullscreen_reentry_grace_seconds ?? DEFAULT_PROCTORING_POLICY.FULLSCREEN_REENTRY_GRACE_SECONDS,
                });
            } catch (err) {
                console.error('Failed to load proctoring policy:', err);
            }
        };
        loadPolicy();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!navigator?.mediaDevices?.getUserMedia) {
            setWebcamStatus('unsupported');
        }
    }, []);

    const stopAudioDetector = useCallback(() => {
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        audioDataArrayRef.current = null;
    }, []);

    const initAudioDetector = useCallback(async () => {
        if (analyserRef.current || !navigator?.mediaDevices?.getUserMedia) {
            if (!navigator?.mediaDevices?.getUserMedia) {
                setDebugTelemetry(prev => ({ ...prev, micStatus: 'unsupported' }));
            }
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.85;
            source.connect(analyser);

            micStreamRef.current = stream;
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            audioDataArrayRef.current = new Uint8Array(analyser.fftSize);
            setDebugTelemetry(prev => ({ ...prev, micStatus: 'ready' }));
        } catch (err) {
            console.error('Mic detector init failed:', err);
            setDebugTelemetry(prev => ({ ...prev, micStatus: 'denied' }));
        }
    }, []);

    const handleRetryMediaPermissions = useCallback(async () => {
        if (!navigator?.mediaDevices?.getUserMedia) {
            setWebcamStatus('unsupported');
            setDebugTelemetry(prev => ({ ...prev, micStatus: 'unsupported' }));
            return;
        }
        setPermissionRetrying(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach((track) => track.stop());
            setWebcamStatus('ready');
            stopAudioDetector();
            await initAudioDetector();
            setDebugTelemetry(prev => ({ ...prev, lastError: null }));
        } catch (err) {
            const errorName = String(err?.name || '').toLowerCase();
            if (errorName.includes('notallowed') || errorName.includes('permission')) {
                setWebcamStatus('denied');
                setDebugTelemetry(prev => ({ ...prev, micStatus: 'denied' }));
            } else if (errorName.includes('notfound') || errorName.includes('devicesnotfound')) {
                setWebcamStatus('unavailable');
                setDebugTelemetry(prev => ({ ...prev, micStatus: 'unavailable' }));
            } else {
                setWebcamStatus('error');
            }
            setDebugTelemetry(prev => ({ ...prev, lastError: err?.message || 'Permission retry failed' }));
        } finally {
            setPermissionRetrying(false);
        }
    }, [initAudioDetector, stopAudioDetector]);

    const getAudioSignal = useCallback(() => {
        if (!analyserRef.current || !audioDataArrayRef.current) {
            return { detected: false, level: 0 };
        }
        analyserRef.current.getByteTimeDomainData(audioDataArrayRef.current);
        let sumSquares = 0;
        for (let i = 0; i < audioDataArrayRef.current.length; i += 1) {
            const normalized = (audioDataArrayRef.current[i] - 128) / 128;
            sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / audioDataArrayRef.current.length);
        const detected = rms > 0.035;
        return { detected, level: Number(rms.toFixed(4)) };
    }, []);

    useEffect(() => {
        if (!submissionResult) {
            initAudioDetector();
        }
        return () => {
            stopAudioDetector();
        };
    }, [submissionResult, initAudioDetector, stopAudioDetector]);

    const getVisualTelemetry = useCallback(async (imageBlob) => {
        const fallback = {
            gazeViolation: false,
            poseYaw: null,
            posePitch: null,
            poseRoll: null,
            mouthState: 'unknown',
            labelDetectionResults: [],
            detectorStatus: 'fallback',
        };

        try {
            if (typeof window === 'undefined' || typeof window.FaceDetector === 'undefined') {
                return { ...fallback, detectorStatus: 'server_fallback' };
            }

            if (!faceDetectorRef.current) {
                faceDetectorRef.current = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true });
            }

            const bitmap = await createImageBitmap(imageBlob);
            try {
                const detections = await faceDetectorRef.current.detect(bitmap);
                if (!detections || detections.length === 0) {
                    return { ...fallback, detectorStatus: 'no_face' };
                }

                const box = detections[0].boundingBox;
                const centerX = box.x + (box.width / 2);
                const centerY = box.y + (box.height / 2);
                const normX = ((centerX / bitmap.width) - 0.5) * 2;
                const normY = ((centerY / bitmap.height) - 0.5) * 2;

                const poseYaw = Number((normX * 35).toFixed(2));
                const posePitch = Number((normY * 25).toFixed(2));
                const poseRoll = 0;
                const gazeViolation = Math.abs(normX) > 0.35 || Math.abs(normY) > 0.35;

                return {
                    gazeViolation,
                    poseYaw,
                    posePitch,
                    poseRoll,
                    mouthState: 'unknown',
                    labelDetectionResults: [],
                    detectorStatus: 'ready',
                };
            } finally {
                bitmap.close();
            }
        } catch (err) {
            console.error('Visual telemetry detector failed:', err);
            return { ...fallback, detectorStatus: 'error' };
        }
    }, []);

    const getAdaptiveSnapshotCadenceMs = useCallback(() => {
        let cadenceMs = isVideoSection ? VIDEO_SNAPSHOT_BASE_MS : MCQ_SNAPSHOT_BASE_MS;

        const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
        const effectiveType = connection?.effectiveType;
        const saveData = connection?.saveData;
        if (saveData) {
            cadenceMs = 20000;
        } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
            cadenceMs = 25000;
        } else if (effectiveType === '3g') {
            cadenceMs = 15000;
        }

        // If previous snapshot round-trip was slow, back off to reduce overload.
        if (lastSnapshotDurationRef.current > 4000) cadenceMs = Math.max(cadenceMs, 15000);
        if (lastSnapshotDurationRef.current > 7000) cadenceMs = Math.max(cadenceMs, 20000);

        return cadenceMs;
    }, [isVideoSection]);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const refreshVideoQueueStats = useCallback(async () => {
        if (!supportsIndexedDb() || !session?.id) {
            setPendingVideoUploads(0);
            return;
        }
        try {
            const allItems = await videoQueueGetAll();
            const pending = allItems.filter((item) => item?.session_id === session.id).length;
            setPendingVideoUploads(pending + (isVideoUploadWorkerRunningRef.current ? 1 : 0));
        } catch {
            setPendingVideoUploads(0);
        }
    }, [session?.id]);

    const trimVideoQueue = useCallback(async () => {
        if (!supportsIndexedDb()) return;
        const allItems = await videoQueueGetAll();
        if (allItems.length <= MAX_QUEUED_VIDEOS) return;
        const extras = allItems
            .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
            .slice(0, allItems.length - MAX_QUEUED_VIDEOS);
        for (const item of extras) {
            if (item?.upload_id) {
                await videoQueueDelete(item.upload_id);
            }
        }
    }, []);

    const drainVideoUploadQueue = useCallback(async () => {
        if (!supportsIndexedDb() || !session?.id || isVideoUploadWorkerRunningRef.current) return;
        isVideoUploadWorkerRunningRef.current = true;
        await refreshVideoQueueStats();

        try {
            while (true) {
                const allItems = await videoQueueGetAll();
                const item = allItems
                    .filter((row) => row?.session_id === session.id)
                    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))[0];
                if (!item) break;

                try {
                    const formData = new FormData();
                    formData.append('video', item.blob, item.fileName || `video_${item.questionId}.webm`);
                    formData.append('question_id', item.questionId);
                    await submitVideo(session.id, formData);
                    await videoQueueDelete(item.upload_id);
                } catch {
                    const nextRetries = (Number(item.retries) || 0) + 1;
                    if (nextRetries <= 5) {
                        await videoQueueUpsert({ ...item, retries: nextRetries });
                        await sleep(Math.min(2000 * nextRetries, 6000));
                    } else {
                        await videoQueueDelete(item.upload_id);
                        setFailedVideoUploads(prev => prev + 1);
                    }
                    break;
                } finally {
                    await refreshVideoQueueStats();
                }
            }
        } finally {
            isVideoUploadWorkerRunningRef.current = false;
            await refreshVideoQueueStats();
        }
    }, [session?.id, refreshVideoQueueStats]);

    const enqueueVideoUpload = useCallback(async (uploadPayload) => {
        if (!uploadPayload?.blob || !uploadPayload?.questionId) return;
        const uploadId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `video-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        await videoQueueUpsert({
            upload_id: uploadId,
            session_id: session.id,
            created_at: new Date().toISOString(),
            questionId: uploadPayload.questionId,
            blob: uploadPayload.blob,
            fileName: uploadPayload.fileName,
            retries: 0,
        });
        await trimVideoQueue();
        await refreshVideoQueueStats();
        drainVideoUploadQueue();
    }, [drainVideoUploadQueue, refreshVideoQueueStats, session?.id, trimVideoQueue]);

    const waitForVideoUploadsToFinish = useCallback(async (maxWaitMs = 30000) => {
        const deadline = Date.now() + maxWaitMs;
        while (Date.now() < deadline) {
            const allItems = supportsIndexedDb() ? await videoQueueGetAll() : [];
            const pending = allItems.filter((row) => row?.session_id === session?.id).length;
            const hasPending = isVideoUploadWorkerRunningRef.current || pending > 0;
            if (!hasPending) return true;
            await sleep(250);
        }
        return false;
    }, [session?.id]);

    const buildSnapshotId = useCallback(() => {
        try {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
        } catch {
            // ignore and fallback below
        }
        return `snap-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    }, []);

    const isRetryableSnapshotError = useCallback((err) => {
        if (!err?.response) return true;
        const statusCode = Number(err.response.status) || 0;
        return statusCode >= 500 || statusCode === 429;
    }, []);

    const refreshSnapshotQueueStats = useCallback(async () => {
        if (!supportsIndexedDb() || !session?.id) {
            setPendingSnapshotUploads(0);
            return;
        }
        try {
            const allItems = await snapshotQueueGetAll();
            const pending = allItems.filter((item) => item?.session_id === session.id).length;
            setPendingSnapshotUploads(pending + (isSnapshotUploadWorkerRunningRef.current ? 1 : 0));
        } catch {
            setPendingSnapshotUploads(0);
        }
    }, [session?.id]);

    const trimSnapshotQueue = useCallback(async () => {
        if (!supportsIndexedDb()) return;
        const allItems = await snapshotQueueGetAll();
        if (allItems.length <= MAX_QUEUED_SNAPSHOTS) return;
        const extras = allItems
            .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
            .slice(0, allItems.length - MAX_QUEUED_SNAPSHOTS);
        for (const item of extras) {
            if (item?.snapshot_id) {
                await snapshotQueueDelete(item.snapshot_id);
            }
        }
    }, []);

    const enqueueSnapshotUpload = useCallback(async (snapshotItem, overrides = {}) => {
        if (!supportsIndexedDb()) return;
        const nowIso = new Date().toISOString();
        const queuedItem = {
            ...snapshotItem,
            ...overrides,
            retries: Number(overrides.retries ?? snapshotItem.retries ?? 0),
            queued_at: snapshotItem.queued_at || nowIso,
            next_attempt_at: overrides.next_attempt_at ?? snapshotItem.next_attempt_at ?? nowIso,
            last_error: overrides.last_error ?? snapshotItem.last_error ?? null,
        };
        await snapshotQueueUpsert(queuedItem);
        await trimSnapshotQueue();
        await refreshSnapshotQueueStats();
    }, [refreshSnapshotQueueStats, trimSnapshotQueue]);

    const sendSnapshotToBackend = useCallback(async (snapshotItem, startedAt) => {
        const formData = new FormData();
        formData.append('image', snapshotItem.image_blob, 'snapshot.jpg');
        formData.append('audio_detected', String(snapshotItem.audio_detected));
        formData.append('gaze_violation', String(snapshotItem.gaze_violation));
        formData.append('pose_yaw', snapshotItem.pose_yaw == null ? '' : String(snapshotItem.pose_yaw));
        formData.append('pose_pitch', snapshotItem.pose_pitch == null ? '' : String(snapshotItem.pose_pitch));
        formData.append('pose_roll', snapshotItem.pose_roll == null ? '' : String(snapshotItem.pose_roll));
        formData.append('mouth_state', snapshotItem.mouth_state || 'unknown');
        formData.append('label_detection_results', JSON.stringify(snapshotItem.label_detection_results || []));
        formData.append('fullscreen_state', String(snapshotItem.fullscreen_state));
        formData.append('client_timestamp', snapshotItem.client_timestamp);
        formData.append('snapshot_id', snapshotItem.snapshot_id);
        formData.append('detector_status', snapshotItem.detector_status || 'unknown');
        formData.append('webcam_status', snapshotItem.webcam_status || 'unknown');
        formData.append('mic_status', snapshotItem.mic_status || 'unknown');

        const res = await processProctoringSnapshot(session.id, formData);
        applyBackendViolationMeta(res);
        const responseContext = res?.context || {};
        setDebugTelemetry(prev => ({
            ...prev,
            lastSnapshotStatus: res?.status || 'unknown',
            lastSnapshotDurationMs: Date.now() - startedAt,
            lastViolationCount: res?.violation_count ?? prev.lastViolationCount,
            lastReason: res?.reason || null,
            gazeViolation: responseContext.gaze_violation ?? prev.gazeViolation,
            poseYaw: responseContext.pose_yaw ?? prev.poseYaw,
            posePitch: responseContext.pose_pitch ?? prev.posePitch,
            poseRoll: responseContext.pose_roll ?? prev.poseRoll,
            mouthState: responseContext.mouth_state ?? prev.mouthState,
            labelCount: Array.isArray(responseContext.label_detection_results)
                ? responseContext.label_detection_results.length
                : prev.labelCount,
            detectorStatus: responseContext.detector_mode || (
                responseContext.server_fallback_applied ? 'server_fallback' : prev.detectorStatus
            ),
            lastError: null,
        }));
        lastSnapshotDurationRef.current = Date.now() - startedAt;

        if (res.status === 'terminated') {
            handleTermination();
        } else if (res.status === 'warning') {
            setViolationMessage(res.reason || 'Violation detected.');
            setShowWarningModal(true);
        }
        return res;
    }, [session?.id, applyBackendViolationMeta]);

    const drainSnapshotUploadQueue = useCallback(async () => {
        if (!supportsIndexedDb() || !session?.id || isSnapshotUploadWorkerRunningRef.current || navigator?.onLine === false) return;
        isSnapshotUploadWorkerRunningRef.current = true;
        await refreshSnapshotQueueStats();

        try {
            while (true) {
                const allItems = await snapshotQueueGetAll();
                const nowMs = Date.now();
                const nextItem = allItems
                    .filter((item) => item?.session_id === session.id)
                    .filter((item) => {
                        if (!item?.next_attempt_at) return true;
                        const dueAtMs = Date.parse(item.next_attempt_at);
                        return Number.isNaN(dueAtMs) || dueAtMs <= nowMs;
                    })
                    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))[0];

                if (!nextItem) break;
                try {
                    await sendSnapshotToBackend(nextItem, Date.now());
                    await snapshotQueueDelete(nextItem.snapshot_id);
                } catch (err) {
                    if (isRetryableSnapshotError(err)) {
                        const nextRetries = (Number(nextItem.retries) || 0) + 1;
                        const errMsg = err?.response?.data?.error || err?.message || 'Snapshot retry failed';
                        if (nextRetries > SNAPSHOT_MAX_RETRIES) {
                            await snapshotQueueDelete(nextItem.snapshot_id);
                            setFailedSnapshotUploads(prev => prev + 1);
                        } else {
                            const delayMs = computeSnapshotRetryDelayMs(nextRetries);
                            await enqueueSnapshotUpload(nextItem, {
                                retries: nextRetries,
                                next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
                                last_error: errMsg,
                            });
                        }
                        break;
                    }
                    await snapshotQueueDelete(nextItem.snapshot_id);
                    setFailedSnapshotUploads(prev => prev + 1);
                }
                await refreshSnapshotQueueStats();
            }
        } finally {
            isSnapshotUploadWorkerRunningRef.current = false;
            await refreshSnapshotQueueStats();
        }
    }, [enqueueSnapshotUpload, isRetryableSnapshotError, refreshSnapshotQueueStats, sendSnapshotToBackend, session?.id]);

    const waitForSnapshotUploadsToFinish = useCallback(async (maxWaitMs = 12000) => {
        const deadline = Date.now() + maxWaitMs;
        while (Date.now() < deadline) {
            const allItems = supportsIndexedDb() ? await snapshotQueueGetAll() : [];
            const pending = allItems.filter((item) => item?.session_id === session?.id).length;
            if (!isSnapshotUploadWorkerRunningRef.current && pending === 0) return true;
            await sleep(250);
        }
        return false;
    }, [session?.id]);

    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true);
            drainVideoUploadQueue();
            drainSnapshotUploadQueue();
        };
        const onOffline = () => {
            setIsOnline(false);
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        const retryTick = setInterval(() => {
            if (navigator?.onLine === false) return;
            drainVideoUploadQueue();
            drainSnapshotUploadQueue();
        }, 8000);
        refreshSnapshotQueueStats();
        refreshVideoQueueStats();
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            clearInterval(retryTick);
        };
    }, [drainVideoUploadQueue, drainSnapshotUploadQueue, refreshSnapshotQueueStats, refreshVideoQueueStats]);

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
        // Adaptive scheduler instead of fixed interval.
        let timerId = null;
        const clearTimer = () => {
            if (timerId) clearTimeout(timerId);
            timerId = null;
        };

        const scheduleNext = () => {
            clearTimer();
            if (loading || submissionResult || !session?.id) return;
            const cadenceMs = getAdaptiveSnapshotCadenceMs();
            setDebugTelemetry(prev => ({ ...prev, snapshotCadenceMs: cadenceMs }));
            timerId = setTimeout(async () => {
                await captureAndAnalyzeSnapshot();
                scheduleNext();
            }, cadenceMs);
        };

        scheduleNext();
        return () => clearTimer();
    }, [isVideoSection, loading, submissionResult, session?.id, getAdaptiveSnapshotCadenceMs]);

    const captureAndAnalyzeSnapshot = async () => {
        const imageSrcFromMcq = webcamRef.current?.getScreenshot?.() || null;
        const imageSrcFromVideo = typeof videoSnapshotGetterRef.current === 'function'
            ? videoSnapshotGetterRef.current()
            : null;
        const imageSrc = imageSrcFromMcq || imageSrcFromVideo;
        if (!imageSrc) return;
        const startedAt = Date.now();

        // Convert base64 to blob
        const blob = await (await fetch(imageSrc)).blob();

         // Backward-compatible snapshot metadata contract (Task 2)
        const audioSignal = getAudioSignal();
        const visualSignal = await getVisualTelemetry(blob);
        const audioDetected = audioSignal.detected;
        const gazeViolation = visualSignal.gazeViolation;
        const fullscreenState = !!document.fullscreenElement;
        const clientTimestamp = new Date().toISOString();
        const snapshotId = buildSnapshotId();

        const snapshotItem = {
            snapshot_id: snapshotId,
            session_id: session.id,
            created_at: clientTimestamp,
            queued_at: clientTimestamp,
            next_attempt_at: clientTimestamp,
            image_blob: blob,
            audio_detected: audioDetected,
            gaze_violation: gazeViolation,
            pose_yaw: visualSignal.poseYaw,
            pose_pitch: visualSignal.posePitch,
            pose_roll: visualSignal.poseRoll,
            mouth_state: visualSignal.mouthState || 'unknown',
            label_detection_results: visualSignal.labelDetectionResults || [],
            fullscreen_state: fullscreenState,
            client_timestamp: clientTimestamp,
            detector_status: visualSignal.detectorStatus,
            webcam_status: webcamStatus,
            mic_status: debugTelemetry.micStatus,
            retries: 0,
            last_error: null,
        };

        setDebugTelemetry(prev => ({
            ...prev,
            lastClientTimestamp: clientTimestamp,
            audioDetected,
            audioLevel: audioSignal.level,
            detectorStatus: visualSignal.detectorStatus,
            gazeViolation,
            poseYaw: visualSignal.poseYaw,
            posePitch: visualSignal.posePitch,
            poseRoll: visualSignal.poseRoll,
            mouthState: visualSignal.mouthState || 'unknown',
            labelCount: (visualSignal.labelDetectionResults || []).length,
            fullscreenState,
            lastSnapshotStatus: 'sending',
            lastReason: null,
            lastError: null,
        }));

        if (navigator?.onLine === false) {
            await enqueueSnapshotUpload(snapshotItem, {
                next_attempt_at: new Date().toISOString(),
                last_error: 'Queued while offline',
            });
            setDebugTelemetry(prev => ({
                ...prev,
                lastSnapshotStatus: 'queued_offline',
                lastSnapshotDurationMs: Date.now() - startedAt,
                lastError: 'Offline: snapshot queued for background upload.',
            }));
            return;
        }

        try {
            await sendSnapshotToBackend(snapshotItem, startedAt);
        } catch (err) {
            const retryable = isRetryableSnapshotError(err);
            if (retryable) {
                await enqueueSnapshotUpload(snapshotItem, {
                    next_attempt_at: new Date().toISOString(),
                    last_error: err?.response?.data?.error || err?.message || 'Network retry queued',
                });
                setDebugTelemetry(prev => ({
                    ...prev,
                    lastSnapshotStatus: 'queued',
                    lastSnapshotDurationMs: Date.now() - startedAt,
                    lastError: 'Network unstable. Snapshot queued for retry.',
                }));
                drainSnapshotUploadQueue();
                lastSnapshotDurationRef.current = Date.now() - startedAt;
                return;
            }
            console.error("Proctoring Error:", err);
            setDebugTelemetry(prev => ({
                ...prev,
                lastSnapshotStatus: 'error',
                lastSnapshotDurationMs: Date.now() - startedAt,
                lastError: err?.response?.data?.error || err?.message || 'Snapshot request failed',
            }));
            lastSnapshotDurationRef.current = Date.now() - startedAt;
        }
    };

    const handleTermination = () => {
        setShowWarningModal(false);
        if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
        if (fullscreenGraceTimerRef.current) clearTimeout(fullscreenGraceTimerRef.current);
        handleSubmitTest();
    };

    // Client-side Proctoring (Tab switch, etc.)
    useEffect(() => {
        const onVisChange = () => { if (document.hidden) triggerViolation('Tab switch detected', 'tab'); };
        const onFsChange = () => {
            const isNowFullScreen = !!document.fullscreenElement;
            setIsFullScreen(isNowFullScreen);

            if (isNowFullScreen) {
                hasStartedAssessmentRef.current = true;
                if (fullscreenGraceTimerRef.current) {
                    clearTimeout(fullscreenGraceTimerRef.current);
                    fullscreenGraceTimerRef.current = null;
                }
                return;
            }

            if (!hasStartedAssessmentRef.current || submissionResult) return;
        };
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
            if (fullscreenGraceTimerRef.current) clearTimeout(fullscreenGraceTimerRef.current);
            if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
        };
    }, [proctoringPolicy.FULLSCREEN_REENTRY_GRACE_SECONDS, submissionResult]);

    const triggerViolation = async (reason = 'Tab switch', type = 'tab') => {
        const now = Date.now();
        if (now - lastViolationTime.current < 2000) return;
        lastViolationTime.current = now;

        // We only log client-side violations here (tab/fullscreen). 
        // Snapshot violations are logged by the server.
        if (session?.id && (type === 'tab' || type === 'fullscreen')) {
            try {
                const violationType = type === 'fullscreen' ? 'fullscreen_exit' : 'tab_switch';
                const res = await logViolation(session.id, { violation_type: violationType });
                applyBackendViolationMeta(res);
                if (res.status === 'terminated') {
                    handleTermination();
                } else if (res.status === 'warning') {
                    setViolationMessage(res.reason || reason);
                    setShowWarningModal(true);
                }
            } catch (error) {
                console.error('Failed to log violation:', error);
            }
        }
    };

    const enterFullScreen = () => {
        document.documentElement.requestFullscreen().catch(console.error);
        hasStartedAssessmentRef.current = true;
        if (fullscreenGraceTimerRef.current) {
            clearTimeout(fullscreenGraceTimerRef.current);
            fullscreenGraceTimerRef.current = null;
        }
        setIsFullScreen(true);
    };

    const handleAnswer = (optionKey) => {
        setAnswers(prev => ({ ...prev, [questions[currentQuestionIndex].id]: optionKey }));
    };

    const handleSubmitTest = async () => {
        try {
            if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current); // Stop snapshots

            // Give background video uploads a chance to finish before final submission.
            drainVideoUploadQueue();
            drainSnapshotUploadQueue();
            await waitForVideoUploadsToFinish(30000);
            await waitForSnapshotUploadsToFinish(12000);

            // Exit fullscreen and wait for it to complete
            if (document.fullscreenElement) {
                try {
                    await document.exitFullscreen();
                } catch { /* ignore */ }
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

    const handleVideoComplete = useCallback((uploadPayload) => {
        if (uploadPayload?.blob && uploadPayload?.questionId) {
            void enqueueVideoUpload(uploadPayload);
        }

        if (currentVideoQuestionIndex < videoQuestions.length - 1) {
            setCurrentVideoQuestionIndex(prev => prev + 1);
        } else {
            setVideoCompleted(true);
            handleSubmitTest();
        }
    }, [currentVideoQuestionIndex, videoQuestions.length, enqueueVideoUpload, handleSubmitTest]);

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

    // Fullscreen prompt
    if (!isFullScreen && !submissionResult) {
        return (
            <div style={s.center}>
                <div style={s.card}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>🖥️</div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Fullscreen Required</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>
                        This assessment must be taken in fullscreen mode.
                    </p>
                    <button onClick={enterFullScreen} style={s.btnPrimary}>🖥️ Enter Fullscreen & Begin</button>
                </div>
            </div>
        );
    }

    const progressPct = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
    const permissionIssues = [];
    if (webcamStatus === 'denied') permissionIssues.push('Camera permission denied');
    else if (webcamStatus === 'unsupported') permissionIssues.push('Camera not supported');
    else if (webcamStatus === 'unavailable') permissionIssues.push('Camera device not found');
    if (debugTelemetry.micStatus === 'denied') permissionIssues.push('Microphone permission denied');
    else if (debugTelemetry.micStatus === 'unsupported') permissionIssues.push('Microphone not supported');
    else if (debugTelemetry.micStatus === 'unavailable') permissionIssues.push('Microphone device not found');
    if (SHOW_DETECTOR_FALLBACK_NOTICE && debugTelemetry.detectorStatus === 'server_fallback') {
        permissionIssues.push('Face detector unsupported: using server fallback');
    }
    if (SHOW_DETECTOR_FALLBACK_NOTICE && debugTelemetry.detectorStatus === 'error') {
        permissionIssues.push('Face detector error: fallback active');
    }
    const topContentOffset = 56 + (lastServerViolationReason ? 32 : 0) + (permissionIssues.length > 0 ? 38 : 0);

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
                            {lastViolationType
                                ? `${violationTypeLabel(lastViolationType)} violations: ${lastViolationTypeCount}`
                                : `Total violations: ${serverViolationCount}`}
                        </div>
                        <button onClick={() => setShowWarningModal(false)} style={s.btnDanger}>I Understand & Resume</button>
                    </div>
                </div>
            )}

            {permissionIssues.length > 0 && !submissionResult && (
                <div style={{
                    position: 'fixed',
                    top: 56,
                    left: 0,
                    right: 0,
                    zIndex: 45,
                    background: '#fff7ed',
                    color: '#9a3412',
                    borderBottom: '1px solid #fed7aa',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {permissionIssues.join(' | ')}
                    </div>
                    <button
                        onClick={handleRetryMediaPermissions}
                        disabled={permissionRetrying}
                        style={{
                            border: '1px solid #fdba74',
                            background: permissionRetrying ? '#ffedd5' : '#fff',
                            color: '#9a3412',
                            borderRadius: 8,
                            padding: '5px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: permissionRetrying ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {permissionRetrying ? 'Retrying...' : 'Retry permissions'}
                    </button>
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
                        onUserMedia={() => {
                            setWebcamStatus('ready');
                            setDebugTelemetry(prev => ({ ...prev, lastError: null }));
                        }}
                        onUserMediaError={(err) => {
                            console.error('Webcam error:', err);
                            const errorName = String(err?.name || '').toLowerCase();
                            if (errorName.includes('notallowed') || errorName.includes('permission')) {
                                setWebcamStatus('denied');
                            } else if (errorName.includes('notfound') || errorName.includes('devicesnotfound')) {
                                setWebcamStatus('unavailable');
                            } else {
                                setWebcamStatus('error');
                            }
                            setDebugTelemetry(prev => ({ ...prev, lastError: err?.message || 'Webcam error' }));
                        }}
                    />
                </div>
            )}
            {SHOW_PROCTORING_DEBUG && !isVideoSection && !submissionResult && (
                <div style={{
                    position: 'fixed',
                    bottom: 20,
                    left: 20,
                    width: 280,
                    background: '#111827',
                    color: '#e5e7eb',
                    borderRadius: 10,
                    border: '1px solid #374151',
                    padding: 12,
                    zIndex: 55,
                    fontSize: 12,
                    lineHeight: 1.45,
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Debug Telemetry</div>
                    <div>audio_detected: {String(debugTelemetry.audioDetected)}</div>
                    <div>audio_level_rms: {debugTelemetry.audioLevel}</div>
                    <div>mic_status: {debugTelemetry.micStatus}</div>
                    <div>webcam_status: {webcamStatus}</div>
                    <div>detector_status: {debugTelemetry.detectorStatus}</div>
                    <div>gaze_violation: {String(debugTelemetry.gazeViolation)}</div>
                    <div>pose_yaw: {debugTelemetry.poseYaw ?? '-'}</div>
                    <div>pose_pitch: {debugTelemetry.posePitch ?? '-'}</div>
                    <div>pose_roll: {debugTelemetry.poseRoll ?? '-'}</div>
                    <div>mouth_state: {debugTelemetry.mouthState}</div>
                    <div>label_count: {debugTelemetry.labelCount}</div>
                    <div>fullscreen_state: {String(debugTelemetry.fullscreenState)}</div>
                    <div>last_status: {debugTelemetry.lastSnapshotStatus}</div>
                    <div>snapshot_cadence_ms: {debugTelemetry.snapshotCadenceMs}</div>
                    <div>last_snapshot_duration_ms: {debugTelemetry.lastSnapshotDurationMs}</div>
                    <div>violation_count: {debugTelemetry.lastViolationCount}</div>
                    <div>reason: {debugTelemetry.lastReason || '-'}</div>
                    <div>last_error: {debugTelemetry.lastError || '-'}</div>
                    <div>network: {isOnline ? 'online' : 'offline'}</div>
                    <div style={{ marginTop: 6 }}>client_timestamp: {debugTelemetry.lastClientTimestamp || '-'}</div>
                    {violationEvents.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #374151' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Recent Events</div>
                            {violationEvents.map((e, idx) => (
                                <div key={`${e.at}-${idx}`} style={{ fontSize: 11, color: '#cbd5e1' }}>
                                    {new Date(e.at).toLocaleTimeString()} | {violationTypeLabel(e.type)} | {e.reason}
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={captureAndAnalyzeSnapshot}
                        style={{
                            marginTop: 10,
                            width: '100%',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: '#059669',
                            color: '#fff',
                        }}
                    >
                        Send Snapshot Now
                    </button>
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

                    {pendingVideoUploads > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                            Uploading videos: {pendingVideoUploads}
                        </span>
                    )}
                    {failedVideoUploads > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                            Upload failed: {failedVideoUploads}
                        </span>
                    )}
                    <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '5px 12px',
                        borderRadius: 20,
                        background: isOnline ? '#ecfdf5' : '#fff7ed',
                        color: isOnline ? '#065f46' : '#9a3412',
                        border: isOnline ? '1px solid #86efac' : '1px solid #fdba74'
                    }}>
                        {isOnline ? 'Online' : 'Offline'}
                    </span>
                    {pendingSnapshotUploads > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: '#ecfeff', color: '#155e75', border: '1px solid #a5f3fc' }}>
                            Snapshot queue: {pendingSnapshotUploads}
                        </span>
                    )}
                    {failedSnapshotUploads > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                            Snapshot failed: {failedSnapshotUploads}
                        </span>
                    )}

                    {serverViolationCount > 0 && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            {serverViolationCount > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74' }}>
                                    ⚠ Violations: {serverViolationCount}
                                </span>
                            )}
                            {Object.entries(serverViolationCounters)
                                .filter(([, count]) => Number(count) > 0)
                                .map(([vType, count]) => (
                                    <span key={`server-${vType}`} style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                                        {violationTypeLabel(vType)}: {count}
                                    </span>
                                ))}
                        </div>
                    )}
                </div>
            </header>

            {lastServerViolationReason && (
                <div style={{
                    position: 'fixed',
                    top: 60,
                    left: 0,
                    right: 0,
                    zIndex: 35,
                    background: '#fff7ed',
                    color: '#9a3412',
                    borderBottom: '1px solid #fed7aa',
                    padding: '8px 24px',
                    fontSize: 13,
                    fontWeight: 600,
                }}>
                    Last violation: {lastServerViolationReason}
                    {lastServerViolationAt ? ` (${lastServerViolationAt.toLocaleTimeString()})` : ''}
                </div>
            )}

            {/* Progress bar */}
            {!isVideoSection && questions.length > 0 && (
                <div style={{ position: 'fixed', top: topContentOffset, left: 0, right: 0, height: 4, background: '#e5e7eb', zIndex: 30 }}>
                    <div style={{ height: '100%', background: '#059669', transition: 'width 0.5s ease', width: `${progressPct}%` }}></div>
                </div>
            )}

            {/* Main content */}
            <main style={{ flex: 1, marginTop: topContentOffset, padding: '40px 24px', maxWidth: 800, margin: `${topContentOffset}px auto 0`, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: `calc(100vh - ${topContentOffset}px)` }}>

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
                            registerSnapshotGetter={(getter) => { videoSnapshotGetterRef.current = getter; }}
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
