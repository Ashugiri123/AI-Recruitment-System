import { Groq } from 'groq-sdk';

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

if (!groqApiKey) {
  console.error('VITE_GROQ_API_KEY is not defined. Please check your .env file.');
}

const groq = new Groq({
  apiKey: groqApiKey || 'dummy_placeholder_key',
  dangerouslyAllowBrowser: true
});

// Define available features and their variations
const FEATURES = {
  'resume_analysis': {
    name: 'Resume Analysis',
    keywords: ['analyze', 'check', 'match', 'score', 'screen', 'screening'],
    description: 'Analyze your resume against a job description to get match score, matching skills, and areas for improvement.'
  },
  'resume_qa': {
    name: 'Resume Q&A',
    keywords: ['ask about', 'questions about resume', 'grammatical errors', 'grammar check', 'spelling check', 'skills', 'experience', 'credentials'],
    description: 'Ask questions about your resume and get AI-powered answers based on the resume content.'
  },
  'interview_questions': {
    name: 'Interview Questions',
    keywords: ['interview prep', 'practice questions', 'interview practice', 'prepare for interview', 'questions', 'questions based on resume'],
    description: 'Generate customized interview questions based on your resume, job role, and difficulty level.'
  },
  'multiple_resume': {
    name: 'Screen 100s of Resume\'s',
    keywords: ['multiple', 'bulk analysis', 'many', 'bulk', 'sorting'],
    description: 'Upload multiple resumes at once to efficiently screen and rank candidates based on job requirements.'
  },
  'resume_improvement': {
    name: 'Resume Improvement',
    keywords: ['improve', 'enhance', 'better', 'fix', 'edit'],
    description: 'Get an AI-generated improved version of your resume tailored to a specific job role.'
  },
  'salary_prediction': {
    name: 'Salary Prediction',
    keywords: ['salary estimate', 'expected salary', 'salary range', 'how much should i earn', 'salary'],
    description: 'Get a salary prediction based on your experience, education, job level, industry, and location.'
  },
  'job_possibility': {
    name: 'Job Possibility',
    keywords: ['predict', 'prediction', 'job', 'job possibility'],
    description: 'Analyze your chances of getting a specific job based on your resume and job requirements.'
  },
  'improved_resume': {
    name: 'Improved Resume',
    keywords: ['improve', 'enhance', 'better', 'fix', 'edit', 'improved', 'improve version', 'improved version'],
    description: 'Get an AI-generated improved version of your resume with enhanced content and formatting.'
  }
};

export const detectIntent = async (input: string, isHR: boolean = false): Promise<{ intent: string | null; response: string }> => {
  // Convert input to lowercase for case-insensitive matching
  const lowerInput = input.toLowerCase();
  
  // Special handling for salary-related queries in HR chatbot
  if (isHR && (
    lowerInput.includes('salary') || 
    lowerInput.includes('pay') || 
    lowerInput.includes('compensation') || 
    lowerInput.includes('earn') || 
    lowerInput.includes('income')
  )) {
    return {
      intent: null,
      response: "I'm sorry, but salary prediction is not available in the HR section. Please visit the Employee section for this functionality."
    };
  }

  // Special handling for specific feature types
  const featureHandlers = {
    'resume_qa': ['grammar', 'grammatical', 'error', 'spell', 'spelling', 'mistake', 'typo', 'skills', 'experience', 'credentials'],
    'interview_questions': ['interview', 'questions', 'practice', 'prepare'],
    'resume_analysis': ['analyze', 'check', 'match', 'score', 'screen', 'single', 'one', 'resume analysis'],
    'multiple_resume': [
      'bulk', 
      'multiple', 
      'many', 
      'sorting', 
      'screen 100s', 
      'screen hundreds', 
      'screen multiple', 
      'bulk screening', 
      'bulk analysis', 
      'mass screening', 
      'bulk resume', 
      'multiple resume', 
      'many resume', 
      'screen resume', 
      'screen resumes',
      'bulk screening of resume',
      'bulk screening of resumes'
    ],
    'resume_improvement': ['improve', 'enhance', 'better', 'fix', 'edit'],
    'salary_prediction': ['salary', 'earn', 'range', 'estimate'],
    'job_possibility': ['predict', 'prediction', 'job', 'possibility'],
    'improved_resume': ['improve', 'enhance', 'better', 'fix', 'edit', 'improved', 'version']
  };

  // Check for specific feature matches with improved matching logic
  for (const [feature, keywords] of Object.entries(featureHandlers)) {
    // First check for exact multi-word phrases
    const multiWordMatches = keywords.filter(keyword => 
      keyword.includes(' ') && lowerInput.includes(keyword)
    );
    
    if (multiWordMatches.length > 0) {
      return {
        intent: feature,
        response: `Sure! ${FEATURES[feature].description} Click the "${FEATURES[feature].name}" button to get started.`
      };
    }
    
    // Then check for single word matches
    const singleWordMatches = keywords.filter(keyword => 
      !keyword.includes(' ') && lowerInput.includes(keyword)
    );
    
    if (singleWordMatches.length > 0) {
      return {
        intent: feature,
        response: `Sure! ${FEATURES[feature].description} Click the "${FEATURES[feature].name}" button to get started.`
      };
    }
  }
  
  // Find matching features based on keywords
  const matches = Object.entries(FEATURES)
    .map(([key, feature]) => {
      const keywordMatches = feature.keywords.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      );
      return {
        key,
        feature,
        matches: keywordMatches.length,
        confidence: keywordMatches.length / feature.keywords.length
      };
    })
    .filter(match => match.matches > 0)
    .sort((a, b) => b.confidence - a.confidence);

  console.log('Found matches:', matches);

  if (matches.length === 0) {
    return {
      intent: null,
      response: "Sure! You can use our: " + 
        Object.values(FEATURES).map(f => f.name).join(', ') + 
        "\nThis will definitely help you!"
    };
  }

  const bestMatch = matches[0];
  
  if (bestMatch.confidence < 0.3) {
    return {
      intent: null,
      response: `Sure! Please choose any one of these: ${bestMatch.feature.name}\nThis will definitely help you!`
    };
  }

  // High confidence match
  return {
    intent: bestMatch.key,
    response: `Sure! ${bestMatch.feature.description} Click the "${bestMatch.feature.name}" button to get started.`
  };
}