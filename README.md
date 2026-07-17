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
  [ FRONT-END / UI ]          [ MIDDLEWARE ]           [ ENGINES / DATA ]
  - HTML5 / Vanilla JS        - Node.js (Express)      - OSINT API Bridges
  - Custom SVG/CSS Canvas     - OTP Dispatch Service   - Python Scrapers
  - WebGL Scanline Shaders    - Session Auth Guard     - Local JSON Stores
```

*   **Static/Raster Emulation:** CSS custom properties (`@keyframes`) are heavily utilized to animate ASCII color shifts, preventing heavy CPU overhead.
*   **Audio Atmosphere (Optional):** A subtle low-frequency background hum (40Hz sinusoidal wave) plays upon user interaction, strengthening the "surveillance van" realism.

---

## 🚀 Setup & Deployment

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-repo/ghostwire.git
    cd ghostwire
    ```

2.  **Configure Environment Variables (`.env`):**
    ```env
    PORT=8080
    OTP_SECRET=your_high_entropy_jwt_secret
    SMS_API_KEY=your_out_of_band_sms_gateway_key
    ```

3.  **Install Dependencies & Initialize Node:**
    ```bash
    npm install
    npm start
    ```

4.  **Target Directory:**
    Access the terminal via `http://localhost:8080`.
