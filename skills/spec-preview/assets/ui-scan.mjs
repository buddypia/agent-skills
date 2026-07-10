#!/usr/bin/env node
/* =======================================================================
 * ui-scan.mjs — spec-preview の UI キャッシュスキャナ（依存ゼロ / Node >= 18）
 *
 * 対象プロジェクトの UI 資産（デザイントークン・コンポーネント・UI 文字列 SSOT・
 * デザイン文書）を決定論的にスキャンし、`.tmp/spec-preview/ui-cache/ui-cache.json`
 * に書き出す。AI はこの draft を読んで意味づけ（primary 色の指定・skin.css 生成・
 * lang/target の確定）を行う。運用手順の正本は references/ui-cache.md。
 *
 * v2: フレームワーク横断のトークン抽出。
 *   - Web CSS / SCSS   … `:root` / `@theme` の CSS 変数, `$scss-vars`
 *   - Tailwind config  … theme.colors 系の色リテラル
 *   - JS/TS theme      … theme.ts / colors.ts / tokens.ts のネスト色オブジェクト
 *   - Flutter (Dart)   … Color(0xAARRGGBB) 定数 / ColorScheme 名前付き引数 / fontFamily
 *   - Android          … res/values/colors.xml
 *   - iOS              … *.colorset/Contents.json
 * 抽出結果は tokens.cssVars（CSS 変数）と tokens.colors（名前→色。CSS 以外由来）へ。
 *
 * 使い方:
 *   node ui-scan.mjs scan  [--project <dir>]   # draft manifest を生成/更新
 *   node ui-scan.mjs check [--project <dir>]   # 鮮度判定 (exit 0=fresh / 1=stale / 2=なし)
 *
 * scan は既存 manifest の AI 確定フィールド（confirmed / aiNotes / skin / lang /
 * 確定済み targetSurface / project.name）を保存したままソース由来フィールドだけ更新する。
 * ===================================================================== */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const MANIFEST_VERSION = 2;
const CACHE_REL = ".tmp/spec-preview/ui-cache";
const MAX_HASH_BYTES = 1024 * 1024;
const MAX_EXTRACT_BYTES = 512 * 1024;
const MAX_COLORS_TOTAL = 500;
const COMPONENT_EXTS = new Set([".tsx", ".jsx", ".vue", ".svelte", ".dart"]);
const COMPONENT_DIR_CANDIDATES = [
  "src/shared/components",
  "src/components",
  "src/ui",
  "src/lib/components",
  "app/components",
  "components",
  "lib/widgets",
  "lib/ui",
];
const CSS_CANDIDATES = [
  "src/app/globals.css",
  "app/globals.css",
  "src/globals.css",
  "src/index.css",
  "src/styles/globals.css",
  "src/styles/main.css",
  "styles/globals.css",
  "src/App.css",
];
const TAILWIND_CONFIGS = [
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
];
const STRING_SSOT_CANDIDATES = [
  "src/shared/constants/messages.ts",
  "src/constants/messages.ts",
  "src/messages.ts",
  "src/i18n",
  "src/locales",
  "i18n",
  "locales",
  "lib/l10n",
];
const GUIDANCE_DOCS = ["CLAUDE.md", "AGENTS.md", "README.md"];
const DESIGN_DOC_CANDIDATES = [
  "docs/design/DESIGN.md",
  "docs/design",
  "docs/DESIGN.md",
  "DESIGN.md",
];

/* ---- フレームワーク横断のトークンファイル発見（walk は 1 回・決定論的） ---- */
const SKIP_DIRS = new Set([
  "node_modules",
  "build",
  "dist",
  "out",
  "target",
  "coverage",
  "vendor",
  "Pods",
  "DerivedData",
  "__pycache__",
  // テスト資産はデザイントークンではない（test/golden の fixture 混入防止）
  "test",
  "tests",
  "__tests__",
  "integration_test",
  "e2e",
]);
const DISCOVER_DEPTH = 8; // monorepo（packages/*/android/... 等）にも届く深さ。SKIP_DIRS が探索量を抑える
const CSS_TOKEN_BASENAME = /^(globals?|tokens?|variables|vars|themes?|app|main|index)\.(css|scss)$/i;
const JS_TOKEN_BASENAME = /^(themes?|tokens|design-?tokens|colors?|colours?|palette)\.(ts|tsx|js|jsx|mjs)$/i;
const DART_TOKEN_BASENAME = /^(app_)?(themes?|colors?|tokens|palette|styles?)\.dart$/i;
const TOKEN_DIR_NAME = /^(themes?|tokens|design-?system|design|styles?)$/i;
const COMPONENT_DIR_NAME = /^(widgets|components)$/i;
const MAX_DISCOVERED_PER_KIND = 12;
const MAX_DISCOVERED_COMPONENT_DIRS = 6;

