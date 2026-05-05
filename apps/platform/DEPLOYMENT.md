# Tandoor Platform — Vercel Deployment

This app is deployed on Vercel as a static React (Vite) frontend plus a single
serverless function for the demo API. No custom domain is required: the app
runs on Vercel's default `*.vercel.app` domain out of the box.

## Project settings on Vercel

When importing the repository in Vercel, set:

- **Root Directory**: `apps/platform`
- **Framework Preset**: Other (or leave on auto-detect; `vercel.json` overrides)
- **Build Command**: `vite build` (already in `vercel.json`)
- **Output Directory**: `dist/public` (already in `vercel.json`)
- **Install Command**: `npm install` (already in `vercel.json`)

No environment variables are required for the demo. Demo data is held in memory
inside the serverless function — it resets between cold starts, which is fine
for a preview/demo deployment.

## How requests are routed

The `vercel.json` at `apps/platform/vercel.json` configures Vercel as follows:

1. `vite build` produces the SPA into `dist/public`.
2. The catch-all serverless function at `apps/platform/api/[...path].ts` is
   automatically deployed by Vercel for every path under `/api/*`.
3. A single SPA rewrite sends every non-`/api/` path to `/index.html` so that
   client-side routing (including hash-safe paths) keeps working on hard reloads
   and direct links.

The frontend uses **relative** URLs (`/api/...`) via
`client/src/lib/queryClient.ts`, so it works on any host without any
`VITE_API_URL` configuration.

## API endpoints exposed

All endpoints from local Express dev are reachable on the Vercel deployment:

- `GET /api/organizations`
- `GET /api/users`
- `GET /api/dealers`
- `GET /api/products`
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/:id`
- `GET /api/claims`
- `GET /api/activity`

## A note on the Vercel API function

The Vercel function file at `apps/platform/api/[...path].ts` is intentionally
**self-contained**: it does not import from `server/*` or use the `@shared/*`
TypeScript path alias. Vercel's serverless Node bundler does not resolve
`tsconfig` path aliases at function build time, and importing through
`@shared/schema` previously caused `FUNCTION_INVOCATION_FAILED` at runtime.
The handler also avoids pulling in `drizzle-orm` / `better-sqlite3`, which
are only needed for the Express dev path.

The local Express server still uses `server/api-handlers.ts` and
`server/storage.ts` (which import shared schema types). The two paths are
small enough that duplicating the demo data and routing in the Vercel
function is the simplest robust solution; if the API grows we can extract
the shared logic into a dependency-free module reachable by relative import.

## Local development

Local dev still runs the Express server (unchanged):

```bash
cd apps/platform
npm install
npm run dev      # http://localhost:5000  (Express + Vite middleware)
npm run check    # tsc type check
npm run build    # client + server bundle for the Express target
```

## Verifying a deployment

After Vercel finishes deploying, sanity-check the default domain:

```bash
curl https://<your-project>.vercel.app/api/dealers
curl https://<your-project>.vercel.app/api/orders
```

Both should return JSON. Any unknown `/api/...` path returns a JSON 404 from
the function (not an HTML `NOT_FOUND`), which is the signal that the function
is wired up correctly.
