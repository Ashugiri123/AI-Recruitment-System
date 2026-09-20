# AI Recruitment + AI Interview Project Memory

## 1. Main Project Goal

The primary goal of this project is to transform this cloned repository into a functional, professional, and presentation-ready AI Recruitment + AI Interview web application within an aggressive 2-day delivery window.

We are utilizing this existing repository as our foundation because it already contains substantial implementations for resume analysis, LangGraph-based AI interview orchestration, Groq LLM integration, speech processing agents, and dashboard analytics. Rather than rebuilding from scratch, our objective is to stabilize, connect, and streamline existing functional components into a seamless, reliable end-to-end recruitment flow.

---

## 2. Final Product Flow

The target end-to-end product workflow consists of:

Resume Upload  
→ Resume Analysis  
→ Job / Role Selection  
→ Candidate Screening  
→ Shortlisting  
→ AI Interview  
→ AI Voice Interaction  
→ Adaptive Questions  
→ Answer Evaluation  
→ Final Interview Result  
→ Recruiter Dashboard  

---

## 3. Two-Day MVP Goal

For a rock-solid, working 2-day live demonstration, the core MVP must execute the following without manual intervention or crashes:

1. **Resume Ingestion & Parsing**: Recruiter uploads candidate resume(s) (PDF) and defines or selects a Job Description.
2. **Automated Screening & Ranking**: The system parses the resumes, matches candidate qualifications against job requirements, computes similarity/suitability scores, and displays a ranked candidate list with threshold filtering.
3. **Candidate Shortlisting**: Recruiter shortlists qualified candidates with a single action to initiate their interview.
4. **Browser-Based AI Interview Room**: Candidate enters a dedicated interview room featuring:
   - Live camera video feed (browser webcam)
   - Real-time AI interviewer questions displayed on screen
   - Voice interaction via Text-To-Speech (AI asks questions audibly)
   - Candidate voice capture via microphone with Speech-To-Text transcription
5. **Adaptive Questioning & Real-time Evaluation**:
   - The AI asks targeted technical and behavioral questions generated from the resume and job description.
   - The AI evaluates candidate responses in real-time.
   - If an answer is incomplete or vague, the AI asks an adaptive follow-up question.
6. **Final Result & Scorecard**:
   - Comprehensive post-interview report containing overall score (0-100), sub-scores (technical, communication, problem-solving), key strengths, areas of improvement, and hire/reject recommendation.
7. **Recruiter Dashboard**:
   - Central view displaying screened candidates, completed interviews, scores, transcripts, and evaluation reports.

---

## 4. Features We Can Reuse

The repository contains several rich, working modules that we can directly reuse:

1. **Resume Analysis & Match Engine (`backend/app.py` & `backend/main.py`)**:
   - PDF extraction via `PyPDF2` and spaCy.
   - Keyword, skill extraction, and TF-IDF / cosine similarity matching against Job Descriptions.
   - Groq LLM resume analysis agent (`backend/langgraph_agents/resume_analysis_agent.py`) for qualitative feedback.
2. **Interactive Screening UI (`src/components/ui/resumeAnalyzer.tsx`)**:
   - Batch resume upload, threshold filtering slider, candidate list display with match percentages, acceptance/rejection email generation, and CSV export.
3. **AI Interview Conductor (`backend/langgraph_agents/interview_conductor_agent.py`)**:
   - LangGraph StateGraph agent for running structured interviews.
   - Multi-stage interview flow (Intro → Technical → Behavioral → Situational → Closing).
   - Question generation tailored to candidate resume and job requirements using Groq (`llama-3.3-70b-versatile`).
   - Real-time answer evaluation, scoring (0-10 scale), and adaptive follow-up question generation.
4. **Speech-to-Text Processing (`backend/langgraph_agents/audio_transcription_agent.py` & `/api/stt/transcribe`)**:
   - Groq Whisper (`whisper-large-v3`) audio transcription handling WAV/MP3/WebM audio files and base64 audio chunks.
5. **Text-to-Speech Generation (`backend/langgraph_agents/tts_agent.py` & `/api/tts/speak`)**:
   - Deepgram Aura / ElevenLabs TTS generation returning audible speech.
   - Can also fall back to browser-native Web Speech API (`window.speechSynthesis`) in the frontend for instantaneous zero-latency voice.
6. **Analytics & Scoring Engine (`backend/langgraph_agents/analytics_agent.py` & `backend/dashboard_service.py`)**:
   - Computation of multi-dimensional scores, latency, quality scores, strengths, and weaknesses.
   - JSON report endpoint (`/api/analytics/report/{session_id}`).
