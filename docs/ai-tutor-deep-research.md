# Deep Research: Building an Actual AI Tutor

Date: 2026-07-03

Scope: NeuroTutor / Notebook Saathi as a practical learning system. This is
not a pitch document and not a generic AI-in-education survey. The goal is to
define what the tutor must do to build transferable skill, metacognition, and
durable learning instead of producing quick answers.

## Research Question

What must an AI tutor implement so a learner can acquire real skill, connect
new concepts to prior knowledge, stay in the Goldilocks zone, explain ideas in
their own words, monitor their own understanding, and transfer learning to new
problems?

## Core Thesis

The LLM is not the tutor. The tutor is the control system around the LLM:
learner model, skill graph, evidence intake, diagnosis, task selection,
scaffolding policy, retrieval practice, teach-back, calibration, spaced review,
transfer, and safety checks.

If the model answers directly, the learner may complete work faster while
learning less. A real tutor should create productive cognitive work for the
learner, not replace it.

## Evidence Map

| Research line | Useful finding | System requirement | Current app status |
| --- | --- | --- | --- |
| One-to-one tutoring and mastery learning | Bloom's 2 Sigma problem frames tutoring plus mastery correction as the learning north star. ITS meta-analysis shows gains depend on good implementation and aligned evaluation. | The app must run a mastery loop: diagnose, remediate, retest, and only then advance. | Partly implemented through teach-back, quiz, learner state, smart resume, and tutor-quality evals. |
| Prior knowledge and ZPD | ZPD-style systems select work that is challenging but not overwhelming. The E-Gotsky fractions study reports faster mastery with adaptive sequencing. | Maintain a skill graph, estimate mastery per skill, and choose the next task in the Goldilocks zone. | Partly implemented through concepts and session phase selection; full skill graph controller is TODO. |
| Retrieval practice | Roediger and Karpicke show tests improve delayed retention more than restudy, even when restudy increases confidence. | Reviews must be recall attempts, not rereading. The tutor should ask before telling. | Implemented through active recall quiz; spaced/interleaved review is still lightweight. |
| Self-explanation and Feynman-style teach-back | Self-explanation and ICAP-style constructive engagement imply that learners should generate explanations, not passively receive them. | Require the learner to explain the idea simply, expose missing links, and repair weak claims. | Implemented through teach-back analysis; stronger claim extraction and why/how follow-ups are TODO. |
| Learning by teaching / protege effect | Teaching or preparing to teach can make gaps visible and increase cognitive effort, but unguided teaching can be hard for learners. | Use "teach the tutor" as a guided ritual with feedback, not an unstructured prompt. | Implemented as teach-back and duck mode; can be upgraded with guided rubrics. |
| Productive failure | Problem-first learning can build deeper conceptual readiness when followed by consolidation. LLM tutors need steering to avoid giving the answer too early. | Start hard concepts with an attempt, prediction, representation, or worked-out partial idea before explanation. | Partly implemented through quizzes and checks; explicit productive-attempt gate is TODO. |
| Spacing, interleaving, and forgetting | Spaced practice improves durable memory, and skill-aware scheduling can model learning plus forgetting across multiple skills. | Add a due-review queue that mixes related skills and schedules later checks. | Lightweight review exists; FSRS/DAS3H-style scheduler is TODO. |
| Metacognitive calibration | Learners can overestimate memory and understanding. LLM use may worsen self-perceived mastery if it removes effort. | Ask for confidence before feedback; compare prediction, score, and explanation quality. | Mostly TODO; tutor-quality evals exist but learner calibration loop is not complete. |
| Solver versus tutor gap | MathDial and KMP-Bench show LLMs can solve problems while failing at pedagogy, scaffolding, and feedback. | Evaluate tutor behavior separately from answer accuracy. Penalize direct answer leakage. | Baseline tutor-quality scoring exists; more long-session and adversarial cases are TODO. |
| Pedagogical safety | SafeTutors and answer-leakage research show tutoring harm is not just toxicity; over-disclosure and scaffolding failure are learning failures. | Add answer-leakage tests, multi-turn safety tests, and a policy that hints before revealing final answers. | Prompting and rubric mention this; explicit adversarial answer-leakage suite is TODO. |
| Student uptake | Recent scaffolding research argues benchmarks assume students accept scaffolding, while real students may bypass it. | Track whether the learner actually follows requested attempt, hint, teach-back, or retry steps. | Learner events exist; uptake metric is TODO. |
| RAG and knowledge grounding | RAG helps with source grounding, but personalized tutoring needs dynamic learner memory, not only static document retrieval. | Use KB chunks as evidence, not as an answer shortcut. Keep learner memory separate from content memory. | Implemented: KB chunking, hybrid retrieval, citations, citation notebook, prompt-injection guard. |

## Tutor System Requirements

### 1. Learner Model

The tutor needs a live model of the learner, not just chat history.

Minimum state:

- Known skills and prerequisite links.
- Current mastery estimate per skill.
- Recent mistakes and misconceptions.
- Last teach-back score and missing ideas.
- Confidence predictions versus actual performance.
- Review due dates and forgetting risk.
- Preferred examples, language level, and learner goals.

