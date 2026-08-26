# Cloudflare Server Deployment Guide

This directory (`cloudflare-server`) contains the Cloudflare Workers edge-ready deployment of your backend. Your Render server (`server/`) remains completely untouched.

---

## 1. Prerequisites

Make sure you have logged into your Cloudflare account with Wrangler:

```bash
npx.cmd wrangler login
```

A browser window will open asking you to authorize Wrangler.

---

## 2. Set Up Environment Secrets

Cloudflare Workers uses encrypted secrets for sensitive credentials. Run the following commands inside `cloudflare-server/` to set your secrets:

```bash
# Database (Neon PostgreSQL connection string)
npx.cmd wrangler secret put DATABASE_URL

# Better Auth Secret
npx.cmd wrangler secret put BETTER_AUTH_SECRET

# Gemini AI API Key
npx.cmd wrangler secret put GEMINI_API_KEY

# Cloudinary (Image upload service)
npx.cmd wrangler secret put CLOUDINARY_CLOUD_NAME
npx.cmd wrangler secret put CLOUDINARY_API_KEY
npx.cmd wrangler secret put CLOUDINARY_API_SECRET

# Client URL (Frontend URL)
npx.cmd wrangler secret put CLIENT_URL
```

*(You will be prompted to paste each value securely in the terminal).*

---

## 3. Test Locally with Wrangler

To run the Cloudflare Workers local runtime emulator:

```bash
npm.cmd run dev
# or
npx.cmd wrangler dev
```

Your API will be available locally at `http://localhost:8787/api`.

---

## 4. Deploy to Cloudflare

Deploy your worker to Cloudflare's global edge network:

```bash
npm.cmd run deploy
# or
npx.cmd wrangler deploy
```

Once deployed, Cloudflare will output your public URL, for example:
`https://deresegn-server.<your-subdomain>.workers.dev`

---

## 5. (Optional) Custom Domain

To attach your custom domain (e.g., `api.deresegn.et`):
1. Go to **Cloudflare Dashboard** → **Workers & Pages**.
2. Select `deresegn-server` → **Settings** → **Domains & Routes**.
3. Click **Add** → **Custom Domain** and enter your desired subdomain (e.g., `api.deresegn.et`).
