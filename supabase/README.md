# FixAm 9ja Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Go to Project Settings > API.
5. Copy the Project URL and anon public key into `supabase-config.js`.
6. Go to Authentication > URL Configuration.
7. Set Site URL to `https://bestman1001.github.io/FixAm-9ja/`.
8. Add `https://bestman1001.github.io/FixAm-9ja/account.html` to Redirect URLs.
9. Create an admin user in Authentication > Users.
10. Add the admin user to `public.admin_profiles`.

Use this after creating the Supabase Auth user, replacing the email:

```sql
insert into public.admin_profiles (user_id, email)
select id, email
from auth.users
where email = 'you@example.com'
on conflict (user_id) do update set email = excluded.email;
```

The public website gets insert access to `quote_requests`, `artisan_applications`, customer reviews, media metadata, and the public `fixam-media` Storage bucket. Anonymous visitors can read active artisan profiles, public review summaries, public media metadata, and artisan standing so marketplace listings and ratings can update. Anonymous visitors cannot read private quote/customer details.

## Artisan Directory Flow

1. Artisan submits the public onboarding form.
2. Admin opens `admin.html` and reviews the application.
3. Admin clicks `Create artisan profile`.
4. The profile is inserted into `public.artisans` and appears in the public directory when its profile status is `active`.
5. Admin can manage profile status, plan, verification, and quality standing from the dashboard.

## Review Flow

1. Admin opens `admin.html`.
2. Admin copies a review link from a quote request after the job is done.
3. Customer opens the link and submits `review.html`.
4. Review publishes automatically.
5. Admin can hide/flag unsafe reviews, or mark an artisan as warning, suspended, or removed.

## Accounts + Media Flow

1. Run the latest `schema.sql` to create `user_profiles`, `media_uploads`, and the `fixam-media` Storage bucket.
2. Customers or artisans open `account.html` and create/sign into an account.
3. Public quote requests, artisan applications, and reviews can attach up to four image/video files per submission.
4. Artisans can claim a listed profile when their account phone number matches an unowned artisan profile.
5. Claimed artisans can upload portfolio media from the account dashboard.
