/**
 * Core Learning Engine Types for NeuroTutor AI
 * Based on DeepTutor architecture + Feynman Technique + Neuroscience principles
 * Extended with ADA-7 research iterations 5-16 (Cognitive Load, BKT, IKT, GraphRAG)
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

// ============================================================================
// COGNITIVE LOAD THEORY TYPES (Iterations 5 & 6)
// Delikoura et al. 2025 / Wang et al. 2025 / Adapala 2025
// ============================================================================

/** Three channels of cognitive load (CLT) for a single tutor turn */
export interface CognitiveLoadState {
  /** Intrinsic load: complexity inherent to the task / concept */
  intrinsicLoad: number; // 0-100
  /** Extraneous load: unnecessary complexity from presentation / verbosity */
  extraneousLoad: number; // 0-100
  /** Germane load: effort directed toward schema formation (desirable) */
  germaneLoad: number; // 0-100
  /** Composite total – used to detect saturation */
  totalLoad: number; // 0-100
  timestamp: number;
}

/** A discrete chunk of information sized to human working memory (7±2 items) */
export interface WorkingMemoryChunk {
  id: string;
  items: string[]; // 5-9 items maximum (Miller's Law)
  chunkLabel: string;
  complexity: number; // 1-5
}

/** Adapala 2025 metrics for context saturation and attentional residue */
export interface ContextSaturationMetrics {
  /** Proportion of context window actively being processed by student (0-1) */
  saturationLevel: number;
  /** Cognitive residue from prior unresolved topics (0-100) */
  attentionalResidue: number;
  /** Maximum safe information density for next turn */
  maxNextTurnChunks: number;
  /** Whether the student context is overloaded */
  isOverloaded: boolean;
}

// ============================================================================
// OVERLOAD DETECTION TYPES (Iteration 7)
// Hegde & Jayalath 2025 / Jin et al. 2025 / Borchers et al. 2025
// ============================================================================

/** Detected textual signals of cognitive overload */
export interface OverloadSignal {
  /** Short repeated phrases or re-asking the same question */
  repetitionDetected: boolean;
  /** Sentence fragmentation score (0-1, higher = more fragmented) */
  fragmentationScore: number;
  /** Circular reasoning pattern detected ("I said X... because X") */
  circularLogicDetected: boolean;
  /** Lexical diversity score (TTR – type-token ratio, 0-1) */
  lexicalDiversity: number;
  /** Number of explicit confusion markers ("I don't know", "I'm confused") */
  confusionMarkerCount: number;
  /** Divergence from expected coherence baseline (0-1) */
  coherenceDivergence: number;
}

export type OverloadSeverity = "none" | "mild" | "moderate" | "severe";

export interface OverloadState {
  severity: OverloadSeverity;
  signal: OverloadSignal;
  recommendedAction: "continue" | "simplify" | "chunk" | "pause_and_recap";
  detectedAt: number;
}

// ============================================================================
// DYNAMIC DIFFICULTY ADJUSTMENT TYPES (Iteration 8)
// Huang et al. 2025 (DualReward) / Shi et al. 2025 (AdaRFT) / Zhang et al. 2025 (CLPO)
// ============================================================================

/** Dual reward signal: correctness × difficulty-optimality */
export interface DDARewardSignal {
  /** Was the student's answer correct? */
  correctness: number; // 0-1
  /** How close to optimal ZPD difficulty was the task? */
  difficultyOptimality: number; // 0-1
  /** Presence of overload cues in this turn */
  overloadPenalty: number; // 0-1 (1 = severe overload detected)
  /** Composite dual reward */
  compositeReward: number; // 0-1
}

/** A task node in the adaptive curriculum graph */
export interface CurriculumTask {
  id: string;
  conceptId: string;
  difficulty: number; // 1-10
  questionType: "recall" | "application" | "synthesis" | "evaluation";
  estimatedIntrinsicLoad: number; // 1-10
  recentSuccessRate: number; // 0-1 (rolling window)
  lastAttempted?: number;
}