function parseArgs(argv) {
  const args = { command: argv[2], project: process.cwd() };
  for (let i = 3; i < argv.length; i += 1) {
    if (argv[i] === "--project" && argv[i + 1]) {
      args.project = resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function sha256File(absPath) {
  const buf = readFileSync(absPath);
  const slice = buf.byteLength > MAX_HASH_BYTES ? buf.subarray(0, MAX_HASH_BYTES) : buf;
  return createHash("sha256").update(slice).digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function readTextCapped(absPath) {
  const buf = readFileSync(absPath);
  const slice = buf.byteLength > MAX_EXTRACT_BYTES ? buf.subarray(0, MAX_EXTRACT_BYTES) : buf;
  return slice.toString("utf8");
}

/** ディレクトリ配下の相対ファイル名リスト（depth 制限つき・決定論的ソート） */
function listFilesRec(absDir, depth = 3, prefix = "") {
  if (depth < 0) return [];
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...listFilesRec(join(absDir, entry.name), depth - 1, rel));
    } else {
      out.push(rel);
    }
  }
  return out.sort();
}

/**
 * プロジェクト全体を 1 回 walk して、フレームワーク横断のトークン候補ファイルを集める。
 * scan と check の両方から呼ばれるため決定論的（sorted / capped）であること。
 */
function discoverTokenFiles(projectDir) {
  const found = { css: [], js: [], dart: [], androidXml: [], colorsets: [], componentDirs: [] };
  const walk = (absDir, depth, prefix) => {
    if (depth < 0) return;
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".colorset")) {
          const contents = join(absDir, entry.name, "Contents.json");
          if (existsSync(contents)) found.colorsets.push(`${rel}/Contents.json`);
          continue;
        }
        if (COMPONENT_DIR_NAME.test(entry.name)) found.componentDirs.push(rel);
        walk(join(absDir, entry.name), depth - 1, rel);
        continue;
      }
      const name = entry.name;
      const parentDir = basename(absDir);
      if (CSS_TOKEN_BASENAME.test(name)) found.css.push(rel);
      else if (
        JS_TOKEN_BASENAME.test(name) ||
        (/^index\.(ts|tsx|js|mjs)$/i.test(name) && TOKEN_DIR_NAME.test(parentDir))
      )
        found.js.push(rel);
      else if (
        DART_TOKEN_BASENAME.test(name) ||
        (name.endsWith(".dart") && TOKEN_DIR_NAME.test(parentDir))
      )
        found.dart.push(rel);
      else if (name === "colors.xml" && /(^|\/)values(-[\w]+)?$/.test(prefix || ""))
        found.androidXml.push(rel);
    }
  };
  walk(projectDir, DISCOVER_DEPTH, "");
  // 色/テーマ系の名前を優先して cap（app_motion.dart 等に枠を食われないように）
  const priorityOf = (rel) => {
    const b = basename(rel).toLowerCase();
    if (b.includes("color") || b.includes("palette")) return 0;
    if (b.includes("theme") || b.includes("token")) return 1;
    return 2;
  };
  for (const key of ["css", "js", "dart", "androidXml", "colorsets"]) {
    found[key] = found[key]
      .sort((a, b) => priorityOf(a) - priorityOf(b) || a.localeCompare(b))
      .slice(0, MAX_DISCOVERED_PER_KIND);
  }
  // 専用テーマファイルがない最小構成（lib/main.dart にインライン ThemeData）への fallback
  if (found.dart.length === 0 && existsSync(join(projectDir, "pubspec.yaml"))) {
    found.dart = ["lib/main.dart", "lib/app.dart"].filter((rel) =>
      existsSync(join(projectDir, rel)),
    );
  }
  // コンポーネントディレクトリは浅い（中心的な）ものを優先
  found.componentDirs = found.componentDirs
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
    .slice(0, MAX_DISCOVERED_COMPONENT_DIRS);
  return found;
}

