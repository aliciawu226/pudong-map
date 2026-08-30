-- 在 Supabase 控制台的 SQL Editor 里运行一次
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'place',
  category text default '',
  address text default '',
  lng double precision,
  lat double precision,
  note text default '',
  color text default '',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table places enable row level security;

drop policy if exists "places_read" on places;
create policy "places_read" on places for select using (true);

drop policy if exists "places_insert" on places;
create policy "places_insert" on places for insert with check (auth.uid() is not null);

drop policy if exists "places_update" on places;
create policy "places_update" on places for update using (auth.uid() is not null);

drop policy if exists "places_delete" on places;
create policy "places_delete" on places for delete using (auth.uid() is not null);
