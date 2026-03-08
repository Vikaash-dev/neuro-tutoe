/**
 * Concept Extractor — Dynamic Knowledge Graph Builder
 *
 * Extracts educational concepts and prerequisite/related relationships from
 * free-form conversation history so the knowledge graph grows organically
 * as the student learns — replacing the static, hard-coded concept bank.
 *
 * Research basis:
 *   - arXiv:2510.20345 "LLM-empowered Knowledge Graph Construction" — dependency-based
 *     extraction from unstructured text
 *   - DeepTutor (HKUDS, GitHub 10.5k★) — concept graph patterns for tutoring
 *   - GraphMASAL (arXiv:2511.11035) — multi-agent concept graph expansion
 *   - PolyG (arXiv:2504.02112) — adaptive subgraph pruning based on mastery
 *
 * Design decisions:
 *   - Uses heuristic extraction (no live LLM required for tests / offline use).
 *     Production: inject a `callLLM` async function to get richer results.
 *   - New concepts start with cold-start mastery probability = 0.10.
 *   - Concept IDs are stable slugified labels (lowercase, hyphens).
 *   - Prerequisite edges are inferred from co-occurrence patterns and depth signals.
 */

import type { ConversationRecord } from "./adaptive-prompt-engine";
import {
  ExtractedConcept,
  ExtractionResult,
} from "@/lib/types/learning";

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

export const COLD_START_MASTERY = 0.10;
export const MIN_CONCEPT_WORD_LENGTH = 4; // ignore words shorter than this
export const MAX_CONCEPTS_PER_EXTRACTION = 20;

// ---------------------------------------------------------------------------
// Domain topic anchors (concept seeds per academic domain)
// ---------------------------------------------------------------------------

interface DomainSignal {
  /** Regex patterns that anchor a concept to this domain. */
  patterns: RegExp[];
  /** Default complexity level for concepts in this domain. */
  defaultComplexity: number;
}

const DOMAIN_SIGNALS: Record<string, DomainSignal> = {
  mathematics: {
    patterns: [
      /\b(calculus|derivative|integral|differential|matrix|vector|algebra|geometry|topology|probability|statistics|theorem|proof|lemma|corollary)\b/i,
    ],
    defaultComplexity: 6,
  },
  computer_science: {
    patterns: [
      /\b(algorithm|recursion|data structure|array|linked list|tree|graph|sorting|searching|complexity|big.?o|neural network|machine learning|transformer|attention|backpropagation|gradient)\b/i,
    ],
    defaultComplexity: 6,
  },
  science: {
    patterns: [
      /\b(photosynthesis|respiration|mitosis|meiosis|dna|rna|protein|enzyme|atom|molecule|electron|proton|neutron|energy|force|momentum|velocity|acceleration|thermodynamics|entropy)\b/i,
    ],
    defaultComplexity: 5,
  },
  history: {
    patterns: [
      /\b(revolution|war|empire|civilization|renaissance|enlightenment|industrial|colonialism|nationalism|democracy|feudalism|monarchy|republic|constitution)\b/i,
    ],
    defaultComplexity: 4,
  },
  economics: {
    patterns: [
      /\b(supply|demand|inflation|gdp|market|equilibrium|elasticity|monopoly|oligopoly|fiscal|monetary|trade|tariff|comparative advantage)\b/i,
    ],
    defaultComplexity: 5,
  },
};

// Prerequisite relationship keywords (word A is a prerequisite of word B if they co-occur with these)
const PREREQUISITE_PHRASES = [
  "before",
  "in order to understand",
  "requires understanding",
  "builds on",
  "is needed for",
  "first learn",
  "foundation of",
  "basis for",
];

// Relation keywords
const RELATED_PHRASES = [
  "related to",
  "connects to",
  "similar to",
  "see also",
  "also known as",
  "is a type of",
  "part of",
  "example of",
  "linked to",
  "associated with",
];

// ---------------------------------------------------------------------------
// Slug utility
// ---------------------------------------------------------------------------

/** Convert a concept label to a stable slug ID. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Concept label tokeniser
// ---------------------------------------------------------------------------

/**
 * Extract candidate concept tokens from text.
 * Prioritises:
 *  1. Multi-word technical phrases (noun phrases via simple regex)
 *  2. Single-word domain terms matching domain signal patterns
 *  3. Capitalised nouns not in a stop-word list
 */
