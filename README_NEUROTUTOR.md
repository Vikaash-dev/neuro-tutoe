# NeuroTutor AI - Neuroscience-Backed AI Tutor Mobile App

## Overview

NeuroTutor AI is a cutting-edge mobile application that combines neuroscience research, the Feynman Technique, and advanced AI to help students achieve **superunderstanding** of complex topics. The app integrates multiple evidence-based learning principles to create an adaptive, personalized tutoring experience.

## Core Features

### 🧠 Neuroscience-Backed Learning

- **Spaced Repetition (SM-2 Algorithm)**: Optimal review intervals (1, 3, 7, 21 days) for long-term memory consolidation
- **Active Recall**: Adaptive quizzes that test knowledge and strengthen neural pathways
- **Memory Consolidation**: Tracks short-term memory (STM) to long-term memory (LTM) transition
- **Misconception Detection**: AI identifies and corrects false beliefs
- **Theory of Mind**: Adaptive teaching based on student mental models

### 📚 Feynman Technique Integration

1. **Choose Concept**: Select a topic to learn
2. **Teach Simply**: Explain the concept in plain language
3. **Identify Gaps**: AI detects misconceptions and missing connections
4. **Refine**: Receive targeted explanations to fill gaps

### 🤖 AI-Powered Tutoring

- **Gemini API Integration**: Google's advanced AI model for adaptive explanations
- **Multi-Agent Problem Solving**: DeepTutor's dual-loop reasoning for complex problems
- **Knowledge Graph (LightRAG)**: Semantic concept relationships and skill transfer
- **Adaptive Responses**: Personalized explanations based on learning style and depth preference

### 📊 Learning Analytics

- **Mastery Levels**: Novice → Intermediate → Proficient → Expert progression
- **Progress Tracking**: Visual dashboards showing learning journey
- **Retention Scoring**: Real-time memory retention estimates
- **Achievement System**: Milestones and learning streaks

### 🎯 Key Screens

1. **Onboarding** - Personalize learning preferences (style, depth, communication tone)
2. **Home/Dashboard** - Learning streak, progress, recommended topics
3. **AI Tutor Chat** - Main learning interface with Feynman-style explanations
4. **Active Recall Quiz** - Adaptive quizzes with spaced repetition
5. **Knowledge Graph** - Visual concept relationships and prerequisites
6. **Memory Dashboard** - STM/LTM tracking and consolidation progress
7. **Teach-Back** - Student explanations with AI analysis
8. **Progress & Mastery** - Learning analytics and achievements
9. **Quiz Results** - Performance metrics and retention scoring

## Technology Stack

### Frontend
- **React Native 0.81** with Expo SDK 54
- **TypeScript 5.9** for type safety
- **NativeWind 4** (Tailwind CSS for React Native)
- **Expo Router 6** for navigation
- **React Native Reanimated 4** for animations

### Backend & AI
- **Google Gemini 2.5 Flash** for adaptive explanations
- **DeepTutor Architecture** for multi-agent problem solving
- **AsyncStorage** for local data persistence
- **LightRAG** for knowledge graph relationships

### Testing
- **Vitest** for unit tests
- **21 passing tests** validating core learning logic

## Project Structure

```
neuro-tutor-ai/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigation
│   │   └── index.tsx            # Home/Dashboard screen
│   ├── onboarding.tsx           # Learning preferences setup
│   ├── tutor-chat.tsx           # Main AI tutor interface
│   ├── active-recall-quiz.tsx   # Adaptive quizzes
│   ├── quiz-results.tsx         # Performance feedback
│   ├── knowledge-graph.tsx      # Concept relationships
│   ├── memory-dashboard.tsx     # STM/LTM tracking
│   ├── teach-back.tsx           # Feynman explanation input
│   └── progress-mastery.tsx     # Learning analytics
├── lib/
│   ├── types/
│   │   └── learning.ts          # Core data types
│   ├── services/
│   │   ├── learning-engine.ts   # Spaced repetition & memory
│   │   ├── ai-tutor.ts          # Feynman technique logic
│   │   ├── gemini-api.ts        # Gemini API integration
│   │   ├── deeptutor-integration.ts # DeepTutor features
│   │   └── __tests__/           # Unit tests
│   ├── data/
│   │   └── sample-concepts.ts   # Sample learning content
│   └── utils.ts                 # Utility functions
├── components/
│   ├── screen-container.tsx     # SafeArea wrapper
│   ├── themed-view.tsx          # Theme-aware views
│   └── ui/
│       └── icon-symbol.tsx      # Icon mapping
├── hooks/
│   ├── use-colors.ts            # Theme colors
│   ├── use-color-scheme.ts      # Dark/light mode
│   └── use-auth.ts              # Auth state
├── constants/
│   └── theme.ts                 # Color palette
├── assets/
│   └── images/
│       ├── icon.png             # App icon
│       ├── splash-icon.png      # Splash screen
│       └── favicon.png          # Web favicon
├── ARCHITECTURE.md              # System design documentation
├── design.md                    # UI/UX design principles
├── todo.md                      # Feature tracking
└── app.config.ts                # Expo configuration
```

## Getting Started

### Prerequisites

- Node.js 22.13.0+
- pnpm 9.12.0+
- Expo CLI
- Gemini API Key (provided)

### Installation

```bash
cd /home/ubuntu/neuro-tutor-ai

# Install dependencies
pnpm install

# Set up environment variables
# GEMINI_API_KEY is already configured in the system

# Start development server
pnpm dev
```

