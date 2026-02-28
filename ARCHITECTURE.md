# NeuroTutor AI - Architecture & Design

## Overview

NeuroTutor AI is a neuroscience-backed mobile AI tutor that combines:

1. **DeepTutor's Multi-Agent Architecture** - Dual-loop reasoning with specialized agents
2. **Feynman Technique** - Teaching concepts in simple language to identify gaps
3. **Spaced Repetition & Active Recall** - Evidence-based memory consolidation
4. **Knowledge Graphs (LightRAG)** - Semantic concept relationships
5. **Theory of Mind** - Adaptive teaching based on student mental models
6. **Memory Systems** - Separate tracking of short-term and long-term memory

## Core Principles

### The 2-Sigma Problem Solution

DeepTutor was designed to solve Bloom's 2-Sigma Problem: achieving the learning gains of human tutoring (2 standard deviations above classroom average) using AI. NeuroTutor builds on this foundation by:

- Using **Socratic dialogue** to force students to articulate missing knowledge
- Implementing **progressive hints and scaffolding** for deep learning
- Triggering **active recall** through adaptive questioning
- Consolidating learning through **spaced repetition**

### Feynman Technique Integration

The app implements Richard Feynman's 4-step learning method:

1. **Choose Concept** - Student selects a topic
2. **Teach Simply** - Student explains in plain language (Feynman Technique)
3. **Identify Gaps** - AI detects misconceptions and missing connections
4. **Refine** - AI provides targeted explanations to fill gaps

### Neuroscience-Backed Learning

Based on cognitive psychology and neuroscience research:

- **Memory Consolidation** - Spaced repetition moves knowledge from STM → LTM
- **Active Recall** - Testing strengthens neural pathways better than passive review
- **Relating to Known Knowledge** - New concepts linked to existing mental models
- **Misconception Detection** - Identifies and corrects false beliefs
- **Spacing Effect** - Optimal review intervals (1, 3, 7, 21 days)

## Architecture Layers

### 1. Frontend (Mobile App)

**Tech Stack**: React Native, Expo, NativeWind (Tailwind CSS), TypeScript

**Key Screens**:
- **Home/Dashboard** - Learning streak, progress, recommendations
- **AI Tutor Chat** - Main learning interface with Feynman Technique
- **Active Recall Quiz** - Adaptive quizzes with spaced repetition
- **Knowledge Graph** - Visual concept relationships
- **Memory Dashboard** - STM/LTM tracking
- **Teach-Back** - Student explanations with AI analysis
- **Progress & Mastery** - Learning analytics

### 2. Learning Engine (Local)

**Services**:

#### `LearningEngineService`
- Memory state management (STM/LTM)
- Spaced repetition scheduling (SM-2 algorithm)
- Mastery level progression (Novice → Expert)
- Consolidation progress calculation
- Mental model management (Theory of Mind)

#### `AITutorService`
- Feynman-style explanations
- Student explanation analysis
- Follow-up question generation
- Quiz evaluation
- Misconception correction

#### `DeepTutorIntegrationService`
- **QuestionGen** - Adaptive quiz generation based on forgetting curve
- **DR-in-KG** - Deep Research in Knowledge Graph for concept relationships
- **Multi-Agent Problem Solving** - Decompose complex problems
- **Exercise Generation** - Customized practice problems
- **Idea Generation** - Novel applications and connections
- **Personal Knowledge Base** - User's learning repository

### 3. Backend (DeepTutor)

**Multi-Agent Architecture**:

```
┌─────────────────────────────────────────┐
│      Dual-Loop Reasoning System         │
├─────────────────────────────────────────┤
│  Retrieval Agent  │  Solver Agent       │
│  (RAG + LightRAG) │  (Code Execution)   │
├─────────────────────────────────────────┤
│  Validator Agent  │  Explainer Agent    │
│  (Correctness)    │  (Feynman-style)    │
└─────────────────────────────────────────┘
```

