import { escapeHtml } from '../utils/dom.js';

/** Turn URLs in an already-escaped line into safe, clickable links. */
function linkify(text) {
  return escapeHtml(text).replace(/https?:\/\/[^\s<]+/g, (u) => `<a class="report-link" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}

/**
 * Type a single line into `el` character by character, auto-scrolling `feed`
 * as it grows.
 * @param {HTMLElement} el
 * @param {string} text
 * @param {HTMLElement} feed
 * @returns {void}
 */
function typeFeedLine(el, text, feed) {
  let i = 0;
  const step = () => {
    el.textContent = text.slice(0, i);
    feed.scrollTop = feed.scrollHeight;
    i++;
    if (i <= text.length) setTimeout(step, 10);
    else if (text.includes('http')) el.innerHTML = linkify(text);
  };
  step();
}

/**
 * Append one or more lines to the console output feed, typing each one in
 * and auto-scrolling to the newest entry. Line class is inferred from a
 * lightweight prefix convention.
 * @param {string|string[]} lines
 * @returns {void}
 */
export function writeFeed(lines) {
  const feed = document.getElementById('log-feed');
  if (!feed) return;

  const reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const arr = Array.isArray(lines) ? lines : [lines];
  for (const line of arr) {
    const div = document.createElement('div');
    div.className = 'feed-line';

    if (line.startsWith('  ->')) div.classList.add('accent');
    else if (line.startsWith('  [x]') || line.includes('CRITICAL') || line.includes('LEAK'))
      div.classList.add('alert');
    else if (line.startsWith('[!]') || line.startsWith('SYSTEM:')) div.classList.add('system');

    feed.appendChild(div);
    if (reduced) {
      div.textContent = line;
      if (line.includes('http')) div.innerHTML = linkify(line);
    }
    else typeFeedLine(div, line, feed);
  }
  feed.scrollTop = feed.scrollHeight;
}

/**
 * Clear all lines from the feed.
 * @returns {void}
 */
export function clearFeed() {
  const feed = document.getElementById('log-feed');
  if (feed) feed.innerHTML = '';
}
