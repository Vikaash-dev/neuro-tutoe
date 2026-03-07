/**
 * Enhanced 10-Level Adaptive Depth System
 * Inspired by Mr. Ranedeer's 10-depth framework
 * Provides granular personalization from Elementary to PhD level
 */

export type DepthLevel =
  | "elementary"
  | "middle_school"
  | "high_school"
  | "advanced_hs"
  | "undergrad_1_2"
  | "undergrad_3_4"
  | "graduate_1"
  | "graduate_2"
  | "phd_candidate"
  | "expert_researcher";

export interface DepthLevelConfig {
  level: DepthLevel;
  name: string;
  description: string;
  gradeRange: string;
  vocabulary: "simple" | "intermediate" | "advanced" | "technical" | "expert";
  conceptComplexity: number; // 1-10
  prerequisiteLevel: DepthLevel | null;
  exampleTopics: string[];
  systemPromptModifier: string;
}

export const DEPTH_LEVELS: Record<DepthLevel, DepthLevelConfig> = {
  elementary: {
    level: "elementary",
    name: "Elementary School",
    description: "Grades 1-6: Simple concepts, everyday language, concrete examples",
    gradeRange: "1-6",
    vocabulary: "simple",
    conceptComplexity: 1,
    prerequisiteLevel: null,
    exampleTopics: ["basic math", "simple science", "reading", "writing"],
    systemPromptModifier:
      "Explain using very simple words. Use everyday examples. Avoid technical terms. Use analogies with things kids know.",
  },
  middle_school: {
    level: "middle_school",
    name: "Middle School",
    description: "Grades 7-9: Foundational concepts, some technical terms, real-world connections",
    gradeRange: "7-9",
    vocabulary: "intermediate",
    conceptComplexity: 2,
    prerequisiteLevel: "elementary",
    exampleTopics: ["algebra basics", "earth science", "biology fundamentals", "world history"],
    systemPromptModifier:
      "Use clear explanations with some technical terms. Include real-world examples. Build on basic knowledge.",
  },
  high_school: {
    level: "high_school",
    name: "High School (Standard)",
    description: "Grades 10-12: Standard curriculum, technical vocabulary, abstract thinking",
    gradeRange: "10-12",
    vocabulary: "advanced",
    conceptComplexity: 3,
    prerequisiteLevel: "middle_school",
    exampleTopics: ["geometry", "chemistry", "biology", "world literature", "US history"],
    systemPromptModifier:
      "Use standard technical vocabulary. Include formulas and equations. Explain abstract concepts. Assume prior knowledge.",
  },
  advanced_hs: {
    level: "advanced_hs",
    name: "Advanced High School",
    description: "Grades 11-12 (AP/IB): Advanced topics, rigorous analysis, mathematical depth",
    gradeRange: "11-12 (AP/IB)",
    vocabulary: "technical",
    conceptComplexity: 4,
    prerequisiteLevel: "high_school",
    exampleTopics: ["AP Calculus", "AP Physics", "AP Chemistry", "IB Higher Level"],
    systemPromptModifier:
      "Use rigorous mathematical notation. Include proofs and derivations. Discuss edge cases. Assume strong foundational knowledge.",
  },
  undergrad_1_2: {
    level: "undergrad_1_2",
    name: "Undergraduate (Years 1-2)",
    description: "College intro courses, foundational theory, mathematical rigor",
    gradeRange: "College Year 1-2",
    vocabulary: "technical",
    conceptComplexity: 5,
    prerequisiteLevel: "advanced_hs",
    exampleTopics: ["Calculus II/III", "Linear Algebra", "Physics I/II", "Chemistry I/II"],
    systemPromptModifier:
      "Use university-level rigor. Include proofs, derivations, and mathematical formalism. Discuss theoretical foundations.",
  },
  undergrad_3_4: {
    level: "undergrad_3_4",
    name: "Undergraduate (Years 3-4)",
    description: "Upper-level courses, specialized topics, research-level understanding",
    gradeRange: "College Year 3-4",
    vocabulary: "expert",
    conceptComplexity: 6,
    prerequisiteLevel: "undergrad_1_2",
    exampleTopics: ["Real Analysis", "Abstract Algebra", "Quantum Mechanics", "Organic Chemistry"],
    systemPromptModifier:
      "Use expert-level terminology. Discuss cutting-edge research. Include advanced mathematical frameworks. Assume mastery of prerequisites.",
  },
  graduate_1: {
    level: "graduate_1",
    name: "Graduate (Year 1)",
    description: "Master's level, advanced specialization, research methodology",
    gradeRange: "Graduate Year 1",
    vocabulary: "expert",
    conceptComplexity: 7,
    prerequisiteLevel: "undergrad_3_4",
    exampleTopics: ["Advanced Analysis", "Functional Analysis", "Quantum Field Theory", "Advanced Organic Synthesis"],
    systemPromptModifier:
      "Use expert terminology and advanced mathematical notation. Discuss research papers and current methodologies. Assume deep subject knowledge.",
  },
  graduate_2: {
    level: "graduate_2",
    name: "Graduate (Year 2)",
    description: "Master's thesis level, research-intensive, specialized expertise",
    gradeRange: "Graduate Year 2",
    vocabulary: "expert",
    conceptComplexity: 8,
    prerequisiteLevel: "graduate_1",
    exampleTopics: ["Thesis research", "Specialized seminars", "Research methodology", "Literature review"],
    systemPromptModifier:
      "Discuss at the level of published research papers. Include recent findings and methodological debates. Assume expertise in the field.",
  },
  phd_candidate: {
    level: "phd_candidate",
    name: "PhD Candidate",
    description: "Doctoral level, frontier research, novel contributions",
    gradeRange: "PhD Year 1-3",
    vocabulary: "expert",
    conceptComplexity: 9,
    prerequisiteLevel: "graduate_2",
    exampleTopics: ["Dissertation research", "Frontier topics", "Novel methodologies", "Unpublished research"],
    systemPromptModifier:
      "Discuss at the frontier of knowledge. Reference cutting-edge papers and unpublished work. Discuss open research questions and methodological innovations.",
  },
  expert_researcher: {
    level: "expert_researcher",
    name: "Expert Researcher",
    description: "Post-doctoral level, research leadership, novel discoveries",
    gradeRange: "PostDoc/Faculty",
    vocabulary: "expert",
    conceptComplexity: 10,
    prerequisiteLevel: "phd_candidate",
    exampleTopics: ["Research leadership", "Novel discoveries", "Paradigm shifts", "Field advancement"],
    systemPromptModifier:
      "Discuss as a peer researcher. Challenge assumptions. Discuss limitations of current understanding. Explore novel research directions and theoretical implications.",
  },
};

