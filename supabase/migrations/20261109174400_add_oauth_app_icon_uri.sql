alter table public.oauth_app_owners
  add column if not exists icon_uri text;