export interface DDAState {
  currentDifficulty: number; // 1-10
  zpd: { lower: number; upper: number }; // Zone of Proximal Development bounds
  recentRewards: DDARewardSignal[];
  consecutiveOverloadCount: number;
  adjustmentHistory: Array<{ from: number; to: number; reason: string; timestamp: number }>;
}

// ============================================================================
// IMPLICIT KNOWLEDGE TRACING TYPES (Iteration 9)
// Li et al. 2025 (CIKT) / Wang et al. 2025 (LLM-KT) / Han et al. 2025 (TransKT)
// ============================================================================

/** A Knowledge Component extracted from dialogue or structured content */
export interface KnowledgeComponent {
  id: string;
  label: string; // human-readable KC name
  conceptId: string; // maps to Concept
  /** 0-1 probability student has mastered this KC */
  masteryEstimate: number;
  /** Source of the KC – explicit tag or LLM-extracted from dialogue */
  source: "explicit" | "dialogue_extracted" | "cross_domain_transfer";
  lastObserved: number;
}

/** CIKT iterative student-state representation */
export interface IKTState {
  studentId: string;
  knowledgeComponents: Map<string, KnowledgeComponent>;
  iterationCount: number; // how many CIKT refinement passes performed
  /** LLM-derived narrative summary of student state */
  stateSummary: string;
  lastRefined: number;
}

/** Dialogue turn annotated with KC evidence */
export interface DialogueTurnKC {
  turnIndex: number;
  utterance: string;
  extractedKCs: KnowledgeComponent[];
  masteryEvidence: "demonstrated" | "partial" | "absent" | "ambiguous";
}

// ============================================================================
// BAYESIAN KNOWLEDGE TRACING TYPES (Iteration 10)
// Badrinath & Pardos 2025 / Badran & Preisach 2025 (SBRKT)
// ============================================================================

/** Classical BKT four-parameter model */
export interface BKTParameters {
  /** Prior probability of knowing the KC before instruction */
  pInit: number; // 0-1
  /** Probability of learning the KC after one opportunity */
  pLearn: number; // 0-1
  /** Probability of forgetting a known KC */
  pForget: number; // 0-1
  /** Probability of correct answer despite not knowing (guess) */
  pGuess: number; // 0-1
  /** Probability of incorrect answer despite knowing (slip) */
  pSlip: number; // 0-1
}

/** Knowledge state estimate from BKT inference */
export interface BKTState {
  kcId: string;
  /** Posterior probability of mastery P(L_t) after t observations */
  masteryProbability: number; // 0-1
  parameters: BKTParameters;
  observationHistory: Array<{ correct: boolean; timestamp: number }>;
  /** Confidence interval from neural parameter generation (Badrinath & Pardos) */
  confidenceInterval: [number, number];
}

/** SBRKT auxiliary (latent) Knowledge Concept generated by sparse binary learning */
export interface AuxiliaryKC {
  id: string;
  /** Sparse binary representation vector (length = latent dimension) */
  binaryRepresentation: boolean[];
  /** Human-expert KCs this auxiliary KC correlates with */
  correlatedExplicitKCs: string[];
  learningGain: number; // improvement in prediction AUC when included
}

// ============================================================================
// HYBRID KT ENGINE TYPES (Iteration 11)
// Lee et al. 2024 / Zanellati et al. 2024 / Bhattacharyya et al. 2025
// ============================================================================

export type HybridKTMode = "input_augmented" | "structure_augmented" | "output_augmented";

/** Rich semantic feature vector extracted by LLM-as-Encoder */
export interface LLMSemanticFeature {
  questionId: string;
  embedding: number[]; // LLM-derived dense vector
  conceptTags: string[]; // extracted concept labels
  difficultySignal: number; // 0-1, LLM-estimated difficulty
}

export interface HybridKTState {
  mode: HybridKTMode;
  bktState: BKTState;
  llmFeatures: LLMSemanticFeature | null;
  /** For output_augmented: LLM prompt hint derived from BKT state */
  outputHint: string;
  /** Alignment score: how well LLM explanation matches KT prediction */
  alignmentScore: number; // 0-1
  lastUpdated: number;
}

