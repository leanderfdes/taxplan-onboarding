# Taxplan Onboarding Portal — Engineering Onboarding Guide

This guide is for new engineers joining the project. It follows the same recommended learning path:

1. End-to-end user flow
2. Assessment internals
3. Async/ops model
4. Admin + credential issuance
5. Local setup/run order

If you want to **learn in order**, complete the sections below sequentially and use the hands-on checklist in section 6.

---

## 1) End-to-end user flow (frontend → backend lifecycle)

### Frontend control points

The SPA flow is orchestrated by these files:

- `frontend/src/App.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/services/api.js`

#### Routing and guards (`App.jsx`)

`App.jsx` defines:

- `ProtectedRoute`: blocks unauthenticated access, forces declaration acceptance.
- `PublicRoute`: redirects logged-in users out of login page to the right step.
- `StepGuard`: enforces onboarding stage ordering.

Primary consultant path:

1. `/` login
2. `/declaration`
3. `/onboarding` (profile)
4. `/onboarding/identity`
5. `/onboarding/face-verification`
6. `/assessment/*`
7. `/onboarding/documentation`
8. `/onboarding/complete`

Admin path is standalone under `/admin*` routes.

#### Auth/session state (`AuthContext.jsx`)

`checkAuth()` calls `GET /api/auth/profile/` and stores:

- `user`
- `stepFlags`:
  - `has_identity_doc`
  - `has_passed_assessment`
  - `has_documents`
  - `has_accepted_declaration`

The route guards depend on these flags, so backend profile response shape is critical.

#### API wrappers (`api.js`)

The frontend centralizes API access in one Axios client:

- Base URL: `http://localhost:8000/api`
- `withCredentials: true` to send JWT cookie.

Main lifecycle endpoints:

- Auth: `/auth/google/`, `/auth/profile/`, `/auth/onboarding/`, `/auth/accept-declaration/`, `/auth/logout/`
- Identity/face: `/auth/identity/upload-doc/`, `/face-verification/users/:id/*`
- Assessment: `/assessment/test-types/`, `/assessment/sessions/*`
- Documents: `/documents/upload/`

### Backend auth lifecycle (`authentication/views.py`)

- `google_auth`: verifies Google token, creates/updates user, sets JWT cookie.
- `complete_onboarding`: updates profile and onboarding details.
- `get_user_profile`: returns user + step flags that drive frontend guards.
- `accept_declaration`: toggles declaration acceptance.
- `logout`: deletes JWT cookie.
- Document upload endpoints exist under auth too (`documents/*`, `identity/upload-doc/`).

Authentication model:

- DRF default auth class is custom JWT auth (`authentication.authentication.JWTAuthentication`).
- Token is read from cookie first (`jwt_token`) and bearer header second.

---

## 2) Assessment deep dive (most complex module)

Core files:

- `backend/assessment/models.py`
- `backend/assessment/views.py`
- domain question banks: `gst.py`, `income_tax.py`, `tds.py`, `professional_tax.py`, `video_questions.py`
- frontend engine: `frontend/src/pages/assessment/TestEngine.jsx`

### Data model

`UserSession` stores:

- selected domains
- generated MCQ question set (`question_set` JSON)
- generated video question set (`video_question_set` JSON)
- score, status (`ongoing|completed|flagged`), violation_count

Supporting models:

- `Violation`
- `VideoResponse` (`ai_status` progression)
- `ProctoringSnapshot`

### Session creation (`UserSessionViewSet.create`)

Flow:

1. Validate selected test domains.
2. Enforce disqualification rules:
   - any flagged session => permanent block
   - 2 failed completed attempts (<30) => block
3. Build 50 MCQ set across selected domains.
4. Namespace question IDs to avoid collisions.
5. Build video set:
   - intro prompt
   - up to 4 random domain prompts.
6. Persist `UserSession` with status `ongoing`.
7. Return sanitized questions (answers removed).

### Submission + proctoring

- `submit_test`: calculates MCQ score; session becomes `completed` unless already `flagged`.
- `log_violation`: increments `violation_count`; at 3 violations, session is flagged/terminated.
- `latest_result`: exposes disqualified status, latest score, video aggregate, and `video_evaluation_complete`.
- `submit_video`: stores upload, creates `VideoResponse` with `ai_status='pending'`, then enqueues async evaluation task.

### Frontend proctoring behavior (`TestEngine.jsx`)

The UI enforces:

- Fullscreen requirement.
- Event-based anti-cheat checks (tab switch, devtools shortcuts, copy/paste/context menu block).
- Snapshot loop every 30s during MCQ phase (`processProctoringSnapshot`).
- Warning/termination UX tied to violation counts.

---

## 3) Async / ops model (Celery + Redis + AI services)

Core files:

- `backend/taxplan_backend/celery.py`
- `backend/ai_analysis/tasks.py`
- `backend/ai_analysis/services.py`
- `backend/taxplan_backend/settings.py`

### Worker lifecycle

- Celery app is initialized in `taxplan_backend/celery.py` and autodiscovers tasks.
- `submit_video` triggers `evaluate_video_task.delay(...)`.
- Task status progression:
  - set `VideoResponse.ai_status = processing`
  - on success: persist transcript, score, feedback, set `completed`
  - on failure: set `failed`

### Redis assumptions

Current settings assume local Redis:

- Broker: `redis://localhost:6379/0`
- Result backend: `redis://localhost:6379/1`

If Redis is down/unreachable:

