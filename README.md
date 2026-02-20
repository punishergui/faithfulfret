# Daily Fret

Personal guitar practice tracker — Progressive Web App (PWA).

Dark, grungy aesthetic. Tracks sessions, gear, presets, resources, and progress. Works in desktop browsers and installs as a native app on mobile. Data is persisted in SQLite at `/data/faithfulfret.sqlite`. On startup the server logs `DB: /data/faithfulfret.sqlite` for quick verification.

---

## Quick Start

```bash
# 1. Clone to your Docker VM
git clone https://github.com/YOURUSERNAME/daily-fret.git
cd daily-fret

# 2. Generate icons (one time)
node scripts/gen-icons.js

# 3. Start with Docker Compose (mounts ./data -> /data and ./public -> /app/public read-only)
docker compose up -d --force-recreate

# 4. Open in browser
# http://YOUR-VM-IP:3000

# 5. (Optional) Install as app
# Chrome: click the install icon in the address bar
# Mobile: tap Share → Add to Home Screen
```

---


## RUNBOOK (Docker + GHCR)

- **Required Node version:** Node.js `22.x` for local non-Docker runs (Docker image is pinned to `node:22.14.0-alpine`).
- **Port mapping remains:** host `3000` -> container `9999`.

### Build locally

```bash
docker build --platform linux/amd64 -t faithfulfret:local .
```

### Run locally with Docker

```bash
mkdir -p ./data
docker run --rm -d --name faithfulfret-local -p 3000:9999 -v "$PWD/data:/data" faithfulfret:local
```

### Run via compose (dev)

```bash
docker compose up -d --build --force-recreate
```

### Run via compose (prod / GHCR)

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

`rewrite-app` images are self-contained for hero assets/overlay. Deploy from GHCR with **no local `public` bind-mount overrides** (only `./data:/data` is expected).

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Keep rollback path: publish immutable `vX.Y.Z` tags and pin compose image tags when needed for instant rollback.

After deploy, verify hero asset wiring is GHCR-safe (no local overrides): `curl -I http://127.0.0.1:3000/img/hero/djent.jpg` returns `200`, and `grep -R "/img/hero/.*\.svg" -n public` returns no active hero SVG references.