7. **Database Schemas & Repositories (`backend/db/` & `backend/repositories/`)**:
   - Standardized MongoDB schemas for users, resumes, job descriptions, interviews, and interview results.
8. **UI Component Library (`src/components/ui/`)**:
   - Radix UI + Tailwind CSS components (Card, Button, Dialog, Slider, Table, Badge, ScrollArea, Toaster).

---

## 5. Features We Need To Build or Fix

1. **API Port / Host Alignment**:
   - The frontend currently makes calls to `http://localhost:5000` (the Flask server), whereas the advanced interview orchestrator, STT, and WebSocket services reside on `http://localhost:8001` (the FastAPI server in `backend/main.py`).
   - Need to standardize frontend API configuration (`src/config/api.ts`) to point to a single unified backend endpoint or configure a reverse proxy.
2. **In-Browser AI Interview Room UI**:
   - The existing route `/interview/:roomid` points to `VideoInterview.tsx`, which loads an external ZegoCloud 1-on-1 video call room with hardcoded test tokens and ngrok links, completely disconnected from the AI interviewer backend.
   - Need to build/fix an interactive AI Interview Room page that connects webcam/mic, communicates with `/api/interview/start` and `/api/interview/answer`, plays AI audio, records candidate responses, and displays real-time subtitles/questions.
3. **Audio Streaming / Web Speech Pipeline**:
   - Ensure clean capture of microphone audio from the candidate and seamless handover to the transcription service (Groq Whisper or browser Web Speech API), then forwarding to the answer processing endpoint.
4. **Recruiter Evaluation / Results Page**:
   - Create a clean frontend view for recruiters to inspect completed interview results, review scores, read candidate answer transcripts, and see the AI recommendation.
5. **Configuration & Environment Setup**:
   - Create `.env` from `.env.template` with required keys (Groq API Key, MongoDB URI).

---

## 6. Features We Are Not Prioritizing

To ensure completion within the 2-day timeline, the following high-complexity, low-reliability features are deferred and will **not** block the MVP:

1. **Autonomous Google Meet Puppeteer/Playwright Bot (`meet_bot_joiner.py`, `meet_bot_launcher.py`)**:
   - Automated joining of Google Meet meetings requires dedicated Google bot credentials, session cookie management, bypassing Google bot detection/captchas, and virtual audio routing (VB-Cable/BlackHole).
   - *Alternative for MVP*: Direct, professional in-browser AI interview room. This is 100% reliable, runs on standard web technologies, and delivers an identical user experience without external meeting platform dependencies.
2. **Google Calendar OAuth Scheduling (`google_calendar_service.py`)**:
   - Google Calendar token refresh and OAuth verification adds unnecessary friction for a demo.
   - *Alternative for MVP*: Instant interview launch button upon candidate shortlisting.
3. **Distributed Multi-Worker Scaling (`distributed_orchestrator_agent.py`, `start_4_workers.ps1`)**:
   - Redis/distributed worker orchestration for thousands of concurrent interviews is unnecessary for demonstration purposes. Single server process is sufficient.
4. **Firebase Auth User Role Synchronization**:
   - Authentication can either use existing simple credentials or bypass directly to the recruiter workflow for demo speed.

---

## 7. Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript (`vite_react_shadcn_ts`)
- **Build Tool**: Vite (`@vitejs/plugin-react-swc`)
- **UI & Styling**: Tailwind CSS, Radix UI primitives, Lucide React icons, Chakra UI (partial), Framer Motion
- **State & Data Fetching**: `@tanstack/react-query`, React Hook Form, standard fetch
- **Media & Charts**: Chart.js, Recharts, ZegoCloud UIKit (legacy)
- **PDF Extraction**: `pdfjs-dist`, `pdf-lib`

### Backend
- **Frameworks Found**:
  - **FastAPI** (`backend/main.py`, 7,277 lines): Primary high-performance API server running on port 8001 with Uvicorn.
  - **Flask** (`backend/app.py`, 1,250 lines): Legacy API server running on port 5000.
- **AI Agent Orchestration**: LangGraph (`StateGraph`), Groq Python SDK
- **Speech & Audio**:
  - Speech-to-Text: Groq Whisper API (`whisper-large-v3`)
  - Text-to-Speech: Deepgram Aura API (`deepgram-sdk`) / ElevenLabs / gTTS
