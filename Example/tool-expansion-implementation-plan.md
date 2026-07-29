# Tool Expansion — Implementation Plan

Evaluates the 16 tools against what GhostWire already has, and what fits its architecture: a Node/Express backend, passive/free/keyless-first data sources, and a connector interface (`{ id, label, title, inputLabel, placeholder, run(query) → { lines, data } }`, registered in `backend/src/connectors/index.js`). Tools that are Python/Go CLI frameworks, desktop GUI apps, or require paid keys with no free tier don't get wrapped directly — where they'd add real value, the plan is to reimplement just the useful data source as a native connector, the same way `crt.sh` already replaced needing OWASP Amass.

## Quick verdict

| Tool | Verdict | Why |
|---|---|---|
| **Sherlock** | **Build now** | Grimnir already does exactly this (username → platform probing) but only checks 4 platforms. Swapping in the open WhatsMyName/Sherlock dataset is the single highest-value, lowest-effort change on this list. |
| **Shodan** | **Build now** | `internetdb.shodan.io` is a free, keyless endpoint — exposed ports/vulns/hostnames per IP. Real new data category (infra exposure) µspect can't currently show. |
| **Censys** | Later / optional | Same category as Shodan (internet-wide host/cert scanning), but needs a registered API ID+secret. Worth adding as a second source once Shodan is in, gated like GrayhatWarfare already is. |
| **DNSDumpster** | No new connector | µspect already does the DNS + crt.sh part DNSDumpster does. The only differentiator is its network-map *visualization* — a frontend enhancement to µspect's existing data, not a new tool. |
| **Have I Been Pwned** | Already done | v0id covers this (password k-anonymity + XposedOrNot email-breach lookup, from this session's earlier work). |
| **ExifTool** | Already done | Wraith does this client-side already. |
| **OSINT Framework** | UI-only, optional | It's a link directory, not an API. Could add as a static "quick reference" panel — zero backend work. |
| **Yandex Reverse Image** | UI-only, optional | No public API. At most a manual "open reverse image search" link on Wraith's result panel. |
| **Epieos** | Skip | Commercial SaaS, no free/keyless bulk API. At most a manual pivot link (prefilled search), not an automated connector. |
| **Maltego** | Skip (integration) | Desktop GUI app, not an API — can't be embedded in a web backend. The *link-graph* idea is worth a future native feature: visualize GhostWire's own aggregated findings as a relationship graph. Noted below as a stretch idea, not scoped here. |
| **SpiderFoot** | Skip | Full Python OSINT framework. Its useful passive sources are the same ones already being added directly (crt.sh, Shodan); wrapping the actual tool means shelling out to Python for no new capability. |
| **theHarvester** | Skip | Subdomain part is already covered by µspect (crt.sh). The email-harvesting part relies on scraping search engines (fragile, against most engines' ToS) or paid APIs (Hunter.io) — not sustainable. |
| **OWASP Amass** | Skip | Its passive mode is the crt.sh technique µspect already uses; its other sources are the same paid APIs (SecurityTrails, Censys, Shodan) covered above. Active/brute-force subdomain mode isn't passive and is out of scope. |
| **Recon-ng** | Skip | Modular Python CLI — the module registry pattern is what GhostWire's own connector registry already does natively in Node. Its individual modules need the same paid keys (Shodan/Censys) already being added directly. |
| **GHunt** | **Not recommended** | Relies on unofficial/reverse-engineered Google endpoints and typically an authenticated Google session cookie — ToS risk and inconsistent with every other connector here being passive/keyless-safe. Flagging this explicitly rather than deciding for you; if you want it anyway, it needs its own review. |

## Tier 1 — build now

### 1. Grimnir platform expansion (Sherlock / WhatsMyName dataset)

**Current state:** `backend/src/connectors/grimnir.connector.js` hardcodes 4 platforms (GitHub, Reddit, GitLab, Keybase). This is the thing you already flagged as too limited.

**Change:** Replace the hardcoded `PLATFORMS` array with entries sourced from the [WhatsMyName](https://github.com/WebBreacher/WhatsMyName) open dataset (`wmn-data.json`), the same open manifest Sherlock itself draws from. Each entry looks like:
```json
{ "name": "GitHub", "uri_check": "https://github.com/{account}", "e_code": 200, "e_string": "", "m_code": 404, "m_string": "" }
```
— existence is still a plain HTTP status/body check, exactly Grimnir's current technique, just against ~500 platforms instead of 4. Since this runs server-side (no CORS constraint, unlike a client-side Sherlock port), coverage isn't limited the way a browser-only implementation would be.

**Implementation:**
- Vendor a filtered copy of `wmn-data.json` into `backend/src/connectors/data/wmn-platforms.json` at build/setup time (pin a snapshot rather than fetching it live on every request — it changes slowly and shouldn't be a runtime dependency).
- Filter to entries where `e_code`/`m_code` are simple status checks (skip any requiring `e_string`/`m_string` body-content matching to keep the connector fast — that's a fine v2 addition).
- Cap concurrent probes (e.g. batches of 25 via `Promise.all` per batch) rather than firing 500 requests at once — same timeout-bounded pattern `fetchWithTimeout` already provides, just needs batching so one query doesn't hammer 500 hosts simultaneously.
- Keep the honest-coverage caveat pattern already used elsewhere in the UI (e.g. v0id's field caveats): show "checked N/500 platforms" in the result.
- `data.results` shape stays the same (`{ platform, found, status }[]`), so `auditProfile.js`'s existing `aliasHits` scoring logic needs zero changes.

**Rate limits / failure handling:** each platform is an independent host, so per-host failures already degrade gracefully (existing `try/catch` → `found: false` per probe). No shared rate limit to worry about since these are 500 different domains, not one API.

### 2. Shodan InternetDB (new connector)

**What it adds:** real infrastructure exposure data µspect's DNS/crt.sh view can't show — open ports, detected services/CPEs, and known CVEs for a given IP.

**Endpoint:** `GET https://internetdb.shodan.io/{ip}` — **free, keyless, no rate-limit key required.** Returns:
```json
{ "ip": "1.2.3.4", "ports": [22, 80, 443], "hostnames": [...], "cpes": [...], "vulns": ["CVE-2023-..."], "tags": [...] }
```
404 means no data indexed for that IP (not an error — just nothing on file).

**Design:**
- New connector `backend/src/connectors/shodan.connector.js`, id `shodan`, input is an IP (or resolve a domain to its A record first via the same DoH call µspect already makes, so the operator can enter a domain and the connector resolves+queries automatically — reuse `queryRecord` logic from `mspect.connector.js`, or just accept "IP or domain" and branch).
- No API key needed for this endpoint specifically — note in the UI that a full Shodan API key (optional env var `SHODAN_API_KEY`, same optional-key pattern as `GRAYHAT_WARFARE_API_KEY` in WireTap) would unlock deeper search later, but isn't required for this v1.
- New RECON_ARSENAL card + intake field (domain or IP), following the exact pattern of the other 4 connectors — register in `connectors/index.js`, add a `toolVisuals.js` entry, add an intake field + status span in `index.html`, add it to `auditProfile.js`'s findings/risk-score logic (e.g. any non-empty `vulns[]` → critical finding, open ports beyond common ones like 80/443 → moderate finding).

## Tier 2 — later / optional

### Censys (second internet-scanning source)
Same category as Shodan, different emphasis (cert-heavy, structured host data). Needs a registered API ID+secret (`https://search.censys.io/account/api`) — free tier exists but isn't keyless. Implement as an optional second data source on the same `shodan` connector/card (or a separate `censys` card if you'd rather keep them distinct), gated the same way GrayhatWarfare already is in WireTap: connector checks for the env var, degrades gracefully with a "not configured" line if absent.

### DNSDumpster-style visualization
Not a new connector — a frontend enhancement. Render µspect's existing `records`/`subdomains` data as a simple node graph (domain → subdomains → resolved IPs) instead of/alongside the current text list. Pure UI work once you're ready for it.

## Tier 3 — UI-only additions (no backend work)

- **OSINT Framework-style reference panel:** a static, categorized list of external OSINT links (opens in new tabs), living wherever makes sense in the UI — e.g. a collapsible panel on the output page. No connector, no API.
- **Yandex reverse image / Epieos quick-links:** manual pivot buttons (e.g. on Wraith's result panel, a "reverse image search" link; near the v0id email field, an "open Epieos" link) rather than automated lookups, since neither has a sustainable free API for automation.

## Explicitly not recommended: GHunt

Flagging on its own since it's a judgment call, not a technical one. GHunt works by calling undocumented, reverse-engineered Google endpoints and generally needs an authenticated Google account's session cookie to function — that's meaningfully different from every other connector in GhostWire (all currently hit official, documented, or clearly-public APIs). If you want Google-account OSINT anyway, it deserves its own explicit go/no-go conversation rather than being folded into this batch.

## Suggested build order

1. Grimnir platform expansion (biggest complaint you raised, self-contained change to one connector).
2. Shodan InternetDB connector (new capability, zero auth friction, same effort as v0id/µspect were).
3. Censys, gated behind an optional key, once you've decided you want a second infra source.
4. UI-only additions (reference panel, quick-links, DNSDumpster-style graph) whenever there's a UI pass planned — none of these block on each other or on the connectors above.
