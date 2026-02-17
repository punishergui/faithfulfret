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

# 3. Start with Docker Compose (mounts ./data -> /data)
docker compose up -d

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
docker compose up -d --build
```

### Run via compose (prod / GHCR)

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

After deploy, create an export from **Stats → Data Management** and confirm the backup JSON includes `schemaVersion`, `createdAt`, `counts`, `tables`, and `localSettings` so restores stay verifiable across upgrades.

### Verify endpoints

```bash
curl -s http://127.0.0.1:3000/api/health | jq
curl -s http://127.0.0.1:3000/api/db-info | jq
curl -s http://127.0.0.1:3000/api/gear | jq
curl -s http://127.0.0.1:3000/api/gear-items | jq
curl -s http://127.0.0.1:3000/api/sessions | jq
curl -s http://127.0.0.1:3000/api/stats | jq
curl -s http://127.0.0.1:3000/api/backup/export | jq '{schemaVersion, createdAt, counts}'
curl -s http://127.0.0.1:3000/media/presets/ | head -n 20
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