- **NLP & Document Processing**: spaCy (`en_core_web_sm`), PyPDF2, scikit-learn (TF-IDF, cosine similarity)
- **Browser Automation (Non-MVP)**: Playwright / Chromium

### Database
- **Database**: MongoDB (Local or MongoDB Atlas)
- **Driver**: PyMongo (`MongoClient`) with centralized singleton client (`backend/db/mongo_client.py`)
- **ODM/Schemas**: Plain dictionary schema definitions in `backend/db/models.py` covering 19 collections.

---

## 8. Project Architecture

The current architecture is divided into three primary layers:

```
[ Frontend (React + Vite, Port 5173) ]
       │
       ├─► Resume Upload & Screening UI (ResumeAnalyzer.tsx) [Calls Port 5000: Batch analysis, CSV, Action processing]
       ├─► Chatbot & Role Analysis (HRChatbot.tsx, EmployeeChatbot.tsx) [Calls Port 5000: Single analysis, Q&A, salary]
       └─► AI Interview Room (Planned to replace legacy ZegoCloud on Port 8001)
       │
       ▼
[ Backend API Services ]
       │
       ├─► Flask Backend (backend/app.py, Port 5000)
       │     ├─► /api/analyze (Batch multipart resume upload & JD match)
       │     ├─► /api/download-csv, /api/process-action, /api/generate-message
       │     └─► /api/auth (Firebase UID sync with MongoDB)
       │
       └─► Primary FastAPI Backend (backend/main.py, Port 8001) [VERIFIED: 83 Endpoints Registered]
             ├─► /health & /docs
             ├─► /api/interview/start, /api/interview/answer, /api/interview/{id}
             ├─► /api/interviews/{id}/qa-loop, /api/interviews/{id}/process-answer
             ├─► /api/questions/generate, /api/questions/{id}
             ├─► /api/stt/transcribe (Groq Whisper Large V3)
             ├─► /api/tts/speak (Deepgram Aura)
             ├─► /api/dashboard/metrics & /api/dashboard/ws
             └─► LangGraph Agent System (InterviewConductor, QuestionGenerator, STT, TTS, Analytics)
       │
       ▼
[ Storage & External AI Services ]
       ├─► MongoDB Atlas: Users, Resumes, Interviews, Questions, Results
       ├─► Groq Cloud: LLaMA 3.3 70B (Orchestration/Evaluation) & Whisper (STT)
       ├─► Deepgram Cloud: Aura Voices (TTS)
       └─► Firebase: Authentication (Optional)
```

---

## 9. Important Files

| File/Folder | Purpose | Notes |
| :--- | :--- | :--- |
| `backend/main.py` | Primary FastAPI backend server (Port 8001) | Comprehensive 7,277-line service containing all interview, STT, TTS, and dashboard endpoints. All dependencies verified. |
| `backend/app.py` | Legacy Flask backend server (Port 5000) | Handles batch resume analysis (`resume_files`), text extraction, email generation, and TF-IDF matching. |
| `backend/.env` | Local backend environment configuration | Created from template; holds MongoDB and Groq credentials (never committed). |
| `backend/langgraph_agents/interview_conductor_agent.py` | AI Interview State Machine | Core LangGraph agent executing interview stages, asking adaptive questions, and scoring answers. |
| `backend/langgraph_agents/question_generator_agent.py` | Dynamic Question Generator | Generates role-tailored technical & behavioral questions from resume and JD. |
| `backend/langgraph_agents/audio_transcription_agent.py` | STT Speech Transcriber | Converts candidate audio chunks to text using Groq Whisper. |
| `backend/langgraph_agents/tts_agent.py` | Text-to-Speech Synthesizer | Converts AI text prompts to audio using Deepgram Aura. |
| `backend/db/mongo_client.py` | Centralized MongoDB connection | Singleton manager for MongoDB connection pooling and error handling. |
| `backend/db/models.py` | MongoDB database schemas | Defines data contracts for 19 database collections. |
| `src/App.tsx` | Frontend root router & providers | Configures client-side routing, React Query, and Chakra UI providers. |
| `src/components/ui/resumeAnalyzer.tsx` | Resume Upload & Screening UI | Implements PDF upload, match scoring against JD, threshold slider, and shortlisting (calls port 5000). |
| `src/config/api.ts` | Frontend API endpoint mapping | Currently points to `http://localhost:5000`; handles batch screening. Interview room will use dedicated port 8001 endpoint. |
| `src/components1/VideoInterview.tsx` | Legacy Video Interview Room | Uses ZegoUIKit with hardcoded links; needs replacement with in-browser AI interview room. |
| `backend/dashboard_service.py` | Recruiter Dashboard Backend Service | Computes real-time interview metrics, latency statistics, and quality scores. |
| `backend/.env.template` | Environment variables template | Contains all configuration keys for Groq, MongoDB, and ports. |

