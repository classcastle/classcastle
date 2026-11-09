create table if not exists public.oauth_app_owners (
  client_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  redirect_uris text[] not null default '{}',
  scopes text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.oauth_app_owners enable row level security;

create index if not exists oauth_app_owners_owner_id_idx
  on public.oauth_app_owners (owner_id);

revoke all on table public.oauth_app_owners from anon, authenticated;
