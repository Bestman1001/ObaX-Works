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

## Supabase

Run `supabase/schema.sql` in your Supabase SQL Editor, then paste your Project URL and anon public key into `supabase-config.js`.

The website can insert quote requests into `quote_requests`. Public visitors cannot read, update, or delete quote requests because Row Level Security is enabled with only an insert policy.

## Run Locally

Open `index.html` in a browser, or serve the folder with any static web server.

```bash
python -m http.server 5173
```

Then visit `http://localhost:5173`.

## Tech

This prototype uses plain HTML, CSS, JavaScript, Leaflet, OpenStreetMap tiles, and Supabase so it can be hosted easily on GitHub Pages, Netlify, Vercel, or any static hosting service.