// ============================================================================
// KT BENCHMARK & EVALUATION TYPES (Iteration 12)
// EDM 2025 / NeurIPS 2024 / Krivich et al. 2025
// ============================================================================

/** EDM 2025 Alignment Score measuring LLM explanation vs. KT state consistency */
export interface KTAlignmentScore {
  ktPredictedMastery: number; // 0-1, from KT model
  llmExplainedMastery: number; // 0-1, inferred from LLM explanation text
  alignmentScore: number; // 0-1, higher = more aligned
  discrepancyFlag: boolean; // true if |kt - llm| > 0.3
}

/** Fairness metrics for Responsible AI (Krivich et al. 2025) */
export interface ResponsibleAIMetrics {
  /** Demographic parity: max deviation in prediction accuracy across groups */
  demographicParityGap: number; // 0-1 (lower = fairer)
  /** Transparency: proportion of KT decisions with human-readable explanation */
  transparencyRate: number; // 0-1
  /** Calibration error: |predicted mastery – actual accuracy| */
  calibrationError: number; // 0-1
  evaluatedAt: number;
}

/** Evaluation result for a dialogue-based KT assessment */
export interface DialogueKTEvaluation {
  sessionId: string;
  tracedKCs: KnowledgeComponent[];
  predictedAccuracy: number; // 0-1
  actualAccuracy: number; // 0-1 (from follow-up quiz)
  aucScore: number; // 0-1
  alignmentScores: KTAlignmentScore[];
}

// ============================================================================
// GRAPHRAG & CURRICULUM TYPES (Iterations 13-16)
// PolyG / GFM-RAG / GraphMASAL / CLLMRec / AcademicRAG / FactRAG
// ============================================================================

/** A node in the educational knowledge graph */
export interface KGNode {
  id: string;
  label: string;
  type: "concept" | "resource" | "prerequisite" | "learning_objective" | "auxiliary_kc";
  embedding: number[]; // dense vector for hybrid search
  metadata: Record<string, unknown>;
}

/** A directed edge in the knowledge graph */
export interface KGEdge {
  sourceId: string;
  targetId: string;
  relationshipType:
    | "prerequisite_of"
    | "related_to"
    | "instantiates"
    | "part_of"
    | "assessed_by"
    | "semantic_similar";
  weight: number; // 0-1, edge strength
  inferredByLLM: boolean; // was this edge generated by LLM or human-expert?
}

/** PolyG adaptive traversal context */
export interface AdaptiveTraversalContext {
  startNodeId: string;
  studentMasteryMap: Record<string, number>; // conceptId -> 0-1
  maxHops: number;
  relevanceThreshold: number; // prune edges below this weight
  visitedNodes: string[];
  subgraphNodes: KGNode[];
  subgraphEdges: KGEdge[];
}

/** Dual-Graph structure (CLLMRec / GraphRAG-Induced Dual Graphs) */
export interface DualGraphState {
  /** Abstract concept nodes and prerequisite edges */
  conceptGraph: { nodes: KGNode[]; edges: KGEdge[] };
  /** Concrete resource nodes (textbook sections, videos) */
  resourceGraph: { nodes: KGNode[]; edges: KGEdge[] };
  /** Cross-graph links connecting concepts to resources */
  bridgeEdges: KGEdge[];
}

/** A dynamically generated curriculum path */
export interface CurriculumPath {
  id: string;
  studentId: string;
  orderedConceptIds: string[]; // sequenced by pre-trained graph model
  estimatedTotalTime: number; // minutes
  prerequisiteSatisfactionScore: number; // 0-1
  generatedAt: number;
  lastAdaptedAt: number;
}

/** FactRAG verification result anchoring LLM output to the KG */
export interface FactRAGVerification {
  claim: string; // LLM-generated statement
  supportingNodeIds: string[]; // KG nodes that support the claim
  contradictingNodeIds: string[]; // KG nodes that contradict the claim
  /** 0-1: 1 = fully grounded, 0 = hallucination risk */
  groundingScore: number;
  verified: boolean;
}