After deploy, verify Training routes load: `#/training`, `#/training/videos`, and `#/training/playlists` (Videos are now under Training, not Resources).
After deploy, verify Training video progress works (Watched/Mastered toggles + notes save/refresh) and Playlist pages show thumbnail previews with readable two-line titles on desktop and mobile.
After deploy, verify Training videos remain URL-based: create/edit videos with YouTube URLs, metadata fetch works, and thumbnails render from oEmbed/URL values.
After deploy, verify **Fetch Details** on `#/training/videos/new` auto-fills title, thumbnail, and duration (yt-dlp metadata), manual duration overrides save, and unknown durations render as `—` (never `00:00`).
After deploy, verify default duration placeholders (`00:00`, `0:00`, `00:00:00`, `0:00:00`) are treated as empty for **Fetch Details** auto-fill, while manual non-zero values (e.g. `12:34`) are preserved.
After deploy, verify Training Playlists list uses 70/30 layout (cards left, create/sort sidebar right), cards open on click, and each card thumbnail matches the first playlist video by position (or placeholder when empty).
After deploy, verify Playlist detail thumbnails keep a fixed 16:9 size with object-fit cover and do not squish when reorder/remove controls are visible.
After deploy, verify `#/training/videos` cards are fully clickable with keyboard Enter support, show subtle lift/glow hover states, and keep 16:9 thumbnails stable across theme switching.
After deploy, verify Dashboard → Start Practice works: Continue Last Video, Continue Last Playlist, and Quick Start Playlist should enable only after opening training content, and should show helper text when empty.
After deploy, create an export from **Stats → Data Management** and confirm the backup JSON includes `schemaVersion`, `createdAt`, `counts`, `tables`, and `localSettings` so restores stay verifiable across upgrades.
After deploy, verify Tools routes load: `#/tools`, `#/tools/tunings`, `#/tools/metronome`, `#/tools/chords`, `#/tools/scales`, `#/tools/progressions`, and `#/tools/chord-chart`; then set BPM once in Metronome and confirm `localStorage.df_last_bpm` updates.
After deploy, verify `#/tools` uses compact responsive cards (1 column at ~375px, 2 columns near ~900px, 3 columns near ~1300px) with visible keyboard focus and working theme toggle.
After deploy, verify `#/tools` has breathing room between the hero/header and the first row of tool cards on desktop and mobile.
After deploy, in Progressions confirm key changes refresh diatonic chords + progression diagrams, and in Chord Chart confirm Print View toggles a clean white export layout for poster-style references.
After deploy, verify Dashboard → Progress Memory updates only after Practice Mode Start/Stop in Progressions/Scales (streak, week/total minutes, top key, and top progression).
After deploy, verify Dashboard has no top stats strip; Progress Memory is the single stats area and includes Practice Summary rows for sessions/week, total sessions, and total hours without duplicate metrics.
After deploy, verify Session Detail uses two columns on desktop (video + content left, stats/actions sidebar right aligned to top), and stacks to one column on mobile without changing top navigation.
After deploy, verify Training Video Description editor supports inline code + code blocks (with preserved newlines), emoji picker insertions at caret, and theme-driven text colors (`data-color` spans) that adapt when switching themes.
After deploy, verify `#/training/videos/:id` rich description display wraps in the main column (including links), H2/H3 toolbar creates real headings that persist after save/reload, and emoji picker shows category tabs with expanded sets plus search.
After deploy, verify `#/training/playlists/:id` right sidebar includes **Edit Playlist**, and modal saves name, description, difficulty label, type, and order-within-group.
After deploy, verify adding nested playlist/video items from `#/training/playlists/:id` succeeds without popup errors, and add/move/remove controls update the list immediately (optimistic UI, no route refresh).
After deploy, verify `#/training/playlists/:id` action controls (**Move up/Move down/Remove**) are readable in both themes, and Add Video/Add Playlist dropdowns exclude items already present (including self-playlist nesting).
After deploy, verify Training playlists support mixed nested items (videos + child playlists), breadcrumb trail updates when opening nested playlists, cycle-prevention blocks adding parent into descendants, and nested playlist thumbnails resolve from first depth-first video (or placeholder).
After deploy, verify `#/training/playlists` renders one-level group cards with expand/collapse, grouped playlists sorted by order, and ungrouped playlists under **General**.
After deploy, verify `#/training/playlists` defaults to **Top-level** view (nested playlists hidden), scope toggle supports **All/Nested**, search returns matches across all playlists regardless of scope, and nested results show a **Nested** badge while still opening normally.
After deploy, verify each playlist card’s **X videos** value is recursive + distinct (direct videos + nested playlist videos across all depths, no double-counting duplicates, and no infinite loops if bad cycle data exists), using backend `totalVideoCount`.
After deploy, verify `#/training/playlists/:id` **Add Video** excludes videos already present anywhere in nested playlists (deep recursion), and that removing videos from nested playlists makes them re-appear without hard refresh.
After deploy, verify a video can be assigned to only one playlist globally: add a video in Playlist B, confirm it is hidden from Playlist A’s **Add Video** list, API `POST /api/training/playlists/:id/items` returns `409` for duplicates, then remove it from Playlist B and confirm it becomes addable again.
After deploy, verify nested playlist rows on playlist detail show deep labels like `12 Videos` (not generic nested labels), and cycles do not crash playlist detail stats.
After deploy, verify nested playlist rows show `X videos • duration` using deep stats (with partial marker when unknown durations exist), consistent with top-level playlist duration totals.
After deploy, verify a nested playlist can have only one parent: if Playlist B is nested under A, Add Playlist in C must exclude B and API `POST /api/training/playlists/:id/items` returns `409` when forced; then use **Unnest** to move B back to top-level and confirm it can be nested under C.
After deploy, verify strict one-level nesting UX/rules: nesting Playlist B under top-level A works, opening B hides **Add Nested Playlist** with an explanatory note, API `POST /api/training/playlists/:id/items` returns `409` when trying to nest any playlist under nested B, and nesting another top-level playlist C under A still works.
After deploy, verify nested playlists still allow **Add Video**: add a video from `#/training/playlists/:nestedId` and confirm API `POST /api/training/playlists/:id/items` succeeds for `item_type=video` while keeping nested-playlist (`item_type=playlist`) restrictions unchanged.
After deploy, verify video cards on both `#/training/videos` and `#/training/playlists/:id` display duration (`mm:ss`/`hh:mm:ss`), playlist list cards show deep total time, and partial totals display `(+?)` when some durations are unknown.
After deploy, verify `#/resources` shows the new hero + sticky search/filter chips + responsive card grid (1/2/3+ columns by breakpoint), and confirm Add/Open/Edit actions plus keyboard tab/focus still work.
After deploy, verify hero bars on `#/gear` and `#/resources` use only `/img/hero/djent.jpg`, and switching themes updates overlay intensity/tint without changing the underlying image.
After deploy, verify Settings → Theme Picker → Hero sliders change only hero image strength/overlay darkness, persist across refresh via localStorage (`ff.heroImgOpacity`, `ff.heroOverlayAlpha`), and Reset restores `0.55 / 0.52`.
After deploy, verify Settings → Theme Picker → Theme Editor saves per-theme CSS overrides in localStorage (`ff_theme_overrides:<themeId>`), applies immediately on theme switch/load, supports per-variable reset + reset all, and survives GHCR image updates because data stays client-side.
Also verify preset exports include embedded audio data URLs (`tables.presets[].audioData`) so uploaded/recorded audio survives import/export restores.

