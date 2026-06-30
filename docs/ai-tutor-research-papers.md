# AI Tutor Research And System Cross-Reference

This document keeps the paper review scoped to the AI tutor. It excludes the
unrelated autonomous-research framework papers except where a general evaluation
idea is useful.

The practical goal for NeuroTutor is not "chatbot that answers questions." It is
a lightweight intelligent tutoring system: it models the learner, asks for
active work, checks teach-backs, grounds answers in a local knowledge base,
tracks source use, and evaluates tutor quality.

For the full devised tutor-system architecture, see
`docs/tutor-system-architecture.md`. That document explains how the tutor works
as a learning system rather than a frontend/backend implementation.

## Paper Spine

| Source | Main useful finding | NeuroTutor decision | Implemented files | Still TODO |
|---|---|---|---|---|
| Bloom, "The 2 Sigma Problem" (1984), Educational Researcher, `https://doi.org/10.3102/0013189X013006004` | One-to-one tutoring plus mastery learning is the north-star learning experience: feedback, correction, and repeated attempts matter more than one-shot explanations. | Treat the app as a tutor loop with teach-back, quiz, repair, retention, and resume, not a plain answer bot. | `src/tutor-engine.js`, `src/learner-state.js`, `src/smart-resume.js`, `public/app.js`, `tests/tutor-engine.test.js`, `tests/smart-resume.test.js` | Stronger mastery thresholds, teacher/parent progress export, longer longitudinal learner study. |
| Kulik and Fletcher, "Effectiveness of Intelligent Tutoring Systems: A Meta-Analytic Review" (2016), `https://doi.org/10.3102/0034654315581420` | ITS evaluations can produce meaningful gains, but outcomes depend on implementation quality, aligned tests, and local versus standardized measures. | Ship a tutor-quality rubric and deterministic evals, then run LM Studio evals separately so the local model cannot hide behind fallback. | `src/tutor-eval.js`, `data/tutor-quality-evals.json`, `scripts/run-tutor-eval.mjs`, `tests/tutor-quality.test.js` | Add human-rated eval set, classroom-style task outcomes, and per-feature ablations. |
| VanLehn, "The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems" (2011), `https://doi.org/10.1080/00461520.2011.611369` | Human and computer tutoring effects vary by interaction quality; good tutoring requires feedback, hints, and learner-specific adaptation. | Keep Socratic prompts, hints, misconceptions, learner profile controls, and adaptive next actions as first-class behavior. | `src/tutor-engine.js`, `src/local-llm.js`, `src/learner-state.js`, `public/app.js` | More calibrated hint levels and better detection of productive struggle versus stuckness. |
| Graesser et al., AutoTutor / conversational ITS line, including "AutoTutor: An intelligent tutoring system with mixed-initiative dialogue" (2005), `https://doi.org/10.1109/TE.2005.856149` | Conversational tutors work best when dialogue is planned around deep questions, misconceptions, and mixed-initiative repair. | Multi-mode Feynman tutor, Socratic mode, role-reversal student mode, duck mode, teach-back analysis, and lesson scripts. | `src/tutor-engine.js`, `src/local-llm.js`, `src/lesson-script.js`, `tests/lesson-script.test.js` | Richer dialogue policy state and turn-level scaffolding labels. |
| Zhang et al., "SPL: A Socratic Playground for Learning Powered by Large Language Model" (2024), `https://arxiv.org/abs/2406.13919` | LLMs can power Socratic tutoring, but prompt design needs to create learning scenarios and multi-turn reflection rather than direct answer delivery. | Use Socratic and teach-back modes, require active-learning prompts in the quality rubric, and keep scenario/lesson planning visible. | `src/tutor-engine.js`, `src/tutor-eval.js`, `src/lesson-script.js`, `public/app.js` | Add explicit Socratic scenario templates per concept and domain. |
| Hu et al., "Generative AI in Education: From Foundational Insights to the Socratic Playground for Learning" (2025), `https://arxiv.org/abs/2501.06682` | Generative AI for education should put pedagogy before model fluency, track misconceptions, and structure prompts around learning goals. | Put learner state, misconception repair, lesson scripts, and source-grounded feedback around the LLM. | `src/learner-state.js`, `src/tutor-engine.js`, `src/local-llm.js`, `src/lesson-script.js`, `src/notebook-saathi.js` | Add richer misconception libraries for more subjects, not just current examples and Notebook Saathi fractions. |
| LearnLM Team, "LearnLM: Improving Gemini for Learning" (2024), `https://arxiv.org/abs/2412.16429` | General assistants tend to present information; learning models need explicit pedagogical instruction following and expert-rated learning behavior. | Prompts and rubric are explicit about pedagogy: active learning, adaptation, groundedness, safety, and clarity. | `src/local-llm.js`, `src/tutor-eval.js`, `data/tutor-quality-evals.json`, `scripts/run-tutor-eval.mjs` | Add expert/teacher preference ratings and compare local model prompts against deterministic baseline. |
| Cho et al., "A Systematic Review of Knowledge Tracing and Large Language Models in Education" (2024), `https://arxiv.org/abs/2412.09248` | Learner-state estimation is core to ITS, and LLMs may help with cold start but need interpretable, structured educational data. | Keep explicit learner profile, concept mastery, memory records, known/struggling concepts, and event journal instead of hiding state in chat history. | `src/learner-state.js`, `src/learner-records.js`, `src/tutor-engine.js`, `server.js`, `tests/learner-state.test.js`, `tests/learner-records.test.js` | Add more interpretable knowledge tracing over time and import/export of learner records. |
| Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (2020), `https://arxiv.org/abs/2005.11401` | RAG improves factuality and provenance by combining generated language with explicit retrieved memory. | Use local KB chunks, source labels, evidence traces, citations, and optional OpenAI-compatible embeddings. | `src/knowledge-base.js`, `src/embedding-provider.js`, `src/citations.js`, `src/citation-notebook.js`, `tests/knowledge-base.test.js`, `tests/embedding-provider.test.js`, `tests/citations.test.js` | Persistent vector cache and live verification of a real embedding model in LM Studio. |
| Liu et al., "Lost in the Middle: How Language Models Use Long Contexts" (2023), `https://arxiv.org/abs/2307.03172` | Long context alone is unreliable; relevant information can be missed depending on placement. | Retrieve concise, diversified chunks instead of dumping whole notes into the prompt. | `src/knowledge-base.js`, `src/local-llm.js`, `tests/knowledge-base.test.js` | Add reranking and query expansion for harder multi-document questions. |
| Greshake et al., "Not What You've Signed Up For" indirect prompt injection (2023), `https://arxiv.org/abs/2302.12173` | Retrieved external text can carry hostile instructions, so uploaded documents must be treated as untrusted evidence. | Scan/redact suspicious KB lines, mark source risk, and tell the LLM that retrieved text is evidence, not instructions. | `src/prompt-guard.js`, `src/knowledge-base.js`, `src/local-llm.js`, `tests/prompt-guard.test.js`, `tests/knowledge-base.test.js` | Stronger policy tests with adversarial uploaded docs and refusal/ignore scoring. |
| OWASP Top 10 for LLM Applications, prompt injection guidance, `https://genai.owasp.org/llm-top-10/` | LLM apps need explicit defenses for prompt injection, insecure output handling, over-trust, and data leakage. | Keep the tutor dependency-light, avoid tool execution from retrieved text, and track suspicious source content. | `src/prompt-guard.js`, `src/citations.js`, `server.js`, `tests/prompt-guard.test.js` | Add user-visible security report for uploaded documents. |
| Yan et al., "Practical and Ethical Challenges of Large Language Models in Education: A Systematic Scoping Review" (2023), `https://arxiv.org/abs/2303.13379` | LLM education systems need transparency, human-centered design, privacy awareness, and safeguards against shallow automation of learning tasks. | Require teach-back, active recall, Socratic prompts, self-check scores, and source traces so the learner must do work. | `src/tutor-engine.js`, `src/tutor-eval.js`, `src/citation-notebook.js`, `public/app.js` | Add over-helping detector, privacy/export controls, and "ask before answer" policy tests. |
| Hazra et al., "SafeTutors: Benchmarking Pedagogical Safety in AI Tutoring Systems" (2026), `https://arxiv.org/abs/2603.17373` | Pedagogical safety is different from generic LLM safety; multi-turn tutors can over-disclose answers, reinforce misconceptions, and fail to scaffold. | Treat answer leakage and over-helping as tutor-quality failures, not just style issues. | `src/local-llm.js`, `src/tutor-eval.js`, `data/tutor-quality-evals.json` | Add explicit answer-leakage and multi-turn pedagogical-safety eval cases. |
| Zhao et al., "Evaluating Answer Leakage Robustness of LLM Tutors against Adversarial Student Attacks" (2026), `https://arxiv.org/abs/2604.18660` | Students may actively try to extract final answers, so tutor robustness needs adversarial evaluation. | Add a hard product requirement that Socratic/hint modes should resist direct-answer extraction. | `src/local-llm.js`, `src/tutor-eval.js` | Add adversarial student prompts to the eval suite. |
| Shi et al., "From Solver to Tutor: Evaluating the Pedagogical Intelligence of LLMs with KMP-Bench" (2026), `https://arxiv.org/abs/2603.02775` | Solving ability is not the same as tutoring ability; models can solve problems while struggling with pedagogical dialogue. | Keep tutor eval focused on challenge, explanation, feedback, misconception repair, and multi-turn behavior. | `src/tutor-eval.js`, `scripts/run-full-tutor-session.mjs` | Add multi-turn dialogue cases to the local rubric. |
| Neagu et al., "Rethinking Scaffolding in LLM Tutors" (2026), `https://arxiv.org/abs/2606.15766` | Real students may bypass scaffolding, so tutor evaluation should measure student uptake as well as chatbot scaffolding. | Track whether the learner responds to the requested teach-back, quiz, or hint step instead of only scoring tutor text. | `src/learner-records.js`, `src/smart-resume.js`, `src/tutor-eval.js` | Add uptake metrics to learner events and long-session evals. |