/** Neo4j hybrid search query combining vector similarity and graph traversal */
export interface HybridSearchQuery {
  queryText: string;
  queryEmbedding: number[];
  vectorTopK: number; // number of candidates from vector index
  graphHops: number; // expand neighbourhood by N hops after vector retrieval
  filters?: Record<string, unknown>; // Cypher WHERE clause properties
}

export interface HybridSearchResult {
  node: KGNode;
  vectorScore: number; // cosine similarity (0-1)
  graphScore: number; // centrality / path-relevance score (0-1)
  combinedScore: number; // weighted combination
}

// ============================================================================
// DEEPFEYNMAN V2 TYPES
// Bloom (1984) 2-Sigma Problem, ProfiLLM (arXiv:2506.13980),
// LbT NeurIPS 2024, SocraticLM NeurIPS 2024, HLR (arXiv:1605.06065),
// Wilson et al. (2019) 85%-Rule, Posner et al. (1982) Conceptual Change
// ============================================================================

// ---------- Ranedeer 5-Dimension User Profile (Mr. Ranedeer, JushBJJ 2023) --

/** 1-10 depth scale: 1=child/beginner … 10=PhD-level peer */
export type DepthLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type LearningStyleLabel =
  | "visual"
  | "verbal"
  | "active"
  | "intuitive"
  | "reflective"
  | "global";

export type CommunicationStyle =
  | "formal"
  | "textbook"
  | "layman"
  | "story"
  | "socratic";

export type TonePreference =
  | "encouraging"
  | "neutral"
  | "informative"
  | "friendly"
  | "humorous";

export type ReasoningFramework =
  | "deductive"
  | "inductive"
  | "abductive"
  | "analogical"
  | "causal";

/** Complete 5-dimension Ranedeer-style learner profile */
export interface UserLearningProfile {
  depth: DepthLevel;
  learningStyle: LearningStyleLabel;
  communication: CommunicationStyle;
  tone: TonePreference;
  reasoning: ReasoningFramework;
  /** true = APE inferred this profile; false = user explicitly set it */
  inferred: boolean;
  /** 0-1 APE confidence in current inference */
  inferenceConfidence: number;
  /** ISO timestamp of last APE update */
  lastUpdatedAt: number;
}

// ---------- Adaptive Prompt Engine (APE) ------------------------------------
// Based on: ProfiLLM (arXiv:2506.13980), USP (ACL 2025)

export type FeynmanMode =
  | "explainer"   // AI teaches with adaptive depth (default)
  | "student"     // AI plays confused student; user teaches (LbT NeurIPS 2024)
  | "socratic"    // AI only asks guiding questions (SocraticLM NeurIPS 2024)
  | "rubber_duck"; // AI listens, minimal probes; user thinks aloud

/** Raw output of one APE analysis cycle (every 5 conversation turns) */
export interface APEAnalysis {
  inferredDepth: DepthLevel;
  inferredLearningStyle: LearningStyleLabel;
  inferredCommunication: CommunicationStyle;
  /** 0-1: presence of confusion markers ("I don't understand", repeated Qs) */
  confusionLevel: number;
  /** 0-1: engagement quality (message length, follow-up questions) */
  engagementLevel: number;
  /** concept labels actively discussed (not merely mentioned) */
  conceptsMentioned: string[];
  /**
   * Mode the APE recommends switching to:
   * - confusion > 0.7 → "explainer"
   * - mastery signals → "student"
   * - "why" questions → "socratic"
   */
  suggestedModeSwitch: FeynmanMode | null;
  /** overall confidence of this analysis round */
  confidence: number;
}

/** Compressed summary of a session, used to reduce context-window pressure */
export interface ConversationMemoryMemo {
  sessionId: string;
  summary: string;              // ≤200 word semantic summary
  keyConceptsCovered: string[];
  unresolved: string[];         // topics student is still confused about
  profileSnapshot: UserLearningProfile;
  createdAt: number;
}

