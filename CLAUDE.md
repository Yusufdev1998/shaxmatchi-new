# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shaxmatchi is a chess education platform — a pnpm monorepo with a NestJS backend, two React+Vite frontends (admin and student), and a shared UI library.

## Commands

### Root (all apps)
```bash
pnpm install        # install all dependencies
pnpm dev            # start backend + both frontends in parallel
pnpm build          # build all apps
```

### Backend (`apps/backend`)
```bash
pnpm dev            # nest start --watch (port 3000)
pnpm build          # nest build → dist/
pnpm start          # node dist/main.js
pnpm db:generate    # drizzle-kit generate (schema migrations)
pnpm db:migrate     # drizzle-kit migrate
pnpm db:studio      # drizzle-kit studio (DB GUI)
```

### Admin (`apps/admin`) / Student (`apps/student`)
```bash
pnpm dev            # vite dev server (admin: 5173, student: 5174)
pnpm build          # tsc + vite build → dist/
```

**No lint or test commands are configured.** `pnpm lint` is a no-op across all packages.

## Architecture

### Monorepo Layout
- `apps/backend` — NestJS API (PostgreSQL + Drizzle ORM, JWT auth, Telegram bot via grammy)
- `apps/admin` — Teacher dashboard (React 19, Vite, TanStack Query, Tailwind, Tiptap editor)
- `apps/student` — Student learning app (React 19, Vite, TanStack Query, Tailwind, Telegram Web App integration)
- `packages/ui` — Shared component library (`@shaxmatchi/ui`), source-exported with no build step

### Backend Modules
NestJS modules in `apps/backend/src/`:
- `auth/` — JWT auth with Passport, role guards (TeacherOnlyGuard, StudentOnlyGuard), Telegram login
- `users/` — Student/teacher CRUD
- `debuts/` — Chess content hierarchy: debut levels → courses → modules → tasks → puzzles
- `student/` — Puzzle assignments, learning progress tracking, practice attempts
- `admin-stats/` — Analytics (learning time, practice stats)
- `uploads/` — Audio file upload/serve via multer
- `telegram/` — Telegram bot service (grammy)
- `db/` — Drizzle ORM setup, schema definitions, provider token

### Database (Drizzle ORM)
Schema in `apps/backend/src/db/schema.ts`. Config in `apps/backend/drizzle.config.ts`. Key tables: users, debutLevels, courses, modules, tasks, puzzles (JSONB moves), puzzleAssignments.

### Frontend Patterns
- Both frontends use React Router v6, TanStack React Query for server state, localStorage for auth tokens
- API modules in `src/api/` wrap fetch calls with Bearer token auth
- Auth helpers in `src/auth/auth.ts` (API_URL from `VITE_API_URL` env var)
- Both apps are PWAs (vite-plugin-pwa with workbox)
- HTTPS in dev via vite-plugin-mkcert

### Shared UI (`packages/ui`)
Source-exported (no build step) — dependents compile it directly. Provides Button (Radix UI + CVA), Breadcrumb, BaseChessboard (chess.js + react-chessboard wrapper), TruncatedText, tooltip provider.

## Environment Variables

Backend `.env` (in `apps/backend/`): `DATABASE_URL`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `AUDIO_DIR`

Frontend: `VITE_API_URL` (defaults to `http://localhost:3000`)
