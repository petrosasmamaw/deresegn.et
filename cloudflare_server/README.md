# Deresegn API — Cloudflare Workers (Hono)

This folder is a Workers-ready port of the Express API in `../server`.  
**Do not edit `../server` from here** — that Node/Render app stays as-is.

## Stack

- **Hono** — HTTP framework (no `app.listen`)
- **Wrangler** — local edge simulator + deploy
- **Neon serverless** (`@neondatabase/serverless` + Drizzle) — same Postgres as production
- **Better Auth** — `auth.handler(Request)` (Web Fetch API)
- **KV** — rate limits (`RATE_LIMIT_KV`)
- **nodejs_compat** — Jimp / jsQR / pdf-parse for receipt OCR

## Local development

```bash
cd cloudflare_server
npm install
cp .dev.vars.example .dev.vars   # or use the existing .dev.vars
# Edit .dev.vars: DATABASE_URL, BETTER_AUTH_*, GEMINI_*, CLOUDINARY_*, PETROS_*, BREVO_*
npm run dev
```

Open: [http://localhost:8787/api/health](http://localhost:8787/api/health)

Set `BETTER_AUTH_URL=http://localhost:8787/api/auth` in `.dev.vars`.

Point the web client / mobile app at:

```
VITE_API_URL=http://localhost:8787/api
VITE_AUTH_URL=http://localhost:8787/api/auth
```

## Deploy to Cloudflare

```bash
npx wrangler login
# Create KV namespace and paste id into wrangler.toml [[kv_namespaces]]
npx wrangler kv namespace create RATE_LIMIT_KV

# Secrets (not committed)
npx wrangler secret put DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put CLIENT_URL
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put BREVO_SENDER_EMAIL
npx wrangler secret put PASSWORD_RESET_URL
npx wrangler secret put PETROS_VERIFIER_API_KEY
npx wrangler secret put PETROS_VERIFIER_BASE_URL

npm run deploy
```

After deploy, set `BETTER_AUTH_URL` / `CLIENT_URL` to your Worker + website origins, then update the Vercel rewrite / mobile env to the Worker URL.

## API surface (same paths as Express server)

| Path | Purpose |
|------|---------|
| `GET /api/health` | Liveness |
| `GET /api/health/banks` | Bank reachability probe |
| `/api/auth/*` | Better Auth (signup, login, reset) |
| `/api/users`, `/api/me/*` | Profile + saved accounts |
| `/api/balance/*` | Wallet + top-up |
| `/api/check/*` | Receipt verify (screenshot / reference / SMS) |
| `/api/admin/*` | Admin |
| `/api/developer/*` | Paid API keys |
| `/api/v1/*` | External verify API |

## Notes

- Uploads are **memory-only** (no `uploads/` disk).
- Email MX checks use **Cloudflare DNS-over-HTTPS** (not `node:dns`).
- Heavy OCR/verify may need a **paid Workers** plan (CPU time). Prefer Petros for Telebirr/CBE off-network.
- DB migrations/seed still run from a Node laptop against Neon (`npm run db:migrate`, `npm run seed:users`).
