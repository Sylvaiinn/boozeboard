-- ============================================================
-- BoozeBoard — Schéma Supabase
-- À exécuter dans l'éditeur SQL de Supabase (ou via CLI)
-- ============================================================

-- Table soirées
create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  location text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text default 'active' check (status in ('active', 'ended'))
);

-- Table participants
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references parties(id) on delete cascade not null,
  name text not null,
  emoji text default '🍺',
  weight_kg numeric,
  sex text check (sex in ('M', 'F', 'other')),
  default_drink_id uuid,
  joined_at timestamptz default now()
);

-- Table boissons (catalogue global + custom par soirée)
create table if not exists drinks (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references parties(id) on delete cascade,
  name text not null,
  emoji text default '🍺',
  volume_cl numeric not null check (volume_cl >= 0),
  alcohol_pct numeric not null check (alcohol_pct >= 0 and alcohol_pct <= 100),
  is_preset boolean default false
);

-- Contrainte de FK différée sur participants.default_drink_id
alter table participants
  add constraint fk_default_drink
  foreign key (default_drink_id)
  references drinks(id)
  on delete set null;

-- Table logs de consommation
create table if not exists drink_logs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade not null,
  drink_id uuid references drinks(id) not null,
  logged_at timestamptz default now(),
  note text,
  round_id uuid
);

-- Index pour les requêtes leaderboard
create index if not exists idx_drink_logs_participant on drink_logs(participant_id);
create index if not exists idx_drink_logs_logged_at on drink_logs(logged_at desc);
create index if not exists idx_participants_party on participants(party_id);
create index if not exists idx_drinks_party on drinks(party_id);

-- ============================================================
-- RLS (Row Level Security)
-- Accès libre — la sécurité = connaissance du code de soirée
-- ============================================================

alter table parties enable row level security;
alter table participants enable row level security;
alter table drinks enable row level security;
alter table drink_logs enable row level security;

-- Policies parties
create policy "Public read parties" on parties for select using (true);
create policy "Public insert parties" on parties for insert with check (true);
create policy "Public update parties" on parties for update using (true);

-- Policies participants
create policy "Public read participants" on participants for select using (true);
create policy "Public insert participants" on participants for insert with check (true);
create policy "Public update participants" on participants for update using (true);
create policy "Public delete participants" on participants for delete using (true);

-- Policies drinks
create policy "Public read drinks" on drinks for select using (true);
create policy "Public insert drinks" on drinks for insert with check (true);
create policy "Public update drinks" on drinks for update using (true);
create policy "Public delete drinks" on drinks for delete using (true);

-- Policies drink_logs
create policy "Public read drink_logs" on drink_logs for select using (true);
create policy "Public insert drink_logs" on drink_logs for insert with check (true);
create policy "Public delete drink_logs" on drink_logs for delete using (true);

-- ============================================================
-- Realtime
-- Activer dans la console Supabase > Database > Replication
-- Tables : drink_logs, participants
-- ============================================================
