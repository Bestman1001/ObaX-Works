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
- The current quote flow prepares a demo request ID; backend delivery through SMS, WhatsApp, email, or dashboard is the next build step

## Run Locally

Open `index.html` in a browser, or serve the folder with any static web server.

```bash
python -m http.server 5173
```

Then visit `http://localhost:5173`.

## Tech

This prototype uses plain HTML, CSS, JavaScript, Leaflet, and OpenStreetMap tiles so it can be hosted easily on GitHub Pages, Netlify, Vercel, or any static hosting service.
