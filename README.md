# GHOSTWIRE

```text
  ________.__                      __    __      __.__               
 /  _____/|  |__   ____  _______ _/  |  /  \    /  \__|_______   ____  
/   \  ___|  |  \ /  _ \/  ___/\   __\ \   \/\/   /  \_  __ \_/ __ \ 
\    \_\  \   Y  (  <_> )___ \  |  |    \        /|  ||  | \/\  ___/ 
 \______  /___|  /\____/____  > |__|     \__/\  / |__||__|    \___  >
        \/     \/           \/                \/                  \/ 
========================= [ OSINT PORTAL & SURVEILLANCE FEED ] =========================
```

**GhostWire** is a specialized, web-based Open-Source Intelligence (OSINT) recon suite disguised as an active network node. Stripped of typical consumer-web elements, the interface mimics a live, low-level security and surveillance feed. It provides a centralized hub of passive and active reconnaissance utilities behind a hardened gatekeeper portal.

---

## 👁️ Visual Architecture & Aesthetic Spec

The front-end design of GhostWire rejects clean, sterile modern UI trends in favor of an immersive, hostile, and restless "terminal-grid" aesthetic.

### 1. Palette & Canvas
*   **Background:** Absolute pure black (`#000000`). No gradients, no gray panels. 
*   **Primary Accent:** Crimson / Blood Red (`#8B0000` to `#FF0000`). Used sparingly for high-visibility components, signal highlights, and active terminals.
*   **Secondary Accent:** Low-opacity, oxidized copper red or deep rust brown (`#4A0E0E`) to handle background structures without cluttering.

### 1b. The Boot Intro — Locked Data Nexus Gate
On every page load a full-screen **gate** blocks the app until the operator clicks **Accept & Proceed** (`frontend/js/ui/intro.js`). There is no skip shortcut and no auto-dismiss.

*   **Central figure:** `frontend/assets/divine-apparition.png` (from `Example/Divine_Apparition-removebg-preview.png`) inside a gothic doorway with breathing glow and target reticle.
*   **Full-viewport ASCII stream:** Characters spawn off all four edges and converge on the figure (theme polish from `Example/themeUpdate.md`).
*   **HUD framing:** Corner brackets (`┌ ┐ └ ┘`), top status bar (`GHOSTWIRE // SYS_NODE | STATUS: PENDING | AUTH: REQUIRED`), faint scrolling hex matrix, scanlines + grid.
*   **Humanized typewriter:** Warning copy types with punctuation pauses and hesitations; the Continue button only appears when typing finishes.
*   **Threshold exit:** On Accept — figure fades, doors open, perspective zooms through the doorway, crimson flash, then the app is revealed (`Example/threshold_sequence.html`).

Layout inspiration: `Example/ghostwire_intro.html` + `Example/threshold_sequence.html`.

### 2. The Hero Component: The Surveillance Mesh
The landing page displays a live, interactive vector/ASCII canvas representing a living network:
*   **Background Static:** A dense field of low-opacity red binary matrix code ($0$s and $1$s) quietly and unevenly flickers in the background. It mimics weak radio interference or a cold digital hiss, rather than a fast-moving animation.
*   **The Surveillance Eyes:** Six flattened, red ASCII/character-based eyes are scattered unevenly across the viewport. They are not structured in a clean grid; they represent chaotic surveillance nodes tracking user coordinates.
    *   **Edges:** Jagged, jittered, and imperfect, appearing as though they are actively condensing out of the background noise.
    *   **Pupils:** True black (`#000000`) void sockets, creating a hollow, unnerving effect that contrasts sharply against the ambient red matrix code.
*   **The Central Node (The Skull):** Located at the gravitational center of the viewport, a larger, dense binary-text skull serves as the core. The skull operates with a slow, ambient "breathing" pulsation (brightness oscillation via CSS/SVG keyframes), simulating an active daemon idling.
*   **The Wiring & Signal Propagation:**
    *   **Connections:** Every pathway linking the central skull to the outer eyes is rendered using tactile ASCII characters (`-`, `:`, `+` at junctions) instead of smooth lines.
    *   **Current Sweeps:** Sequential brightness animations loop along these pathways, making characters flare from near-black to hot crimson and fade back down to simulate high-frequency signal propagation.
*   **The Restless Wires (The Unnerving Detail):** A small subset of unmapped pathways break away from the skull, snaking out randomly into dead-ends in empty screen space. These paths dynamically fade, recalculate, and reroute, giving the interface a restless, searching intelligence.

### 3. Recon Arsenal — Brutalist Tool Cards
After authentication the console presents a horizontal **RECON_ARSENAL** gallery. Each live OSINT module is a 4-layer card (see `Example/themeUpdate.md`):

1. **Layer 1** — dark HUD grid background  
2. **Layer 2** — giant low-opacity brutalist word (`RECON` / `OBSCURE` / `ALIAS` / `LEAK`)  
3. **Layer 3** — character cutout (`frontend/assets/tools/tool1–4.png`) with `mix-blend-mode: screen` so black JPEG/PNG boxes drop out  
4. **Layer 4** — gothic title, description, and `LAUNCH MODULE` CTA  

