# Fitness Coach

A fitness web app built with Next.js. It includes an exercise library, a workout generator, an exercise video explorer, and an AI coach with persistent chat sessions.

## Features

| Page | Route | Description |
| --- | --- | --- |
| Home | `/` | Landing page |
| Exercise Library | `/pages/exercise` | Searchable/filterable exercise browser (category, equipment, muscle) with infinite scroll |
| Workout Generator | `/pages/exercise` (generator, see `page_old.tsx`) | Builds timed workouts from local exercise pools by duration, type, target area, and intensity |
| Videos | `/pages/videos` | Exercise video explorer |
| AI Coach | `/pages/ai-coach` | Chat with a fitness-focused LLM assistant; sessions are stored server-side per device |
| Nutrition / Progress / Disclaimer | `/pages/nutrition`, `/pages/progress`, `/pages/disclaimer` | Static/info pages |

## Tech Stack

| Tool | Version | Purpose |
| --- | --- | --- |
| [Next.js](https://nextjs.org) | 16.3.0 | App Router framework, Turbopack builds, Cache Components (`cacheComponents: true`), API routes |
| [React](https://react.dev) | 19.2.8 | UI (React Compiler enabled via `babel-plugin-react-compiler`) |
| [TypeScript](https://www.typescriptlang.org) | 5.x | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | 4.x | Styling (`@tailwindcss/postcss`) |
| [ESLint](https://eslint.org) | 9 + `eslint-config-next` | Linting |
| [node-postgres (`pg`)](https://node-postgres.com) | 8.x | PostgreSQL connection pool for chat persistence |

Requires Node.js >= 20.9.0.

## External Data Sources

### wger REST API v2 — https://wger.de/api/v2/

The primary exercise data source (free/open API). Endpoints used:

- `GET /exerciseinfo/?language=2` — exercises with category, muscles, equipment, images, translations (exercise library page)
- `GET /exercisecategory/` — category filter chips
- `GET /equipment/` — equipment filter chips
- `GET /muscle/` — muscle filter chips and muscle metadata (`image_url_main`, `image_url_secondary`, `is_front`)
- Video endpoints (videos page, see `src/lib/server/videos.ts`) with results cached via Next.js `cacheLife`/`cacheTag`

Exercise photos are loaded directly from `wger.de/media/exercise-images/...`.

### AI Providers

Pluggable provider layer in `src/lib/server/ai/providers/` (plain REST calls, no SDK):

- **Google Gemini** — `generativelanguage.googleapis.com` (`GOOGLE_GEMINI_KEY`, model via `GEMINI_MODEL`)
- **xAI Grok** — `GROK_API_KEY`
- **DeepSeek** — `DEEPSEEK_API_KEY`

The active provider is chosen via the `AI_PROVIDER` env var or auto-detected from whichever key is configured.

### Database

PostgreSQL stores AI coach chat sessions/messages (`chat_sessions`, `chat_messages`). The schema is created automatically on first use (`src/lib/server/db.ts`).

## Local Assets

- `public/exercise/` — mirrored wger exercise photos (UUID-named files matching wger image UUIDs)
- `public/exercise/images.json` — mapping of `{ image_id, file, exercise_id, name, type }` used as an offline fallback so images still render when the wger API is unavailable
- `public/exercise/placeholders/` — generated SVG placeholders per category (abs, arms, back, calves, cardio, chest, legs, shoulders + generic)
- `public/exercise/muscles/` — wger anatomy SVGs: front/back body silhouettes plus `main-{id}.svg` / `secondary-{id}.svg` overlays for each of the 15 muscle IDs, composed at runtime by `src/components/MuscleDiagram.tsx`
- `public/videos/` — mirrored exercise videos
- `src/data/exercisesList.json` — warmup/workout/cooldown exercise pools for the workout generator

## Exercise Image Fallback Chain

Every exercise resolves a visual in this order (see `src/app/pages/exercise/page.tsx`):

1. Photo from the wger API response
2. Local mirror lookup via `images.json`
3. Muscle highlight diagram (composed from the exercise's primary/secondary muscles using `MuscleDiagram`)
4. Category placeholder SVG

## Getting Started

```bash
npm install
npm run dev     # development server on http://localhost:3000
```

### Environment Variables (`.env.local`)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes (AI coach only) | PostgreSQL connection string |
| `DATABASE_SSL` | No | Set to `"true"` to enable SSL with relaxed verification |
| `AI_PROVIDER` | No | `gemini` (default), `grok`, or `deepseek` |
| `GOOGLE_GEMINI_KEY` | For Gemini | Google AI Studio API key |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.5-flash` |
| `GROK_API_KEY` | For Grok | xAI API key |
| `DEEPSEEK_API_KEY` | For DeepSeek | DeepSeek API key |

### Scripts

```bash
npm run dev     # start dev server
npm run build   # production build (Turbopack)
npm run start   # serve production build
npm run lint    # eslint
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── videos/                 # cached video feed endpoint
│   │   └── chat/                   # providers list + session/message CRUD
│   └── pages/                      # app pages (exercise, videos, ai-coach, ...)
├── components/                     # UI components incl. MuscleDiagram, ai-coach/, videos/
├── data/                           # workout generator exercise pools
└── lib/
    ├── workout.ts                  # workout generation logic
    └── server/                     # db pool, chat store, video fetching, AI providers
```

## Credits

- Exercise data, images, videos, and anatomy SVGs: [wger](https://wger.de) (open-source fitness platform, AGPL license)
- Body silhouettes and muscle overlay SVGs from the [wger GitHub repository](https://github.com/wger-project/wger)