## Devised Tutor Systems And Files

These are the systems devised for this app after reviewing the reference repos
and tutor literature. "Source basis" means the idea is supported by the paper
spine, the cloned project analysis, or both.

| System / idea | Source basis | Local implementation files | Practical status |
|---|---|---|---|
| Local LM Studio tutor provider using the same 4B model for tutor chat, teach-back evaluation, and quiz generation | User requirement plus LearnLM-style pedagogical instruction following | `src/local-llm.js`, `server.js`, `scripts/check-llm-health.mjs`, `tests/local-llm.test.js` | Implemented with deterministic fallback and health reporting. |
| Deterministic tutor fallback for offline operation | Simplicity baseline and verification requirement | `src/tutor-engine.js`, `src/local-llm.js`, `tests/tutor-engine.test.js` | Implemented; fallback reason is exposed. |
| Feynman explainer mode | Bloom, AutoTutor, `neuro-tutoe` | `src/tutor-engine.js`, `src/local-llm.js`, `public/app.js` | Implemented. |
| Socratic mode | SPL, AutoTutor, `mathvoice`, `ostep-socratic-tutor` | `src/tutor-engine.js`, `src/local-llm.js`, `public/app.js` | Implemented; richer scenario templates remain TODO. |
| Role-reversal student mode | Feynman method, `neuro-tutoe`, `Mr.-Ranedeer-AI-Tutor` | `src/tutor-engine.js`, `src/local-llm.js`, `public/app.js` | Implemented. |
| Duck mode | Reference repo prompt modes and teach-back practice | `src/tutor-engine.js`, `src/local-llm.js`, `public/app.js` | Implemented as a low-pressure explanation mode. |
| Teach-back scoring and misconception repair | Bloom mastery learning, AutoTutor, LearnLM, `neuro-tutoe` | `src/tutor-engine.js`, `src/local-llm.js`, `tests/tutor-engine.test.js` | Implemented for core concepts. |
| Notebook Saathi misconception detector | Teacher-supervised AI tutor framing, ITS misconception tracking | `src/notebook-saathi.js`, `public/app.js`, `public/index.html`, `public/styles.css`, `tests/notebook-saathi.test.js` | Implemented demo for fraction work samples and retry attempts. |
| Active recall quiz generator | Bloom mastery loop, `neuro-tutoe`, `gen-mentor`, `multi-agent-study-assistant` | `src/tutor-engine.js`, `src/local-llm.js`, `public/app.js`, `tests/tutor-engine.test.js` | Implemented. |
| Spaced review and retention model | Mastery learning, `neuro-tutoe`, `Tov-learn` | `src/tutor-engine.js`, `src/learner-state.js`, `public/app.js` | Implemented lightweight scheduling; SM-2/FSRS upgrade remains TODO. |
| Explicit learner profile and memory | Knowledge tracing review, `tutor-gpt`, `gen-mentor` | `src/learner-state.js`, `src/learner-records.js`, `server.js`, `tests/learner-state.test.js`, `tests/learner-records.test.js` | Implemented with server snapshot and browser fallback. |
| Concept graph and prerequisite-aware learning path | ITS domain/student model, `mathvoice`, `gen-mentor` | `src/concepts.js`, `src/tutor-engine.js`, `tests/tutor-engine.test.js` | Implemented. |
| Weak-area detection and adaptive resources | ITS learner modeling, `mathvoice`, `multi-agent-study-assistant` | `src/tutor-engine.js`, `public/app.js` | Implemented as local recommendations. |
| Course outline generator | `learnflow-ai`, `Tov-learn`, ITS curriculum planning | `src/course-outline.js`, `server.js`, `tests/course-outline.test.js` | Implemented from concept graph, goal, learner model, and KB coverage. |
| Saved lesson scripts | AutoTutor script idea, `Tov-learn` | `src/lesson-script.js`, `server.js`, `tests/lesson-script.test.js` | Implemented. |
| Smart resume | Long-session tutor continuity, `Tov-learn`, `vibe-learning-agenticworkflow` | `src/smart-resume.js`, `server.js`, `tests/smart-resume.test.js` | Implemented. |
| Section-aware local KB chunking | RAG, Lost in the Middle, DeepTutor-style KB | `src/knowledge-base.js`, `tests/knowledge-base.test.js` | Implemented with default chunk size around 220 tokens and overlap. |
| Hybrid retrieval | RAG, DeepTutor, current local-first constraints | `src/knowledge-base.js`, `src/embedding-provider.js`, `tests/knowledge-base.test.js`, `tests/embedding-provider.test.js` | Implemented with keyword, hashed-vector, concept boost, and optional semantic embeddings. |
| Source labels and evidence traces | RAG provenance and tutor auditability | `src/citations.js`, `src/citation-notebook.js`, `src/knowledge-base.js`, `tests/citations.test.js`, `tests/citation-notebook.test.js` | Implemented. |
| Prompt-injection guardrails for uploaded docs | Indirect prompt injection paper, OWASP | `src/prompt-guard.js`, `src/knowledge-base.js`, `src/local-llm.js`, `tests/prompt-guard.test.js` | Implemented baseline scanner/redactor and untrusted-context prompting. |
| Tutor-quality scoring rubric | Kulik and Fletcher evaluation caution, LearnLM expert rating idea | `src/tutor-eval.js`, `data/tutor-quality-evals.json`, `scripts/run-tutor-eval.mjs`, `tests/tutor-quality.test.js` | Implemented for deterministic and LM Studio eval paths. |
| Full tutor session smoke runner | Whole-system verification requirement | `scripts/run-full-tutor-session.mjs`, `server.js` | Implemented; requires running server for HTTP smoke. |
| Whiteboard artifact model | AutoTutor multimodal support, `ChatTutor`, `mathvoice` | `src/tutor-engine.js`, `public/app.js`, `public/styles.css` | Implemented as lightweight artifacts; richer rendering remains TODO. |
| UI/UX working tutor surface | Reference app UX synthesis plus UI/UX skill requirements | `public/index.html`, `public/app.js`, `public/styles.css`, `design-system/MASTER.md` | Implemented as a runnable browser app. |
| Runtime persistence and API layer | Practical local app requirement | `server.js`, `data/user-knowledge.json`, `data/learner-state.json`, `data/learner-events.json`, `data/lesson-scripts.json` | Implemented locally; runtime learner files are ignored by Git except eval fixtures. |