function extractCandidateLabels(text: string): string[] {
  const candidates = new Set<string>();

  // 1. Multi-word domain phrases (2–4 word noun groups)
  const multiWordPattern = /\b([A-Z][a-z]+(?:\s+[a-zA-Z][a-z]+){1,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = multiWordPattern.exec(text)) !== null) {
    const phrase = m[1].trim();
    if (phrase.split(" ").length >= 2 && phrase.length >= MIN_CONCEPT_WORD_LENGTH) {
      candidates.add(phrase);
    }
  }

  // 2. Domain signal matches
  for (const domain of Object.values(DOMAIN_SIGNALS)) {
    for (const pat of domain.patterns) {
      const matches = text.match(new RegExp(pat.source, "gi")) ?? [];
      for (const match of matches) {
        if (match.length >= MIN_CONCEPT_WORD_LENGTH) {
          candidates.add(match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
        }
      }
    }
  }

  // 3. Capitalised single words (proper nouns / technical terms)
  const capitalPattern = /\b([A-Z][a-zA-Z]{3,})\b/g;
  const stopWords = new Set([
    "What", "How", "Why", "When", "Where", "This", "That", "These", "Those",
    "There", "Their", "They", "Then", "Than", "The", "A", "An", "In", "On",
    "At", "By", "For", "Of", "To", "Is", "It", "Do", "Can", "But", "And",
    "Or", "Not", "So", "If", "As", "Be", "We", "You", "He", "She",
    "Also", "Like", "Just", "Now", "Will", "I", "My", "Your",
  ]);
  while ((m = capitalPattern.exec(text)) !== null) {
    const word = m[1];
    if (!stopWords.has(word)) {
      candidates.add(word);
    }
  }

  return Array.from(candidates).slice(0, MAX_CONCEPTS_PER_EXTRACTION);
}

// ---------------------------------------------------------------------------
// Complexity estimator
// ---------------------------------------------------------------------------

function estimateComplexity(label: string): number {
  const lower = label.toLowerCase();
  for (const [, domain] of Object.entries(DOMAIN_SIGNALS)) {
    for (const pat of domain.patterns) {
      if (pat.test(lower)) return domain.defaultComplexity;
    }
  }
  // Fall back to word-length heuristic
  return Math.min(8, Math.max(2, Math.round(label.split(" ").length * 1.5 + 2)));
}

// ---------------------------------------------------------------------------
// Prerequisite & relation detector
// ---------------------------------------------------------------------------

function detectRelationships(
  text: string,
  candidateLabels: string[]
): { prerequisites: Map<string, string[]>; relatesTo: Map<string, string[]> } {
  const prerequisites = new Map<string, string[]>();
  const relatesTo = new Map<string, string[]>();

  const lowerText = text.toLowerCase();

  for (const phrase of PREREQUISITE_PHRASES) {
    const idx = lowerText.indexOf(phrase);
    if (idx === -1) continue;
    // Simple heuristic: first concept before phrase → prerequisite of first concept after
    const before = candidateLabels.filter(
      (c) => lowerText.indexOf(c.toLowerCase()) < idx
    );
    const after = candidateLabels.filter(
      (c) => lowerText.indexOf(c.toLowerCase()) > idx
    );
    for (const b of before.slice(-2)) {
      for (const a of after.slice(0, 2)) {
        if (b !== a) {
          const entry = prerequisites.get(b) ?? [];
          if (!entry.includes(a)) entry.push(a);
          prerequisites.set(b, entry);
        }
      }
    }
  }

  for (const phrase of RELATED_PHRASES) {
    const idx = lowerText.indexOf(phrase);
    if (idx === -1) continue;
    const before = candidateLabels.filter(
      (c) => lowerText.indexOf(c.toLowerCase()) < idx
    );
    const after = candidateLabels.filter(
      (c) => lowerText.indexOf(c.toLowerCase()) > idx
    );
    for (const b of before.slice(-2)) {
      for (const a of after.slice(0, 2)) {
        if (b !== a) {
          const entry = relatesTo.get(b) ?? [];
          if (!entry.includes(a)) entry.push(a);
          relatesTo.set(b, entry);
        }
      }
    }
  }

  return { prerequisites, relatesTo };
}

// ---------------------------------------------------------------------------
// Core extractor
// ---------------------------------------------------------------------------

/**
 * ConceptExtractor
 *
 * Extracts concepts and relationships from the last N messages of conversation
 * history and merges them into an existing concept map.
 */
export class ConceptExtractor {
  static readonly EXTRACTION_WINDOW = 6; // last N messages to analyse

  /**
   * Extract concepts from recent conversation.
   *
   * @param history   Full conversation history.
   * @param existing  Already-known concept labels (Set<string>).
   * @returns         ExtractionResult with discovered concepts.
   */
  static extract(
    history: ConversationRecord[],
    existing: Set<string> = new Set()
  ): ExtractionResult {
    const window = history.slice(-this.EXTRACTION_WINDOW);
    const fullText = window.map((m) => m.content).join(" ");

    const candidateLabels = extractCandidateLabels(fullText);
    const { prerequisites, relatesTo } = detectRelationships(fullText, candidateLabels);

    const concepts: ExtractedConcept[] = candidateLabels.map((label) => ({
      label,
      initialMastery: COLD_START_MASTERY,
      prerequisiteOf: prerequisites.get(label) ?? [],
      relatesTo: relatesTo.get(label) ?? [],
      complexityLevel: estimateComplexity(label),
      isNew: !existing.has(label.toLowerCase()),
    }));

    const newConceptLabels = concepts
      .filter((c) => c.isNew)
      .map((c) => c.label);

    return {
      concepts,
      newConceptLabels,
      updatedAt: Date.now(),
    };
  }

  /**
   * Merge an ExtractionResult into an existing concept map.
   * Existing mastery scores are NOT overwritten — only new concepts get cold-start mastery.
   *
   * @param result        Output of `extract()`.
   * @param existingMap   Map<slugifiedLabel, { label, mastery, ... }>.
   * @returns             Updated map with new concepts added.
   */
  static mergeInto(
    result: ExtractionResult,
    existingMap: Map<string, { label: string; mastery: number; complexity: number }>
  ): Map<string, { label: string; mastery: number; complexity: number }> {
    for (const concept of result.concepts) {
      const id = slugify(concept.label);
      if (!existingMap.has(id)) {
        existingMap.set(id, {
          label: concept.label,
          mastery: concept.initialMastery,
          complexity: concept.complexityLevel,
        });
      }
    }
    return existingMap;
  }

  /**
   * Build a simple adjacency list (prerequisite graph) from extracted concepts.
   * Returns Map<sourceLabel, targetLabels[]>
   */
  static buildPrerequisiteGraph(
    concepts: ExtractedConcept[]
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const c of concepts) {
      if (c.prerequisiteOf.length > 0) {
        graph.set(c.label, c.prerequisiteOf);
      }
    }
    return graph;
  }

  /**
   * Rank extracted concepts by complexity (ascending) to suggest a learning order.
   */
  static suggestLearningOrder(concepts: ExtractedConcept[]): ExtractedConcept[] {
    return [...concepts].sort((a, b) => a.complexityLevel - b.complexityLevel);
  }
}

