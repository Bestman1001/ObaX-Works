create extension if not exists pgcrypto;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text unique not null,
  artisan_id integer not null,
  artisan_name text not null,
  artisan_category text not null,
  artisan_state text not null,
  artisan_area text not null,
  customer_name text not null,
  customer_phone text not null,
  job_location text not null,
  urgency text not null,
  job_details text not null,
  status text not null default 'new' check (
    status in ('new', 'contacted', 'accepted', 'declined', 'completed', 'cancelled')
  ),
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create index if not exists quote_requests_created_at_idx
  on public.quote_requests (created_at desc);

create index if not exists quote_requests_status_idx
  on public.quote_requests (status);

create index if not exists quote_requests_artisan_state_idx
  on public.quote_requests (artisan_state);

alter table public.quote_requests enable row level security;

drop policy if exists "Anyone can create quote requests" on public.quote_requests;

create policy "Anyone can create quote requests"
  on public.quote_requests
  for insert
  to anon
  with check (true);