## Clone Reference To Implementation Summary

| Reference repo | Useful idea salvaged | Implemented as | Main files |
|---|---|---|---|
| `Vikaash-dev/neuro-tutoe` | Feynman tutor, teach-back, active recall, memory, concept graph, local tutor dashboard | Core NeuroTutor loop | `src/tutor-engine.js`, `src/concepts.js`, `public/app.js` |
| `HKUDS/DeepTutor` clone | KB, hybrid retrieval, citation notebook, question generation | Local RAG plus evidence trace | `src/knowledge-base.js`, `src/citation-notebook.js`, `src/citations.js` |
| `JushBJJ/Mr.-Ranedeer-AI-Tutor` | Configurable tutor persona and learning style | Profile controls and tutor modes | `src/learner-state.js`, `src/tutor-engine.js`, `public/app.js` |
| `plastic-labs/tutor-gpt` | Theory-of-mind learner profile before reply | Explicit learner snapshot and prompt context | `src/learner-state.js`, `src/local-llm.js` |
| `GeminiLight/gen-mentor` | Skill gaps, learning path scheduler, tailored content | Gap inference and learning paths | `src/tutor-engine.js` |
| `llSourcell/mathvoice` | Socratic prompts, prerequisites, weak-area tracking, whiteboard direction | Socratic mode, concept graph, weak areas, artifacts | `src/concepts.js`, `src/tutor-engine.js` |
| `HugeCatLab/ChatTutor` | Teaching artifacts as first-class outputs | Lightweight whiteboard artifacts | `src/tutor-engine.js`, `public/app.js` |
| `A-R007/Multi-Agent-Study-Assistant` | Analyzer, roadmap, quiz, tutor, resources | Single-app route functions instead of heavy agents | `src/tutor-engine.js`, `src/course-outline.js`, `src/lesson-script.js` |
| `TovTechOrg/Tov-learn` | Smart resume, lesson scripts, spaced review | Resume endpoint, scripts, review memory | `src/smart-resume.js`, `src/lesson-script.js`, `src/tutor-engine.js` |
| `learnflow-ai` | Course outline and teacher/student course flow | Course outline generation and KB-based lesson planning | `src/course-outline.js`, `src/lesson-script.js` |
| `llamatutor` | Minimal local provider-driven web tutor | Dependency-light Node/browser app with LM Studio provider | `server.js`, `src/local-llm.js`, `public/app.js` |
| `ostep-socratic-tutor` | Small domain-specific Socratic tutor | Socratic mode and KB-grounded tutor behavior | `src/tutor-engine.js`, `src/knowledge-base.js` |
| `vibe-learning-agenticworkflow` | Learner state, concept map, quality gates, session lifecycle | State snapshot, concept graph, tutor eval, smart resume | `src/learner-state.js`, `src/concepts.js`, `src/tutor-eval.js`, `src/smart-resume.js` |