### Verify endpoints

```bash
curl -s http://127.0.0.1:3000/api/health | jq
curl -s http://127.0.0.1:3000/api/db-info | jq
curl -s http://127.0.0.1:3000/api/gear | jq
curl -s http://127.0.0.1:3000/api/gear-items | jq
curl -s http://127.0.0.1:3000/api/sessions | jq
curl -s http://127.0.0.1:3000/api/stats | jq
curl -s 'http://127.0.0.1:3000/api/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ' | jq
curl -s http://127.0.0.1:3000/api/training-videos | jq
curl -s http://127.0.0.1:3000/api/video-playlists | jq
curl -s http://127.0.0.1:3000/api/video-playlists/1 | jq
curl -s http://127.0.0.1:3000/api/videos/1/attachments | jq
curl -s http://127.0.0.1:3000/api/backup/export | jq '{schemaVersion, createdAt, counts}'
curl -s http://127.0.0.1:3000/media/presets/ | head -n 20
curl -s http://127.0.0.1:3000/uploads/preset-audio/ | head -n 20
curl -s http://127.0.0.1:3000/ | head -n 20
```


### Data recovery + persistence verification (safe runbook)

```bash
# 1) Inspect current mounts
cd /opt/stacks/faithfulfret
docker compose -f docker-compose.prod.yml ps
docker inspect daily-fret --format '{{json .Mounts}}' | jq

# 2) Find all candidate sqlite files (host + docker volumes)
find /opt/stacks/faithfulfret -type f \\( -name '*.sqlite' -o -name '*.db' \\) -printf '%p %s %TY-%Tm-%Td %TH:%TM:%TS\n' | sort -k2 -nr
for v in $(docker volume ls -q); do docker run --rm -v "$v:/v" alpine sh -lc "find /v -type f \( -name '*.sqlite' -o -name '*.db' \) -printf '$v %p %s %TY-%Tm-%Td %TH:%TM:%TS\n'"; done

# 3) Backup before touching anything
mkdir -p /opt/stacks/faithfulfret/_recovery
cp /opt/stacks/faithfulfret/data/faithfulfret.sqlite /opt/stacks/faithfulfret/_recovery/faithfulfret.sqlite.$(date +%Y%m%d-%H%M%S).bak 2>/dev/null || true
# (also back up candidate DB before restore)
cp /PATH/TO/CANDIDATE.sqlite /opt/stacks/faithfulfret/_recovery/candidate.$(date +%Y%m%d-%H%M%S).bak

# 4) Restore chosen DB into canonical persistent path
mkdir -p /opt/stacks/faithfulfret/data
cp /PATH/TO/CANDIDATE.sqlite /opt/stacks/faithfulfret/data/faithfulfret.sqlite
chown -R 1000:1000 /opt/stacks/faithfulfret/data || true

# 5) Restart stack
cd /opt/stacks/faithfulfret
docker compose -f docker-compose.prod.yml up -d

# 6) Verify DB path + counts
curl -s http://127.0.0.1:3000/api/db-info | jq
docker exec daily-fret sh -lc 'ls -la /data && stat /data/faithfulfret.sqlite'
```

Expected: `api/db-info` returns the absolute DB path, file size, modified time, and record counts (`sessions`, `gear`, `presets`).

### Rollback / pin a known-good image tag

```bash
# 1) update docker-compose.prod.yml image tag to a known good version
# image: ghcr.io/punishergui/faithfulfret:vX.Y.Z

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Deployment / Updates

### Training Phase 1 deploy check
1. Pull and redeploy the pinned image tag (`docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`).
2. Open `#/training` and confirm the seeded JustinGuitar provider + 9 levels appear.
3. Keep rollback path by publishing immutable `vX.Y.Z` tags and pinning `docker-compose.prod.yml` to the previous known-good tag if needed.


Production uses prebuilt GHCR images and Watchtower auto-updates.

`docker-compose.prod.yml` keeps host port `3000` mapped to container port `9999`, and mounts `/opt/stacks/faithfulfret/data:/data` so the SQLite DB survives restarts and image updates.