| Asset | Module | Role |
| --- | --- | --- |
| `tool1.png` | µspect | Domain & IP recon |
| `tool2.png` | v0id | Credential / breach assessment |
| `tool3.png` | Grimnir | Social / alias footprint |
| `tool4.png` | WireTap | Cloud-bucket leak sniffing |

Selecting a card arms that connector in the query panel; execution still hits the live upstream APIs.

---

## 🔒 Portal Authentication & Gatekeeping

To maintain operational integrity and restrict public exploitation, the core recon engines are sequestered behind a strict terminal authentication layer:

```text
[GHOSTWIRE GATEKEEPER v1.0.0]
--------------------------------------------------
STATUS: RESTRICTED ACCESS AREA
ENTER OPERATOR ID : _
```

### The Login & OTP Workflow
1.  **Identity Initiation:** The operator initiates contact by providing registered credentials (encrypted login ID or operator handle).
2.  **Two-Factor Enforcement:** A time-sensitive, high-security One-Time Password (OTP) is dispatched via an out-of-band communication channel (SMS/Email/Secure Webhook).
3.  **Terminal Entry:** Access is granted only when the exact dynamic token is processed by the auth handler, decrypting the local module routes.

---

## 🛠️ Integrated OSINT Utility Suites (Post-Auth)

Once decrypted, the interface drops the user into an integrated suite of command-line and graphical recon modules:

*   **`µspect` (Target Footprinting):** Resolves structured queries on domain assets, hosting histories, and active network topologies.
*   **`WireTap` (Signal Leakage Sniffer):** Discovers leaky metadata, exposed configuration fragments, and exposed cloud storage buckets.
*   **`Grimnir` (Alias Tracker):** Traverses structured social handles, developer directories, and public code repositories to map digital identities.
*   **`v0id` (Breach Archive Indexer):** Safely cross-references known breach databases to highlight weak security postures and exposed account credentials.

---

## 🏗️ Technical Stack & Implementation

```text
  [ FRONT-END / UI ]          [ MIDDLEWARE ]              [ ENGINES / DATA ]
  - HTML5 / Vanilla JS (ESM)  - Node.js (Express)         - OSINT API bridges
  - Canvas ASCII engine       - OTP dispatch service      - Cloudflare DoH / HIBP
  - CRT scanline CSS shaders  - JWT session auth guard    - SQLite (better-sqlite3)
  - 40Hz Web Audio hum        - Helmet + rate limiting    - Audit / query logs
```

*   **Static/Raster Emulation:** The surveillance mesh (eyes, skull, wiring, matrix rain) is rendered on a single `<canvas>` per node to avoid DOM thrash; CSS `@keyframes` handle the scanline/flicker overlay.
*   **Audio Atmosphere (Optional):** A subtle 40Hz sawtooth hum (low-passed) plays on user interaction, strengthening the "surveillance van" realism.

---

## 🧱 Project Structure

```text
GhostWire/
├── package.json            # scripts: start | dev | migrate | seed
├── .env.example            # copy to .env and configure
├── backend/
│   ├── data/               # SQLite database (gitignored)
│   └── src/
│       ├── server.js       # bootstrap + graceful shutdown
│       ├── app.js          # Express app: helmet, cors, static, routes
│       ├── config/         # centralised env-driven config
│       ├── db/             # schema.sql, connection, repositories, migrate, seed
│       ├── middleware/     # auth guard, rate limiters, error handler
│       ├── controllers/    # thin HTTP handlers (auth, recon)
│       ├── services/       # auth, OTP dispatch, token, recon orchestration
│       ├── connectors/     # µspect, WireTap, Grimnir, v0id + registry
│       └── utils/          # logger, crypto, ApiError
└── frontend/
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── main.js         # entrypoint
        ├── api.js          # typed fetch client
        ├── ui/             # portal (login/OTP), console, feed
        └── visuals/        # asciiEye, skullArt, circuitField, audio, mesh (+ intro in ui/)
```

### API surface

| Method | Endpoint              | Auth | Purpose                                  |
| ------ | --------------------- | ---- | ---------------------------------------- |
| GET    | `/api/health`         | –    | Node liveness probe                      |
| POST   | `/api/auth/login`     | –    | Verify credentials, dispatch OTP         |
| POST   | `/api/auth/verify`    | –    | Validate OTP, set HTTP-only session      |
| POST   | `/api/auth/logout`    | –    | Terminate session                        |
| GET    | `/api/auth/session`   | ✔    | Report current operator                  |
| GET    | `/api/recon/modules`  | ✔    | List available recon modules             |
| POST   | `/api/recon/query`    | ✔    | Execute a recon module (rate-limited)    |
| GET    | `/api/recon/history`  | ✔    | Recent query history for the operator    |

---

## 🚀 Setup & Deployment

### Windows quick start (batch scripts)

For Windows, use the bundled `.bat` files (double-click or run from a terminal):