// ---------- Feynman Mode Engine ----------------------------------------------
// Based on: arXiv:2506.09055, NeurIPS 2024 LbT, SocraticLM NeurIPS 2024

export interface FeynmanModeConfig {
  mode: FeynmanMode;
  profile: UserLearningProfile;
  currentTopic: string;
  knownConcepts: string[];
  inProgressConcepts: string[];
  language?: string;
}

export interface FeynmanSystemPrompt {
  mode: FeynmanMode;
  systemPrompt: string;
  modeDescription: string;
  suggestedStarters: string[];
}

export interface ParsedCommand {
  command: string;
  argument?: string;
  valid: boolean;
  errorMessage?: string;
}

// ---------- Half-Life Regression Spaced Repetition ---------------------------
// Based on: Settles & Meeder 2016 (arXiv:1605.06065), SM-2, Wilson et al. 2019

export interface HLRState {
  conceptId: string;
  /** estimated half-life in days — personalised per concept per student */
  halfLifeDays: number;
  /** SM-2 ease factor (≥1.3) */
  easeFactor: number;
  /** current review interval in days */
  intervalDays: number;
  /** number of consecutive correct reviews */
  consecutiveCorrect: number;
  /** last review timestamp */
  lastReviewAt: number;
  /** next scheduled review timestamp */
  nextReviewAt: number;
  /** predicted retention fraction at next review time (0-1) */
  predictedRetention: number;
  /** total reviews ever done for this concept */
  totalReviews: number;
  /** fraction of reviews that were correct (0-1) */
  correctFraction: number;
}

export interface ReviewSchedule {
  conceptId: string;
  dueAt: number;
  priority: "overdue" | "due_today" | "upcoming";
  predictedRetention: number;
  intervalDays: number;
}

export interface OptimalChallengeZone {
  /** true if concept is in 85%-rule optimal zone (Wilson et al. 2019) */
  inOptimalZone: boolean;
  /** current estimated accuracy rate (0-1) */
  currentAccuracy: number;
  /** recommended action */
  recommendation: "advance" | "stay" | "review" | "remediate";
}

// ---------- Dynamic Concept Extractor ----------------------------------------
// Based on: arXiv:2510.20345 (LLM-empowered KG construction)

export interface ExtractedConcept {
  label: string;
  /** initial cold-start mastery probability = 0.10 */
  initialMastery: number;
  prerequisiteOf: string[];
  relatesTo: string[];
  complexityLevel: number; // 1-10
  /** true if this concept was newly discovered (not in prior graph) */
  isNew: boolean;
}

export interface ExtractionResult {
  concepts: ExtractedConcept[];
  newConceptLabels: string[];
  updatedAt: number;
}

// ---------- Mastery Gate Controller ------------------------------------------
// Based on: Bloom (1984) Mastery Learning, Wilson et al. (2019) 85%-Rule

export type MasteryGateStatus =
  | "locked"         // prerequisites not met
  | "available"      // prerequisites met, not yet attempted
  | "in_progress"    // student is working on this concept
  | "mastered"       // p_mastered >= MASTERY_THRESHOLD (0.85)
  | "needs_review";  // mastered but review overdue (forgetting curve)

export interface MasteryGate {
  conceptId: string;
  status: MasteryGateStatus;
  pMastered: number;             // current Bayesian mastery probability
  correctAttempts: number;
  totalAttempts: number;
  /** accuracy rate = correctAttempts / totalAttempts (0-1) */
  accuracyRate: number;
  /** true if pMastered >= 0.85 (Bloom's mastery threshold) */
  gatePassed: boolean;
  prerequisitesMet: boolean;
  unmetPrerequisites: string[];
  lastAttemptAt: number;
  masteredAt?: number;
}

export interface CorrectiveLoopEntry {
  conceptId: string;
  wrongAnswerAt: number;
  /** the specific knowledge gap identified */
  gapDescription: string;
  /** targeted re-explanation provided */
  correctionProvided: string;
  /** variant question to retry after correction */
  retryQuestionId: string;
  resolved: boolean;
}

