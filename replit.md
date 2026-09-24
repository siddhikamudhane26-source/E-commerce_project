# Intelligent Commerce

An e-commerce storefront with explainable product recommendations, customer activity tracking, and an admin analytics dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/intelligent-commerce/src/App.tsx` — routed storefront, account, cart, auth, and analytics UI.
- `artifacts/intelligent-commerce/src/index.css` — shared signal-coral / ink / parchment visual system and motion utilities.
- `lib/api-spec/openapi.yaml` — source-of-truth API contract.
- `lib/db/src/schema/commerce.ts` — normalized commerce schema for catalog, customers, orders, activity, recommendations, and wishlist.
- `artifacts/api-server/src/lib/commerce.ts` — seed data and content-based recommendation scoring.
- `artifacts/api-server/src/routes/commerce.ts` — storefront and analytics API routes.
- `docs/database.sql` — readable SQL rubric examples including joins, grouping, subqueries, procedures, and triggers.

## Architecture decisions

- The storefront is public; the current demo profile uses seeded customer data while Clerk handles sign-in and sign-up.
- Recommendations are deterministic and content-based so scores and reasons are easy to explain during a viva.
- Cart state is persisted in browser storage; orders, wishlist, activity, and analytics are persisted in PostgreSQL.
- The API contract is OpenAPI-first and generated hooks are consumed by the frontend.

## Product

Visitors can browse a curated catalog, search and filter products, view product details, save wishlist items, manage a cart, place a demo checkout order, and review account history. Admins can view live metrics, revenue trends, customer segments, top products, order status, and recent activity.

## User preferences

No project-specific preferences recorded.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- The app depends on the API server and seeded development PostgreSQL data for the storefront preview.
- Clerk development-key warnings in the browser are expected for the preview environment.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
