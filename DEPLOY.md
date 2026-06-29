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

## Deploy to Vercel with Supabase

This project is a Next.js app using Prisma with Supabase Postgres for scan history.

### 1. Create the Supabase table

Open Supabase SQL Editor, copy the full contents of `supabase/schema.sql`, and run it.

### 2. Set Vercel environment variables

Set these environment variables in Vercel:

| Variable | Required | Notes |
|---|---:|---|
| `GEMINI_API_KEY` | Yes | Main AI analysis key |
| `GEMINI_MODEL` | No | Defaults in code if omitted |
| `DATAFORSEO_API_KEY` | No | Enables DataForSEO sections when present |
| `GCP_PROJECT_ID` | No | Enables Vertex grounding when configured |
| `GCP_LOCATION` | No | Defaults to `us-central1` |
| `GEMINI_VERTEX_MODEL` | No | Defaults in code if omitted |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | No | Use this on Vercel for Vertex service account JSON |
| `DATABASE_URL` | Yes | Supabase Postgres connection string |

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
app/api/analyze       - Saves scan history
app/api/history       - Reads/deletes scan history
```

---

## Troubleshooting

**Gemini does not work** - check `GEMINI_API_KEY`.

**DataForSEO section is empty** - check `DATAFORSEO_API_KEY` and balance at app.dataforseo.com.

**Database error** - check `DATABASE_URL`, Supabase password, pooler host/port, and confirm `supabase/schema.sql` has been run.