---

## 10. Current Feature Status

| Feature | Status | Notes |
| :--- | :--- | :--- |
| Resume upload | EXISTS | Working in code via `ResumeAnalyzer.tsx` (multipart form data). |
| Resume parsing | EXISTS | Working in code via `PyPDF2`, spaCy, and `pdfjs-dist`. |
| Resume analysis | EXISTS | Working in code; uses TF-IDF cosine similarity and Groq LLM agent. |
| Candidate ranking | EXISTS | Working in code; ranks candidates descending by match percentage with CSV export. |
| Job description | EXISTS | Working in code; supports custom text input and predefined role profiles. |
| Candidate screening | EXISTS | Working in code; threshold slider filtering and candidate selection checkboxes. |
| Interview generation | EXISTS | Working in code; `question_generator_agent.py` produces customized questions. |
| AI interviewer | PARTIALLY EXISTS | Working in backend (`InterviewConductorAgent`); frontend interview UI is disconnected. |
| Speech-to-text (STT) | EXISTS | Working in backend (`AudioTranscriptionAgent` via Groq Whisper). |
| Text-to-speech (TTS) | EXISTS | Working in backend (`TTSAgent` via Deepgram Aura) + browser Web Speech available. |
| Camera/video | PARTIALLY EXISTS | Code exists in `VideoInterview.tsx` (ZegoCloud); needs direct HTML5 webcam integration. |
| Adaptive questions | EXISTS | Working in backend; `InterviewConductorAgent` generates follow-ups based on answer quality. |
| Answer evaluation | EXISTS | Working in backend; Groq LLM evaluates answers against expected criteria (0-10 scale). |
| Interview scoring | EXISTS | Working in backend; calculates technical, communication, and overall scores. |
| Interview scheduling | PARTIALLY EXISTS | Code exists for Google Calendar; too complex for 2-day MVP, bypass with instant launch. |
| Google Meet bot | PARTIALLY EXISTS | Complex Playwright automation exists; deferred due to high flakiness and credential barriers. |
| Recruiter dashboard | PARTIALLY EXISTS | Backend HTML dashboard exists at `/dashboard` (port 8001); candidate scorecard view needed. |
| Candidate dashboard | PARTIALLY EXISTS | Chatbots exist for career path and salary; no unified candidate interview portal. |
| Authentication | EXISTS | Firebase Auth + MongoDB user sync route (`/api/auth`). |
| Database persistence | EXISTS | PyMongo verified; MongoDB Atlas schemas ready in `models.py`. |

---

## 11. External Dependencies & Required Environment Variables

All secret values must be stored exclusively in `backend/.env`.

### Required Variable Names (NO VALUES STORED HERE):
- `GROQ_API_KEY`: Primary key for Groq inference and STT.
- `GROQ_MODEL`: Model name for Groq LLM inference (default: `qwen/qwen3.8-27b`; verified working on current account).
- `API_KEY_ANALYSIS`: Specific client key for resume analysis (defaults to `GROQ_API_KEY`).
- `API_KEY_QA`: Specific client key for Q&A loop (defaults to `GROQ_API_KEY`).
- `API_KEY_QUESTIONS`: Specific client key for question generator (defaults to `GROQ_API_KEY`).
- `API_KEY_IMPROVEMENT`: Specific client key for resume improvement (defaults to `GROQ_API_KEY`).
- `API_KEY_IMPROVED_RESUME`: Specific client key for improved resume generator (defaults to `GROQ_API_KEY`).
- `MONGO_URI`: Primary MongoDB connection string URI.
- `MONGODB_URI`: Compatibility alias for MongoDB URI used across repositories.
- `MONGODB_ATLAS_URI`: Compatibility alias for MongoDB Atlas URI used by dashboard service.
- `MONGO_DB_NAME`: Database name in cluster (default: `resumate`).
- `API_HOST`: FastAPI host (default: `0.0.0.0`).
- `API_PORT`: FastAPI port (default: `8001`).
- `CORS_ORIGINS`: Allowed origins (default: `http://localhost:3000,http://localhost:5173`).

---

## 12. Completed Work