**Key Components**:

- **RAG Pipeline** - Retrieves relevant information from knowledge base
- **LightRAG** - Knowledge graph for semantic concept relationships
- **QuestionGen** - Generates adaptive quiz questions
- **Exercise Gen** - Creates practice problems
- **Idea Gen** - Brainstorms novel applications
- **LLM Service** - Gemini API for natural language processing

### 4. Data Models

#### Concept
```typescript
{
  id: string;
  name: string;
  description: string;
  category: "math" | "science" | "history" | "language" | "technology";
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  prerequisites: string[]; // IDs of prerequisite concepts
  relatedConcepts: string[];
  keyPoints: string[];
  commonMisconceptions: string[];
  realWorldApplications: string[];
}
```

#### ConceptMemoryState
```typescript
{
  conceptId: string;
  memoryType: "short_term" | "long_term";
  masteryLevel: "novice" | "intermediate" | "proficient" | "expert";
  retentionScore: number; // 0-100
  reviewCount: number;
  correctAnswers: number;
  totalAttempts: number;
  consolidationProgress: number; // 0-100, STM → LTM transition
  nextReviewDate: number; // timestamp
}
```

#### StudentMentalModel (Theory of Mind)
```typescript
{
  learningStyle: "visual" | "verbal" | "kinesthetic" | "reading_writing";
  communicationPreference: "encouraging" | "neutral" | "formal" | "socratic";
  explanationDepth: "simple" | "moderate" | "detailed" | "expert";
  knownConcepts: string[]; // IDs of known concepts
  strugglingConcepts: string[];
  motivationLevel: number; // 0-100
  confidenceLevel: number; // 0-100
}
```

## Learning Flow

### 1. Initial Learning Session

```
User selects topic
    ↓
AI generates Feynman-style simple explanation
    ↓
Student asks questions or explains concept
    ↓
AI analyzes explanation for gaps/misconceptions
    ↓
AI provides targeted follow-up explanations
    ↓
Concept added to Short-Term Memory (STM)
    ↓
Spaced repetition schedule initiated (1-day review)
```

### 2. Spaced Repetition & Active Recall

```
Concept reaches next review date
    ↓
DeepTutor QuestionGen generates adaptive quiz
    ↓
Student takes quiz (active recall)
    ↓
Quiz performance evaluated
    ↓
If 80%+ accuracy:
  - Mastery level increases
  - Review interval extends (3 days)
  - Consolidation progress increases
Else:
  - Review interval resets (1 day)
  - Misconceptions identified
  - Targeted correction provided
    ↓
After 3+ reviews with 80%+ accuracy:
  - Concept moves to Long-Term Memory (LTM)
  - Review interval becomes 21+ days
```

### 3. Knowledge Graph & Skill Transfer

```
Student learns new concept
    ↓
DeepTutor DR-in-KG maps concept relationships
    ↓
Prerequisites identified
    ↓
Related concepts suggested
    ↓
Skill transfer opportunities identified
    ↓
Explanations use analogies to known concepts
    ↓
Student understanding deepened through connections
```

### 4. Teach-Back (Feynman Technique)

```
Student selects "Teach-Back" feature
    ↓
Prompt: "Explain [concept] as if teaching a 10-year-old"
    ↓
Student types explanation
    ↓
AI analyzes for:
  - Accuracy
  - Missing key points
  - Misconceptions
  - Clarity
    ↓
AI provides corrected explanation
    ↓
Student understanding updated
    ↓
Memory state adjusted based on explanation quality
```

## Key Algorithms

### SM-2 Spaced Repetition Algorithm

```
If quality < 3 (failed):
  - Reset interval to 1 day
  - Decrease ease factor
Else (passed):
  - If first review: 1 day
  - If second review: 3 days
  - Else: interval = interval × ease_factor
  - Increase ease factor slightly
```

