import { writeFeed } from './feed.js';
import { parseExif } from '../vendor/miniExif.js';
import { recordMetadata } from '../state/auditProfile.js';
import { escapeHtml } from '../utils/dom.js';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Re-encode an image through canvas, which discards all EXIF/metadata
 * headers by construction — only raw pixel data survives.
 * @param {File} file
 * @returns {Promise<string>} object URL of the clean file
 */
function stripToBlobUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(URL.createObjectURL(blob));
          else reject(new Error('canvas re-encode failed'));
        },
        'image/jpeg',
        0.95,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('failed to load image'));
    };
    img.src = objectUrl;
  });
}

/**
 * @param {HTMLElement} el
 * @param {{ file: File, exif: object|null, cleanUrl: string }} args
 */
function renderResult(el, { file, exif, cleanUrl }) {
  const device = [exif?.make, exif?.model].filter(Boolean).join(' ') || 'unknown';
  const rows = [
    `<div class="stat-line">FILE: <span class="accent">${escapeHtml(file.name)}</span></div>`,
    `<div class="stat-line">DEVICE: <span class="accent">${escapeHtml(device)}</span></div>`,
    `<div class="stat-line">CAPTURED: <span class="accent">${escapeHtml(exif?.dateTimeOriginal || 'unknown')}</span></div>`,
  ];

  if (exif?.gpsLatitude != null && exif?.gpsLongitude != null) {
    const lat = exif.gpsLatitude;
    const lon = exif.gpsLongitude;
    const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    rows.push(
      `<div class="stat-line alert">GPS: ${lat.toFixed(5)}°, ${lon.toFixed(5)}° — ` +
        `<a class="report-link" href="${osmUrl}" target="_blank" rel="noopener noreferrer">VIEW ON MAP &rarr;</a></div>`,
    );
  } else {
    rows.push('<div class="stat-line">GPS: none detected</div>');
  }

  rows.push(
    `<a class="terminal-btn small purge-btn" href="${cleanUrl}" download="clean_${escapeHtml(file.name)}">PURGE METADATA — DOWNLOAD CLEAN FILE</a>`,
  );
  el.innerHTML = rows.join('');
}

/**
 * @param {File} file
 * @param {HTMLElement} resultEl
 * @returns {Promise<void>}
 */
async function handleFile(file, resultEl) {
  if (!file.type.startsWith('image/')) {
    writeFeed('  [x] Unsupported file type — select an image.');
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    writeFeed('  [x] File too large — 25MB limit.');
    return;
  }

  writeFeed(['[>] MODULE ARMED: TOOL_05 // Metadata Extractor', `[>] ANALYZING FILE: ${file.name}`]);
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<div class="stat-line">Parsing EXIF headers...</div>';

  const buffer = await file.arrayBuffer();
  const exif = parseExif(buffer);

  const lines = [];
  if (exif?.make || exif?.model) {
    lines.push(`[!] EXIF FOUND: ${[exif.make, exif.model].filter(Boolean).join(' // ')}`);
  } else {
    lines.push('[+] No device metadata found in image header.');
  }
  if (exif?.gpsLatitude != null) {
    lines.push(
      `[!] CRITICAL: GPS Coordinates Extracted (${exif.gpsLatitude.toFixed(4)}°, ${exif.gpsLongitude.toFixed(4)}°)`,
    );
  } else {
    lines.push('[+] No GPS coordinates found in image header.');
  }
  lines.push('[+] SANITIZATION READY: [ DOWNLOAD CLEAN FILE ]');
  writeFeed(lines);

  let cleanUrl;
  try {
    cleanUrl = await stripToBlobUrl(file);
  } catch (err) {
    writeFeed(`  [x] Sanitization failed: ${err.message}`);
    return;
  }

  recordMetadata({
    fileName: file.name,
    make: exif?.make || null,
    model: exif?.model || null,
    dateTimeOriginal: exif?.dateTimeOriginal || null,
    gps: exif?.gpsLatitude != null ? { lat: exif.gpsLatitude, lon: exif.gpsLongitude } : null,
  });

  renderResult(resultEl, { file, exif, cleanUrl });
}

/** Wire the drag/drop + click-to-select metadata extractor dropzone. */
export function initMetadataTool() {
  const dropzone = document.getElementById('metadata-dropzone');
  const input = document.getElementById('metadata-file-input');
  const resultEl = document.getElementById('metadata-result');
  if (!dropzone || !input || !resultEl) return;

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, resultEl);
  });
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) handleFile(file, resultEl);
    input.value = '';
  });
}
