# Destination-Parcs-
business website
# Destination Parcs website (Express.js)

## Run
    npm install
    cp .env.example .env     # set SESSION_SECRET and ADMIN_PASSWORD
    npm start                # http://localhost:3000

Team area: /admin (needs ADMIN_PASSWORD). Guest bookings, enquiries and quote requests are stored in /storage (JSON files; back this folder up).

## Where to edit content (no code needed)
- data/site.json: phone, email, social links, opening hours, map coordinates (lat/lng), Booking.com/Agoda/Airbnb links
- data/stay.json: PLACEHOLDER room types, unit counts, rates (the planner gave none)
- data/plan.json: first-time guide, FAQs, accessibility text (drafted, please confirm)
- data/pages.json: home hero text, experience tiles, highlights
- data/activities.json, breaks.json, corporate.json: generated from the planner. Re-run:
      python3 scripts/build-data.py path/to/ACTIVITIES_PLANNER.docx

## Photos
Drop files in public/images/ and they replace the brand artwork automatically:
- hero/forest.jpg, waterfront.jpg, families.jpg, campfire.jpg
- activities/<slug>.jpg (4:3) plus <slug>-2.jpg ... -5.jpg for the gallery
- types/<type>.jpg, breaks/<slug>.jpg, destinations/the-farm.jpg and the-farm-1..6.jpg
- gallery/*.jpg (home gallery), stay/<slug>.jpg, pages/corporate|stay|plan|breaks|experience|weddings|venues.jpg