export interface LearningPathAdvancement {
  fromConceptId: string;
  toConceptId: string;
  advancedAt: number;
  triggerReason: "mastery_gate_passed" | "teacher_override" | "prerequisite_complete";
  masteryAtAdvancement: number;
}

// ============================================================================
// ToM-SWE: THREE-TIER MEMORY ARCHITECTURE
// Adapted from OpenHands ToM-SWE module for pedagogical use.
// Tier 1 → Tier 2 → Tier 3 (Cleaned Sessions → Analyses → User Profiles)
// ============================================================================

/** Tier 1 — Raw dialogue + (optional) tool-use records, cleaned for analysis */
export interface CleanedSession {
  sessionId: string;
  /** ISO timestamp the session started */
  startedAt: number;
  /** ISO timestamp the session ended (0 = still active) */
  endedAt: number;
  /** Cleaned message pairs (user + assistant), PII stripped */
  messages: Array<{ role: "user" | "assistant"; content: string; turnIndex: number }>;
  /** Any tool-use / command logs emitted during the session */
  toolEvents: Array<{ tool: string; input: string; output: string; turnIndex: number }>;
}

/** Tier 2 — Mid-level extraction: intent, friction points, immediate goals */
export interface SessionAnalysis {
  sessionId: string;
  analyzedAt: number;
  /** The student's primary learning intent inferred from the session */
  inferredIntent: string;
  /** Moments where the student showed signs of struggle or confusion */
  frictionPoints: Array<{
    turnIndex: number;
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  /** Short-term goals the student appeared to be pursuing */
  immediateGoals: string[];
  /** Concepts actively engaged with (not merely mentioned) */
  activeConceptIds: string[];
  /** Raw emotion/affect signal extracted from text */
  affectSignal: "positive" | "neutral" | "frustrated" | "confused" | "disengaged";
  /** Overall session quality score 0-1 (engagement × comprehension proxy) */
  qualityScore: number;
}

/** Tier 3 — Long-term psychological user profile (ToM-SWE style) */
export interface TomUserProfile {
  userId: string;
  updatedAt: number;
  /** Preferred working style inferred across sessions */
  workingStyle: "systematic" | "exploratory" | "example-driven" | "theory-first" | "mixed";
  /** Implicit communication preferences */
  communicationPreferences: {
    verbosity: "concise" | "detailed" | "moderate";
    formality: "casual" | "formal" | "mixed";
    analogyAffinity: boolean;   // does this user respond well to analogies?
    exampleAffinity: boolean;   // does this user respond well to worked examples?
  };
  /** Implicit needs inferred from friction patterns */
  implicitNeeds: string[];
  /** Persistent frustration triggers observed across sessions */
  frustrationTriggers: string[];
  /** Topics the user returns to repeatedly (deep interest) */
  deepInterestTopics: string[];
  /** Sessions analysed so far (source data for this profile) */
  sessionIds: string[];
  /** Confidence level of this profile 0-1 (grows with more sessions) */
  profileConfidence: number;
}

// ============================================================================
// PEDAGOGICAL ACTION SPACE
// Replaces the SWE "execution drive" (git commit / npm install)
// with a teaching-oriented action vocabulary.
// ============================================================================

export type PedagogicalActionType =
  | "evaluate_mastery"
  | "generate_analogy"
  | "ask_socratic_question"
  | "provide_correction"
  | "adjust_difficulty"
  | "trigger_review"
  | "explain_concept"
  | "offer_hint";

/** Discriminated union of all pedagogical actions */
export type PedagogicalAction =
  | {
      type: "evaluate_mastery";
      conceptId: string;
      /** Optional: quiz question to evaluate mastery with */
      probeQuestion?: string;
    }
  | {
      type: "generate_analogy";
      conceptId: string;
      /** Target domain for the analogy (e.g. "cooking", "sports") */
      targetDomain: string;
      studentDepth: number;
    }
  | {
      type: "ask_socratic_question";
      conceptId: string;
      /** The specific misconception or gap the question targets */
      targetGap: string;
      /** Generated Socratic question text */
      questionText: string;
    }
  | {
      type: "provide_correction";
      conceptId: string;
      gapDescription: string;
      correctionText: string;
      retryQuestionId: string;
    }
  | {
      type: "adjust_difficulty";
      conceptId: string;
      direction: "lower" | "raise" | "maintain";
      reason: string;
    }
  | {
      type: "trigger_review";
      conceptIds: string[];
      urgency: "immediate" | "end_of_session" | "next_session";
    }
  | {
      type: "explain_concept";
      conceptId: string;
      explanation: string;
      mode: FeynmanMode;
    }
  | {
      type: "offer_hint";
      conceptId: string;
      hintLevel: 1 | 2 | 3;  // 1=subtle, 2=moderate, 3=direct
      hintText: string;
    };

/** Result of a pedagogical action execution */
export interface PedagogicalActionResult {
  action: PedagogicalAction;
  executedAt: number;
  /** Text output to surface to the student */
  output: string;
  /** Whether this action updated the student's mastery estimate */
  masteryUpdated: boolean;
  /** New mastery probability after the action (if updated) */
  newMasteryP?: number;
}

// ============================================================================
// HIGH-ORDER THEORY OF MIND (Second-order beliefs)
// Tracks: ground truth vs the student's flawed mental model
// ============================================================================

/**
 * A single nested belief: what the student *believes* about concept X.
 * May differ from the ground truth.
 */
export interface NestedBelief {
  conceptId: string;
  /** The student's expressed or inferred understanding */
  studentModel: string;
  /** The correct understanding (tutor ground truth) */
  groundTruth: string;
  /** True if the student's model deviates from ground truth */
  isFlawed: boolean;
  /** Estimated probability that the flaw has been corrected (0-1) */
  correctionProbability: number;
  /** When this belief was last observed/updated */
  observedAt: number;
}

/**
 * High-Order ToM state for one student.
 * Holds the dual model required for Socratic and corrective tutoring:
 *   - What the tutor KNOWS is correct (ground truth)
 *   - What the tutor KNOWS the student believes (possibly wrong)
 */
export interface HighOrderToMState {
  studentId: string;
  updatedAt: number;
  /**
   * Zero-order beliefs: factual ground truth about concepts.
   * Key = conceptId, Value = correct definition/rule.
   */
  groundTruthMap: Record<string, string>;
  /**
   * First-order beliefs: what the student currently believes.
   * Key = conceptId, Value = NestedBelief
   */
  studentBeliefMap: Record<string, NestedBelief>;
  /**
   * Second-order: concepts where the tutor KNOWS the student
   * thinks they understand but are actually wrong.
   * (The "Dunning-Kruger" zone — most important for Socratic intervention)
   */
  falseConfidenceConcepts: string[];
  /**
   * Context coherence score 0-1.
   * Degrades when conflicting beliefs are held over a long session
   * (models the "context collapse" risk identified in the problem statement).
   */
  contextCoherenceScore: number;
}

/** Epistemic state: per-concept mastery mapped from ToM profile + BKT */
export interface EpistemicState {
  studentId: string;
  conceptMasteryMap: Record<string, number>;  // conceptId → p_mastered 0-1
  /** Frustration-adjusted mastery: lower when student is frustrated */
  adjustedMasteryMap: Record<string, number>;
  /** Which concepts the ToM profile flags as frustration-triggering */
  frustrationConcepts: string[];
  updatedAt: number;
}

// ============================================================================
// ToM ↔ Mastery Bridge decision result
// ============================================================================

export interface TomMasteryDecision {
  studentId: string;
  conceptId: string;
  /** Raw BKT mastery probability */
  rawMastery: number;
  /** Affect-adjusted mastery (lower when frustrated) */
  affectAdjustedMastery: number;
  /** The recommended pedagogical action */
  recommendedAction: PedagogicalAction;
  /** Human-readable rationale: "frustration because mastery=0.45 → visual analogy" */
  rationale: string;
  /** Fallback Ranedeer mode to switch to (if any) */
  suggestedMode: FeynmanMode | null;
  decidedAt: number;
}
