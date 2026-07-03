# Notebook Saathi Complete Ideation Brief

Date: 2026-07-03

Scope: product and learning-system ideation for the current NeuroTutor /
Notebook Saathi app. This document is the bridge between the research docs,
clone-project synthesis, and the runnable implementation.

## One-Line Idea

Notebook Saathi is a local-first AI tutor that reads learner evidence, finds
the misconception or missing skill, keeps the learner in the Goldilocks zone,
and guides them through attempt, hint, teach-back, retrieval, calibration, and
transfer until they can think independently.

## Form-Ready Answers

### 12. Problem Within The Theme

Students increasingly get AI answers without learning the thinking behind them.
Teachers cannot give one-to-one feedback on every notebook, misconception, and
confidence gap, so weak understanding silently becomes dependency.

### 13. Solution In Detail

Notebook Saathi is a practical AI tutor for classrooms and self-learners. It
uses student work, uploaded notes, and local LLM tutoring to diagnose gaps,
repair misconceptions, ask Socratic hints, require teach-back, schedule recall,
and prove transfer instead of giving final answers. Teachers can review evidence
and approve remediation.

### 14. Target User

The first users are middle-school, high-school, college, and beginner technical
learners who need affordable one-to-one practice, plus teachers who want fast,
inspectable misconception diagnosis from real student work. It also supports
self-learners who use local AI and want tutoring without becoming answer
dependent.

## Problem

The core problem is not lack of explanations. The internet and current LLMs can
already explain almost anything. The problem is that most learners do not know
whether they understand, cannot always detect when a fact conflicts with their
prior knowledge, and often copy a fluent answer before doing the mental work
that creates skill.

For teachers, the problem is scale. A teacher can spot a misconception in one
notebook, but cannot deeply diagnose every learner's hidden model, confidence
gap, and prerequisite weakness after every worksheet. That leaves students stuck
between two bad options: generic classroom feedback or unstructured AI answer
generation.

## Chosen Direction

Three product directions were considered:

| Direction | Strength | Rejected or kept |
| --- | --- | --- |
| Plain AI homework/chat helper | Fast to demo and easy to understand. | Rejected as the main concept because it rewards answer dependency. |
| Fully autonomous human-replacement tutor | Ambitious and aligned with the long-term goal. | Deferred as a claim; too risky without stronger evaluation, guardrails, and outcome data. |
| Teacher-supervised evidence-first tutor | Practical, inspectable, and still moves toward real one-to-one tutoring. | Chosen. It can work locally now while building toward deeper autonomy. |

The chosen baseline is teacher-supervised but learner-centered: the teacher
approves high-stakes remediation, while the system still runs a real tutor loop
for the learner.

## Product Thesis

The LLM is not the tutor. The tutor is the control system around the LLM:
learner state, skill graph, knowledge evidence, tutor policy, assessment,
memory, calibration, and quality evaluation.

This matters because a small local 4B model can still be useful if the control
layer constrains it to tutor behavior: hint before answer, ask for attempts,
repair one misconception at a time, cite uploaded knowledge as evidence, and
record whether the learner improved.

## Target Learners And Jobs

| User | Main job | Why Notebook Saathi helps |
| --- | --- | --- |
| Struggling school student | Understand what went wrong and try again without shame. | Gets one small repair task, a hint, and a retry instead of a long lecture. |
| Average student preparing for tests | Remember and apply concepts later. | Gets retrieval practice, spacing, and transfer checks. |
| Beginner developer or technical learner | Build skill from docs and code examples. | Connects uploaded notes to concept graphs, teach-back, quizzes, and examples. |
| Teacher | Find class-level misconception patterns quickly. | Sees clusters, representative evidence, and remediation suggestions before approving. |
| Self-learner using local AI | Learn privately without cloud dependence. | Uses LM Studio locally with deterministic fallback and local saved state. |

## Learning Engine