```bash
# Start/refresh production stack (no local build, no bind mounts)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
# Smoke-check API on host port 3000 (must map to container 9999)
curl -fsS http://127.0.0.1:3000/api/health | jq -e ' .ok == true '
# Backup API smoke (full DB + local settings restore path)
curl -s http://127.0.0.1:3000/api/backup/export | jq '{schemaVersion, createdAt, counts}'
# Theme smoke (confirm 10 music themes registry is bundled)
docker exec -it daily-fret sh -lc "node -e 'global.window={};require(\"/app/public/js/themes.js\");console.log(window.FF_THEMES.length)'"

# If UI theme/style changes were deployed, hard refresh clients once (Ctrl/Cmd+Shift+R) to clear cached assets.
# UI polish deploy check: verify Dashboard, Sessions, Stats, and Settings headers render full-width with compact, uniform hero height.
# UI polish deploy check: verify title/subtitle/filters/tabs stay left-aligned while hero action buttons stay right-aligned, and nav touches hero with no blank gap.
# UI polish deploy check: verify `/#/gear` and `/#/resources` now share an identical hero/header layout (hero bar, action button alignment, search row, and filter pills), with only page text/content differing.
# Hero theme deploy check: verify hero background art renders on headers using .page-hero/.df-hero/.session-hero and follows theme when data-theme is on either <html> or <body>.
# Hero wrapper deploy check: verify `#/dashboard`, `#/sessions`, `#/settings`, and `#/resources` render a `.page-hero` wrapper (resources includes `.resources-hero` too), and `#/session/:id` renders `.session-hero`, each with the themed hero background visible.
# Asset routing deploy check: `curl -I http://127.0.0.1:3000/img/hero/djent.jpg` should be `200 image/jpeg` (never SPA HTML).
# Dashboard layout deploy check: verify Recent Sessions + Recent Activity rows are fully clickable in the 70/30 layout, Quick Log remains the only fresh-start button, and mobile stacks into one column.
# Dashboard timeline deploy check: verify the dashboard shows unified Timeline cards from `/api/feed?limit=50` (sessions/gear/training/videos/playlists/resources/presets), thumbnails/icons render correctly, filters update client-side instantly with counts, and fallback empty state appears safely when feed is unavailable.
# Dashboard stats panel deploy check: verify Progress Memory/Practice Summary metrics render in the right column (streak/minutes/sessions totals), and no unexpected Start Practice CTA appears in the stats panel.
# Keep rollback path: always publish immutable vX.Y.Z tags and pin docker-compose.prod.yml image tag for fast rollback.