- Repository cloned and opened in Antigravity IDE.
- Full codebase audited (Frontend, Backend, AI agents, Database, Voice systems).
- Architectural gap analysis and 2-day MVP roadmap defined.
- `PROJECT_MEMORY.md` created and maintained.
- Missing Python dependencies verified and installed (`fastapi`, `pymongo`, `dnspython`, `groq`, `PyPDF2`, `langgraph`, `langchain-core`, `langchain-groq`, `deepgram-sdk`, `PyJWT`, `bcrypt`, `motor`).
- Core backend imports and LangGraph agent workflow instantiation tested and verified.
- FastAPI routes verified (83 registered routes confirmed).
- `backend/.env` prepared with exact variable names expected by backend code.
- Fixed Groq model configuration in `backend/langgraph_agents/interview_conductor_agent.py` to be configurable via `GROQ_MODEL` with default `qwen/qwen3.8-27b`.
- Added initial interview persistence in `start_interview` via `self.store_interview(result)`.
- Ensured non-null `interview_id` and `session_id` generation when optional parameters are omitted.
- Configured intro-to-technical transition in `decide_next_step`.
- Connected frontend interview room (`src/components1/VideoInterview.tsx`) to FastAPI on port 8001.
- Created `src/services/interviewService.ts` for modular and type-safe API communication.
- Verified complete browser flow from setup to AI introduction, answer submission, evaluation, and next technical question generation.
- Connected Candidate Screening (`src/components/ui/resumeAnalyzer.tsx`) to AI Interview (`src/components1/VideoInterview.tsx`).
- Implemented state hand-off passing candidate name, email, target job title, parsed skills, and resume text with automatic pre-population and zero invented values.
- Verified browser flow end-to-end: Resume screening → select candidate → Start Interview → pre-populated AI interview setup → launch live interview session with Groq.
- Added Voice Interaction Layer (`src/components1/VideoInterview.tsx`) using the browser's native Web Speech API without adding any third-party dependencies or breaking backend contracts.
- Verified voice flow: Speak Answer button, listening state indicator, speech insertion into textarea, candidate editing of recognized text, submission to FastAPI evaluation engine, and continuation to next technical questions.

---

## 13. MVP Checkpoint — VERIFIED & COMPLETE

> **The MVP is VERIFIED and WORKING. The next development phase is Video Interview + AI TTS.**

---

### TASK 9 — COMPLETE: Restore Flask Resume Analysis

- Installed `spacy==3.8.16`.
- Installed `en_core_web_sm==3.8.0`.
- Flask resume analysis restored and verified.
- `backend/app.py` modified: added `use_reloader=False` to `app.run()` to prevent Windows Python 3.14 Werkzeug reloader socket crash (`WinError 10038`) and to preserve `.env` variables across the Flask process lifecycle.
- Windows Flask launch requires: `$env:PYTHONUTF8="1"; python app.py`
- Real PDF `/api/analyze` verified: HTTP 200, candidate extraction working, score returned.
- Groq resume analysis working via `ResumeAnalysisAgent`.

---

### TASK 10 — COMPLETE: Fix ResumeAnalysisAgent Groq Model

- `backend/langgraph_agents/resume_analysis_agent.py` updated: replaced hardcoded `llama-3.3-70b-versatile` with `os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")`.
- Current model: `qwen/qwen3.8-27b`.
- Dynamic skill matching verified with real resumes.
- Candidate screening verified end-to-end.
- Candidate → interview handoff verified.

---

### POST-TASK-10 FULL QA — COMPLETE (21/21 CHECKS PASSED)

- **Critical blockers**: 0
- **Normal bugs**: 0
- **Minor issues**: 1 (Windows UTF-8 console limitation — non-blocking, resolved by `PYTHONUTF8=1`)