### Running the App

**Web Preview:**
```bash
pnpm dev:metro
# Opens at http://localhost:8081
```

**iOS (Expo Go):**
```bash
pnpm ios
# Or scan QR code in Expo Go app
```

**Android (Expo Go):**
```bash
pnpm android
# Or scan QR code in Expo Go app
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test lib/services/__tests__/learning-engine.test.ts

# Watch mode
pnpm test --watch
```

## Core Algorithms

### Spaced Repetition (SM-2)

The app uses the SM-2 algorithm for optimal review scheduling:

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

### Consolidation Progress

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
AI generates adaptive quiz questions
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

### 3. Teach-Back (Feynman Technique)

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

## Gemini API Integration

The app uses Google's Gemini 2.5 Flash model for:

1. **Simple Explanations** - Feynman-style teaching
2. **Explanation Analysis** - Detecting gaps and misconceptions
3. **Follow-up Questions** - Socratic questioning
4. **Quiz Generation** - Adaptive questions based on mastery level
5. **Misconception Correction** - Targeted remediation
6. **Adaptive Responses** - Personalized tutor responses

### API Methods

```typescript
// Generate simple explanation
await GeminiAPIService.generateSimpleExplanation(
  conceptName, description, keyPoints, learningStyle
);

// Analyze student explanation
await GeminiAPIService.analyzeStudentExplanation(
  studentExplanation, correctConcept, keyPoints, commonMisconceptions
);

// Generate follow-up questions
await GeminiAPIService.generateFollowUpQuestions(
  conceptName, identifiedGaps, learningStyle, count
);

// Generate quiz questions
await GeminiAPIService.generateQuizQuestions(
  conceptName, masteryLevel, learningStyle, count
);

// Correct misconceptions
await GeminiAPIService.correctMisconception(
  misconception, correctConcept, keyPoints
);

// Generate adaptive response
await GeminiAPIService.generateAdaptiveResponse(
  studentQuestion, conceptName, learningStyle, communicationPreference
);
```

## Data Models

### Concept

```typescript
{
  id: string;
  name: string;
  description: string;
  category: "math" | "science" | "history" | "language" | "technology";
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  prerequisites: string[];
  relatedConcepts: string[];
  keyPoints: string[];
  commonMisconceptions: string[];
  realWorldApplications: string[];
}
```

### ConceptMemoryState

```typescript
{
  conceptId: string;
  memoryType: "short_term" | "long_term";
  masteryLevel: "novice" | "intermediate" | "proficient" | "expert";
  retentionScore: number; // 0-100
  reviewCount: number;
  correctAnswers: number;
  totalAttempts: number;
  consolidationProgress: number; // 0-100
  nextReviewDate: number; // timestamp
}
```

### StudentMentalModel (Theory of Mind)

```typescript
{
  studentId: string;
  learningStyle: "visual" | "verbal" | "kinesthetic" | "reading_writing";
  communicationPreference: "encouraging" | "neutral" | "formal" | "socratic";
  explanationDepth: "simple" | "moderate" | "detailed" | "expert";
  knownConcepts: string[];
  strugglingConcepts: string[];
  motivationLevel: number; // 0-100
  confidenceLevel: number; // 0-100
}
```

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

## Testing

### Unit Tests (21 passing tests)

- Learning engine logic (memory, spaced repetition, mastery)
- Consolidation progress calculations
- SM-2 algorithm implementation
- Gemini API integration
- Quiz evaluation and feedback

### Running Tests

```bash
pnpm test
```

## Deployment

### Local Testing

The app is fully functional for local testing with:

- All screens implemented and interactive
- Gemini API integration for AI features
- Local data persistence with AsyncStorage
- Complete learning flow end-to-end

### Future Deployment

For production deployment:

1. Create checkpoint: `webdev_save_checkpoint`
2. Click "Publish" button in UI
3. Follow build process for iOS/Android APK

## Architecture Highlights

### Multi-Agent System (DeepTutor)

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

### Memory Systems

```
┌──────────────────────────────────────────┐
│     Short-Term Memory (Session)          │
│  Concepts learned recently (1-3 days)    │
│  Retention: 50-70%                       │
│  Action: Review in 1 day                 │
└──────────────────────────────────────────┘
                    ↓ (Consolidation)
┌──────────────────────────────────────────┐
│    Long-Term Memory (Consolidated)       │
│  Concepts passed spaced repetition tests │
│  Retention: 85%+                         │
│  Action: Periodic review (21+ days)      │
└──────────────────────────────────────────┘
```

## Key References

- **DeepTutor (2025)** - HKUDS, Multi-agent AI tutoring system
- **Feynman Technique** - Teaching concepts in simple language
- **SM-2 Algorithm** - Optimal spaced repetition scheduling
- **Active Recall** - Cognitive psychology research on memory
- **Theory of Mind** - Adaptive tutoring based on student models
- **Knowledge Graphs** - LightRAG for semantic relationships
- **Bloom's 2-Sigma Problem** - Achieving human tutoring effectiveness with AI

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

## Support & Documentation

- **ARCHITECTURE.md** - Detailed system design
- **design.md** - UI/UX design principles
- **todo.md** - Feature tracking and progress
- **Tests** - Unit tests in `lib/services/__tests__/`

## License

NeuroTutor AI - Neuroscience-backed AI tutoring for superunderstanding

---

**Built with ❤️ using Feynman Technique, Neuroscience, and AI**