# Verify DB path after deploy
docker compose -f docker-compose.prod.yml logs daily-fret --tail=50 | rg 'DB: /data/faithfulfret.sqlite'
# Syntax checks for key app files after deploy
docker exec -it daily-fret sh -lc "node --check /app/server.js"
docker exec -it daily-fret sh -lc "node --check /app/data-store.js"
docker exec -it daily-fret sh -lc "node --check /app/public/js/pages/gear.js"
# Gear UI smoke: open Gear page and verify All/Owned/Wishlist/Sold filters + wishlist-only advanced filters
docker exec -it daily-fret sh -lc "node --check /app/public/js/router.js"
# Hotfix validation: gear_links now uses isPrimary (not SQLite reserved word primary)
docker exec -it daily-fret sh -lc 'sqlite3 /data/faithfulfret.sqlite "PRAGMA table_info(gear_links);" | rg -n isPrimary'
docker compose -f docker-compose.prod.yml logs daily-fret --tail=100 | rg -n "SqliteError|isPrimary|primaryUrl"
docker exec -it daily-fret sh -lc "node --check /app/public/js/pages/session-form.js"
docker exec -it daily-fret sh -lc "node --check /app/public/js/pages/session-single.js"
docker exec -it daily-fret sh -lc "node --check /app/public/js/pages/progress.js"
docker exec -it daily-fret sh -lc "node --check /app/public/js/pages/stats.js" # only if stats.js exists
# regression check shortcuts
docker exec -it daily-fret sh -lc "node --check /app/public/js/pages/gear.js"
docker exec -it daily-fret sh -lc "node --check /app/public/js/pages/progress.js || node --check /app/public/js/pages/stats.js"
# Verify presets editor script syntax in running container
docker exec -it daily-fret sh -lc "node --check /app/public/js/pages/presets.js"
# optional quick smoke checks after deploy
curl -s http://localhost:3000/api/session-heatmap | head -c 200
curl -s http://localhost:3000/api/gear-usage | head -c 200
curl -s http://localhost:3000/api/gear-items | head
curl -s http://localhost:3000/api/gear/EXAMPLE_ID/images | head
# optional UI smoke check: Gear list should show items by default (All filters)
# optional UI smoke check: Gear page filter buttons (All/Owned/Wishlist/Sold) should not change route from #/gear
# optional UI smoke check: Gear page keeps filters/list unchanged and shows compact Gear Stats in right sidebar
# optional UI smoke check: Resources page hero/filter row matches Gear-style layout, cards open on click, and Pin/Edit actions do not open external links
# optional UI smoke check: Stats page (#/progress) title reads "Stats" and shows full Gear Stats section near top
# optional UI smoke check: Session form supports Gear Used selection + "Use last gear" and session detail shows Used gear badges
# optional UI smoke check: open Presets and confirm Vypyr X2 Inst/Stomp/Effects rows render inside the same dial card/box,
# each row has a Type selector, and Amplifiers has an Amp LED Color selector that loads/saves correctly
# and P1/P2/Delay Feedback/Delay Level/Reverb Level dropdowns include an Off option and persist after save
```

How updates work:
- Push to `main` builds/pushes `ghcr.io/punishergui/faithfulfret:latest` via GitHub Actions.
- Creating a tag like `v0.1-starter` also pushes `ghcr.io/punishergui/faithfulfret:v0.1-starter`.
- Watchtower checks every 5 minutes and restarts only `daily-fret` when a new image is available.

Rollback (pin a version tag):

1. Publish a tag from GitHub (`vX.Y.Z`) so GHCR has an immutable image.
2. Pin `docker-compose.prod.yml` to that exact tag (`image: ghcr.io/punishergui/faithfulfret:vX.Y.Z`).
3. Redeploy with compose pull/up.
4. Keep the previous known-good tag noted so you can pin back instantly if needed (rollback path).
5. If a bad deploy lands, pin `docker-compose.prod.yml` back to the previous immutable tag and redeploy with `pull && up -d`.


```bash
# Example: pin to a known-good image tag
# edit docker-compose.prod.yml -> image: ghcr.io/punishergui/faithfulfret:v0.1-starter
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## VS Code SSH Workflow

```
1. Install "Remote - SSH" extension in VS Code
2. Ctrl+Shift+P → "Remote-SSH: Connect to Host" → enter your VM IP
3. Open folder: /path/to/daily-fret
4. Edit any file and save
5. In the VS Code terminal: docker compose restart
6. Refresh browser — changes live
```

---

## Updating From GitHub

For production, you no longer build on the server.

```bash
# 1) push changes to main (or push a v* tag for a versioned image)
# 2) GitHub Actions publishes GHCR image tags
# 3) Watchtower auto-pulls and restarts daily-fret within ~5 minutes
```

Manual refresh (optional):

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Data safety (important)

- App data is stored in SQLite: `/data/faithfulfret.sqlite`.
- Preset images are stored in `/data/presets` and served from `/media/presets/*`.
- Gear images are stored in `/data/gear` and served from `/media/gear/*`.
- In both dev and prod compose files, `./data:/data` is mounted, so DB + preset images persist across restarts/updates.
- Backup the DB file and preset media directly:

```bash
cp ./data/faithfulfret.sqlite ./data/faithfulfret.sqlite.backup-$(date +%Y%m%d-%H%M%S)
cp -R ./data/presets ./data/presets.backup-$(date +%Y%m%d-%H%M%S)
cp -R ./data/gear ./data/gear.backup-$(date +%Y%m%d-%H%M%S)
```

- You can also export/import JSON from the `Stats` page (`#/progress` route) for portability between environments.

---

## Daily Usage

```
Log a session:     Click "+ LOG" in top nav
View sessions:     Click "SESSIONS"
Practice tools:    Click "TOOLS" → pick a tool
Check stats:       Click "STATS"
```

---

---

## Port / Network

```
Default mapping: 3000:9999 (host:container)
Access: http://YOUR-VM-IP:3000
Remote access: Connect via VPN first, then open URL
Change host port: Edit docker-compose.yml → ports: "XXXX:9999"
```

The Docker VM is at `10.0.10.246` — access via `http://10.0.10.246:3000` when on the same network or VPN.

---

## Data Backup

### Backup & Restore (ZIP + JSON)

Stats page (`#/progress`) now supports:
- **Export All Data** → downloads `faithfulfret-backup-YYYY-MM-DD.zip` from `GET /api/export/zip`
- **Import Backup ZIP** → uploads ZIP to `POST /api/import/zip`
- **Import JSON** (legacy portable import) → uploads JSON to `POST /api/import`

