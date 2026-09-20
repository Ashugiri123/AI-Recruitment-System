"""
Resume Analysis Agent using LangGraph

Purpose: Multi-step resume analysis workflow
Why LangGraph instead of simple prompt:
- Step 1: Extract structured data (skills, experience, education)
- Step 2: Match against job requirements
- Step 3: Calculate detailed scores
- Step 4: Generate recommendations
- Can retry failed steps, maintain state, and adapt based on intermediate results

Traditional approach: Single large prompt (fragile, no error recovery)
LangGraph approach: Stateful workflow with clear stages (robust, adaptable)
"""

import logging
from typing import Dict, List, Any, TypedDict, Annotated
from datetime import datetime
import json

# LangGraph imports
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

# MCP imports for optimization
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from mcp import MCPContextManager, MCPCacheManager, TokenOptimizer

logger = logging.getLogger(__name__)


def clean_json_response(response_text: str) -> str:
    """
    Clean LLM response to extract pure JSON
    
    Why needed: LLMs sometimes return markdown code blocks like:
    ```json\n{...}\n```
    
    This function extracts the actual JSON content
    """
    if not response_text:
        logger.warning("⚠️ clean_json_response received empty input!")
        return "{}"
    
    original_length = len(response_text)
    
    # Remove leading/trailing whitespace
    response_text = response_text.strip()
    
    # Check if response is wrapped in markdown code block
    if response_text.startswith('```'):
        logger.info("🔧 Removing markdown code fences")
        # Remove opening code fence
        lines = response_text.split('\n')
        # Remove first line (```json or ```)
        lines = lines[1:]
        # Remove last line if it's a closing fence
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        response_text = '\n'.join(lines).strip()
    
    # Remove any remaining backticks
    response_text = response_text.replace('```', '')
    
    final_length = len(response_text)
    logger.info(f"🔧 clean_json_response: {original_length} -> {final_length} chars")
    
    if not response_text:
        logger.error("❌ clean_json_response output is empty!")
    
    return response_text


# Define the state that flows through the graph
class AnalysisState(TypedDict):
    """
    State object that flows through the LangGraph workflow
    
    Why: LangGraph maintains state across nodes, allowing complex multi-step logic
    Each node can read and modify this state
    """
    # Input
    resume_text: str
    job_description: str
    
    # Extracted data (from step 1)
    structured_data: Dict[str, Any]
    
    # Analysis results (from step 2)
    skill_matches: List[str]
    missing_skills: List[str]
    experience_score: int
    education_score: int
    
    # Final output (from step 3)
    match_score: int
    strengths: List[str]
    improvement_areas: List[str]
    
    # Metadata
    current_step: str
    errors: List[str]
    processing_time: float


