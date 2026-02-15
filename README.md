# Daily Fret

Personal guitar practice tracker — Progressive Web App (PWA).

Dark, grungy aesthetic. Tracks sessions, gear, resources, and progress. Works in desktop browsers and installs as a native app on mobile. All data lives in your browser's IndexedDB — no accounts, no cloud, no BS.

---

## Quick Start

```bash
# 1. Clone to your Docker VM
git clone https://github.com/YOURUSERNAME/daily-fret.git
cd daily-fret

# 2. Generate icons (one time)
node scripts/gen-icons.js

# 3. Start with Docker Compose
docker compose up -d

# 4. Open in browser
# http://YOUR-VM-IP:3000

# 5. (Optional) Install as app
# Chrome: click the install icon in the address bar
# Mobile: tap Share → Add to Home Screen
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

```bash
# On your Docker VM via SSH:
git pull
docker compose restart

# If you changed package.json:
docker compose up -d --build
```

The app also shows an **in-app update banner** when a new commit is available on GitHub. Click "Pull & Restart" to update automatically.

### ✅ Post-merge deploy checklist (run every time)

```bash
# 0) one-time safety fix if git complains about dubious ownership
sudo git config --global --add safe.directory /opt/stacks/faithfulfret

# 1) ensure your repo files are owned by your login user (replace josh if needed)
sudo chown -R josh:josh /opt/stacks/faithfulfret

# 2) update code
cd /opt/stacks/faithfulfret
git fetch origin
git checkout main
git pull origin main

# 3) rebuild + restart containers
sudo docker compose down --remove-orphans
sudo docker compose up -d --build

# 4) verify app is healthy
sudo docker compose ps
sudo docker compose logs --tail=120
```

Browser refresh after deploy:

```text
Open http://YOUR-VM-IP:3000
Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
If stale UI remains: DevTools > Application > Service Workers > Unregister
Reload once more
```

### Data safety (important)

- Your sessions/gear/resources are stored in your browser's IndexedDB for the app origin.
- If you change domain or port, the browser treats it as a different app storage area.
- Always export a backup JSON from `Progress` before major updates/migrations.
- After moving hosts/ports, use `Import Data` in `Progress` to restore.

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

Data is stored in **this browser's IndexedDB**. Use export/import to move data between browsers or devices.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js + Express |
| Frontend | Vanilla JS (ES6 modules, zero build tools) |
| Database | IndexedDB via `idb` CDN library |
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
├── server.js                     Express: static files + /api/version + /api/update
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
│       ├── db.js                 IndexedDB wrapper
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
