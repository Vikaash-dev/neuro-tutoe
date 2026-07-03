# AI Tutor Needed Topics Map

Date: 2026-07-03

Purpose: define the complete research and build surface for NeuroTutor /
Notebook Saathi. This document keeps the goal focused on an actual tutor that
builds skill, metacognition, and transfer, not a chat app that only explains.

## North Star

The tutor should make a learner increasingly independent. Every feature should
answer one question: does this help the learner think, attempt, explain,
remember, calibrate, and transfer better than direct answer generation?

## Topic Coverage

| Topic | Why it matters | Product mechanism | Status |
| --- | --- | --- | --- |
| Prior knowledge bridge | Learners understand new skills by attaching them to existing schemas. | Skill graph, prerequisite repair, analogies based on known concepts. | Partial: concepts and prerequisites exist; adaptive bridge selector is needed. |
| Zone of proximal development / Goldilocks zone | Learning happens when tasks are challenging but achievable. | Next-action controller: repair, productive attempt, hint, worked example, retrieval, transfer. | Partial: session phases exist; full controller is needed. |
| Skill acquisition stages | Novices need models; developing learners need practice; stronger learners need transfer and autonomy. | Cognitive -> associative -> autonomous state labels per concept. | Needed. |
| Deliberate practice | Skill grows through targeted practice beyond comfort with feedback. | Micro-practice tasks tied to one weak subskill and one feedback loop. | Partial: quiz and teach-back exist; task targeting should improve. |
| Retrieval practice | Testing strengthens memory more than rereading. | Attempt-first recall, active quiz, delayed checks. | Implemented baseline; interleaved/delayed review should improve. |
| Spacing and consolidation | Memory stabilizes over time through spaced reactivation. | Due-review scheduler with stability and forgetting risk. | Partial: lightweight review exists; FSRS/DAS3H-inspired scheduler needed. |
| Interleaving | Learners need to choose the right method, not just execute after topic cues. | Mixed review queue across related concepts. | Needed. |
| Worked examples and fading | Novices benefit from worked examples; stronger learners need reduced guidance. | Worked example -> completion problem -> independent transfer. | Partial: whiteboard and examples exist; adaptive fading needed. |
| Cognitive load | Too much complexity blocks learning. | Chunked steps, one misconception at a time, compact visual artifacts. | Partial. |
| Self-explanation / Feynman teach-back | Generating explanations reveals missing links. | Teach-back scoring, claim extraction, why/how repair. | Implemented baseline; claim-level follow-up needed. |
| Learning by teaching | Teaching a tutor/peer creates accountability and deeper processing. | "Teach the tutor" mode with guided checklist and feedback. | Partial: duck/student modes exist; rubric-guided version needed. |
| Metacognitive calibration | Learners misjudge what they know, especially when AI helps too much. | Confidence prediction before feedback; prediction-vs-score gap. | Implemented baseline in tutor engine and persisted assessment history; UI flow still needed. |
| Transfer | Real skill means applying knowledge in new contexts. | Near-transfer, far-transfer, and "what changed / what stayed invariant" prompts. | Partial: transfer prompts and deterministic transfer scoring exist; UI/eval integration needed. |
| Misconception diagnosis | A tutor must know why an answer is wrong. | Misconception library, cluster detector, repair tasks. | Partial: core concepts and Notebook Saathi fractions exist. |
| Learner modeling | Personalization requires dynamic memory beyond chat history. | Per-skill mastery, attempts, misconceptions, confidence, review due dates. | Partial. |
| Knowledge tracing | ITS systems need estimates of mastery and forgetting. | Simple BKT-like fields first; upgrade later if outcome data exists. | Needed. |
| Pedagogical safety | Over-helping, answer leakage, and misconception reinforcement are tutor failures. | Hint-first policy, adversarial answer-leakage evals, response filter. | Partial: prompts/rubric exist; eval/filter needed. |
| Student uptake | A tutor request only works if the learner follows it. | Track whether the learner attempted, retried, explained, or bypassed scaffolding. | Needed. |
| RAG and KB | Source grounding helps, but documents must not replace learner thinking. | Section-aware chunks, citations, prompt-injection guard, attempt-before-source rule. | Implemented baseline. |
| Prompt injection | Uploaded docs are untrusted and can attack the tutor prompt. | Scanner, redaction, untrusted-context instruction, risk labels. | Implemented baseline; stronger adversarial tests needed. |
| Local 4B LLM constraints | The current model is small; control logic must carry the pedagogy. | Deterministic fallback, strict JSON repair, short prompts, server-side scoring. | Implemented baseline. |
| Long-session quality | A tutor may look good in one turn and fail over 30 turns. | Simulated learner transcript eval, repetition/adaptation/leakage scoring. | Needed. |
| Teacher-supervised workflow | Notebook Saathi must fit classrooms and teacher trust. | Evidence intake, misconception clusters, teacher approve/edit, retry evidence. | Partial demo; teacher workflow needed. |
| Privacy and deployment | Student evidence should be local-first and explainable. | Local LM Studio, anonymized rows, export controls, no hidden external tools. | Partial. |
| UX for learning | Interface should encourage attempts, not passive reading. | Attempt panel, confidence slider, hint steps, teach-back, review queue. | Partial. |
| Outcome evaluation | Claims need evidence beyond demos. | Pre-test, post-test, delayed test, teacher rubric, ablation logs. | Needed. |
| Autonomous background agents | Some tutor work should run as scheduled or event-triggered workflows rather than live chat. | AutoGPT-style agents for evidence processing, teacher summaries, long-session evals, and review queue maintenance. | Needed for background workflows; not needed for the core live tutor loop yet. |
| Evolving tutor policies | Tutor behavior should improve from failures, but only through gated offline evaluation. | A-Evolve-style solve-observe-evolve loop for prompts, tutor skills, rubrics, and policy fragments against tutor benchmarks. | Needed as an offline optimization layer; must not auto-change live learner behavior. |

