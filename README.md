# Destination Parcs website (Express.js)

## Run
    npm install
    cp .env.example .env     # set SESSION_SECRET and ADMIN_PASSWORD
    npm start                # http://localhost:3000

## Team area (/admin)
Sign in at `/admin` (or the "Team login" link in the footer). On first start `ADMIN_PASSWORD` creates the login
**admin**; change `ADMIN_PASSWORD` and restart to reset that password. More logins: Team logins in the sidebar, or
`npm run create-admin -- <username> "<Full Name>" <password>`.

What the team can do, with no code:
- **Home page**: banner slides (photo or looping video), gallery (photos, clips, YouTube/Vimeo), festive banner, tiles, highlights
- **Activities / Breaks / Stay / Destinations**: add, edit, hide, delete; each takes a main photo, more photos and videos
- **Page banners**, **Visit info & FAQs**, **Site settings** (phone, WhatsApp, social links, map)
- **Media library**: upload photos (auto-resized, thumbnails made) and videos (MP4, WebM, MOV), or paste YouTube/Vimeo links
- **Bookings, Enquiries, Quote requests**
- **History & revert**: every save is kept (last 30 per section). Restore any version, or reset a section to the original text
- While signed in, an **Edit this page** button shows on the public site

## Where things are stored (back these up)
- `storage/*.json`: guests, bookings, enquiries, quotes, team logins, media records
- `storage/content/`: everything edited in the team area, plus `_history/`
- `storage/uploads/`: uploaded photos, thumbnails and videos
Override with `STORAGE_DIR`, `CONTENT_DIR`, `UPLOAD_DIR`. Size limits: `MAX_IMAGE_MB` (25), `MAX_VIDEO_MB` (300).
Behind nginx, raise `client_max_body_size` (for example 320m) so large videos can upload.

## Defaults
`data/*.json` hold the original content. Admin edits are saved on top in `storage/content/` and never change these files.
- data/stay.json: PLACEHOLDER room types, unit counts, rates (the planner gave none)
- data/plan.json: first-time guide, FAQs, accessibility text (drafted, please confirm)
- activities/breaks/corporate: generated from the planner (`python3 scripts/build-data.py path/to/ACTIVITIES_PLANNER.docx`)

## Photos without the admin
Files dropped in `public/images/` (hero/, activities/<slug>.jpg, breaks/, destinations/, pages/, gallery/) still work as
a fallback when nothing is chosen in the team area.


## Storing data in a MySQL database (optional)

By default the site keeps its data in JSON files under `storage/`. To use MySQL or MariaDB instead (works on cPanel), add the `DB_*` settings from `.env.example` to your `.env` and restart. Nothing else changes: no public page is different.

What goes to the database: guests, bookings, enquiries, quote requests, team logins, the photo and video records, everything edited in the team area, and the history used for revert. Uploaded photo and video files themselves stay in `storage/uploads/` (back that folder up too).

**First start.** The site creates its tables (prefix `dp_`) and copies any existing JSON data into them once. Files are left untouched. On later starts everything is read from the database.

**How it behaves.** Data is loaded into memory when the site starts, and every change is written straight to the database in order, with retries. If the database stops answering, the admin dashboard shows a red "Database problem" note. Run one site process per database.

**Create a team login** with `npm run create-admin -- name "Full Name" password`, then restart the site so it picks the new login up. You can also add logins from Team in the admin area while the site is running.

**Back up or go back to files.** `npm run db:export` writes everything to `storage-export/` as JSON. To return to file storage, remove the `DB_*` lines, restart, and (if you want edits made while on the database) copy the files from `storage-export/` over `storage/`. If you skip the copy, the site shows the data as it was in the files before the switch.

**cPanel steps.** MySQL Databases: create a database and a user, add the user to the database with all privileges, put the three names and the password into the Node.js app's environment variables as `DB_NAME`, `DB_USER`, `DB_PASSWORD` (`DB_HOST` is `localhost`), then restart the app. `database/schema.sql` shows the tables if you want to create them by hand.