export interface StudentDepthProfile {
  currentLevel: DepthLevel;
  targetLevel: DepthLevel;
  conceptDepths: Record<string, DepthLevel>; // Per-concept depth tracking
  learningVelocity: number; // How fast student progresses through levels (0-1)
  recommendedNextLevel: DepthLevel | null;
}

export class AdaptiveDepth10LevelEngine {
  /**
   * Get depth level configuration
   */
  static getDepthConfig(level: DepthLevel): DepthLevelConfig {
    return DEPTH_LEVELS[level];
  }

  /**
   * Get all depth levels in order
   */
  static getAllDepthLevels(): DepthLevel[] {
    return [
      "elementary",
      "middle_school",
      "high_school",
      "advanced_hs",
      "undergrad_1_2",
      "undergrad_3_4",
      "graduate_1",
      "graduate_2",
      "phd_candidate",
      "expert_researcher",
    ];
  }

  /**
   * Determine recommended depth level based on student performance
   */
  static recommendDepthLevel(
    currentLevel: DepthLevel,
    performanceScore: number, // 0-100
    masteryConfidence: number // 0-1
  ): DepthLevel {
    const levels = this.getAllDepthLevels();
    const currentIndex = levels.indexOf(currentLevel);

    // If performance is excellent (>85%) and confidence is high (>0.8), suggest next level
    if (performanceScore > 85 && masteryConfidence > 0.8 && currentIndex < levels.length - 1) {
      return levels[currentIndex + 1];
    }

    // If performance is poor (<50%), suggest previous level
    if (performanceScore < 50 && currentIndex > 0) {
      return levels[currentIndex - 1];
    }

    // Otherwise stay at current level
    return currentLevel;
  }

