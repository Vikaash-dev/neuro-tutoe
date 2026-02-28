/**
 * Core Learning Engine Types for NeuroTutor AI
 * Based on DeepTutor architecture + Feynman Technique + Neuroscience principles
 */

// ============================================================================
// CONCEPT & KNOWLEDGE GRAPH TYPES
// ============================================================================

export type ConceptDifficulty = "beginner" | "intermediate" | "advanced" | "expert";
export type ConceptCategory = "math" | "science" | "history" | "language" | "technology" | "other";

export interface Concept {
  id: string;
  name: string;
  description: string;
  category: ConceptCategory;
  difficulty: ConceptDifficulty;
  prerequisites: string[]; // IDs of prerequisite concepts
  relatedConcepts: string[]; // IDs of related concepts
  keyPoints: string[]; // Essential points about this concept
  commonMisconceptions: string[]; // Typical student misunderstandings
  realWorldApplications: string[]; // Practical examples
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeGraphEdge {
  sourceId: string;
  targetId: string;
  relationshipType: "prerequisite" | "related" | "advanced" | "application";
  strength: number; // 0-1, how strong the relationship is
}

export interface KnowledgeGraph {
  concepts: Map<string, Concept>;
  edges: KnowledgeGraphEdge[];
}

// ============================================================================
// MEMORY SYSTEM TYPES (STM vs LTM)
// ============================================================================

export type MemoryType = "short_term" | "long_term";
export type MasteryLevel = "novice" | "intermediate" | "proficient" | "expert";

export interface ConceptMemoryState {
  conceptId: string;
  memoryType: MemoryType;
  masteryLevel: MasteryLevel;
  retentionScore: number; // 0-100, estimated retention percentage
  lastReviewDate: number; // timestamp
  nextReviewDate: number; // timestamp for spaced repetition
  reviewCount: number; // total times reviewed
  correctAnswers: number; // in quizzes
  totalAttempts: number; // in quizzes
  sessionLearned: number; // timestamp when first learned in session
  consolidationProgress: number; // 0-100, progress from STM to LTM
}

export interface MemoryDashboard {
  shortTermMemory: ConceptMemoryState[]; // Concepts learned today/this session
  longTermMemory: ConceptMemoryState[]; // Consolidated concepts
  consolidatingMemory: ConceptMemoryState[]; // In transition from STM to LTM
}

// ============================================================================
// SPACED REPETITION SCHEDULE
// ============================================================================

export interface SpacedRepetitionSchedule {
  conceptId: string;
  reviewIntervals: number[]; // [1, 3, 7, 21] days in milliseconds
  currentInterval: number; // index into reviewIntervals
  nextReviewDate: number; // timestamp
  quality: number; // 0-5, from last review (SM-2 algorithm)
  easeFactor: number; // SM-2 ease factor
}

// ============================================================================
// LEARNING SESSION & INTERACTION TYPES
// ============================================================================

export type InteractionType =
  | "question"
  | "explanation"
  | "teach_back"
  | "quiz"
  | "misconception_correction";

export interface LearningInteraction {
  id: string;
  sessionId: string;
  conceptId: string;
  type: InteractionType;
  timestamp: number;
  userInput: string;
  aiResponse: string;
  quality: number; // 0-5, how well student understood
  misconceptionsDetected: string[];
  followUpSuggestions: string[];
}

export interface LearningSession {
  id: string;
  userId: string;
  conceptId: string;
  startTime: number;
  endTime?: number;
  interactions: LearningInteraction[];
  initialMastery: MasteryLevel;
  finalMastery: MasteryLevel;
  conceptsLearned: string[]; // IDs of concepts covered
  sessionNotes: string;
}

// ============================================================================
// FEYNMAN TECHNIQUE STAGES
// ============================================================================

export type FeynmanStage = "choose_concept" | "teach_simply" | "identify_gaps" | "refine";

export interface FeynmanSession {
  conceptId: string;
  stage: FeynmanStage;
  studentExplanation: string;
  aiAnalysis: {
    accuracy: number; // 0-100
    missingPoints: string[];
    misconceptions: string[];
    suggestions: string[];
  };
  refinedExplanation: string;
  completedAt?: number;
}

// ============================================================================
// ACTIVE RECALL & QUIZ TYPES
// ============================================================================

export type QuestionType = "multiple_choice" | "fill_blank" | "explain" | "application";

export interface QuizQuestion {
  id: string;
  conceptId: string;
  type: QuestionType;
  question: string;
  options?: string[]; // for multiple choice
  correctAnswer: string;
  explanation: string;
  difficulty: ConceptDifficulty;
  relatedMisconceptions: string[];
}

export interface QuizAttempt {
  id: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number; // milliseconds
  confidence: number; // 0-5, student's confidence level
  feedback: string;
  conceptId: string;
  timestamp: number;
}

export interface Quiz {
  id: string;
  sessionId: string;
  conceptIds: string[];
  questions: QuizQuestion[];
  attempts: QuizAttempt[];
  startTime: number;
  endTime?: number;
  score: number; // 0-100
  adaptiveDifficulty: "easy" | "medium" | "hard";
}

// ============================================================================
// MISCONCEPTION & ERROR TRACKING
// ============================================================================

export interface MisconceptionPattern {
  id: string;
  conceptId: string;
  misconception: string;
  frequency: number; // how often detected
  commonCauses: string[];
  correctionStrategy: string;
  relatedConcepts: string[];
}

export interface StudentMisconception {
  id: string;
  studentId: string;
  patternId: string;
  firstDetected: number; // timestamp
  lastDetected: number;
  correctionAttempts: number;
  corrected: boolean;
}

// ============================================================================
// THEORY OF MIND (OpenHands) - STUDENT MENTAL MODEL
// ============================================================================

export interface StudentMentalModel {
  studentId: string;
  learningStyle: "visual" | "verbal" | "kinesthetic" | "reading_writing";
  communicationPreference: "encouraging" | "neutral" | "formal" | "socratic";
  explanationDepth: "simple" | "moderate" | "detailed" | "expert";
  pacePreference: "slow" | "moderate" | "fast";
  knownConcepts: string[]; // IDs of concepts student already knows
  strugglingConcepts: string[]; // IDs of concepts student finds difficult
  preferredExamples: "abstract" | "concrete" | "real_world" | "mixed";
  motivationLevel: number; // 0-100
  confidenceLevel: number; // 0-100
  lastUpdated: number;
}

// ============================================================================
// PROGRESS & ACHIEVEMENT TYPES
// ============================================================================

export interface LearningStreak {
  userId: string;
  currentStreak: number; // consecutive days
  longestStreak: number;
  lastActiveDate: number; // timestamp
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  criteria: string; // e.g., "master_5_concepts", "7_day_streak"
  icon: string;
  unlockedAt?: number;
}

export interface LearningProgress {
  userId: string;
  totalConceptsLearned: number;
  totalConceptsMastered: number;
  totalStudyTime: number; // milliseconds
  averageQuizScore: number; // 0-100
  streak: LearningStreak;
  achievements: Achievement[];
  lastUpdated: number;
}

// ============================================================================
// USER PREFERENCES & SETTINGS
// ============================================================================

export interface UserPreferences {
  userId: string;
  learningStyle: "visual" | "verbal" | "kinesthetic" | "reading_writing";
  communicationTone: "encouraging" | "neutral" | "formal" | "socratic";
  explanationDepth: "simple" | "moderate" | "detailed" | "expert";
  dailyGoal: number; // minutes
  notificationsEnabled: boolean;
  darkMode: boolean;
  language: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface AITutorResponse {
  id: string;
  conceptId: string;
  explanation: string;
  stepByStepSolution?: string[];
  relatedConcepts: string[];
  followUpQuestions: string[];
  misconceptionsAddressed: string[];
  confidence: number; // 0-1, AI's confidence in response
  sources?: string[]; // references or citations
}

export interface ConceptExplanation {
  concept: string;
  simpleExplanation: string; // Feynman-style simple explanation
  keyPoints: string[];
  commonMisconceptions: string[];
  realWorldExamples: string[];
  relatedConcepts: string[];
  visualDescription: string; // for generating diagrams
}
