/**
 * Runtime config injected at build time for GitHub Pages (see scripts/prepare-pages.mjs).
 * Local / Express hosting leaves this unset → live API mode.
 * @returns {{ staticDemo: boolean, basePath: string }}
 */
export function getRuntimeConfig() {
  const cfg = typeof window !== 'undefined' ? window.__GHOSTWIRE__ : null;
  return {
    staticDemo: Boolean(cfg?.staticDemo),
    basePath: typeof cfg?.basePath === 'string' ? cfg.basePath : '/',
  };
}