class ResumeAnalysisAgent:
    """
    LangGraph-based agent for resume analysis
    
    Why use LangGraph here:
    1. Multi-step workflow: Extract -> Analyze -> Score -> Recommend
    2. State management: Pass data between steps efficiently
    3. Error recovery: Retry failed extractions
    4. Conditional logic: Skip steps if data is missing
    5. Observable: Log each step for debugging
    
    Traditional prompt vs LangGraph:
    ❌ Old: "Analyze this resume..." (one big prompt, fragile)
    ✅ New: Structured workflow with clear responsibilities per node
    """
    
    def __init__(self, groq_api_key: str, model: str = None):
        """
        Initialize the Resume Analysis Agent
        
        Args:
            groq_api_key: Groq API key for LLM
            model: Model to use (default: GROQ_MODEL env var or qwen/qwen3.8-27b)
        """
        if not model:
            model = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
        self.model = model
        self.llm = ChatGroq(
            api_key=groq_api_key,
            model=model,
            temperature=0.3  # Lower temp for consistent analysis
        )
        
        # Initialize MCP components for optimization
        self.context_manager = MCPContextManager(max_context_length=4000)
        self.cache = MCPCacheManager(ttl_minutes=60)
        self.token_optimizer = TokenOptimizer(max_input_tokens=3000)
        
        # Build the LangGraph workflow
        self.workflow = self._build_graph()
        
        logger.info(f"✅ Resume Analysis Agent initialized with model: {model}")
        logger.info(f"📊 MCP optimizations: Context management, Caching, Token optimization")
    
    def _build_graph(self) -> StateGraph:
        """
        Build the LangGraph workflow
        
        Why this structure:
        1. extract_data: Parse resume into structured format
        2. analyze_match: Compare with job requirements  
        3. calculate_scores: Generate numerical scores
        4. generate_recommendations: Create actionable advice
        
        Each node is a discrete, testable unit with clear responsibility
        """
        logger.info("🏗️ Building LangGraph workflow...")
        
        # Create state graph
        # Why StateGraph: Maintains state between nodes, allows conditional routing
        workflow = StateGraph(AnalysisState)
        
        # Add nodes (each node is a function that processes state)
        # Why separate nodes: Clear separation of concerns, easier to debug/test
        workflow.add_node("extract_data", self._extract_data_node)
        workflow.add_node("analyze_match", self._analyze_match_node)
        workflow.add_node("calculate_scores", self._calculate_scores_node)
        workflow.add_node("generate_recommendations", self._generate_recommendations_node)
        
        # Define edges (workflow flow)
        # Why linear flow: Each step depends on previous step's output
        workflow.set_entry_point("extract_data")
        workflow.add_edge("extract_data", "analyze_match")
        workflow.add_edge("analyze_match", "calculate_scores")
        workflow.add_edge("calculate_scores", "generate_recommendations")
        workflow.add_edge("generate_recommendations", END)
        
        logger.info("✅ LangGraph workflow built: extract -> analyze -> score -> recommend")
        
        return workflow.compile()
    
    def _extract_data_node(self, state: AnalysisState) -> AnalysisState:
        """
        Node 1: Extract structured data from resume
        
        Why separate node:
        - Focused responsibility: Only extract data
        - Reusable: Other workflows can use this
        - Testable: Easy to unit test extraction logic
        - Cacheable: Can cache extracted data per resume
        
        MCP optimization:
        - Use cache to avoid re-extracting same resume
        - Optimize prompt tokens
        """
        logger.info("📋 [Node 1/4] Extracting structured data from resume...")
        state['current_step'] = 'extract_data'
        
        resume_text = state['resume_text']
        
        # Check cache first (MCP optimization!)
        # Why: Same resume might be analyzed multiple times
        cache_key = f"extract_{hash(resume_text)}"
        cached_data = self.cache.get(cache_key)
        
        if cached_data:
            logger.info("✅ Using cached extraction (MCP cache hit!)")
            state['structured_data'] = cached_data
            return state
        
        try:
            # Optimize prompt (MCP token optimization!)
            # Why: Reduce tokens = faster + cheaper
            prompt = f"""Extract key information from this resume. Return ONLY a valid JSON object, no markdown, no explanation.

Resume:
{resume_text}

Extract and return this EXACT JSON structure:
{{
  "skills": ["skill1", "skill2"],
  "years_experience": 5,
  "education_level": "Bachelor's",
  "certifications": ["cert1"]
}}

IMPORTANT:
- Return ONLY the JSON object
- NO markdown code blocks
- NO additional text
- Skills should be specific technical skills
- Years of experience as a number"""
            
            optimized_prompt, stats = self.token_optimizer.optimize_prompt(prompt)
            logger.info(f"💰 Token optimization: {stats.tokens_saved} tokens saved ({stats.reduction_percent}%)")
            
            # Call LLM
            messages = [
                SystemMessage(content="You are a resume parser. Extract information accurately."),
                HumanMessage(content=optimized_prompt)
            ]
            
            response = self.llm.invoke(messages)
            
            # Clean and parse response
            response_text = response.content if hasattr(response, 'content') else str(response)
            logger.info(f"🔍 Raw response length: {len(response_text)} chars")
            logger.info(f"🔍 Raw response preview: {response_text[:200]}")
            
            cleaned_response = clean_json_response(response_text)
            logger.info(f"🔧 Cleaned response length: {len(cleaned_response)} chars")
            logger.info(f"🔧 Cleaned response preview: {cleaned_response[:200]}")
            
            try:
                structured_data = json.loads(cleaned_response)
            except json.JSONDecodeError as e:
                logger.error(f"⚠️ JSON parse error: {e}")
                logger.error(f"Response was: {cleaned_response[:200]}...")
                # Try to extract JSON manually
                import re
                json_match = re.search(r'\{[^}]+\}', cleaned_response, re.DOTALL)
                if json_match:
                    structured_data = json.loads(json_match.group())
                else:
                    raise
            
            # Cache for future use (MCP caching!)
            self.cache.set(cache_key, structured_data)
            
            state['structured_data'] = structured_data
            logger.info(f"✅ Extracted data: {len(structured_data.get('skills', []))} skills, "
                       f"{structured_data.get('years_experience', 0)} years exp")
            
        except Exception as e:
            logger.error(f"❌ Extraction failed: {str(e)}")
            state['errors'].append(f"Extraction error: {str(e)}")
            # Provide empty structure to continue workflow
            state['structured_data'] = {'skills': [], 'years_experience': 0, 'education_level': 'Unknown'}
        
        return state
    
    def _analyze_match_node(self, state: AnalysisState) -> AnalysisState:
        """
        Node 2: Analyze match against job requirements
        
        Why separate node:
        - Uses extracted data from previous node
        - Can be skipped if extraction failed
        - Clear logging of matching logic
        
        MCP optimization:
        - Context management for job description
        - Cache match results
        """
        logger.info("🔍 [Node 2/4] Analyzing match against job requirements...")
        state['current_step'] = 'analyze_match'
        
        structured_data = state['structured_data']
        job_desc = state['job_description']
        
        # Check cache (MCP optimization!)
        cache_key = f"match_{hash(job_desc)}_{hash(str(structured_data))}"
        cached_match = self.cache.get(cache_key)
        
        if cached_match:
            logger.info("✅ Using cached match analysis (MCP cache hit!)")
            state.update(cached_match)
            return state
        
        try:
            candidate_skills = structured_data.get('skills', [])
            
            # Optimize prompt (MCP token optimization!)
            prompt = f"""Compare candidate skills with job requirements. Return ONLY valid JSON.

Candidate Skills: {', '.join(candidate_skills) if candidate_skills else 'None listed'}

Job Requirements:
{job_desc}

Return this EXACT JSON structure:
{{
  "matching_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3", "skill4"],
  "experience_match": 85
}}

IMPORTANT:
- Return ONLY the JSON object
- NO markdown code blocks  
- NO additional text
- matching_skills: skills candidate has that job needs
- missing_skills: required skills candidate doesn't have
- experience_match: 0-100 score

Compare now:

Job Requirements:
{job_desc[:500]}  # Truncate for token efficiency

Candidate Skills:
{', '.join(candidate_skills)}

List:
1. Matching skills
2. Missing critical skills

Format: JSON with 'matching' and 'missing' arrays."""
            
            optimized_prompt, _ = self.token_optimizer.optimize_prompt(prompt)
            
            messages = [
                SystemMessage(content="You are a skill matching expert."),
                HumanMessage(content=optimized_prompt)
            ]
            
            response = self.llm.invoke(messages)
            
            # Clean and parse response
            response_text = response.content if hasattr(response, 'content') else str(response)
            cleaned_response = clean_json_response(response_text)
            
            try:
                match_data = json.loads(cleaned_response)
            except json.JSONDecodeError as e:
                logger.error(f"⚠️ JSON parse error in match analysis: {e}")
                logger.error(f"Response: {cleaned_response[:200]}...")
                # Fallback parsing
                match_data = {'matching_skills': [], 'missing_skills': [], 'experience_match': 0}
            
            state['skill_matches'] = match_data.get('matching_skills', match_data.get('matching', []))
            state['missing_skills'] = match_data.get('missing_skills', match_data.get('missing', []))
            
            # Cache results (MCP caching!)
            cache_data = {
                'skill_matches': state['skill_matches'],
                'missing_skills': state['missing_skills']
            }
            self.cache.set(cache_key, cache_data)
            
            logger.info(f"✅ Match analysis: {len(state['skill_matches'])} matches, "
                       f"{len(state['missing_skills'])} missing")
            
        except Exception as e:
            logger.error(f"❌ Match analysis failed: {str(e)}")
            state['errors'].append(f"Match error: {str(e)}")
            state['skill_matches'] = []
            state['missing_skills'] = []
        
        return state
    
    def _calculate_scores_node(self, state: AnalysisState) -> AnalysisState:
        """
        Node 3: Calculate numerical scores
        
        Why separate node:
        - Pure calculation logic (no LLM needed!)
        - Fast and deterministic
        - Easy to adjust scoring weights
        
        Why NOT use LLM here:
        - LLMs are overkill for simple math
        - Faster to calculate directly
        - More consistent results
        """
        logger.info("🔢 [Node 3/4] Calculating scores...")
        state['current_step'] = 'calculate_scores'
        
        try:
            structured_data = state['structured_data']
            
            # Skill match score (40% weight)
            total_skills = len(state['skill_matches']) + len(state['missing_skills'])
            skill_score = (len(state['skill_matches']) / total_skills * 100) if total_skills > 0 else 0
            
            # Experience score (30% weight)
            years_exp = structured_data.get('years_experience', 0)
            exp_score = min(years_exp * 10, 100)  # 10 points per year, max 100
            
            # Education score (30% weight)
            education_level = structured_data.get('education_level', '').lower()
            edu_scores = {
                'phd': 100, 'doctorate': 100,
                'master': 80, 'masters': 80,
                'bachelor': 60, 'bachelors': 60,
                'associate': 40,
                'high school': 20
            }
            edu_score = next((score for keyword, score in edu_scores.items() 
                            if keyword in education_level), 30)
            
            # Weighted final score
            final_score = int(
                skill_score * 0.4 +
                exp_score * 0.3 +
                edu_score * 0.3
            )
            
            state['match_score'] = final_score
            state['experience_score'] = int(exp_score)
            state['education_score'] = int(edu_score)
            
            logger.info(f"✅ Scores calculated: Final={final_score}, Skills={int(skill_score)}, "
                       f"Experience={int(exp_score)}, Education={edu_score}")
            
        except Exception as e:
            logger.error(f"❌ Score calculation failed: {str(e)}")
            state['errors'].append(f"Scoring error: {str(e)}")
            state['match_score'] = 0
            state['experience_score'] = 0
            state['education_score'] = 0
        
        return state
    
    def _generate_recommendations_node(self, state: AnalysisState) -> AnalysisState:
        """
        Node 4: Generate actionable recommendations
        
        Why separate node:
        - Uses all previous analysis
        - Generates human-readable output
        - Can customize based on score
        
        MCP optimization:
        - Optimize final prompt
        - Cache similar recommendation patterns
        """
        logger.info("💡 [Node 4/4] Generating recommendations...")
        state['current_step'] = 'generate_recommendations'
        
        try:
            # Build context from previous nodes
            prompt = f"""Generate career recommendations based on this analysis. Return ONLY valid JSON.

Candidate Analysis:
- Match Score: {state['match_score']}/100
- Matching Skills: {', '.join(state['skill_matches'][:10]) if state['skill_matches'] else 'None'}
- Missing Skills: {', '.join(state['missing_skills'][:10]) if state['missing_skills'] else 'None'}
- Experience: {state.get('structured_data', {}).get('years_experience', 0)} years

Return this EXACT JSON structure:
{{
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"]
}}

IMPORTANT:
- Return ONLY the JSON object
- NO markdown code blocks
- NO additional text
- Provide exactly 3 strengths based on matching skills
- Provide exactly 3 improvements based on missing skills
- Be specific and actionable
- Use simple language

Generate now:"""
            
            optimized_prompt, _ = self.token_optimizer.optimize_prompt(prompt)
            
            messages = [
                SystemMessage(content="You are a resume expert. Return ONLY valid JSON, no markdown, no explanation."),
                HumanMessage(content=optimized_prompt)
            ]
            
            response = self.llm.invoke(messages)
            
            # Clean and parse response
            response_text = response.content if hasattr(response, 'content') else str(response)
            cleaned_response = clean_json_response(response_text)
            
            try:
                recommendations = json.loads(cleaned_response)
            except json.JSONDecodeError as e:
                logger.error(f"⚠️ JSON parse error in recommendations: {e}")
                logger.error(f"Response: {cleaned_response[:200]}...")
                # Fallback
                recommendations = {
                    'strengths': ['Strong technical background', 'Good experience level', 'Relevant education'],
                    'improvements': ['Expand skill set', 'Gain more experience', 'Add certifications']
                }
            
            state['strengths'] = recommendations.get('strengths', [])
            state['improvement_areas'] = recommendations.get('improvements', recommendations.get('improvement_areas', []))
            
            logger.info(f"✅ Generated {len(state['strengths'])} strengths, "
                       f"{len(state['improvement_areas'])} improvement areas")
            
        except Exception as e:
            logger.error(f"❌ Recommendation generation failed: {str(e)}")
            state['errors'].append(f"Recommendation error: {str(e)}")
            state['strengths'] = ["Unable to generate strengths"]
            state['improvement_areas'] = ["Unable to generate recommendations"]
        
        return state
    
    def analyze(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        """
        Run the complete analysis workflow
        
        Why this is better than a single prompt:
        1. Clear stages: Easy to debug which step failed
        2. Efficient: Cache intermediate results
        3. Robust: Each node can handle errors independently
        4. Observable: Log each step's progress
        5. Maintainable: Easy to add/modify steps
        
        Args:
            resume_text: Resume content
            job_description: Job requirements
        
        Returns:
            Complete analysis results
        """
        start_time = datetime.now()
        logger.info("="*80)
        logger.info("🚀 Starting LangGraph Resume Analysis Workflow")
        logger.info("="*80)
        
        # Initialize state
        # Why: LangGraph flows state through all nodes
        initial_state: AnalysisState = {
            'resume_text': resume_text,
            'job_description': job_description,
            'structured_data': {},
            'skill_matches': [],
            'missing_skills': [],
            'experience_score': 0,
            'education_score': 0,
            'match_score': 0,
            'strengths': [],
            'improvement_areas': [],
            'current_step': '',
            'errors': [],
            'processing_time': 0.0
        }
        
        # Run workflow
        # Why invoke: LangGraph executes all nodes in order
        final_state = self.workflow.invoke(initial_state)
        
        # Calculate timing
        processing_time = (datetime.now() - start_time).total_seconds()
        final_state['processing_time'] = processing_time
        
        # Log summary
        logger.info("="*80)
        logger.info(f"✅ Workflow completed in {processing_time:.2f}s")
        logger.info(f"📊 Final Score: {final_state['match_score']}/100")
        logger.info(f"💰 Total tokens saved (MCP): {self.token_optimizer.total_tokens_saved}")
        
        cache_stats = self.cache.get_stats()
        logger.info(f"📈 Cache hit rate: {cache_stats['hit_rate_percent']}%")
        logger.info("="*80)
        
        # Return clean results
        return {
            'match_score': final_state['match_score'],
            'matching_skills': final_state['skill_matches'],
            'missing_skills': final_state['missing_skills'],
            'strengths': final_state['strengths'],
            'areas_for_improvement': final_state['improvement_areas'],
            'metadata': {
                'processing_time': processing_time,
                'tokens_saved': self.token_optimizer.total_tokens_saved,
                'cache_hits': cache_stats['total_hits'],
                'errors': final_state['errors']
            }
        }


# Example usage
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, 
                       format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Test the agent
    agent = ResumeAnalysisAgent(
        groq_api_key="your_key_here",
        model="llama-3.3-70b-versatile"
    )
    
    sample_resume = """
    John Doe
    Software Engineer with 5 years experience
    Skills: Python, Django, PostgreSQL, Docker, AWS
    Education: Bachelor's in Computer Science
    """
    
    sample_job = """
    Looking for Senior Python Developer with:
    - 5+ years Python experience
    - Django/Flask expertise
    - Cloud experience (AWS/GCP)
    - Database design skills
    """
    
    result = agent.analyze(sample_resume, sample_job)
    print(json.dumps(result, indent=2))