  /**
   * Generate system prompt modifier for LLM based on depth level
   */
  static getSystemPromptModifier(level: DepthLevel): string {
    return DEPTH_LEVELS[level].systemPromptModifier;
  }

  /**
   * Generate full system prompt for tutor at specific depth level
   */
  static generateTutorSystemPrompt(
    basePrompt: string,
    depthLevel: DepthLevel,
    studentName: string = "Student"
  ): string {
    const config = DEPTH_LEVELS[depthLevel];
    return `${basePrompt}

DEPTH LEVEL: ${config.name} (${config.gradeRange})
COMPLEXITY TARGET: ${config.conceptComplexity}/10

COMMUNICATION STYLE:
${config.systemPromptModifier}

Tailor all explanations, examples, and questions to this depth level. Ensure vocabulary and complexity match the student's current level.`;
  }

  /**
   * Get complexity score for a concept at given depth level
   */
  static getConceptComplexity(depthLevel: DepthLevel): number {
    return DEPTH_LEVELS[depthLevel].conceptComplexity;
  }

  /**
   * Determine if student is ready to advance to next depth level
   */
  static isReadyToAdvance(
    currentLevel: DepthLevel,
    masteryScore: number, // 0-100
    timeSpentMinutes: number,
    conceptsCompleted: number
  ): boolean {
    const levels = this.getAllDepthLevels();
    const currentIndex = levels.indexOf(currentLevel);

    // Can't advance past expert level
    if (currentIndex >= levels.length - 1) {
      return false;
    }

    // Require 80%+ mastery, at least 60 minutes, and 3+ concepts completed
    return masteryScore >= 80 && timeSpentMinutes >= 60 && conceptsCompleted >= 3;
  }

  /**
   * Create initial student depth profile
   */
  static createStudentProfile(initialLevel: DepthLevel = "high_school"): StudentDepthProfile {
    return {
      currentLevel: initialLevel,
      targetLevel: "expert_researcher",
      conceptDepths: {},
      learningVelocity: 0.5,
      recommendedNextLevel: null,
    };
  }

  /**
   * Update student depth profile based on performance
   */
  static updateStudentProfile(
    profile: StudentDepthProfile,
    conceptId: string,
    performanceScore: number,
    masteryConfidence: number
  ): StudentDepthProfile {
    const levels = this.getAllDepthLevels();
    const currentIndex = levels.indexOf(profile.currentLevel);

    // Update concept-specific depth
    if (performanceScore > 85 && masteryConfidence > 0.8 && currentIndex < levels.length - 1) {
      profile.conceptDepths[conceptId] = levels[currentIndex + 1];
      profile.learningVelocity = Math.min(profile.learningVelocity + 0.05, 1);
    } else if (performanceScore < 50 && currentIndex > 0) {
      profile.conceptDepths[conceptId] = levels[currentIndex - 1];
      profile.learningVelocity = Math.max(profile.learningVelocity - 0.05, 0);
    } else {
      profile.conceptDepths[conceptId] = profile.currentLevel;
    }

    // Recommend next level
    profile.recommendedNextLevel = this.recommendDepthLevel(
      profile.currentLevel,
      performanceScore,
      masteryConfidence
    );

    return profile;
  }

  /**
   * Get explanation complexity guidance for LLM
   */
  static getExplanationGuidance(depthLevel: DepthLevel): {
    maxSentenceLength: number;
    useFormulas: boolean;
    includeProofs: boolean;
    discussEdgeCases: boolean;
    referenceResearch: boolean;
  } {
    const complexity = DEPTH_LEVELS[depthLevel].conceptComplexity;

    return {
      maxSentenceLength: Math.max(20, 40 - complexity * 2),
      useFormulas: complexity >= 3,
      includeProofs: complexity >= 5,
      discussEdgeCases: complexity >= 6,
      referenceResearch: complexity >= 7,
    };
  }
}
