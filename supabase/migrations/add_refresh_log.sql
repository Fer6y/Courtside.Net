-- refresh_log — run history for the live match-refresh pipeline
-- (docs/live-match-refresh-plan.md). OPTIONAL: the pipeline works without
-- it (each run also returns its summary as JSON); this table just keeps a
-- browsable history in Supabase.
--
-- Run once in Supabase Dashboard → SQL Editor.

create table if not exists refresh_log (
  id      uuid primary key default gen_random_uuid(),
  ran_at  timestamptz not null default now(),
  trigger text not null default 'cron',
  ok      boolean not null default true,
  summary jsonb not null default '{}'::jsonb
);

-- Server-only: RLS on with no policies means the anon key can neither read
-- nor write; the service-role client (used by the cron route) bypasses RLS.
alter table refresh_log enable row level security;