function discoveryHash(found) {
  return sha256Text(
    ["css", "js", "dart", "androidXml", "colorsets", "componentDirs"]
      .map((k) => `${k}:${found[k].join(",")}`)
      .join("\n"),
  );
}

/** CSS のブロックコメントを除去（引用文字列内は保護。行コメントは CSS に無いので触らない） */
function stripCssComments(text) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      out += " ";
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** JS/TS/Dart の行コメントとブロックコメントを除去（' " ` の文字列内は保護 — URL のスラッシュを殺さない） */
function stripCodeComments(text) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      out += " ";
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** brace counting で `opener { ... }` ブロック本文を全て取り出す（@theme / :root 用）。
 * 引用文字列内の `{` `}` は数えない。コメントは呼び出し側で除去済みであること。 */
function extractBlocks(cssText, openerRegex) {
  const blocks = [];
  const regex = new RegExp(openerRegex.source, "g");
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    let i = cssText.indexOf("{", match.index);
    if (i === -1) break;
    let depth = 0;
    const start = i + 1;
    let quote = null;
    for (; i < cssText.length; i += 1) {
      const ch = cssText[i];
      if (quote) {
        if (ch === "\\") {
          i += 1;
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(cssText.slice(start, i));
          break;
        }
      }
    }
  }
  return blocks;
}

/** CSS 変数宣言 `--name: value;` を { name: value } に抽出 */
function extractCssVars(blockText) {
  const vars = {};
  const regex = /--([A-Za-z0-9-_]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(blockText)) !== null) {
    vars[`--${match[1]}`] = match[2].trim().replace(/\s+/g, " ");
  }
  return vars;
}

/** SCSS 変数 `$name: value;`（色値のみ採用） */
function extractScssVars(text) {
  const vars = {};
  const regex = /\$([\w-]+)\s*:\s*(#[0-9A-Fa-f]{3,8}|rgba?\([^;)]*\)|hsla?\([^;)]*\))\s*(?:!default)?\s*;/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    vars[`$${match[1]}`] = match[2].trim();
  }
  return vars;
}

function extractFontFamilies(cssText) {
  const fonts = new Set();
  const regex = /font-family\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    fonts.add(match[1].trim().replace(/\s+/g, " "));
  }
  return [...fonts];
}

/* ---- フレームワーク別の色抽出 ---- */

/** Dart/Android の 0xAARRGGBB / #AARRGGBB を CSS 色へ正規化 */
function normalizeArgb(hex8) {
  const aa = hex8.slice(0, 2).toLowerCase();
  const rgb = hex8.slice(2).toLowerCase();
  if (aa === "ff") return `#${rgb}`;
  const alpha = Math.round((parseInt(aa, 16) / 255) * 100) / 100;
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * JS/TS theme オブジェクトから ネストキーのパス付きで色リテラルを抽出。
 * 例 `{ colors: { primary: '#6750a4' } }` → { "colors.primary": "#6750a4" }
 * Tailwind config の theme.colors / RN の StyleSheet 用 theme にも効く。
 * 網羅は狙わない draft 用（コメント内の誤検出は AI 確定で捨てる）。
 */
function extractJsColors(text) {
  const colors = {};
  const regex =
    /(["']?)([A-Za-z_$][\w$-]*)\1\s*:|\{|\}|(["'])(#(?:[0-9A-Fa-f]{3,8})|rgba?\([^)'"]*\)|hsla?\([^)'"]*\))\3/g;
  const stack = [];
  let pendingKey = null;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[2] !== undefined) {
      pendingKey = match[2];
      continue;
    }
    if (match[0] === "{") {
      stack.push(pendingKey || "");
      pendingKey = null;
      continue;
    }
    if (match[0] === "}") {
      stack.pop();
      pendingKey = null;
      continue;
    }
    if (match[4]) {
      const path = [...stack.filter(Boolean), pendingKey].filter(Boolean).join(".");
      if (path && colors[path] === undefined) colors[path] = match[4];
      pendingKey = null;
    }
  }
  return colors;
}