## Research Backbone

- Bloom, "The 2 Sigma Problem" (1984): https://doi.org/10.3102/0013189X013006004
- Kulik and Fletcher, ITS meta-analysis (2016): https://doi.org/10.3102/0034654315581420
- Roediger and Karpicke, retrieval practice (2006): https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Chi et al., self-explanation (1994): https://doi.org/10.1207/s15516709cog1803_3
- Chi and Wylie, ICAP active learning framework (2014): https://doi.org/10.1080/00461520.2014.965823
- E-Gotsky ZPD adaptive sequencing (2019): https://arxiv.org/abs/1904.12268
- Smolen, Zhang, and Byrne, spaced learning mechanisms (2016): https://arxiv.org/abs/1606.08370
- DAS3H skill-aware learning and forgetting (2019): https://arxiv.org/abs/1905.06873
- Deep Knowledge Tracing (2015): https://arxiv.org/abs/1506.05908
- MathDial tutoring dialogue dataset (2023): https://arxiv.org/abs/2305.14536
- LearnLM pedagogy instruction following (2024): https://arxiv.org/abs/2412.16429
- Pedagogical steering and productive failure for LLM tutors (2024): https://arxiv.org/abs/2410.03781
- AI Meets the Classroom: When Does ChatGPT Harm Learning? (2024): https://arxiv.org/abs/2409.09047
- DeepTutor personalized tutoring (2026): https://arxiv.org/abs/2604.26962
- SafeTutors pedagogical safety (2026): https://arxiv.org/abs/2603.17373
- KMP-Bench solver-versus-tutor evaluation (2026): https://arxiv.org/abs/2603.02775
- Answer leakage robustness (2026): https://arxiv.org/abs/2604.18660
- Rethinking scaffolding and student uptake (2026): https://arxiv.org/abs/2606.15766

## Implementation Order

1. Build the tutor control layer before more UI polish.
2. Add attempt and confidence data before adding more generated explanations.
3. Add answer-leakage evaluation before claiming tutor safety.
4. Add due reviews and interleaving before claiming durable memory.
5. Add long-session eval before claiming human-replacement tutor quality.
6. Add Notebook Saathi teacher review after the student loop is measurable.
7. Add offline tutor-policy evolution only after benchmarks are strong enough
   to reject harmful mutations.

## AutoGPT Agent Use

AutoGPT should not become the core tutor brain right now. The live learner
conversation needs strict control, measurable state transitions, and low
latency with the local 4B LM Studio model. A persistent autonomous agent layer
is useful around the tutor, where work can happen asynchronously and can be
reviewed before affecting learners.

Recommended AutoGPT-style agents:

1. Evidence Intake Agent
   - Trigger: teacher uploads notebook/worksheet rows.
   - Work: parse attempts, anonymize rows, detect malformed entries, create a
     clean evidence package.
   - Output: structured attempts for Notebook Saathi review.

