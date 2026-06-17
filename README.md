# 世界 (Shìjiè)

An interactive Chinese reading and study app. Paste any text, read with aligned English and per-word glosses, click words for full dictionary entries, save vocabulary to flashcards, explore how words connect in a personal knowledge graph, and practice with a daily image-describing game graded by AI.

## Features

### Smart Reader (`/`)

Paste Chinese text and press **Read** to segment it, translate it, and render an interactive reading view:

- **Aligned translation** — sentence-by-sentence English with hover links between Chinese tokens and their English spans
- **Per-token glosses** — short English labels above each word; grammar particles get learner-friendly labels
- **Optional pinyin** — toggle romanization above tokens (Mandarin pinyin or Cantonese Jyutping)
- **Word panel** — click any character or word for definitions, examples, stroke-order animation, pronunciation, and an **Ask AI** deep-dive
- **Save words** — add selections to your flashcard bucket or knowledge graph

If translation is unavailable, the reader falls back to dictionary segmentation only.

### Flashcards (`/flashcards`)

- **Manage** — view, edit, and delete saved words
- **Review** — SM-2 spaced repetition (Again / Good / Easy)
- **AI sentence** — weave bucket words into a short Chinese paragraph that opens in the Reader
- **HSK starter deck** — one-click import of 50 essential HSK 1–2 words

### Daily Game (`/daily`)

Describe a daily image in Chinese. A LangGraph agent (OpenAI vision) grades your answer, flags grammar issues, and gives progressive hints across three attempts. Choose **easy**, **medium**, or **hard** difficulty. A heatmap tracks your streak history.

### Knowledge Graph (`/graph`)

Every word you add becomes a node. Edges are derived automatically:

- **Character** (red) — words that share a radical or component, e.g. 拉 ↔ 推 via 扌
- **Meaning** (blue, dashed) — words that share a semantic tag, e.g. 说 ↔ 聊 via "communication"

Three modes: **Explore** (force-directed canvas), **Connection quiz** (explain a random link), and **AI sentence** (paragraph from selected nodes → Reader).

### Learning preferences

Header toggles for **Simplified / Traditional** script and **Mandarin / Cantonese** audio. Signed-in users sync preferences to the database; guests use `localStorage`. AI-generated content respects your script and locale settings.

### Auth & persistence

Google sign-in via NextAuth. Flashcards, daily progress, knowledge graph, and preferences are stored per user in **Supabase (PostgreSQL)** via Prisma.

## Architecture

```
Browser  →  Next.js (UI + API routes + auth)  →  FastAPI backend
                    ↓
              Supabase / Prisma
```

The browser never calls the Python backend directly. Next.js API routes proxy dictionary and AI requests server-side. In production, set `BACKEND_SHARED_SECRET` on both services so only your frontend can reach the backend.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · opencc-js |
| Auth/DB  | NextAuth (Google) · Prisma · Supabase (PostgreSQL) |
| Backend  | FastAPI · LangChain · LangGraph · OpenAI |
| Dictionary | [CC-CEDICT](https://cc-cedict.org/) + [CC-CANTO](https://cccanto.org/) Jyutping readings |
| Strokes  | [makemeahanzi](https://github.com/skishore/makemeahanzi) animated SVGs (jsDelivr CDN) |

## Quick start

### 1. Environment

Copy the shared template into both apps and fill in credentials:

```bash
cp .env.example frontend/.env.local
cp .env.example backend/.env
```

**Frontend** (`frontend/.env.local`):

| Variable | Notes |
|----------|-------|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com) → OAuth client (Web). Redirect: `http://localhost:3000/api/auth/callback/google` |
| `DATABASE_URL` | Supabase **Session pooler** URL (port 5432) |
| `DIRECT_URL` | Supabase **direct** connection URL (for migrations) |
| `BACKEND_URL` | `http://localhost:8000` |

Both database URLs are in Supabase → Project Settings → Database.

**Backend** (`backend/.env`):

| Variable | Notes |
|----------|-------|
| `OPENAI_API_KEY` | Required for translation, AI explain, daily game, knowledge graph |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |
| `OPENAI_VISION_MODEL` | Default `gpt-4o-mini` (daily image game) |

### 2. Backend (Python 3.10+)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt

# One-time dictionary downloads
python -m app.data.download_cedict
python -m app.data.download_canto      # Cantonese / Jyutping readings
python -m app.data.download_hanzi_dict # Radical data for knowledge graph

uvicorn app.main:app --reload --port 8000
```

Verify: `GET http://localhost:8000/health`

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and start reading.

## Project layout

```
shi-jie-new/
├── frontend/                 Next.js app (UI, API routes, auth, Prisma)
│   ├── src/app/              App Router pages and API routes
│   ├── src/components/       Reader, flashcards, graph, daily game UI
│   ├── src/lib/              Client helpers (dictionary, preferences, HSK)
│   └── prisma/               Schema and migrations
├── backend/                  FastAPI + LangGraph service
│   └── app/
│       ├── main.py           API entry point
│       ├── dictionary.py     CC-CEDICT lookup and segmentation
│       ├── agents/           text_translator, word_explainer, paragraph_generator,
│       │                       image_describer, kg_analyzer
│       └── data/             Dictionary downloads and raw data
└── README.md
```

## API overview (backend)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Service status and data-file checks |
| `POST` | `/dictionary/segment` | Tokenize text with dictionary entries |
| `GET` | `/dictionary/lookup` | Word lookup, strokes, audio URL |
| `POST` | `/ai/translate` | Segmented translation with per-token English alignment |
| `POST` | `/ai/explain` | Markdown word explanation |
| `POST` | `/ai/paragraph` | Chinese paragraph from a word list |
| `POST` | `/daily/grade` | Daily image game grading (LangGraph) |
| `POST` | `/kg/analyze` | Radicals, components, semantic tags |
| `POST` | `/kg/connection` | Explain a link between two nodes |
| `POST` | `/kg/suggest` | Related word suggestions |

## Deployment notes

- **Backend** — `railway.json` and `Procfile` are included. The Railway build step downloads CC-CEDICT and the hanzi dictionary automatically. Set `CORS_ORIGINS` to your frontend URL and configure `BACKEND_SHARED_SECRET` on both services.
- **Frontend** — deploy to Vercel (or similar). Set `BACKEND_URL` to your hosted backend. Run `npx prisma migrate deploy` against production before going live.
- **Database** — use the pooled URL as `DATABASE_URL` at runtime and the direct URL as `DIRECT_URL` for Prisma migrations.

## Misc

- **Stroke order** — animated SVGs from makemeahanzi, rendered inline in the word panel. Rare characters outside the ~3000-glyph set show a static fallback.
- **Traditional / Cantonese** — script conversion uses opencc-js on the client; Cantonese audio uses Google Translate TTS (`zh-HK`) with browser `speechSynthesis` fallback. Jyutping comes from CC-CANTO and falls back to Mandarin pinyin when unavailable.
- **Knowledge graph radicals** — requires `python -m app.data.download_hanzi_dict`. Without it, analysis still works for pinyin, definitions, and tags but cannot derive radical-based edges.
- **Daily game** — the vision model derives the target description on the first attempt and reuses it for subsequent tries in the same session.