ZIP backup contents:
- `faithfulfret.sqlite` (safe checkpointed backup copy)
- `gear/` media folder (if present)
- `presets/` media folder (if present)
- `export.json` (reference JSON export)

Restore behavior:
- App enters temporary maintenance mode during ZIP restore.
- Current DB + media are moved to `/data/_restore_backup/<timestamp>/` before replacement.
- Default media policy is **replace** from uploaded ZIP.
- After restore, verify counts from `GET /api/db-info`.

Rollback path:
1. Publish immutable image tags (`vX.Y.Z`) for each release.
2. Pin `docker-compose.prod.yml` to a known-good tag.
3. Redeploy (`docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`).

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js 22 + Express |
| Frontend | Vanilla JS (ES6 modules, zero build tools) |
| Database | SQLite (`/data/faithfulfret.sqlite`) via `better-sqlite3` |
| Offline | Service Worker (cache-first) |
| Deploy | Docker + Docker Compose |
| Port | Host `3000` → Container `9999` |

---

## Manual Wiki (Full Local Wiki Editor)

Open `Wiki` in the top navigation to use the in-app local wiki.

### What it supports now

- Create, edit, duplicate, move, and delete local wiki pages.
- Sidebar TOC tree with drag/drop reorder and section creation.
- Rich toolbar for markdown insertions (headings, lists, links, code, quote, table, callouts).
- Edit / Preview / Split views with autosave and unsaved-change warning.
- Local image insertion with **three methods**:
  - Insert Image button (file picker)
  - Drag/drop image into editor
  - Paste image from clipboard (`Ctrl+V`)
- Built-in image manager at `#/manual/assets` (copy embed code, rename, delete).
- Offline search index rebuild from local pages.

### Storage modes

By default the wiki is **IndexedDB-only** (fully local/offline, no server writes required).

Optional server mode is available in Wiki Settings:
- Pages: `public/manual/pages_local/**/*.md`
- Assets: `public/manual/assets_local/*`
- API endpoints:
  - `GET /api/wiki/pages`
  - `GET /api/wiki/pages/:slug`
  - `PUT /api/wiki/pages/:slug`
  - `DELETE /api/wiki/pages/:slug`
  - `POST /api/wiki/assets`

### Image embed format

IndexedDB mode embeds as:

```md
![Alt text](wiki-asset://<assetId>)
```

Server mode embeds as:

```md
![Alt text](/manual/assets_local/<filename>)
```

### Search

Use **Rebuild Search** in the wiki sidebar after bulk edits/imports.

---

## File Structure

```
daily-fret/
├── Dockerfile
├── docker-compose.yml
├── server.js                     Express: static files + update endpoints + data REST API
├── package.json
├── public/
│   ├── index.html                App shell
│   ├── manifest.json             PWA manifest
│   ├── sw.js                     Service worker
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── css/
│   │   ├── global.css
│   │   └── animations.css
│   └── js/
│       ├── db.js                 Frontend API wrapper
│       ├── router.js             Hash-based SPA router
│       ├── app.js                Bootstrap + update banner
│       ├── utils.js              Shared utilities
│       └── pages/
│           ├── dashboard.js
│           ├── sessions.js
│           ├── session-single.js
│           ├── session-form.js
│           ├── gear.js
│           ├── resources.js
│           ├── progress.js
│           ├── tools-hub.js
│           └── tools/
│               ├── metronome.js
│               ├── chords.js
│               ├── scales.js
│               └── bpm-guide.js
└── scripts/
    └── gen-icons.js
```

---

## API Endpoints

### `GET /api/version`
Checks GitHub for new commits. Returns:
```json
{
  "local": "abc123",
  "remote": "def456",
  "updateAvailable": true,
  "repoUrl": "https://github.com/owner/repo"
}
```

### `POST /api/update`
Runs `git pull && npm install` then restarts via Docker. Returns:
```json
{ "ok": true, "output": "..." }
```

---

## Troubleshooting

```
App won't load:    docker compose ps          (check it's running)
                   docker compose logs        (check for errors)

Port in use:       Change port in docker-compose.yml

Data gone:         Data lives in THIS browser's IndexedDB
                   Use export/import to move between browsers

Update stuck:      docker compose restart
                   Hard refresh browser (Ctrl/Cmd+Shift+R)
                   DevTools -> Application -> Service Workers -> Unregister

Icons missing:     node scripts/gen-icons.js
                   npm install canvas && node scripts/gen-icons.js   (better icons)

PWA won't install: Must be served over HTTP (localhost) or HTTPS
                   Check manifest.json is being served correctly
```

---

## Features