2. Misconception Cluster Agent
   - Trigger: new evidence package.
   - Work: cluster attempts by likely misconception, attach representative
     examples, and flag low-confidence clusters for teacher review.
   - Output: teacher-facing misconception board.

3. Remediation Planner Agent
   - Trigger: teacher approves a cluster.
   - Work: create hint-first retry tasks, one teach-back prompt, one retrieval
     check, and one transfer problem.
   - Output: remediation plan sent into the app's controlled tutor loop.

4. Review Scheduler Agent
   - Trigger: daily or after assessment events.
   - Work: update due reviews from mastery, confidence, and forgetting risk.
   - Output: learner review queue.

5. Tutor Quality Eval Agent
   - Trigger: nightly, pre-push, or manual run.
   - Work: run deterministic evals, optional LM Studio evals, and long-session
     simulated learner conversations.
   - Output: quality report with answer leakage, scaffold uptake, repetition,
     misconception repair, and transfer scores.

6. Research Watch Agent
   - Trigger: weekly or before major architecture changes.
   - Work: check selected arXiv/GitHub sources for tutor, learning-science, and
     pedagogical-safety updates.
   - Output: short research delta with implementation impact.

Safety boundary:

- AutoGPT agents may propose remediation, summaries, and review schedules.
- The app's tutor controller must approve or constrain anything shown live to
  the learner.
- Agents must not execute code from uploaded documents.
- Agents must not mark mastery complete without learner evidence.
- Agents must not bypass the hint-first policy.

## A-Evolve Tutor Optimization

A-Evolve is useful after the tutor has measurable benchmarks. It should evolve
the tutor's prompts, rubric fragments, skills, and memory procedures offline,
then promote only changes that pass holdout tests. It should not mutate live
behavior during a student session.

Recommended evolvable workspace:

```text
tutor-policy-workspace/
  manifest.yaml
  prompts/
    tutor-system.md
    teach-back-evaluator.md
    quiz-generator.md
  skills/
    hint-first-scaffolding/SKILL.md
    misconception-repair/SKILL.md
    calibration-feedback/SKILL.md
    answer-leakage-defense/SKILL.md
  memory/
    episodic-failures.jsonl
    semantic-rules.jsonl
  benchmarks/
    tutor-quality.json
    long-session.json
    answer-leakage.json
    notebook-saathi.json
```

Evolution loop:

1. Solve
   - Run the current tutor policy on tutor-quality cases, long simulated
     learner conversations, adversarial answer-leakage cases, and Notebook
     Saathi remediation cases.

2. Observe
   - Score each trajectory for active learning, hint-first behavior,
     misconception repair, calibration, transfer, source grounding, and
     answer-leakage resistance.

3. Evolve
   - Mutate only prompt fragments, rubric language, skill instructions, and
     failure-memory rules. Do not mutate runtime code in the same loop.

4. Gate
   - Require all existing unit tests.
   - Require holdout tutor-quality score not to regress.
   - Require answer-leakage score to improve or remain at zero leakage.
   - Require no new unsafe direct-answer behavior.

5. Promote
   - Convert accepted changes into normal repo edits.
   - Review diffs manually.
   - Commit only after deterministic tests and, when available, LM Studio evals.

First benchmark targets:

- Single-turn tutor quality: current `data/tutor-quality-evals.json`.
- Long-session learner simulation: extend `scripts/run-full-tutor-session.mjs`.
- Answer leakage: adversarial student prompts asking for final answers.
- Calibration: confidence prediction versus score gap.
- Notebook Saathi: misconception cluster accuracy and remediation usefulness.

Why this matters:

- The tutor should learn from failure without experimenting on students.
- Evolution should optimize measurable pedagogy, not just nicer language.
- Bad mutations must be rolled back by benchmarks before they reach the app.
- The core tutor remains deterministic and auditable while policies improve.

## Definition of "Actual Tutor"

The app can call itself a practical AI tutor when it can show:

- It selects the next action from learner evidence.
- It asks the learner to attempt before receiving answers.
- It detects and repairs misconceptions.
- It requires teach-back and scores explanation quality.
- It schedules delayed retrieval.
- It tracks confidence calibration.
- It resists direct answer extraction.
- It can run a long simulated tutoring session without losing pedagogy.
- It gives teachers inspectable misconception and progress evidence.
