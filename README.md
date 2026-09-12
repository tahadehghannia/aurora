# Aurora

**Your taste, understood.**

Aurora is a personal entertainment discovery platform that unifies movies, TV shows and music into a
single taste graph, and explains every recommendation in plain language instead of hiding behind
"AI-powered" hand-waving.

This repository is a complete, runnable full-stack implementation — not a mockup. Authentication, the
database, search, the recommendation engine, ratings, library, onboarding and every content page are
wired to a real PostgreSQL database.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Recommendation engine](#recommendation-engine)
- [API overview](#api-overview)
- [Password reset](#password-reset)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Development commands](#development-commands)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)

---

## Features

- Email/password authentication (Auth.js v5) with session-based route protection
- Multi-step onboarding that seeds a real taste profile (genres, moods, favorites, diversity)
- Personalized home feed: hero pick, "Recommended for you," genre rails, trending, top rated, new releases
- Content-based + popularity hybrid recommendation engine with human-readable explanations
- Full-text-ish search across movies, TV shows, episodes, artists, albums and songs, with search history
- Discover page with genre/kind/sort filters
- Movie / TV show / episode / artist / album / song detail pages with save, rate, mark watched/listened, share
- Library: saved items, ratings, collections (create + browse)
- Profile with a generated taste-trait summary, favorite genres and moods
- Light + dark themes (dark is the default), fully responsive (mobile bottom nav, desktop sidebar)
- Loading, empty and error states throughout; custom 404 and global error boundary

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI primitives) |
| Database | PostgreSQL |
| ORM | Prisma 7 (driver adapter: `@prisma/adapter-pg`) |
| Auth | Auth.js (NextAuth) v5, Credentials provider + optional Google OAuth |
| Validation | Zod |
| Forms | React Hook Form |
| Server state | TanStack Query |
| Global client state | Zustand (available; not yet needed beyond React state) |
| Icons | lucide-react |
| Unit tests | Vitest |
| E2E tests | Playwright |

## Architecture

```
prisma/
  schema.prisma        Data model (see below)
  seed.ts               Seeds the DB from src/lib/mock/seed-data.ts
  migrations/
src/
  app/
    page.tsx             Marketing landing page ("/")
    (auth)/               login, signup, forgot-password — shared centered layout
    (app)/                 Authenticated app shell (sidebar + bottom nav)
      home/ discover/ search/ library/ profile/ recommendations/ onboarding-adjacent
      movie/[slug] show/[slug] episode/[slug] artist/[slug] album/[slug] song/[slug]
    onboarding/           Full-screen onboarding wizard (outside the app shell)
    api/                  Route handlers (see API overview)
  components/
    ui/                   shadcn/ui primitives
    content/               ContentCard, ContentRow/Grid, StarRating, SectionHeader
    navigation/            Sidebar, BottomNav, AppShell, UserMenu, ThemeToggle
    detail/ discover/ search/ library/ onboarding/ profile/ auth/  Feature components
    states/                EmptyState, ErrorState
  lib/
    auth/                  Auth.js config + session helpers
    db/                    Prisma client singleton (driver-adapter based)
    content/                Query layer (Prisma → typed ContentCard DTOs), mappers, rating aggregation
    recommendations/        The recommendation engine (see below)
    validation/             Zod schemas
    api/                    Consistent API response helpers
    mock/                   Original seed data (fictional catalog — see below)
  hooks/                   TanStack Query hooks (useSavedItems, useRateContent, useMarkActivity, ...)
  types/                   Shared content types
e2e/                       Playwright critical-flow test
```

### Content providers

`src/lib/content/providers/` is a small adapter layer — every provider (real or fictional) implements
the same interface and produces the same shapes `prisma/seed-lib.ts` knows how to upsert, so the rest of
the app never talks to a provider directly; it only ever queries Postgres.

| Category | Live by default | Key-gated alternative |
| --- | --- | --- |
| TV shows | **TVmaze** (`tvmaze.ts`) — real metadata, episodes, cast; no API key required | **TMDB** would also cover TV; not wired as the default since TVmaze already needs no key |
| Movies | Aurora's fictional catalog (`mock.ts`) — no keyless real movie API exists | **TMDB** (`tmdb.ts`) — activates automatically once `TMDB_API_KEY` is set |
| Music | **iTunes Search API** (`itunes.ts`) — real artists/albums/songs/artwork; no API key required | **Spotify** (`spotify.ts`, client-credentials flow) — activates once `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` are set |

`lib/content/providers/index.ts` picks the best available provider per category at call time
(`getMovieProvider()`, `getTvProvider()`, `getMusicProvider()`) — no other code needs to change when you
add a key.

Providers are used to populate the database, not queried live on every request:

```bash
npm run db:seed        # the original fictional catalog (always available, zero config)
npm run db:seed:live     # fetches real TV (TVmaze) + real music (iTunes/Spotify) + real movies (TMDB, if TMDB_API_KEY is set)
```

`db:seed:live` is additive/idempotent (upserts by slug) — safe to re-run, and safe to run without a TMDB
key (it just leaves the fictional movies in place and logs why). This repo's database currently has both:
the original fictional movies alongside real TV shows and real music pulled in live.

Any secret (`TMDB_API_KEY`, `SPOTIFY_CLIENT_SECRET`) is read from `process.env` inside provider files that
only ever run in Prisma seed scripts (Node, never bundled into client code) — never exposed to the browser.

Artwork for the fictional catalog uses [Lorem Picsum](https://picsum.photos) placeholder photography,
seeded per-slug so the same title always gets the same image. Real content uses each provider's real
artwork URLs.

## Database schema

Postgres via Prisma. Key models:

- **Auth**: `User`, `Account`, `Session`, `VerificationToken` (Auth.js adapter tables)
- **Profile & taste**: `Profile`, `UserPreference`, `UserGenre`, `UserArtist`
- **Catalog**: `Genre`, `Movie`, `TVShow`, `Episode`, `Artist`, `Album`, `Song`
- **Activity**: `Rating`, `SavedItem`, `WatchHistory`, `ListeningHistory`, `UserContentInteraction`
- **Organization**: `Collection`, `CollectionItem`, `Playlist`, `PlaylistItem`
- **Recommendation system**: `Recommendation` (cached scored picks), `SearchHistory`

Ratings, saves and watch/listen history are all **polymorphic** across content types via a
`ContentType` enum (`MOVIE | TV_SHOW | EPISODE | ARTIST | ALBUM | SONG`) plus a `contentId`, with an
optional direct FK per type for referential integrity and cascade deletes.

Run `npx prisma studio` for a visual browser of the seeded data.

## Recommendation engine

`src/lib/recommendations/` is a small, modular pipeline. Each scorer is independent and degrades
gracefully to zero when it has nothing to say, so the blend never gets *worse* than its strongest
available signal — that's what makes cold start and a sparse collaborative dataset both safe by
construction rather than special-cased.

1. **`signals.ts`** — aggregates a user's ratings, saved items, watch history, listening history,
   onboarding genre picks and mood preferences into weighted genre/mood/**artist** affinity maps, plus a
   list of "liked titles" for explanations. Explicit ratings count most, saves next, watch/listen history
   (implicit signal) least. Every content kind feeds in — movie, show, album, song, and artist ratings/saves
   all contribute, not just movies and shows.
2. **`contentBased.ts`** — scores a candidate by summing genre + mood + **artist** affinity weights for
   that item.
3. **`collaborative.ts`** — a real item-item collaborative-filtering foundation: builds a co-rating index
   across *every* user's ratings, then scores a candidate by how similarly it's been rated (by other
   users) to things this user already rated. An item needs ≥3 raters before its pattern is trusted
   (`minRatersForSignal`); below that it contributes exactly 0, which is what actually happens right now
   with a small seed database — the architecture is real and tested (`collaborative.test.ts`), it just has
   little cross-user data to work with yet. Add more users rating overlapping content and it starts
   contributing with no code changes elsewhere.
4. **`popularity.ts`** — a popularity + recency prior, used as a fallback for new users and as a
   tie-breaker otherwise.
5. **`hybrid.ts`** — blends all three: content-based + collaborative + popularity once a user has rated
   something (55/20/25 split), content-based + popularity with no ratings yet but some other signal
   (75/25), pure popularity for brand-new users (cold start).
6. **`explanation.ts`** — generates the human-readable reason, in priority order: a specific artist match
   ("Because you like Radiohead" — only when the candidate is *actually* by an artist you have affinity
   for, never just because it shares a genre with one), a specific liked title ("Because you liked X and
   Y"), genre affinity ("You're into sci-fi..."), mood affinity ("Matches the atmospheric mood..."), or a
   popularity fallback. The same signal used to rank is used to explain — nothing is decorative.
7. **`index.ts`** — `getRecommendationsForUser()` ties it together and best-effort caches results into
   the `Recommendation` table; `getSimilarTo()` powers "More like this" / "More from this artist" rails
   on detail pages (genre + mood overlap, with same-artist albums surfaced first).

The `RecommendationSource` enum (`CONTENT_BASED | COLLABORATIVE | POPULARITY | HYBRID | EDITORIAL`) and
the modular file layout mean an embeddings-based scorer could be added the same way collaborative
filtering was — as another term in `hybrid.ts` — without touching the rest of the app.

## API overview

All routes return `{ data }` on success or `{ error: { message, code } }` on failure. Routes are grouped
under `src/app/api/`:

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/register` | POST | Create an account |
| `/api/auth/[...nextauth]` | * | Auth.js handlers (sign in/out, session, OAuth callback) |
| `/api/auth/forgot-password` | POST | Issues a reset token (logged server-side; see [Password reset](#password-reset)) |
| `/api/auth/reset-password` | POST | Consumes a reset token and sets a new password |
| `/api/search` | GET | Cross-catalog search, logs search history |
| `/api/search/history` | GET | Recent searches for the signed-in user |
| `/api/recommendations` | GET | Personalized recommendations |
| `/api/library` | GET/POST/DELETE | Saved items |
| `/api/ratings` | GET/POST/DELETE | Ratings (also recomputes the item's community rating) |
| `/api/activity` | POST | Logs a watch/listen event |
| `/api/onboarding` | POST | Persists onboarding selections, seeds ratings/genre affinities, generates taste traits |
| `/api/profile` | GET/PATCH | Profile + preferences |
| `/api/collections` | GET/POST | Collections |
| `/api/collections/[id]/items` | GET/POST/DELETE | Add/remove an item in one collection |
| `/api/playlists` | GET/POST | Playlists |
| `/api/playlists/[id]` | GET/PATCH/DELETE | Playlist detail, rename/edit, delete |
| `/api/playlists/[id]/items` | POST/DELETE | Add/remove a song in one playlist |

## Password reset

The full flow is real and secure end to end — only the email *delivery* step is stubbed, since no email
provider is configured in this environment.

1. `POST /api/auth/forgot-password` — looks up the account, and **regardless of whether it exists**
   (never leak which emails are registered), returns the same generic response. If it does exist, it
   generates a cryptographically random 32-byte token (`crypto.randomBytes`, not `Math.random`), stores
   it in the `VerificationToken` table (Auth.js's existing table — no schema changes needed) with a
   30-minute expiry, and logs the reset link server-side.
2. `GET /reset-password?token=...` — a server component looks up the token, checks it hasn't expired, and
   shows either the new-password form or an "invalid/expired" state with a link to request a new one.
3. `POST /api/auth/reset-password` — re-validates the token server-side (never trusts the page's check),
   hashes the new password with bcrypt, updates the user, and **deletes every outstanding token for that
   email** in the same transaction — the token is single-use, and old unused reset links stop working the
   moment a new password is set.

### To make it actually send email

Pick a provider (e.g. [Resend](https://resend.com)), add its SDK, and replace the `console.log` in
`src/app/api/auth/forgot-password/route.ts` with a real send — the token generation, storage, expiry, and
consumption logic above needs no changes. You'd typically add:

```bash
RESEND_API_KEY="..."
EMAIL_FROM="Aurora <noreply@yourdomain.com>"
```

## Getting started

### Prerequisites

- Node.js 20+
- Docker (for local Postgres) — or point `DATABASE_URL` at any Postgres instance you already have

### 1. Install dependencies

```bash
npm install
```

### 2. Start Postgres

```bash
docker compose up -d
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Generate a real `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. Run migrations and seed the database

```bash
npm run db:migrate
npm run db:seed
```

### 5. Start the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000), sign up, and go through onboarding.

## Environment variables

See [`.env.example`](.env.example) for the full list. Required for local dev:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Auth.js session encryption secret |
| `AUTH_URL` | Base URL for Auth.js callbacks (`http://localhost:3000` locally) |

Optional:

| Variable | Purpose |
| --- | --- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Enables Google sign-in when both are set |
| `TMDB_API_KEY` / `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Reserved for a real content provider adapter — unused by the current mock-seeded catalog |

## Development commands

```bash
npm run dev          # Start the dev server (Turbopack)
npm run build         # Production build
npm run start          # Run the production build
npm run lint            # ESLint
npm run db:migrate       # Create/apply a Prisma migration
npm run db:seed           # Re-seed the fictional catalog
npm run db:studio          # Prisma Studio (visual DB browser)
```

## Testing

```bash
npm run test         # Vitest — 40 unit tests: recommendation engine + validation schemas
npm run test:e2e       # Playwright — 10 tests across 5 files, listed below
```

| File | Covers |
| --- | --- |
| `e2e/critical-flow.spec.ts` | The full new-user journey: sign up → onboarding → home → recommendation → content detail → save → rate → library |
| `e2e/auth.spec.ts` | Wrong-password rejection, correct login, unauthenticated redirect, sign out |
| `e2e/search.spec.ts` | Empty state, real cross-catalog results, no-results state, recent searches |
| `e2e/collections.spec.ts` | Create from the picker, add/remove an item, uncheck-to-remove |
| `e2e/playlists.spec.ts` | Create from a song page, edit the title, remove a track, delete the playlist |

The Playwright config starts `npm run dev` automatically if a server isn't already running on port 3000
(`reuseExistingServer: true`), and needs a seeded database to have content to interact with.
`e2e/helpers.ts` has two shared utilities: `signUpAndSkipOnboarding` for specs that don't care about the
wizard itself, and `hideDevOverlay` — Next's dev-mode-only "Dev Tools" button shares a corner with the
sidebar's account menu and intercepts clicks there under `next dev` (never in production).

These tests aren't just scaffolding — writing them caught two real bugs during development: an
unauthenticated request to a protected page throwing instead of redirecting cleanly, and the account
dropdown menu (Profile/Settings/Sign out) crashing the whole page via an unrelated Base UI error every
single time it was opened. Both are fixed; the tests now guard against regressions.

## Deployment

The app is a standard Next.js app and deploys anywhere Next.js does (Vercel, a Node server, Docker).

1. Provision a Postgres database and set `DATABASE_URL`.
2. Set `AUTH_SECRET` and `AUTH_URL` (your production origin) in the deployment environment.
3. Run `npx prisma migrate deploy` against the production database as part of your deploy step.
4. `npm run build && npm run start`, or your platform's equivalent.

## Known limitations

- **Movies have no keyless real-data source.** TV (TVmaze) and music (iTunes) are live and real with no
  configuration; movies use Aurora's fictional catalog until `TMDB_API_KEY` is set, at which point
  `npm run db:seed:live` pulls real movies too. See [Content providers](#content-providers).
- **Password reset doesn't send email.** The token/expiry/consumption flow is fully real and secure;
  only delivery is stubbed (logged server-side) since no email provider is configured. See
  [Password reset](#password-reset).
- **Collaborative filtering has little data to work with yet.** The item-item co-rating engine
  (`collaborative.ts`) is real and unit-tested, but needs ≥3 users to have rated overlapping content
  before it contributes signal — with this seed database's handful of users it mostly scores 0 and the
  hybrid ranker falls back to content-based + popularity. See [Recommendation engine](#recommendation-engine).
- **No rate limiting** on auth or write endpoints yet.

## Future improvements

- Real content provider adapters (TMDB for movies/TV, Spotify for music) behind the existing
  `lib/content/queries.ts` interface
- Collaborative filtering / embeddings-based scoring as an additional signal in the hybrid ranker
- Transactional email (password reset, welcome) via a provider like Resend
- "Add to collection" picker on content detail pages; full playlist UI for music
- Rate limiting on auth and mutation endpoints
- Public profile pages (the `Profile.isPublic` field already exists) and a social layer (following, shared collections)
