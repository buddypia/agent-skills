/* ============================================================================
   contrast.mjs - WCAG 2.x relative-luminance contrast helpers (no deps).

   Source of the algorithm: WCAG 2.1 §1.4.3 / §1.4.11.
   - sRGB 8-bit channel -> linearized -> relative luminance L
   - contrast ratio = (Lhi + 0.05) / (Llo + 0.05)  ∈ [1, 21]
   AA thresholds: normal text 4.5:1 · large text (>=18.66px bold / 24px) 3:1 ·
   non-text UI component / graphical object 3:1 (§1.4.11).

   Used by tools/contrast-audit.mjs (audits all themes in themes.css) and by
   tools/validate.mjs (warns on the active theme of a built artifact). It only
   resolves plain hex and single/multi-level var() chains - color-mix() and
   other computed values are skipped (reported as "unresolved", never failed).
   ============================================================================ */

export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function linearize(c8) {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors, or null if either is unparseable. */
export function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  if (!a || !b) return null;
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Parse a CSS string into a map of { themeName: { '--var': 'rawValue' } }.
 * Recognizes `:root,[data-theme="birchline"] { … }` and `[data-theme="X"] { … }`
 * blocks (the themes.css shape). The `:root` defaults are merged under the key
 * `_root` so themes can inherit unset tokens.
 */
export function parseThemeBlocks(css) {
  css = String(css).replace(/\/\*[\s\S]*?\*\//g, ''); // strip CSS comments (their colons would break the ; split)
  const blocks = {};
  const rootMatch = css.match(/:root\s*,?\s*\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\}/);
  const declMap = (body) => {
    const m = {};
    for (const d of body.split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const k = d.slice(0, i).trim();
      const v = d.slice(i + 1).trim();
      if (k.startsWith('--')) m[k] = v;
    }
    return m;
  };
  // every [data-theme="X"] { ... } block (birchline is also captured this way)
  const re = /\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\}/g;
  let mm;
  while ((mm = re.exec(css))) blocks[mm[1]] = declMap(mm[2]);
  if (rootMatch) blocks._root = { ...declMap(rootMatch[2]), ...(blocks[rootMatch[1]] || {}) };
  return blocks;
}

/** Resolve a CSS var value (possibly `var(--x)` chains) to a hex string, or null. */
export function resolveVar(value, map, rootMap, seen = new Set()) {
  if (value == null) return null;
  let v = String(value).trim();
  const varM = v.match(/^var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)$/);
  if (varM) {
    const ref = varM[1];
    if (seen.has(ref)) return null;
    seen.add(ref);
    const next = (map[ref] !== undefined ? map[ref] : (rootMap ? rootMap[ref] : undefined));
    if (next === undefined) return varM[2] != null ? resolveVar(varM[2].trim(), map, rootMap, seen) : null;
    return resolveVar(next, map, rootMap, seen);
  }
  if (/^#[0-9a-fA-F]{3,6}\b/.test(v)) return v.match(/^#[0-9a-fA-F]{3,6}/)[0];
  return null; // color-mix(), rgb(), keywords, etc. - intentionally unresolved
}

/** The semantic token pairs we audit, with the WCAG context that sets the bar. */
export const AUDIT_PAIRS = [
  { fg: '--text-primary', bg: '--bg-page', ctx: 'normal', label: 'body text on page' },
  { fg: '--text-primary', bg: '--bg-surface', ctx: 'normal', label: 'body text on surface' },
  { fg: '--text-secondary', bg: '--bg-surface', ctx: 'normal', label: 'secondary text on surface' },
  { fg: '--text-muted', bg: '--bg-surface', ctx: 'normal', label: 'muted/caption on surface' },
  { fg: '--on-accent', bg: '--accent', ctx: 'normal', label: 'label on accent (button)' },
  { fg: '--accent', bg: '--bg-page', ctx: 'ui', label: 'accent as link/icon/UI on page' },
];

export const THRESHOLD = { normal: 4.5, large: 3.0, ui: 3.0 };

/** Resolve + score one theme's audited pairs. Returns [{...pair, fg/bgHex, ratio, min, pass}]. */
export function auditTheme(themeMap, rootMap) {
  return AUDIT_PAIRS.map((p) => {
    const fgHex = resolveVar(themeMap[p.fg] ?? (rootMap && rootMap[p.fg]), themeMap, rootMap);
    const bgHex = resolveVar(themeMap[p.bg] ?? (rootMap && rootMap[p.bg]), themeMap, rootMap);
    const ratio = (fgHex && bgHex) ? contrastRatio(fgHex, bgHex) : null;
    const min = THRESHOLD[p.ctx];
    return { ...p, fgHex, bgHex, ratio, min, pass: ratio == null ? null : ratio >= min };
  });
}
