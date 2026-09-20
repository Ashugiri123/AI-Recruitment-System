// API configuration for the application

// Base URL for API requests
// Flask backend runs on port 5000
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// FastAPI backend runs on port 8001
export const FASTAPI_BASE_URL = import.meta.env.VITE_FASTAPI_BASE_URL || 'http://localhost:8001';

// API endpoints
export const API_ENDPOINTS = {
  analyze: `${API_BASE_URL}/api/analyze`,
  qa: `${API_BASE_URL}/api/qa`,
  questions: `${API_BASE_URL}/api/questions`,
  improve: `${API_BASE_URL}/api/improve`,
  improvedResume: `${API_BASE_URL}/api/improved-resume`,
  generateMessage: `${API_BASE_URL}/api/generate-message`,
  processAction: `${API_BASE_URL}/api/process-action`,
  sendAcceptance: `${API_BASE_URL}/api/send-acceptance`,
  downloadCsv: `${API_BASE_URL}/api/download-csv`,
  testExtraction: `${API_BASE_URL}/api/extract-text`,
  testSimilarity: `${API_BASE_URL}/api/test-similarity`,
  predictSalary: `${API_BASE_URL}/api/predict-salary`,
  predictJobPossibility: `${API_BASE_URL}/api/predict-job-possibility`,

  // FastAPI AI Interview Endpoints (Port 8001)
  interviewStart: `${FASTAPI_BASE_URL}/api/interview/start`,
  interviewAnswer: `${FASTAPI_BASE_URL}/api/interview/answer`,
  interviewHealth: `${FASTAPI_BASE_URL}/health`,
};