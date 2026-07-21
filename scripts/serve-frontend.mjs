import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Minimal, dependency-free static file server for the GhostWire frontend.
 *
 * It serves everything under /frontend and transparently proxies /api/*
 * requests to the backend, so the browser only ever talks to a single
 * origin (cookies, CSP, and relative fetch paths all "just work").
 *
 * The backend (start-backend / npm start) must be running for API calls
 * to succeed — this server does not host the API itself.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

const FRONTEND_PORT = Number.parseInt(process.env.FRONTEND_PORT || '5173', 10);
const BACKEND_PORT = Number.parseInt(process.env.PORT || '8080', 10);
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/**
 * Forward an incoming request to the backend and stream the response back.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function proxyToBackend(req, res) {
  const upstream = http.request(
    { host: BACKEND_HOST, port: BACKEND_PORT, path: req.url, method: req.method, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );

  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message: `Backend not reachable on ${BACKEND_HOST}:${BACKEND_PORT}. Is start-backend running?`,
        },
      }),
    );
  });

  req.pipe(upstream);
}

/**
 * Serve a static asset from the frontend directory, falling back to the SPA
 * shell (index.html) for extension-less routes.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.normalize(path.join(FRONTEND_DIR, urlPath));

  // Prevent path traversal outside the frontend directory.
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (!statErr && stat.isDirectory()) filePath = path.join(filePath, 'index.html');

    fs.readFile(filePath, (err, data) => {
      if (err) {
        const ext = path.extname(filePath);
        // SPA fallback only for route-like (extension-less) requests.
        if (ext === '' || ext === '.html') {
          fs.readFile(path.join(FRONTEND_DIR, 'index.html'), (e2, shell) => {
            if (e2) {
              res.writeHead(404, { 'content-type': 'text/plain' });
              res.end('Not found');
              return;
            }
            res.writeHead(200, { 'content-type': MIME['.html'] });
            res.end(shell);
          });
          return;
        }
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  if ((req.url || '').startsWith('/api')) return proxyToBackend(req, res);
  return serveStatic(req, res);
});

server.listen(FRONTEND_PORT, () => {
  console.log(
    `GhostWire frontend online -> http://localhost:${FRONTEND_PORT}  (proxying /api -> ${BACKEND_HOST}:${BACKEND_PORT})`,
  );
});