| Script               | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| `setup.bat`          | Checks Node, runs `npm install`, creates `.env` + generates `JWT_SECRET`, migrates the DB |
| `start-dev.bat`      | **Dev mode** — auto-reload, default `ghost`/`wire` login, auto-login + OTP bypass |
| `start-backend.bat`  | Backend only (prod-like) — serves the API **and** the app on `http://localhost:8080` |
| `start-frontend.bat` | Frontend dev server on `http://localhost:5173`, proxying `/api` to the backend |
| `start-all.bat`      | Launches backend + frontend (prod-like), each in its own window              |

First run on a new machine:
```bat
setup.bat
start-dev.bat      REM for feature testing (auto-login as ghost)
```
`start-frontend.bat` requires the backend to be running (it proxies `/api` to it). If you only run `start-backend.bat`, the full app is already available at `http://localhost:8080` — the separate frontend server is just for iterating on the UI on its own port.

> Cross-platform equivalents: `npm install`, `npm run migrate`, then `npm run backend` / `npm run frontend`. For dev mode set `DEV_MODE=true` and `NODE_ENV=development` in the environment (e.g. `DEV_MODE=true npm run dev`).

### GitHub Pages (static showcase)

Push or merge to **`main`** runs [`.github/workflows/deploy-github-pages.yml`](.github/workflows/deploy-github-pages.yml) and publishes the frontend to GitHub Pages.

**One-time repo setup:** Settings → Pages → **Source = GitHub Actions** (not “Deploy from a branch”).

| Detail | Value |
| --- | --- |
| Trigger | `push` to `main` (frontend / workflow paths) or **workflow_dispatch** |
| Site URL | `https://<owner>.github.io/<repo>/` (e.g. `https://lincalibur.github.io/GhostWire/`) |
| Build | `npm run pages:build` → copies `frontend/` to `dist/`, injects `STATIC_DEMO`, writes `404.html` |

Pages cannot host the Express/SQLite backend. The published build uses an in-browser mock API (`STATIC DEMO` badge) so the gate, arsenal, and console remain interactive. For live OSINT, run the Node stack locally or on a real server.

Local Pages bundle preview:
```bash
BASE_PATH=/GhostWire/ STATIC_DEMO=true npm run pages:build
# then serve ./dist with any static file server
```

### Dev mode vs. production

| | Dev mode (`start-dev.bat`) | Prod-like / production |
| --- | --- | --- |
| Enabled by | `DEV_MODE=true` and `NODE_ENV≠production` | default; forced off when `NODE_ENV=production` |
| Default operator | auto-seeded `ghost` / `wire` | **none** — no default credentials exist |
| Login | auto-login on page load; `DEV LOGIN` button bypasses OTP | full passphrase **+** OTP required |
| `POST /api/auth/dev-login` | mounted | not registered (404) |
| UI indicator | pulsing `DEV MODE` badge, prefilled form | none |

Dev conveniences are **hard-disabled** whenever `NODE_ENV=production`, regardless of `DEV_MODE`. Keep production on its own database (the default `backend/data/ghostwire.db`) and never run `start-dev.bat` / `npm run seed` against it, so no default account is ever created there.

### Manual setup

1.  **Clone & install:**
    ```bash
    git clone https://github.com/your-repo/ghostwire.git
    cd ghostwire
    npm install
    ```

2.  **Configure environment:** copy `.env.example` to `.env` and set at minimum a strong `JWT_SECRET`:
    ```bash
    cp .env.example .env
    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # generate a secret
    ```
    In development, `OTP_CHANNEL=console` prints the OTP to the server log. For production, set it to `email`/`sms` and wire the gateway keys.

3.  **Initialise the database:**
    ```bash
    npm run migrate     # apply schema
    ```

4.  **Run:**
    ```bash
    # Dev mode (default ghost/wire login, auto-login, OTP bypass):
    DEV_MODE=true NODE_ENV=development npm run dev

    # Prod-like (full passphrase + OTP, no default account):
    npm start
    ```
    Access the terminal via `http://localhost:8080`.

### Login flow
- **Dev mode:** the page auto-logs in as `ghost`; the form is prefilled and a `DEV LOGIN` button skips the OTP. No log-diving required.
- **Prod-like / production:** create an operator (`npm run seed` for a `ghost`/`wire` test account, or add your own), then:
  1. Enter the operator handle and passphrase.
  2. A 6-digit OTP is dispatched — in `console` mode it appears in the server log (`OTP dispatch ...`).
  3. Enter the OTP to establish a Level-4 session and drop into the recon console.

### Recon connectors
| Module     | Purpose                    | Upstream (all passive/safe)                     |
| ---------- | -------------------------- | ----------------------------------------------- |
| `µspect`   | Domain footprinting        | Cloudflare DNS-over-HTTPS                        |
| `WireTap`  | Cloud bucket exposure      | Passive S3 endpoint probing (GrayhatWarfare opt) |
| `Grimnir`  | Username / alias discovery | HTTP status probing of public profiles          |
| `v0id`     | Breach / credential check  | HaveIBeenPwned range API (k-anonymity)          |

Connectors degrade gracefully (return a diagnostic line) when upstreams are unreachable or optional API keys are unset.

> **Note on the `Example/` folder:** the original design mock-ups live in `Example/` for reference only. The functional application is the `backend/` + `frontend/` framework described above.
