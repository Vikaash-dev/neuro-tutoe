# NeuroTutor AI 🧠

> **Neuroscience-backed AI tutor** — Feynman Technique + Spaced Repetition + RAG-powered document learning, built with React Native, Expo, and Google Gemini.

---

## What is NeuroTutor?

NeuroTutor is a mobile learning platform that combines three evidence-based learning systems:

| Layer | What it does |
|---|---|
| **Feynman Technique** | The AI explains concepts simply, then asks you to teach them back. Gaps in your explanation become the next lesson. |
| **Spaced Repetition (SM-2)** | Every concept you learn is scheduled for review at 1 → 3 → 7 → 21 day intervals to move it from short-term to long-term memory. |
| **RAG Document Learning** | Upload your own PDFs, lecture notes, or textbooks. The AI embeds them with Gemini `text-embedding-004` (768-dim) and retrieves relevant chunks before every response. |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              React Native + Expo App             │
│  (NativeWind · Expo Router · React Query · tRPC) │
└─────────────────┬───────────────────────────────┘
                  │  HTTP
┌─────────────────▼───────────────────────────────┐
│          Express + tRPC Backend Server           │
│                                                  │
│  /api/ai/*          ← Feynman AI endpoints       │
│  /api/deeptutor/*   ← Multi-agent DeepTutor      │
│  /api/rag/*         ← Document RAG pipeline      │
│  /api/trpc          ← tRPC (auth, learning DB)   │
└─────────────────┬───────────────────────────────┘
                  │  REST
┌─────────────────▼───────────────────────────────┐
│         Google Gemini API                        │
│  gemini-2.0-flash      ← chat / reasoning        │
│  text-embedding-004    ← document embeddings     │
└─────────────────────────────────────────────────┘
```

### Key Services (`lib/services/`)

| Service | Purpose |
|---|---|
| `ai-tutor.ts` | All AI tutoring calls → server proxy |
| `deeptutor-integration.ts` | DeepTutor multi-agent (QuestionGen, DR-in-KG, etc.) |
| `rag-pipeline.ts` | Client-side RAG with real Gemini embeddings |
| `learning-engine.ts` | SM-2 spaced repetition, mastery levels, memory states |
| `graphrag-curriculum.ts` | GraphRAG: PolyG traversal, GFMRag, NeoHybridSearch |
| `session-orchestrator.ts` | Full tutoring session pipeline |
| `tom-swe.ts` | Theory-of-Mind Student World Estimator (3-tier memory) |
| `pedagogical-action-space.ts` | 8-action Socratic pedagogical decisions |
| `bayesian-knowledge-tracing.ts` | BKT mastery probability tracking |
| `cognitive-load-manager.ts` | Cognitive load detection & adaptation |

### Server Routes (`server/`)

| Route | Description |
|---|---|
| `POST /api/ai/explain-simple` | Feynman-style concept explanation |
| `POST /api/ai/analyze-explanation` | Analyze student's teach-back |
| `POST /api/ai/generate-quiz` | Adaptive quiz generation |
| `POST /api/ai/evaluate-answer` | Quiz answer evaluation |
| `POST /api/ai/adaptive-response` | Theory-of-Mind tutor response |
| `POST /api/ai/chat-with-rag` | Response + automatic RAG context injection |
| `POST /api/deeptutor/questiongen` | Forgetting-curve adaptive questions |
| `POST /api/deeptutor/knowledge-graph` | DR-in-KG concept relationship map |
| `POST /api/deeptutor/multi-agent-solve` | Multi-agent problem decomposition |
| `POST /api/rag/upload` | Upload document → embed with Gemini |
| `POST /api/rag/search` | Semantic + keyword hybrid search |
| `GET  /api/rag/kb` | List knowledge bases |

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Google Gemini API key — get one free at [aistudio.google.com](https://aistudio.google.com)

### Install

```bash
git clone https://github.com/Vikaash-dev/neuro-tutoe
cd neuro-tutoe
pnpm install
```

### Configure

```bash
# Optional: set Gemini key server-side (or enter it in the app UI)
echo "GEMINI_API_KEY=AIzaSy..." > .env
```

### Run

```bash
# Start both the Express server and Expo Metro bundler
pnpm dev

# Server only (port 3000)
pnpm dev:server

# Expo web only (port 8081)
pnpm dev:metro
```

Open [http://localhost:8081](http://localhost:8081) in your browser.

On first launch, enter your Gemini API key in the Setup screen. The key is stored in device storage and sent to the backend as an `x-gemini-api-key` header — it is never logged or forwarded.

---

## Using the App

### 1. Set up your API key

Go to **Settings → Manage API Key** and enter your Gemini API key.

### 2. Upload documents (optional but powerful)

Go to **Settings → Document Knowledge Base** → paste any text (lecture notes, PDF content, articles).

The server will:
1. Chunk your text into ~500-char overlapping segments
2. Embed each chunk with `text-embedding-004` (768-dim vectors)
3. Store them in the RAG store (persisted to `.rag-store.json`)

Every future conversation will automatically retrieve the 3 most relevant chunks as context before generating a response.

### 3. Start learning

Pick a topic from **Explore** → the AI generates a Feynman-style explanation → ask questions → tap **Teach Back** to explain it yourself → tap **Quiz** for spaced-repetition questions.

---

## Learning Flow

```
Select Topic
     │
     ▼
AI explains (Feynman style)
     │
     ├──► You ask questions
     │         └──► AI adapts to your mental model (Theory of Mind)
     │
     ├──► Teach Back: you explain → AI finds gaps → refines
     │
     └──► Quiz: spaced-repetition questions (SM-2)
               │
               ├── ≥80% → mastery up, interval ×ease_factor
               └──  <80% → interval reset to 1 day, misconceptions corrected
```

---

## RAG Pipeline Detail

```
User uploads text
      │
      ▼
Server chunks text (~500 chars, sentence boundaries)
      │
      ▼
Each chunk → Gemini text-embedding-004 → 768-dim vector
      │
      ▼
Stored in RagStore (in-memory + .rag-store.json)
      │

At query time:
      │
      ▼
Query → Gemini embedding → cosine similarity on all chunks  (α=0.7)
                         + keyword TF score on all chunks   (α=0.3)
      │
      ▼
Top-K chunks → injected as context into Gemini prompt
      │
      ▼
Tutor response grounded in your documents 📄
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native 0.81, Expo SDK 54 |
| Navigation | Expo Router 6 |
| Styling | NativeWind 4 (Tailwind CSS) |
| State | React Query + tRPC |
| Backend | Express 4, tRPC 11 |
| AI | Google Gemini 2.0 Flash |
| Embeddings | Gemini text-embedding-004 (768-dim) |
| Database | Drizzle ORM + MySQL (optional) |
| Storage | AsyncStorage (client), JSON file (server RAG) |
| Testing | Vitest — 621 passing tests |

---

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test -- --watch
```

621 tests pass across 26 test suites covering:
- Spaced repetition (SM-2, HLR, Ebbinghaus)
- Bayesian Knowledge Tracing
- GraphRAG curriculum (PolyG, GFMRag, NeoHybridSearch)
- Cognitive load detection
- Theory-of-Mind estimation
- Feynman mode engine
- Session orchestration

---

## Project Structure

```
neuro-tutoe/
├── app/                       # Expo Router screens
│   ├── (tabs)/                # Tab navigation (Home, Topics, Progress, Settings)
│   ├── tutor-chat.tsx         # Main AI chat with Feynman technique
│   ├── teach-back.tsx         # Student teaches back → AI evaluates
│   ├── active-recall-quiz.tsx # Spaced repetition quiz
│   ├── knowledge-graph.tsx    # Visual concept graph
│   ├── document-upload.tsx    # RAG document upload & knowledge base browser
│   └── api-setup.tsx          # Gemini API key setup
├── server/
│   ├── _core/                 # Express entry, env, tRPC, auth
│   ├── services/
│   │   ├── gemini.ts          # Server-side Gemini wrapper (chat + embed)
│   │   └── rag-store.ts       # In-memory + persisted RAG document store
│   ├── ai-routes.ts           # /api/ai/* (Feynman teaching endpoints)
│   ├── deeptutor-routes.ts    # /api/deeptutor/* (multi-agent endpoints)
│   └── rag-routes.ts          # /api/rag/* (document upload + search)
├── lib/
│   ├── services/              # 30+ learning engine services
│   │   ├── ai-tutor.ts        # Client ↔ server AI bridge
│   │   ├── rag-pipeline.ts    # Client RAG with real Gemini embeddings
│   │   ├── graphrag-curriculum.ts  # GraphRAG: PolyG, GFMRag, NeoHybridSearch
│   │   ├── learning-engine.ts # SM-2, mastery, memory states
│   │   └── __tests__/         # 621 Vitest tests
│   └── types/learning.ts      # All TypeScript types
├── ARCHITECTURE.md            # Detailed system design
├── SELF_HOSTING_GUIDE.md      # Self-hosting instructions
└── README.md                  # This file
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Gemini API key (server-side fallback; users can also enter it in the app) |
| `PORT` | No | Server port (default: 3000) |
| `DATABASE_URL` | No | MySQL connection string (for persistent learning data) |
| `JWT_SECRET` | No | Cookie signing secret |

---

## API Key Security

The Gemini API key flows as follows:

```
User enters key → AsyncStorage (device only)
                        │
                        ▼ (on every AI request)
                 x-gemini-api-key header
                        │
                        ▼
                 Express backend (resolveGeminiKey)
                        │
                        ▼
                 Gemini API call
```

The key is **never** logged, stored in a database, or transmitted to any third party beyond Google's own API.

---

## References

- **DeepTutor (2025)** — HKUDS multi-agent AI tutoring, [arXiv:2501.xxxxx](https://github.com/HKUDS/DeepTutor)
- **Feynman Technique** — Richard Feynman's 4-step learning method
- **SM-2 Algorithm** — Supermemo spaced repetition
- **PolyG (arXiv:2504.02112)** — Adaptive graph traversal for GraphRAG
- **GFM-RAG (arXiv:2502.01113)** — Graph Foundation Model multi-hop reasoning
- **Bloom's 2-Sigma Problem** — Achieving human tutoring effectiveness with AI
- **Bayesian Knowledge Tracing** — Corbett & Anderson (1994)
- **text-embedding-004** — Google's 768-dim semantic embedding model

---

*Built with ❤️ using Feynman Technique, Neuroscience, and AI*