// ---------------------------------------------------------------------------
// Live concept graph manager
// ---------------------------------------------------------------------------

/**
 * DynamicConceptGraph
 *
 * Maintains a live concept graph that updates incrementally as the
 * conversation progresses.  Replaces static `CONCEPT_MAP` from sample-concepts.ts.
 */
export class DynamicConceptGraph {
  private concepts: Map<
    string,
    { label: string; mastery: number; complexity: number }
  > = new Map();

  private prerequisites: Map<string, string[]> = new Map();

  /** Feed new conversation history into the graph. */
  update(history: ConversationRecord[]): ExtractionResult {
    const knownLabels = new Set(
      Array.from(this.concepts.keys()).map((k) => k.toLowerCase())
    );
    const result = ConceptExtractor.extract(history, knownLabels);
    ConceptExtractor.mergeInto(result, this.concepts);
    const prereqGraph = ConceptExtractor.buildPrerequisiteGraph(result.concepts);
    for (const [src, targets] of prereqGraph) {
      this.prerequisites.set(src, [
        ...new Set([...(this.prerequisites.get(src) ?? []), ...targets]),
      ]);
    }
    return result;
  }

  /** Update the mastery probability for a concept. */
  setMastery(label: string, mastery: number): void {
    const id = slugify(label);
    const existing = this.concepts.get(id);
    if (existing) {
      this.concepts.set(id, { ...existing, mastery: Math.max(0, Math.min(1, mastery)) });
    }
  }

  getMastery(label: string): number {
    return this.concepts.get(slugify(label))?.mastery ?? COLD_START_MASTERY;
  }

  getAllConcepts(): Array<{ id: string; label: string; mastery: number; complexity: number }> {
    return Array.from(this.concepts.entries()).map(([id, v]) => ({ id, ...v }));
  }

  getPrerequisites(label: string): string[] {
    return this.prerequisites.get(label) ?? [];
  }

  /** Count of all known concepts. */
  get size(): number {
    return this.concepts.size;
  }
}
