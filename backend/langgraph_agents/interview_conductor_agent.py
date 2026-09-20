"""
Interview Conductor LangGraph Agent
Conducts AI-powered interviews with candidates using LLM
Maintains conversation context and flow
"""

import json
import logging
import uuid
from typing import Dict, Any, TypedDict, List, Optional
from datetime import datetime
from langgraph.graph import StateGraph, END
from groq import Groq
import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.context_manager import MCPContextManager
from mcp.cache_manager import MCPCacheManager
from mcp.token_optimizer import TokenOptimizer

# Import TTS agent
from langgraph_agents.tts_agent import convert_text_to_speech

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class InterviewState(TypedDict):
    """State for interview conductor workflow"""
    # Interview metadata
    interview_id: str
    session_id: str
    meeting_id: Optional[str]
    
    # Participant information
    candidate_email: str
    candidate_name: str
    interviewer_name: str
    job_id: Optional[str]
    job_title: str
    
    # Interview content
    job_description: str
    candidate_resume: str
    required_skills: List[str]
    
    # Conversation state
    current_stage: str  # intro, technical, behavioral, situational, qa, closing
    stage_transition_count: int
    conversation_history: List[Dict[str, Any]]
    questions_asked: List[Dict[str, Any]]
    answers_received: List[Dict[str, Any]]
    
    # Current interaction
    current_question: str
    current_question_type: str  # technical, behavioral, situational, general
    last_answer: str
    answer_analysis: Dict[str, Any]
    
    # Interview progress
    total_questions_asked: int
    technical_questions_count: int
    behavioral_questions_count: int
    situational_questions_count: int
    
    # Scoring and evaluation
    overall_score: float
    technical_score: float
    communication_score: float
    problem_solving_score: float
    cultural_fit_score: float
    
    # Analytics
    key_strengths: List[str]
    areas_for_improvement: List[str]
    red_flags: List[str]
    notable_achievements: List[str]
    
    # Flow control
    should_ask_followup: bool
    should_transition_stage: bool
    interview_complete: bool
    
    # Timing
    started_at: str
    current_time: str
    duration_minutes: int
    target_duration_minutes: int
    
    # Error handling
    errors: List[Dict[str, str]]
    last_error: str
    retry_count: int
    
    # Processing status
    processing_status: str  # initializing, in_progress, completed, failed