function extractJsFonts(text) {
  const fonts = new Set();
  const regex = /fontFamily\s*:\s*(["'])([^"']+)\1/g;
  let match;
  while ((match = regex.exec(text)) !== null) fonts.add(match[2]);
  return [...fonts];
}

/** Material 標準スウォッチ（500 番）。`seedColor: Colors.deepPurple` 等の解決用 */
const MATERIAL_COLORS = {
  red: "#f44336",
  pink: "#e91e63",
  purple: "#9c27b0",
  deepPurple: "#673ab7",
  indigo: "#3f51b5",
  blue: "#2196f3",
  lightBlue: "#03a9f4",
  cyan: "#00bcd4",
  teal: "#009688",
  green: "#4caf50",
  lightGreen: "#8bc34a",
  lime: "#cddc39",
  yellow: "#ffeb3b",
  amber: "#ffc107",
  orange: "#ff9800",
  deepOrange: "#ff5722",
  brown: "#795548",
  grey: "#9e9e9e",
  blueGrey: "#607d8b",
  black: "#000000",
  white: "#ffffff",
};

/**
 * Flutter (Dart) の色定義を抽出。
 *   static const Color primary = Color(0xFF6750A4);  → { primary: "#6750a4" }
 *   ColorScheme(primary: Color(0xFF6750A4), ...)     → 名前付き引数も同様
 *   seedColor: Colors.deepPurple                      → Material 500 番で解決
 *   fontFamily: 'Pretendard'                          → fonts
 * Colors.x.shade300 等の shade 指定は解決できないため対象外（aiNotes で補完）。
 */
function extractDartTokens(text) {
  const colors = {};
  const fonts = new Set();
  const declRegex =
    /(?:const|final|static)[\w<>\s]*?\b([A-Za-z_$][\w$]*)\s*=\s*(?:const\s+)?Color\(\s*0x([0-9A-Fa-f]{8})\s*\)/g;
  const namedArgRegex = /\b([a-zA-Z][\w]*)\s*:\s*(?:const\s+)?Color\(\s*0x([0-9A-Fa-f]{8})\s*\)/g;
  const materialRegex = /\b([a-zA-Z][\w]*)\s*[:=]\s*Colors\.(\w+)\b(?!\s*\.)/g;
  let match;
  while ((match = declRegex.exec(text)) !== null) {
    if (colors[match[1]] === undefined) colors[match[1]] = normalizeArgb(match[2]);
  }
  while ((match = namedArgRegex.exec(text)) !== null) {
    if (colors[match[1]] === undefined) colors[match[1]] = normalizeArgb(match[2]);
  }
  while ((match = materialRegex.exec(text)) !== null) {
    const resolved = MATERIAL_COLORS[match[2]];
    if (resolved && colors[match[1]] === undefined) colors[match[1]] = resolved;
  }
  const fontRegex = /fontFamily\s*:\s*(["'])([^"']+)\1/g;
  while ((match = fontRegex.exec(text)) !== null) fonts.add(match[2]);
  return { colors, fonts: [...fonts] };
}

/** Android res/values/colors.xml の <color name="x">#AARRGGBB</color> */
function extractAndroidColors(xmlText) {
  const colors = {};
  const regex = /<color\s+name="([^"]+)"\s*>\s*(#[0-9A-Fa-f]{3,8})\s*<\/color>/g;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    const hex = match[2].slice(1);
    colors[match[1]] =
      hex.length === 8 ? normalizeArgb(hex) : `#${hex.toLowerCase()}`;
  }
  return colors;
}

/** iOS *.colorset/Contents.json（sRGB components → CSS 色） */
function extractColorset(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    const entry = (data.colors || []).find((c) => c?.color?.components);
    if (!entry) return null;
    const comp = entry.color.components;
    const toByte = (v) => {
      const s = String(v);
      if (s.startsWith("0x")) return parseInt(s, 16);
      const n = parseFloat(s);
      return n <= 1 ? Math.round(n * 255) : Math.round(n);
    };
    const r = toByte(comp.red);
    const g = toByte(comp.green);
    const b = toByte(comp.blue);
    const a = comp.alpha !== undefined ? parseFloat(comp.alpha) : 1;
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    const hex = (v) => v.toString(16).padStart(2, "0");
    return a >= 1
      ? `#${hex(r)}${hex(g)}${hex(b)}`
      : `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
  } catch {
    return null;
  }
}

function detectNative(projectDir) {
  let rootEntries = [];
  try {
    rootEntries = readdirSync(projectDir);
  } catch {
    /* noop */
  }
  if (rootEntries.some((n) => n.endsWith(".xcodeproj") || n.endsWith(".xcworkspace")))
    return { framework: "ios", targetSurface: "mobile-app" };
  if (
    existsSync(join(projectDir, "settings.gradle")) ||
    existsSync(join(projectDir, "settings.gradle.kts")) ||
    existsSync(join(projectDir, "app/build.gradle"))
  )
    return { framework: "android", targetSurface: "mobile-app" };
  return null;
}

function detectFramework(projectDir) {
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(join(projectDir, "pubspec.yaml"))) {
    return { framework: "flutter", targetSurface: "mobile-app" };
  }
  if (!existsSync(pkgPath)) {
    return detectNative(projectDir) || { framework: "unknown", targetSurface: "web-app" };
  }
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    return { framework: "unknown", targetSurface: "web-app" };
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const has = (name) => Object.prototype.hasOwnProperty.call(deps, name);
  if (has("react-native") || has("expo")) return { framework: "react-native", targetSurface: "mobile-app" };
  if (has("electron")) return { framework: "electron", targetSurface: "desktop-app" };
  if (has("@tauri-apps/api") || existsSync(join(projectDir, "src-tauri")))
    return { framework: "tauri", targetSurface: "desktop-app" };
  if (has("next")) return { framework: "next", targetSurface: "web-app" };
  if (has("nuxt")) return { framework: "nuxt", targetSurface: "web-app" };
  if (has("@sveltejs/kit") || has("svelte")) return { framework: "svelte", targetSurface: "web-app" };
  if (has("vue")) return { framework: "vue", targetSurface: "web-app" };
  if (has("react-dom")) return { framework: "react", targetSurface: "web-app" };
  return detectNative(projectDir) || { framework: "unknown", targetSurface: "web-app" };
}

/** cva()/variants ブロックから variant 名を軽量抽出（網羅は狙わない。draft 用） */
const PSEUDO_STATE_KEYS = new Set([
  "hover",
  "active",
  "focus",
  "disabled",
  "visited",
  "checked",
  "defaultVariants",
]);
function extractVariants(sourceText) {
  const variants = {};
  const blockMatch = sourceText.match(/variants\s*:\s*\{([\s\S]{0,2000})/);
  if (!blockMatch) return variants;
  const groupRegex = /(\w+)\s*:\s*\{([^{}]*)\}/g;
  let group;
  while ((group = groupRegex.exec(blockMatch[1])) !== null) {
    if (PSEUDO_STATE_KEYS.has(group[1])) continue;
    const names = [
      ...new Set(
        [...group[2].matchAll(/(\w[\w-]*)\s*:/g)]
          .map((m) => m[1])
          .filter((n) => !PSEUDO_STATE_KEYS.has(n)),
      ),
    ];
    if (names.length > 0) variants[group[1]] = names;
  }
  return variants;
}

function scanComponents(projectDir, extraDirs = []) {
  const components = [];
  const scannedDirs = [];
  const covered = (dir) =>
    scannedDirs.some((d) => dir === d || dir.startsWith(`${d}/`));
  for (const candidate of [...COMPONENT_DIR_CANDIDATES, ...extraDirs]) {
    if (covered(candidate)) continue;
    const absDir = join(projectDir, candidate);
    let stat;
    try {
      stat = statSync(absDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    scannedDirs.push(candidate);
    for (const relFile of listFilesRec(absDir)) {
      const ext = relFile.slice(relFile.lastIndexOf("."));
      if (!COMPONENT_EXTS.has(ext)) continue;
      const absFile = join(absDir, relFile);
      const entry = {
        name: relFile.replace(/\.[^.]+$/, "").split("/").pop(),
        path: relative(projectDir, absFile),
        group: relFile.includes("/") ? relFile.split("/")[0] : "",
      };
      try {
        const variants = extractVariants(readFileSync(absFile, "utf8"));
        if (Object.keys(variants).length > 0) entry.variants = variants;
      } catch {
        /* 読めないファイルは名前だけ記録 */
      }
      components.push(entry);
    }
  }
  return { components, scannedDirs };
}

function firstExisting(projectDir, candidates) {
  return candidates.filter((rel) => existsSync(join(projectDir, rel)));
}

/** ディレクトリの内容署名（ファイル名 + 各ファイルの内容ハッシュ）。
 * ファイル名一覧だけだと既存ファイルの中身編集（variant 追加等）が
 * check で fresh のまま素通りするため、内容まで含める。 */
function hashDir(absDir) {
  const parts = listFilesRec(absDir).map((rel) => {
    try {
      return `${rel}:${sha256File(join(absDir, rel))}`;
    } catch {
      return `${rel}:?`;
    }
  });
  return sha256Text(parts.join("\n"));
}

function buildSources(projectDir, paths) {
  const sources = [];
  for (const rel of [...new Set(paths)].sort()) {
    const abs = join(projectDir, rel);
    if (!existsSync(abs)) continue;
    try {
      if (statSync(abs).isDirectory()) {
        sources.push({ path: rel, type: "dirlist", hash: hashDir(abs) });
      } else {
        sources.push({ path: rel, type: "file", hash: sha256File(abs) });
      }
    } catch {
      /* 消えたファイルは記録しない */
    }
  }
  return sources;
}

/** colors マップへ上限つきで統合（先勝ち・決定論的） */
function mergeColors(target, incoming, prefix = "") {
  for (const [key, value] of Object.entries(incoming)) {
    if (Object.keys(target).length >= MAX_COLORS_TOTAL) return;
    const name = prefix ? `${prefix}.${key}` : key;
    if (target[name] === undefined) target[name] = value;
  }
}

function scan(projectDir) {
  const cacheDir = join(projectDir, CACHE_REL);
  const manifestPath = join(cacheDir, "ui-cache.json");
  let previous = null;
  if (existsSync(manifestPath)) {
    try {
      previous = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      previous = null;
    }
  }

  const { framework, targetSurface } = detectFramework(projectDir);
  const discovered = discoverTokenFiles(projectDir);

  /* --- Web CSS / SCSS（固定候補 + 発見分をマージ） --- */
  const cssFiles = [
    ...new Set([...firstExisting(projectDir, CSS_CANDIDATES), ...discovered.css]),
  ].sort();
  const tailwindConfigs = firstExisting(projectDir, TAILWIND_CONFIGS);
  const cssVars = {};
  const colors = {};
  const fonts = new Set();
  for (const rel of cssFiles) {
    let text;
    try {
      text = stripCssComments(readTextCapped(join(projectDir, rel)));
    } catch {
      continue;
    }
    // SCSS の // 行コメント（コメントアウトされた $var 宣言の誤検出防止。
    // url(http://…) を保護するため行頭のものだけ除去する）
    if (rel.endsWith(".scss")) text = text.replace(/^\s*\/\/.*$/gm, "");
    for (const block of [
      ...extractBlocks(text, /@theme[^{]*/),
      ...extractBlocks(text, /:root[^{]*/),
    ]) {
      Object.assign(cssVars, extractCssVars(block));
    }
    if (rel.endsWith(".scss")) mergeColors(colors, extractScssVars(text));
    for (const font of extractFontFamilies(text)) fonts.add(font);
  }

  /* --- Tailwind config + JS/TS theme ファイル --- */
  for (const rel of [...tailwindConfigs, ...discovered.js]) {
    let text;
    try {
      text = stripCodeComments(readTextCapped(join(projectDir, rel)));
    } catch {
      continue;
    }
    mergeColors(colors, extractJsColors(text));
    Object.assign(cssVars, extractCssVars(text)); // CSS-in-JS の --var 定義も拾う
    for (const font of extractJsFonts(text)) fonts.add(font);
  }

  /* --- Flutter (Dart) --- */
  for (const rel of discovered.dart) {
    let text;
    try {
      text = stripCodeComments(readTextCapped(join(projectDir, rel)));
    } catch {
      continue;
    }
    const dart = extractDartTokens(text);
    mergeColors(colors, dart.colors);
    for (const font of dart.fonts) fonts.add(font);
  }

  /* --- Android colors.xml --- */
  for (const rel of discovered.androidXml) {
    try {
      mergeColors(colors, extractAndroidColors(readTextCapped(join(projectDir, rel))));
    } catch {
      /* noop */
    }
  }

  /* --- iOS *.colorset --- */
  for (const rel of discovered.colorsets) {
    try {
      const name = rel.split("/").slice(-2, -1)[0].replace(/\.colorset$/, "");
      const value = extractColorset(readTextCapped(join(projectDir, rel)));
      if (value) mergeColors(colors, { [name]: value });
    } catch {
      /* noop */
    }
  }

  const { components, scannedDirs } = scanComponents(projectDir, discovered.componentDirs);
  const stringSources = firstExisting(projectDir, STRING_SSOT_CANDIDATES);
  const designDocs = firstExisting(projectDir, DESIGN_DOC_CANDIDATES);
  const guidanceDocs = firstExisting(projectDir, GUIDANCE_DOCS);

  const tokenSources = [
    ...cssFiles,
    ...tailwindConfigs,
    ...discovered.js,
    ...discovered.dart,
    ...discovered.androidXml,
    ...discovered.colorsets,
  ];
  const sources = buildSources(projectDir, [
    "package.json",
    "pubspec.yaml",
    ...tokenSources,
    ...stringSources,
    ...designDocs,
    ...scannedDirs,
  ]);
  // トークンファイルの追加/削除を検知する合成ソース（check が discovery を再実行して照合）
  sources.push({ path: "::token-discovery", type: "discovery", hash: discoveryHash(discovered) });

  const manifest = {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    project: {
      name: previous?.project?.name || projectDir.split("/").pop(),
      root: projectDir,
      framework,
      // AI が確定した値があれば尊重する（scan は推定で上書きしない）
      targetSurface:
        (previous?.confirmed && previous?.project?.targetSurface) || targetSurface,
      lang: previous?.project?.lang || "auto",
    },
    tokens: {
      cssVars,
      colors,
      fonts: [...fonts],
      sources: tokenSources,
    },
    components,
    componentDirs: scannedDirs,
    strings: { sources: stringSources },
    designDocs,
    guidanceDocs,
    confirmed: previous?.confirmed || false,
    skin: previous?.skin || null,
    aiNotes: previous?.aiNotes || "",
    sources,
  };

  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "scanned",
        manifest: relative(projectDir, manifestPath),
        cssVarCount: Object.keys(cssVars).length,
        colorCount: Object.keys(colors).length,
        componentCount: components.length,
        framework,
        targetSurface: manifest.project.targetSurface,
        confirmed: manifest.confirmed,
      },
      null,
      2,
    )}\n`,
  );
  return 0;
}

