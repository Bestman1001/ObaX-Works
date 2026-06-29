create extension if not exists pgcrypto;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text unique not null,
  review_token text unique,
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

alter table public.quote_requests
  add column if not exists review_token text;

create index if not exists quote_requests_created_at_idx
  on public.quote_requests (created_at desc);

create index if not exists quote_requests_status_idx
  on public.quote_requests (status);

create index if not exists quote_requests_artisan_state_idx
  on public.quote_requests (artisan_state);

create index if not exists quote_requests_review_token_idx
  on public.quote_requests (review_token);

create unique index if not exists quote_requests_review_token_unique_idx
  on public.quote_requests (review_token)
  where review_token is not null;

alter table public.quote_requests enable row level security;

drop policy if exists "Anyone can create quote requests" on public.quote_requests;

create policy "Anyone can create quote requests"
  on public.quote_requests
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.artisan_applications (
  id uuid primary key default gen_random_uuid(),
  application_code text unique not null,
  full_name text not null,
  trade text not null,
  state text not null,
  area text not null,
  phone text not null,
  preferred_plan text not null,
  years_experience integer not null default 0,
  work_summary text not null,
  status text not null default 'new' check (
    status in ('new', 'reviewing', 'approved', 'rejected', 'listed')
  ),
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create index if not exists artisan_applications_created_at_idx
  on public.artisan_applications (created_at desc);

create index if not exists artisan_applications_status_idx
  on public.artisan_applications (status);

create index if not exists artisan_applications_state_idx
  on public.artisan_applications (state);

alter table public.artisan_applications enable row level security;

drop policy if exists "Anyone can create artisan applications" on public.artisan_applications;

create policy "Anyone can create artisan applications"
  on public.artisan_applications
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

drop policy if exists "Admins can read own profile" on public.admin_profiles;

create policy "Admins can read own profile"
  on public.admin_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins can read quote requests" on public.quote_requests;
drop policy if exists "Admins can update quote requests" on public.quote_requests;

create policy "Admins can read quote requests"
  on public.quote_requests
  for select
  to authenticated
  using (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ));

create policy "Admins can update quote requests"
  on public.quote_requests
  for update
  to authenticated
  using (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ));

create table if not exists public.artisan_reviews (
  id uuid primary key default gen_random_uuid(),
  review_token text unique not null,
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  artisan_id integer not null,
  artisan_name text not null,
  artisan_category text not null,
  artisan_state text not null,
  artisan_area text not null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  quality_rating integer not null check (quality_rating between 1 and 5),
  timeliness_rating integer not null check (timeliness_rating between 1 and 5),
  professionalism_rating integer not null check (professionalism_rating between 1 and 5),
  price_fairness_rating integer not null check (price_fairness_rating between 1 and 5),
  would_recommend boolean not null default true,
  comment text not null,
  visibility text not null default 'public' check (
    visibility in ('public', 'hidden', 'flagged')
  ),
  admin_note text,
  created_at timestamptz not null default now()
);

create index if not exists artisan_reviews_artisan_id_idx
  on public.artisan_reviews (artisan_id);

create index if not exists artisan_reviews_visibility_idx
  on public.artisan_reviews (visibility);

create index if not exists artisan_reviews_created_at_idx
  on public.artisan_reviews (created_at desc);

alter table public.artisan_reviews enable row level security;

drop policy if exists "Anyone can create customer reviews" on public.artisan_reviews;
drop policy if exists "Anyone can read public reviews" on public.artisan_reviews;
drop policy if exists "Admins can read all reviews" on public.artisan_reviews;
drop policy if exists "Admins can update review visibility" on public.artisan_reviews;

create policy "Anyone can create customer reviews"
  on public.artisan_reviews
  for insert
  to anon, authenticated
  with check (visibility = 'public');

create policy "Anyone can read public reviews"
  on public.artisan_reviews
  for select
  to anon, authenticated
  using (visibility = 'public');

create policy "Admins can read all reviews"
  on public.artisan_reviews
  for select
  to authenticated
  using (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ));

create policy "Admins can update review visibility"
  on public.artisan_reviews
  for update
  to authenticated
  using (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ));

create table if not exists public.artisan_quality_controls (
  artisan_id integer primary key,
  artisan_name text not null,
  artisan_category text not null,
  artisan_state text not null,
  artisan_area text not null,
  standing text not null default 'active' check (
    standing in ('active', 'warning', 'suspended', 'removed')
  ),
  admin_note text,
  updated_at timestamptz not null default now()
);

alter table public.artisan_quality_controls enable row level security;

drop policy if exists "Anyone can read artisan standing" on public.artisan_quality_controls;
drop policy if exists "Admins can upsert artisan standing" on public.artisan_quality_controls;

create policy "Anyone can read artisan standing"
  on public.artisan_quality_controls
  for select
  to anon, authenticated
  using (true);

create policy "Admins can upsert artisan standing"
  on public.artisan_quality_controls
  for all
  to authenticated
  using (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ));

drop policy if exists "Admins can read artisan applications" on public.artisan_applications;
drop policy if exists "Admins can update artisan applications" on public.artisan_applications;

create policy "Admins can read artisan applications"
  on public.artisan_applications
  for select
  to authenticated
  using (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ));

create policy "Admins can update artisan applications"
  on public.artisan_applications
  for update
  to authenticated
  using (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_profiles
    where admin_profiles.user_id = auth.uid()
  ));
