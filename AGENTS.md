# Repository Guidelines

## Required Working Rules

Read [codeX.md](./codeX.md) before working. Use Korean explanations, implement one stage at a time, stop for user verification, and commit or push only after that verification. Before running commands, explain their purpose in one Korean sentence. Never request or expose secrets in conversation.

## Project Structure & Module Organization

This is a Nuxt 4, Vue 3, TypeScript, and Tailwind CSS npm workspace. `PRD.md` defines product scope; `DESIGN-mydealz.md` defines visual reference. The user selected Nuxt instead of the PRD's proposed Next.js stack and Vercel for deployment.

- `apps/feed/`, `apps/calendar/`, `apps/workspace/`: three Nuxt entry points.
- `layers/planner/`: shared configuration, Vue components, styles, and domain types.
- `tests/`: Vitest domain tests.
- `supabase/`: SQL migration and access-control verification script for a later stage.
- `docs/IMPLEMENTATION.md`: five-stage roadmap and verification instructions.

The active application starts in `PlannerApp.vue`; shared calendar and brand components serve all three variants. Current user authorization allows sequential work through stage five before final verification. Supabase account validation remains pending external setup; Vercel sites exist, but local changes require a new deployment and verification. Keep unverified changes uncommitted until the user confirms.

## Build, Test, and Development Commands

Run `npm ci` to install the locked dependencies. `npm run dev:feed`, `npm run dev:calendar`, and `npm run dev:workspace` start ports 3000, 3001, and 3002 respectively. `npm run build` generates all three static applications. `npm run typecheck`, `npm run lint`, and `npm test` check TypeScript, ESLint, and Vitest tests. Do not run Nuxt builds and type generation concurrently.

## Coding Style & Testing

Use two-space indentation, PascalCase Vue components, camelCase functions, and explicit domain types. Centralize styles in the shared layer. Name tests `*.test.ts`. Verify behavior such as priority ordering, timezone boundaries, deadline preservation, and persistence. Check mobile layouts and keyboard navigation. Report checks that could not run.

## Commits & Configuration

Existing history has no established commit convention. Use focused imperative subjects and stage only the user-verified changes. Preserve existing upstream documents. Never force-push or include `.env`, credentials, generated output, or dependencies. Document configuration with placeholders in `.env.example`. Supabase integration and production deployment verification remain separate checks. See `QA-REPORT.md` for tested scope and blocked scenarios.
