# RankGod Deploy Guide

## Requirements
- Node.js 18+
- npm 9+
- Supabase project

---

## Install

```bash
npm install
```

---

## Deploy to Vercel with Supabase and Vertex AI OIDC

This project is a Next.js app using Prisma with Supabase Postgres for scan history and Vertex AI through Vercel OIDC. No Gemini API key is required.

### 1. Create the Supabase table

Open Supabase SQL Editor, copy the full contents of `supabase/schema.sql`, and run it.

### 2. Set Vercel environment variables

Set these environment variables in Vercel:

| Variable | Required | Notes |
|---|---:|---|
| `GCP_PROJECT_ID` | Yes | Google Cloud project ID |
| `GCP_PROJECT_NUMBER` | Yes | Numeric Google Cloud project number |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Yes | Service account that Vercel OIDC impersonates |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | Yes | Workload Identity Pool ID |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | Yes | Workload Identity Provider ID |
| `GCP_LOCATION` | No | Defaults to `us-central1` |
| `GEMINI_MODEL` | No | Main Vertex Gemini model |
| `GEMINI_VERTEX_MODEL` | No | Grounding model |
| `DATAFORSEO_API_KEY` | No | Enables DataForSEO sections when present |
| `DATABASE_URL` | Yes | Supabase Postgres connection string |

Do not configure legacy Gemini API-key auth or service-account JSON auth. Authentication goes through Vercel OIDC and Google Workload Identity Federation.

For Vercel/serverless, prefer the Supabase pooler connection string from Supabase Project Settings > Database. It usually uses port `6543`.

Example shape:

```bash
DATABASE_URL="postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

### 3. Deploy

Vercel will run:

```bash
npm install
npm run build
```

`npm install` runs `prisma generate` through the `postinstall` script.

---

## Local Development

Use the same Supabase `DATABASE_URL` locally if you want history to work in development.

```bash
cp .env.example .env.local
npm install
npm run dev
```

---

## Useful Commands

```bash
npm run db:generate
npm run build
npm start
```

Only run `npm run db:push` if you intentionally want Prisma to manage schema changes in Supabase. The recommended setup for this project is to run `supabase/schema.sql` in Supabase SQL Editor.

---

## Important Files

```text
prisma/schema.prisma  - Prisma Postgres schema
supabase/schema.sql   - Supabase table setup
lib/db.ts             - Prisma client
lib/vertexOidc.ts     - Vercel OIDC to Vertex AI auth
app/api/analyze       - Saves scan history
app/api/history       - Reads/deletes scan history
```

---

## Troubleshooting

**Vertex/Gemini does not work** - check the five `GCP_*` Workload Identity env vars, service account IAM permissions, and that Vertex AI is enabled for the project.

**DataForSEO section is empty** - check `DATAFORSEO_API_KEY` and balance at app.dataforseo.com.

**Database error** - check `DATABASE_URL`, Supabase password, pooler host/port, and confirm `supabase/schema.sql` has been run.
