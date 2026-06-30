# FixAm 9ja

FixAm 9ja is a map-first Nigerian artisan marketplace by ObaX for finding trusted skilled workers by state, area, trade, rating, response time, and distance.

## Launch Coverage

- Lagos
- Abuja/FCT
- Edo
- Ogun
- Delta
- Rivers

## Product Direction

- Free customer discovery
- Free basic artisan listings
- Paid artisan subscriptions for verification, visibility, and leads
- Map pins with distance in miles
- State-by-state marketplace structure that can expand across Nigeria
- Trust features including verification badges, completed jobs, ratings, response times, and profile signals

## Phase 1 Flow

- Artisan cards open detailed profile modals
- Profiles show service area, skills, verification checks, portfolio items, availability, and marketplace metrics
- Customers can request a quote from a card or profile
- Quote requests collect name, phone, location, urgency, and job details
- Quote requests save to Supabase when the project URL and anon key are configured
- Artisan onboarding applications save to Supabase for admin review
- `admin.html` provides a private operations dashboard for quote requests and artisan applications
- Admin can create real artisan directory profiles from approved applications
- The public marketplace can load active artisan profiles from Supabase instead of only demo listings
- Admin can manage artisan profile status, plan level, verification state, and quality standing
- `review.html` lets customers publish transparent artisan reviews from one-time review links
- Admin can hide/flag abusive reviews and mark artisans as active, warning, suspended, or removed

## Supabase

Run `supabase/schema.sql` in your Supabase SQL Editor, then paste your Project URL and anon public key into `supabase-config.js`.

The public website can insert quote requests and artisan applications. Admin users can read and update them only after:

1. Creating a Supabase Auth user.
2. Adding that user to `public.admin_profiles`.
3. Signing in through `admin.html`.

Public visitors cannot read, update, or delete quote requests or applications because Row Level Security is enabled.

## Phase 3 Reviews

Reviews are customer-to-artisan by default. Admin does not approve or edit ratings. Admin can only hide/flag unsafe review content and control artisan standing when ratings reveal quality problems.

## Phase 4 Directory

The `artisans` table is the real public directory. Admin can turn an application into a live profile from `admin.html`, then pause, suspend, remove, verify, or upgrade the profile plan without editing database rows manually.

## Run Locally

Open `index.html` in a browser, or serve the folder with any static web server.

```bash
python -m http.server 5173
```

Then visit `http://localhost:5173`.

## Tech

This prototype uses plain HTML, CSS, JavaScript, Leaflet, OpenStreetMap tiles, and Supabase so it can be hosted easily on GitHub Pages, Netlify, Vercel, or any static hosting service.