- **Dashboard** — greeting, streak, recent sessions, calendar heatmap, top resources
- **Sessions** — card grid with YouTube thumbnails, hover stats overlay
- **Single Session** — full view with embedded video, checklist, prev/next nav
- **Session Form** — log new or edit existing sessions
- **Gear** — track guitars, amps, pedals with category images and pricing
- **Resources** — lessons, YouTube channels, apps with star ratings
- **Stats** (`#/progress`) — BPM and minutes charts, full history table, export/import
- **Metronome** — Web Audio API scheduler, tap tempo, keyboard shortcuts
- **Chord Reference** — 15 essential chords with ASCII diagrams and tips
- **Scale Patterns** — fretboard visualization with root note highlighting
- **BPM Guide** — tempo markings that open the metronome at that speed

---

## License

MIT — do whatever you want with it.

---

## Training Engine Phase 1 (A–G + Notes/Attachments)

### New SPA routes

- `#/training`
- `#/training/providers`
- `#/training/provider/:id`
- `#/training/course/:id`
- `#/training/module/:id`
- `#/training/lesson/:id`
- `#/training/session-builder`

### New API endpoints

- `GET /api/oembed?url=...` (normalized + legacy oEmbed fields)
- `GET/POST /api/providers`
- `GET/POST /api/courses`
- `GET/POST /api/modules`
- `GET /api/lessons`
- `GET/POST/PUT/DELETE /api/lessons/:id` (POST uses server-side oEmbed autofill when `video_url` is provided)
- `GET /api/lesson-stats/:id`
- `POST /api/sessions` (keeps legacy create; creates draft when `date` is omitted)
- `POST /api/sessions/:id/items`
- `PUT/DELETE /api/session-items/:id`
- `PUT /api/sessions/:id/finish`
- `GET /api/sessions/:id` (includes `items`)
- `POST /api/attachments` (multipart form-data)
- `GET /api/attachments?entity_type=lesson&entity_id=123`
- `DELETE /api/attachments/:id`
- `GET /api/training/videos/:id` (normalized single-video view, YouTube/URL source)
- `GET /uploads/...` (static serving from `/data/uploads` for persisted attachments/media)

### New DB schema (idempotent)

Tables:
- `providers`
- `courses`
- `modules`
- `lessons`
- `lesson_skills`
- `session_items`
- `lesson_repeat_goals`
- `attachments`

New columns (via `ensureColumn`):
- `sessions.ended_at`
- `video_playlists.parent_playlist_id`

Persistent app columns:
- `sessions.total_minutes`
- `sessions.status`
- `lessons.notes_md`
- `lessons.practice_plan_md`
- `lessons.chords_md`

Indexes:
- `lessons(module_id)`
- `modules(course_id)`
- `courses(provider_id)`
- `session_items(lesson_id)`
- `session_items(session_id)`
- `attachments(entity_type, entity_id)`

### Upload/storage behavior

- Upload directory: `/data/uploads` (created automatically on startup)
- Generic attachment max file size: `25MB`
- Allowed MIME: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`

### localStorage keys used

Training quick-start now uses browser localStorage keys:
- `df_last_video_id`
- `df_recent_videos`
- `df_playlist_progress`
- `df_recent_playlists`
- `df_last_practice` (source of truth for Last Practice snapshot + Continue Last Practice + Next Up)

Existing app keys still apply (for example: `theme`, `handedness`).

### Deploy verification additions

After deploy, run:

```bash
# Training migration checks (course.level + training playlists tables)
docker exec -it daily-fret sh -lc 'sqlite3 /data/faithfulfret.sqlite "PRAGMA table_info(courses);" | rg -n "level"'
docker exec -it daily-fret sh -lc 'sqlite3 /data/faithfulfret.sqlite ".tables" | rg -n "training_playlists|training_playlist_items"'
# Training API checks
curl -s http://localhost:3000/api/training-playlists | head -c 200
curl -s http://127.0.0.1:3000/api/video-playlists | jq '.[0]'
curl -s http://127.0.0.1:3000/api/video-playlists | jq 'map({id,name,sort_order})'
# verify DELETE /api/video-playlists/:id (replace 123 with test playlist id)
curl -i -X DELETE http://127.0.0.1:3000/api/video-playlists/123

curl -s http://127.0.0.1:3000/api/providers | jq
curl -s http://127.0.0.1:3000/api/courses | jq
curl -s http://127.0.0.1:3000/api/modules | jq
curl -s http://127.0.0.1:3000/api/lessons | jq
curl -s http://127.0.0.1:3000/api/attachments?entity_type=lesson\&entity_id=1 | jq
curl -s 'http://127.0.0.1:3000/api/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ' | jq

