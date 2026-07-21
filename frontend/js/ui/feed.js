/**
 * Append one or more lines to the console output feed, auto-scrolling to the
 * newest entry. Line class is inferred from a lightweight prefix convention.
 * @param {string|string[]} lines
 * @returns {void}
 */
export function writeFeed(lines) {
  const feed = document.getElementById('log-feed');
  if (!feed) return;

  const arr = Array.isArray(lines) ? lines : [lines];
  for (const line of arr) {
    const div = document.createElement('div');
    div.className = 'feed-line';

    if (line.startsWith('  ->')) div.classList.add('accent');
    else if (line.startsWith('  [x]') || line.includes('CRITICAL') || line.includes('LEAK'))
      div.classList.add('alert');
    else if (line.startsWith('[!]') || line.startsWith('SYSTEM:')) div.classList.add('system');

    div.textContent = line;
    feed.appendChild(div);
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