class InterviewConductorAgent:
    """
    LangGraph agent to conduct AI-powered interviews
    
    Workflow:
    1. initialize_interview: Load job description, candidate resume, set context
    2. generate_intro: Create personalized welcome message
    3. ask_question: Generate context-aware interview questions
    4. process_answer: Analyze candidate response from STT
    5. evaluate_response: Score answer quality and extract insights
    6. decide_next_step: Determine follow-up, next question, or stage transition
    7. transition_stage: Move through interview phases
    8. generate_closing: Create closing message and summary
    9. store_interview: Save complete interview to MongoDB
    """
    
    def __init__(self):
        """Initialize Interview Conductor Agent with MCP components"""
        logger.info("🎤 Initializing InterviewConductorAgent")
        
        # Initialize Groq client
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.llm_model = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
        
        # Initialize MCP components
        self.context_manager = MCPContextManager(max_context_length=15000)
        self.cache_manager = MCPCacheManager(
            ttl_minutes=120,  # Cache interview context for 2 hours
            max_cache_size=100
        )
        self.token_optimizer = TokenOptimizer(
            max_input_tokens=15000,
            max_output_tokens=5000
        )
        
        # MongoDB connection with proper timeout settings
        mongo_uri = os.getenv('MONGO_URI', 'mongo_url')
        mongo_db_name = os.getenv('MONGO_DB_NAME', 'resumate')
        
        # Configure MongoDB client with appropriate timeouts for Atlas
        self.mongo_client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=10000,  # 10 seconds (reduced from 30s)
            connectTimeoutMS=10000,  # 10 seconds
            socketTimeoutMS=45000,  # 45 seconds for operations
            maxPoolSize=50,  # Connection pool size
            retryWrites=True,  # Enable retryable writes
            retryReads=True  # Enable retryable reads
        )
        self.db = self.mongo_client[mongo_db_name]
        
        # Interview configuration
        self.interview_stages = ['intro', 'technical', 'behavioral', 'situational', 'qa', 'closing']
        self.questions_per_stage = {
            'technical': 5,
            'behavioral': 3,
            'situational': 2,
            'qa': 1
        }
        
        # Build workflow
        self.workflow = self._build_workflow()
        logger.info("✅ InterviewConductorAgent initialized successfully")
    
    def _build_workflow(self) -> StateGraph:
        """Build LangGraph workflow for interview"""
        workflow = StateGraph(InterviewState)
        
        # Add nodes
        workflow.add_node("initialize_interview", self.initialize_interview)
        workflow.add_node("generate_intro", self.generate_intro)
        workflow.add_node("ask_question", self.ask_question)
        workflow.add_node("process_answer", self.process_answer)
        workflow.add_node("evaluate_response", self.evaluate_response)
        workflow.add_node("decide_next_step", self.decide_next_step)
        workflow.add_node("transition_stage", self.transition_stage)
        workflow.add_node("generate_closing", self.generate_closing)
        workflow.add_node("store_interview", self.store_interview)
        
        # Define edges
        workflow.set_entry_point("initialize_interview")
        
        workflow.add_edge("initialize_interview", "generate_intro")
        workflow.add_edge("generate_intro", "ask_question")
        
        # After asking question, wait for answer (external trigger)
        workflow.add_edge("ask_question", END)
        
        # When answer received (new invocation)
        workflow.add_edge("process_answer", "evaluate_response")
        workflow.add_edge("evaluate_response", "decide_next_step")
        
        # Conditional edges based on decision
        workflow.add_conditional_edges(
            "decide_next_step",
            self._route_next_step,
            {
                "ask_followup": "ask_question",
                "transition": "transition_stage",
                "complete": "generate_closing"
            }
        )
        
        workflow.add_edge("transition_stage", "ask_question")
        workflow.add_edge("generate_closing", "store_interview")
        workflow.add_edge("store_interview", END)
        
        return workflow.compile()
    
    def _route_next_step(self, state: InterviewState) -> str:
        """Route to next step based on interview state"""
        if state.get('interview_complete', False):
            return "complete"
        elif state.get('should_transition_stage', False):
            return "transition"
        else:
            return "ask_followup"
    
    # ==================== Workflow Nodes ====================
    
    def initialize_interview(self, state: InterviewState) -> InterviewState:
        """Initialize interview session with context"""
        logger.info(f"🎬 Initializing interview: {state.get('interview_id', 'unknown')}")
        
        try:
            state['processing_status'] = 'initializing'
            state['started_at'] = datetime.utcnow().isoformat()
            state['current_time'] = datetime.utcnow().isoformat()
            state['current_stage'] = 'intro'
            state['stage_transition_count'] = 0
            
            # Initialize counters
            state['total_questions_asked'] = 0
            state['technical_questions_count'] = 0
            state['behavioral_questions_count'] = 0
            state['situational_questions_count'] = 0
            
            # Initialize scores
            state['overall_score'] = 0.0
            state['technical_score'] = 0.0
            state['communication_score'] = 0.0
            state['problem_solving_score'] = 0.0
            state['cultural_fit_score'] = 0.0
            
            # Initialize lists
            state['conversation_history'] = []
            state['questions_asked'] = []
            state['answers_received'] = []
            state['key_strengths'] = []
            state['areas_for_improvement'] = []
            state['red_flags'] = []
            state['notable_achievements'] = []
            state['errors'] = []
            
            # Flow control
            state['should_ask_followup'] = False
            state['should_transition_stage'] = False
            state['interview_complete'] = False
            state['retry_count'] = 0
            
            # Build interview context with MCP
            context_items = [
                f"Job Title: {state.get('job_title', 'Unknown')}",
                f"Candidate Name: {state.get('candidate_name', 'Unknown')}",
                f"Job Description: {state.get('job_description', 'Not provided')[:500]}",
                f"Required Skills: {', '.join(state.get('required_skills', []))}",
                f"Candidate Resume: {state.get('candidate_resume', 'Not provided')[:500]}"
            ]
            
            interview_context = self.context_manager.build_context(context_items)
            state['interview_context'] = interview_context
            
            logger.info(f"✅ Interview initialized successfully")
            logger.info(f"   Candidate: {state.get('candidate_name')}")
            logger.info(f"   Position: {state.get('job_title')}")
            logger.info(f"   Target Duration: {state.get('target_duration_minutes', 60)} minutes")
            
            state['processing_status'] = 'in_progress'
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error initializing interview: {str(e)}", exc_info=True)
            state['processing_status'] = 'failed'
            state['last_error'] = str(e)
            state['errors'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'stage': 'initialize_interview',
                'error': str(e)
            })
            return state
    
    def generate_intro(self, state: InterviewState) -> InterviewState:
        """Generate personalized interview introduction"""
        logger.info(f"👋 Generating introduction for {state.get('candidate_name')}")
        
        try:
            # Build context
            context = self.context_manager.build_context([
                f"Candidate Name: {state.get('candidate_name')}",
                f"Job Title: {state.get('job_title')}",
                f"Interviewer Name: {state.get('interviewer_name', 'AI Interviewer')}",
                f"Interview Duration: {state.get('target_duration_minutes', 60)} minutes"
            ])
            
            prompt = f"""You are an AI interviewer conducting a professional job interview.

{context}

Generate a warm, professional introduction that:
1. Welcomes the candidate by name
2. Introduces yourself as the AI interviewer
3. Explains the interview format and structure
4. Sets expectations (duration, question types)
5. Encourages the candidate to ask questions
6. Creates a comfortable atmosphere

Provide JSON response:
{{
    "intro_message": "Complete introduction text",
    "key_points": ["Key points covered in intro"],
    "tone": "professional/friendly/formal"
}}"""
            
            optimized_prompt, token_stats = self.token_optimizer.optimize_prompt(prompt)
            
            logger.info("🤖 Calling Groq LLM for introduction generation")
            response = self.groq_client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": optimized_prompt}],
                temperature=0.7,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            intro_result = response.choices[0].message.content.strip()
            logger.info(f"🔍 LLM Intro Response: {intro_result[:150]}...")
            
            # Parse response
            intro_data = json.loads(intro_result)
            intro_message = intro_data.get('intro_message', '')
            
            # Store in state
            state['current_question'] = intro_message
            state['current_question_type'] = 'intro'
            
            # Add to conversation history
            state['conversation_history'].append({
                'role': 'interviewer',
                'content': intro_message,
                'type': 'intro',
                'timestamp': datetime.utcnow().isoformat()
            })
            
            logger.info(f"✅ Introduction generated ({len(intro_message)} chars)")
            logger.info(f"   Intro: {intro_message[:100]}...")
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error generating introduction: {str(e)}", exc_info=True)
            # Fallback intro
            fallback_intro = f"Hello {state.get('candidate_name', 'there')}! Welcome to your interview for the {state.get('job_title', 'position')}. I'm an AI interviewer, and I'll be guiding you through this conversation today. We'll cover technical questions, behavioral scenarios, and you'll have a chance to ask questions. Let's get started!"
            
            state['current_question'] = fallback_intro
            state['current_question_type'] = 'intro'
            state['conversation_history'].append({
                'role': 'interviewer',
                'content': fallback_intro,
                'type': 'intro',
                'timestamp': datetime.utcnow().isoformat()
            })
            
            state['last_error'] = str(e)
            state['errors'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'stage': 'generate_intro',
                'error': str(e)
            })
            
            return state
    
    def ask_question(self, state: InterviewState) -> InterviewState:
        """Generate and ask next interview question"""
        logger.info(f"❓ Generating question for stage: {state.get('current_stage')}")
        
        try:
            current_stage = state.get('current_stage', 'technical')
            
            # Skip question generation for intro (already done)
            if current_stage == 'intro':
                return state
            
            # Build context with conversation history
            history_context = self._build_conversation_context(state)
            
            context = self.context_manager.build_context([
                f"Interview Stage: {current_stage}",
                f"Job Title: {state.get('job_title')}",
                f"Required Skills: {', '.join(state.get('required_skills', [])[:5])}",
                f"Questions Asked: {state.get('total_questions_asked', 0)}",
                f"Conversation History:\n{history_context}"
            ])
            
            # Stage-specific prompts
            stage_instructions = self._get_stage_instructions(current_stage, state)
            
            prompt = f"""You are an expert technical interviewer conducting a {current_stage} interview.

{context}

{stage_instructions}

Generate ONE question following these guidelines:
- Make it relevant to the job requirements
- Don't repeat previously asked questions
- Build on previous answers if applicable
- Match the difficulty to the role level
- Be specific and clear

Provide JSON response:
{{
    "question": "The interview question",
    "question_type": "{current_stage}",
    "difficulty": "easy/medium/hard",
    "key_concepts": ["concepts being tested"],
    "evaluation_criteria": ["what to look for in answer"]
}}"""
            
            optimized_prompt, token_stats = self.token_optimizer.optimize_prompt(prompt)
            
            logger.info(f"🤖 Calling Groq LLM for {current_stage} question")
            response = self.groq_client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": optimized_prompt}],
                temperature=0.8,
                max_tokens=800,
                response_format={"type": "json_object"}
            )
            
            question_result = response.choices[0].message.content.strip()
            logger.info(f"🔍 LLM Question Response: {question_result[:150]}...")
            
            # Parse response
            question_data = json.loads(question_result)
            question_text = question_data.get('question', '')
            
            # Update state
            state['current_question'] = question_text
            state['current_question_type'] = current_stage
            state['total_questions_asked'] = state.get('total_questions_asked', 0) + 1
            
            # Update stage-specific counter
            if current_stage == 'technical':
                state['technical_questions_count'] = state.get('technical_questions_count', 0) + 1
            elif current_stage == 'behavioral':
                state['behavioral_questions_count'] = state.get('behavioral_questions_count', 0) + 1
            elif current_stage == 'situational':
                state['situational_questions_count'] = state.get('situational_questions_count', 0) + 1
            
            # Store question
            question_record = {
                'question_number': state['total_questions_asked'],
                'question': question_text,
                'type': current_stage,
                'difficulty': question_data.get('difficulty', 'medium'),
                'key_concepts': question_data.get('key_concepts', []),
                'asked_at': datetime.utcnow().isoformat()
            }
            state['questions_asked'].append(question_record)
            
            # Add to conversation history
            state['conversation_history'].append({
                'role': 'interviewer',
                'content': question_text,
                'type': current_stage,
                'timestamp': datetime.utcnow().isoformat()
            })
            
            logger.info(f"✅ Question generated (#{state['total_questions_asked']})")
            logger.info(f"   Type: {current_stage}")
            logger.info(f"   Question: {question_text[:100]}...")
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error generating question: {str(e)}", exc_info=True)
            # Fallback question
            fallback_questions = {
                'technical': f"Can you explain your experience with {state.get('required_skills', ['the technologies'])[0]}?",
                'behavioral': "Tell me about a time when you faced a challenging situation at work. How did you handle it?",
                'situational': "If you were given a tight deadline and limited resources, how would you prioritize your tasks?",
                'qa': "Do you have any questions for us about the role or company?"
            }
            
            fallback_question = fallback_questions.get(state.get('current_stage', 'technical'), "Tell me about your experience.")
            
            state['current_question'] = fallback_question
            state['current_question_type'] = state.get('current_stage', 'technical')
            state['total_questions_asked'] = state.get('total_questions_asked', 0) + 1
            
            state['conversation_history'].append({
                'role': 'interviewer',
                'content': fallback_question,
                'type': state.get('current_stage'),
                'timestamp': datetime.utcnow().isoformat()
            })
            
            state['last_error'] = str(e)
            state['errors'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'stage': 'ask_question',
                'error': str(e)
            })
            
            return state
    
    def process_answer(self, state: InterviewState) -> InterviewState:
        """Process candidate answer from STT"""
        logger.info(f"📝 Processing answer for question #{state.get('total_questions_asked', 0)}")
        
        try:
            answer = state.get('last_answer', '')
            
            if not answer or len(answer) < 10:
                logger.warning("⚠️ Answer too short or empty")
                state['answer_analysis'] = {
                    'completeness': 'incomplete',
                    'relevance': 'unclear',
                    'warning': 'Answer was too short'
                }
                return state
            
            # Add to conversation history
            state['conversation_history'].append({
                'role': 'candidate',
                'content': answer,
                'type': 'answer',
                'timestamp': datetime.utcnow().isoformat()
            })
            
            # Store answer record
            answer_record = {
                'question_number': state.get('total_questions_asked', 0),
                'answer': answer,
                'answer_length': len(answer),
                'received_at': datetime.utcnow().isoformat()
            }
            state['answers_received'].append(answer_record)
            
            logger.info(f"✅ Answer processed ({len(answer)} chars)")
            logger.info(f"   Answer: {answer[:100]}...")
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error processing answer: {str(e)}", exc_info=True)
            state['last_error'] = str(e)
            state['errors'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'stage': 'process_answer',
                'error': str(e)
            })
            return state
    
    def evaluate_response(self, state: InterviewState) -> InterviewState:
        """Evaluate candidate's answer quality and extract insights"""
        logger.info(f"🎯 Evaluating answer for question #{state.get('total_questions_asked', 0)}")
        
        try:
            answer = state.get('last_answer', '')
            current_question = state.get('current_question', '')
            question_type = state.get('current_question_type', 'technical')
            
            # Build context
            context = self.context_manager.build_context([
                f"Question: {current_question}",
                f"Question Type: {question_type}",
                f"Candidate Answer: {answer}",
                f"Job Requirements: {', '.join(state.get('required_skills', [])[:5])}"
            ])
            
            prompt = f"""You are an expert interviewer evaluating a candidate's answer.

{context}

Evaluate this answer comprehensively:

1. **Completeness**: Did they fully answer the question?
2. **Relevance**: How relevant is the answer to what was asked?
3. **Technical Depth**: (for technical questions) Technical accuracy and depth
4. **Communication**: Clarity and structure of the response
5. **Problem Solving**: (if applicable) Problem-solving approach demonstrated
6. **Examples**: Did they provide concrete examples?

Provide detailed JSON response:
{{
    "overall_score": 0-10,
    "completeness_score": 0-10,
    "relevance_score": 0-10,
    "technical_score": 0-10,
    "communication_score": 0-10,
    "problem_solving_score": 0-10,
    "strengths": ["specific strengths in the answer"],
    "weaknesses": ["areas that could be improved"],
    "key_points_mentioned": ["main points from answer"],
    "technical_terms_used": ["technical terms/concepts mentioned"],
    "red_flags": ["any concerning points"],
    "follow_up_needed": true/false,
    "follow_up_reason": "why follow-up is needed",
    "suggested_followup": "suggested follow-up question if needed"
}}"""
            
            optimized_prompt, token_stats = self.token_optimizer.optimize_prompt(prompt)
            
            logger.info("🤖 Calling Groq LLM for answer evaluation")
            response = self.groq_client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": optimized_prompt}],
                temperature=0.3,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )
            
            eval_result = response.choices[0].message.content.strip()
            logger.info(f"🔍 LLM Evaluation Response: {eval_result[:150]}...")
            
            # Parse evaluation
            evaluation = json.loads(eval_result)
            
            # Store evaluation
            state['answer_analysis'] = evaluation
            
            # Update answer record with evaluation
            if state.get('answers_received'):
                state['answers_received'][-1]['evaluation'] = evaluation
            
            # Update scores
            overall_score = evaluation.get('overall_score', 5) / 10.0
            state['overall_score'] = (state.get('overall_score', 0) + overall_score) / 2
            
            if question_type == 'technical':
                tech_score = evaluation.get('technical_score', 5) / 10.0
                state['technical_score'] = (state.get('technical_score', 0) + tech_score) / 2
            
            comm_score = evaluation.get('communication_score', 5) / 10.0
            state['communication_score'] = (state.get('communication_score', 0) + comm_score) / 2
            
            prob_score = evaluation.get('problem_solving_score', 5) / 10.0
            state['problem_solving_score'] = (state.get('problem_solving_score', 0) + prob_score) / 2
            
            # Accumulate insights
            strengths = evaluation.get('strengths', [])
            weaknesses = evaluation.get('weaknesses', [])
            red_flags = evaluation.get('red_flags', [])
            
            state['key_strengths'].extend(strengths)
            state['areas_for_improvement'].extend(weaknesses)
            state['red_flags'].extend(red_flags)
            
            # Determine if follow-up needed
            state['should_ask_followup'] = evaluation.get('follow_up_needed', False)
            
            logger.info(f"✅ Answer evaluated")
            logger.info(f"   Overall Score: {evaluation.get('overall_score', 0)}/10")
            logger.info(f"   Strengths: {len(strengths)}")
            logger.info(f"   Weaknesses: {len(weaknesses)}")
            logger.info(f"   Follow-up Needed: {state['should_ask_followup']}")
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error evaluating response: {str(e)}", exc_info=True)
            # Basic evaluation fallback
            state['answer_analysis'] = {
                'overall_score': 5,
                'evaluation_failed': True,
                'error': str(e)
            }
            state['should_ask_followup'] = False
            
            state['last_error'] = str(e)
            state['errors'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'stage': 'evaluate_response',
                'error': str(e)
            })
            return state
    
    def decide_next_step(self, state: InterviewState) -> InterviewState:
        """Decide whether to ask follow-up, transition stage, or complete interview"""
        logger.info(f"🤔 Deciding next step (Stage: {state.get('current_stage')})")
        
        try:
            current_stage = state.get('current_stage', 'technical')
            
            # Intro stage always transitions directly to technical stage
            if current_stage == 'intro':
                logger.info(f"   Decision: Transition from intro to technical stage")
                state['should_transition_stage'] = True
                state['should_ask_followup'] = False
                state['interview_complete'] = False
                return state

            questions_in_stage = state.get(f'{current_stage}_questions_count', 0)
            target_questions = self.questions_per_stage.get(current_stage, 5)
            
            # Check if follow-up is needed and we haven't asked too many
            if state.get('should_ask_followup', False) and questions_in_stage < target_questions + 2:
                logger.info(f"   Decision: Ask follow-up question")
                state['should_transition_stage'] = False
                state['interview_complete'] = False
                return state
            
            # Check if we should transition to next stage
            if questions_in_stage >= target_questions:
                current_stage_index = self.interview_stages.index(current_stage) if current_stage in self.interview_stages else 0
                
                # Check if there are more stages
                if current_stage_index < len(self.interview_stages) - 1:
                    logger.info(f"   Decision: Transition to next stage")
                    state['should_transition_stage'] = True
                    state['interview_complete'] = False
                    return state
                else:
                    logger.info(f"   Decision: Complete interview")
                    state['should_transition_stage'] = False
                    state['interview_complete'] = True
                    return state
            
            # Continue in current stage
            logger.info(f"   Decision: Ask next question in {current_stage} stage")
            state['should_transition_stage'] = False
            state['interview_complete'] = False
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error deciding next step: {str(e)}", exc_info=True)
            # Default to continuing
            state['should_transition_stage'] = False
            state['interview_complete'] = False
            state['last_error'] = str(e)
            return state
    
    def transition_stage(self, state: InterviewState) -> InterviewState:
        """Transition to next interview stage"""
        logger.info(f"🔄 Transitioning from stage: {state.get('current_stage')}")
        
        try:
            current_stage = state.get('current_stage', 'intro')
            current_stage_index = self.interview_stages.index(current_stage)
            
            # Move to next stage
            if current_stage_index < len(self.interview_stages) - 1:
                next_stage = self.interview_stages[current_stage_index + 1]
                state['current_stage'] = next_stage
                state['stage_transition_count'] = state.get('stage_transition_count', 0) + 1
                
                logger.info(f"✅ Transitioned to: {next_stage}")
                logger.info(f"   Transition count: {state['stage_transition_count']}")
                
                # Add transition message to conversation
                transition_messages = {
                    'technical': "Great! Now let's move on to some technical questions.",
                    'behavioral': "Excellent. Now I'd like to ask some behavioral questions to understand your work style.",
                    'situational': "Thank you. Let's explore some situational scenarios.",
                    'qa': "Before we wrap up, do you have any questions for me about the role or company?",
                    'closing': "Thank you for your time. Let me summarize our conversation."
                }
                
                if next_stage in transition_messages:
                    state['conversation_history'].append({
                        'role': 'interviewer',
                        'content': transition_messages[next_stage],
                        'type': 'transition',
                        'timestamp': datetime.utcnow().isoformat()
                    })
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error transitioning stage: {str(e)}", exc_info=True)
            state['last_error'] = str(e)
            return state
    
    def generate_closing(self, state: InterviewState) -> InterviewState:
        """Generate interview closing message and summary"""
        logger.info(f"👋 Generating closing for interview: {state.get('interview_id')}")
        
        try:
            # Build summary context
            context = self.context_manager.build_context([
                f"Candidate Name: {state.get('candidate_name')}",
                f"Position: {state.get('job_title')}",
                f"Total Questions: {state.get('total_questions_asked', 0)}",
                f"Overall Performance: {state.get('overall_score', 0):.2f}",
                f"Key Strengths: {', '.join(state.get('key_strengths', [])[:3])}",
                f"Duration: {state.get('duration_minutes', 0)} minutes"
            ])
            
            prompt = f"""You are an AI interviewer concluding a professional interview.

{context}

Generate a warm, professional closing that:
1. Thanks the candidate for their time
2. Briefly acknowledges their strengths (without being too specific)
3. Explains next steps in the hiring process
4. Invites any final questions
5. Provides a positive, encouraging tone

Provide JSON response:
{{
    "closing_message": "Complete closing message",
    "next_steps": ["next steps in process"],
    "tone": "appreciative"
}}"""
            
            optimized_prompt, token_stats = self.token_optimizer.optimize_prompt(prompt)
            
            logger.info("🤖 Calling Groq LLM for closing generation")
            response = self.groq_client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": optimized_prompt}],
                temperature=0.7,
                max_tokens=800,
                response_format={"type": "json_object"}
            )
            
            closing_result = response.choices[0].message.content.strip()
            closing_data = json.loads(closing_result)
            closing_message = closing_data.get('closing_message', '')
            
            state['current_question'] = closing_message
            state['current_question_type'] = 'closing'
            state['current_stage'] = 'closing'
            
            # Add to conversation history
            state['conversation_history'].append({
                'role': 'interviewer',
                'content': closing_message,
                'type': 'closing',
                'timestamp': datetime.utcnow().isoformat()
            })
            
            # Calculate final duration
            started_at = datetime.fromisoformat(state.get('started_at', datetime.utcnow().isoformat()))
            duration = (datetime.utcnow() - started_at).total_seconds() / 60
            state['duration_minutes'] = int(duration)
            
            logger.info(f"✅ Closing generated")
            logger.info(f"   Interview Duration: {state['duration_minutes']} minutes")
            logger.info(f"   Total Questions: {state.get('total_questions_asked', 0)}")
            
            state['processing_status'] = 'completed'
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error generating closing: {str(e)}", exc_info=True)
            # Fallback closing
            fallback_closing = f"Thank you so much for your time today, {state.get('candidate_name', 'there')}. It was great learning about your experience and skills. We'll review your interview and get back to you with next steps soon. Do you have any final questions?"
            
            state['current_question'] = fallback_closing
            state['conversation_history'].append({
                'role': 'interviewer',
                'content': fallback_closing,
                'type': 'closing',
                'timestamp': datetime.utcnow().isoformat()
            })
            
            state['processing_status'] = 'completed'
            state['last_error'] = str(e)
            
            return state
    
    def store_interview(self, state: InterviewState) -> InterviewState:
        """Store complete interview in MongoDB"""
        logger.info(f"💾 Storing interview: {state.get('interview_id')}")
        
        try:
            # Prepare interview document
            started_at_val = state.get('started_at')
            if isinstance(started_at_val, str):
                try:
                    started_at_dt = datetime.fromisoformat(started_at_val)
                except Exception:
                    started_at_dt = datetime.utcnow()
            elif isinstance(started_at_val, datetime):
                started_at_dt = started_at_val
            else:
                started_at_dt = datetime.utcnow()

            interview_doc = {
                "interview_id": state.get('interview_id'),
                "session_id": state.get('session_id'),
                "meeting_id": state.get('meeting_id'),
                
                # Participants
                "candidate_email": state.get('candidate_email'),
                "candidate_name": state.get('candidate_name'),
                "interviewer": state.get('interviewer_name', 'AI Interviewer'),
                "job_id": state.get('job_id'),
                "job_title": state.get('job_title'),
                
                # Interview details
                "current_stage": state.get('current_stage', 'intro'),
                "status": "completed" if state.get('interview_complete') else "in_progress",
                "started_at": started_at_dt,
                "completed_at": datetime.utcnow() if state.get('interview_complete') else None,
                "duration_minutes": state.get('duration_minutes', 0),
                
                # Questions and answers
                "total_questions": state.get('total_questions_asked', 0),
                "questions_asked": state.get('questions_asked', []),
                "answers_received": state.get('answers_received', []),
                "conversation_history": state.get('conversation_history', []),
                
                # Scores
                "overall_score": round(state.get('overall_score', 0.0) * 100, 2),
                "technical_score": round(state.get('technical_score', 0.0) * 100, 2),
                "communication_score": round(state.get('communication_score', 0.0) * 100, 2),
                "problem_solving_score": round(state.get('problem_solving_score', 0.0) * 100, 2),
                "cultural_fit_score": round(state.get('cultural_fit_score', 0.0) * 100, 2),
                
                # Insights
                "key_strengths": list(set(state.get('key_strengths', []))),  # Remove duplicates
                "areas_for_improvement": list(set(state.get('areas_for_improvement', []))),
                "red_flags": list(set(state.get('red_flags', []))),
                "notable_achievements": state.get('notable_achievements', []),
                
                # Metadata
                "ai_enabled": True,
                "workflow": "langgraph",
                "mcp_optimized": True,
                "errors": state.get('errors', []),
                "has_errors": len(state.get('errors', [])) > 0,
                
                # Timestamps
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # Store in interviews collection
            interviews_collection = self.db['interviews']
            result = interviews_collection.update_one(
                {"interview_id": interview_doc["interview_id"]},
                {"$set": interview_doc},
                upsert=True
            )
            
            if result.upserted_id:
                logger.info(f"✅ Stored new interview in DB: {interview_doc['interview_id']}")
            else:
                logger.info(f"✅ Updated existing interview in DB: {interview_doc['interview_id']}")
            
            # Update meeting with interview results if meeting_id exists
            if state.get('meeting_id'):
                meetings_collection = self.db['meetings']
                meetings_collection.update_one(
                    {"meeting_id": state['meeting_id']},
                    {
                        "$set": {
                            "interview_id": state['interview_id'],
                            "overall_score": interview_doc['overall_score'],
                            "technical_score": interview_doc['technical_score'],
                            "communication_score": interview_doc['communication_score'],
                            "status": "completed",
                            "completed_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
            
            logger.info(f"📊 Interview Summary:")
            logger.info(f"   Total Questions: {state.get('total_questions_asked', 0)}")
            logger.info(f"   Duration: {state.get('duration_minutes', 0)} minutes")
            logger.info(f"   Overall Score: {interview_doc['overall_score']}/100")
            logger.info(f"   Technical Score: {interview_doc['technical_score']}/100")
            logger.info(f"   Communication Score: {interview_doc['communication_score']}/100")
            
            return state
            
        except Exception as e:
            logger.error(f"❌ Error storing interview: {str(e)}", exc_info=True)
            state['last_error'] = str(e)
            state['errors'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'stage': 'store_interview',
                'error': str(e)
            })
            return state
    
    # ==================== Helper Methods ====================
    
    def _build_conversation_context(self, state: InterviewState, max_messages: int = 5) -> str:
        """Build conversation context from recent history"""
        history = state.get('conversation_history', [])
        recent_history = history[-max_messages:] if len(history) > max_messages else history
        
        context_lines = []
        for msg in recent_history:
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')
            context_lines.append(f"{role.capitalize()}: {content[:200]}")
        
        return "\n".join(context_lines)
    
    def _get_stage_instructions(self, stage: str, state: InterviewState) -> str:
        """Get stage-specific instructions for question generation"""
        instructions = {
            'technical': f"""Generate a technical question about:
- {', '.join(state.get('required_skills', [])[:3])}
- Focus on practical application and problem-solving
- Ask about real-world scenarios
- Probe for depth of understanding""",
            
            'behavioral': """Generate a behavioral question using STAR method:
- Situation: Ask about a specific past experience
- Task: What was their responsibility?
- Action: What did they do?
- Result: What was the outcome?
Examples: teamwork, conflict resolution, leadership, adaptability""",
            
            'situational': """Generate a hypothetical scenario question:
- Present a realistic work challenge
- Ask how they would handle it
- Assess problem-solving approach
- No right/wrong answer, judge reasoning""",
            
            'qa': """Ask if the candidate has questions about:
- The role and responsibilities
- Team structure and culture
- Growth opportunities
- Company vision and values"""
        }
        
        return instructions.get(stage, "Generate a relevant interview question.")
    
    async def _generate_tts_for_text(self, text: str, text_type: str, state: InterviewState) -> Optional[Dict[str, Any]]:
        """
        Generate TTS audio for interview text
        
        Args:
            text: Text to convert to speech
            text_type: Type of text (intro, question, closing, etc.)
            state: Current interview state
            
        Returns:
            TTS result or None if failed
        """
        try:
            logger.info(f"🔊 Generating TTS for {text_type}")
            logger.info(f"   Text: {text[:50]}...")
            
            # Prepare TTS request
            tts_request = {
                "text": text,
                "text_type": text_type,
                "voice_profile": "professional_female",  # Default voice
                "emotion": "professional",
                "session_id": state.get('session_id'),
                "meeting_id": state.get('meeting_id'),
                "interview_id": state.get('interview_id'),
                "model_id": "eleven_multilingual_v2",
                "output_format": "mp3_44100_128"
            }
            
            # Generate TTS
            result = await convert_text_to_speech(tts_request)
            
            if result.get('success'):
                logger.info(f"✅ TTS generated for {text_type}")
                logger.info(f"   TTS ID: {result['data'].get('tts_id')}")
                logger.info(f"   Duration: {result['data'].get('audio_duration_seconds')}s")
                return result['data']
            else:
                logger.warning(f"⚠️ TTS generation failed for {text_type}: {result.get('error')}")
                return None
        
        except Exception as e:
            logger.error(f"❌ Error generating TTS: {str(e)}", exc_info=True)
            return None
    
    async def start_interview(self, interview_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start a new interview session
        
        Args:
            interview_config: Interview configuration
            
        Returns:
            Initial interview state with introduction
        """
        logger.info(f"🎬 Starting new interview session")
        
        try:
            # Initialize state
            interview_id = interview_config.get('interview_id') or f"int_{uuid.uuid4()}"
            session_id = interview_config.get('session_id') or f"session_{uuid.uuid4()}"
            
            initial_state = InterviewState(
                interview_id=interview_id,
                session_id=session_id,
                meeting_id=interview_config.get('meeting_id'),
                
                candidate_email=interview_config.get('candidate_email', ''),
                candidate_name=interview_config.get('candidate_name', 'Candidate'),
                interviewer_name=interview_config.get('interviewer_name', 'AI Interviewer'),
                job_id=interview_config.get('job_id'),
                job_title=interview_config.get('job_title', 'Software Engineer'),
                
                job_description=interview_config.get('job_description', ''),
                candidate_resume=interview_config.get('candidate_resume', ''),
                required_skills=interview_config.get('required_skills', []),
                
                current_stage='intro',
                stage_transition_count=0,
                conversation_history=[],
                questions_asked=[],
                answers_received=[],
                
                current_question='',
                current_question_type='intro',
                last_answer='',
                answer_analysis={},
                
                total_questions_asked=0,
                technical_questions_count=0,
                behavioral_questions_count=0,
                situational_questions_count=0,
                
                overall_score=0.0,
                technical_score=0.0,
                communication_score=0.0,
                problem_solving_score=0.0,
                cultural_fit_score=0.0,
                
                key_strengths=[],
                areas_for_improvement=[],
                red_flags=[],
                notable_achievements=[],
                
                should_ask_followup=False,
                should_transition_stage=False,
                interview_complete=False,
                
                started_at=datetime.utcnow().isoformat(),
                current_time=datetime.utcnow().isoformat(),
                duration_minutes=0,
                target_duration_minutes=interview_config.get('target_duration_minutes', 60),
                
                errors=[],
                last_error='',
                retry_count=0,
                
                processing_status='initializing'
            )
            
            # Run workflow up to introduction
            result = await self.workflow.ainvoke(initial_state)
            
            # Persist initial interview in MongoDB
            self.store_interview(result)
            
            introduction_text = result.get('current_question', '')
            
            # Generate TTS for introduction (if meeting_id provided)
            tts_data = None
            if result.get('meeting_id') and introduction_text:
                logger.info("🎤 Auto-generating TTS for introduction")
                tts_data = await self._generate_tts_for_text(
                    introduction_text,
                    "intro",
                    result
                )
            
            return {
                "success": True,
                "interview_id": result['interview_id'],
                "session_id": result['session_id'],
                "current_stage": result['current_stage'],
                "introduction": introduction_text,
                "tts_audio": tts_data,  # Include TTS data if generated
                "processing_status": result.get('processing_status', 'in_progress'),
                "message": "Interview started successfully"
            }
            
        except Exception as e:
            logger.error(f"❌ Error starting interview: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to start interview"
            }
    
    async def process_candidate_answer(self, answer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process candidate answer and generate next question
        
        Args:
            answer_data: Contains interview_id, answer text, transcription data
            
        Returns:
            Next question or closing message
        """
        logger.info(f"📝 Processing answer for interview: {answer_data.get('interview_id')}")
        
        try:
            # Load interview state from MongoDB
            interview_id = answer_data.get('interview_id')
            interview = self.db['interviews'].find_one({"interview_id": interview_id})
            
            if not interview:
                raise ValueError(f"Interview not found: {interview_id}")
            
            # Reconstruct state
            state = self._reconstruct_state_from_db(interview)
            state['last_answer'] = answer_data.get('answer', '')
            
            # Process through workflow
            # Note: In production, you'd need to handle state persistence differently
            # This is a simplified version
            
            state = self.process_answer(state)
            state = self.evaluate_response(state)
            state = self.decide_next_step(state)
            
            if state.get('interview_complete'):
                state = self.generate_closing(state)
                state = self.store_interview(state)
                
                closing_message = state.get('current_question', '')
                
                # Generate TTS for closing (if meeting_id provided)
                tts_data = None
                if state.get('meeting_id') and closing_message:
                    logger.info("🎤 Auto-generating TTS for closing")
                    tts_data = await self._generate_tts_for_text(
                        closing_message,
                        "closing",
                        state
                    )
                
                return {
                    "success": True,
                    "interview_complete": True,
                    "closing_message": closing_message,
                    "tts_audio": tts_data,
                    "overall_score": state.get('overall_score', 0.0) * 100,
                    "summary": {
                        "total_questions": state.get('total_questions_asked', 0),
                        "duration_minutes": state.get('duration_minutes', 0),
                        "key_strengths": state.get('key_strengths', [])[:3],
                        "areas_for_improvement": state.get('areas_for_improvement', [])[:3]
                    }
                }
            elif state.get('should_transition_stage'):
                state = self.transition_stage(state)
                state = self.ask_question(state)
            else:
                state = self.ask_question(state)
            
            # Update in MongoDB
            self.store_interview(state)
            
            next_question = state.get('current_question', '')
            question_type = state.get('current_question_type', '')
            
            # Generate TTS for next question (if meeting_id provided)
            tts_data = None
            if state.get('meeting_id') and next_question:
                logger.info(f"🎤 Auto-generating TTS for {question_type}")
                tts_data = await self._generate_tts_for_text(
                    next_question,
                    question_type,
                    state
                )
            
            return {
                "success": True,
                "interview_complete": False,
                "next_question": next_question,
                "question_type": question_type,
                "current_stage": state.get('current_stage', ''),
                "question_number": state.get('total_questions_asked', 0),
                "evaluation": state.get('answer_analysis', {}),
                "tts_audio": tts_data  # Include TTS data if generated
            }
            
        except Exception as e:
            logger.error(f"❌ Error processing answer: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to process answer"
            }
    
    def _reconstruct_state_from_db(self, interview_doc: Dict[str, Any]) -> InterviewState:
        """Reconstruct InterviewState from MongoDB document"""
        # This is a helper to rebuild state from stored interview
        # Implementation details depend on your exact storage format
        state = InterviewState(
            interview_id=interview_doc['interview_id'],
            session_id=interview_doc['session_id'],
            meeting_id=interview_doc.get('meeting_id'),
            candidate_email=interview_doc['candidate_email'],
            candidate_name=interview_doc['candidate_name'],
            interviewer_name=interview_doc.get('interviewer', 'AI Interviewer'),
            job_id=interview_doc.get('job_id'),
            job_title=interview_doc['job_title'],
            job_description='',  # Load separately if needed
            candidate_resume='',  # Load separately if needed
            required_skills=[],
            current_stage=interview_doc.get('current_stage', 'intro'),
            stage_transition_count=0,
            conversation_history=interview_doc.get('conversation_history', []),
            questions_asked=interview_doc.get('questions_asked', []),
            answers_received=interview_doc.get('answers_received', []),
            current_question='',
            current_question_type='',
            last_answer='',
            answer_analysis={},
            total_questions_asked=interview_doc.get('total_questions', 0),
            technical_questions_count=0,
            behavioral_questions_count=0,
            situational_questions_count=0,
            overall_score=interview_doc.get('overall_score', 0) / 100.0,
            technical_score=interview_doc.get('technical_score', 0) / 100.0,
            communication_score=interview_doc.get('communication_score', 0) / 100.0,
            problem_solving_score=interview_doc.get('problem_solving_score', 0) / 100.0,
            cultural_fit_score=interview_doc.get('cultural_fit_score', 0) / 100.0,
            key_strengths=interview_doc.get('key_strengths', []),
            areas_for_improvement=interview_doc.get('areas_for_improvement', []),
            red_flags=interview_doc.get('red_flags', []),
            notable_achievements=interview_doc.get('notable_achievements', []),
            should_ask_followup=False,
            should_transition_stage=False,
            interview_complete=False,
            started_at=interview_doc.get('started_at').isoformat() if isinstance(interview_doc.get('started_at'), datetime) else str(interview_doc.get('started_at', datetime.utcnow().isoformat())),
            current_time=datetime.utcnow().isoformat(),
            duration_minutes=interview_doc.get('duration_minutes', 0),
            target_duration_minutes=60,
            errors=interview_doc.get('errors', []),
            last_error='',
            retry_count=0,
            processing_status='in_progress'
        )
        return state
    
    def close(self):
        """Close MongoDB connection"""
        self.mongo_client.close()
        logger.info("✅ Closed MongoDB connection")


# Async helper functions
async def conduct_interview(interview_config: Dict[str, Any]) -> Dict[str, Any]:
    """Start and conduct an interview"""
    agent = InterviewConductorAgent()
    try:
        result = await agent.start_interview(interview_config)
        return result
    finally:
        agent.close()


async def process_interview_answer(answer_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process candidate answer in ongoing interview"""
    agent = InterviewConductorAgent()
    try:
        result = await agent.process_candidate_answer(answer_data)
        return result
    finally:
        agent.close()


if __name__ == "__main__":
    # Test the agent
    print("=" * 80)
    print("Testing Interview Conductor Agent")
    print("=" * 80)
    
    import asyncio
    
    async def test():
        config = {
            "candidate_name": "John Doe",
            "candidate_email": "john@email.com",
            "job_title": "Senior Python Developer",
            "job_description": "We're looking for an experienced Python developer with FastAPI and LangGraph experience.",
            "required_skills": ["Python", "FastAPI", "LangGraph", "MongoDB", "REST APIs"],
            "candidate_resume": "5 years Python experience, worked with FastAPI and microservices.",
            "target_duration_minutes": 60
        }
        
        result = await conduct_interview(config)
        print("\n✅ Interview Started!")
        print(f"Interview ID: {result.get('interview_id')}")
        print(f"Introduction:\n{result.get('introduction')}")
    
    asyncio.run(test())
    print("\n✅ Test complete")
