# Tamagn Check — one project (client + server)

Vite React frontend and Express API live in this folder. One install, one `npm run dev`, one Vercel deploy.

## Local

```bash
cd Tamagn-check-in-one
npm install
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:5000 (also available as `/api` via Vite proxy)

## Deploy (Vercel only)

1. Import this folder as a Vercel project (Root Directory = `Tamagn-check-in-one` if inside the monorepo).
2. Set the **same** secrets you use in `server/.env` as Vercel Environment Variables (Production).
3. Also set:

```
VITE_API_URL=/api
VITE_AUTH_URL=/api/auth
CLIENT_URL=https://YOUR_DOMAIN
BETTER_AUTH_URL=https://YOUR_DOMAIN/api/auth
NODE_ENV=production
```

4. Deploy. No separate Render/backend host — `/api` is the Express app as a Vercel serverless function.

## Layout

```
Tamagn-check-in-one/
  src/           # React client
  server/        # Express API (unchanged business logic)
  api/index.js   # Vercel entry → Express app
  package.json   # shared dependencies
```
