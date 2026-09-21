import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

interface CandidateRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Completed" | "Live Video" | "Pending Review" | "Screened";
  score: number;
  completedAt: string;
  skills: string[];
  resumeText?: string;
  avatarBg?: string;
  initials?: string;
}

const COMMON_TECH_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'FastAPI',
  'Django', 'Flask', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
  'HTML', 'CSS', 'Tailwind', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB',
  'Redis', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git',
  'CI/CD', 'REST', 'GraphQL', 'Machine Learning', 'AI', 'Pandas', 'NumPy'
];

const extractSkillsFromText = (text: string): string[] => {
  if (!text) return [];
  const found: string[] = [];
  for (const skill of COMMON_TECH_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) {
      found.push(skill);
    }
  }
  return found;
};

const INITIAL_CANDIDATES: CandidateRecord[] = [
  {
    id: "cand-1",
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    role: "Machine Learning Engineer",
    status: "Completed",
    score: 82,
    completedAt: "Today, 10:30 AM",
    skills: ["Python", "Machine Learning", "FastAPI", "Docker", "PyTorch"],
    avatarBg: "bg-[#c6e7ff] text-[#001e2d]",
    initials: "AS",
    resumeText: "Aarav Sharma. Senior ML Engineer specializing in LLMs, distributed inference pipelines, and model quantization. 5+ years experience in Python, PyTorch, FastAPI, and Docker."
  },
  {
    id: "cand-2",
    name: "Priya Mehta",
    email: "priya.m@techstudio.dev",
    role: "Frontend Developer",
    status: "Completed",
    score: 91,
    completedAt: "Today, 09:15 AM",
    skills: ["React", "TypeScript", "Tailwind", "Next.js", "GraphQL"],
    avatarBg: "bg-[#9ad6fd] text-[#155e7f]",
    initials: "PM",
    resumeText: "Priya Mehta. Lead Frontend Engineer with deep experience in React, TypeScript, state management, and modern component design systems."
  },
  {
    id: "cand-3",
    name: "Rohan Verma",
    email: "rohan.v@cloudscale.io",
    role: "Backend Engineer",
    status: "Live Video",
    score: 0,
    completedAt: "In Progress (Q4/8)",
    skills: ["Go", "Kubernetes", "PostgreSQL", "Kafka", "REST"],
    avatarBg: "bg-[#e2dfff] text-[#16134a]",
    initials: "RV",
    resumeText: "Rohan Verma. Systems & backend engineer focused on distributed data processing, event-driven pipelines, and cloud-native architecture."
  },
  {
    id: "cand-4",
    name: "Ananya Singh",
    email: "ananya.s@analytics.org",
    role: "Data Analyst",
    status: "Completed",
    score: 76,
    completedAt: "Yesterday",
    skills: ["SQL", "Pandas", "NumPy", "Python", "Tableau"],
    avatarBg: "bg-[#efecfa] text-[#1b1b24]",
    initials: "AS",
    resumeText: "Ananya Singh. Data Analyst with expertise in cohort analysis, predictive data modeling, customer lifetime metrics, and SQL data warehousing."
  },
  {
    id: "cand-5",
    name: "Kabir Malhotra",
    email: "kabir.ml@neural.network",
    role: "Machine Learning Engineer",
    status: "Pending Review",
    score: 88,
    completedAt: "Yesterday",
    skills: ["Python", "TensorFlow", "Kubernetes", "Docker", "REST"],
    avatarBg: "bg-[#81cfff] text-[#001e2d]",
    initials: "KM",
    resumeText: "Kabir Malhotra. Machine Learning Engineer focused on computer vision models, edge inference optimization, and containerized serving architecture."
  }
];

const RecruiterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Candidates & filters state
  const [candidates, setCandidates] = useState<CandidateRecord[]>(INITIAL_CANDIDATES);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("All Roles");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"score" | "name">("score");

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<"overview" | "candidates" | "interviews" | "reports" | "job-roles">("overview");

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCandidateForScorecard, setSelectedCandidateForScorecard] = useState<CandidateRecord | null>(null);

  // Resume Analyzer Modal state
  const [jobTitleInput, setJobTitleInput] = useState("Machine Learning Engineer");
  const [jobDescriptionInput, setJobDescriptionInput] = useState(
    "Senior Machine Learning Engineer with 4+ years experience in Python, PyTorch, Docker, FastAPI, and scalable cloud microservices."
  );
  const [thresholdInput, setThresholdInput] = useState(50);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // KPI Metrics calculated
  const totalCandidates = candidates.length;
  const completedInterviews = candidates.filter(c => c.status === "Completed").length;
  const completedScores = candidates.filter(c => c.status === "Completed" && c.score > 0).map(c => c.score);
  const avgScore = completedScores.length > 0 
    ? (completedScores.reduce((a, b) => a + b, 0) / completedScores.length).toFixed(1) 
    : "78.4";
  const completionRate = totalCandidates > 0 ? ((completedInterviews / totalCandidates) * 100).toFixed(1) : "91.6";

  // Filter candidates
  const filteredCandidates = candidates.filter(cand => {
    const matchesSearch = 
      cand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = selectedRoleFilter === "All Roles" || cand.role === selectedRoleFilter;
    const matchesStatus = selectedStatusFilter === "All" || cand.status === selectedStatusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === "score") {
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name);
  });

  // Candidate interview launch handoff
  const handleLaunchInterview = (candidate: CandidateRecord) => {
    navigate(candidate.name ? `/interview/${encodeURIComponent(candidate.name)}` : "/interview", {
      state: {
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        jobTitle: candidate.role,
        skills: candidate.skills,
        candidateResume: candidate.resumeText || "",
        jobDescription: jobDescriptionInput || ""
      }
    });
  };

  // Handle File Input Selection
  const handleFileDropOrChange = (files: FileList | File[] | null) => {
    if (!files) return;
    const fileArray = Array.from(files).filter(f => f.name.endsWith('.pdf'));
    if (fileArray.length === 0) {
      toast({
        title: "Unsupported File Format",
        description: "Please upload PDF format resume documents.",
        variant: "destructive"
      });
      return;
    }
    setUploadedFiles(prev => [...prev, ...fileArray]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit to Flask /api/analyze API
  const handleRunResumeAnalysis = async () => {
    if (!jobDescriptionInput.trim()) {
      toast({
        title: "Missing Job Description",
        description: "Please enter a target job description for resume screening.",
        variant: "destructive"
      });
      return;
    }

    if (uploadedFiles.length === 0) {
      toast({
        title: "No Resumes Uploaded",
        description: "Please upload at least one PDF resume document.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("job_description", jobDescriptionInput);
      formData.append("threshold", thresholdInput.toString());
      uploadedFiles.forEach(file => {
        formData.append("resume_files", file);
      });

      const res = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Analysis server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        const newRecords: CandidateRecord[] = data.results.map((r: any, idx: number) => {
          const name = r.names?.[0] && r.names[0] !== 'Name not found' ? r.names[0] : `Candidate ${candidates.length + idx + 1}`;
          const email = r.emails?.[0] && r.emails[0] !== 'Email not found' ? r.emails[0] : `candidate${candidates.length + idx + 1}@applicant.net`;
          const skills = extractSkillsFromText(r.text || "");
          const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "CD";

          return {
            id: `cand-upload-${Date.now()}-${idx}`,
            name,
            email,
            role: jobTitleInput.trim() || "Software Engineer",
            status: "Screened",
            score: Math.round(r.similarity || 0),
            completedAt: "Just now",
            skills: skills.length > 0 ? skills : ["Python", "FastAPI"],
            resumeText: r.text || "",
            avatarBg: "bg-[#c6e7ff] text-[#001e2d]",
            initials
          };
        });

        setCandidates(prev => [...newRecords, ...prev]);
        toast({
          title: "Analysis Complete",
          description: `Successfully analyzed and screened ${newRecords.length} candidate(s).`
        });
        setIsUploadModalOpen(false);
        setUploadedFiles([]);
      } else {
        throw new Error(data.error || "Failed to analyze uploaded resumes.");
      }
    } catch (err: any) {
      console.error("Resume analysis error:", err);
      toast({
        title: "Analysis Error",
        description: err.message || "Failed to connect to resume analysis service.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-[#fbf8ff] min-h-screen font-['Chivo',sans-serif] text-[#1b1b24] antialiased">
      {/* ─────────────────────────────────────────────────────────────
          SIDEBAR NAVIGATION (Stitch Spec: 288px fixed left)
      ───────────────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-[#f5f2ff] flex flex-col justify-between z-50 shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-[#bec8d0]/20">
        <div className="flex flex-col flex-1">
          {/* Brand Logo & Header */}
          <div className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#006389] to-[#007dac] text-white flex items-center justify-center shadow-md shadow-[#006389]/20">
              <span className="material-symbols-outlined text-[24px]">psychology</span>
            </div>
            <div className="flex flex-col">
              <span className="font-['Plus_Jakarta_Sans',sans-serif] text-[1.125rem] text-[#1b1b24] tracking-tight font-bold">
                InterviewAI
              </span>
              <span className="text-[0.6875rem] text-[#006389] uppercase tracking-wider font-semibold font-mono">
                RECRUITER WORKSPACE
              </span>
            </div>
          </div>

          <div className="px-3 py-1">
            <div className="h-[1px] w-full bg-[#bec8d0]/30" />
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-3 space-y-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "overview"
                  ? "bg-[#706ea9] text-white font-semibold shadow-sm"
                  : "text-[#3f484f] hover:bg-[#e9e6f4] hover:text-[#1b1b24]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab("candidates")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "candidates"
                  ? "bg-[#706ea9] text-white font-semibold shadow-sm"
                  : "text-[#3f484f] hover:bg-[#e9e6f4] hover:text-[#1b1b24]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span>Candidates</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/20 font-bold">
                {candidates.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("interviews")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "interviews"
                  ? "bg-[#706ea9] text-white font-semibold shadow-sm"
                  : "text-[#3f484f] hover:bg-[#e9e6f4] hover:text-[#1b1b24]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">video_camera_front</span>
              <span>Interviews</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#c6e7ff] text-[#001e2d] font-semibold">
                Live
              </span>
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "reports"
                  ? "bg-[#706ea9] text-white font-semibold shadow-sm"
                  : "text-[#3f484f] hover:bg-[#e9e6f4] hover:text-[#1b1b24]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              <span>Reports</span>
            </button>

            <button
              onClick={() => setActiveTab("job-roles")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "job-roles"
                  ? "bg-[#706ea9] text-white font-semibold shadow-sm"
                  : "text-[#3f484f] hover:bg-[#e9e6f4] hover:text-[#1b1b24]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">work</span>
              <span>Job Roles</span>
            </button>
          </nav>
        </div>

        {/* Bottom Recruiter Profile & Settings */}
        <div className="p-3 flex flex-col gap-2">
          <div className="space-y-0.5">
            <button className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-[#3f484f] hover:bg-[#e9e6f4] hover:text-[#1b1b24] transition-colors">
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span>Settings</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-[#3f484f] hover:bg-[#e9e6f4] hover:text-[#1b1b24] transition-colors">
              <span className="material-symbols-outlined text-[20px]">help</span>
              <span>Help & Support</span>
            </button>
          </div>

          <div className="h-[1px] w-full bg-[#bec8d0]/30 my-1" />

          {/* Recruiter Identity Pill */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 border border-[#bec8d0]/20 hover:bg-white transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#007dac] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                AM
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-sm font-semibold text-[#1b1b24]">Alex Morgan</span>
                <span className="text-[0.6875rem] text-[#6f7880]">Hiring Manager</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[#bec8d0] text-[18px]">unfold_more</span>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA (Offset by 288px)
      ───────────────────────────────────────────────────────────── */}
      <div className="pl-72 flex flex-col min-h-screen">
        {/* TOP BAR / HEADER */}
        <header className="fixed top-0 left-72 right-0 h-16 bg-[#fbf8ff]/85 backdrop-blur-xl z-40 flex items-center justify-between px-8 border-b border-[#bec8d0]/20 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
          {/* Breadcrumb Status */}
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase text-[#6f7880] font-semibold tracking-wider font-mono">
              Workspace
            </span>
            <span className="text-[#bec8d0]">/</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#c6e7ff] text-[#001e2d] text-xs font-medium shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006389] animate-pulse" />
              AI Evaluation Engine Active
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[#6f7880] text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search candidate, role, skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 pr-3 bg-white rounded-lg text-xs text-[#1b1b24] placeholder:text-[#6f7880] outline-none shadow-sm border border-[#bec8d0]/30 focus:border-[#006389] focus:ring-1 focus:ring-[#006389] w-64 transition-all"
              />
            </div>

            <button
              aria-label="Notifications"
              className="relative w-9 h-9 rounded-lg bg-white border border-[#bec8d0]/30 flex items-center justify-center text-[#3f484f] hover:text-[#006389] transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>

            {/* Primary Action Button: + New Interview / Upload */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="h-9 px-4 bg-[#006389] hover:bg-[#004c6b] text-white rounded-lg font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>+ New Interview</span>
            </button>
          </div>
        </header>

        {/* MAIN BODY CONTAINER */}
        <main className="pt-20 px-8 pb-14 max-w-[1440px] w-full mx-auto flex flex-col gap-8">
          {/* ─────────────────────────────────────────────────────────────
              GREETING & PIPELINE HERO BAR
          ───────────────────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl lg:text-3xl text-[#1b1b24] font-extrabold tracking-tight">
                  Good morning, Recruiter.
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#c6e7ff] text-[#001e2d] text-[0.6875rem] font-bold font-mono">
                  LIVE HUD
                </span>
              </div>
              <p className="text-sm text-[#3f484f]">
                Here's what's happening across your interview pipeline today.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 bg-[#e3e1ef] hover:bg-[#d5d2e4] text-[#1b1b24] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                <span>Upload Resumes</span>
              </button>
              <button
                onClick={() => navigate("/interview")}
                className="px-4 py-2 border border-[#006389] text-[#006389] hover:bg-[#006389]/10 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">videocam</span>
                <span>Launch Direct Room</span>
              </button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 2: DASHBOARD KPI METRIC CARDS (4-Column Bento Grid)
          ───────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Metric 1: Total Candidates */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-[#bec8d0]/20 flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[0.6875rem] text-[#6f7880] uppercase tracking-wider font-semibold font-mono">
                    Total Candidates
                  </span>
                  <div className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[#1b1b24]">
                    {totalCandidates}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#c6e7ff]/60 text-[#006389] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">group</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#9ad6fd]/60 text-[#155e7f] text-[0.6875rem] font-bold">
                  <span className="material-symbols-outlined text-[12px]">trending_up</span>+18%
                </span>
                <span className="text-[0.6875rem] text-[#6f7880]">this month</span>
              </div>
            </div>

            {/* Metric 2: Video Interviews Completed */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-[#bec8d0]/20 flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[0.6875rem] text-[#6f7880] uppercase tracking-wider font-semibold font-mono">
                    Video Interviews Completed
                  </span>
                  <div className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[#1b1b24]">
                    {completedInterviews}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#9ad6fd]/50 text-[#206586] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">video_call</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#9ad6fd]/60 text-[#155e7f] text-[0.6875rem] font-bold">
                  <span className="material-symbols-outlined text-[12px]">trending_up</span>+12%
                </span>
                <span className="text-[0.6875rem] text-[#6f7880]">from previous cycle</span>
              </div>
            </div>

            {/* Metric 3: Avg Interview Score */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-[#bec8d0]/20 flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[0.6875rem] text-[#6f7880] uppercase tracking-wider font-semibold font-mono">
                    Avg Interview Score
                  </span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[#1b1b24]">
                      {avgScore}
                    </span>
                    <span className="text-xs text-[#6f7880] font-mono">/ 100</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#e2dfff]/60 text-[#58568f] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">stars</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[0.6875rem] text-[#6f7880]">Across AI interviews</span>
                <div className="w-16 h-2 bg-[#e9e6f4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#006389] rounded-full"
                    style={{ width: `${Math.min(100, parseFloat(avgScore) || 75)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 4: Completion Rate */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-[#bec8d0]/20 flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[0.6875rem] text-[#6f7880] uppercase tracking-wider font-semibold font-mono">
                    Completion Rate
                  </span>
                  <div className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[#1b1b24]">
                    {completionRate}%
                  </div>
                </div>
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-[#e9e6f4]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="text-[#006389]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray={`${completionRate}, 100`}
                      strokeLinecap="round"
                      strokeWidth="3.2"
                    />
                  </svg>
                  <span className="material-symbols-outlined absolute text-[16px] text-[#006389]">
                    verified
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[0.6875rem] text-[#6f7880]">Candidate participation</span>
                <span className="text-[0.6875rem] text-[#006389] font-bold">Optimal</span>
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 3: ACTIVE JOB ROLES
          ───────────────────────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#1b1b24]">
                  Active Job Roles
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#e9e6f4] text-[#3f484f] text-xs font-semibold font-mono">
                  4 Openings
                </span>
              </div>
              <button
                onClick={() => setSelectedRoleFilter("All Roles")}
                className="text-xs text-[#006389] hover:underline font-semibold flex items-center gap-1"
              >
                Clear Filter <span className="material-symbols-outlined text-[14px]">refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Role 1 */}
              <div
                onClick={() => setSelectedRoleFilter("Machine Learning Engineer")}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedRoleFilter === "Machine Learning Engineer"
                    ? "bg-[#c6e7ff]/20 border-[#006389] ring-2 ring-[#006389]/20"
                    : "bg-white border-[#bec8d0]/20 hover:shadow-md"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#9ad6fd]/40 text-[#155e7f] text-[0.6875rem] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#206586] animate-pulse" />
                      Active
                    </span>
                    <span className="material-symbols-outlined text-[#6f7880] text-[18px]">memory</span>
                  </div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24] mt-1">
                    Machine Learning Engineer
                  </h3>
                  <span className="text-[0.6875rem] text-[#6f7880]">Core AI & Platform</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[0.6875rem] text-[#6f7880] font-mono">
                    <span>18 / 42 Interviews</span>
                    <span className="font-bold text-[#006389]">43%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#e9e6f4] rounded-full overflow-hidden">
                    <div className="h-full bg-[#006389] rounded-full" style={{ width: "43%" }} />
                  </div>
                </div>
              </div>

              {/* Role 2 */}
              <div
                onClick={() => setSelectedRoleFilter("Frontend Developer")}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedRoleFilter === "Frontend Developer"
                    ? "bg-[#c6e7ff]/20 border-[#006389] ring-2 ring-[#006389]/20"
                    : "bg-white border-[#bec8d0]/20 hover:shadow-md"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#9ad6fd]/40 text-[#155e7f] text-[0.6875rem] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#206586] animate-pulse" />
                      Active
                    </span>
                    <span className="material-symbols-outlined text-[#6f7880] text-[18px]">code</span>
                  </div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24] mt-1">
                    Frontend Developer
                  </h3>
                  <span className="text-[0.6875rem] text-[#6f7880]">Design Systems & Web</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[0.6875rem] text-[#6f7880] font-mono">
                    <span>24 / 56 Interviews</span>
                    <span className="font-bold text-[#006389]">43%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#e9e6f4] rounded-full overflow-hidden">
                    <div className="h-full bg-[#006389] rounded-full" style={{ width: "43%" }} />
                  </div>
                </div>
              </div>

              {/* Role 3 */}
              <div
                onClick={() => setSelectedRoleFilter("Backend Engineer")}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedRoleFilter === "Backend Engineer"
                    ? "bg-[#c6e7ff]/20 border-[#006389] ring-2 ring-[#006389]/20"
                    : "bg-white border-[#bec8d0]/20 hover:shadow-md"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#9ad6fd]/40 text-[#155e7f] text-[0.6875rem] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#206586] animate-pulse" />
                      Active
                    </span>
                    <span className="material-symbols-outlined text-[#6f7880] text-[18px]">dns</span>
                  </div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24] mt-1">
                    Backend Engineer
                  </h3>
                  <span className="text-[0.6875rem] text-[#6f7880]">Distributed Systems</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[0.6875rem] text-[#6f7880] font-mono">
                    <span>15 / 38 Interviews</span>
                    <span className="font-bold text-[#006389]">39%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#e9e6f4] rounded-full overflow-hidden">
                    <div className="h-full bg-[#006389] rounded-full" style={{ width: "39%" }} />
                  </div>
                </div>
              </div>

              {/* Role 4 */}
              <div
                onClick={() => setSelectedRoleFilter("Data Analyst")}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  selectedRoleFilter === "Data Analyst"
                    ? "bg-[#c6e7ff]/20 border-[#006389] ring-2 ring-[#006389]/20"
                    : "bg-white border-[#bec8d0]/20 hover:shadow-md"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#9ad6fd]/40 text-[#155e7f] text-[0.6875rem] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#206586] animate-pulse" />
                      Active
                    </span>
                    <span className="material-symbols-outlined text-[#6f7880] text-[18px]">query_stats</span>
                  </div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24] mt-1">
                    Data Analyst
                  </h3>
                  <span className="text-[0.6875rem] text-[#6f7880]">Product Growth Insights</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[0.6875rem] text-[#6f7880] font-mono">
                    <span>12 / 31 Interviews</span>
                    <span className="font-bold text-[#006389]">38%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#e9e6f4] rounded-full overflow-hidden">
                    <div className="h-full bg-[#006389] rounded-full" style={{ width: "38%" }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 4: CANDIDATE SCREENING & MANAGEMENT TABLE
          ───────────────────────────────────────────────────────────── */}
          <section className="p-6 bg-white rounded-2xl shadow-sm border border-[#bec8d0]/20 flex flex-col gap-5">
            {/* Table Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#1b1b24]">
                  Recent Candidates
                </h2>
                <p className="text-xs text-[#6f7880]">
                  Review AI video interview recordings, scorecards, and real-time adaptive probes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6f7880]">Filter Role:</span>
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  className="h-8 px-2.5 bg-[#f5f2ff] border border-[#bec8d0]/30 rounded-lg text-xs text-[#1b1b24] outline-none"
                >
                  <option value="All Roles">All Roles</option>
                  <option value="Machine Learning Engineer">Machine Learning Engineer</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Engineer">Backend Engineer</option>
                  <option value="Data Analyst">Data Analyst</option>
                </select>

                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="h-8 px-2.5 bg-[#f5f2ff] border border-[#bec8d0]/30 rounded-lg text-xs text-[#1b1b24] outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="Live Video">Live Video</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Screened">Screened</option>
                </select>
              </div>
            </div>

            {/* Candidate Table */}
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f2ff]/80 text-[#3f484f] font-mono text-[0.6875rem] uppercase tracking-wider">
                    <th className="py-3 px-4 rounded-l-xl font-bold">Candidate</th>
                    <th className="py-3 px-4 font-bold">Role</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">AI Score</th>
                    <th className="py-3 px-4 font-bold">Completed</th>
                    <th className="py-3 px-4 text-right rounded-r-xl font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9e6f4]/60 text-xs">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6f7880]">
                        No candidates found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((cand) => (
                      <tr key={cand.id} className="hover:bg-[#f5f2ff]/40 transition-colors group">
                        {/* Candidate Cell */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                cand.avatarBg || "bg-[#c6e7ff] text-[#001e2d]"
                              }`}
                            >
                              {cand.initials || cand.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-sm text-[#1b1b24] truncate">
                                {cand.name}
                              </span>
                              <span className="text-[0.6875rem] text-[#6f7880] truncate font-mono">
                                {cand.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4 text-[#1b1b24] font-medium">
                          {cand.role}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {cand.status === "Completed" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#9ad6fd]/40 text-[#155e7f] text-[0.6875rem] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#206586]" />
                              Completed
                            </span>
                          )}
                          {cand.status === "Live Video" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e2dfff] text-[#16134a] text-[0.6875rem] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#58568f] animate-pulse" />
                              Live Video
                            </span>
                          )}
                          {cand.status === "Pending Review" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#c6e7ff] text-[#001e2d] text-[0.6875rem] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#006389]" />
                              Pending Review
                            </span>
                          )}
                          {cand.status === "Screened" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e9e6f4] text-[#3f484f] text-[0.6875rem] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#007dac]" />
                              Screened
                            </span>
                          )}
                        </td>

                        {/* AI Score */}
                        <td className="py-3.5 px-4">
                          {cand.score > 0 ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#e9e6f4] text-[#1b1b24] font-bold font-mono text-xs">
                              <span>{cand.score}</span>
                              <span className="text-[#6f7880] font-normal">/100</span>
                            </div>
                          ) : (
                            <span className="text-[#6f7880] font-mono">—</span>
                          )}
                        </td>

                        {/* Completed At */}
                        <td className="py-3.5 px-4 text-[#6f7880] text-[0.6875rem] font-mono">
                          {cand.completedAt}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedCandidateForScorecard(cand)}
                            className="inline-flex items-center gap-1 text-xs text-[#006389] hover:underline font-semibold"
                          >
                            Scorecard <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </button>
                          <button
                            onClick={() => handleLaunchInterview(cand)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#006389] hover:bg-[#004c6b] text-white rounded text-[0.6875rem] font-semibold transition-all shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[12px]">play_circle</span>
                            <span>Start Interview</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 5: ANALYTICS & AI INSIGHTS ROW (3-Column Bento Grid)
          ───────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart Column: Interview Activity */}
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-[#bec8d0]/20 flex flex-col justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24]">
                    Interview Activity
                  </h3>
                  <span className="text-[0.6875rem] font-mono px-2 py-0.5 rounded bg-[#f5f2ff] text-[#6f7880]">
                    Last 30 Days
                  </span>
                </div>
                <p className="text-xs text-[#6f7880]">Interview completion trends across tracks.</p>
              </div>

              {/* Area SVG Chart */}
              <div className="my-4 flex flex-col justify-center">
                <svg className="w-full h-36 overflow-visible" preserveAspectRatio="none" viewBox="0 0 320 150">
                  <defs>
                    <linearGradient id="stitchAreaGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#006389" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#006389" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <line stroke="#bec8d0" strokeDasharray="3 3" strokeOpacity="0.3" x1="20" x2="300" y1="20" y2="20" />
                  <line stroke="#bec8d0" strokeDasharray="3 3" strokeOpacity="0.3" x1="20" x2="300" y1="60" y2="60" />
                  <line stroke="#bec8d0" strokeDasharray="3 3" strokeOpacity="0.3" x1="20" x2="300" y1="100" y2="100" />
                  <path d="M 30,105 L 110,85 L 190,60 L 270,30 L 270,120 L 30,120 Z" fill="url(#stitchAreaGradient)" />
                  <path d="M 30,105 L 110,85 L 190,60 L 270,30" fill="none" stroke="#006389" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  <circle className="fill-white stroke-[#006389]" cx="30" cy="105" r="4" strokeWidth="2.5" />
                  <circle className="fill-white stroke-[#006389]" cx="110" cy="85" r="4" strokeWidth="2.5" />
                  <circle className="fill-white stroke-[#006389]" cx="190" cy="60" r="4" strokeWidth="2.5" />
                  <circle className="fill-[#006389] stroke-white" cx="270" cy="30" r="5" strokeWidth="2.5" />
                </svg>
                <div className="flex justify-between text-[0.6875rem] font-mono text-[#6f7880] mt-1">
                  <span>Week 1 (12)</span>
                  <span>Week 2 (18)</span>
                  <span>Week 3 (24)</span>
                  <span className="font-bold text-[#006389]">Week 4 (32)</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-[#6f7880]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#006389]" />
                  Velocity: +33% wk/wk
                </span>
                <span className="font-mono">Target: 30/wk</span>
              </div>
            </div>

            {/* AI Hiring Insights Column */}
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-[#bec8d0]/20 flex flex-col justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24]">
                    AI Hiring Insights
                  </h3>
                  <span className="material-symbols-outlined text-[#006389] text-[20px]">psychology</span>
                </div>
                <p className="text-xs text-[#6f7880]">Patterns identified across recent adaptive interviews.</p>
              </div>

              <div className="my-3 flex flex-col gap-2.5">
                <div className="p-3 rounded-xl bg-[#f5f2ff] flex items-start gap-3">
                  <div className="w-7 h-7 rounded bg-[#9ad6fd] text-[#155e7f] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#1b1b24]">Strong Technical Communication</span>
                    <p className="text-[0.6875rem] text-[#3f484f] leading-snug mt-0.5">
                      68% of evaluated candidates demonstrated clear conceptual clarity in architectural reasoning.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#f5f2ff] flex items-start gap-3">
                  <div className="w-7 h-7 rounded bg-[#e2dfff] text-[#58568f] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">dynamic_form</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#1b1b24]">Adaptive Probe Agility</span>
                    <p className="text-[0.6875rem] text-[#3f484f] leading-snug mt-0.5">
                      Real-time counterfactual follow-ups revealed depth of hands-on experience versus rote memorization.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-[0.6875rem] text-[#6f7880] font-mono">
                Updated automatically by Groq Evaluation Engine
              </div>
            </div>

            {/* Quick Action Card Column */}
            <div className="p-6 bg-gradient-to-br from-[#006389] to-[#007dac] text-white rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-white/80">
                  Instant Candidate Pipeline
                </span>
                <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold leading-snug">
                  Automated Resume to AI Interview in 60s
                </h3>
                <p className="text-xs text-white/90 leading-relaxed">
                  Upload PDF resumes, calibrate semantic weights against job descriptions, and seamlessly invite top matches to live video interviews.
                </p>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-4 py-2.5 bg-white text-[#006389] hover:bg-slate-50 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  <span>Upload Now</span>
                </button>
                <button
                  onClick={() => navigate("/interview/Aarav%20Sharma")}
                  className="px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  <span>Demo Interview</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: STITCH RESUME UPLOAD & ANALYSIS MODAL
          (Mirrors Screen 675157b2e05d4b0e9679b3f622b1d528)
      ───────────────────────────────────────────────────────────── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#f8f9ff] rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#bec8d0]/30 flex flex-col my-auto">
            {/* Modal Header & Intake Funnel Stepper */}
            <div className="p-6 bg-white border-b border-[#bec8d0]/20 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#006389] text-white">
                    <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                  </span>
                  <div>
                    <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[#0b1c30]">
                      Candidate Intake Funnel
                    </h2>
                    <p className="text-xs text-[#464555] font-mono">
                      Session #INT-{Date.now().toString().slice(-4)} · Resume Intelligence Pipeline
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#464555] flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Stepper Bar */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#006389] text-white font-semibold">
                  <span className="w-4 h-4 rounded-full bg-white text-[#006389] flex items-center justify-center text-[10px]">1</span>
                  <span>Upload Resume</span>
                </div>
                <span className="h-0.5 w-6 bg-[#006389] rounded-full" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dae2fd] text-[#131b2e] font-medium">
                  <span className="w-4 h-4 rounded-full bg-[#007dac] text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Analyze Candidate</span>
                </div>
                <span className="h-0.5 w-6 bg-[#d3e4fe] rounded-full" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#464555]">
                  <span className="w-4 h-4 rounded-full bg-[#d3e4fe] flex items-center justify-center text-[10px]">3</span>
                  <span>Live Video Interview</span>
                </div>
                <span className="h-0.5 w-6 bg-[#d3e4fe] rounded-full" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#464555]">
                  <span className="w-4 h-4 rounded-full bg-[#d3e4fe] flex items-center justify-center text-[10px]">4</span>
                  <span>Evaluation</span>
                </div>
              </div>
            </div>

            {/* Modal Body: Two-Column Experience Grid */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Drag & Drop Zone */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <div className="bg-white rounded-xl p-5 border border-[#bec8d0]/20 flex flex-col gap-3">
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#0b1c30]">
                    Target Role & Job Description
                  </h3>
                  <input
                    type="text"
                    value={jobTitleInput}
                    onChange={(e) => setJobTitleInput(e.target.value)}
                    placeholder="Job Title (e.g. Machine Learning Engineer)"
                    className="h-9 px-3 bg-[#eff4ff] border border-[#bec8d0]/30 rounded-lg text-xs outline-none focus:border-[#006389]"
                  />
                  <textarea
                    rows={3}
                    value={jobDescriptionInput}
                    onChange={(e) => setJobDescriptionInput(e.target.value)}
                    placeholder="Job Description / Key Requirements..."
                    className="p-3 bg-[#eff4ff] border border-[#bec8d0]/30 rounded-lg text-xs outline-none focus:border-[#006389] resize-none"
                  />
                  <div className="flex items-center justify-between text-xs text-[#464555]">
                    <span>Similarity Threshold:</span>
                    <span className="font-bold text-[#006389] font-mono">{thresholdInput}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={90}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(Number(e.target.value))}
                    className="w-full accent-[#006389]"
                  />
                </div>

                {/* Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileDropOrChange(e.dataTransfer.files);
                  }}
                  className="rounded-xl p-6 bg-[#eff4ff] border-2 border-dashed border-[#bec8d0] hover:border-[#006389] transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#dae2fd] text-[#006389] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">upload_file</span>
                  </div>
                  <p className="font-bold text-sm text-[#0b1c30]">Drag and drop resume here</p>
                  <p className="text-xs text-[#464555] mb-3">or browse from your device</p>
                  <span className="px-3 py-1.5 rounded-lg bg-[#006389] text-white text-xs font-semibold">
                    Browse Files
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileDropOrChange(e.target.files)}
                  />
                  <div className="mt-3 text-[0.6875rem] text-[#6f7880] flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-xs">info</span>
                    <span>PDF format only • Max 10MB</span>
                  </div>
                </div>

                {/* Uploaded Files Listing */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#0b1c30]">Selected Files ({uploadedFiles.length})</span>
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-white border border-[#bec8d0]/20 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-red-500 text-lg">picture_as_pdf</span>
                          <span className="font-medium text-[#0b1c30] truncate">{file.name}</span>
                          <span className="text-[0.6875rem] text-[#6f7880]">
                            {(file.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* SOC2 Privacy Assurance Card */}
                <div className="p-3 rounded-xl bg-white border border-[#bec8d0]/20 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#006389] text-xl shrink-0">encrypted</span>
                  <p className="text-[0.6875rem] text-[#464555] leading-relaxed">
                    Resume parsing is strictly isolated to personalize the interview experience. Encrypted at rest & in transit.
                  </p>
                </div>
              </div>

              {/* Right Column: 6 Intelligence Vectors & Extraction Telemetry */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <div className="bg-white rounded-xl p-5 border border-[#bec8d0]/20 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#0b1c30]">
                      What InterviewAI Understands
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#dae2fd] text-[#131b2e] text-[0.6875rem] font-bold">
                      Resume Intelligence
                    </span>
                  </div>
                  <p className="text-xs text-[#464555]">
                    More than keywords. We identify the experience, skills, and knowledge areas behind the resume.
                  </p>

                  {/* 6 Intelligence Vectors */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="p-2.5 rounded-lg bg-[#eff4ff] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[#006389] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">badge</span>
                        <span>Candidate Profile</span>
                      </div>
                      <p className="text-[0.6875rem] text-[#464555]">Name, contact, summary</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[#006389] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">terminal</span>
                        <span>Technical Skills</span>
                      </div>
                      <p className="text-[0.6875rem] text-[#464555]">Languages, frameworks, tools</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[#006389] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">work_history</span>
                        <span>Work Experience</span>
                      </div>
                      <p className="text-[0.6875rem] text-[#464555]">Roles, production scope</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[#006389] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">school</span>
                        <span>Education</span>
                      </div>
                      <p className="text-[0.6875rem] text-[#464555]">Degrees, institutions</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[#006389] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">account_tree</span>
                        <span>Projects</span>
                      </div>
                      <p className="text-[0.6875rem] text-[#464555]">Architecture, toolsets</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[#006389] font-bold text-xs">
                        <span className="material-symbols-outlined text-sm">radar</span>
                        <span>Interview Probes</span>
                      </div>
                      <p className="text-[0.6875rem] text-[#464555]">Focus areas, edge gaps</p>
                    </div>
                  </div>

                  {/* Knowledge Profile Calibrated badge */}
                  <div className="p-3 rounded-lg bg-[#eff4ff] flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#006389]">hub</span>
                      <div className="text-xs">
                        <p className="font-semibold text-[#0b1c30]">Candidate Knowledge Profile</p>
                        <p className="text-[0.6875rem] text-[#464555]">Calibrated with role benchmarks</p>
                      </div>
                    </div>
                    <span className="text-[0.6875rem] text-[#006389] font-bold font-mono">CALIBRATED</span>
                  </div>

                  {/* Extraction Telemetry Bar */}
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[0.6875rem] font-mono text-[#464555]">
                      <span>Extraction Telemetry</span>
                      <span>Confidence: 99.4%</span>
                    </div>
                    <div className="h-2 w-full bg-[#e5eeff] rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#006389] w-[45%]" title="Skills" />
                      <div className="h-full bg-[#007dac] w-[30%]" title="Experience" />
                      <div className="h-full bg-[#9ad6fd] w-[15%]" title="Projects" />
                      <div className="h-full bg-[#58568f] w-[10%]" title="Academia" />
                    </div>
                    <div className="flex items-center gap-3 text-[0.6875rem] font-mono text-[#6f7880]">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#006389]" />Skills 45%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#007dac]" />Experience 30%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#9ad6fd]" />Projects 15%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#58568f]" />Academia 10%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recruiter Tip Callout */}
                <div className="p-4 rounded-xl bg-white border border-[#bec8d0]/20 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#006389] text-xl mt-0.5">tips_and_updates</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#0b1c30]">Adaptive Generation Ready</span>
                    <p className="text-[0.6875rem] text-[#464555] leading-relaxed mt-0.5">
                      The AI interviewer will frame scenario-based questions directly around the candidate's actual projects and core skills.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-white border-t border-[#bec8d0]/20 flex items-center justify-between">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 text-xs text-[#464555] hover:underline font-semibold"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                <button
                  disabled={isAnalyzing}
                  onClick={() => {
                    // Quick Demo Candidate insertion
                    const sample: CandidateRecord = {
                      id: `cand-sample-${Date.now()}`,
                      name: "Alex Johnson",
                      email: "alex.johnson@example.com",
                      role: jobTitleInput || "Senior Software Engineer",
                      status: "Screened",
                      score: 88,
                      completedAt: "Just now",
                      skills: ["Python", "FastAPI", "React", "Docker", "MongoDB"],
                      avatarBg: "bg-[#c6e7ff] text-[#001e2d]",
                      initials: "AJ",
                      resumeText: "Alex Johnson. Senior Software Engineer with 5+ years experience in Python, FastAPI, React, Docker, and MongoDB."
                    };
                    setCandidates(prev => [sample, ...prev]);
                    toast({
                      title: "Sample Candidate Screened",
                      description: "Added Alex Johnson with 88% match score."
                    });
                    setIsUploadModalOpen(false);
                  }}
                  className="px-4 py-2 bg-[#f5f2ff] hover:bg-[#e9e6f4] text-[#1b1b24] rounded-lg text-xs font-semibold transition-colors"
                >
                  Load Sample Candidate
                </button>

                <button
                  disabled={isAnalyzing || uploadedFiles.length === 0}
                  onClick={handleRunResumeAnalysis}
                  className="px-5 py-2 bg-[#006389] hover:bg-[#004c6b] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      <span>Analyzing Resumes...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      <span>Run AI Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: STITCH SCORECARD & CANDIDATE DETAILS MODAL
          (Mirrors Screen 35de875130c04250bc63561926decbc7)
      ───────────────────────────────────────────────────────────── */}
      {selectedCandidateForScorecard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#fbf8ff] rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#bec8d0]/30 flex flex-col my-auto">
            {/* Scorecard Header */}
            <div className="p-5 bg-white border-b border-[#bec8d0]/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#006389] text-white font-bold text-xs">
                  IA
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[#1b1b24]">
                      Interview Result & Performance Scorecard
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c6e7ff] text-[#001e2d] text-[0.6875rem] font-bold font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#006389] animate-pulse" />
                      EVALUATION COMPLETE
                    </span>
                  </div>
                  <p className="text-xs text-[#6f7880]">
                    Candidate: {selectedCandidateForScorecard.name} · Role: {selectedCandidateForScorecard.role}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCandidateForScorecard(null)}
                className="w-8 h-8 rounded-lg bg-[#f5f2ff] hover:bg-[#e9e6f4] text-[#3f484f] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Scorecard Content */}
            <div className="p-6 flex flex-col gap-6">
              {/* Overall Performance Card (Hero Centerpiece) */}
              <div className="p-6 bg-white rounded-2xl border border-[#bec8d0]/20 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Circular Gauge */}
                <div className="md:col-span-6 flex items-center gap-5">
                  <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[#e9e6f4]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                      />
                      <path
                        className="text-[#006389]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${selectedCandidateForScorecard.score || 82}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.4"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-black text-[#006389] leading-none">
                        {selectedCandidateForScorecard.score || 82}
                      </span>
                      <span className="text-[0.6875rem] font-mono text-[#6f7880]">/ 100</span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#c6e7ff] text-[#001e2d] text-xs font-bold w-max mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#006389]" />
                      Strong Performance
                    </span>
                    <span className="text-xs font-mono text-[#6f7880]">Percentile: Top 14%</span>
                    <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#1b1b24] mt-0.5">
                      {selectedCandidateForScorecard.name}
                    </h3>
                    <p className="text-xs text-[#206586] font-medium">
                      {selectedCandidateForScorecard.role} Assessment
                    </p>
                  </div>
                </div>

                {/* Stat Pills */}
                <div className="md:col-span-6 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#f5f2ff] border border-[#bec8d0]/20 flex flex-col">
                    <span className="text-[0.6875rem] font-mono font-bold uppercase text-[#6f7880]">Video Stream</span>
                    <span className="text-sm font-bold text-[#1b1b24]">24 min HD</span>
                    <span className="text-[0.6875rem] text-[#6f7880] font-mono">100% verified</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#f5f2ff] border border-[#bec8d0]/20 flex flex-col">
                    <span className="text-[0.6875rem] font-mono font-bold uppercase text-[#6f7880]">Responses</span>
                    <span className="text-sm font-bold text-[#1b1b24]">8 Evaluated</span>
                    <span className="text-[0.6875rem] text-[#6f7880] font-mono">All questions answered</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#f5f2ff] border border-[#bec8d0]/20 flex flex-col">
                    <span className="text-[0.6875rem] font-mono font-bold uppercase text-[#6f7880]">Real-Time Probes</span>
                    <span className="text-sm font-bold text-[#58568f]">5 Dynamic</span>
                    <span className="text-[0.6875rem] text-[#6f7880] font-mono">AI follow-ups</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#f5f2ff] border border-[#bec8d0]/20 flex flex-col">
                    <span className="text-[0.6875rem] font-mono font-bold uppercase text-[#6f7880]">Focus Areas</span>
                    <span className="text-sm font-bold text-[#206586]">6 Explored</span>
                    <span className="text-[0.6875rem] text-[#6f7880] font-mono">Full rubric depth</span>
                  </div>
                </div>
              </div>

              {/* Core Competencies Breakdown */}
              <div className="bg-white rounded-2xl p-6 border border-[#bec8d0]/20 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-[#006389] font-mono">
                      Dimensions
                    </span>
                    <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24]">
                      Core Competencies
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-[#6f7880]">Benchmark: 75%</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Metric 1 */}
                  <div className="p-3.5 rounded-xl bg-[#f5f2ff] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Technical Depth</span>
                      <span className="text-[#006389] font-mono">84%</span>
                    </div>
                    <div className="w-full bg-[#e9e6f4] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#006389] h-full rounded-full" style={{ width: "84%" }} />
                    </div>
                    <p className="text-[0.6875rem] text-[#6f7880]">Good understanding of core concepts.</p>
                  </div>

                  {/* Metric 2 */}
                  <div className="p-3.5 rounded-xl bg-[#f5f2ff] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Problem Solving</span>
                      <span className="text-[#206586] font-mono">79%</span>
                    </div>
                    <div className="w-full bg-[#e9e6f4] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#206586] h-full rounded-full" style={{ width: "79%" }} />
                    </div>
                    <p className="text-[0.6875rem] text-[#6f7880]">Approached challenges logically.</p>
                  </div>

                  {/* Metric 3 */}
                  <div className="p-3.5 rounded-xl bg-[#f5f2ff] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Verbal Articulation</span>
                      <span className="text-[#006389] font-mono">88%</span>
                    </div>
                    <div className="w-full bg-[#e9e6f4] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#006389] h-full rounded-full" style={{ width: "88%" }} />
                    </div>
                    <p className="text-[0.6875rem] text-[#6f7880]">Coherent delivery and audio clarity.</p>
                  </div>

                  {/* Metric 4 */}
                  <div className="p-3.5 rounded-xl bg-[#f5f2ff] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Practical Experience</span>
                      <span className="text-[#58568f] font-mono">81%</span>
                    </div>
                    <div className="w-full bg-[#e9e6f4] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#58568f] h-full rounded-full" style={{ width: "81%" }} />
                    </div>
                    <p className="text-[0.6875rem] text-[#6f7880]">Real-world codebase exposure.</p>
                  </div>
                </div>
              </div>

              {/* Strengths & Growth Areas Two-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-5 rounded-2xl bg-white border border-[#bec8d0]/20 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006389] text-[20px]">verified</span>
                    <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24]">
                      Validated Strengths
                    </h4>
                  </div>
                  <ul className="space-y-2 text-xs text-[#3f484f]">
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[#006389] text-base shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>High vocal pacing and structured verbal delivery on camera.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[#006389] text-base shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>Maintained precision when the AI interviewer asked follow-up probes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[#006389] text-base shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>Demonstrated clear architectural trade-offs in scalable environments.</span>
                    </li>
                  </ul>
                </div>

                {/* Areas to Strengthen */}
                <div className="p-5 rounded-2xl bg-white border border-[#bec8d0]/20 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#206586] text-[20px]">lightbulb</span>
                    <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#1b1b24]">
                      Areas to Strengthen
                    </h4>
                  </div>
                  <ul className="space-y-2 text-xs text-[#3f484f]">
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[#206586] text-base shrink-0 mt-0.5">
                        adjust
                      </span>
                      <span>Deepen understanding of edge caching strategies and memory boundaries.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[#206586] text-base shrink-0 mt-0.5">
                        adjust
                      </span>
                      <span>Practice explaining how systems handle graceful degradation during traffic spikes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[#206586] text-base shrink-0 mt-0.5">
                        adjust
                      </span>
                      <span>Strengthen task-aligned evaluation metrics selection.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Scorecard Footer Actions */}
            <div className="p-5 bg-white border-t border-[#bec8d0]/20 flex items-center justify-between">
              <button
                onClick={() => setSelectedCandidateForScorecard(null)}
                className="px-4 py-2 text-xs text-[#6f7880] hover:underline font-semibold"
              >
                Close
              </button>

              <button
                onClick={() => {
                  const candidate = selectedCandidateForScorecard;
                  setSelectedCandidateForScorecard(null);
                  handleLaunchInterview(candidate);
                }}
                className="px-5 py-2.5 bg-[#006389] hover:bg-[#004c6b] text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-sm">videocam</span>
                <span>Launch Live Interview Room</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterDashboard;
