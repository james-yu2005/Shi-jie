# 世界 (Shìjiè) — Chinese Reading & Study App

An interactive Chinese-learning app. Paste any Chinese text, click words to
see definitions, pinyin, example sentences, stroke order, and pronunciation.
Save unknown words into a bucket of flashcards, review them with spaced
repetition or weave them into an AI sentence, and play the daily game
graded by a LangGraph agent.

## Features

- **Smart Reader (`/`)** – paste Chinese text, highlight any character or word to
  open a side panel with:
  - English definition
  - Pinyin (with tones)
  - Common example sentences + translations
  - Stroke-order animation (via [makemeahanzi])
  - Pronunciation (browser TTS + Google translate audio fallback)
  - "Ask AI" button – sends the word/sentence to an LLM for a deeper
    explanation
  - "Add to bucket" – saves the word for later study
- **Flashcards (`/flashcards`)** – bucket CRUD plus review and AI sentence:
  1. **Review**: spaced-repetition flashcards for words in your bucket.
  2. **AI sentence**: an LLM weaves all bucket words into a short Chinese
     sentence that opens in the Smart Reader so you can study it.
- **Daily Game (`/daily`)** – an image is shown; describe it in Chinese.
  A LangGraph agent (built on LangChain + OpenAI Vision) checks if you
  captured the key parts and flags grammar mistakes. You get **3 attempts**;
  on the 2nd the agent hints at what you missed; on the 3rd it reveals the
  full target description.
- **Knowledge Graph (`/graph`)** – per-user vocabulary graph. Every word you
  add becomes a node; edges are auto-derived:
  - **Character** edges (red) connect words that share a radical, e.g. 拉↔推
    via 扌.
  - **Meaning** edges (blue dashed) connect words that share a semantic tag,
    e.g. 说↔聊 via "communication".
  An LLM analyses each new word for radicals, components, and tags; edge
  computation itself is deterministic. The page has three modes:
  1. **Explore** – interactive force-directed canvas, filter by edge type,
    search, click a node to see its components, radicals, tags, neighbours,
    and AI-generated suggestions for related words to add.
  2. **Connection quiz** – the app picks a random connected pair and asks
    you to explain the link; reveal the stored reason or have the AI
    elaborate.
  3. **AI sentence** – select any subset of nodes and have the model weave
    them into a Chinese paragraph (sends straight to the Smart Reader).
- **Google sign-in** via NextAuth; everything (bucket, daily progress, knowledge graph)
  is persisted per user in **Supabase (PostgreSQL)** via Prisma.
- **Learning preferences** (header toggles) – choose **Simplified / Traditional**
  script and **Mandarin / Cantonese** audio. Signed-in users' choices sync to
  the database; guests use localStorage. AI-generated content (daily game, AI
  paragraphs, graph suggestions) respects your script and locale settings.

## Stack

| Layer    | Tech                                                    |
|----------|---------------------------------------------------------|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS     |
| Auth/DB  | NextAuth (Google) · Prisma · Supabase (PostgreSQL)      |
| Backend  | FastAPI · LangChain · LangGraph · OpenAI                |
| Dict     | CC-CEDICT + CC-CANTO Jyutping readings (downloaded on first run) |
| Strokes  | [makemeahanzi] SVG animations (served via jsDelivr CDN) |

[makemeahanzi]: https://github.com/skishore/makemeahanzi

## Quick start

```bash
# 1. Copy env template and fill in credentials
cp .env.example frontend/.env.local
cp .env.example backend/.env

# 2. Fill in frontend/.env.local:
#    - NEXTAUTH_SECRET  (run: openssl rand -base64 32)
#    - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#    - DATABASE_URL     (Supabase pooled connection string)
#    - DIRECT_URL       (Supabase direct connection string)
#    Both URLs are in Supabase dashboard → Project Settings → Database

# 3. Backend (Python 3.10+)
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
python -m app.data.download_cedict   # one-time CC-CEDICT download
python -m app.data.download_canto    # one-time Cantonese/Jyutping readings
uvicorn app.main:app --reload --port 8000

# 4. Frontend (in a new terminal)
cd frontend
npm install
npx prisma migrate dev --name add_learning_preferences
npm run dev
```

Open <http://localhost:3000>, sign in with Google, and start reading.

## Project layout

```
shi-jie-new/
├── frontend/         Next.js app (UI, API routes, auth, Prisma)
│   ├── src/app/      App-router pages and API routes
│   ├── src/lib/      Shared client helpers
│   └── prisma/       Schema + migrations
├── backend/          FastAPI + LangGraph service
│   └── app/
│       ├── main.py            FastAPI entry
│       ├── dictionary.py      CC-CEDICT lookup
│       ├── agents/            word_explainer, paragraph_generator,
│       │                      image_describer, kg_analyzer
│       └── data/              CC-CEDICT raw data
└── README.md
```

## Notes

- Stroke-order GIFs aren't generated server-side; the UI renders an inline
  SVG animation directly from the makemeahanzi CDN for any character in the
  3000-glyph set. A static fallback PNG link is shown for rare characters.
- The LangGraph daily-image agent uses `gpt-4o-mini`'s vision capability to
  derive the target description on first request, then re-uses it for all
  three attempts. Override the model with `OPENAI_VISION_MODEL`.
- The Knowledge Graph's radical + decomposition data comes from a local
  copy of [makemeahanzi]'s `dictionary.txt`. Download it once with
  `python -m app.data.download_hanzi_dict` from `backend/` (the same way
  you ran the CC-CEDICT download). Without it the analyzer still works
  for pinyin/definition/tags but won't be able to derive radicals.
- After pulling the Knowledge Graph changes, run
  `npx prisma migrate dev --name add_knowledge_graph` from `frontend/` to add
  the `KgNode` and `KgEdge` tables before opening `/graph`. If you had
  nodes from the old LLM-only analyzer, click **↻ Rebuild edges** on the
  graph page after upgrading to re-normalise them.
- The database is **Supabase (PostgreSQL)**. Use the **Session-mode pooler** URL
  (port 5432) as `DATABASE_URL` at runtime and the **direct** connection URL as
  `DIRECT_URL` for `prisma migrate`. Both are in Supabase → Project Settings → Database.
- **Traditional / Cantonese mode:** use the **Script** and **Audio** toggles in the
  header. Cantonese audio uses Google Translate TTS (`zh-HK`) with browser
  `speechSynthesis` fallback; quality varies by network and browser.
- **Jyutping** comes from [CC-CANTO](https://cccanto.org/) Cantonese readings merged
  into dictionary lookups. When no Cantonese reading exists for a word, the UI falls
  back to Mandarin pinyin.