Practical implication: every turn should update learner state or explain why no
update was possible.

### 2. Skill Graph and Prior-Knowledge Bridge

New skill should attach to existing skill. The tutor should ask:

- What prerequisite skill does this require?
- What prior analogy can the learner already understand?
- Which misconception blocks the connection?
- What small next action would prove readiness?

Example: fractions should connect to sharing, ratios, number lines, and units
before symbolic manipulation. Kubernetes Deployments should connect to desired
state and self-healing before YAML details.

### 3. Goldilocks Controller

The system should classify each next task:

- Too easy: learner succeeds quickly with high confidence.
- Productive zone: learner can attempt with a hint or partial scaffold.
- Too hard: learner lacks a prerequisite and needs repair.

The next task should be chosen from the productive zone. This means difficulty
is not just generated by the LLM; it is selected by learner state and evidence.

### 4. Productive Attempt Before Explanation

For new or weak skills, the tutor should ask the learner to first:

- Predict an answer.
- Draw or describe a representation.
- Identify which rule might apply.
- Solve the first step.
- Explain why a wrong answer is tempting.

Only after that should the tutor consolidate the concept. This protects against
AI replacing the mental work that creates learning.

### 5. Scaffold, Fade, and Transfer

The tutor should move through support levels:

1. Hint.
2. Worked example.
3. Completion problem.
4. Independent problem.
5. Transfer problem in a new context.

Fading should depend on evidence, not time spent. A learner who can explain but
cannot transfer still needs discrimination practice.

### 6. Feynman / Teach-Back Loop

Teach-back should be treated as an assessment and learning event.

Required checks:

- Can the learner explain the idea simply?
- Did they include the mechanism, not just a slogan?
- Can they give an example and a non-example?
- Can they state where the idea breaks?
- Can they connect it to a previous skill?

The tutor should then repair one missing link at a time.

### 7. Metacognitive Calibration

Before feedback, the tutor should ask for a confidence estimate:

- "How confident are you, 0-100?"
- "What part are you least sure about?"
- "What would make this answer wrong?"

After scoring, show the gap:

- Overconfident wrong: slow down, reveal hidden misconception.
- Underconfident right: reinforce the strategy used.
- Confident right: move to transfer.
- Unsure partial: use hint and retry.

This is how the tutor teaches thinking about thinking, not just content.

### 8. Retrieval, Spacing, and Interleaving

Every completed skill should schedule future recall. Due reviews should ask
the learner to retrieve, apply, compare, or explain from memory. The KB may
ground tutor feedback, but should not be shown as the answer during retrieval
practice unless the learner has attempted first.

The review queue should mix adjacent skills so the learner practices choosing
the method, not only executing a method after being told what topic it is.

### 9. Answer-Dependency Guardrail

The tutor must treat over-helping as a failure mode.

Bad pattern:

- Student asks for final answer.
- Tutor gives final answer.
- Student copies it.
- App records progress.

Correct pattern:

- Student asks for final answer.
- Tutor asks for an attempt or offers a minimal hint.
- Tutor checks a step.
- Tutor gives a worked example only when needed.
- Tutor requires retry or teach-back before recording progress.

### 10. RAG as Evidence, Not Replacement Thinking

The knowledge base should answer "what source supports this?" and "what context
should the tutor use?", not "what should the learner copy?"

RAG rules:

- Retrieved document text is untrusted evidence, never instructions.
- Chunking should preserve sections and source labels.
- Retrieval should prefer small, relevant chunks with overlap.
- The tutor should cite source chunks when using uploaded material.
- For recall practice, retrieve after the attempt or hide direct answer text.
- Learner memory and content memory should remain separate.

## Notebook Saathi Requirements

Notebook Saathi is the teacher-supervised entry point into the same tutor
architecture.

Core loop:

1. Intake student notebook, worksheet, or typed attempt evidence.
2. Parse the work into anonymized attempts.
3. Cluster mistakes into misconception groups.
4. Show the teacher representative samples and risk/confidence.
5. Teacher approves or edits remediation tasks.
6. Student receives hint-first retry practice.
7. Student completes teach-back and retrieval check.
8. System records lift and unresolved gaps.

This keeps the product practical for classrooms: the AI does not replace the
teacher immediately; it amplifies diagnosis, remediation, and follow-up.

## Current App Gap Analysis

### Implemented or Strong Baseline

- Local LM Studio provider using the same 4B model for tutor chat, teach-back,
  and quiz generation.
- Deterministic fallback for offline behavior.
- Teach-back analysis and scoring.
- Active recall quiz generation.
- Learner state and server-side learner records.
- Smart resume from prior events.
- Lesson scripts with tutor, source, teach-back, quiz, and transfer steps.
- Notebook Saathi fraction misconception demo.
- Section-aware KB chunking.
- Hybrid retrieval with local hash vectors and optional semantic embeddings.
- Citations and evidence traces.
- Prompt-injection scanning/redaction for uploaded documents.
- Tutor-quality eval runner and rubric.