| Check | Result |
| :--- | :--- |
| Vite frontend `:3000` | ✅ PASS |
| Flask `:5000` | ✅ PASS |
| FastAPI `:8001` | ✅ PASS |
| MongoDB Atlas | ✅ PASS |
| Groq (`qwen/qwen3.8-27b`) | ✅ PASS |
| Real PDF `/api/analyze` | ✅ PASS |
| Browser resume screening UI | ✅ PASS |
| Candidate → interview handoff | ✅ PASS |
| AI interview start (Groq intro) | ✅ PASS |
| Typed answer submission | ✅ PASS |
| Web Speech API voice input | ✅ PASS |
| AI answer evaluation | ✅ PASS |
| Adaptive follow-up questions | ✅ PASS |
| Final scorecard display | ✅ PASS |
| MongoDB persistence | ✅ PASS |
| Error handling (bad inputs) | ✅ PASS |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run build` | ✅ PASS |
| Browser console errors | ✅ None |
| `.env` secrets unexposed | ✅ PASS |
| Git history clean | ✅ PASS |

---

### CURRENT VERIFIED END-TO-END FLOW

```
PDF Resume Upload
→ Flask /api/analyze (:5000)
→ AI Resume Analysis (Groq + LangGraph)
→ Candidate Screening & Ranking
→ Candidate Selection
→ Start Interview (handoff)
→ FastAPI /api/interview/start (:8001)
→ Groq AI generates personalized introduction
→ Typed or Voice Answer (Web Speech API)
→ FastAPI /api/interview/answer
→ Groq AI evaluation + score
→ Adaptive follow-up questions
→ Final Scorecard
→ MongoDB persistence
```

---

## 14. Video Interview Phase

---

### Task 1: Webcam Integration — COMPLETE

- **Status**: COMPLETE & VERIFIED
- **File changed**: `src/components1/VideoInterview.tsx` only
- **Implementation**: Native browser `navigator.mediaDevices.getUserMedia({ video: true, audio: false })`
- **Display**: `<video ref autoPlay playsInline muted>` with `srcObject` binding
- **Camera states implemented**:
  - `idle` — brief initial state before camera auto-starts
  - `requesting` — spinner shown while awaiting browser permission
  - `active` — live video stream visible with green dot + red LIVE badge
  - `denied` — `NotAllowedError` caught, amber warning shown to candidate
  - `unavailable` — `NotFoundError` / unsupported browser caught, grey placeholder shown
  - `off` — manually turned off, placeholder + "Turn camera back on" link shown
- **Camera auto-starts** when interview begins (`useEffect` on `interviewStarted`)
- **Camera on/off controls**: "Turn Off Camera" / "Turn On Camera" toggle button in camera panel header
- **Stream cleanup on unmount**: `useEffect` cleanup stops all `MediaStream` tracks — camera LED turns off when leaving the page
- **No external libraries, no streaming service, no backend changes, no new dependencies**
- **Existing AI interview functionality**: Typed answers, Web Speech API voice answers, adaptive questions, final scorecard — all unchanged and verified
- **`npx tsc --noEmit`**: PASS (0 errors)
- **`npm run build`**: PASS (8.77s)
- **Browser verification**: Camera permission prompt → live video → toggle off → toggle on → navigate away stops camera → no console errors

---

### Task 2: AI TTS — COMPLETE

- **Status**: COMPLETE & VERIFIED
- **File changed**: `src/components1/VideoInterview.tsx` only
- **Implementation**: Browser-native `window.speechSynthesis` + `SpeechSynthesisUtterance` — zero dependencies, zero backend changes
- **Feature detection**: `'speechSynthesis' in window` — interview continues normally if unsupported (shows "Browser TTS unavailable" note)
- **Voice selection**: Prefers natural English voice (Google, Natural, Samantha, Daniel) → falls back to any `en` voice → falls back to browser default
- **TTS config**: `rate=0.95`, `pitch=1.0`, `lang='en-US'`
- **Auto-speak**: `useEffect` on `currentQuestion` (with 300ms delay to allow voice list to load) auto-speaks every new AI question
- **Stop Speaking**: `speechSynthesis.cancel()` — immediately stops current speech, transitions header to Replay state
- **Replay Question**: Cancels any current speech, re-speaks `currentQuestion` — restores "AI is speaking..." indicator
- **New question arrives**: Previous speech cancelled, new question spoken automatically
- **Unmount cleanup**: `useEffect` cleanup calls `speechSynthesis.cancel()` — no speech continues after leaving the interview
- **UI**: Speaking indicator (pulsing cyan dot + "AI is speaking...") + "Stop Speaking" button while active; "Replay Question" button when idle — in existing question card header
- **Autoplay note**: Browser autoplay policy may block auto-speech until first user interaction. "Replay Question" handles this — no crash, no interview block
- **Existing functionality unchanged**: Webcam, Web Speech API mic, typed answers, Groq evaluation, adaptive questions, final scorecard — all verified
- **`npx tsc --noEmit`**: PASS (0 errors)
- **`npm run build`**: PASS (8.00s)
- **Browser verification**: AI introduction auto-spoken → Stop Speaking cancels → Replay Question re-speaks → no console errors

---

### Video Interview Phase — Task 2A: Interview Room Visual Redesign

- **Status**: COMPLETE & VERIFIED
- **File changed**: `src/components1/VideoInterview.tsx` only
- **Two-panel video-call layout**: Two balanced video-call panels (desktop: side-by-side, mobile: stacked) resembling Google Meet / Zoom / Teams.
- **AI interviewer avatar panel**: Centered AI avatar with dark video-call background, "AI Interviewer" label, participant name tag pill, and audio visualizer.
- **Candidate webcam panel**: Live camera video stream rendered via `videoRef`, top-right `LIVE` badge, bottom-left participant name tag with real-time mic status, and bottom-right `#camera-toggle-btn`.
- **AI speaking visual driven by existing isSpeaking state**: Concentric multi-layer pulsing glow rings around avatar + dynamic 4-bar audio equalizer badge triggered when `isSpeaking` is true; static when idle.
- **Candidate camera on/off**: Camera can be toggled on and off cleanly via `#camera-toggle-btn` with tracks stopped on turn-off and unmount.
- **Camera-off placeholder**: Displays video-call style placeholder with candidate initials avatar circle, "Camera is turned off" text, and "Turn camera on" link.
- **Question displayed below video panels**: Current AI question presented prominently below the video grid in styled speech blockquote with stage badge.
- **Existing TTS controls preserved**: Automatic question reading, `#tts-stop-btn` ("Stop Speaking"), and `#tts-replay-btn` ("Replay Question") fully functional.
- **Existing microphone controls preserved**: `#speak-answer-btn`, `#listening-banner` ("Done Speaking"), real-time transcript insertion into `#candidate-answer-textarea`, and `#submit-answer-btn` fully functional.
- **Existing interview logic unchanged**: Groq questions, LangGraph conductor, answer evaluation, adaptive follow-ups, and scorecard unchanged.
- **TypeScript passed**: `npx tsc --noEmit` exited 0 with 0 errors.
- **Production build passed**: `npm run build` completed in 8.48s with exit code 0.
- **Browser verification passed**: Full verification at `http://localhost:3000/interview/TestCandidate` confirmed all visual components and interaction flows work.
- **0 console errors**: Browser console completely clean.

