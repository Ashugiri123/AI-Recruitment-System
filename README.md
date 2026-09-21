# 🤖 AI Recruiter — Autonomous Interview Platform

> **GitHub:** https://github.com/vaibhavnarute/recruit  
> **Stack:** Python 3.11 · FastAPI · React/TypeScript · LangGraph · Groq · Deepgram · MongoDB · Redis · Playwright

---

## 🚀 Quick Presentation Startup (One Command)

To run the complete AI Recruitment & AI Interview presentation demo with a single command:

```powershell
.\start_demo.ps1
```

### 1. Required Environment Variables
Ensure `backend/.env` is created from `backend/.env.template` with at least:
- `GROQ_API_KEY`: Your Groq API key for LLM question generation & answer evaluation.
- `MONGODB_URI` / `MONGO_URI`: MongoDB connection string.

### 2. What `start_demo.ps1` Starts
Executing `.\start_demo.ps1` in PowerShell opens 3 service windows:
1. **Flask Resume Analysis Service** — Running on `http://localhost:5000`
2. **FastAPI AI Interview Conductor** — Running on `http://localhost:8001`
3. **Vite React Frontend** — Running on `http://localhost:3000`

### 3. Expected URLs
- **Web App**: [http://localhost:3000](http://localhost:3000)
- **Recruiter Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Flask Resume Backend**: [http://localhost:5000](http://localhost:5000)
- **FastAPI AI Conductor Backend**: [http://localhost:8001](http://localhost:8001)
- **FastAPI Interactive API Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)

### 4. How to Stop the Demo
To stop all services, simply close the opened PowerShell terminal windows for Flask, FastAPI, and Vite.


---

## What is this project?

An AI platform that runs **the entire hiring pipeline by itself** — from uploading a resume to conducting a live voice interview on Google Meet — without any human sitting in the interview.

```
HR uploads resumes
    ↓
AI ranks candidates by job fit
    ↓
HR picks a candidate → clicks "Schedule Interview"
    ↓
Google Calendar event created → Meet link generated → Email sent to candidate
    ↓
Candidate clicks "Join Meeting" link from email
    ↓
Our bot is already in the meeting as host
    ↓
Bot admits the candidate automatically
    ↓
Bot speaks questions out loud (TTS)
    ↓
Candidate answers → Bot listens and transcribes (STT)
    ↓
LLM analyzes each answer → scores it
    ↓
Interview ends → Full report saved to MongoDB
    ↓
HR reads the report on dashboard
```

Nobody writes questions manually. Nobody sits in the interview. The AI does all of it.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Feature 1 — Resume Upload & Analysis](#2-feature-1--resume-upload--analysis)
3. [Feature 2 — Resume Ranking](#3-feature-2--resume-ranking)
4. [Feature 3 — Interview Scheduling](#4-feature-3--interview-scheduling)
5. [Feature 4 — Google Meet Bot (Full Flow)](#5-feature-4--google-meet-bot-full-flow)
6. [Feature 5 — Live Interview Audio (TTS + STT)](#6-feature-5--live-interview-audio-tts--stt)
7. [Feature 6 — Question Generation](#7-feature-6--question-generation)
8. [Feature 7 — Post-Interview Analytics](#8-feature-7--post-interview-analytics)
9. [Feature 8 — Resume Improvement](#9-feature-8--resume-improvement)
10. [Feature 9 — ML Predictions](#10-feature-9--ml-predictions)
11. [Feature 10 — Real-time Dashboard](#11-feature-10--real-time-dashboard)
12. [Feature 11 — Resume Q&A Chatbot](#12-feature-11--resume-qa-chatbot)
13. [LangGraph — Why and How](#13-langgraph--why-and-how)
14. [MCP Layer — Context and Cache](#14-mcp-layer--context-and-cache)
15. [Redis Distributed Scaling](#15-redis-distributed-scaling)
16. [MongoDB Collections](#16-mongodb-collections)
17. [Frontend Pages](#17-frontend-pages)
18. [API Reference](#18-api-reference)
19. [Installation & Setup](#19-installation--setup)
20. [Environment Variables](#20-environment-variables)
21. [Project Structure](#21-project-structure)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND  (React + TypeScript + Vite)       │
│                                                          │
│   HR Dashboard | Resume Upload | Analytics | Chatbot     │
│   Firebase Auth (login/signup for HR and candidates)     │
└─────────────────┬───────────────────────────────────────┘
                  │  REST API + WebSocket
┌─────────────────▼───────────────────────────────────────┐
│           FASTAPI BACKEND  (main.py — 7000+ lines)       │
│           Port 8001  ·  4 Uvicorn workers                │
│                                                          │
│  ┌──────────────────┐  ┌───────────────┐  ┌──────────┐  │
│  │  LangGraph       │  │  MCP Layer    │  │  Google  │  │
│  │  14 AI Agents    │  │  Context +    │  │  Meet    │  │
│  │                  │  │  Cache +      │  │  Bot     │  │
│  │  Each agent is   │  │  Token Opt +  │  │          │  │
│  │  a state machine │  │  Redis Mgr    │  │  Playwright│ │
│  └──────────────────┘  └───────────────┘  └──────────┘  │
└──────────┬──────────────────┬────────────────┬──────────┘
           │                  │                │
    ┌──────▼──────┐  ┌────────▼──────┐  ┌─────▼───────────┐
    │ MongoDB     │  │ Redis Cloud   │  │ External APIs   │
    │ Atlas       │  │ Streams +     │  │ Groq LLaMA 70b  │
    │ (resumate)  │  │ Pub/Sub       │  │ Groq Whisper    │
    │             │  │               │  │ Deepgram Aura   │
    │ resumes     │  │ One stream    │  │ Google Calendar │
    │ interviews  │  │ per interview │  │ Firebase Auth   │
    │ questions   │  │ session       │  └─────────────────┘
    │ qa_sessions │  └───────────────┘
    │ results     │
    └─────────────┘
```

---

## 2. Feature 1 — Resume Upload & Analysis

### What happens when HR uploads a resume

```
HR opens the Upload page
    ↓
Selects a PDF resume + picks a job role (e.g., "AI/ML Engineer")
    ↓
POST /api/analyze-resume
    ↓
FastAPI reads the PDF text (PyPDF2)
    ↓
Calls ResumeAnalysisAgent (LangGraph workflow starts)
```

### Inside ResumeAnalysisAgent — 4 steps in sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                   ResumeAnalysisAgent Workflow                   │
│                  (resume_analysis_agent.py)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                 │
│  │  START      │                                                 │
│  └──────┬──────┘                                                 │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │  Step 1: extract_data                                    │    │
│  │  LLM reads raw resume text                               │    │
│  │  Returns structured JSON:                                │    │
│  │    { skills: [...], experience: [...],                   │    │
│  │      education: {...}, projects: [...] }                 │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │  Step 2: match_requirements                              │    │
│  │  Compare extracted skills vs job requirements            │    │
│  │  (job requirements defined in main.py per role)          │    │
│  │  Finds: matched_skills, missing_skills                   │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │  Step 3: calculate_scores                                │    │
│  │  Scores 0-100:                                           │    │
│  │    · technical_depth (how deep the skills are)           │    │
│  │    · experience_relevance (years + domain match)         │    │
│  │    · education_fit (degree + field)                      │    │
│  │    · overall match_percentage                            │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │  Step 4: generate_recommendations                        │    │
│  │  LLM writes actionable suggestions:                      │    │
│  │    · "Add experience with Docker to match DevOps req."   │    │
│  │    · "Quantify your ML project results with metrics"     │    │
│  └──────┬──────────────────────────────────────────────────┘    │
│         │                                                        │
│  ┌──────▼──────┐                                                 │
│  │    END      │  → Result saved to MongoDB resumes collection   │
│  └─────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Files involved:**
- `backend/langgraph_agents/resume_analysis_agent.py` — the LangGraph agent
- `backend/main.py` — `/api/analyze-resume` endpoint + `ROLE_REQUIREMENTS` dict
- `backend/mcp/cache_manager.py` — caches result so the same resume isn't analyzed twice

**MCP Cache:** SHA256(resume_text + job_id) → if cached → return instantly without LLM call.

---

## 3. Feature 2 — Resume Ranking

### What happens when HR wants to compare multiple candidates

```
HR uploads 5 resumes for "Software Engineer" role
    ↓
POST /api/rank-resumes  (sends all 5 PDFs + job role)
    ↓
FastAPI runs ResumeAnalysisAgent on each resume (in parallel)
    ↓
Each resume gets a match_percentage (0-100)
    ↓
All results sorted by match_percentage descending
    ↓
HR sees ranked list:
    #1  John Smith      94%   ← best fit
    #2  Priya Sharma    87%
    #3  Alex Chen       71%
    #4  Mohit Kumar     55%
    #5  Sara Johnson    43%
```

**HR decision:** HR clicks on John Smith and Priya Sharma to schedule interviews.

---

## 4. Feature 3 — Interview Scheduling

### Full flow from HR clicking "Schedule" to candidate receiving email

```
HR fills the scheduling form:
    - Candidate: John Smith
    - Email: john@example.com
    - Job: Software Engineer
    - Date/Time: March 5, 2026 at 10:00 AM
    - Interview Type: AI Assisted
    ↓
POST /api/schedule-interview
    ↓
InterviewSchedulingAgent starts (LangGraph workflow)
```

### Inside InterviewSchedulingAgent — 5 steps

```
┌─────────────────────────────────────────────────────────────────┐
│             InterviewSchedulingAgent Workflow                    │
│             (interview_scheduling_agent.py)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: validate_input                                          │
│  ────────────────────────────────────────────────────────────   │
│  Check email format, date is in future, job_id exists           │
│                                                                  │
│  Step 2: create_google_meet_link                                 │
│  ────────────────────────────────────────────────────────────   │
│  GoogleCalendarService.create_event()                            │
│    → Calls Google Calendar API v3                                │
│    → Creates event: "Interview - Software Engineer"              │
│    → Duration: 1 hour at specified time                          │
│    → Google automatically embeds Meet link                       │
│    → Returns: meet_link = "https://meet.google.com/abc-xyz"      │
│               calendar_event_id = "abc123def456"                 │
│                                                                  │
│  Step 3: send_email_invitation                                   │
│  ────────────────────────────────────────────────────────────   │
│  EmailService.send_invitation()                                  │
│    → SMTP via Gmail (port 587, STARTTLS)                         │
│    → Sends HTML email to john@example.com with:                  │
│        · Interview date/time                                     │
│        · Job role                                                │
│        · Google Meet link                                        │
│        · "Join Interview" button                                  │
│           → links to: /api/meet/trigger/{interview_id}           │
│                        ?token={auto_join_token}                  │
│                                                                  │
│  Step 4: save_to_mongodb                                         │
│  ────────────────────────────────────────────────────────────   │
│  InterviewRepository.create()                                    │
│    → Collection: interviews                                      │
│    → Saves: interview_id, meet_link, auto_join_token,            │
│             candidate_email, job_title, status: "scheduled"      │
│                                                                  │
│  Step 5: generate_questions                                      │
│  ────────────────────────────────────────────────────────────   │
│  Triggers QuestionGeneratorAgent in background                   │
│    → Reads candidate's resume from resumes collection            │
│    → Generates 10 questions tailored to John's skills            │
│    → Saves to questions collection (interview_id as key)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Files involved:**
- `backend/langgraph_agents/interview_scheduling_agent.py`
- `backend/services/google_calendar_service.py`
- `backend/services/email_service.py`
- `backend/repositories/interview_repository.py`

---

## 5. Feature 4 — Google Meet Bot (Full Flow)

### This is the most complex part. Here is exactly what happens.

#### Phase A: Before the interview (bot joins first)

```
Interview is scheduled for 10:00 AM
    ↓
At 9:55 AM, system triggers bot automatically
    ↓
POST /api/meet/trigger/{interview_id}?token={auto_join_token}
    ↓
FastAPI validates the secret token against MongoDB
    ↓
Starts MeetInterviewOrchestrator in background asyncio task
```

#### Phase B: Bot browser startup (meet_bot_launcher.py)

```
GoogleMeetAuth.initialize()
    ↓
Playwright launches real Chromium browser (non-headless)
    ↓
BEFORE any page loads, install WebRTC interceptor script:

    window._botPeerConnections = [];
    const OrigPC = window.RTCPeerConnection;
    window.RTCPeerConnection = function(...args) {
        const pc = new OrigPC(...args);
        window._botPeerConnections.push(pc);  ← capture every PC
        pc.addEventListener('track', (e) => {
            if (e.track.kind === 'audio')
                window._botRemoteStream = e.streams[0];  ← candidate's voice
        });
        return pc;
    };

This runs BEFORE Google Meet's JavaScript — so we intercept every
RTCPeerConnection Meet creates, before Meet even knows we're there.
```

#### Phase C: Bot logs in to Google (session persistence)

```
Check: does meet_bot_sessions/airecruiterbot_at_gmail.com/session.json exist?
    ↓
YES → restore cookies into browser → navigate to meet.google.com
    → still logged in? → skip login entirely ✅
    ↓
NO → open accounts.google.com → wait up to 5 min for manual login
    → save cookies to session.json → next time: no login needed
```

Sessions last ~14 days. After first manual login, the bot runs fully automatically.

#### Phase D: Create or join the meeting

```
Navigate to https://meet.google.com/abc-xyz
    ↓
Bot detects it's already in the meeting (Google auto-joins creator)
    ↓
Check mic button aria-label → if mic is OFF → click to turn ON
    ↓
Bot is now IN the meeting with mic ON, waiting for candidate
```

#### Phase E: Candidate clicks "Join Interview" from email

```
Candidate opens email → clicks "Join Interview" button
    ↓
GET /api/meet/trigger/{interview_id}?token={secret_token}
    ↓
FastAPI shows HTML redirect page:
    "Your interview will begin in 10 seconds..."
    ↓
After 10 seconds → browser redirects to meet.google.com/abc-xyz
    ↓
Candidate enters Google Meet → lands in waiting room
    ↓
Waiting room notification appears on bot's screen:
    "John Smith wants to join"
```

#### Phase F: Auto-admit loop (meet_bot_joiner.py)

```
Background asyncio task running every 1 second:
    ↓
page.bring_to_front()  ← keep browser focused
    ↓
Search DOM for Admit buttons:
    · button:has-text("Admit")
    · button[aria-label*="Admit"]
    · button:has-text("Admit all")
    · button:has-text("Accept all")
    ↓
FOUND → page.click(admit_button)  ← trusted Playwright click, React responds
    ↓
Candidate is admitted into the meeting ✅
    ↓
stop_event.set()  ← signals interview to begin immediately
```

#### Phase G: Interview begins (interview_orchestrator.py)

```
stop_event fires
    ↓
Wait 3 seconds for candidate to fully connect
    ↓
MeetAudioIntegration.initialize()  ← set up audio in bot's browser
    ↓
Load questions from MongoDB (questions collection, interview_id)
    ↓
Greet candidate via TTS:
    "Hello John! I'm your AI interviewer today. 
     We'll be covering your experience with Software Engineering.
     Let's get started with the first question."
    ↓
Q&A loop begins for each question
```

### Complete Q&A Loop (one question cycle)

```
┌────────────────────────────────────────────────────────────────┐
│                   One Question Cycle                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. TTSAgent converts question text → audio bytes              │
│     (Deepgram Aura API → aura-asteria-en voice)                │
│                                                                 │
│  2. play_tts_audio() injects audio into WebRTC:                 │
│     · Decode audio → AudioBuffer in bot's browser              │
│     · Route through MediaStreamDestinationNode                  │
│     · replaceTrack() on all _botPeerConnections senders        │
│     · Candidate HEARS the question through Meet                 │
│                                                                 │
│  3. start_recording_candidate()                                 │
│     · MediaRecorder(window._botRemoteStream)  ← candidate's PC │
│     · Collect audio chunks every 250ms                         │
│                                                                 │
│  4. wait_for_silence() — 3 seconds of no audio = done          │
│     (max 45 seconds in case of long answer)                     │
│                                                                 │
│  5. stop_recording() → collect all chunks → base64 string      │
│                                                                 │
│  6. AudioTranscriptionAgent.transcribe_chunk()                  │
│     · Decode base64 → temp .wav file                           │
│     · POST to Groq Whisper API (whisper-large-v3)              │
│     · Returns: "I have 3 years of Python experience..."        │
│                                                                 │
│  7. Groq LLaMA 3.3 70b analyzes the answer:                    │
│     · Is it relevant to the question?                          │
│     · Is the technical depth adequate?                         │
│     · Score: 0-10                                              │
│     · Feedback: "Good explanation, but missed mentioning X"    │
│                                                                 │
│  8. Save Q+A+Score+Transcript to qa_sessions MongoDB collection │
│                                                                 │
│  9. MCPContextManager adds this turn to conversation history    │
│     (compresses old turns to avoid token overflow)             │
│                                                                 │
│  10. Move to next question → repeat                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Phase H: Interview ends

```
All questions answered
    ↓
TTS: "Thank you John, that concludes our interview today.
      We'll review your responses and get back to you soon."
    ↓
_leave_meeting() → click Leave button via Playwright
    ↓
_finalize_results() → calculate overall score
    ↓
PostInterviewAnalyticsAgent generates full report
    ↓
Save to interview_results MongoDB collection
    ↓
HR can read the report on dashboard
```

**Files involved:**
- `backend/meet_bot_launcher.py` — browser, login, session, WebRTC intercept
- `backend/meet_bot_joiner.py` — join meeting, auto-admit loop
- `backend/meet_audio_integration.py` — TTS playback + STT recording via WebRTC
- `backend/interview_orchestrator.py` — orchestrates the whole interview flow
- `backend/test_complete_meet_interview.py` — end-to-end test runner

---

## 6. Feature 5 — Live Interview Audio (TTS + STT)

### TTS — How the bot speaks (Text → Voice → Candidate hears it)

```
Question text: "Tell me about your Python experience"
    ↓
TTSAgent  (tts_agent.py)
    ↓
POST https://api.deepgram.com/v1/speak
    Headers: { Authorization: Token {DEEPGRAM_API_KEY} }
    Body:    { text: "Tell me about your Python experience",
               model: "aura-asteria-en" }
    ↓
Deepgram returns: PCM audio bytes (WAV)
    ↓
Encoded to base64 string
    ↓
MeetAudioIntegration.play_tts_audio(audio_base64)
    ↓
Browser JavaScript (in bot's Chromium):
    1. atob(audio_base64) → ArrayBuffer
    2. audioContext.decodeAudioData() → AudioBuffer
    3. AudioBufferSourceNode → connect to MediaStreamDestinationNode
    4. ttsTrack = destination.stream.getAudioTracks()[0]
    5. For each pc in window._botPeerConnections:
           pc.getSenders()
               .filter(s => s.track.kind === 'audio')
               .forEach(s => s.replaceTrack(ttsTrack))
    ↓
Bot's voice (TTS audio) now flows through all Meet peer connections
    ↓
Candidate hears the question in real-time ✅
```

**Voice used:** `aura-asteria-en` — professional, clear, neutral female voice.

---

### STT — How the bot listens (Candidate speaks → Text)

```
Candidate speaks their answer into their microphone
    ↓
Google Meet WebRTC carries their audio as a MediaStream
    ↓
window._botRemoteStream already captured it during RTCPeerConnection interception
    ↓
MeetAudioIntegration.start_recording_candidate()
    ↓
Browser JavaScript:
    mediaRecorder = new MediaRecorder(window._botRemoteStream,
                        { mimeType: 'audio/webm;codecs=opus' })
    mediaRecorder.ondataavailable = chunk => botAudioChunks.push(chunk)
    mediaRecorder.start(250)  // chunk every 250ms
    ↓
wait_for_silence():
    Poll botAudioChunks.length every 500ms
    If length unchanged for 3 seconds → silence → recording done
    ↓
stop_recording():
    mediaRecorder.stop()
    Await onstop Promise (ensures all chunks are flushed)
    new Blob(botAudioChunks) → base64
    ↓
AudioTranscriptionAgent.transcribe_chunk(audio_base64)
    ↓
Decode base64 → write to temp file (e.g., /tmp/audio_xyz.wav)
    ↓
POST https://api.groq.com/openai/v1/audio/transcriptions
    Body: { file: <wav file>, model: "whisper-large-v3", language: "en" }
    ↓
Groq Whisper returns: { text: "I have 3 years of Python experience..." }
    ↓
Clean text (remove filler words, fix punctuation artifacts)
    ↓
Transcript ready for LLM analysis ✅
```

**Why Groq for Whisper?** Groq's LPU hardware runs Whisper ~10x faster than standard cloud. A 30-second answer is transcribed in under 2 seconds.

---

## 7. Feature 6 — Question Generation

### How questions are generated for each candidate

```
Interview scheduled for John Smith (Software Engineer)
    ↓
QuestionGeneratorAgent starts  (question_generator_agent.py)
    ↓
Reads John's resume from MongoDB resumes collection
Reads job description for "Software Engineer" from DB
```

### Inside QuestionGeneratorAgent — 7 steps

```
┌─────────────────────────────────────────────────────────────────┐
│               QuestionGeneratorAgent Workflow                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: analyze_resume                                          │
│  Extract: technical_skills = ["Python", "Django", "PostgreSQL"]  │
│           experience_years = 3                                   │
│           projects = ["E-commerce API", "ML recommendation"]     │
│                                                                  │
│  Step 2: parse_job_requirements                                  │
│  Extract: required_skills = ["Python", "REST APIs", "Docker"]    │
│           nice_to_have = ["Kubernetes", "GraphQL"]               │
│                                                                  │
│  Step 3: generate_technical_questions  (5 questions)             │
│  Based on candidate's actual skills:                             │
│  Q1: "Explain how Django ORM handles database migrations."       │
│  Q2: "How did you optimize PostgreSQL queries in your project?"  │
│  Q3: "What's the difference between REST and GraphQL?"           │
│  ... (difficulty: easy → medium → hard)                          │
│                                                                  │
│  Step 4: generate_behavioral_questions  (3 questions)            │
│  Based on their experience:                                      │
│  Q6: "Tell me about a time you had to debug a production issue." │
│  Q7: "How do you handle tight deadlines on team projects?"       │
│                                                                  │
│  Step 5: generate_scenario_questions  (2 questions)              │
│  Based on job requirements:                                      │
│  Q9: "You're asked to scale our API to 1M requests/day. How?"   │
│  Q10: "A Docker container keeps crashing in production. Steps?"  │
│                                                                  │
│  Step 6: adapt_from_previous_answers                             │
│  (If re-interview or follow-up: reads prior Q&A from MongoDB     │
│   and adjusts questions so they don't overlap)                   │
│                                                                  │
│  Step 7: store_questions                                         │
│  Saves all 10 questions to MongoDB questions collection          │
│  Each question has: text, category, difficulty, expected_keywords│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**File:** `backend/langgraph_agents/question_generator_agent.py`

---

## 8. Feature 7 — Post-Interview Analytics

### What happens after the interview ends

```
Interview completes
    ↓
_finalize_results() in interview_orchestrator.py triggers analytics
    ↓
POST /api/analytics/analyze
    ↓
PostInterviewAnalyticsAgent starts  (analytics_agent.py)
```

### Inside PostInterviewAnalyticsAgent — 7 steps

```
┌─────────────────────────────────────────────────────────────────┐
│              PostInterviewAnalyticsAgent Workflow                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: fetch_transcript                                        │
│  Read all Q+A pairs from qa_sessions collection                  │
│  Reconstruct full interview transcript                           │
│                                                                  │
│  Step 2: analyze_with_llm                                        │
│  Send full transcript to Groq LLaMA 3.3 70b:                    │
│    "Analyze this interview transcript and identify:              │
│     - Key strengths shown by the candidate                       │
│     - Weaknesses or gaps                                         │
│     - Summary in 3-4 sentences"                                  │
│                                                                  │
│  Step 3: calculate_coherence_score                               │
│  Do answers logically follow the questions?                      │
│  Do they stay on-topic?                                          │
│  Score: 0-10                                                     │
│                                                                  │
│  Step 4: assess_technical_depth                                  │
│  Are technical terms used correctly?                             │
│  Do answers show depth vs surface-level knowledge?              │
│  Score: 0-10                                                     │
│                                                                  │
│  Step 5: evaluate_communication_clarity                          │
│  Is the language clear and structured?                           │
│  Are answers concise or rambling?                                │
│  Score: 0-10                                                     │
│                                                                  │
│  Step 6: compute_overall_score                                   │
│  overall = (coherence × 0.3) + (technical × 0.4)                │
│           + (communication × 0.3)                                │
│  Generates: HIRE / MAYBE / REJECT recommendation                 │
│                                                                  │
│  Step 7: save_report                                             │
│  Saves full report to interview_results collection:              │
│    · overall_score                                               │
│    · technical_score                                             │
│    · communication_score                                         │
│    · coherence_score                                             │
│    · strengths: ["Strong Python knowledge", "Clear communicator"]│
│    · weaknesses: ["Lacks Docker hands-on experience"]            │
│    · recommendation: "HIRE"                                      │
│    · full_transcript                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

HR opens the dashboard → sees the full report → makes hiring decision.

**File:** `backend/langgraph_agents/analytics_agent.py`

---

## 9. Feature 8 — Resume Improvement

### How a candidate can improve their resume for a role

```
Candidate uploads their resume + target job description
    ↓
POST /api/improve-resume
    ↓
ResumeImprovementAgent starts  (resume_improvement_agent.py)
```

### Inside ResumeImprovementAgent — 3 steps

```
┌─────────────────────────────────────────────────────────────────┐
│               ResumeImprovementAgent Workflow                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: analyze_resume                                          │
│  LLM reads current resume                                        │
│  Identifies: current_strengths, current_weaknesses               │
│    e.g., "Strong Python projects but no Docker mention"          │
│                                                                  │
│  Step 2: identify_gaps                                           │
│  Compare resume vs job requirements                              │
│  Gaps found:                                                     │
│    · "Docker" in JD but not in resume                            │
│    · "CI/CD pipelines" mentioned in JD but absent               │
│    · "Team leadership" required but no examples given            │
│                                                                  │
│  Step 3: generate_suggestions                                    │
│  For each gap, LLM writes a specific suggestion:                 │
│    "Add a bullet: 'Containerized Django app using Docker,         │
│     reducing deployment time by 40%'"                            │
│    "Add: 'Set up GitHub Actions CI/CD pipeline for automated     │
│     testing on every pull request'"                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

For a full rewrite: `ImprovedResumeAgent` (improved_resume_agent.py) rewrites entire resume sections to match the job requirements.

**Files:** `backend/langgraph_agents/resume_improvement_agent.py`, `improved_resume_agent.py`

---

## 10. Feature 9 — ML Predictions

### Two predictions available

```
Input: candidate's experience, education, skills, job level
    ↓
POST /api/ml/predict
    ↓
MLPredictionAgent  (ml_prediction_agent.py)
```

### Inside MLPredictionAgent — 4 steps

```
┌─────────────────────────────────────────────────────────────────┐
│                  MLPredictionAgent Workflow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: preprocess_input                                        │
│  Encode categorical features (education, industry, location)     │
│  into numerical features that XGBoost can process                │
│                                                                  │
│  Step 2: select_model                                            │
│  Based on prediction_type:                                       │
│    · "salary"          → xgboost_basic.pkl or xgboost_text.pkl   │
│    · "job_possibility" → job_possibility_model.pkl               │
│                                                                  │
│  Step 3: make_prediction                                         │
│  Load .pkl model file from backend/models/                       │
│  XGBoost model.predict(features)                                 │
│    · Salary prediction: $95,000                                  │
│    · Job possibility: 78% chance of getting hired                │
│                                                                  │
│  Step 4: calculate_confidence                                    │
│  Compute confidence interval around prediction                   │
│  Return: prediction + confidence + feature_importance            │
│    (which features mattered most: years_exp vs education etc.)   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**File:** `backend/langgraph_agents/ml_prediction_agent.py`  
**Models:** `backend/models/*.pkl` — pre-trained XGBoost models

---

## 11. Feature 10 — Real-time Dashboard

### What HR sees on the dashboard (live)

```
HR opens Dashboard page
    ↓
Frontend connects via WebSocket: ws://localhost:8001/ws/dashboard
    ↓
DashboardService  (dashboard_service.py) streams metrics every few seconds:

┌────────────────────────────────────────────────────────────┐
│                   Live Dashboard Metrics                    │
├──────────────────────────┬─────────────────────────────────┤
│  Active Sessions         │  2 interviews running right now  │
│  STT Latency             │  1.2s average (Groq Whisper)    │
│  LLM Processing Time     │  0.8s average (Groq LLaMA)      │
│  TTS Latency             │  0.4s average (Deepgram)        │
│  Success Rate            │  94% (last 24 hours)            │
│  Retry Count             │  3 retries in last hour          │
│  Overall Quality Score   │  8.2 / 10 average               │
└──────────────────────────┴─────────────────────────────────┘
```

### How it works internally

```
DashboardService.get_metrics()
    ↓
Motor (async MongoDB driver) queries orchestration_sessions collection
    ↓
Calculate averages from sessions in last 24 hours
    ↓
Push JSON metrics through WebSocket to all connected HR browsers
    ↓
Frontend React component re-renders with live numbers
```

**File:** `backend/dashboard_service.py`  
**Why Motor?** Motor is the async MongoDB driver. Since FastAPI is async, using PyMongo (sync) would block the event loop. Motor queries don't block — other requests can be handled while DB query runs.

---

## 12. Feature 11 — Resume Q&A Chatbot

### HR can ask questions about a candidate's resume

```
HR clicks on John Smith's resume
    ↓
Types: "Does he have experience with microservices?"
    ↓
POST /api/resume-qa
    { resume_id: "...", question: "Does he have experience with microservices?" }
    ↓
QAAgent  (qa_agent.py)
    ↓
Reads John's full resume from MongoDB
    ↓
MCPContextManager maintains conversation history:
    [Previous Q: "What frameworks does he know?" A: "Django, FastAPI"]
    [Current Q: "Does he have microservices experience?"]
    ↓
Groq LLaMA 3.3 70b answers based on resume content:
    "Yes — John's resume mentions he 'built a microservices architecture
     for an e-commerce platform using FastAPI and Docker, handling
     100K daily requests.' He has 2 years of hands-on experience."
    ↓
Answer shown to HR in the chatbot UI
    ↓
HR can ask follow-up questions — context is preserved
```

**File:** `backend/langgraph_agents/qa_agent.py`

---

## 13. LangGraph — Why and How

Every "agent" in this project is a **LangGraph StateGraph** — a state machine where each node is a Python function.

### Why not just write one big function?

```
❌ Old approach (one big function):

def analyze_resume(resume_text):
    step1_result = call_llm_for_extraction(resume_text)    # if this fails →
    step2_result = match_requirements(step1_result)         # whole function crashes
    step3_result = calculate_scores(step2_result)
    return step3_result

Problems:
· If step 1 fails → start over from beginning
· Can't retry just the failed step
· No visibility into which step failed
· Can't add conditional logic between steps
```

```
✅ LangGraph approach (state machine):

State flows through nodes:
    extract_data → match_requirements → calculate_scores → recommendations

Each node:
· Receives the full State dict
· Does its job
· Updates the State
· Passes to the next node

If a node raises an exception:
· Error edge fires → error handler node runs
· Logs which step failed and why
· Can retry just that node
· Graceful failure with partial results saved
```

### What a State looks like

```python
class AnalysisState(TypedDict):
    # Input (set at start)
    resume_text: str
    job_description: str

    # Set by Step 1
    structured_data: Dict       # { skills, experience, education }

    # Set by Step 2
    skill_matches: List[str]
    missing_skills: List[str]

    # Set by Step 3
    match_score: int            # 0-100
    strengths: List[str]

    # Set by Step 4
    recommendations: List[str]

    # Error tracking
    errors: List[str]
    success: bool
```

### All 14 LangGraph Agents

| Agent | File | Triggered When |
|-------|------|---------------|
| `ResumeAnalysisAgent` | `resume_analysis_agent.py` | HR uploads a resume |
| `QuestionGeneratorAgent` | `question_generator_agent.py` | Interview is scheduled |
| `InterviewSchedulingAgent` | `interview_scheduling_agent.py` | HR clicks "Schedule Interview" |
| `TTSAgent` | `tts_agent.py` | Bot needs to speak a question |
| `AudioTranscriptionAgent` | `audio_transcription_agent.py` | Candidate finishes speaking |
| `InterviewConductorAgent` | `interview_conductor_agent.py` | Each individual Q&A turn |
| `InterviewOrchestratorAgent` | `interview_orchestrator_agent.py` | Full interview session |
| `RealtimeOrchestratorAgent` | `realtime_orchestrator_agent.py` | Live audio stream arrives |
| `DistributedOrchestratorAgent` | `distributed_orchestrator_agent.py` | Multiple sessions running |
| `PostInterviewAnalyticsAgent` | `analytics_agent.py` | Interview finishes |
| `MLPredictionAgent` | `ml_prediction_agent.py` | Salary/hire prediction request |
| `MeetBotAgent` | `meet_bot_agent.py` | Bot lifecycle events |
| `ResumeImprovementAgent` | `resume_improvement_agent.py` | Improvement request |
| `QAAgent` | `qa_agent.py` | HR asks resume chatbot question |

---

## 14. MCP Layer — Context and Cache

**Directory:** `backend/mcp/`

Four tools that make LLM calls faster and cheaper.

### MCPContextManager — Prevents token overflow in long interviews

```
Interview has 10 questions. Each Q&A is ~500 tokens.
After question 10 → 5000 tokens of history. LLM limit hit.

Without MCPContextManager:
    Send all 5000 tokens every time → expensive, hits limit

With MCPContextManager (context_manager.py):
    Keep last 3 turns verbatim
    Compress turns 1-7 into 1 short summary paragraph
    Always under the token limit ✅

Token savings: 40-60% on long interviews
```

### MCPCacheManager — Avoids duplicate LLM calls

```
HR uploads John Smith's resume → analyzed with LLM → result stored

HR uploads same resume again (different job same week):
    Without cache: LLM called again → costs money, takes 3 seconds
    With cache (cache_manager.py):
        Cache key = SHA256(resume_text + job_id)
        Cache hit → return instantly from memory → 0ms, $0.00

Cache TTL:
    Resume analysis: 1 hour
    Question sets: 24 hours
```

### TokenOptimizer — Trims input before LLM call

```
Resume has 8000 words of irrelevant formatting and whitespace
TokenOptimizer (token_optimizer.py):
    Strip redundant whitespace
    Truncate sections over input limit
    Result: 8000 tokens → 4500 tokens → 44% cheaper API call
```

### RedisStreamManager — Routes sessions across workers

```
4 Uvicorn workers running simultaneously
Each interview session has its own Redis Stream
Workers read from streams → process → acknowledge
Detailed in next section ↓
```

---

## 15. Redis Distributed Scaling

### The problem with multiple workers

```
Worker 1: Handles "start interview" for Session A → stores state in memory
Worker 2: Gets next request for Session A → no state in Worker 2's memory
Session A: ❌ broken
```

### The Redis Streams solution

```
┌──────────┐   XADD stream:session_A * audio_chunk {data}   ┌────────────┐
│ Client   │ ──────────────────────────────────────────────► │   Redis    │
└──────────┘                                                  │   Stream   │
                                                              └─────┬──────┘
              XREADGROUP GROUP workers worker_1 COUNT 1             │
┌──────────┐ ◄──────────────────────────────────────────────────────┘
│ Worker 1 │ processes audio → transcribes → sends result back
└──────────┘

If Worker 1 crashes:
    Message stays unacknowledged in Pending Entry List (PEL)
    Worker 2 claims it via XAUTOCLAIM after timeout
    Interview continues without data loss ✅
```

**File:** `backend/mcp/redis_stream_manager.py`

---

## 16. MongoDB Collections

**Database:** `resumate` on MongoDB Atlas

| Collection | What's in it | Key fields |
|-----------|-------------|-----------|
| `resumes` | Uploaded resumes + analysis results | `candidate_id`, `raw_text`, `match_percentage`, `skills`, `created_at` |
| `interviews` | Scheduled interviews | `interview_id`, `meet_link`, `auto_join_token`, `status`, `candidate_email` |
| `questions` | Generated questions per interview | `interview_id`, `question_text`, `category`, `difficulty`, `expected_keywords` |
| `qa_sessions` | Live Q&A during interview | `interview_id`, `question`, `answer`, `transcript`, `score`, `timestamp` |
| `interview_results` | Post-interview analytics report | `interview_id`, `overall_score`, `strengths`, `weaknesses`, `recommendation` |
| `users` | HR and candidate accounts | `email`, `role`, `firebase_uid` |
| `orchestration_sessions` | Live session tracking for dashboard | `session_id`, `worker_id`, `latency_metrics`, `active` |

All DB access goes through repository classes — never raw queries in business logic:

```
backend/repositories/
    interview_repository.py    ← CRUD for interviews
    question_repository.py     ← CRUD for questions
    qa_repository.py           ← CRUD for qa_sessions
    meet_session_repository.py ← CRUD for orchestration_sessions
```

---

## 17. Frontend Pages

**Built with:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui  
**Auth:** Firebase Authentication

```
src/pages/
    Index.tsx     → Home page: HR portal + Candidate portal entry points

src/components/
    Chatbot/      → Resume Q&A chatbot UI (talks to /api/resume-qa)
    ui/           → shadcn/ui components: Button, Card, Dialog, Toast, etc.
```

### Firebase Auth Flow

```
HR opens the app → clicks "Login"
    ↓
Firebase Auth SDK (client-side) handles login
    ↓
Returns Firebase JWT (ID token)
    ↓
Every API request: Authorization: Bearer {firebase_jwt}
    ↓
FastAPI backend validates JWT signature with Firebase public keys
    ↓
Valid → request proceeds | Invalid → 401 Unauthorized
```

---

## 18. API Reference

**Base URL:** `http://localhost:8001`

### Resume

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/analyze-resume` | POST | Analyze one resume against a job role |
| `/api/rank-resumes` | POST | Rank multiple resumes for one role |
| `/api/improve-resume` | POST | Get improvement suggestions |
| `/api/resume-qa` | POST | Ask chatbot questions about a resume |

### Interview

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/schedule-interview` | POST | Schedule + Google Calendar + email |
| `/api/generate-questions` | POST | Generate questions for an interview |
| `/api/interview/{id}/status` | GET | Check interview status |
| `/api/analytics/analyze` | POST | Run post-interview analytics |
| `/api/interview/{id}/report` | GET | Get full analytics report |

### Meet Bot

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/meet/trigger/{id}` | GET | Candidate clicks join → bot starts |
| `/api/meet/start-session` | POST | Manually start bot for a meeting URL |
| `/api/meet/stop-session` | POST | Stop an active bot session |
| `/api/meet/session/{id}/status` | GET | Session status and latency metrics |

### STT / TTS

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/stt/transcribe` | POST | Transcribe an audio file |
| `/api/stt/transcribe-chunk` | POST | Transcribe a single base64 audio chunk |

### Dashboard

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/ws/dashboard` | WebSocket | Live metrics stream for HR dashboard |
| `/api/dashboard/metrics` | GET | Snapshot of current metrics |

---

## 19. Installation & Setup

### Prerequisites

- Python 3.11
- Node.js 18+
- A Google account for the bot (dedicated, not personal) — 2FA off or app password set
- MongoDB Atlas account (free tier works)
- Groq API key (free at console.groq.com)
- Deepgram API key (free at deepgram.com)

### Step 1 — Clone and create Python environment

```bash
git clone https://github.com/vaibhavnarute/recruit.git
cd recruit

python -m venv venv311
# Windows:
venv311\Scripts\activate
# macOS/Linux:
source venv311/bin/activate
```

### Step 2 — Install Python dependencies

```bash
pip install -r requirements-py311.txt
pip install -r backend/requirements.txt
```

### Step 3 — Install Playwright (browser automation)

```bash
playwright install chromium
```

### Step 4 — Install frontend dependencies

```bash
npm install
```

### Step 5 — Configure environment

```bash
cp backend/.env.template backend/.env
# Edit backend/.env and fill in all API keys and credentials
```

### Step 6 — Set up MongoDB collections

```bash
cd backend
python setup_mongodb.py
```

### Step 7 — Set up Google Calendar credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials → OAuth 2.0 → Download JSON
3. Save as `backend/google_credentials.json`
4. Run `python backend/reauth_google.py` → opens browser → log in → `google_token.json` auto-created

### Step 8 — First-time bot login (one-time only)

```bash
cd backend
python meet_bot_launcher.py
```

A browser opens. Log in to `airecruiterbot@gmail.com` manually.  
Session saved to `backend/meet_bot_sessions/` — no login needed again for ~14 days.

---

## 20. Environment Variables

Create `backend/.env`:

```env
# ── Groq (LLM + STT) ────────────────────────────────────────
GROQ_API_KEY=gsk_...
API_KEY_ANALYSIS=gsk_...       # ResumeAnalysisAgent
API_KEY_QA=gsk_...             # QAAgent (chatbot)
API_KEY_QUESTIONS=gsk_...      # QuestionGeneratorAgent
API_KEY_IMPROVEMENT=gsk_...    # ResumeImprovementAgent
API_KEY_IMPROVED_RESUME=gsk_...

# ── MongoDB Atlas ────────────────────────────────────────────
MONGO_URI=mongo_url
MONGODB_URI=mongo_url
MONGODB_ATLAS_URI=mongo_url
MONGO_DB_NAME=resumate

# ── Google Meet Bot ──────────────────────────────────────────
MEET_BOT_EMAIL=yourbot@gmail.com
MEET_BOT_PASSWORD=BotPassword123

# ── Deepgram TTS ─────────────────────────────────────────────
DEEPGRAM_API_KEY=your_deepgram_key

# ── Firebase (Frontend Auth) ─────────────────────────────────
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=yourapp.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=yourapp
VITE_FIREBASE_STORAGE_BUCKET=yourapp.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# ── Email / SMTP ─────────────────────────────────────────────
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SENDER_EMAIL=your@gmail.com

# ── Redis Cloud ───────────────────────────────────────────────
REDIS_HOST=redis-xxxxx.cloud.redislabs.com
REDIS_PORT=18020
REDIS_PASSWORD=your_redis_password
REDIS_USERNAME=default

# ── Google Calendar ───────────────────────────────────────────
GOOGLE_CREDENTIALS_PATH=google_credentials.json

# ── Security ─────────────────────────────────────────────────
JWT_SECRET_KEY=your-long-random-secret-key
DASHBOARD_SECRET=your-dashboard-secret
BACKEND_URL=http://localhost:8001

# ── Limits ───────────────────────────────────────────────────
MAX_SESSION_MEMORY_MB=100
MAX_TOTAL_MEMORY_MB=1000
MAX_ACTIVE_SESSIONS=50
```

---

## 21. Project Structure

```
recruit/
│
├── backend/
│   │
│   ├── main.py                           ← FastAPI app (all API routes)
│   ├── interview_orchestrator.py         ← Full interview lifecycle
│   ├── meet_bot_launcher.py              ← Browser, login, WebRTC intercept
│   ├── meet_bot_joiner.py                ← Join meeting, auto-admit loop
│   ├── meet_audio_integration.py         ← TTS playback + STT recording
│   ├── dashboard_service.py              ← Real-time metrics WebSocket
│   ├── langgraph_integration.py          ← Initializes all agents at startup
│   ├── logging_config.py                 ← Structured logging
│   │
│   ├── langgraph_agents/
│   │   ├── resume_analysis_agent.py      ← 4-step resume scoring
│   │   ├── question_generator_agent.py   ← Adaptive question generation
│   │   ├── interview_scheduling_agent.py ← Schedule + Meet + email
│   │   ├── tts_agent.py                  ← Deepgram TTS (bot speaks)
│   │   ├── audio_transcription_agent.py  ← Groq Whisper STT (bot listens)
│   │   ├── analytics_agent.py            ← Post-interview scoring
│   │   ├── qa_agent.py                   ← Resume chatbot
│   │   ├── resume_improvement_agent.py   ← Gap analysis
│   │   ├── improved_resume_agent.py      ← Full resume rewrite
│   │   ├── ml_prediction_agent.py        ← Salary + hire probability
│   │   ├── distributed_orchestrator_agent.py ← Multi-session Redis routing
│   │   ├── realtime_orchestrator_agent.py    ← Live audio stream
│   │   ├── interview_conductor_agent.py      ← Single Q&A turn
│   │   └── meet_bot_agent.py                 ← Bot lifecycle
│   │
│   ├── mcp/
│   │   ├── context_manager.py            ← Sliding window context compression
│   │   ├── cache_manager.py              ← LLM response cache
│   │   ├── token_optimizer.py            ← Token usage trimmer
│   │   └── redis_stream_manager.py       ← Redis Streams wrapper
│   │
│   ├── repositories/                     ← MongoDB data access
│   │   ├── interview_repository.py
│   │   ├── question_repository.py
│   │   ├── qa_repository.py
│   │   └── meet_session_repository.py
│   │
│   ├── services/                         ← External service clients
│   │   ├── google_calendar_service.py    ← Google Calendar API
│   │   └── email_service.py              ← SMTP email
│   │
│   ├── db/
│   │   ├── mongo_client.py               ← MongoDB connection pool
│   │   └── models.py                     ← Collection name constants
│   │
│   ├── models/                           ← Pre-trained XGBoost .pkl files
│   │
│   ├── meet_bot_sessions/                ← Saved bot browser cookies (gitignored)
│   │   └── airecruiterbot_at_gmail.com/
│   │       ├── session.json
│   │       └── metadata.json
│   │
│   ├── test_complete_meet_interview.py   ← End-to-end interview test
│   ├── requirements.txt
│   └── .env                              ← All secrets (gitignored)
│
├── src/                                  ← React/TypeScript frontend
│   ├── App.tsx                           ← Routing
│   ├── pages/
│   │   ├── Index.tsx                     ← Landing page
│   │   └── NotFound.tsx                  ← 404
│   ├── components/
│   │   ├── Chatbot/                      ← Resume Q&A chatbot UI
│   │   └── ui/                           ← shadcn/ui components
│   ├── services/                         ← API call functions
│   ├── hooks/                            ← Custom React hooks
│   └── types/                            ← TypeScript types
│
├── public/                               ← Static assets
├── vite.config.ts
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## Running the System

### Start Backend (4 workers)

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4

# Or use the included script:
.\start_4_workers.ps1
```

### Start Frontend

```bash
npm run dev
# Opens at http://localhost:5173
```

### Run a Full Interview Test (end-to-end)

```bash
cd backend
python test_complete_meet_interview.py
```

This will:
1. Create a Google Meet as bot host
2. Print the meeting URL
3. You join the meeting from another browser
4. Bot admits you automatically
5. Bot interviews you with voice questions
6. Results saved to MongoDB


