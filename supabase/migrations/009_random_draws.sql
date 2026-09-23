-- Verifiable random song draws.
--
-- A draw is committed before the randomness that decides it exists: the row
-- stores the locked pool plus a future drand round, and is filled in once that
-- round is published. Rows are append-only from the app's point of view — the
-- reveal is a single conditional update guarded by revealed_at.
create table if not exists public.random_draws (
  id uuid primary key default gen_random_uuid(),
  -- Nullable so removing a profile never destroys an audit record; the name
  -- snapshot keeps the draw attributable either way.
  profile_id uuid references public.profiles(id) on delete set null,
  drawer_name text not null,
  pool_hash text not null,
  -- Immutable snapshot of the pool. Deliberately not a foreign key so that a
  -- catalog change can never rewrite or block a past draw record.
  pool jsonb not null,
  pool_size integer not null check (pool_size between 1 and 200),
  beacon_chain text not null,
  beacon_round bigint not null,
  beacon_available_at timestamptz not null,
  committed_at timestamptz not null default now(),
  revealed_at timestamptz,
  beacon_randomness text,
  beacon_signature text,
  winner_index integer,
  winner_chart_id uuid,
  winner_title text,
  constraint random_draws_reveal_complete check (
    (revealed_at is null
      and beacon_randomness is null
      and winner_index is null
      and winner_chart_id is null)
    or (revealed_at is not null
      and beacon_randomness is not null
      and winner_index is not null
      and winner_chart_id is not null)
  ),
  constraint random_draws_winner_in_pool check (
    winner_index is null or (winner_index >= 0 and winner_index < pool_size)
  )
);

create index if not exists random_draws_committed_at_idx
  on public.random_draws (committed_at desc);

create index if not exists random_draws_pool_hash_idx
  on public.random_draws (pool_hash, committed_at desc);

alter table public.random_draws enable row level security;

-- Readable by anyone: the whole point is third-party verification.
-- No insert/update policy, so only the service role can write.
create policy "Public random draws are readable"
  on public.random_draws for select using (true);
