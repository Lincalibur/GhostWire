# Exposure Check Toolkit — Implementation Plan

A single-page, client-side dashboard combining five tools to check what's publicly exposed about a person or domain, plus a report generator that turns findings into a fix-it checklist. Four tools run fully in-browser against free public APIs. One (WireTap) is scaffolded but left for you to wire up against infrastructure you're authorized to scan.

---

## 1. Shared input layer

Before any individual tool, one form collects what's known about the target:

| Field | Used by |
|---|---|
| Email | v0id |
| Domain | µspect, WireTap |
| Username | Grimnir |
| Photo upload | Wraith (independent — no identity link needed) |

Store this as a single JS object (`target = { email, domain, username }`) in page state. Each tool panel reads from it instead of having its own input box, so the person fills in what they know once. Any field can be left blank — a tool simply stays inactive until its required field is filled.

---

## 2. Tool-by-tool

### v0id — breach archive indexer
**Input:** email
**Checks:**
1. Password exposure — Pwned Passwords k-anonymity API.
   `GET https://api.pwnedpasswords.com/range/{sha1_prefix}` — hash the password locally (SHA-1, Web Crypto `crypto.subtle.digest`), send only the first 5 hex characters, match the suffix against the response body client-side. No key, no rate limit in practice.
2. Email breach lookup — XposedOrNot free API.
   `GET https://api.xposedornot.com/v1/check-email/{email}` — no key required. Free tier: 2 req/sec, 25/hour, 100/day per IP.
**Output:** list of breach names (or none), password exposure count.
**Note:** true k-anonymity only exists for the *password* check. HIBP's own email-search endpoint is paid-only as of 2026 — XposedOrNot is the free substitute for the email side, not a k-anonymity method itself, just a free unauthenticated lookup.

### µspect — target footprinting
**Input:** domain
**Checks:**
1. Live DNS — Cloudflare DNS-over-HTTPS.
   `GET https://cloudflare-dns.com/dns-query?name={domain}&type=A` with header `Accept: application/dns-json`. Free, CORS-enabled, no key. Repeat for `MX`, `TXT`, `NS` as needed.
2. Historical subdomains — Certificate Transparency logs via crt.sh.
   `GET https://crt.sh/?q=%25.{domain}&output=json` — returns every certificate ever issued for `*.domain.com`, which is the standard free way to surface subdomains the owner may have forgotten about (staging environments, old dev boxes, etc). No key, but crt.sh is a shared public resource — cache results client-side per session rather than re-querying on every render.
**Output:** current DNS records, deduplicated list of historical subdomains with first/last seen dates.

### Grimnir — alias tracker
**Input:** username
**Checks:** HTTP status probing across a list of platform URLs (`https://platform.com/{username}` → 200 = exists, 404 = doesn't).
**Constraint to design around:** most platforms don't send CORS headers, so a browser-only version can't read the response for the majority of sites — the request fires but JS can't inspect the result. Two honest options:
- **Client-side subset (buildable now):** maintain a curated list of platforms that either support CORS directly or expose a public JSON endpoint (GitHub `api.github.com/users/{username}`, Reddit `reddit.com/user/{username}/about.json`, a handful of others). Smaller coverage, but zero infrastructure.
- **Full coverage:** needs a lightweight server-side proxy (even a single serverless function) that makes the requests and returns a results array. Same technique tools like Sherlock use — they're not browser-based for this reason.
Start with the client-side subset and label it honestly in the UI ("checks N of ~600 platforms — full coverage needs a backend"), so nothing overstates what it found.
**Output:** list of confirmed profile URLs.

### Wraith — metadata extractor
**Input:** photo file (drag/drop or file picker)
**Process:** fully local, no network call.
1. Read EXIF via a vendored parser (`miniExif.js` or equivalent) — no CDN dependency needed if the parser is small enough to inline.
2. Extract and display: camera model, capture timestamp, GPS coordinates (if present), software tag.
3. Re-encode the image through an off-screen `<canvas>` and export via `canvas.toBlob()` — this drops all EXIF by default, producing a clean copy for download.
**Output:** table of found metadata + a "download stripped copy" button.

### WireTap — signal leakage sniffer (scaffold only)
**Input:** domain
**What ships:** the panel, input field, log-line format, and result card styling — matching the other four tools visually.
**What doesn't ship:** the actual bucket/config-leak probing logic. This is the one piece that queries live third-party infrastructure (S3 bucket existence, GrayhatWarfare index) rather than a static public dataset, so it's left as a clearly marked stub for you to fill in against targets you're authorized to check.
**Suggested contract**, so it plugs into the shared log/report system without changes elsewhere:
```js
async function runWireTap(domain) {
  // returns: { found: boolean, buckets: [{ name, public: boolean, url }] }
}
```

---

## 3. How they connect

```
target { email, domain, username }
        │
        ├──► v0id     (email)     ─┐
        ├──► µspect   (domain)    ─┤
        ├──► Grimnir  (username)  ─┼──► aggregator ──► unified report
        └──► Wraith   (photo)     ─┘
                                    
WireTap  (domain, manual trigger) ─ ─ ─► aggregator   (dashed = not automatic)
```

- The first four run **in parallel**, not sequentially — none needs another's output to start, so fire all four fetches concurrently (`Promise.allSettled`) rather than waiting on each one.
- Each tool writes its own lines to a shared transparency log as it runs (`[tool] → sent X to Y` / `[tool] ← received Z`), using the same format regardless of which tool logged it, so the log reads as one continuous trace rather than five separate widgets.
- Each tool also pushes zero or more findings into a shared `findings[]` array with a common shape:
  ```js
  { tool: 'v0id', severity: 'warn' | 'safe' | 'info', label: string, detail: string }
  ```
- The **aggregator** reads `findings[]` once all four (or five, if WireTap was run) have settled, and renders:
  1. A one-line summary ("3 issues found across 2 tools").
  2. The existing per-tool result cards (already built for v0id/password check).
  3. A deduplicated, prioritized checklist — e.g. if both v0id *and* Wraith flag something, both contribute to the same checklist rather than each printing its own redundant "you should fix this" text.

---

## 4. Build order

1. Shared input form + state object.
2. Wraith (no network dependency, fastest to get right, good for testing the report/log plumbing end to end).
3. v0id (already half-built from the earlier password/email checker — extend it to write into the shared log/findings format instead of its own local one).
4. µspect (two fetches, straightforward JSON parsing).
5. Grimnir, client-side subset first, with the coverage caveat visible in the UI.
6. Aggregator + unified report view, once at least two tools are feeding `findings[]`.
7. WireTap panel shell, stubbed.

---

## 5. Rate limits & failure handling

| Service | Free limit | On 429 |
|---|---|---|
| Pwned Passwords | no fixed limit, be reasonable | rare; retry once |
| XposedOrNot check-email | 25/hr, 100/day per IP | show "try again in a bit," don't retry automatically |
| Cloudflare DoH | generous, effectively unlimited for this use | — |
| crt.sh | shared public resource, no published limit | cache per session, avoid duplicate queries |
| Grimnir subset (GitHub, Reddit APIs) | varies per platform, generally low volume ok | show partial results if some platforms fail |

Every tool call should be wrapped so a single failure degrades gracefully — e.g. µspect still shows DNS results even if crt.sh times out — rather than the whole panel erroring out.