## Implementation Verdict

The current baseline is credible because the app now covers the minimum loop
that the papers and cloned systems converge on:

1. Diagnose the learner, not just the question.
2. Teach with questions, examples, and hints.
3. Require learner work through teach-back and quizzes.
4. Store learner state and resume from evidence.
5. Ground tutoring in local KB chunks with citations.
6. Treat uploaded knowledge as untrusted evidence.
7. Evaluate tutor behavior with a rubric and runnable tests.

## Remaining Research-Backed TODO

1. Add a stronger spaced repetition algorithm such as SM-2 or FSRS.
2. Add persistent vector caching and verify a real embedding model in LM Studio.
3. Expand the tutor-quality dataset with human-rated conversations and long
   multi-turn examples.
4. Add adversarial KB documents to the prompt-injection eval set.
5. Add over-helping and answer-dumping checks to protect learner agency.
6. Add richer subject-specific misconception libraries beyond the current core
   concepts and Notebook Saathi fraction demo.
7. Run classroom-style outcome tests: pre-test, tutor session, post-test,
   delayed retention check.
8. Add productive-failure entry tasks before instruction on new hard concepts.
9. Add confidence prediction before retrieval and show calibration gaps after
   scoring.
10. Add interleaved review queues and adaptive scaffolding fade-out.
