# NeuroTutor Web

A working browser-based AI tutor app salvaged from the `Vikaash-dev/neuro-tutoe`
reference idea set. It keeps the strongest product mechanics while avoiding the
Expo/mobile/server complexity:

- Feynman tutor modes: explainer, Socratic, role-reversal student, and duck mode
- Teach-back analysis for gaps, misconceptions, and refined explanations
- Active recall quizzes with memory updates
- Spaced review, retention, consolidation, and mastery tracking
- Concept graph with prerequisite and related-topic links
- Goal-oriented study plans with skill-gap analysis
- Smart resume panel that turns saved state and journal events into next actions
- Course outline generator that turns the current concept graph, learner model, and KB source coverage into modules and checkpoints
- Saved lesson scripts that turn plans into step-by-step tutor, source, teach-back, quiz, and transfer sessions
- Weak-area detection and adaptive resource recommendations
- Local knowledge base with section-aware chunking, hybrid retrieval, source labels, and prompt-injection guardrails
- Tutor-quality evaluation dataset and scoring rubric
- Per-response tutor self-checks shown inside the live chat and saved with the learner journal
- Citation notebook that tracks which retrieved source chunks were cited or left unused across the session
- Server-side learner event journal for tutor, teach-back, quiz, KB, and evidence events
- Server-side learner state snapshot for profile, memory, chat, quiz, and session restore
- Rendered whiteboard artifacts with concept diagrams, misconception contrasts, and worked examples
- Browser `localStorage` fallback when the server is unavailable
- User-added knowledge persistence through `data/user-knowledge.json`

The app is dependency-light and runs with Node only.

## Local LLM

The server uses the LM Studio OpenAI-compatible API by default:

```text
http://192.168.1.7:1234/v1
```

The same loaded local model is used for tutor chat, teach-back evaluation, and
quiz generation. If LM Studio reports multiple models, the server prefers a
loaded `4b` model; otherwise it uses the first model from `/v1/models`. You can
override settings with:

```powershell
$env:LLM_BASE_URL = "http://192.168.1.7:1234/v1"
$env:LLM_MODEL = "your-loaded-model-id"
$env:LLM_TIMEOUT_MS = "60000"
$env:LLM_ENABLED = "true"
npm.cmd run dev
```

LM Studio structured output is requested with `json_schema`. Some reasoning
models return the JSON in `reasoning_content` while leaving `content` empty; the
adapter reads both fields before deciding the response is malformed. If LM
Studio is offline, times out, or still returns malformed JSON, the app falls
back to its local deterministic tutor engine and exposes that fallback reason in
the UI and eval reports.

To diagnose the local model connection from the same Node runtime the tutor
uses:

```powershell
npm.cmd run doctor:llm
```

The dashboard also shows whether the tutor is using LM Studio or deterministic
fallback, including the first troubleshooting step when `/api/llm/health`
cannot reach the configured endpoint.

## Knowledge Base / RAG

The Knowledge tab lets you paste notes, import `.txt` / `.md` / simple `.json`
documents, or add PDF-extracted text. The server stores those documents locally,
chunks them by Markdown sections with overlap, indexes the chunks, and retrieves
only relevant chunks for tutor chat, teach-back analysis, and quiz generation.

Current retrieval setup:

- Built-in concept cards are indexed automatically.
- User documents are stored in `data/user-knowledge.json`.
- Chunks default to about 220 tokens with 45-token overlap.
- Retrieval uses BM25-style keyword scoring, vector similarity, and
  concept-graph boosts for the current concept, prerequisites, and related
  concepts.
- By default, vectors use the dependency-free local hashed embedding fallback so
  the app always runs offline.
- For real semantic embeddings, set `EMBEDDING_MODE=openai-compatible` and point
  `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` at an OpenAI-compatible embedding
  server such as LM Studio with an embedding model loaded.
- Results are diversified so one long document cannot dominate every source.
- Tutor responses can show compact source chips such as `S1`, `S2`, etc.
- User-added documents can be deleted from the Knowledge tab.
- Any document can be opened to inspect the exact chunks available to retrieval.
- Uploaded documents are scanned for prompt-injection patterns. Suspicious lines
  are redacted before retrieval context reaches the LLM, source chips carry risk
  metadata, and the LLM prompts explicitly treat retrieved text as untrusted
  evidence rather than instructions.
- Tutor, teach-back, and quiz responses include an evidence trace that records
  retrieved source labels, cited labels such as `[S1]`, invalid labels, uncited
  chunks, and source snippets.

Example semantic embedding setup:

```powershell
$env:EMBEDDING_MODE = "openai-compatible"
$env:EMBEDDING_BASE_URL = "http://192.168.1.7:1234/v1"
$env:EMBEDDING_MODEL = "your-loaded-embedding-model-id"
npm.cmd run dev
```

Useful endpoint:

```text
http://127.0.0.1:5173/api/kb/embeddings/health
```

## Tutor Quality Baseline

The checked-in eval set lives at `data/tutor-quality-evals.json`, and the rubric
lives in `src/tutor-eval.js`. It scores each tutor reply across:

- Concept coverage
- Misconception handling
- Active-learning prompts
- Learner-profile adaptation
- Groundedness and safety
- Clarity

`npm.cmd test` runs the quality baseline. The current deterministic tutor
baseline passes all eval cases, so future changes have a guardrail against
regressing tutor behavior while the local LLM prompts continue to improve.
The same rubric is now applied to every live `/api/tutor` response, so chat
messages include a compact self-check score and the learner journal can track
average tutor quality over time.

You can also run the tutor-quality eval directly:

```powershell
npm.cmd run eval:tutor
```

To score the actual LM Studio tutor responses, first make sure LM Studio's local
server is reachable, then run:

```powershell
npm.cmd run eval:tutor:llm
```

The LLM eval command uses `--require-llm`, so it fails if the app falls back to
the deterministic tutor. That keeps the quality gate honest.

## Learner State And Journal

The server writes compact durable learning events to `data/learner-events.json`.
The journal records tutor replies, teach-back assessments, generated quizzes,
completed quizzes, added knowledge documents, provider/fallback metadata, scores,
gaps, and evidence-trace summaries.

The server also stores the restorable learner snapshot in
`data/learner-state.json`: profile controls, known/struggling concepts, memory
records, chat messages, current quiz, active mode, learning goal, and the latest
teach-back result. The browser hydrates from the server when no local progress
exists, prefers a newer server snapshot when one exists, and pushes newer local
progress back to the server.

Lesson scripts are saved in `data/lesson-scripts.json`. They are generated from
the current learner state, study goal, concept graph, and learner journal, then
refreshed against new events so completed tutor, teach-back, and quiz steps
advance the current step.

Useful endpoints:

```text
http://127.0.0.1:5173/api/learner/events
http://127.0.0.1:5173/api/learner/citations
http://127.0.0.1:5173/api/learner/course-outline
http://127.0.0.1:5173/api/learner/lesson-script
http://127.0.0.1:5173/api/learner/resume
http://127.0.0.1:5173/api/learner/state
```

## Clone Project Analysis

The full salvage matrix is in `docs/clone-project-analysis.md`. It maps each
already-cloned tutor/reference repo to useful ideas, reusable code or patterns,
rejected parts, what is already implemented here, and what remains TODO.

## AI Tutor Research Cross-Reference

The AI-tutor paper spine and implementation audit lives in
`docs/ai-tutor-research-papers.md`. It connects the tutor literature, cloned
reference ideas, devised app systems, exact local implementation files, and
remaining research-backed TODOs.

The tutor-system design lives in `docs/tutor-system-architecture.md`. It
explains how NeuroTutor works as a learning system: learner model, tutor policy,
teach-back loop, quiz loop, knowledge/evidence model, memory, safety, and
quality evaluation. It also records the active-construction requirement: the
tutor should prefer learner attempts, hints, retrieval, self-explanation,
calibration, and fading over answer delivery.

## Run

```powershell
npm.cmd run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Test

```powershell
npm.cmd test
```

## Full Tutor Session Smoke

With the server running, this command drives a realistic learner journey through
the actual HTTP system: tutor repair, Socratic follow-up, teach-back analysis,
quiz generation, learner journal, state save, smart resume, course outline, and lesson-script
generation. It also verifies that live tutor replies include self-evaluation
scores from the tutor-quality rubric and that cited source chunks flow into the
citation notebook.

```powershell
npm.cmd run smoke:tutor-session
```

## Health Checks

```text
http://127.0.0.1:5173/api/health
http://127.0.0.1:5173/api/llm/health
http://127.0.0.1:5173/api/kb
```

## Reference Ideas Salvaged

From `Vikaash-dev/neuro-tutoe`:

- NeuroTutor dashboard and learning-loop shape
- Feynman technique teach-back flow
- Spaced repetition and memory-state model
- Active recall quiz loop
- Knowledge graph relationships
- Document RAG pipeline, adapted into a web/server implementation with stronger
  chunking and retrieval
- Theory-of-mind profile controls
- Multi-mode tutor behavior
- FSRS/forgetting-curve direction, represented here by stability and retention
  scheduling in the lightweight memory engine

From already-cloned related tutor projects:

- `JushBJJ/Mr.-Ranedeer-AI-Tutor`: explicit tutor configuration for depth,
  learning style, communication style, tone, and tests
- `plastic-labs/tutor-gpt`: theory-of-mind style learner representation and
  separate meta-context before the final tutor response
- `GeminiLight/gen-mentor`: goal-oriented ITS flow: skill gaps, learner model,
  learning path scheduler, tailored content, chatbot tutor
- `llSourcell/mathvoice`: Socratic mode, prerequisite-gated topic graph,
  mastery-based difficulty, and weak-area tracking
- `HugeCatLab/ChatTutor`: whiteboard/diagram/note artifacts as first-class
  teaching outputs
- `A-R007/Multi-Agent-Study-Assistant`: analyzer, roadmap, quiz, tutor,
  resource finder, and document-Q&A agent roles
- `TovTechOrg/Tov-learn`: smart resume, lesson scripts, exercises, spaced
  review, and project-grounded examples

This version intentionally ships as a web app first so it is runnable in this
workspace without mobile tooling or API credentials.