| Principle | Tutor behavior | Current status |
| --- | --- | --- |
| Prior-knowledge bridge | Connect new concepts to known schemas and prerequisite skills. | Concept graph exists; adaptive bridge selection needs expansion. |
| Goldilocks zone | Choose repair, attempt, hint, worked example, retrieval, or transfer based on evidence. | Session phases exist; full controller is a next build item. |
| Feynman learning | Learner must explain plainly, name mechanism, give example/non-example, identify trap, transfer, and state disproof evidence. | Teach-back baseline exists; claim-level follow-up is needed. |
| Error and implicit contradiction repair | Treat confident mistakes and conflicts such as "sound is faster than light" as high-value correction moments. | Faster/slower contradiction checks exist; broader semantic checks are TODO. |
| Productive failure | Ask the learner to attempt, predict, or represent before full instruction. | Partially represented in checks and quizzes; explicit gate is TODO. |
| Metacognition | Ask for confidence and compare prediction to actual performance. | Engine support exists; UI flow should be strengthened. |
| Retrieval and spacing | Prefer recall, delayed checks, and interleaving over rereading. | Lightweight scheduling exists; FSRS/interleaving is TODO. |
| Transfer | Ask what stayed invariant and what changed in a new context. | Transfer scoring exists; generated near/far transfer tasks are TODO. |
| Cognitive load | Keep each repair small and focus on one misconception at a time. | Reflected in tutor policy and lesson scripts. |
| Pedagogical safety | Treat answer leakage and over-helping as learning harms. | Rubric and prompts exist; adversarial eval suite is TODO. |

## User Journey

### Learner-Driven NeuroTutor Journey

1. Learner selects a concept, goal, uploaded note, or question.
2. Tutor checks learner profile, known concepts, struggling concepts, and
   source evidence.
3. Tutor asks for a productive attempt or gives the smallest useful hint.
4. Learner answers, teaches back, or completes a quiz.
5. System scores coverage, gaps, misconceptions, confidence, and source use.
6. Tutor repairs one gap, asks a retry, then schedules recall.
7. Strong evidence unlocks transfer and lower scaffolding.
8. Smart resume stores the next best action.

### Teacher-Supervised Notebook Saathi Journey

1. Teacher imports anonymized notebook or worksheet attempts.
2. System clusters answers by likely misconception and shows evidence.
3. Teacher reviews or edits the cluster and remediation plan.
4. Students receive hint-first retry tasks.
5. Students teach back the corrected idea and complete retrieval practice.
6. Teacher sees learning lift, unresolved gaps, and follow-up tasks.

## System Modules

| Module | Responsibility | Main files |
| --- | --- | --- |
| Evidence intake | Messages, notebook rows, quiz answers, teach-backs, and uploaded KB docs. | `server.js`, `src/notebook-saathi.js`, `src/learner-records.js` |
| Learner model | Known concepts, struggling concepts, mastery, confidence, memory, and history. | `src/learner-state.js`, `src/learner-records.js` |
| Skill and concept graph | Prerequisites, related concepts, analogies, misconceptions, and applications. | `src/concepts.js`, `src/course-outline.js` |
| Tutor policy | Decide attempt, hint, explanation, repair, quiz, transfer, or resume action. | `src/tutor-engine.js`, `src/local-llm.js`, `src/smart-resume.js` |
| Knowledge evidence | Section-aware chunking, retrieval, embeddings, citations, and guardrails. | `src/knowledge-base.js`, `src/embedding-provider.js`, `src/citations.js`, `src/prompt-guard.js` |
| Learning scripts | Turn goals into ordered tutor, source, teach-back, quiz, and transfer steps. | `src/lesson-script.js` |
| Quality evaluation | Score tutor behavior separately from answer correctness. | `src/tutor-eval.js`, `data/tutor-quality-evals.json`, `scripts/run-tutor-eval.mjs` |
| Runtime app | Browser tutor, Notebook Saathi view, knowledge tab, progress, and persistence. | `public/index.html`, `public/app.js`, `public/styles.css` |

## MVP Demo Definition

The judgeable MVP should show one complete learning loop, not only UI screens:

1. Add or select a knowledge source.
2. Ask the tutor a concept question.
3. Tutor responds with a source-grounded hint or concise explanation and a
   next active step.
4. Learner gives a teach-back with a mistake.
5. Tutor detects missing points or misconception and asks for correction.
6. Learner completes a quiz or retry.
7. Smart resume records the next action.
8. Notebook Saathi view shows misconception clusters from sample student work.
9. Tutor-quality tests pass before the demo is called reliable.

## What Makes This Different

- It is not just chat. Progress requires learner production.
- It does not trust uploaded documents as instructions.
- It separates content memory from learner memory.
- It uses local LM Studio first, so the prototype is privacy-friendly and
  dependency-light.
- It can run with deterministic fallback when the local model fails.
- It tracks citations and tutor-quality scores for review.
- It keeps teacher review in the loop for classroom remediation.

## Implementation Status

