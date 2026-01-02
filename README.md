## Hello World monorepo (backend + admin + student + shared UI)

This repo contains:

- **Backend**: NestJS (`apps/backend`)
- **Admin**: React (Vite) (`apps/admin`)
- **Student**: React (Vite) (`apps/student`)
- **Shared UI/components**: `@shaxmatchi/ui` (`packages/ui`)

### Prereqs

- Node 18+ (recommended: 20+)
- pnpm 9+

### Install

```bash
pnpm install
```

### Run everything (backend + both frontends)

```bash
pnpm dev
```

Services:

- **Backend**: `http://localhost:3000`
- **Admin**: `http://localhost:5173`
- **Student**: `http://localhost:5174`

### What to look for

- Both `admin` and `student` import a shared `Button` from `@shaxmatchi/ui`.
- Both frontends also call the backend `/health` endpoint to show it’s wired up.

