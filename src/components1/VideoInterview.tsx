import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { 
  Bot, 
  User, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  Award, 
  RotateCcw,
  Briefcase,
  Clock,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { interviewService, AnswerEvaluation } from "@/services/interviewService";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
    __simulateVoiceTranscript?: (text: string) => void;
  }
}

interface VideoInterviewProps {
  roomid?: boolean;
  isRoom?: boolean;
}

interface MessageItem {
  role: 'ai' | 'candidate';
  content: string;
  stage?: string;
  questionNumber?: number;
  evaluation?: AnswerEvaluation;
}

const VideoInterview: React.FC<VideoInterviewProps> = () => {
  const { roomid: urlRoomid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as {
    candidateName?: string;
    candidateEmail?: string;
    jobTitle?: string;
    skills?: string[];
    candidateResume?: string;
    jobDescription?: string;
  } | null;

  // Setup state pre-populated from screening hand-off (or empty if not available)
  const [candidateName, setCandidateName] = useState<string>(
    locationState?.candidateName ?? (urlRoomid ? decodeURIComponent(urlRoomid) : "")
  );
  const [candidateEmail, setCandidateEmail] = useState<string>(
    locationState?.candidateEmail ?? ""
  );
  const [jobTitle, setJobTitle] = useState<string>(
    locationState?.jobTitle ?? ""
  );
  const [candidateSkills, setCandidateSkills] = useState<string[]>(
    locationState?.skills ?? []
  );
  const [candidateResume, setCandidateResume] = useState<string>(
    locationState?.candidateResume ?? ""
  );
  const [jobDescription, setJobDescription] = useState<string>(
    locationState?.jobDescription ?? ""
  );
  
  // Interview runtime state
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewId, setInterviewId] = useState<string>("");
  const [currentStage, setCurrentStage] = useState<string>("intro");
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questionNumber, setQuestionNumber] = useState<number>(0);
  const [answerText, setAnswerText] = useState<string>("");
  
  // Feedback and completion state
  const [lastEvaluation, setLastEvaluation] = useState<AnswerEvaluation | null>(null);
  const [conversationHistory, setConversationHistory] = useState<MessageItem[]>([]);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [closingMessage, setClosingMessage] = useState<string>("");
  const [finalScore, setFinalScore] = useState<number>(0);

  // Status & Error state
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice Interaction state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean>(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const textBeforeSpeechRef = useRef<string>("");

  // Webcam state
  type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'off';
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
    }

    // Expose test helper for automated test environments
    window.__simulateVoiceTranscript = (text: string) => {
      setAnswerText((prev) => (prev.trim() ? `${prev.trim()} ${text.trim()}` : text.trim()));
    };

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      delete window.__simulateVoiceTranscript;
    };
  }, []);

  // Webcam helpers
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unavailable');
      setCameraError('Camera not supported in this browser.');
      return;
    }
    setCameraStatus('requesting');
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus('active');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraStatus('unavailable');
        setCameraError('No camera detected. Please connect a webcam to continue.');
      } else {
        setCameraStatus('unavailable');
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus('off');
    setCameraError(null);
  }, []);

  // Start camera when interview begins
  useEffect(() => {
    if (interviewStarted) {
      startCamera();
    }
  }, [interviewStarted, startCamera]);

  // Stop all camera tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setVoiceError("Speech recognition is not supported in this browser. Please type your answer.");
      return;
    }

    setVoiceError(null);
    textBeforeSpeechRef.current = answerText;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        const base = textBeforeSpeechRef.current.trim();
        const combined = base ? `${base} ${currentTranscript.trim()}` : currentTranscript.trim();
        setAnswerText(combined);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition event error:", event.error);
        if (event.error === "not-allowed") {
          setVoiceError("Microphone permission denied. Please allow microphone access in your browser to speak.");
        } else if (event.error === "no-speech") {
          setVoiceError("No speech detected. Please try speaking again.");
        } else if (event.error === "audio-capture") {
          setVoiceError("No microphone detected. Please connect a microphone or type your answer.");
        } else if (event.error === "network") {
          setVoiceError("Speech recognition network error. You can continue typing your answer.");
        } else {
          setVoiceError(`Voice input issue: ${event.error}. You can continue typing.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setVoiceError("Could not start microphone. Please check your browser settings or type your answer.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Handle Start Interview
  const handleStartInterview = async () => {
    const nameToUse = candidateName.trim() || "Candidate";
    setIsStarting(true);
    setError(null);

    try {
      const response = await interviewService.startInterview({
        candidate_name: nameToUse,
        candidate_email: candidateEmail.trim(),
        job_title: jobTitle.trim(),
        job_description: jobDescription.trim(),
        required_skills: candidateSkills,
        candidate_resume: candidateResume.trim(),
        target_duration_minutes: 30
      });

      if (response.success && response.data) {
        setInterviewId(response.data.interview_id);
        setCurrentStage(response.data.current_stage || "intro");
        setCurrentQuestion(response.data.introduction);
        setQuestionNumber(0);
        setInterviewStarted(true);

        // Record initial AI message in conversation history
        setConversationHistory([
          {
            role: 'ai',
            content: response.data.introduction,
            stage: response.data.current_stage || 'intro',
            questionNumber: 0
          }
        ]);
      } else {
        setError(response.message || response.error?.message || "Failed to start interview session.");
      }
    } catch (err: any) {
      console.error("Error starting interview:", err);
      setError(err.message || "Could not connect to FastAPI interview service (Port 8001). Please ensure the backend is running.");
    } finally {
      setIsStarting(false);
    }
  };

  // Handle Submit Answer
  const handleSubmitAnswer = async () => {
    if (isListening) {
      stopListening();
    }
    if (!answerText.trim() || !interviewId || isSubmitting) return;

    const submittedAnswer = answerText.trim();
    setIsSubmitting(true);
    setError(null);

    // Optimistically add candidate response to history
    const updatedHistory: MessageItem[] = [
      ...conversationHistory,
      {
        role: 'candidate',
        content: submittedAnswer,
        stage: currentStage,
        questionNumber: questionNumber
      }
    ];
    setConversationHistory(updatedHistory);

    try {
      const response = await interviewService.submitAnswer({
        interview_id: interviewId,
        answer: submittedAnswer
      });

      if (response.success && response.data) {
        const data = response.data;

        if (data.interview_complete) {
          setInterviewComplete(true);
          setClosingMessage(data.closing_message || "Thank you for completing the interview!");
          setFinalScore(data.overall_score || 0);
          if (data.evaluation) {
            setLastEvaluation(data.evaluation);
          }
        } else {
          // Update for next question
          const nextQ = data.next_question || "";
          const nextStage = data.current_stage || currentStage;
          const nextNum = data.question_number || questionNumber + 1;

          setCurrentQuestion(nextQ);
          setCurrentStage(nextStage);
          setQuestionNumber(nextNum);
          setLastEvaluation(data.evaluation || null);
          setAnswerText("");

          // Add AI next question to history
          if (nextQ) {
            setConversationHistory([
              ...updatedHistory,
              {
                role: 'ai',
                content: nextQ,
                stage: nextStage,
                questionNumber: nextNum,
                evaluation: data.evaluation
              }
            ]);
          }
        }
      } else {
        setError(response.message || response.error?.message || "Failed to process candidate answer.");
      }
    } catch (err: any) {
      console.error("Error submitting answer:", err);
      setError(err.message || "Failed to submit answer to FastAPI backend (Port 8001).");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    setInterviewStarted(false);
    setInterviewId("");
    setCurrentStage("intro");
    setCurrentQuestion("");
    setQuestionNumber(0);
    setAnswerText("");
    setLastEvaluation(null);
    setConversationHistory([]);
    setInterviewComplete(false);
    setClosingMessage("");
    setFinalScore(0);
    setError(null);
  };

  // 1. SETUP VIEW (Before interview starts)
  if (!interviewStarted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-xl shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-md mb-3">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              AI Interview Room
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Interactive AI interview powered by Groq and LangGraph
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-300 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Connection Error</p>
                  <p className="text-xs mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-cyan-600" /> Candidate Name
              </label>
              <Input
                placeholder="Enter your full name"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                disabled={isStarting}
                className="focus-visible:ring-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-cyan-600" /> Job Role / Position
              </label>
              <Input
                placeholder="e.g. Full Stack Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                disabled={isStarting}
                className="focus-visible:ring-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-600" /> Candidate Email
              </label>
              <Input
                type="email"
                placeholder="candidate@example.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                disabled={isStarting}
                className="focus-visible:ring-cyan-500"
              />
            </div>

            {candidateSkills.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-600" /> Parsed Candidate Skills
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
                  {candidateSkills.map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {candidateResume && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resume text pre-loaded from candidate screening
              </div>
            )}

            <div className="pt-3">
              <Button
                onClick={handleStartInterview}
                disabled={isStarting || !candidateName.trim()}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium py-2.5 rounded-lg shadow transition-all duration-150 flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initializing AI Interviewer...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Start AI Interview
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Connected to FastAPI backend at port 8001
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. COMPLETION VIEW
  if (interviewComplete) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg mb-3">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Interview Completed
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Great job, {candidateName}! Your responses have been evaluated by AI.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Overall Score
                </span>
              </div>
              <div className="text-4xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {finalScore.toFixed(0)} <span className="text-lg font-normal text-emerald-600/80">/ 100</span>
              </div>
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Closing Remarks:</p>
              <p>{closingMessage}</p>
            </div>

            {lastEvaluation && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lastEvaluation.strengths && lastEvaluation.strengths.length > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
                    <p className="font-semibold text-blue-900 dark:text-blue-300 text-xs uppercase tracking-wide mb-2">
                      Key Strengths
                    </p>
                    <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                      {lastEvaluation.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {lastEvaluation.weaknesses && lastEvaluation.weaknesses.length > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl">
                    <p className="font-semibold text-amber-900 dark:text-amber-300 text-xs uppercase tracking-wide mb-2">
                      Areas to Strengthen
                    </p>
                    <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                      {lastEvaluation.weaknesses.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleRestart}
                variant="outline"
                className="flex-1 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Restart New Interview
              </Button>
              <Button
                onClick={() => navigate('/')}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. ACTIVE INTERVIEW ROOM VIEW
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        
        {/* Top Navigation & Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  AI Interview Session
                </h1>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Candidate: <span className="font-medium text-slate-700 dark:text-slate-300">{candidateName}</span> • Role: <span className="font-medium text-slate-700 dark:text-slate-300">{jobTitle}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="uppercase font-semibold tracking-wider text-xs px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
              Stage: {currentStage}
            </Badge>
            <Badge variant="secondary" className="text-xs px-2.5 py-1">
              {questionNumber === 0 ? "Introduction" : `Question #${questionNumber}`}
            </Badge>
          </div>
        </div>

        {/* Webcam Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Camera className="w-4 h-4 text-cyan-600" />
              <span>Your Camera</span>
              {cameraStatus === 'active' && (
                <span className="flex h-2 w-2 relative ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <Button
              id="camera-toggle-btn"
              type="button"
              size="sm"
              variant="outline"
              onClick={cameraStatus === 'active' ? stopCamera : startCamera}
              disabled={cameraStatus === 'requesting'}
              className={`text-xs h-7 px-3 flex items-center gap-1.5 transition-all ${
                cameraStatus === 'active'
                  ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-600'
              }`}
            >
              {cameraStatus === 'requesting' ? (
                <><Loader2 className="w-3 h-3 animate-spin" /><span>Requesting...</span></>
              ) : cameraStatus === 'active' ? (
                <><VideoOff className="w-3 h-3" /><span>Turn Off Camera</span></>
              ) : (
                <><Video className="w-3 h-3" /><span>Turn On Camera</span></>
              )}
            </Button>
          </div>

          <div className="relative bg-slate-950 flex items-center justify-center" style={{ height: '220px' }}>
            {/* Live video element — always rendered so ref is stable */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                cameraStatus === 'active' ? 'block' : 'hidden'
              }`}
            />

            {/* Placeholder shown when camera is not active */}
            {cameraStatus !== 'active' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                {cameraStatus === 'idle' && (
                  <>
                    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
                      <Camera className="w-7 h-7 text-slate-500" />
                    </div>
                    <p className="text-slate-500 text-sm">Initializing camera...</p>
                  </>
                )}
                {cameraStatus === 'requesting' && (
                  <>
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                    <p className="text-slate-400 text-sm">Requesting camera permission...</p>
                  </>
                )}
                {cameraStatus === 'off' && (
                  <>
                    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
                      <VideoOff className="w-7 h-7 text-slate-500" />
                    </div>
                    <p className="text-slate-400 text-sm">Camera is off</p>
                    <button
                      onClick={startCamera}
                      className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Turn camera back on
                    </button>
                  </>
                )}
                {cameraStatus === 'denied' && (
                  <>
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                    <p className="text-amber-400 text-sm font-medium">Camera permission denied</p>
                    <p className="text-slate-500 text-xs">{cameraError}</p>
                  </>
                )}
                {cameraStatus === 'unavailable' && (
                  <>
                    <VideoOff className="w-8 h-8 text-slate-600" />
                    <p className="text-slate-500 text-sm font-medium">Camera unavailable</p>
                    <p className="text-slate-600 text-xs">{cameraError}</p>
                  </>
                )}
              </div>
            )}

            {/* Camera active label overlay */}
            {cameraStatus === 'active' && (
              <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-xs font-medium text-white/80 bg-black/40 px-1.5 py-0.5 rounded">
                  LIVE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start justify-between gap-2 text-red-700 dark:text-red-300 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Request Failed</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setError(null)}
              className="text-xs border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Previous Answer Evaluation Card (if available) */}
        {lastEvaluation && (
          <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                  Previous Answer Evaluation
                </CardTitle>
              </div>
              {lastEvaluation.overall_score !== undefined && (
                <Badge className="bg-blue-600 text-white font-bold text-xs px-2 py-0.5">
                  Score: {lastEvaluation.overall_score}/10
                </Badge>
              )}
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-2 text-xs">
              {lastEvaluation.strengths && lastEvaluation.strengths.length > 0 && (
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Strengths: </span>
                  {lastEvaluation.strengths.join(" • ")}
                </div>
              )}
              {lastEvaluation.weaknesses && lastEvaluation.weaknesses.length > 0 && (
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Feedback: </span>
                  {lastEvaluation.weaknesses.join(" • ")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current Active Question Card */}
        <Card className="shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Bot className="w-5 h-5 text-cyan-600" />
                <span className="font-semibold text-sm">
                  {questionNumber === 0 ? "AI Introduction" : `Technical Question #${questionNumber}`}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {currentStage.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="text-slate-800 dark:text-slate-200 text-base sm:text-lg leading-relaxed whitespace-pre-line font-normal">
              {currentQuestion || "Preparing interview question..."}
            </div>
          </CardContent>
        </Card>

        {/* Candidate Response Textarea Card */}
        <Card className="shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-2 pt-4 px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-600" /> Your Answer
              </label>

              <div className="flex items-center gap-2">
                {/* Voice Control Button */}
                {voiceSupported ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={isListening ? "destructive" : "outline"}
                    onClick={toggleListening}
                    disabled={isSubmitting}
                    id="speak-answer-btn"
                    className={`text-xs h-8 px-3 flex items-center gap-1.5 transition-all ${
                      isListening
                        ? "bg-red-600 hover:bg-red-700 text-white animate-pulse shadow-md"
                        : "border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-slate-700 dark:text-slate-200 hover:text-cyan-600"
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Stop Listening</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        <span>Speak Answer</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">
                    (Voice input unsupported)
                  </span>
                )}

                <span className="text-xs text-slate-400">
                  {answerText.length} characters
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            {/* Listening Live Status Banner */}
            {isListening && (
              <div id="listening-banner" className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-center justify-between gap-3 text-red-700 dark:text-red-300 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span className="font-medium">
                    Listening... Speak your answer. Recognized text is inserted below in real time.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={stopListening}
                  className="h-6 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                >
                  Done Speaking
                </Button>
              </div>
            )}

            {/* Voice Error Banner */}
            {voiceError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-2 text-amber-800 dark:text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{voiceError}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setVoiceError(null)}
                  className="h-6 px-1.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                >
                  Dismiss
                </Button>
              </div>
            )}

            <Textarea
              id="candidate-answer-textarea"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={isSubmitting}
              placeholder={
                isListening
                  ? "Listening to your voice... (you can also edit this text anytime)"
                  : questionNumber === 0
                  ? "Respond to the interviewer (type or click 'Speak Answer' to speak)..."
                  : "Type your detailed answer or click 'Speak Answer' to speak. You can freely edit the text before submitting..."
              }
              rows={5}
              className={`resize-y min-h-[120px] text-sm focus-visible:ring-cyan-500 font-normal leading-relaxed ${
                isListening ? "border-red-400 dark:border-red-600 ring-1 ring-red-400" : ""
              }`}
            />

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400 hidden sm:block">
                Press Submit Answer to send your response to the AI evaluation engine.
              </p>
              <Button
                id="submit-answer-btn"
                onClick={handleSubmitAnswer}
                disabled={isSubmitting || !answerText.trim()}
                className="w-full sm:w-auto ml-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium px-6 py-2.5 rounded-lg shadow flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Evaluating Answer...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Answer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default VideoInterview;