### Consolidation Progress Calculation

```
consolidationProgress = (accuracy × 0.4) + (reviews × 0.35) + (time × 0.25)

Where:
- accuracy = correct_answers / total_attempts × 100
- reviews = min(review_count × 20, 100)
- time = min((days_since_first_review / 21) × 100, 100)
```

### Mastery Level Progression

```
Novice → Intermediate: quiz_score ≥ 70% AND reviews ≥ 1
Intermediate → Proficient: quiz_score ≥ 80% AND reviews ≥ 2
Proficient → Expert: quiz_score ≥ 90% AND reviews ≥ 3
```

## Integration Points

### With DeepTutor Backend

1. **QuestionGen API** - `/api/deeptutor/questiongen`
   - Input: Concept IDs, decay factors, difficulty
   - Output: Adaptive quiz questions

2. **Knowledge Graph API** - `/api/deeptutor/knowledge-graph`
   - Input: Concept name, description
   - Output: Prerequisites, related concepts, transferable skills

3. **Deep Research API** - `/api/deeptutor/deep-research`
   - Input: Concept name, related concepts, depth
   - Output: Comprehensive explanations with applications

4. **Skill Transfer API** - `/api/deeptutor/skill-transfer`
   - Input: New concept, core schemas, student background
   - Output: Explanations with analogies and transfer patterns

5. **Multi-Agent Solve API** - `/api/deeptutor/multi-agent-solve`
   - Input: Problem, concept ID, related concepts
   - Output: Step-by-step solution with agent contributions

### With Gemini API

- Natural language understanding for student questions
- Explanation generation using Feynman Technique
- Misconception detection and correction
- Adaptive response generation based on mental model

### With Local Storage (AsyncStorage)

- Memory states (STM/LTM)
- Spaced repetition schedules
- Mental models
- Session history
- User preferences

## Performance Optimization

### Caching Strategy

- **Concepts**: Loaded once, cached locally
- **Memory States**: Updated after each interaction
- **Spaced Repetition Schedules**: Computed on-demand
- **Quiz Questions**: Generated fresh for each quiz

### Lazy Loading

- Screens load data only when needed
- Knowledge graph rendered incrementally
- Chat messages streamed as they arrive

### Offline Support

- Core learning engine works offline
- Sync with backend when connection available
- Local storage as primary data source

## Testing Strategy

### Unit Tests

- Learning engine logic (memory, spaced repetition, mastery)
- Consolidation progress calculations
- SM-2 algorithm implementation

### Integration Tests

- DeepTutor API integration
- Gemini API integration
- Quiz flow end-to-end

### User Testing

- Feynman Technique effectiveness
- Memory consolidation validation
- Misconception detection accuracy

## Future Enhancements

1. **Adaptive Difficulty** - Adjust content difficulty based on performance
2. **Peer Learning** - Students teach each other concepts
3. **Gamification** - Achievements, leaderboards, streaks
4. **Mobile Offline** - Full offline support with sync
5. **Voice Input** - Speech-to-text for explanations
6. **Video Explanations** - AI-generated video tutorials
7. **Personalized Learning Paths** - AI-recommended curriculum
8. **Predictive Analytics** - Predict concepts student will struggle with
9. **Export Learning Data** - Export progress and insights
10. **Multi-language Support** - Support for multiple languages

## References

- **DeepTutor (2025)** - HKUDS, GitHub: https://github.com/HKUDS/DeepTutor
- **Mr. Ranedeer AI Tutor** - Customizable Feynman-based tutoring prompt
- **Bloom's 2-Sigma Problem** - Achieving human tutoring effectiveness with AI
- **Spaced Repetition** - SM-2 algorithm for optimal review scheduling
- **Active Recall** - Cognitive psychology research on memory consolidation
- **Theory of Mind** - Adaptive tutoring based on student mental models
- **Knowledge Graphs** - LightRAG for semantic concept relationships