| Area | Status |
| --- | --- |
| Local LM Studio provider at `http://192.168.1.7:1234/v1` | Implemented with same model used for tutor, evaluation, and quiz generation. |
| Deterministic fallback | Implemented. |
| Teach-back scoring | Implemented baseline. |
| Misconception repair | Implemented for current concept library and Notebook Saathi fraction demo. |
| Implicit faster/slower self-correction | Implemented baseline. |
| Active recall quizzes | Implemented. |
| Learner records and state restore | Implemented. |
| Knowledge-base chunking and retrieval | Implemented with section-aware chunks, overlap, keyword scoring, local hashed vectors, optional semantic embeddings, citations, and guardrails. |
| Prompt-injection defense for uploaded docs | Implemented baseline scanner, redaction, risk labels, and untrusted-context prompting. |
| Course outline and lesson scripts | Implemented. |
| Smart resume | Implemented. |
| Whiteboard artifacts | Implemented lightweight baseline. |
| Tutor-quality rubric and tests | Implemented baseline. |
| Long-session human-replacement quality proof | Not yet proven; needs larger simulations and user/outcome studies. |

## Next Build Slice

The next coherent implementation slice is the "thinking tutor" upgrade:

1. Productive-attempt gate before explanation for new or weak concepts.
2. Confidence input before teach-back and quiz scoring.
3. Calibration feedback that stores overconfidence and underconfidence.
4. Answer-leakage adversarial eval cases.
5. Interleaved review queue across related concepts.
6. Teacher review/export for Notebook Saathi clusters.

This slice directly targets the user's main requirement: transfer real skill and
metacognitive thinking rather than producing better answer text.

## Evaluation Plan

| Evaluation | Question it answers |
| --- | --- |
| Unit tests | Did the tutor mechanics, learner state, KB, citations, guardrails, and Notebook Saathi logic work? |
| Tutor-quality rubric | Did the tutor behave pedagogically, not only correctly? |
| LM Studio eval | Did the actual local 4B model satisfy the tutor rubric without fallback? |
| Long-session simulated learner | Does the tutor adapt over many turns without repetition, answer leakage, or losing the learning loop? |
| Prompt-injection KB tests | Does uploaded content stay evidence-only? |
| Answer-leakage tests | Can learners trick the tutor into giving final answers before attempts? |
| Outcome mini-study | Do learners improve from pre-test to post-test and delayed recall? |
| Teacher review | Are misconception clusters accurate, understandable, and useful? |

## Risks And Guardrails

| Risk | Guardrail |
| --- | --- |
| The tutor becomes an answer machine. | Hint-first policy, attempt requirement, teach-back, answer-leakage evals. |
| Small local model gives weak pedagogy. | Deterministic controller, structured prompts, fallback, and tutor-quality scoring. |
| Learner feels progress without durable skill. | Retrieval, spacing, transfer, and delayed evaluation. |
| Uploaded docs inject instructions. | Prompt-injection scanner, redaction, untrusted-context prompt, citation checks. |
| Teacher cannot trust AI diagnosis. | Evidence clusters, representative rows, confidence labels, teacher approval. |
| "Human replacement" claim outruns proof. | Frame current product as practical tutor baseline; require long-session and outcome evidence before stronger claims. |

## Ideation Completion Audit

| Requirement | Evidence in repo |
| --- | --- |
| Problem is defined. | Problem section plus form-ready Q12. |
| Solution is defined. | Solution section plus form-ready Q13. |
| Target user is defined. | Target learners table plus form-ready Q14. |
| Research principles are translated into tutor mechanics. | Learning Engine table, `docs/learning-science-source-map.md`, and `docs/ai-tutor-deep-research.md`. |
| Clone-project ideas are synthesized instead of blindly copied. | `docs/clone-project-analysis.md` and System Modules table. |
| The tutor system is specified beyond frontend/backend. | `docs/tutor-system-architecture.md` and Product Thesis section. |
| Current implementation status is honest. | Implementation Status table and README feature list. |
| Practical MVP is defined. | MVP Demo Definition. |
| Next engineering slice is clear. | Next Build Slice. |
| Evaluation and guardrails are defined. | Evaluation Plan and Risks And Guardrails. |

## Related Documents

- `docs/tutor-system-architecture.md`: full learning-system architecture.
- `docs/ai-tutor-deep-research.md`: research-to-build analysis.
- `docs/learning-science-source-map.md`: Feynman and learning-science source
  spine.
- `docs/ai-tutor-research-papers.md`: paper and implementation
  cross-reference.
- `docs/clone-project-analysis.md`: repo-by-repo salvage matrix.