- `.delay()` calls may fail depending on connection state.
- Video uploads can persist, but AI evaluation won’t complete.
- `latest_result.video_evaluation_complete` may remain false.

### External dependency assumptions

AI path depends on:

- S3/default storage readability for uploaded media
- AWS credentials + region
- Gemini API key
- network availability for AWS/Gemini

Failure modes to watch:

- storage path unreadable in worker context
- transcribe job failure
- Gemini upload/generation failure
- malformed JSON from model output

---

## 4) Admin panel + credential issuance

Core files:

- `backend/admin_panel/views.py`
- `backend/admin_panel/urls.py`
- `backend/authentication/utils.py` (credential generation helpers)

### Admin auth model

- `admin_login` issues a JWT with `is_admin` claim.
- `AdminJWTAuthentication` validates admin bearer token.
- Note: credentials are currently hardcoded (`admin` / `admin`) in code and should be hardened.

### Data convergence role

Admin endpoints aggregate across:

- profile
- identity docs
- face verification
- assessment sessions + violations + proctoring snapshots + video AI results
- consultant documents

This is the best place to inspect complete user lifecycle data during support/debugging.

### Credential generation

- Endpoint: `POST /api/admin-panel/consultants/<uuid>/generate-credentials/`
- Uses helper that generates credentials and emails consultant.
- AI task also attempts auto-generation when MCQ + video thresholds are met.

---

## 5) Local setup and run order (recommended)

Top-level README is minimal, so use this section as primary setup guidance.

### Required runtime components

1. Python backend dependencies
2. Node frontend dependencies
3. Redis (broker/result backend)
4. Celery worker
5. (Optional but practically required for full flow) valid cloud/API credentials

### Environment variables to define

At minimum for realistic runs:

- Django / auth
  - `SECRET_KEY`
  - `DEBUG`
  - `GOOGLE_CLIENT_ID`
- AWS / storage / Rekognition / Transcribe
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `AWS_STORAGE_BUCKET_NAME`
- Gemini
  - `GEMINI_API_KEY`
- Email
  - `EMAIL_HOST_USER`
  - `EMAIL_HOST_PASSWORD`

### Run order

From `Taxplan-Onboarding-frontend/`:

1. **Backend install + migrate**
   - `cd backend`
   - `pip install -r requirements.txt`
   - `python manage.py migrate`
   - `python manage.py runserver`

2. **Redis**
   - Ensure Redis is running at `localhost:6379`

3. **Celery worker**
   - `cd backend`
   - `celery -A taxplan_backend worker -l info`

4. **Frontend**
   - `cd frontend`
   - `npm install`
   - `npm run dev`

### Practical onboarding tips for new contributors

- Start by tracing one login request end-to-end (`google_auth` + profile fetch).
- Use browser devtools network tab alongside Django console logs.
- For assessment work, inspect `UserSession` JSON fields after session creation.
- For async bugs, always verify Redis + worker process first.
- Keep route guard behavior and backend flags in sync to avoid navigation loops.

---

## 6) Learn-next checklist (follow this exact order)

Use this as your practical study path. Do not skip steps.

### Step 1 — End-to-end user flow

Read in this exact file order:

1. `frontend/src/App.jsx`
2. `frontend/src/context/AuthContext.jsx`
3. `frontend/src/services/api.js`
4. `backend/authentication/views.py`

What to confirm:

- You can explain how login sets session auth and how `checkAuth()` hydrates frontend state.
- You can explain why missing `has_accepted_declaration` redirects protected routes.
- You can map each frontend onboarding screen to its backend endpoint.

### Step 2 — Assessment internals

Read in this exact file order:

1. `backend/assessment/models.py`
2. `backend/assessment/views.py`
3. `frontend/src/pages/assessment/TestEngine.jsx`

What to confirm:

- You understand how 50 MCQs are selected and sanitized before sending to UI.
- You understand when users become disqualified (flagged sessions, failed attempts).
- You understand proctoring signals (tab switch, snapshots, violation logging) and where each is enforced.

### Step 3 — Async/ops lifecycle

Read in this exact file order:

1. `backend/taxplan_backend/settings.py` (Celery + Redis settings)
2. `backend/taxplan_backend/celery.py`
3. `backend/ai_analysis/tasks.py`
4. `backend/ai_analysis/services.py`

What to confirm:

- You can list persisted `ai_status` transitions: `pending -> processing -> completed|failed`.
- You can describe what breaks when Redis is unavailable.
- You can describe how worker/cloud failures surface to product behavior (`video_evaluation_complete` staying false).

### Step 4 — Admin and credential issuance

Read in this exact file order:

1. `backend/admin_panel/urls.py`
2. `backend/admin_panel/views.py`
3. `backend/authentication/utils.py`

What to confirm:

- You can explain how admin auth token differs from consultant JWT auth.
- You can explain where consultant summary/detail data is aggregated.
- You can explain manual vs auto credential generation trigger points.

### Step 5 — Setup and run locally

Run these in order:

1. Backend dependencies and migrations.
2. Redis.
3. Celery worker.
4. Frontend dev server.

What to confirm:

- You can complete one user journey from login to assessment start.
- You can observe a background video evaluation task in worker logs.
- You can open admin list/detail and inspect aggregated consultant data.

---

## Suggested next improvements for the repo

1. Expand root `README.md` with this runbook summary.
2. Add `.env.example` covering all required variables.
3. Replace hardcoded admin credentials with environment-backed secure auth.
4. Add health endpoints/checklists for Redis/Celery and background task observability.
5. Add tests around disqualification and step-flag lifecycle.
