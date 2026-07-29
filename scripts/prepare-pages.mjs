/**
 * Prepare a static site tree for GitHub Pages.
 *
 * Copies `frontend/` → `dist/`, injects a runtime config so the UI runs in
 * static-demo mode (no Express backend on Pages), and writes `404.html` so
 * deep links fall back to the SPA shell.
 *
 * Env:
 *   BASE_PATH   — e.g. "/GhostWire/" for project sites (default "/")
 *   STATIC_DEMO — "true" | "false" (default "true")
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'frontend');
const dest = path.join(root, 'dist');

const basePathRaw = process.env.BASE_PATH || '/';
const basePath = basePathRaw.endsWith('/') ? basePathRaw : `${basePathRaw}/`;
const staticDemo = String(process.env.STATIC_DEMO ?? 'true').toLowerCase() !== 'false';

/**
 * Recursively copy a directory.
 * @param {string} from
 * @param {string} to
 */
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
copyDir(src, dest);

const configSnippet = `<script>window.__GHOSTWIRE__=${JSON.stringify({
  staticDemo,
  basePath,
})};</script>`;

const indexPath = path.join(dest, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('window.__GHOSTWIRE__')) {
  html = html.replace('<head>', `<head>\n  ${configSnippet}`);
}
// Ensure relative asset resolution under project-page base paths.
if (basePath !== '/' && !html.includes('<base ')) {
  html = html.replace('<head>', `<head>\n  <base href="${basePath}" />`);
}
fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(dest, '404.html'), html);

const nojekyll = path.join(dest, '.nojekyll');
fs.writeFileSync(nojekyll, '');

console.log(`Pages bundle ready → dist/  (BASE_PATH=${basePath} STATIC_DEMO=${staticDemo})`);