---

### NEXT TASK

Task 3 — Final Interview Room Polish / Integration Review

*(DO NOT implement Task 3 until reviewed and approved by the project lead.)*

---

## 15. Development Rules

1. **Read PROJECT_MEMORY.md before every development task.**
2. **Do not break existing working functionality.**
3. **Do not modify unrelated files.**
4. **Do not implement future tasks without explicit instruction from the project lead.**
5. **Prefer the simplest working solution** to guarantee 2-day delivery.
6. **Avoid unnecessary dependencies.**
7. **Never store secrets, passwords, or API keys in PROJECT_MEMORY.md or version control.**
8. **Update PROJECT_MEMORY.md after every major completed task.**
9. **Never claim something works unless it has actually been tested and verified.**
10. **Keep the 2-day working demonstration as the supreme priority.**

---

## 16. Development Log

| Timestamp (ISO / Date) | Action / Task Completed | Notes |
| :--- | :--- | :--- |
| 2026-09-20 | Initial Repository Audit & Project Memory Setup | Audited full repository, documented 7,200+ line FastAPI backend, LangGraph agents, React frontend, and established 2-day MVP path. |
| 2026-09-20 | Backend Environment Configuration & Verification | Inspected config files, prepared `backend/.env`, installed missing dependencies (`fastapi`, `pymongo`, `groq`, `langgraph`, `deepgram-sdk`), verified 83 routes in `main.py`, identified port 5000 vs 8001 dual-architecture. |
| 2026-09-20 | Task 3 Connection Troubleshooting | Detected initial empty `.env` on disk; user saved valid credentials. |
| 2026-09-20 | Task 3C DNS & Connectivity Diagnostics | Verified DNS SRV resolution, TCP port 27017 connection, and successful PyMongo Atlas ping. |
| 2026-09-20 | Task 4 Boot FastAPI & Smoke Test | FastAPI, MongoDB, /health, /docs all PASSED. Groq model 404 identified (`llama-3.3-70b-versatile`), and missing initial MongoDB state persistence identified in `start_interview`. |
| 2026-09-20 | Task 5 Groq Model Configuration & Interview Persistence | Configured `GROQ_MODEL=qwen/qwen3.8-27b` in `.env` and `interview_conductor_agent.py`. Implemented initial interview state persistence in `start_interview` via `store_interview`. Verified `/health` (PASS), `/api/interview/start` with Groq-generated intro (PASS), MongoDB persistence (PASS), and `/api/interview/answer` with AI evaluation and next technical question generation (PASS). |
| 2026-09-20 | Task 6 Frontend AI Interview Room Integration | Replaced dead ZegoCloud ngrok code in `VideoInterview.tsx` with live interactive AI interview room connected to FastAPI port 8001. Added `FASTAPI_BASE_URL` in `api.ts` and created `interviewService.ts`. Fixed unconfigured Firebase and Groq SDK startup exceptions. Tested complete browser flow end-to-end: Start AI Interview → AI Introduction → Candidate Answer → AI Evaluation → Technical Question #1. Verified `tsc` (0 errors) and `npm run build` (PASS). |
| 2026-09-20 | Task 7 Candidate Screening to Interview Connection | Connected candidate screening in `src/components/ui/resumeAnalyzer.tsx` to `src/components1/VideoInterview.tsx`. Passed candidate name, email, target job title, parsed skills, and resume profile with zero invented values. Handled both individual card and batch "Start Interview" actions. Verified browser hand-off, form pre-population, and AI interview start (`tsc` 0 errors, build PASS, browser test PASS). |
| 2026-09-20 | Task 8 Voice Interaction in AI Interview Room | Added voice interaction layer to `src/components1/VideoInterview.tsx` using browser Web Speech API. Inspected FastAPI STT health (200 OK). Integrated "Speak Answer", live listening state, real-time speech insertion into answer textarea, full text editing capability, and error handling. Verified browser test end-to-end with multiple question evaluation cycles (`tsc` 0 errors, build PASS, browser test PASS). |
| 2026-09-20 | Task 9 Restore Flask Resume Analysis | Installed `spacy==3.8.16` and `en_core_web_sm==3.8.0`. Fixed two Flask startup issues: (1) `UnicodeEncodeError` on Windows cp1252 — resolved via `PYTHONUTF8=1`; (2) Werkzeug watchdog reloader `WinError 10038` + env var loss — fixed by adding `use_reloader=False` to `app.run()`. Verified HTTP 200 with real PDF, score=44.0, Groq skills extraction working. |
| 2026-09-20 | Task 10 Fix Resume Analysis Groq Model Config | Replaced hardcoded `llama-3.3-70b-versatile` in `resume_analysis_agent.py` with `os.getenv('GROQ_MODEL', 'qwen/qwen3.8-27b')`. Verified `/api/analyze` with `Vaibhav_Narute.pdf` (score=58.0, 8 matching skills) and `Aaryan Gole - Resume.pdf` (score=28.0). Candidate handoff, `tsc` (0 errors), `npm run build` all PASS. |
| 2026-09-20 | MVP Checkpoint — Verified before Video Interview + AI TTS phase | 21/21 QA checks passed. Full end-to-end flow confirmed. Git checkpoint committed. |
| 2026-09-20 | Video Interview Phase Task 1 — Webcam Integration | Added native webcam preview to `VideoInterview.tsx` using `navigator.mediaDevices.getUserMedia`. Implemented idle/requesting/active/off/denied/unavailable camera states, toggle on/off control, auto-start on interview begin, and stream cleanup on unmount. Zero backend changes, zero new dependencies. `tsc` (0 errors), `npm run build` (PASS 8.77s), browser verified (camera active, toggle works, no console errors). |
| 2026-09-20 | Video Interview Phase Task 2 — AI TTS | Added `window.speechSynthesis` TTS to `VideoInterview.tsx`. AI questions auto-spoken on arrival (300ms delay for voice list). Stop Speaking / Replay Question controls in question card header. Pulsing cyan "AI is speaking..." indicator. Unmount cleanup cancels speech. Feature-detected with graceful fallback. Autoplay policy handled via Replay button. Zero backend changes, zero new dependencies. `tsc` (0 errors), `npm run build` (PASS 8.00s). |
| 2026-09-20 | Video Interview Phase Task 2A — Interview Room Visual Redesign | Redesigned `VideoInterview.tsx` active room into a modern 2-panel video call interface (Zoom / Meet style). Left panel: AI Interviewer (camera-off participant, centered avatar with concentric pulsing ring animation + 4-bar audio equalizer driven by existing `isSpeaking`). Right panel: Candidate Webcam (live feed via `videoRef`, LIVE badge, name tag with mic state, camera toggle on/off, video-call placeholder when off). AI Question presented prominently below video panels with TTS controls. Candidate answer textarea and mic controls preserved with zero logic changes. Zero backend changes, zero new dependencies. `tsc` (0 errors), `npm run build` (PASS 8.48s), browser verified. |



