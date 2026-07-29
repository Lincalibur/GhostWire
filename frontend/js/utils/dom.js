/**
 * Escape a string for safe interpolation into innerHTML.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}