# UI quick-start checks
# 1) open #/training/videos/<id>, verify timer Start/Pause/Reset appears and df_last_video_id updates
# 2) open #/training/playlists/<id>, click a video title, verify df_playlist_progress updates
# 3) open #/dashboard, verify Start Practice + Recent Activity cards show recent localStorage data
# 4) verify Last Practice card reads from df_last_practice, Continue Last Practice routes with ?resume=1, and Next Up suggests BPM step + alternate progression when applicable
# 4a) open #/training/videos and verify cards have no progress boxes; tags include WATCHED/MASTERED/NOTES and PDF/ATTACHMENTS when present.
# 4b) open #/training/videos/<id> and verify right sidebar order is Timestamps, Attachments, then Practice & Notes; attachments are not duplicated in the left column.
# 4c) open #/training/playlists and verify clean 3-column cards, sort dropdown (Name/Recently Updated/Most Videos), and a single accurate video count line.
# 4d) open #/training/playlists/<id> and verify larger 16:9 thumbs, 2-line title clamp, row click-to-open, and subtle right-aligned reorder/remove controls.
# 4e) on #/training/playlists/<id>, hover a video row and verify card lift/shadow/accent border/thumbnail brighten effects are subtle and fast, click anywhere in row opens the video, and reorder/remove buttons still work without triggering navigation.
# 4f) open #/training and verify Video Library + Playlists are full-tile links (no side buttons), hover lift/glow is subtle, and keyboard Tab+Enter opens each tile.
# 4g) verify breadcrumbs render under page titles on #/training, #/training/videos, #/training/videos/<id>, #/training/playlists, and #/training/playlists/<id>; only the last crumb is non-clickable.
# 4g1) open #/dashboard, #/sessions, #/gear, #/resources, #/training, #/presets, and #/settings; verify hero background uses /img/hero/djent.jpg with text/buttons above the overlay.
# 4g1b) run the hero asset guard script and confirm no forbidden hero references remain.
./scripts/check-hero.sh
# 4g2) verify nav-to-hero junction has no blank band (especially #/resources); if stale CSS persists after GHCR pull, do a hard refresh (Ctrl/Cmd+Shift+R).
# 4h) on video add/edit, verify Description rich-text toolbar supports bold/italic/underline/strikethrough, h2/h3, lists, quote, inline+block code, links, hr, undo/redo, clear formatting, palette-only text colors + reset, and 😀 emoji popover with caret insert.
# 4i) verify long words/URLs wrap in editor + video detail display (no bleed behind sidebar), Enter creates paragraphs, Shift+Enter inserts line breaks, and save+refresh keeps formatted Description (including emoji).
# 4j) verify sanitization blocks script/img/iframe/event-handler/style injection, only keeps safe http(s) links with target+rel, and preserves only allowed span data-color values (text/muted/accent/accent2/good/warn/bad) across save+reload (including inside h2/h3).
# 4k) create a new training video with blank duration and verify save auto-fetches duration_seconds, nested playlist rows show per-video durations, playlist total time uses deepDurationSeconds, and unknown durations render as — (not 00:00).
# Phase A tools checks
# 5) open #/tools/metronome and verify classic START/STOP + Tap Tempo + time-signature dots are present (reverted behavior).
# 6) open #/tools/tunings and verify ~20 tunings, per-string Play buttons, and Play All plucked playback are present.
# 7) open #/tools/chords and verify diagram labels plus playing-view orientation (Low E bottom, High e top).
# 8) open #/tools/scales and verify expanded scale list, string labels, and collapsible scale help card.
# 9) open each tool page and collapse Help once, refresh page, and verify collapsed state persists from localStorage.
# Phase E practice checks
# 10) open #/tools/progressions, enable Practice Mode, pick a progression, and verify count-in + chord highlight advance every configured beats/chord.
# 11) verify Progressions Pause resumes from current chord and Stop resets to chord 1.
# 12) open #/tools/scales, toggle "Show matching diatonic chords", and verify chips open #/tools/chords with matching root/type.
# 13) on #/tools/chords, start metronome from the Practice helper and verify df_last_bpm updates in localStorage.
```

Practice-mode localStorage keys: `df_last_bpm`, `df_practice_beats_per_chord`, `df_practice_countin_enabled`, `df_practice_countin_bars`, `df_practice_loop_enabled`, `df_last_key_root`, `df_last_key_mode`.

Keep rollback path unchanged: publish immutable tags (`vX.Y.Z`) and pin `docker-compose.prod.yml` image to the selected tag when rolling back.
