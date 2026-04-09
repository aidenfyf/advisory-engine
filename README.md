# advisory_engine.ai

AI-powered business diagnosis tool. Vercel-deployable.

## Project Structure

```
advisory-engine/
├── api/
│   ├── diagnose.js    # Anthropic diagnosis + Vercel KV rate limit + Airtable log
│   └── subscribe.js   # Newsletter signup → Airtable
├── public/
│   └── index.html     # Landing page + terminal UI
├── package.json
├── vercel.json
└── README.md
```

## Environment Variables (Vercel Dashboard → Settings → Environment Variables)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key (sk-ant-...) |
| `AIRTABLE_API_KEY` | Yes | Airtable personal access token |
| `AIRTABLE_BASE_ID` | Yes | Airtable base ID (starts with "app...") |
| `KV_REST_API_URL` | Yes | Auto-set when you link a Vercel KV store |
| `KV_REST_API_TOKEN` | Yes | Auto-set when you link a Vercel KV store |

## Setup Steps

### 1. Vercel KV (rate limiting)

This is what prevents people from spamming the diagnosis and burning your Anthropic credits.

1. Go to your Vercel project dashboard
2. Click **Storage** tab → **Create** → **KV (Redis)**
3. Name it anything (e.g. "advisory-engine-kv")
4. Click **Connect** — this auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your env vars
5. Redeploy

That's it. The code handles the rest: 3 questions per IP per 24 hours.

### 2. Airtable

Your Airtable base needs two tables:

**Table: `Advisory Questions`**

| Column | Type |
|--------|------|
| Question | Long text |
| Diagnosis | Long text |
| Question Number | Number |
| Created At | Single line text |

**Table: `Newsletter`**

| Column | Type |
|--------|------|
| email address | Email |

### 3. CORS (lock down your API)

In `vercel.json`, replace `YOUR-DOMAIN` with your actual Vercel domain:

```json
"Access-Control-Allow-Origin": "https://yourdomain.vercel.app"
```

If you add a custom domain later, update this to match.

### 4. Anthropic API Key

Get yours at https://console.anthropic.com → API Keys

## Deploy

```bash
# Push to GitHub, then import in Vercel
# Or use CLI:
cd advisory-engine
vercel --prod
```

## Features

- **Server-side rate limiting**: 3 diagnoses per IP per 24 hours via Vercel KV (Redis). Cannot be bypassed by clearing browser data.
- **Hormozi-style AI advisor**: Tactical, number-driven business diagnoses. Bottleneck → Revenue Impact → 3-Step Fix.
- **Airtable logging**: Every diagnosis + newsletter signup logged automatically.
- **CORS locked**: API only accepts requests from your domain.
- **Responsive**: Desktop, tablet, mobile.
