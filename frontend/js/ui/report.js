import { buildReport } from '../state/auditProfile.js';
import { escapeHtml } from '../utils/dom.js';

/**
 * @param {string} severity
 * @returns {string} CSS class for severity-tinted text
 */
function severityClass(severity) {
  if (severity === 'critical') return 'alert';
  if (severity === 'moderate') return 'accent';
  return '';
}

/**
 * @param {number} score
 * @returns {string}
 */
function scoreSeverity(score) {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'moderate';
  return 'info';
}

function renderReport() {
  const body = document.getElementById('report-body');
  if (!body) return;
  const report = buildReport();

  const findingsHtml = report.findings.length
    ? report.findings
        .map(
          (f) => `
        <div class="report-finding ${severityClass(f.severity)}">
          <span class="finding-cat">[ ${escapeHtml(f.category)} ]</span> ${escapeHtml(f.detail)}
        </div>`,
        )
        .join('')
    : '<div class="stat-line">No findings recorded yet — run recon modules to populate this report.</div>';

  const remediationHtml = report.remediation
    .map(
      (r) => `
      <li>${escapeHtml(r.text)}${
        r.href ? ` — <a class="report-link" href="${escapeHtml(r.href)}" target="_blank" rel="noopener noreferrer">RESOURCE &rarr;</a>` : ''
      }</li>`,
    )
    .join('');

  body.innerHTML = `
    <div class="report-risk">
      RISK SCORE: <span class="risk-value ${severityClass(scoreSeverity(report.score))}">${report.score}/100 — ${report.label}</span>
    </div>
    <div class="stat-line">TARGET: <span class="accent">${escapeHtml(report.target || 'UNSPECIFIED')}</span></div>
    <div class="report-section-header">CATEGORIZED FINDINGS</div>
    <div class="report-findings">${findingsHtml}</div>
    <div class="report-section-header">REMEDIATION CHECKLIST</div>
    <ul class="remediation-list">${remediationHtml}</ul>
  `;
}

/** Wire the "GENERATE AUDIT REPORT" button and the report overlay's close controls. */
export function initReportPanel() {
  const openBtn = document.getElementById('btn-generate-report');
  const overlay = document.getElementById('report-overlay');
  const closeBtn = document.getElementById('btn-close-report');
  if (!openBtn || !overlay) return;

  openBtn.addEventListener('click', () => {
    renderReport();
    overlay.classList.remove('hidden');
  });
  closeBtn?.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) overlay.classList.add('hidden');
  });
}
