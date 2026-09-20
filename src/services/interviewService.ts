import { API_ENDPOINTS } from '../config/api';

export interface InterviewStartRequest {
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  job_description?: string;
  required_skills?: string[];
  candidate_resume?: string;
  interview_id?: string;
  session_id?: string;
  meeting_id?: string;
  target_duration_minutes?: number;
}

export interface InterviewStartResponse {
  success: boolean;
  data?: {
    interview_id: string;
    session_id: string;
    introduction: string;
    current_stage: string;
    processing_status?: string;
  };
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface AnswerEvaluation {
  overall_score?: number;
  completeness_score?: number;
  relevance_score?: number;
  technical_score?: number;
  communication_score?: number;
  problem_solving_score?: number;
  strengths?: string[];
  weaknesses?: string[];
  key_points_mentioned?: string[];
  technical_terms_used?: string[];
  red_flags?: string[];
  follow_up_needed?: boolean;
  follow_up_reason?: string;
  suggested_followup?: string;
}

export interface InterviewAnswerRequest {
  interview_id: string;
  answer: string;
  transcription_id?: string;
}

export interface InterviewAnswerResponse {
  success: boolean;
  data?: {
    interview_complete: boolean;
    next_question?: string;
    closing_message?: string;
    question_type?: string;
    current_stage?: string;
    question_number?: number;
    evaluation?: AnswerEvaluation;
    overall_score?: number;
    summary?: {
      total_questions: number;
      duration_minutes: number;
      key_strengths: string[];
      areas_for_improvement: string[];
    };
  };
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export const interviewService = {
  /**
   * Start a new AI interview session via FastAPI backend (Port 8001)
   */
  async startInterview(request: InterviewStartRequest): Promise<InterviewStartResponse> {
    const response = await fetch(API_ENDPOINTS.interviewStart, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || errorJson.error?.message || `HTTP ${response.status}: Failed to start interview`);
      } catch (e: any) {
        if (e.message && !e.message.startsWith('HTTP')) throw e;
        throw new Error(`HTTP ${response.status}: Failed to start interview`);
      }
    }

    return response.json();
  },

  /**
   * Submit candidate answer and receive evaluation + next question (Port 8001)
   */
  async submitAnswer(request: InterviewAnswerRequest): Promise<InterviewAnswerResponse> {
    const response = await fetch(API_ENDPOINTS.interviewAnswer, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || errorJson.error?.message || `HTTP ${response.status}: Failed to submit answer`);
      } catch (e: any) {
        if (e.message && !e.message.startsWith('HTTP')) throw e;
        throw new Error(`HTTP ${response.status}: Failed to submit answer`);
      }
    }

    return response.json();
  },
};
