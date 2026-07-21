/**
 * Visual metadata for the brutalist recon tool cards.
 * Maps connector ids → cutout art, background typography, and copy.
 * Assets live in /assets/tools/ (sourced from Example/).
 */
export const TOOL_VISUALS = {
  mspect: {
    toolId: 'TOOL_01',
    bgText: 'RECON',
    title: 'Domain Recon',
    desc: 'Footprint DNS / IP infrastructure via live DoH resolution.',
    image: 'assets/tools/tool1.png',
    alt: 'Gold crown guardian — domain recon',
  },
  v0id: {
    toolId: 'TOOL_02',
    bgText: 'OBSCURE',
    title: 'Breach Scanner',
    desc: 'Assess credential exposure against known breach corpora.',
    image: 'assets/tools/tool2.png',
    alt: 'Blindfolded silver crown — breach checker',
  },
  grimnir: {
    toolId: 'TOOL_03',
    bgText: 'ALIAS',
    title: 'Alias Tracker',
    desc: 'Enumerate public social / developer profiles for a handle.',
    image: 'assets/tools/tool3.png',
    alt: 'Venetian mask — social footprint',
  },
  wiretap: {
    toolId: 'TOOL_04',
    bgText: 'LEAK',
    title: 'Leak Sniffer',
    desc: 'Probe cloud-bucket namespaces for open signal leakage.',
    image: 'assets/tools/tool4.png',
    alt: 'Inked halo — deep scan / leakage',
  },
};

/**
 * Resolve visuals for a module, with a safe fallback.
 * @param {string} moduleId
 * @returns {typeof TOOL_VISUALS[keyof typeof TOOL_VISUALS]}
 */
export function visualsFor(moduleId) {
  return (
    TOOL_VISUALS[moduleId] || {
      toolId: 'TOOL_??',
      bgText: 'SCAN',
      title: moduleId,
      desc: 'Recon module.',
      image: 'assets/tools/tool4.png',
      alt: moduleId,
    }
  );
}
