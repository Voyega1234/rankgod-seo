create extension if not exists pgcrypto;

create table if not exists public."Scan" (
  "id" text primary key default gen_random_uuid()::text,
  "rawInput" text not null,
  "detectedMainUrl" text,
  "detectedKeyword" text,
  "detectedArticleType" text,
  "detectedLanguage" text,
  "score" double precision,
  "verdict" text,
  "finalDecision" text,
  "markdownReport" text,
  "jsonReport" text,
  "rewritePrompt" text,
  "createdAt" timestamp(3) without time zone not null default current_timestamp
);

create index if not exists "Scan_createdAt_idx"
  on public."Scan" ("createdAt" desc);

create index if not exists "Scan_detectedKeyword_idx"
  on public."Scan" ("detectedKeyword");