function check(projectDir) {
  const manifestPath = join(projectDir, CACHE_REL, "ui-cache.json");
  if (!existsSync(manifestPath)) {
    process.stdout.write(`${JSON.stringify({ status: "missing" })}\n`);
    return 2;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    process.stdout.write(`${JSON.stringify({ status: "corrupt" })}\n`);
    return 2;
  }
  const changed = [];
  for (const source of manifest.sources || []) {
    // 手編集等で壊れたエントリはクラッシュさせず stale 要因として報告する
    if (!source || typeof source.path !== "string" || typeof source.hash !== "string") {
      changed.push({ path: String(source?.path ?? "(invalid)"), reason: "invalid-source" });
      continue;
    }
    if (source.type === "discovery") {
      if (discoveryHash(discoverTokenFiles(projectDir)) !== source.hash)
        changed.push({ path: source.path, reason: "token-files-changed" });
      continue;
    }
    const abs = join(projectDir, source.path);
    if (!existsSync(abs)) {
      changed.push({ path: source.path, reason: "removed" });
      continue;
    }
    try {
      const hash = source.type === "dirlist" ? hashDir(abs) : sha256File(abs);
      if (hash !== source.hash) changed.push({ path: source.path, reason: "modified" });
    } catch {
      changed.push({ path: source.path, reason: "unreadable" });
    }
  }
  // v1 manifest（tokens.colors / discovery ソースなし）は stale 扱いで再 scan へ誘導
  if ((manifest.version || 1) < MANIFEST_VERSION) {
    changed.push({ path: "::manifest-version", reason: `v${manifest.version || 1} < v${MANIFEST_VERSION}` });
  }
  const fresh = changed.length === 0;
  process.stdout.write(
    `${JSON.stringify(
      {
        status: fresh ? "fresh" : "stale",
        confirmed: manifest.confirmed || false,
        generatedAt: manifest.generatedAt,
        changed,
      },
      null,
      2,
    )}\n`,
  );
  return fresh ? 0 : 1;
}

const args = parseArgs(process.argv);
if (args.command === "scan") process.exit(scan(args.project));
if (args.command === "check") process.exit(check(args.project));
process.stderr.write(
  "Usage: node ui-scan.mjs <scan|check> [--project <dir>]\n" +
    "  scan  … UI 資産をスキャンして .tmp/spec-preview/ui-cache/ui-cache.json を生成/更新\n" +
    "  check … キャッシュ鮮度を判定 (exit 0=fresh / 1=stale / 2=キャッシュなし)\n",
);
process.exit(2);