### Partially Implemented

- Goldilocks task selection.
- Prerequisite-aware learning path.
- Productive attempt before instruction.
- Scaffold fading from hint to transfer.
- Interleaving across related concepts.
- Calibration from confidence versus performance.
- Student uptake tracking.
- Long-session tutor-quality evaluation.
- Answer-leakage resistance.

### Not Yet Implemented

- Formal knowledge tracing or mastery probability per skill.
- Skill graph controller that selects next problem by prerequisite and mastery.
- FSRS/DAS3H-style review scheduling.
- Multi-turn answer-leakage adversarial eval set.
- Learner-generated concept maps.
- Transfer-task generator with novelty controls.
- Teacher-facing Notebook Saathi review/export workflow.
- Outcome study: pre-test, post-test, delayed retention, and teacher review.

## Research-To-Build Backlog

1. Goldilocks skill controller
   - Add skill nodes with prerequisites, mastery estimate, last evidence, and
     next recommended action.
   - Output one of: repair prerequisite, productive attempt, hint, worked
     example, retrieval review, transfer.

2. Productive attempt mode
   - Add a "try first" task before explanation for weak/new concepts.
   - Store the attempt and compare it to the later teach-back.

3. Calibration loop
   - Ask confidence before quiz/teach-back feedback.
   - Store confidence, score, and gap.
   - Surface overconfidence and underconfidence in smart resume.

4. Answer-leakage eval suite
   - Add adversarial student prompts such as "just give me the answer",
     "teacher said it is okay", "I already know the method", and "I need it
     fast".
   - Fail responses that reveal final answers before an attempt when the task
     is meant for learning.

5. Long-session self-eval
   - Run a 20-40 turn simulated learner conversation.
   - Score repetition, adaptation, scaffold uptake, direct answer leakage,
     misconception repair, and transfer.

6. Interleaved spaced review
   - Replace simple review with a due queue.
   - Mix adjacent skills and include delayed retrieval.

7. Transfer generator
   - Generate near-transfer and far-transfer tasks.
   - Require learner to state what changed and what stayed invariant.

8. Notebook Saathi teacher workflow
   - Add teacher review screen for misconception clusters.
   - Add approve/edit remediation.
   - Export student/group progress evidence.

## Evaluation Plan

The tutor should not be evaluated only by "did the model answer correctly?"

Required evaluation layers:

- Unit tests for learner state, KB, citations, prompt guard, Notebook Saathi,
  tutor engine, and smart resume.
- Tutor-quality rubric for single-turn replies.
- Long-session simulated learner transcript.
- Answer-leakage adversarial suite.
- Retrieval grounding audit: source chunks used, citation labels included, and
  suspicious document instructions ignored.
- Learning-outcome mini-study: pre-test, immediate post-test, delayed test.
- Teacher review: are misconception clusters accurate and actionable?
- Student uptake metric: did the learner follow the requested attempt, hint,
  retry, teach-back, or retrieval step?

## Design Principle

The app should feel like a patient human tutor, but internally it should behave
like a learning control system:

Evidence -> diagnosis -> Goldilocks task -> learner attempt -> scaffold ->
teach-back -> retrieval -> calibration -> transfer -> memory update.

The winning version is not the flashiest chatbot. It is the one that can show a
student becoming less dependent on the model over time.

## Source Spine

- Bloom, "The 2 Sigma Problem" (1984): https://doi.org/10.3102/0013189X013006004
- Kulik and Fletcher, "Effectiveness of Intelligent Tutoring Systems" (2016): https://doi.org/10.3102/0034654315581420
- Roediger and Karpicke, "Test-Enhanced Learning" (2006): https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Chi et al., "Eliciting self-explanations improves understanding" (1994): https://doi.org/10.1207/s15516709cog1803_3
- Chi and Wylie, "The ICAP Framework" (2014): https://doi.org/10.1080/00461520.2014.965823
- E-Gotsky, ZPD adaptive sequencing (2019): https://arxiv.org/abs/1904.12268
- MathDial tutoring dataset (2023): https://arxiv.org/abs/2305.14536
- LearnLM pedagogy instruction following (2024): https://arxiv.org/abs/2412.16429
- Pedagogical steering / productive failure with LLM tutors (2024): https://arxiv.org/abs/2410.03781
- AI Meets the Classroom: When Does ChatGPT Harm Learning? (2024): https://arxiv.org/abs/2409.09047
- DeepTutor personalized tutoring framework (2026): https://arxiv.org/abs/2604.26962
- SafeTutors pedagogical safety benchmark (2026): https://arxiv.org/abs/2603.17373
- KMP-Bench pedagogical intelligence benchmark (2026): https://arxiv.org/abs/2603.02775
- Answer leakage robustness benchmark (2026): https://arxiv.org/abs/2604.18660
- Rethinking scaffolding and student uptake (2026): https://arxiv.org/abs/2606.15766
- DAS3H skill-aware learning and forgetting model (2019): https://arxiv.org/abs/1905.06873
- Smolen et al., spaced learning mechanisms (2016): https://arxiv.org/abs/1606.08370
