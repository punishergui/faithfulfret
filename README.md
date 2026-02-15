# Daily Fret

Personal guitar practice tracker — Progressive Web App (PWA).

Dark, grungy aesthetic. Tracks sessions, gear, presets, resources, and progress. Works in desktop browsers and installs as a native app on mobile. Data is persisted in SQLite at `/data/faithfulfret.sqlite`.

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

## Deployment / Updates

Production uses prebuilt GHCR images and Watchtower auto-updates.

`docker-compose.prod.yml` keeps host port `3000` mapped to container port `9999`, and mounts `./data:/data` so the SQLite DB survives restarts and image updates.

```bash
# Start/refresh production stack (no local build, no bind mounts)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

How updates work:
- Push to `main` builds/pushes `ghcr.io/punishergui/faithfulfret:latest` via GitHub Actions.
- Creating a tag like `v0.1-starter` also pushes `ghcr.io/punishergui/faithfulfret:v0.1-starter`.
- Watchtower checks every 5 minutes and restarts only `daily-fret` when a new image is available.

Rollback (pin a version tag):

1. Publish a tag from GitHub (`vX.Y.Z`) so GHCR has an immutable image.
2. Pin `docker-compose.prod.yml` to that exact tag.
3. Redeploy with compose pull/up.


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
- In both dev and prod compose files, `./data:/data` is mounted, so data persists across restarts/updates.
- Backup the DB file directly:

```bash
cp ./data/faithfulfret.sqlite ./data/faithfulfret.sqlite.backup-$(date +%Y%m%d-%H%M%S)
```

- You can also export/import JSON from the `Progress` page for portability between environments.

---

## Daily Usage

```
Log a session:     Click "+ LOG" in top nav
View sessions:     Click "SESSIONS"
Practice tools:    Click "TOOLS" → pick a tool
Check progress:    Click "PROGRESS"
```

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

```
Progress page → "Export All Data" → saves daily-fret-backup-DATE.json
To restore: Progress page → "Import Data" → select backup file
```

Primary data is stored in `/data/faithfulfret.sqlite`; export/import is still useful for moving data between environments or creating portable backups.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js + Express |
| Frontend | Vanilla JS (ES6 modules, zero build tools) |
| Database | SQLite (`/data/faithfulfret.sqlite`) via Node built-in `node:sqlite` |
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
- **Progress** — BPM and minutes charts, full history table, export/import
- **Metronome** — Web Audio API scheduler, tap tempo, keyboard shortcuts
- **Chord Reference** — 15 essential chords with ASCII diagrams and tips
- **Scale Patterns** — fretboard visualization with root note highlighting
- **BPM Guide** — tempo markings that open the metronome at that speed

---

## License

MIT — do whatever you want with it.
