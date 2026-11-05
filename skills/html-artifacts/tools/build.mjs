#!/usr/bin/env node
/* ============================================================================
   html-artifacts · deterministic builder
   ----------------------------------------------------------------------------
   JSON spec  ->  ONE self-contained, offline, dependency-free .html

   WHY: assembling by hand/LLM is where bugs creep in (wrong inline order,
   miscomputed SVG coordinates, overlapping nodes, invisible connectors,
   reintroduced slop). This builder makes those deterministic:
     • core CSS inlined in the correct order automatically
     • charts/diagrams rendered from DATA (coordinates computed, not guessed)
     • diagrams auto-laid-out (layered/grid/radial/vertical) - no overlap
     • module CSS pulled from the canonical module files (single source)
   No Date / no Math.random  ->  same spec === byte-identical output.

   USAGE:  node tools/build.mjs <spec.json> <out.html>
   SPEC:   see reference/07-build-spec.md (sample: examples/example-spec.json)
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { checkSpec } from './lib/spec-check.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');                 // html-artifacts/
const CORE = path.join(ROOT, 'templates/core');
const MODS = path.join(ROOT, 'templates/modules');

const read = (f) => fs.readFileSync(f, 'utf8');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r2 = (n) => Math.round(n * 100) / 100;
/* Approximate rendered text width. CJK glyphs are full-width, so counting characters
   (the old `str.length * 6.5`) under-measures Japanese/Korean labels by ~40% and makes
   every label-collision test wrong. `aw` = ascii advance, `cw` = CJK advance. */
const CJK_RE = /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿︰-﹏＀-｠￠-￦]/;
const textW = (str, aw, cw) => {
  let w = 0;
  for (const ch of String(str == null ? '' : str)) w += CJK_RE.test(ch) ? cw : aw;
  return Math.ceil(w);
};
let ACTIVE_LANG = 'en';
let ACTIVE_TARGET = 'document';
const LABELS = {
  en: {
    app: 'App',
    appPreview: 'App preview',
    comparison: 'Comparison',
    criterion: 'Criteria',
    decisionMatrix: 'Decision matrix',
    desktop: 'Desktop',
    diagram: 'diagram',
    draggableSuffix: '(nodes can be dragged to reposition)',
    faq: 'FAQ',
    highestWeightedScore: 'Chosen for the highest weighted total score.',
    phone: 'Phone',
    pros: 'Pros',
    cons: 'Cons',
    recommended: 'Recommended',
    screenFlow: 'Screen flow',
    resetLayout: 'Reset layout',
    search: 'Search',
    searchPlaceholder: 'Search...',
    table: 'Table',
    tablet: 'Tablet',
    checklist: 'Checklist',
    form: 'Form',
    submitForm: 'Submit',
    formSubmitted: 'Submitted ✓',
    optional: 'Optional',
    stateDone: 'Done',
    statePending: 'Pending',
    stateBlocked: 'Blocked',
    stateTodo: 'To do',
    theme: 'Theme',
    toggleTheme: 'Toggle theme',
    total: 'Total',
    weightedTotal: 'Weighted total',
    viewportControls: 'Viewport controls',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Reset zoom',
    fullTopology: 'Full topology',
    otherComponents: 'Other components',
    systemTopology: 'System topology',
    architectureOverview: 'Architecture overview',
    archOverviewBody: 'Pick a scenario tab above to trace a concrete data flow step by step, or click any node in the diagram to inspect its tech stack and its inputs and outputs.',
    componentSpec: 'Component spec',
    scenarioFlow: 'Scenario flow',
    scenarioPipeline: 'Scenario pipeline',
    reset: 'Reset',
    inspector: 'Component inspector',
    legendClient: 'Client',
    legendGateway: 'Gateway',
    legendWorker: 'Worker/engine',
    legendQueue: 'Message queue',
    legendDatabase: 'Database',
    legendExternal: 'External provider',
    traceTotal: 'End-to-end',
    traceHops: 'Hops',
    traceSlowest: 'Slowest hop',
    traceNetwork: 'Network',
    traceCompute: 'Compute',
    traceDb: 'Database',
    traceQueue: 'Queue wait',
    traceCache: 'Cache',
    traceExternal: 'External call',
    producers: 'Producers',
    consumers: 'Consumers',
    globalEdge: 'Global / edge',
    role_primary: 'Primary',
    role_secondary: 'Secondary',
    role_dr: 'DR',
    degradedMode: 'Degrades, stays up',
    fmImpact: 'Impact',
    fmBlast: 'Blast radius',
    fmDetect: 'Detection',
    fmMitigate: 'Mitigation',
    fmRto: 'RTO',
  },
  ko: {
    app: '앱',
    appPreview: '앱 미리보기',
    comparison: '비교',
    criterion: '기준',
    decisionMatrix: '의사결정 매트릭스',
    desktop: '데스크톱',
    diagram: '다이어그램',
    draggableSuffix: '(노드는 드래그해서 재배치할 수 있음)',
    faq: '자주 묻는 질문',
    highestWeightedScore: '가중 합계가 가장 높은 선택지입니다.',
    phone: '휴대폰',
    pros: '장점',
    cons: '단점',
    recommended: '추천',
    screenFlow: '화면 흐름',
    resetLayout: '레이아웃 초기화',
    search: '검색',
    searchPlaceholder: '검색...',
    table: '표',
    tablet: '태블릿',
    checklist: '체크리스트',
    form: '폼',
    submitForm: '제출',
    formSubmitted: '제출됨 ✓',
    optional: '선택',
    stateDone: '완료',
    statePending: '대기',
    stateBlocked: '차단',
    stateTodo: '할 일',
    theme: '테마',
    toggleTheme: '테마 전환',
    total: '합계',
    weightedTotal: '가중 합계',
    viewportControls: '화면 크기 선택',
    zoomIn: '확대',
    zoomOut: '축소',
    zoomReset: '줌 초기화',
    fullTopology: '전체 토폴로지',
    otherComponents: '기타 컴포넌트',
    systemTopology: '전체 시스템 토폴로지',
    architectureOverview: '통합 아키텍처 개요',
    archOverviewBody: '상단의 시나리오 탭을 선택해 구체적인 데이터 흐름을 단계별로 탐색하거나, 다이어그램의 노드를 클릭해 기술 스택과 입출력 정의를 확인하세요.',
    componentSpec: '컴포넌트 상세 스펙',
    scenarioFlow: '시나리오 흐름',
    scenarioPipeline: '시나리오 파이프라인',
    reset: '초기화',
    inspector: '컴포넌트 인스펙터',
    legendClient: '클라이언트',
    legendGateway: '게이트웨이',
    legendWorker: '워커·엔진',
    legendQueue: '메시지 큐',
    legendDatabase: '데이터베이스',
    legendExternal: '외부 프로바이더',
    traceTotal: '엔드투엔드',
    traceHops: '홉 수',
    traceSlowest: '가장 느린 구간',
    traceNetwork: '네트워크',
    traceCompute: '연산',
    traceDb: '데이터베이스',
    traceQueue: '큐 대기',
    traceCache: '캐시',
    traceExternal: '외부 호출',
    producers: '발행자',
    consumers: '구독자',
    globalEdge: '글로벌 / 엣지',
    role_primary: '주 리전',
    role_secondary: '보조 리전',
    role_dr: '재해복구',
    degradedMode: '축소 운영으로 유지',
    fmImpact: '영향',
    fmBlast: '영향 범위',
    fmDetect: '탐지',
    fmMitigate: '완화책',
    fmRto: '복구 목표',
  },
  ja: {
    app: 'アプリ',
    appPreview: 'アプリプレビュー',
    comparison: '比較',
    criterion: '基準',
    decisionMatrix: '意思決定マトリクス',
    desktop: 'デスクトップ',
    diagram: '図',
    draggableSuffix: '（ノードはドラッグして再配置できます）',
    faq: 'FAQ',
    highestWeightedScore: '加重合計が最も高い選択肢です。',
    phone: 'スマホ',
    pros: '長所',
    cons: '短所',
    recommended: '推奨',
    screenFlow: '画面フロー',
    resetLayout: 'レイアウトをリセット',
    search: '検索',
    searchPlaceholder: '検索...',
    table: '表',
    tablet: 'タブレット',
    checklist: 'チェックリスト',
    form: 'フォーム',
    submitForm: '送信',
    formSubmitted: '送信しました ✓',
    optional: '任意',
    stateDone: '完了',
    statePending: '保留',
    stateBlocked: 'ブロック',
    stateTodo: '未着手',
    theme: 'テーマ',
    toggleTheme: 'テーマ切替',
    total: '合計',
    weightedTotal: '加重合計',
    viewportControls: '表示サイズ',
    zoomIn: '拡大',
    zoomOut: '縮小',
    zoomReset: 'ズームをリセット',
    fullTopology: '全体構成',
    otherComponents: 'その他のコンポーネント',
    systemTopology: 'システム全体構成',
    architectureOverview: 'アーキテクチャ概要',
    archOverviewBody: '上のシナリオタブを選ぶと具体的なデータの流れを段階ごとにたどれます。図中のノードをクリックすると、技術スタックと入出力の定義を確認できます。',
    componentSpec: 'コンポーネント詳細',
    scenarioFlow: 'シナリオの流れ',
    scenarioPipeline: 'シナリオ パイプライン',
    reset: 'リセット',
    inspector: 'コンポーネント インスペクター',
    legendClient: 'クライアント',
    legendGateway: 'ゲートウェイ',
    legendWorker: 'ワーカー・エンジン',
    legendQueue: 'メッセージキュー',
    legendDatabase: 'データベース',
    legendExternal: '外部プロバイダ',
    traceTotal: 'エンドツーエンド',
    traceHops: 'ホップ数',
    traceSlowest: '最も遅い区間',
    traceNetwork: 'ネットワーク',
    traceCompute: '演算',
    traceDb: 'データベース',
    traceQueue: 'キュー待ち',
    traceCache: 'キャッシュ',
    traceExternal: '外部呼び出し',
    producers: '発行元',
    consumers: '購読者',
    globalEdge: 'グローバル / エッジ',
    role_primary: 'プライマリ',
    role_secondary: 'セカンダリ',
    role_dr: 'DR',
    degradedMode: '縮退して継続',
    fmImpact: '影響',
    fmBlast: '影響範囲',
    fmDetect: '検知',
    fmMitigate: '緩和策',
    fmRto: '復旧目標',
  },
};
/* labels added with the navigation / chart passes (kept apart so the big tables above stay diffable) */
Object.assign(LABELS.en, { filterBy: 'Filter (click to highlight)', contents: 'Contents', ofTop: 'of first stage', stepRate: 'from previous', target: 'Target', chartData: 'Chart data' });
Object.assign(LABELS.ko, { filterBy: '필터 (클릭하여 강조)', contents: '목차', ofTop: '첫 단계 대비', stepRate: '이전 단계 대비', target: '목표', chartData: '차트 데이터' });
Object.assign(LABELS.ja, { filterBy: '絞り込み（クリックで強調）', contents: '目次', ofTop: '初段比', stepRate: '前段比', target: '目標', chartData: 'グラフのデータ' });
function inferLanguage(spec) {
  const explicit = String(spec.lang || spec.language || spec.locale || '').slice(0, 2).toLowerCase();
  if (['ko', 'ja', 'en'].includes(explicit)) return explicit;
  const text = JSON.stringify({
    title: spec.title,
    subtitle: spec.subtitle,
    eyebrow: spec.eyebrow,
    footer: spec.footer,
    sections: spec.sections,
  });
  if (/[가-힣]/.test(text)) return 'ko';
  if (/[ぁ-ゟ゠-ヿ]/.test(text)) return 'ja';
  return 'en';
}
function t(key) {
  return (LABELS[ACTIVE_LANG] && LABELS[ACTIVE_LANG][key]) || LABELS.en[key] || key;
}
function normalizeTarget(spec) {
  const raw = spec.target || spec.surface || 'document';
  const allowed = new Set(['mobile-app', 'tablet-app', 'web-app', 'desktop-app', 'document', 'diagram']);
  return allowed.has(raw) ? raw : 'document';
}
function normalizeViewport(spec, target) {
  const raw = spec.viewport || spec.defaultViewport;
  const allowed = new Set(['phone', 'tablet', 'desktop']);
  if (allowed.has(raw)) return raw;
  if (target === 'mobile-app') return 'phone';
  if (target === 'tablet-app') return 'tablet';
  return 'desktop';
}
function normalizeLayout(raw) {
  return ['stack', 'bento', 'sidebar', 'split'].includes(raw) ? raw : 'stack';
}
function normalizeHeader(raw) {
  return ['standard', 'compact', 'banner', 'split', 'none'].includes(raw) ? raw : 'standard';
}
function normalizeDensity(raw) {
  return ['comfortable', 'compact', 'spacious'].includes(raw) ? raw : 'comfortable';
}
/* ---- content-aware defaults: theme/layout/header derived from the section-type
   mix so a lazy spec never produces the "default sandwich". FIRST matching rule
   wins; explicit spec keys always override. density defaults to comfortable. ---- */
function deriveDefaults(spec) {
  const types = (spec.sections || []).map((s) => s.type);
  const has = (t) => types.includes(t);
  const count = (t) => types.filter((x) => x === t).length;
  let rule;
  if (has('screenflow') || has('device')) rule = { n: 1, why: 'screenflow/device', theme: 'interactive-warm', layout: 'stack', header: 'compact' };
  else if (has('decision')) rule = { n: 2, why: 'decision', theme: 'slate', layout: 'stack', header: 'split' };
  else if (has('kpi') && count('chart') >= 2) rule = { n: 3, why: `kpi + ${count('chart')} charts`, theme: 'midnight', layout: 'bento', header: 'compact' };
  else if (has('chart') || has('table') || ['gauge', 'radar', 'funnel', 'heatmap', 'progress', 'stattrend', 'barstacked', 'areastacked', 'bullet', 'calendar'].some((v) => has(v))) rule = { n: 4, why: 'chart/table/viz', theme: 'nord', layout: 'bento', header: 'compact' };
  else if (has('diagram')) rule = { n: 5, why: 'diagram', theme: 'dark-focus', layout: 'stack', header: 'compact' };
  else if (has('stepper') || has('timeline')) rule = { n: 6, why: 'stepper/timeline', theme: 'forest', layout: 'stack', header: 'banner' };
  else if (has('comparison')) rule = { n: 7, why: 'comparison', theme: 'rose', layout: 'stack', header: 'banner' };
  else rule = { n: 8, why: 'no signal', theme: 'birchline', layout: 'stack', header: 'standard' };
  const explicit = {
    theme: !!spec.theme,
    layout: spec.layout != null,
    header: spec.header != null,
    density: spec.density != null,
  };
  const KNOWN_THEMES = ['birchline', 'dark-focus', 'interactive-warm', 'minimal', 'midnight', 'slate', 'forest', 'rose', 'nord', 'sunset'];
  if (explicit.theme && !KNOWN_THEMES.includes(spec.theme)) {
    console.log(`warning: unknown theme "${spec.theme}" - falling back to derived theme "${rule.theme}"`);
    explicit.theme = false;
  }
  const theme = explicit.theme ? spec.theme : rule.theme;
  const layout = explicit.layout ? normalizeLayout(spec.layout) : rule.layout;
  const header = explicit.header ? normalizeHeader(spec.header) : rule.header;
  const density = explicit.density ? normalizeDensity(spec.density) : 'comfortable';
  const tag = (k) => (explicit[k] ? 'explicit' : 'derived');
  console.log(`defaults: theme=${theme} (${tag('theme')}) layout=${layout} (${tag('layout')}) header=${header} (${tag('header')}) density=${density} (${tag('density')}) (rule ${rule.n}: ${rule.why}; explicit spec keys override)`);
  return { theme, layout, header, density };
}
/* default --span per section type in bento (split defaults to 6, hero to 12) */
const SPAN_DEFAULT = { kpi: 12, chart: 6, callout: 6, collapsible: 6, timeline: 6, stepper: 6, radar: 6, funnel: 6, barstacked: 6, areastacked: 6, feed: 6, quote: 6 };
/* bento rows: default spans first (an explicit `span` always wins, a tl;dr callout spans the
   row), then a row that default-span sections leave part-empty is filled by its last
   default-span section - a lone half-width card beside nothing reads as a hole */
function bentoSpans(sections) {
  const sp = sections.map((s) => spanOf(s, s.type === 'callout' && s.variant === 'tldr' ? 12 : SPAN_DEFAULT[s.type] ?? 12));
  let row = [], used = 0;
  const flush = () => {
    const auto = row.filter((k) => spanOf(sections[k], 0) === 0);
    if (used && used < 12 && auto.length) sp[auto[auto.length - 1]] += 12 - used;
    row = []; used = 0;
  };
  sp.forEach((w, k) => {
    if (sections[k].chapter || used + w > 12) flush();
    row.push(k); used += w;
    if (used === 12) flush();
  });
  flush();
  return sp;
}
function spanOf(s, fallback) {
  const v = parseInt(s.span, 10);
  return Number.isInteger(v) && v >= 1 && v <= 12 ? v : fallback;
}
/* inject classes / style props onto a rendered section's root element */
function decorateRoot(html, cls, styleProp) {
  if ((!cls || !cls.length) && !styleProp) return html;
  const classAttr = cls && cls.length ? ` class="${cls.join(' ')}"` : '';
  const styleAttr = styleProp ? ` style="${styleProp}"` : '';
  if (!html.trimStart().startsWith('<')) return `<div${classAttr}${styleAttr}>${html}</div>`;
  const m = html.match(/<([a-zA-Z][\w-]*)([^>]*)>/);
  if (!m) return `<div${classAttr}${styleAttr}>${html}</div>`;
  let attrs = m[2];
  if (cls && cls.length) {
    if (/\bclass="/.test(attrs)) attrs = attrs.replace(/\bclass="/, `class="${cls.join(' ')} `);
    else attrs = ` class="${cls.join(' ')}"` + attrs;
  }
  if (styleProp) {
    if (/\bstyle="/.test(attrs)) attrs = attrs.replace(/\bstyle="/, `style="${styleProp};`);
    else attrs += ` style="${styleProp}"`;
  }
  return html.slice(0, m.index) + `<${m[1]}${attrs}>` + html.slice(m.index + m[0].length);
}
function moduleCSS(name) {
  // strip the HTML header comment first - it documents `<style data-module="…">`
  // in prose, which would otherwise hijack the match and pull in {{placeholders}}.
  const src = read(path.join(MODS, name + '.html')).replace(/<!--[\s\S]*?-->/g, '');
  const m = src.match(/<style data-module="[^"]*">([\s\S]*?)<\/style>/);
  return m ? m[1].trim() : '';
}
/* ---- builder-owned diagram CSS (theme-aware; one renderer for every layout) ---- */
const DG_CSS = `
.dg { width: 100%; }
.dg .dg-title { font: var(--type-h3); color: var(--text-primary); margin-bottom: var(--sp-4); }
/* the zoom controls float over the stage: reserve a top strip for them so they never cover nodes at the initial zoom (a narrow page shrinks the drawing, not the controls) */
.dg .stage { position: relative; width: 100%; overflow: hidden; padding-top: calc(var(--sp-2) * 2 + 32px); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-muted); cursor: grab; touch-action: none; }
.dg .stage.panning, .dg .stage:active { cursor: grabbing; }
.dg svg { width: 100%; height: auto; display: block; font-family: var(--font-sans); }
.dg .zoom-controls { position: absolute; top: var(--sp-2); right: var(--sp-2); display: flex; flex-direction: row; align-items: center; gap: 2px; padding: 2px; background: color-mix(in srgb, var(--bg-surface) 92%, transparent); backdrop-filter: blur(8px); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); z-index: 2; }
.dg .zoom-readout { font: var(--type-caption); font-family: var(--font-mono); color: var(--text-secondary); min-width: 3.8ch; padding-inline: 4px; text-align: right; }
.dg .dg-zone { fill: color-mix(in srgb, var(--zc, var(--accent)) 4%, var(--bg-surface)); stroke: color-mix(in srgb, var(--zc, var(--accent)) 35%, var(--border-default)); stroke-width: 1; stroke-dasharray: 4 4; }
.dg .dg-zlabel { fill: var(--zc, var(--text-secondary)); font: var(--type-caption); font-family: var(--font-mono); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.dg [data-node] { cursor: grab; } .dg [data-node].dragging { cursor: grabbing; }
.dg [data-node]:focus { outline: none; } .dg [data-node]:focus-visible .dg-box { stroke: var(--accent); stroke-width: 2.2; }
.dg .dg-box { fill: var(--bg-surface); stroke: var(--gc, var(--border-default)); stroke-width: 1.5; transition: stroke var(--dur-fast) var(--ease); }
.dg [data-node]:hover .dg-box { stroke: var(--accent); }
.dg .dg-root .dg-box { fill: var(--accent); stroke: var(--accent); }
.dg .dg-root .dg-label { fill: var(--on-accent); }
.dg .dg-label { fill: var(--text-primary); font: var(--type-small); font-weight: 600; }
.dg .dg-sub { fill: var(--text-muted); font-size: 11px; }
.dg .dg-edge { stroke: var(--text-muted); stroke-width: 1.5; fill: none; }
.dg .dg-edge.async { stroke-dasharray: 6 4; }
.dg .dg-elabel { fill: var(--text-secondary); font-size: 11px; font-family: var(--font-mono); text-anchor: middle; paint-order: stroke; stroke: var(--bg-muted); stroke-width: 5px; stroke-linejoin: round; pointer-events: none; }
/* group filter (HA.crossfilter): selected nodes + their edges stand out, connected nodes stay readable, everything else fades */
.dg [data-node], .dg .dg-edge, .dg .dg-elabel { transition: opacity var(--dur-fast) var(--ease), stroke var(--dur-fast) var(--ease); }
.dg [data-node].dimmed, .dg [data-node].cf-off { opacity: 0.12; }
.dg [data-node].cf-near { opacity: 0.6; }
.dg [data-node].cf-on { opacity: 1; }
.dg [data-node].cf-on .dg-box { stroke: var(--accent); stroke-width: 3; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 45%, transparent)); }
.dg .dg-edge.cf-on { stroke: var(--accent); stroke-width: 2.6; }
.dg .dg-edge.cf-off, .dg .dg-elabel.cf-off { opacity: 0.08; }
.dg .dg-elabel.cf-on { fill: var(--text-primary); font-weight: 600; }
.dg .g-1 { --gc: var(--cat-1); } .dg .g-2 { --gc: var(--cat-2); } .dg .g-3 { --gc: var(--cat-3); } .dg .g-4 { --gc: var(--cat-4); } .dg .g-5 { --gc: var(--cat-5); }
.dg .z-1 { --zc: var(--cat-1); } .dg .z-2 { --zc: var(--cat-2); } .dg .z-3 { --zc: var(--cat-3); } .dg .z-4 { --zc: var(--cat-4); } .dg .z-5 { --zc: var(--cat-5); }
.dg .dg-legend { margin-bottom: var(--sp-3); } .dg .dg-legend .chip { cursor: pointer; align-items: center; } .dg .dg-legend .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: var(--sp-1); background: var(--gc, var(--accent)); }`;

/* ---- target surface CSS/JS: browser delivery, product-shaped preview ---- */
const TARGET_CSS = `
.ha-viewport-controls { position: absolute; top: var(--sp-5); right: var(--sp-5); display: inline-flex; gap: var(--sp-1); padding: var(--sp-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-pill); background: var(--bg-surface); box-shadow: var(--shadow-sm); }
.ha-viewport-controls [data-viewport-target].active { background: var(--accent); color: var(--on-accent); border-color: transparent; }
[data-target="document"] .ha-viewport-controls, [data-target="diagram"] .ha-viewport-controls { display: none; }
.ha-device-section { display: grid; grid-template-columns: minmax(260px, .82fr) minmax(320px, 1.18fr); gap: var(--sp-5); align-items: start; }
.ha-device-copy { display: grid; gap: var(--sp-3); align-content: start; }
.ha-device-copy p { color: var(--text-secondary); }
.ha-device-stage { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; padding: var(--sp-5); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); background: var(--bg-muted); }
.ha-device { width: min(var(--ha-device-width, 390px), 100%); height: var(--ha-device-height, 780px); display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; border: 1px solid var(--border-default); border-radius: 32px; background: var(--bg-surface); box-shadow: var(--shadow-lg), inset 0 0 0 1px color-mix(in srgb, var(--bg-page) 70%, transparent); }
.ha-device-safe { min-height: 24px; display: flex; align-items: end; justify-content: center; padding: 7px var(--sp-4) 4px; color: var(--text-muted); font: var(--type-caption); }
.ha-device-appbar { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding-inline: var(--sp-4); border-bottom: 1px solid var(--border-subtle); }
.ha-device-title { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; font-weight: 700; }
.ha-device-icon { width: 30px; height: 30px; border-radius: var(--radius-sm); display: grid; place-items: center; background: var(--accent); color: var(--on-accent); font: var(--type-caption); font-weight: 800; }
.ha-device-screen { min-height: 0; overflow: hidden; background: var(--bg-page); }
.ha-device-bottom { min-height: 62px; display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--border-subtle); background: var(--bg-surface); }
.ha-device-input { flex: 1; min-width: 0; min-height: 40px; border-radius: var(--radius-pill); border: 1px solid var(--border-subtle); background: var(--bg-muted); color: var(--text-muted); display: flex; align-items: center; padding-inline: var(--sp-3); font: var(--type-small); }
[data-viewport="phone"] .ha-device { --ha-device-width: 390px; --ha-device-height: 780px; }
[data-viewport="phone"] .ha-device-section { grid-template-columns: minmax(0, .9fr) minmax(320px, 430px); }
[data-viewport="tablet"] .ha-device { --ha-device-width: 760px; --ha-device-height: 820px; border-radius: 24px; }
[data-viewport="tablet"] .ha-device-section { grid-template-columns: minmax(0, .72fr) minmax(0, 1.28fr); }
[data-viewport="desktop"] .ha-device { --ha-device-width: 1040px; --ha-device-height: 720px; border-radius: var(--radius-lg); }
[data-viewport="desktop"] .ha-device-section { grid-template-columns: minmax(0, 1fr); } /* a 1040px screen cannot sit beside its copy */
@media (max-width: 900px) { .ha-viewport-controls { position: static; margin-top: var(--sp-4); } .ha-device-section, [data-viewport] .ha-device-section { grid-template-columns: 1fr; } .ha-device-stage { padding: var(--sp-3); } }`;

const TARGET_JS = `
(function () {
  const params = new URLSearchParams(window.location.search);
  const html = document.documentElement;
  const initial = params.get('viewport') || html.dataset.viewport || 'desktop';
  function applyViewport(viewport, updateUrl) {
    html.dataset.viewport = viewport;
    document.querySelectorAll('[data-viewport-target]').forEach((button) => {
      const active = button.dataset.viewportTarget === viewport;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (updateUrl) {
      const next = new URLSearchParams(window.location.search);
      next.set('viewport', viewport);
      history.replaceState(null, '', window.location.pathname + '?' + next.toString());
    }
  }
  document.querySelectorAll('[data-viewport-target]').forEach((button) => {
    button.addEventListener('click', () => applyViewport(button.dataset.viewportTarget, true));
  });
  applyViewport(initial, false);
})();`;

/* ============================ section renderers ============================ */
const R = {};

/* ---- html: raw passthrough. Module CSS always comes from the canonical module file:
   (1) declared - `cssModules: [...]`, `module: "<id>"`, or the module id used as the type;
   (2) an embedded <style data-module="X"> copy is lifted out and replaced by the canonical
       CSS (stale or corrupted copies can no longer ship - retro 2026-07-09);
   (3) the module's root class in the markup (class="ktw …") pulls its CSS in even when the
       author forgot to declare it. ---- */
const MODULE_IDS = fs.readdirSync(MODS).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
let ROOT_CLASS = null;
function moduleRootClasses() {
  if (ROOT_CLASS) return ROOT_CLASS;
  const byCls = {};
  for (const id of MODULE_IDS) {
    const m = moduleCSS(id).replace(/\/\*[\s\S]*?\*\//g, '').match(/^\s*\.([a-zA-Z][\w-]*)/);
    if (m) (byCls[m[1]] = byCls[m[1]] || []).push(id);
  }
  ROOT_CLASS = {};
  for (const [cls, ids] of Object.entries(byCls)) if (ids.length === 1) ROOT_CLASS[ids[0]] = cls;
  return ROOT_CLASS;
}
const BUILD_NOTES = [];
R.html = (s, idx) => {
  const css = [...(s.cssModules || []), ...(s.module ? [s.module] : [])];
  let html = String(s.html || '');
  html = html.replace(/<style\s+data-module="([a-z0-9-]+)"[^>]*>[\s\S]*?<\/style>\s*/g, (all, id) => {
    if (!MODULE_IDS.includes(id)) return all;
    if (!css.includes(id)) css.push(id);
    BUILD_NOTES.push(`section #${idx + 1}: embedded <style data-module="${id}"> replaced by the canonical templates/modules/${id}.html CSS`);
    return '';
  });
  for (const [id, cls] of Object.entries(moduleRootClasses())) {
    if (!css.includes(id) && new RegExp(`class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"`).test(html)) css.push(id);
  }
  return { css, html };
};

/* ---- inline Markdown on escaped text: **bold**, *em*, `code`, [text](https:|#|mailto:) ---- */
function mdInline(str) {
  const codes = [];
  let h = esc(str).replace(/`([^`]+)`/g, (_, c) => { codes.push(`<code>${c}</code>`); return `\u0000${codes.length - 1}\u0000`; });
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, href) => (/^(https?:|#|mailto:)/.test(href) ? `<a href="${href}">${txt}</a>` : txt));
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  return h.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}
/* ---- block Markdown subset: headings (→ h3/h4; the section title is the h2), paragraphs
   (a single newline is a line break), - / 1. lists, > quotes, ``` fences, | tables |, --- ---- */
function mdBlocks(src) {
  const L = String(src == null ? '' : src).replace(/\r/g, '').split('\n');
  const LIST = /^\s*([-*+]|\d+[.)])\s+/, SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  const out = [];
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    let m;
    if (!l.trim()) { i++; continue; }
    if ((m = l.match(/^```(\S*)\s*$/))) {
      const buf = []; i++;
      while (i < L.length && !/^```\s*$/.test(L[i])) buf.push(L[i++]);
      i++; out.push(`<pre><code${m[1] ? ` data-lang="${esc(m[1])}"` : ''}>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { const h = m[1].length >= 4 ? 4 : 3; out.push(`<h${h}>${mdInline(m[2])}</h${h}>`); i++; continue; }
    if (/^\s*>/.test(l)) { const buf = []; while (i < L.length && /^\s*>/.test(L[i])) buf.push(L[i++].replace(/^\s*>\s?/, '')); out.push(`<blockquote>${mdBlocks(buf.join('\n'))}</blockquote>`); continue; }
    if (LIST.test(l)) {
      const ordered = /^\s*\d/.test(l), items = [];
      while (i < L.length && LIST.test(L[i])) {
        items.push(L[i++].replace(LIST, ''));
        while (i < L.length && /^\s{2,}\S/.test(L[i]) && !LIST.test(L[i])) items[items.length - 1] += ' ' + L[i++].trim();
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((x) => `<li>${mdInline(x)}</li>`).join('')}</${tag}>`); continue;
    }
    if (l.includes('|') && i + 1 < L.length && SEP.test(L[i + 1])) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(l), rows = []; i += 2;
      while (i < L.length && L[i].includes('|') && L[i].trim()) rows.push(cells(L[i++]));
      out.push(`<div class="dt-scroll"><table><thead><tr>${head.map((c) => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    const buf = [];
    while (i < L.length && L[i].trim() && !/^(#{1,6}\s|```|\s*>|\s*(-{3,}|\*{3,})\s*$)/.test(L[i]) && !LIST.test(L[i])) buf.push(L[i++].trim());
    if (!buf.length) buf.push(L[i++].trim());   // never stall on an unmatched line
    out.push(`<p>${buf.map(mdInline).join('<br>')}</p>`);
  }
  return out.join('');
}
const mdSource = (v) => (Array.isArray(v) ? v.join('\n') : v);   // an array is lines; "" separates paragraphs

/* ---- prose: running text in a small Markdown subset - the honest way to write the
   paragraphs, lists and small tables a real report needs without raw HTML ---- */
R.prose = (s) => ({
  css: [],
  html: `<section class="prose-sec${s.card ? ' card-outlined' : ''}" aria-label="${esc(s.title || s.label || 'Text')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') +
    `<div class="prose${s.wide ? ' prose-wide' : ''}">${mdBlocks(mdSource(s.md))}</div></section>`,
});

R.device = (s) => ({
  css: ['__target__'],
  html:
    `<section class="ha-device-section" data-device-frame aria-label="${esc(s.label || t('appPreview'))}">` +
    `<div class="ha-device-copy">` +
    (s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : '') +
    (s.title ? `<h2>${esc(s.title)}</h2>` : '') +
    (s.desc ? `<p>${esc(s.desc)}</p>` : '') +
    (s.notes && s.notes.length ? `<div class="card-outlined"><ul>${s.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : '') +
    `</div>` +
    `<div class="ha-device-stage"><div class="ha-device">` +
    `<div><div class="ha-device-safe">${esc(s.statusBar || '9:41')}</div><div class="ha-device-appbar"><div class="ha-device-title"><span class="ha-device-icon">${esc(s.icon || '◆')}</span><span>${esc(s.appTitle || s.title || t('app'))}</span></div>${s.badge ? `<span class="badge badge-accent">${esc(s.badge)}</span>` : ''}</div></div>` +
    `<div class="ha-device-screen">${s.html || ''}</div>` +
    `<div class="ha-device-bottom"><div class="ha-device-input">${esc(s.input || '')}</div>${s.cta ? `<span class="btn btn-sm" aria-hidden="true">${esc(s.cta)}</span>` : ''}</div>` +
    `</div></div></section>`,
});

/* delta chip: arrow from `dir` (up / down / flat), colour from MEANING. A falling
   latency or churn is good news, so `tone` ("good" / "bad" / "neutral") overrides the
   default (up = good, down = bad) - otherwise "▼ 18ms faster" renders in danger red. */
function deltaHtml(it) {
  if (!it.delta) return '';
  const dir = it.dir === 'down' ? 'down' : it.dir === 'flat' ? 'flat' : 'up';
  const tone = it.tone || (it.good === true ? 'good' : it.good === false ? 'bad' : dir === 'up' ? 'good' : dir === 'down' ? 'bad' : 'neutral');
  const arrow = dir === 'down' ? '▼' : dir === 'flat' ? '→' : '▲';
  // The arrow is the builder's job. Authors reasonably write it into `delta` too
  // ("▲ 前四半期比 2.4倍"), which rendered "▲ ▲ …" - so strip a leading arrow.
  return `<span class="metric-delta-${dir} metric-delta-${esc(tone)}">${arrow} ${esc(String(it.delta).replace(/^\s*[▲▼△▽↑↓→+-]\s*/, ''))}</span>`;
}
/* count-up keeps the printed affixes: value "¥58.4M" + valueNum 58.4 → prefix "¥", suffix "M" */
function counterAttrs(it) {
  if (it.valueNum == null) return '';
  const m = String(it.value == null ? '' : it.value).match(/^(\D*?)[\d.,]+(.*)$/);
  const prefix = it.prefix != null ? it.prefix : m ? m[1] : '';
  const suffix = it.suffix != null ? it.suffix : m ? m[2] : '';
  return ` data-counter data-to="${esc(it.valueNum)}"${prefix ? ` data-prefix="${esc(prefix)}"` : ''}${suffix ? ` data-suffix="${esc(suffix)}"` : ''}`;
}
/* balanced card columns: 5 metrics → 5 across (not 4 + an orphan), 6 → 3×2, 7 → 4+3 … */
const balancedCols = (n) => (n <= 5 ? Math.max(n, 1) : n === 6 || n === 9 ? 3 : n === 10 ? 5 : 4);
const mediumCols = (n) => (n <= 2 ? Math.max(n, 1) : n % 3 === 0 || n === 5 ? 3 : 2);
R.kpi = (s) => {
  const metric = (it, cls) =>
    `<article class="${cls}"><span class="metric-label">${esc(it.label)}</span>` +
    `<span class="metric-value"${counterAttrs(it)}>${esc(it.value)}</span>` +
    deltaHtml(it) + (it.note ? `<span class="metric-note">${esc(it.note)}</span>` : '') +
    `</article>`;
  const items = s.items || [];
  let inner;
  if (s.variant === 'inline' && items.length) {
    inner = `<div class="kpi-strip">` + items.map((it) => metric(it, 'metric metric-inline')).join('') + `</div>`;
  } else if (s.variant === 'hero' && items.length) {
    inner = `<div class="kpi-hero">` + metric(items[0], 'card-outlined metric metric-hero') +
      `<div class="kpi-hero-rest">` + items.slice(1).map((it) => metric(it, 'card-outlined metric')).join('') + `</div></div>`;
  } else {
    inner = `<div class="grid kpi-cards" style="--kpi-cols:${balancedCols(items.length)};--kpi-cols-md:${mediumCols(items.length)}">` + items.map((it) => metric(it, 'card-outlined metric')).join('') + `</div>`;
  }
  return { css: [], html: `<section class="kpi-sec" aria-label="${esc(s.label || s.title || 'Key metrics')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + inner + `</section>` };
};

/* ============================ charts ============================
   HTML-hybrid plot frame. SVG text shrinks with its viewBox: the old 720-unit
   charts printed 8px labels inside a half-width card and 4px labels on a phone.
   Here the plot is a fixed-height box; bars are divs sized in %, lines/areas are a
   preserveAspectRatio="none" SVG with non-scaling strokes, and every tick, value
   and category label is HTML positioned in % - the same size at any width, and
   it wraps instead of colliding. Axis ticks come from a "nice" domain, so a line
   of 168→182 is drawn on 165–185 (the movement is visible) while bars always keep
   a zero baseline (bar length must stay honest). */
const PLOT_SIZES = { sm: 160, md: 240, lg: 330 };
const plotFor = (size) => PLOT_SIZES[size] || PLOT_SIZES.md;
const fin = (v) => (Number.isFinite(+v) ? +v : 0);
function niceStep(range, ticks) {
  const raw = (range || 1) / Math.max(ticks, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}
function niceDomain(values, zero, lo0, hi0) {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (lo === hi) { hi = lo === 0 ? 1 : hi + Math.abs(hi) * 0.1; if (!zero) lo -= Math.abs(lo) * 0.1; }
  const step = niceStep(hi - lo, 4);
  lo = lo0 != null && Number.isFinite(+lo0) ? +lo0 : Math.floor(lo / step + 1e-9) * step;
  hi = hi0 != null && Number.isFinite(+hi0) ? +hi0 : Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) ticks.push(+v.toPrecision(12));
  return { lo, hi, step, ticks };
}
const pctOf = (v, dom) => r2(((v - dom.lo) / ((dom.hi - dom.lo) || 1)) * 100);
const groupDigits = (str) => { const [a, b] = String(str).split('.'); return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : ''); };
function fmtNum(v, step) {
  const dec = step != null && step < 1 ? Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)) : 0;
  const s = Math.abs(v).toFixed(dec);
  return (v < 0 && +s !== 0 ? '-' : '') + groupDigits(s);
}
function compactNum(v, step) {
  const a = Math.abs(v), trim = (x) => String(+x.toFixed(1));
  if (a >= 1e9) return trim(v / 1e9) + 'B';
  if (a >= 1e6) return trim(v / 1e6) + 'M';
  if (a >= 1e4) return trim(v / 1e3) + 'k';
  return fmtNum(v, step);
}
/* axis tick format: explicit yPrefix/ySuffix, else the affixes the author already used in
   `display` ("¥168億" with value 168 → ticks "¥165億"), else compact numbers. */
function axisFormat(items, s) {
  if (s.yPrefix != null || s.ySuffix != null) return (v, st) => `${s.yPrefix || ''}${fmtNum(v, st)}${s.ySuffix || ''}`;
  const parsed = (items || []).map((d) => {
    if (!d || d.display == null) return null;
    const m = String(d.display).match(/^([^\d\-−]*?)([-−])?([\d,]*\.?\d+)\s*(.*?)$/);
    return m ? { pre: m[1], num: +m[3].replace(/,/g, '') * (m[2] ? -1 : 1), suf: m[4] } : null;
  });
  const ok = parsed.length > 0 && parsed.every((p, i) => p && p.pre === parsed[0].pre && p.suf === parsed[0].suf &&
    Math.abs(p.num - fin(items[i].value)) <= Math.max(Math.abs(fin(items[i].value)) * 0.02, 1e-9));
  if (ok) return (v, st) => `${parsed[0].pre}${fmtNum(v, st)}${parsed[0].suf}`;
  return (v, st) => compactNum(v, st);
}
/* value labels keep the data's own precision (5.1 stays "5.1" on an axis stepping by 1) */
const labelStep = (vals, axisStep) => {
  const d = Math.max(0, ...vals.filter(Number.isFinite).map((v) => (String(v).split('.')[1] || '').length));
  return d ? Math.min(axisStep, Math.pow(10, -Math.min(d, 3))) : axisStep;
};
const catOf = (c, i) => { const n = parseInt(c, 10); return n >= 1 && n <= 5 ? n : (i % 5) + 1; };
/* x labels: long runs keep every k-th label; the in-between ones are .hc-minor and
   drop out first when the card gets narrow (container query in elements.css). */
function xLabelsHtml(labels) {
  const N = labels.length, k = N > 16 ? Math.ceil(N / 12) : 1;
  return labels.map((l, i) => {
    if (i % k) return '<span></span>';
    const minor = N > 6 && (i / k) % 2 === 1;
    return `<span${minor ? ' class="hc-minor"' : ''}>${esc(l)}</span>`;
  }).join('');
}
function hcFrame(o) {
  const yLabels = o.dom.ticks.map((v) => o.fmt(v, o.dom.step));
  const yw = Math.max(24, ...yLabels.map((l) => textW(l, 7.2, 12))) + 4;
  const grid = o.dom.ticks.map((v) => `<i style="bottom:${pctOf(v, o.dom)}%"${v === 0 ? ' class="hc-base"' : ''}></i>`).join('');
  const ys = o.dom.ticks.map((v, i) => `<span style="bottom:${pctOf(v, o.dom)}%">${esc(yLabels[i])}</span>`).join('');
  const tg = o.target && Number.isFinite(+o.target.value)
    ? `<i class="hc-target" style="bottom:${pctOf(+o.target.value, o.dom)}%"><b>${esc(o.target.label || t('target'))} ${esc(o.target.display != null ? o.target.display : o.fmt(+o.target.value, o.dom.step))}</b></i>` : '';
  const legend = o.legend && o.legend.length > 1
    ? `<div class="hc-legend" aria-hidden="true">${o.legend.map((l) => `<span class="cat-${l.cat}"><i></i>${esc(l.label)}</span>`).join('')}</div>` : '';
  return `<figure class="chart hc${o.cls ? ' ' + o.cls : ''}${o.dense ? ' hc-dense' : ''} card-outlined" data-chart-tip>` +
    (o.title ? `<figcaption class="chart-title">${esc(o.title)}</figcaption>` : '') +
    `<div class="hc-body" role="img" aria-label="${esc(o.aria)}" style="--hc-h:${o.height}px;--hc-yw:${yw}px">` +
    `<div class="hc-y" aria-hidden="true">${ys}</div>` +
    `<div class="hc-plot"><div class="hc-grid" aria-hidden="true">${grid}</div>${o.plot}${tg}</div>` +
    `<div class="hc-x" aria-hidden="true">${xLabelsHtml(o.x)}</div></div>${legend}</figure>`;
}
const ariaSummary = (title, pairs) => `${title ? title + ': ' : ''}${pairs.join(', ')}`;

/* filter: true → each category becomes a toggle that dims the others (HA.crossfilter:
   [data-filter-key] ↔ [data-series]); bar charts get a chip row, donuts use their legend */
const seriesKey = (d, i) => String(d.key != null ? d.key : d.label != null ? d.label : i);
R.chart = (s) => {
  const out = s.variant === 'donut' ? chartDonut(s) : s.variant === 'line' ? chartLine(s) : chartBar(s);
  if (!s.filter || s.variant === 'line') return out;
  const chips = s.variant === 'donut' ? '' : `<div class="cluster hc-filter no-print" role="group" aria-label="${esc(t('filterBy'))}">` +
    (s.series || []).map((d, i) => `<span class="chip" data-filter-key="${esc(seriesKey(d, i))}"><i class="hc-sw" style="--c:var(--cat-${catOf(d.cat || s.cat || 1, 0)})"></i>${esc(d.label)}</span>`).join('') + `</div>`;
  // the figure itself is the filter scope; the chips sit under its caption, inside the card
  let html = out.html.replace(/^<figure /, '<figure data-crossfilter ');
  html = html.includes('</figcaption>') ? html.replace('</figcaption>', `</figcaption>${chips}`) : html.replace(/^(<figure[^>]*>)/, `$1${chips}`);
  return { css: out.css, html };
};

function chartBar(s) {
  const items = s.series || [];
  const vals = items.map((d) => fin(d.value));
  const dom = niceDomain(vals.concat(s.target ? [fin(s.target.value)] : []), true, s.yMin, s.yMax);
  const fmt = axisFormat(items, s);
  const z = pctOf(Math.min(Math.max(0, dom.lo), dom.hi), dom);
  const N = items.length, ls = labelStep(vals, dom.step);
  const bars = items.map((d, i) => {
    const v = vals[i], p = pctOf(v, dom), disp = d.display != null ? d.display : fmt(v, ls);
    const cls = `hc-bar cat-${catOf(d.cat || s.cat || 1, 0)}${v < 0 ? ' hc-neg' : ''}${d.highlight ? ' hc-hl' : ''}`;
    return `<div class="hc-slot"${s.filter ? ` data-series="${esc(seriesKey(d, i))}"` : ''}><div class="${cls}" style="bottom:${r2(Math.min(p, z))}%;height:${r2(Math.abs(p - z))}%" data-tip="${esc(d.label)}: ${esc(disp)}">` +
      (N <= 14 ? `<span class="hc-val">${esc(disp)}</span>` : '') + `</div></div>`;
  }).join('');
  return {
    css: ['chart-bar'],
    html: hcFrame({ title: s.title, aria: ariaSummary(s.title, items.map((d, i) => `${d.label} ${d.display != null ? d.display : vals[i]}`)),
      height: plotFor(s.size), dom, fmt, plot: `<div class="hc-bars">${bars}</div>`, x: items.map((d) => d.label), dense: N > 6, target: s.target }),
  };
}

function chartLine(s) {
  const multi = Array.isArray(s.series) && s.series.length > 0 && Array.isArray(s.series[0].values);
  const pts = s.points || [];
  const labels = multi ? (s.labels || s.xLabels || []) : pts.map((p) => p.label);
  const series = multi
    ? s.series.map((se, si) => ({ label: se.label || '', cat: catOf(se.cat, si), vals: (se.values || []).map(fin), disp: se.display || [] }))
    : [{ label: s.title || '', cat: catOf(s.cat || 1, 0), vals: pts.map((p) => fin(p.value)), disp: pts.map((p) => p.display) }];
  const all = series.flatMap((x) => x.vals).concat(s.target ? [fin(s.target.value)] : []);
  const mn = Math.min(...all), mx = Math.max(...all);
  const zero = s.zero != null ? !!s.zero : (mn <= 0 || mn <= mx * 0.35);
  const dom = niceDomain(all, zero, s.yMin, s.yMax);
  const fmt = axisFormat(multi ? [] : pts, s);
  const N = Math.max(labels.length, ...series.map((x) => x.vals.length), 1);
  const xp = (i) => r2(((i + 0.5) / N) * 100);
  const yp = (v) => r2(100 - pctOf(v, dom));
  const base = yp(Math.min(Math.max(0, dom.lo), dom.hi));
  let svg = '', marks = '';
  const ls = labelStep(all, dom.step), ends = [];
  series.forEach((se) => {
    const P = se.vals.map((v, i) => `${xp(i)},${yp(v)}`);
    // an area fill measures from zero: over a truncated axis it would exaggerate the change
    if (series.length === 1 && P.length > 1 && dom.lo <= 0) svg += `<path class="hc-area cat-${se.cat}" d="M${xp(0)},${base} L${P.join(' L')} L${xp(se.vals.length - 1)},${base} Z"/>`;
    svg += `<polyline class="hc-line cat-${se.cat}" points="${P.join(' ')}" vector-effect="non-scaling-stroke"/>`;
    const lo = Math.min(...se.vals), hi = Math.max(...se.vals);
    se.vals.forEach((v, i) => {
      const disp = se.disp[i] != null ? se.disp[i] : fmt(v, ls);
      marks += `<span class="hc-dot cat-${se.cat}" style="left:${xp(i)}%;bottom:${pctOf(v, dom)}%" data-tip="${esc((multi ? se.label + ' · ' : '') + (labels[i] != null ? labels[i] : ''))}: ${esc(disp)}"></span>`;
      if (multi) { if (i === se.vals.length - 1) ends.push({ x: xp(i), at: pctOf(v, dom), disp, cat: se.cat }); return; }
      if (N <= 8 || i === 0 || i === N - 1 || v === lo || v === hi) marks += `<span class="hc-val hc-pt" style="left:${xp(i)}%;bottom:${pctOf(v, dom)}%">${esc(disp)}</span>`;
    });
  });
  // end-of-line labels of several series: stack them apart so close values don't print on top of each other
  const gap = (16 / plotFor(s.size)) * 100;
  ends.sort((a, b) => a.at - b.at).forEach((e, k) => { if (k) e.at = Math.max(e.at, ends[k - 1].at + gap); });
  const over = ends.length ? ends[ends.length - 1].at - 100 : 0;
  ends.forEach((e) => { marks += `<span class="hc-val hc-pt hc-end cat-${e.cat}" style="left:${e.x}%;bottom:${r2(over > 0 ? e.at - over : e.at)}%">${esc(e.disp)}</span>`; });
  const aria = multi ? ariaSummary(s.title, series.map((se) => `${se.label} ${se.vals.join(' → ')}`)) : ariaSummary(s.title, pts.map((p, i) => `${p.label} ${p.display != null ? p.display : series[0].vals[i]}`));
  return {
    css: ['chart-line'],
    html: hcFrame({ cls: 'hc-linechart', title: s.title, aria, height: plotFor(s.size), dom, fmt, dense: N > 6, target: s.target,
      plot: `<div class="hc-lines"><svg class="hc-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${marks}</div>`,
      x: Array.from({ length: N }, (_, i) => (labels[i] != null ? labels[i] : '')), legend: multi ? series.map((se) => ({ label: se.label, cat: se.cat })) : null }),
  };
}

function chartDonut(s) {
  const C = 502.65, segsIn = s.segments || [], sum = segsIn.reduce((a, d) => a + fin(d.value), 0) || 1;
  let off = 0, segs = '', legend = '';
  segsIn.forEach((d, i) => {
    const frac = fin(d.value) / sum, dash = r2(frac * C), cat = catOf(d.cat, i), pct = Math.round(frac * 100);
    const shown = d.display != null ? d.display : null;
    const key = s.filter ? ` data-series="${esc(seriesKey(d, i))}"` : '';
    segs += `<circle class="seg cat-${cat}"${key} cx="160" cy="160" r="80" stroke-dasharray="${dash} ${r2(C - dash)}" stroke-dashoffset="${r2(-off)}" data-tip="${esc(d.label)}: ${shown ? esc(shown) + ' · ' : ''}${pct}%"><title>${esc(d.label)}: ${pct}%</title></circle>`;
    legend += `<li class="legend-row"${s.filter ? ` data-filter-key="${esc(seriesKey(d, i))}"` : ''}><span class="dot cat-${cat}"></span><span class="legend-label">${esc(d.label)}</span>${shown ? `<span class="legend-val">${esc(shown)}</span>` : ''}<span class="legend-pct">${pct}%</span></li>`;
    off += dash;
  });
  // the centre total must fit the hole (inner diameter 120 units): shrink long values
  // like "¥58.4M" instead of letting them spill over the ring
  const total = String(s.total || '');
  const fs = total ? Math.max(18, Math.min(40, Math.floor(40 * 104 / Math.max(textW(total, 0.6 * 40, 40), 1)))) : 40;
  // the caption under it is SVG text too: as large as the hole allows (12–16 user units → ≥10px at the 280px ring)
  const cap = String(s.totalLabel || t('total'));
  const lfs = Math.max(12, Math.min(16, Math.floor(108 / Math.max(textW(cap.toUpperCase(), 0.72, 1.05), 1))));
  return { css: ['chart-donut'], html: `<figure class="donut card-outlined" data-chart-tip>` + (s.title ? `<figcaption class="donut-title">${esc(s.title)}</figcaption>` : '') + `<div class="donut-body"><svg viewBox="0 0 320 320" role="img" aria-label="${esc(ariaSummary(s.title || 'donut chart', segsIn.map((d) => `${d.label} ${Math.round(fin(d.value) / sum * 100)}%`)))}"><circle class="track" cx="160" cy="160" r="80"/><g transform="rotate(-90 160 160)">${segs}</g>${total ? `<text class="total" x="160" y="${r2(160 + fs * 0.12)}" style="font-size:${fs}px">${esc(total)}</text><text class="total-label" x="160" y="${r2(160 + fs * 0.12 + lfs + 8)}" style="font-size:${lfs}px">${esc(cap)}</text>` : ''}</svg><ul class="donut-legend stack"${s.filter ? ` role="group" aria-label="${esc(t('filterBy'))}"` : ' aria-hidden="true"'}>${legend}</ul></div></figure>` };
}

/* ---- progress: labeled linear meter bars (completion / budget / quota) ---- */
R.progress = (s) => {
  const items = s.items || [];
  const row = (it) => {
    const max = +it.max || 100, v = +it.value || 0;
    const vC = Math.max(0, Math.min(v, max));
    const pct = r2(Math.max(0, Math.min(v / max, 1)) * 100);
    const disp = esc(it.display != null ? it.display : (String(it.value) + (it.suffix || '')));
    const tone = it.tone ? ` pr-${esc(it.tone)}` : '';
    return `<div class="pr-row"><div class="pr-head"><span class="pr-label">${esc(it.label)}</span><span class="pr-val">${disp}</span></div>` +
      `<div class="pr-track" role="progressbar" aria-label="${esc(it.label)}" aria-valuenow="${esc(vC)}" aria-valuemin="0" aria-valuemax="${esc(max)}"><span class="pr-fill${tone}" style="width:${pct}%"></span></div></div>`;
  };
  return { css: ['progress'], html: `<section class="progress-list card-outlined" aria-label="${esc(s.title || 'Progress')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + items.map(row).join('') + `</section>` };
};

/* ---- gauge: radial progress rings (single value vs target) ---- */
R.gauge = (s) => {
  const C = 326.73; // 2·π·52
  const items = s.items || [];
  const one = (it) => {
    const max = +it.max || 100, v = +it.value || 0, frac = Math.max(0, Math.min(v / max, 1));
    const seg = r2(frac * C), gap = r2(C - seg);
    const disp = esc(it.display != null ? it.display : (Math.round(frac * 100) + '%'));
    const tone = it.tone ? ` g-${esc(it.tone)}` : '';
    return `<figure class="gauge${tone}"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(it.label || '')}: ${disp}"><circle class="gauge-track" cx="60" cy="60" r="52"/><circle class="gauge-arc" cx="60" cy="60" r="52" stroke-dasharray="${seg} ${gap}" transform="rotate(-90 60 60)"/><text class="gauge-val" x="60" y="60">${disp}</text></svg>${it.label ? `<figcaption class="gauge-label">${esc(it.label)}</figcaption>` : ''}</figure>`;
  };
  return { css: ['gauge'], html: `<section class="gauge-sec" aria-label="${esc(s.title || 'Gauges')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + `<div class="gauge-grid">` + items.map(one).join('') + `</div></section>` };
};

/* ---- radar: multi-axis spider chart (computed polygon coords) ---- */
R.radar = (s) => {
  const axes = s.axes || [], N = axes.length, cx = 160, cy = 160, R = 110;
  const series = s.series || [];
  const nums = series.flatMap((se) => (se.values || []).map(Number)).filter(Number.isFinite);
  const max = +s.max || Math.max(1, ...nums, 1);
  const ang = (i) => (-90 + i * 360 / N) * Math.PI / 180;
  const pt = (i, frac) => [r2(cx + Math.cos(ang(i)) * R * frac), r2(cy + Math.sin(ang(i)) * R * frac)];
  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach((f) => { grid += `<polygon class="radar-ring" points="${axes.map((_, i) => pt(i, f).join(',')).join(' ')}"/>`; });
  // axis labels are SVG text, so they scale with the drawing: size them in user units,
  // wrap long ones onto two lines, and fit the viewBox to their real extents - the chart
  // is shrunk only as far as its longest label demands (a fixed wide viewBox rendered
  // them at ~7px in a half card). Drawn at 0.8 scale at most → 17 units ≈ 13.6px.
  const FS = 17, LH = FS * 1.15;
  let spokes = '', labels = '', x0 = cx - R, x1 = cx + R, y0 = cy - R, y1 = cy + R;
  axes.forEach((a, i) => {
    const [x, y] = pt(i, 1); spokes += `<line class="radar-spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
    const [lx, ly] = pt(i, 1.14); const anchor = Math.abs(lx - cx) < 6 ? 'middle' : (lx > cx ? 'start' : 'end');
    const str = String(a == null ? '' : a), sp = [...str.matchAll(/ /g)].map((m) => m.index);
    const cut = str.length > 10 && sp.length ? sp.reduce((b, k) => (Math.abs(k - str.length / 2) < Math.abs(b - str.length / 2) ? k : b)) : -1;
    const lines = cut > 0 ? [str.slice(0, cut), str.slice(cut + 1)] : [str];
    const w = Math.max(...lines.map((l) => textW(l, FS * 0.58, FS)));
    const top = r2(ly + FS * 0.35 - (lines.length - 1) * LH / 2);
    const left = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
    x0 = Math.min(x0, left); x1 = Math.max(x1, left + w); y0 = Math.min(y0, top - FS); y1 = Math.max(y1, top + (lines.length - 1) * LH + 5);
    labels += `<text class="radar-axis" x="${lx}" y="${top}" text-anchor="${anchor}">` +
      (lines.length > 1 ? lines.map((l, k) => `<tspan x="${lx}" dy="${k ? r2(LH) : 0}">${esc(l)}</tspan>`).join('') : esc(str)) + `</text>`;
  });
  const vbW = x1 - x0 + 12, vb = [x0 - 6, y0 - 6, vbW, y1 - y0 + 12].map(r2).join(' ');
  let polys = '', legend = '';
  series.forEach((se, si) => {
    const cat = se.cat || ((si % 5) + 1);
    const points = (se.values || []).map((v, i) => pt(i, Math.max(0, Math.min((Number.isFinite(+v) ? +v : 0) / max, 1))).join(',')).join(' ');
    polys += `<polygon class="radar-area cat-${cat}" points="${points}"><title>${esc(se.label || '')}</title></polygon>`;
    legend += `<li class="legend-row"><span class="dot cat-${cat}"></span><span class="legend-label">${esc(se.label || '')}</span></li>`;
  });
  const seriesLabels = series.map((se) => se.label).filter(Boolean);
  const aria = (s.title || 'radar chart') + (seriesLabels.length ? ': ' + seriesLabels.join(', ') : '');
  return { css: ['radar'], html: `<figure class="radar card-outlined">` + (s.title ? `<figcaption class="radar-title">${esc(s.title)}</figcaption>` : '') + `<div class="radar-body"><svg viewBox="${vb}" style="max-width:${Math.round(vbW * 0.8)}px" role="img" aria-label="${esc(aria)}">${grid}${spokes}${labels}${polys}</svg><ul class="radar-legend stack" aria-hidden="true">${legend}</ul></div></figure>` };
};

/* ---- funnel: conversion stages - bar length vs the first stage, plus the step rate.
   Bars start at a shared left edge (a centred taper made a 1% stage a 3px sliver you
   could not compare), and every stage states both "of first stage" and "from previous". ---- */
R.funnel = (s) => {
  const stages = s.stages || [];
  const top = Math.max(1e-9, fin((stages[0] || {}).value) || 1);
  const pctTxt = (x) => (x >= 10 || x === 0 ? Math.round(x) : x >= 1 ? +x.toFixed(1) : +x.toFixed(2)) + '%';
  const rows = stages.map((st, i) => {
    const v = fin(st.value), of = Math.max(0, Math.min(v / top, 1)) * 100;
    const prev = i ? fin(stages[i - 1].value) : 0;
    const disp = esc(st.display != null ? st.display : groupDigits(String(v)));
    const step = i && prev ? `<span class="fn-step" title="${esc(t('stepRate'))}">→ ${pctTxt(v / prev * 100)}</span>` : '';
    return `<div class="fn-row"><div class="fn-head"><span class="fn-label">${esc(st.label)}</span><span class="fn-val">${disp}<span class="fn-pct">${i ? `${pctTxt(of)} ${esc(t('ofTop'))}` : '100%'}</span></span></div>` +
      `<div class="fn-barwrap"><div class="fn-bar cat-${catOf(st.cat, i)}" style="width:${r2(of)}%"></div>${step}</div></div>`;
  }).join('');
  return { css: ['funnel'], html: `<section class="funnel card-outlined" aria-label="${esc(s.title || 'Funnel')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + rows + `</section>` };
};

/* ---- heatmap: value-shaded matrix (token color-mix intensity) ---- */
R.heatmap = (s) => {
  const rows = s.rows || [], x = s.xLabels || [], y = s.yLabels || [];
  const flat = rows.flat().map(Number).filter(Number.isFinite);
  const max = s.max != null ? +s.max : (flat.length ? Math.max(...flat) : 1);
  const min = s.min != null ? +s.min : (flat.length ? Math.min(...flat) : 0);
  const span = (max - min) || 1;
  const head = `<tr><td class="hm-corner"></td>` + x.map((c) => `<th scope="col" class="hm-x">${esc(c)}</th>`).join('') + `</tr>`;
  const body = rows.map((row, ri) => `<tr><th scope="row" class="hm-y">${esc(y[ri] || '')}</th>` + row.map((v, ci) => {
    const frac = Math.max(0, Math.min((+v - min) / span, 1));
    const pct = r2(8 + frac * 62);
    return `<td class="hm-cell" style="background:color-mix(in srgb, var(--accent) ${pct}%, var(--bg-muted))" title="${esc(y[ri] || '')} · ${esc(x[ci] || '')}: ${esc(v)}"><span class="hm-v">${esc(v)}</span></td>`;
  }).join('') + `</tr>`).join('');
  return { css: ['heatmap'], html: `<figure class="heatmap card-outlined"><div class="hm-scroll"><table class="hm-table" aria-label="${esc(s.title || 'heatmap matrix')}">` + (s.title ? `<caption class="hm-title">${esc(s.title)}</caption>` : '') + `<thead>${head}</thead><tbody>${body}</tbody></table></div></figure>` };
};

/* a column whose every filled cell is a number (with an optional currency / unit) is numeric:
   right-aligned tabular figures so magnitudes line up; JS numbers get thousands separators */
const NUMERIC_CELL = /^[+\-−±]?\s?[¥$€£₩]?\s?[+\-−]?[\d,]*\.?\d+\s?(%|pt|pp|ms|s|h|x|×|[KMBk]|件|円|万|億|人|名|社|台|回|時間|日|か月|ヶ月|원|개|명|건|초|분|배|번째)?$/;
R.table = (s) => {
  /* badge cells ({text, badge}) and a trailing "(note)" count toward the column type, and in a table
     holding badges every numeric column is centred so the pills and the plain figures share one axis */
  const bare = (c) => String(typeof c === 'object' ? c.text : c).trim().replace(/\s*\([^()]*\)$/, '');
  const pills = s.rows.some((r) => Array.isArray(r) && r.some((c) => c && typeof c === 'object'));
  const cls = s.columns.map((_, j) => {
    const cells = s.rows.map((r) => (Array.isArray(r) ? r[j] : null)).filter((c) => c != null && c !== '');
    if (!cells.length || !cells.every((c) => NUMERIC_CELL.test(bare(c)))) return '';
    return pills ? ' class="num num-badge"' : ' class="num"';
  });
  const cell = (c) => (typeof c === 'number' && Math.abs(c) >= 1000 ? groupDigits(c) : c);
  const head = s.columns.map((c, j) => `<th${cls[j]}>${esc(c)}</th>`).join('');
  const body = s.rows.map((row) => `<tr class="dt-row">` + row.map((c, j) => (c && typeof c === 'object') ? `<td${cls[j] || ''}><span class="badge badge-${esc(c.badge)}">${esc(c.text)}</span></td>` : `<td${cls[j] || ''}>${esc(cell(c))}</td>`).join('') + `</tr>`).join('');
  const pag = s.paginate ? ` data-paginate data-page-size="${esc(s.paginate)}"` : '';
  const sel = s.select ? ' data-row-select' : '';
  const dense = s.density === 'compact' ? ' class="dt-compact"' : '';
  const search = s.search === false ? '' : `<input class="dt-search" type="search" data-filter data-filter-in=".dt-row" placeholder="${esc(s.placeholder || t('searchPlaceholder'))}" aria-label="${esc(s.placeholder || t('search'))}">`;
  const pager = s.paginate ? `<div data-pager class="no-print"></div>` : '';
  const caption = s.title ? `<caption class="dt-title">${esc(s.title)}</caption>` : '';
  return { css: ['data-table'], html: `<section class="data-table" aria-label="${esc(s.label || s.title || t('table'))}">${search}<div class="dt-scroll"><table${dense} data-sortable${pag}${sel}>${caption}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${pager}</section>` };
};

const GLYPH = { tldr: '<path d="M5 4h14v16l-7-3-7 3z"/>', note: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>', warning: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/>', success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>' };
R.callout = (s) => { const v = s.variant || 'note'; return { css: ['callout-box'], html: `<div class="callout callout-box callout-${esc(v)}"><svg class="callout-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" role="img" aria-label="${esc(v)}">${GLYPH[v] || GLYPH.note}</svg><div>${s.title ? `<p class="callout-title">${esc(s.title)}</p>` : ''}<div class="callout-body">${s.body != null ? mdBlocks(mdSource(s.body)) : ''}</div></div></div>` }; };

R.stepper = (s) => {
  const steps = s.steps.map((st) => `<div class="step lvl-${esc(st.level || 'info')}" data-n="${esc(st.n)}" role="listitem"><h4>${esc(st.title)}${st.event ? ` <span class="ev">${esc(st.event)}</span>` : ''}</h4><p class="mech">${st.fn ? `<code>${esc(st.fn)}</code> ` : ''}${esc(st.desc)}</p>` +
    ((st.branches && st.branches.length) ? `<div class="branchrow">` + st.branches.map((b) => `<div class="br ${esc(b.kind || 'go')}"><b>${esc(b.label)}</b>${esc(b.desc)}</div>`).join('') + `</div>` : '') + `</div>`).join('');
  return { css: ['stepper'], html: `<section class="stepper-wrap stack" aria-label="${esc(s.title || 'Stepper')}">` + (s.title ? `<div class="stack" style="--sp-4: var(--sp-1);"><h2>${esc(s.title)}</h2>${s.desc ? `<p class="lede">${esc(s.desc)}</p>` : ''}</div>` : '') + `<div class="stepper" role="list">${steps}</div></section>` };
};

R.timeline = (s) => ({ css: ['timeline'], html: `<section aria-label="${esc(s.label || s.title || 'Timeline')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + `<ol class="timeline">` + s.events.map((e) => `<li class="tl-event is-${esc(e.status || 'todo')}"><span class="tl-date eyebrow">${esc(e.date)}</span><article class="card-outlined"><h3 class="tl-title">${esc(e.title)}</h3><p class="tl-body">${esc(e.body)}</p></article></li>`).join('') + `</ol></section>` });

/* a CTA is a link only when it has somewhere to go (`href`, e.g. "#pricing"); a bare label
   becomes a non-interactive chip - never an inert <a href="#"> or <button> */
const ctaHtml = (cta, href) => {
  if (!cta) return '';
  const label = typeof cta === 'object' ? cta.label : cta;
  const to = (typeof cta === 'object' && cta.href) || href;
  return to ? `<a class="btn" href="${esc(to)}">${esc(label)}</a>` : `<span class="chip option-cta">${esc(label)}</span>`;
};
R.comparison = (s) => ({
  css: ['comparison-grid'], html: `<section aria-label="${esc(s.label || s.title || t('comparison'))}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + `<div class="grid cmp-grid" style="--cmp-cols:${Math.min((s.options || []).length, 4)}">` +
    s.options.map((o) => `<article class="card-outlined option${o.recommended ? ' card-accent' : ''}"><header class="option-head"><h3>${esc(o.name)}</h3>${o.recommended ? `<span class="badge badge-accent">${esc(t('recommended'))}</span>` : ''}</header>` +
      `<ul aria-label="${esc(t('pros'))}">${(o.pros || []).map((p) => `<li class="pro">${esc(p)}</li>`).join('')}</ul>` +
      `<ul aria-label="${esc(t('cons'))}">${(o.cons || []).map((c) => `<li class="con">${esc(c)}</li>`).join('')}</ul>` +
      `<dl>${(o.metrics || []).map((m) => `<dt>${esc(m.k)}</dt><dd>${esc(m.v)}</dd>`).join('')}</dl>` +
      ctaHtml(o.cta, o.href) + `</article>`).join('') + `</div></section>`,
});

R.tabs = (s) => {
  const ids = s.tabs.map((t, i) => t.id || ('t' + (i + 1)));
  const bar = s.tabs.map((t, i) => `<button class="tab${i === 0 ? ' active' : ''}" data-tab="${esc(ids[i])}" role="tab" aria-selected="${i === 0}" aria-controls="panel-${esc(ids[i])}">${esc(t.label)}</button>`).join('');
  const panels = s.tabs.map((t, i) => `<div class="stack${i === 0 ? '' : ' hidden'}" data-panel="${esc(ids[i])}" id="panel-${esc(ids[i])}" role="tabpanel" aria-label="${esc(t.label)}">${t.body || ''}</div>`).join('');
  return { css: ['tabs'], html: `<section class="tabs" data-tabs aria-label="${esc(s.label || s.title || 'Tabs')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + `<div class="tab-bar" role="tablist">${bar}</div>${panels}</section>` };
};

/* ---- screenflow: app screen-flow map - target-aware lo-fi screens + labeled arrows ---- */
R.screenflow = (s) => {
  const rawFrame = String(s.frame || s.device || '').toLowerCase();
  const isBrowserFrame =
    ['browser', 'desktop', 'web'].includes(rawFrame) ||
    (ACTIVE_TARGET === 'web-app' && !['phone', 'tablet'].includes(rawFrame));
  const bars = (n) => Array.from({ length: n }, (_, i) => `<span class="sf-bar ${i % 2 ? '-w75' : '-w90'}"></span>`).join('');
  const EL = {
    heading: (e) => `<div class="sf-heading">${esc(e.label || '')}</div>`,
    text: (e) => e.label ? `<p class="sf-note">${esc(e.label)}</p>` : `<div>${bars(+e.lines || 2)}</div>`,
    image: (e) => `<div class="sf-img"><svg viewBox="0 0 200 76" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="198" height="74"/><line x1="1" y1="1" x2="199" y2="75"/><line x1="199" y1="1" x2="1" y2="75"/></svg>${e.label ? `<span class="sf-img-label">${esc(e.label)}</span>` : ''}</div>`,
    input: (e) => `<div class="sf-input">${esc(e.label || '')}</div>`,
    button: (e) => `<div class="sf-btn${e.variant === 'primary' ? ' -primary' : ''}">${esc(e.label || '')}</div>`,
    search: (e) => `<div class="sf-search"><span class="sf-search-ic" aria-hidden="true"></span>${esc(e.label || t('searchPlaceholder'))}</div>`,
    list: (e) => `<div class="sf-list">${(e.items || []).map((it) => `<div class="sf-listrow"><span class="sf-avatar" aria-hidden="true"></span><div class="sf-listbody"><span class="sf-listlabel">${esc(it)}</span><span class="sf-bar -w60"></span></div></div>`).join('')}</div>`,
    chips: (e) => `<div class="sf-chips">${(e.items || []).map((c) => `<span class="sf-chip">${esc(c)}</span>`).join('')}</div>`,
    divider: () => `<hr class="sf-divider">`,
    card: (e) => `<div class="sf-card">${e.label ? `<span class="sf-card-title">${esc(e.label)}</span>` : ''}${bars(+e.lines || 2)}</div>`,
  };
  const flows = s.flows || [];
  const steps = (s.screens || []).map((sc, i) => {
    const body = (sc.elements || []).map((e) => (EL[e.t] || EL.text)(e)).join('');
    const tabs = Array.isArray(sc.tabbar)
      ? `<nav class="${isBrowserFrame ? 'sf-webnav' : 'sf-tabbar'}" aria-hidden="true">${sc.tabbar.map((tb, ti) => `<span class="sf-tab${ti === (+sc.activeTab || 0) ? ' active' : ''}">${esc(tb)}</span>`).join('')}</nav>`
      : '';
    const appbar = sc.appbar === false ? '' : `<div class="sf-appbar">${esc(sc.appbar || sc.name || '')}</div>`;
    const browserTitle = esc(sc.appbar === false ? sc.name || '' : sc.appbar || sc.name || '');
    const browserUrl = esc(sc.url || `/${String(sc.name || `screen-${i + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `screen-${i + 1}`}`);
    const frame = isBrowserFrame
      ? `<div class="sf-browser"><div class="sf-browser-top" aria-hidden="true"><span class="sf-traffic"><i></i><i></i><i></i></span><span class="sf-url">${browserUrl}</span><span class="sf-browser-title">${browserTitle}</span></div>${appbar}<div class="sf-body">${body}</div>${tabs}</div>`
      : `<div class="sf-phone"><span class="sf-notch" aria-hidden="true"></span><div class="sf-status"><span>9:41</span><span class="sf-status-ic" aria-hidden="true"></span></div>${appbar}<div class="sf-body">${body}</div>${tabs}</div>`;
    return `<div class="sf-step">${frame}<div class="sf-caption"><span class="sf-name">${i + 1}. ${esc(sc.name || '')}</span>${sc.caption ? `<p class="sf-desc">${esc(sc.caption)}</p>` : ''}</div></div>`;
  });
  const parts = [];
  steps.forEach((step, i) => {
    parts.push(step);
    if (i < steps.length - 1) {
      const fl = flows[i] || {};
      parts.push(`<div class="sf-arrow"><svg viewBox="0 0 56 16" width="56" height="16" aria-hidden="true"><line x1="0" y1="8" x2="44" y2="8"/><path d="M44 2 L55 8 L44 14 Z"/></svg>${fl.label ? `<span class="sf-arrow-label">${esc(fl.label)}</span>` : ''}</div>`);
    }
  });
  const frameAttrs = isBrowserFrame
    ? ' data-frame="browser" data-device="desktop"'
    : `${s.device === 'tablet' ? ' data-device="tablet"' : ''} data-device-frame`;
  return {
    css: ['screen-flow'],
    html: `<section class="sf-flow"${frameAttrs} aria-label="${esc(s.title || t('screenFlow'))}">` +
      (s.title ? `<h2>${esc(s.title)}</h2>` : '') +
      (s.desc ? `<p class="lede">${esc(s.desc)}</p>` : '') +
      `<div class="sf-track">${parts.join('')}</div></section>`,
  };
};

/* ---- decision: weighted matrix - totals & winner computed from the data ---- */
R.decision = (s) => {
  const opts = s.options || [];
  const crits = s.criteria || [];
  const scale = +s.scale || 5;
  const totals = opts.map((_, oi) => crits.reduce((a, c) => a + (c.weight == null ? 1 : +c.weight) * (+((c.scores || [])[oi]) || 0), 0));
  const maxTotal = crits.reduce((a, c) => a + (c.weight == null ? 1 : +c.weight) * scale, 0) || 1;
  let win = 0;
  totals.forEach((v, i) => { if (v > totals[win]) win = i; });
  if (s.verdict && s.verdict.pick) { const pi = opts.indexOf(s.verdict.pick); if (pi >= 0) win = pi; }
  const col = (oi) => `dm-c${(oi % 5) + 1}${oi === win ? ' -winner' : ''}`;
  const head = `<tr><th class="dm-crit" scope="col">${esc(t('criterion'))}</th>` +
    opts.map((o, oi) => `<th class="dm-opt ${col(oi)}" scope="col">${esc(o)}${oi === win ? ` <span class="badge badge-accent">${esc(t('recommended'))}</span>` : ''}</th>`).join('') + `</tr>`;
  const compact = s.variant === 'compact';
  const rows = crits.map((c) => `<tr><th scope="row" class="dm-crit">${esc(c.name)}<span class="dm-weight">×${esc(c.weight == null ? 1 : c.weight)}</span></th>` +
    opts.map((_, oi) => {
      const sc = +((c.scores || [])[oi]) || 0;
      const note = (c.notes || [])[oi];
      const noteTitle = compact && note ? ` title="${esc(note)}"` : '';
      const noteHtml = !compact && note ? `<p class="dm-note">${esc(note)}</p>` : '';
      return `<td class="dm-cell ${col(oi)}"${noteTitle}><div class="dm-score"><span class="dm-bar"><span class="dm-fill" style="width:${r2(Math.min(sc / scale, 1) * 100)}%"></span></span><span class="dm-num">${sc}</span></div>${noteHtml}</td>`;
    }).join('') + `</tr>`).join('');
  const foot = `<tr><th scope="row" class="dm-crit">${esc(t('weightedTotal'))}</th>` +
    opts.map((_, oi) => `<td class="dm-cell dm-total ${col(oi)}"><div class="dm-score"><span class="dm-bar -total"><span class="dm-fill" style="width:${r2(totals[oi] / maxTotal * 100)}%"></span></span><span class="dm-num">${totals[oi]}<span class="dm-max">/${maxTotal}</span></span></div></td>`).join('') + `</tr>`;
  const rationale = (s.verdict && s.verdict.rationale) || t('highestWeightedScore');
  const verdict = `<div class="callout callout-box callout-success dm-verdict"><svg class="callout-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" role="img" aria-label="success">${GLYPH.success}</svg><div><p class="callout-title">${esc(t('recommended'))}: ${esc(opts[win] || '')}</p><div class="callout-body"><p>${esc(rationale)}</p></div></div></div>`;
  return {
    css: ['decision-matrix', 'callout-box'],
    html: `<section class="decision-matrix" aria-label="${esc(s.title || t('decisionMatrix'))}">` +
      (s.title ? `<h2>${esc(s.title)}</h2>` : '') +
      (s.desc ? `<p class="lede">${esc(s.desc)}</p>` : '') +
      `<div class="dm-scroll"><table class="dm-table"><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>${verdict}</section>`,
  };
};

R.collapsible = (s) => ({ css: ['collapsible'], html: `<section class="collapsible-list" aria-label="${esc(s.label || s.title || t('faq'))}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + s.items.map((it) => `<details class="collapsible"${it.open ? ' open' : ''}><summary>${esc(it.summary)}<svg class="chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></summary><div class="collapsible-body">${it.body || ''}</div></details>`).join('') + `</section>` });

/* ---- tree: collapsible hierarchy (file tree / outline / taxonomy) ---- */
R.tree = (s) => {
  const node = (n) => {
    const kids = n.children || [];
    const label = `<span class="tw-label">${esc(n.label)}</span>${n.meta ? `<span class="tw-meta">${esc(n.meta)}</span>` : ''}`;
    if (kids.length) {
      return `<li class="tw-node" data-tree-node><div class="tw-row" data-tree-toggle><span class="tw-caret" aria-hidden="true">▾</span>${label}</div><ul class="tw-children" data-children>${kids.map(node).join('')}</ul></li>`;
    }
    return `<li class="tw-node tw-leaf" data-tree-node><div class="tw-row"><span class="tw-bullet" aria-hidden="true"></span>${label}</div></li>`;
  };
  return { css: ['tree'], html: `<section aria-label="${esc(s.title || 'Tree')}">` + (s.title ? `<h2 class="tw-title">${esc(s.title)}</h2>` : '') + `<ul class="tree" data-tree>${(s.nodes || []).map(node).join('')}</ul></section>` };
};

/* ---- statlist: definition / spec key→value sheet ---- */
R.statlist = (s) => {
  const cols = Math.min(Math.max(parseInt(s.columns, 10) || 1, 1), 3);
  const arr = s.items || [];
  const lastRowStart = arr.length - ((arr.length % cols) || cols);
  const items = arr.map((it, i) => {
    const cls = ['sl-item'];
    if (i % cols !== 0) cls.push('sl-sep');     // column separator (not first column)
    if (i >= lastRowStart) cls.push('sl-lastrow'); // last grid row → no bottom hairline
    const val = it.badge ? `<span class="badge badge-${esc(it.badge)}">${esc(it.v)}</span>` : esc(it.v);
    return `<div class="${cls.join(' ')}"><dt class="sl-k">${esc(it.k)}</dt><dd class="sl-v">${val}${it.note ? `<span class="sl-note">${esc(it.note)}</span>` : ''}</dd></div>`;
  }).join('');
  return { css: ['stat-list'], html: `<section aria-label="${esc(s.title || 'Details')}">` + (s.title ? `<h2 class="sl-title">${esc(s.title)}</h2>` : '') + `<dl class="stat-list" style="--sl-cols:${cols}">${items}</dl></section>` };
};

/* ---- shared inline line-icon set (offline, currentColor-stroked) ---- */
const ICONS = {
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  spark: '<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  rocket: '<path d="M5 15c-1.2 1-2 4-2 4s3-.8 4-2M14 4c4 1 6 5 6 5l-7 7-4-4z"/><circle cx="14.5" cy="9.5" r="1.4"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5M3 18l9 5 9-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 5a3.4 3.4 0 0 1 0 7M21 20c0-2.5-2-4.5-4.5-5"/>',
  code: '<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>',
  star: '<path d="M12 3l2.6 5.6L20 9.3l-4 4 1 6-5-2.8L7 19.3l1-6-4-4 5.4-.7z"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  inbox: '<path d="M5 5h14l2 8v6H3v-6z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  box: '<path d="M12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/>',
  add: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
  comment: '<path d="M4 5h16v11H9l-4 3z"/>',
  merge: '<circle cx="7" cy="6" r="2.5"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="12" r="2.5"/><path d="M7 8.5v7M7 12h6a2 2 0 0 0 2-2"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  queue: '<rect x="2" y="4" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="16" width="20" height="4" rx="1"/>',
  server: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><line x1="6" y1="7" x2="6.01" y2="7"/><line x1="6" y1="17" x2="6.01" y2="17"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
  laptop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  router: '<rect x="2" y="14" width="20" height="6" rx="2"/><path d="M6 10a8 8 0 0 1 12 0M9 12a4 4 0 0 1 6 0"/><line x1="6" y1="17" x2="6.01" y2="17"/><line x1="10" y1="17" x2="10.01" y2="17"/>',
};
const iconSvg = (name, cls) => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;

/* ---- features: icon + title + body capability cards ---- */
R.features = (s) => {
  const cols = Math.min(Math.max(parseInt(s.columns, 10) || 3, 1), 4);
  const cards = (s.items || []).map((it) => `<article class="feat card-outlined"><span class="feat-ic">${iconSvg(it.icon)}</span><h3 class="feat-title">${esc(it.title)}</h3><p class="feat-body">${esc(it.body)}</p>${it.tag ? `<span class="badge badge-accent feat-tag">${esc(it.tag)}</span>` : ''}</article>`).join('');
  return { css: ['feature-grid'], html: `<section class="feat-sec" aria-label="${esc(s.title || 'Features')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + (s.desc ? `<p class="lede">${esc(s.desc)}</p>` : '') + `<div class="feat-grid" style="--feat-cols:${cols}">${cards}</div></section>` };
};

/* ---- stattrend: KPI cards with an inline sparkline trend ---- */
R.stattrend = (s) => {
  const items = s.items || [];
  const cols = Math.min(Math.max(parseInt(s.columns, 10) || Math.min(items.length || 3, 4), 1), 4);
  const spark = (nums0, trend, label) => {
    const nums = nums0.filter(Number.isFinite); const n = nums.length; if (!n) return '';
    const W = 120, H = 36, pad = 4;
    const max = Math.max(...nums), min = Math.min(...nums), span = (max - min) || 1;
    const xs = (i) => r2(pad + (n > 1 ? i / (n - 1) : 0) * (W - 2 * pad));
    const ys = (v) => r2((H - pad) - ((+v - min) / span) * (H - 2 * pad));
    const pts = nums.map((v, i) => `${xs(i)},${ys(v)}`).join(' ');
    const area = `M${xs(0)} ${H - pad} ` + nums.map((v, i) => `L${xs(i)} ${ys(v)}`).join(' ') + ` L${xs(n - 1)} ${H - pad} Z`;
    const cls = trend === 'up' ? ' -up' : trend === 'down' ? ' -down' : '';
    return `<svg class="spark${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc((label || 'metric') + ' trend')}"><path class="spark-area" d="${area}"/><polyline class="spark-line" points="${pts}"/><circle class="spark-dot" cx="${xs(n - 1)}" cy="${ys(nums[n - 1])}" r="2.4"/></svg>`;
  };
  const card = (it) => {
    const delta = it.delta ? `<span class="metric-delta-${it.dir === 'down' ? 'down' : 'up'}">${it.dir === 'down' ? '▼' : '▲'} ${esc(it.delta)}</span>` : '';
    const value = `<span class="metric-value"${it.valueNum != null ? ` data-counter data-to="${esc(it.valueNum)}"` : ''}${it.suffix ? ` data-suffix="${esc(it.suffix)}"` : ''}>${esc(it.value)}</span>`;
    return `<article class="card-outlined metric stat-trend"><span class="metric-label">${esc(it.label)}</span>${value}${delta}${spark((it.series || []).map(Number), it.trend, it.label)}</article>`;
  };
  return { css: ['stat-trend'], html: `<section class="st-sec" aria-label="${esc(s.title || 'Metrics')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + `<div class="st-grid" style="--st-cols:${cols}">${items.map(card).join('')}</div></section>` };
};

/* ---- barstacked: stacked / grouped / 100%-stacked bars (same HTML-hybrid frame) ---- */
R.barstacked = (s) => {
  const cats = s.categories || [], series = s.series || [], N = Math.max(cats.length, 1), mode = s.mode || 'stacked';
  const V = series.map((se) => cats.map((_, c) => Math.max(0, fin((se.values || [])[c]))));
  const totals = cats.map((_, c) => V.reduce((a, row) => a + row[c], 0));
  const dom = mode === 'percent' ? niceDomain([0, 100], true, 0, 100)
    : niceDomain(mode === 'grouped' ? V.flat().concat(0) : totals.concat(0), true, s.yMin, s.yMax);
  const fmt = mode === 'percent' ? (v) => `${fmtNum(v)}%` : axisFormat([], s);
  const m = series.length || 1;
  const slots = cats.map((cat, c) => {
    let inner = '';
    if (mode === 'grouped') {
      const gw = 72, bw = gw / m;
      series.forEach((se, si) => {
        const v = V[si][c];
        inner += `<div class="hc-bar hc-sub cat-${catOf(se.cat, si)}" style="left:${r2((100 - gw) / 2 + si * bw)}%;width:calc(${r2(bw)}% - 2px);bottom:0;height:${pctOf(v, dom)}%" data-tip="${esc(se.label)} · ${esc(cat)}: ${esc(fmt(v))}"></div>`;
      });
    } else {
      let acc = 0;
      series.forEach((se, si) => {
        const raw = V[si][c], v = mode === 'percent' ? (totals[c] ? raw / totals[c] * 100 : 0) : raw;
        const h = pctOf(v, dom) - pctOf(0, dom), top = si === m - 1 || series.slice(si + 1).every((_, k) => !V[si + 1 + k][c]);
        const disp = mode === 'percent' ? `${Math.round(v)}% (${fmtNum(raw)})` : fmt(raw);
        inner += `<div class="hc-bar hc-seg cat-${catOf(se.cat, si)}${top ? ' hc-top' : ''}" style="bottom:${r2(pctOf(0, dom) + acc)}%;height:${r2(h)}%" data-tip="${esc(se.label)} · ${esc(cat)}: ${esc(disp)}"></div>`;
        acc += h;
      });
      if (mode === 'stacked' && N <= 14) inner += `<span class="hc-val hc-sum" style="bottom:${r2(pctOf(0, dom) + acc)}%">${esc(fmt(totals[c]))}</span>`;
    }
    return `<div class="hc-slot">${inner}</div>`;
  }).join('');
  const aria = ariaSummary(s.title || 'stacked bar chart', cats.map((cat, c) => `${cat}: ${series.map((se, si) => `${se.label} ${V[si][c]}`).join(' / ')}`));
  return { css: ['chart-stacked'], html: hcFrame({ cls: 'chart-stacked', title: s.title, aria, height: plotFor(s.size), dom, fmt, dense: N > 6,
    plot: `<div class="hc-bars">${slots}</div>`, x: cats, legend: series.map((se, si) => ({ label: se.label, cat: catOf(se.cat, si) })) }) };
};

/* ---- areastacked: stacked / single (overlapping) / 100% filled-area time series ---- */
R.areastacked = (s) => {
  const xL = s.xLabels || [], series = s.series || [], N = Math.max(xL.length, 1), mode = s.mode || 'stacked';
  const V = series.map((se) => xL.map((_, i) => Math.max(0, fin((se.values || [])[i]))));
  const totals = xL.map((_, i) => V.reduce((a, row) => a + row[i], 0) || 1);
  const rows = mode === 'percent' ? V.map((row) => row.map((v, i) => v / totals[i] * 100)) : V;
  const dom = mode === 'percent' ? niceDomain([0, 100], true, 0, 100)
    : niceDomain(mode === 'single' ? rows.flat().concat(0) : totals.concat(0), true, s.yMin, s.yMax);
  const fmt = mode === 'percent' ? (v) => `${fmtNum(v)}%` : axisFormat([], s);
  const xp = (i) => r2(((i + 0.5) / N) * 100), yp = (v) => r2(100 - pctOf(v, dom));
  let cum = new Array(N).fill(0), svg = '', marks = '';
  rows.forEach((row, si) => {
    const cat = catOf(series[si].cat, si);
    const up = mode === 'single' ? row : cum.map((c, i) => c + row[i]);
    const lo = mode === 'single' ? new Array(N).fill(0) : cum.slice();
    const top = up.map((v, i) => `${xp(i)},${yp(v)}`);
    const bottom = lo.map((v, i) => `${xp(i)},${yp(v)}`).reverse();
    svg += `<path class="hc-area cat-${cat}" d="M${top.join(' L')} L${bottom.join(' L')} Z"/><polyline class="hc-line cat-${cat}" points="${top.join(' ')}" vector-effect="non-scaling-stroke"/>`;
    up.forEach((v, i) => { marks += `<span class="hc-hit" style="left:${xp(i)}%;bottom:${pctOf(v, dom)}%" data-tip="${esc(series[si].label)} · ${esc(xL[i])}: ${esc(mode === 'percent' ? `${Math.round(row[i])}%` : fmt(V[si][i]))}"></span>`; });
    if (mode !== 'single') cum = up;
  });
  const aria = ariaSummary(s.title || 'area chart', series.map((se, si) => `${se.label} ${V[si].join(' → ')}`));
  return { css: ['chart-stacked'], html: hcFrame({ cls: 'chart-stacked hc-areachart', title: s.title, aria, height: plotFor(s.size), dom, fmt, dense: N > 6,
    plot: `<div class="hc-lines"><svg class="hc-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${marks}</div>`,
    x: xL, legend: series.map((se, si) => ({ label: se.label, cat: catOf(se.cat, si) })) }) };
};

/* ---- feed: chronological activity stream with connector line ---- */
R.feed = (s) => {
  const row = (it) => {
    const tone = it.tone ? ` -${esc(it.tone)}` : '';
    return `<li class="af-item${tone}"><span class="af-mark" aria-hidden="true">${iconSvg(it.icon || 'commit', 'af-ic')}</span><div class="af-body"><p class="af-text">${it.actor ? `<span class="af-actor">${esc(it.actor)}</span> ` : ''}${esc(it.text)}</p>${it.time ? `<span class="af-time">${esc(it.time)}</span>` : ''}</div></li>`;
  };
  return { css: ['activity-feed'], html: `<section aria-label="${esc(s.title || 'Activity')}">` + (s.title ? `<h2 class="af-title">${esc(s.title)}</h2>` : '') + `<ul class="activity-feed">${(s.items || []).map(row).join('')}</ul></section>` };
};

/* ---- empty: centered placeholder / zero-state block ---- */
R.empty = (s) => {
  const tone = (s.tone && s.tone !== 'neutral') ? ` -${esc(s.tone)}` : '';
  return { css: ['empty-state'], html: `<section class="empty-state${tone}" aria-label="${esc(s.title || 'Empty state')}"><span class="es-ic">${iconSvg(s.icon || 'inbox')}</span>${s.title ? `<h3 class="es-title">${esc(s.title)}</h3>` : ''}${s.body ? `<p class="es-body">${esc(s.body)}</p>` : ''}${(s.action && s.action.label) ? ctaHtml(s.action) : ''}</section>` };
};

/* ---- checklist: themed checkbox / radio / switch list (settings, acceptance
   criteria, requirements, filters) - REAL interactive controls styled by the
   elements.css form-control primitives; explicit <label for> on every input ---- */
R.checklist = (s, idx) => {
  const items = s.items || [];
  const ctl = s.control === 'radio' ? 'radio' : s.control === 'switch' ? 'switch' : 'checkbox';
  const name = `ck${idx}-${(s.name ? String(s.name).replace(/[^a-zA-Z0-9_-]/g, '') : 'group')}`;
  const isOn = (it) => it.checked === true || it.state === 'done';
  const STATE_BADGE = { done: 'success', pending: 'warning', blocked: 'danger', todo: '' };
  const STATE_LABEL = { done: t('stateDone'), pending: t('statePending'), blocked: t('stateBlocked'), todo: t('stateTodo') };
  const rows = items.map((it, i) => {
    const id = `${name}-${i}`;
    const attrs = `${isOn(it) ? ' checked' : ''}${it.disabled ? ' disabled' : ''}`;
    const input = ctl === 'radio' ? `<input type="radio" id="${id}" name="${name}"${attrs}>`
      : ctl === 'switch' ? `<input class="switch" type="checkbox" role="switch" id="${id}"${attrs}>`
        : `<input type="checkbox" id="${id}"${attrs}>`;
    const badge = (it.state && STATE_BADGE[it.state] != null && it.state !== 'todo')
      ? `<span class="badge badge-${STATE_BADGE[it.state]} ck-state">${esc(STATE_LABEL[it.state] || it.state)}</span>` : '';
    const desc = it.desc ? `<span class="option-desc">${esc(it.desc)}</span>` : '';
    return `<div class="option-row">${input}<label class="ck-text" for="${id}"><span class="option-label">${esc(it.label)}</span>${desc}</label>${badge}</div>`;
  }).join('');
  const done = items.filter(isOn).length;
  const count = s.count === false ? '' : `<span class="ck-count">${done}/${items.length}</span>`;
  const boxed = s.variant === 'plain' ? '' : ' is-boxed';
  const head = s.title ? `<div class="ck-head"><h2>${esc(s.title)}</h2>${count}</div>` : '';
  return { css: ['checklist'], html: `<section class="checklist-sec" aria-label="${esc(s.title || t('checklist'))}">${head}<div class="checklist${boxed}" role="group" aria-label="${esc(s.title || t('checklist'))}">${rows}</div></section>` };
};

/* ---- form: themed prototype form (text / email / select / textarea / checkbox)
   built on the elements.css field primitives; the submit is wired by
   [data-form-mock] (HA.formMock) so it intercepts + confirms, never a dead control ---- */
R.form = (s, idx) => {
  const fields = s.fields || [];
  const field = (f, i) => {
    const id = `fm${idx}-${i}`;
    const nm = ` name="${esc(f.name || id)}"`;   // real name so the markup is copy-paste-usable in a live form
    const kind = f.kind || 'text';
    const req = f.required ? ' required aria-required="true"' : '';
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    const describedby = f.help ? ` aria-describedby="${id}-h"` : '';
    const hint = f.help ? `<span class="field-hint" id="${id}-h">${esc(f.help)}</span>` : '';
    const mark = f.required ? ' <span class="field-req" aria-hidden="true">*</span>'
      : f.optional ? ` <span class="field-opt">(${esc(t('optional'))})</span>` : '';
    if (kind === 'checkbox') {
      return `<div class="option-row field-full"><input type="checkbox" id="${id}"${nm}${f.checked ? ' checked' : ''}${req}${describedby}><label class="ck-text" for="${id}"><span class="option-label">${esc(f.label)}</span>${f.help ? `<span class="option-desc">${esc(f.help)}</span>` : ''}</label></div>`;
    }
    let control;
    if (kind === 'select') {
      control = `<select id="${id}"${nm}${req}${describedby}>${(f.options || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
    } else if (kind === 'textarea') {
      control = `<textarea id="${id}"${nm}${ph}${req}${describedby}></textarea>`;
    } else {
      const type = ['text', 'email', 'password', 'number', 'tel', 'url', 'date', 'search'].includes(kind) ? kind : 'text';
      control = `<input type="${type}" id="${id}"${nm}${ph}${req}${describedby}>`;
    }
    const full = (kind === 'textarea' || f.full) ? ' field-full' : '';
    return `<div class="field${full}"><label for="${id}">${esc(f.label)}${mark}</label>${control}${hint}</div>`;
  };
  const cols = Math.min(Math.max(parseInt(s.columns, 10) || 1, 1), 2);
  const submit = s.submit === false ? '' : `<div class="form-actions"><button class="btn" type="submit">${esc((s.submit && s.submit.label) || t('submitForm'))}</button><span class="form-status" role="status" aria-hidden="true">${esc(t('formSubmitted'))}</span></div>`;
  return {
    css: ['form-fields'], html:
      `<form class="form-fields card-outlined" data-form-mock aria-label="${esc(s.title || t('form'))}">` +
      (s.title ? `<h2>${esc(s.title)}</h2>` : '') +
      (s.desc ? `<p class="lede">${esc(s.desc)}</p>` : '') +
      `<div class="form-grid" style="--form-cols:${cols}">${fields.map(field).join('')}</div>` +
      submit + `</form>`,
  };
};

/* ---- bullet: goal-vs-actual bullet bars (value + target tick + bands) ---- */
R.bullet = (s) => {
  const rows = (s.rows || []).map((r) => {
    const max = +r.max || Math.max(+r.value || 0, +r.target || 0, 1);
    const vpct = r2(Math.max(0, Math.min((+r.value || 0) / max, 1)) * 100);
    const tpct = r2(Math.max(0, Math.min((+r.target || 0) / max, 1)) * 100);
    let band = '';
    if (Array.isArray(r.bands) && r.bands.length >= 2) {
      const b1 = r2(Math.min(r.bands[0] / max, 1) * 100), b2 = r2(Math.min(r.bands[1] / max, 1) * 100);
      band = ` style="background:linear-gradient(to right, color-mix(in srgb, var(--text-muted) 16%, var(--bg-muted)) ${b1}%, color-mix(in srgb, var(--text-muted) 9%, var(--bg-muted)) ${b1}% ${b2}%, var(--bg-muted) ${b2}%)"`;
    }
    const vtext = esc(r.valueText != null ? r.valueText : r.value);
    const aria = `${esc(r.label)}: ${esc(r.value)}${r.target != null ? `, target ${esc(r.target)}` : ''}, max ${esc(max)}`;
    const tick = r.target != null ? `<div class="bl-target" style="inset-inline-start:${tpct}%"></div>` : '';
    return `<div class="bl-row"><span class="bl-label">${esc(r.label)}</span><div class="bl-track"${band} role="img" aria-label="${aria}"><div class="bl-fill" style="width:${vpct}%"></div>${tick}</div><span class="bl-val">${vtext}</span></div>`;
  }).join('');
  return { css: ['chart-bullet'], html: `<section class="bullet-list card-outlined" aria-label="${esc(s.title || 'Bullet chart')}">` + (s.title ? `<h2>${esc(s.title)}</h2>` : '') + rows + `</section>` };
};

/* ---- calendar: GitHub-style contribution heatmap calendar ---- */
R.calendar = (s) => {
  const weeks = s.weeks || [];
  const allv = weeks.flat().map((d) => +(d && d.value) || 0);
  const max = Math.max(1, ...allv);
  const bp = [0, 22, 40, 58, 78];
  const bg = (b) => b === 0 ? 'var(--bg-muted)' : `color-mix(in srgb, var(--accent) ${bp[b]}%, var(--bg-muted))`;
  const cell = (d) => {
    if (!d) return `<span class="cal-cell cal-empty" aria-hidden="true"></span>`;
    const b = d.bucket != null ? Math.max(0, Math.min(parseInt(d.bucket, 10), 4)) : Math.round((+d.value || 0) / max * 4);
    return `<span class="cal-cell" style="background:${bg(b)}" title="${esc(d.date || '')}${d.date != null && d.value != null ? ': ' : ''}${esc(d.value != null ? d.value : '')}"></span>`;
  };
  const grid = weeks.map((w) => `<div class="cal-week">${Array.from({ length: 7 }, (_, i) => cell(w[i])).join('')}</div>`).join('');
  const legend = s.legend === false ? '' : `<div class="cal-legend"><span class="cal-legend-label">Less</span>${[0, 1, 2, 3, 4].map((b) => `<span class="cal-cell" style="background:${bg(b)}"></span>`).join('')}<span class="cal-legend-label">More</span></div>`;
  return { css: ['cal-heatmap'], html: `<figure class="cal-heatmap card-outlined" role="img" aria-label="${esc(s.title || 'activity calendar')}">` + (s.title ? `<figcaption class="cal-title">${esc(s.title)}</figcaption>` : '') + `<div class="cal-scroll"><div class="cal-grid">${grid}</div></div>${legend}</figure>` };
};

/* ---- diagram: deterministic auto-layout (layered / grid / radial / vertical) ---- */
R.diagram = (s, idx) => {
  const nodes = (s.nodes || []).map((n) => ({ ...n }));
  const maxNeedW = Math.max(0, ...nodes.map((n) => Math.max(textW(n.label || '', 7.4, 13.4), textW(n.sub || '', 6.0, 11.2))));
  const NW = Math.max(156, Math.min(228, Math.ceil(maxNeedW + 32))), NH = 54, pad = 42;
  const byId = {}; nodes.forEach((n) => { byId[n.id] = n; });
  let W, H, zones = null;
  const layout = s.layout || 'grid';
  if (layout === 'layered') {
    const zoneNames = s.zones || nodes.map((n) => n.zone).filter((v, i, a) => a.indexOf(v) === i);
    const colGap = 48, zoneGap = 36, padTop = 38, bandH = NH + padTop + 20;
    const perZone = zoneNames.map((z) => nodes.filter((n) => n.zone === z));
    const cols = Math.max(1, ...perZone.map((a) => a.length));
    W = pad * 2 + cols * NW + (cols - 1) * colGap;
    H = pad * 2 + zoneNames.length * bandH + (zoneNames.length - 1) * zoneGap;
    zones = [];
    zoneNames.forEach((z, zi) => {
      const bandY = pad + zi * (bandH + zoneGap), m = perZone[zi].length, total = m * NW + (m - 1) * colGap, startX = (W - total) / 2;
      zones.push({ name: z, y: bandY, h: bandH, zi });
      perZone[zi].forEach((n, i) => { n._x = startX + i * (NW + colGap); n._y = bandY + padTop; });
    });
  } else if (layout === 'radial') {
    const root = nodes.find((n) => n.root) || nodes[0];
    const others = nodes.filter((n) => n !== root);
    const cnt = Math.max(1, others.length);
    const Rx = Math.max(250, Math.ceil((cnt * (NW + 22)) / (2 * Math.PI) * 1.12));
    const Ry = Math.max(205, Math.ceil((cnt * (NH + 38)) / (2 * Math.PI) * 1.25));
    W = Math.max(960, Math.ceil(Rx * 2 + NW + pad * 2));
    H = Math.max(640, Math.ceil(Ry * 2 + NH + pad * 2));
    const cx = W / 2, cy = H / 2;
    root._x = cx - NW / 2; root._y = cy - NH / 2;
    others.forEach((n, i) => {
      const ang = -Math.PI / 2 + i * (2 * Math.PI / cnt);
      n._x = cx + Math.cos(ang) * Rx - NW / 2;
      n._y = cy + Math.sin(ang) * Ry - NH / 2;
    });
    const allRadial = [root, ...others];
    for (let iter = 0; iter < 16; iter++) {
      let moved = false;
      for (let i = 1; i < allRadial.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = allRadial[j], b = allRadial[i];
          const dx = (b._x + NW / 2) - (a._x + NW / 2);
          const dy = (b._y + NH / 2) - (a._y + NH / 2);
          const minX = NW + 18, minY = NH + 16;
          if (Math.abs(dx) < minX && Math.abs(dy) < minY) {
            const penX = minX - Math.abs(dx), penY = minY - Math.abs(dy);
            if (penX < penY) {
              const sgn = dx >= 0 ? 1 : -1;
              if (j === 0) b._x += sgn * penX;
              else { a._x -= sgn * (penX / 2); b._x += sgn * (penX / 2); }
            } else {
              const sgn = dy >= 0 ? 1 : -1;
              if (j === 0) b._y += sgn * penY;
              else { a._y -= sgn * (penY / 2); b._y += sgn * (penY / 2); }
            }
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    const minNX = Math.min(...allRadial.map((n) => n._x));
    const minNY = Math.min(...allRadial.map((n) => n._y));
    if (minNX < pad) { const sh = pad - minNX; allRadial.forEach((n) => { n._x += sh; }); }
    if (minNY < pad) { const sh = pad - minNY; allRadial.forEach((n) => { n._y += sh; }); }
    W = Math.max(W, Math.ceil(Math.max(...allRadial.map((n) => n._x + NW)) + pad));
    H = Math.max(H, Math.ceil(Math.max(...allRadial.map((n) => n._y + NH)) + pad));
  } else if (layout === 'vertical') {
    const vGap = 48; W = pad * 2 + NW + 220; H = pad * 2 + nodes.length * NH + (nodes.length - 1) * vGap;
    nodes.forEach((n, i) => { n._x = (W - NW) / 2; n._y = pad + i * (NH + vGap); });
  } else {
    const cols = s.cols || Math.ceil(Math.sqrt(nodes.length)), rows = Math.ceil(nodes.length / cols), colGap = 80, rowGap = 70;
    W = pad * 2 + cols * NW + (cols - 1) * colGap; H = pad * 2 + rows * NH + (rows - 1) * rowGap;
    nodes.forEach((n, i) => { const c = i % cols, rw = Math.floor(i / cols); n._x = pad + c * (NW + colGap); n._y = pad + rw * (NH + rowGap); });
  }
  const aid = 'dg-arrow-' + idx;
  let zoneSVG = '';
  if (zones) zones.forEach((z) => { zoneSVG += `<rect class="dg-zone z-${z.zi + 1}" x="${pad - 16}" y="${r2(z.y)}" width="${r2(W - 2 * (pad - 16))}" height="${z.h}" rx="10"/><text class="dg-zlabel z-${z.zi + 1}" x="${pad}" y="${r2(z.y + 22)}">${esc(z.name)}</text>`; });
  const edgeLinesSVG = (s.edges || []).map((e) => { const async = e.proto === 'pub-sub' || e.async; return `<line class="dg-edge${async ? ' async' : ''}" data-edge data-from="${esc(e.from)}" data-to="${esc(e.to)}" marker-end="url(#${aid})"/>`; }).join('');
  const edgeLabelsSVG = (s.edges || []).filter((e) => e.label).map((e) => `<text class="dg-elabel" data-edge-label="${esc(e.from)}-${esc(e.to)}">${esc(e.label)}</text>`).join('');
  const maxInnerW = NW - 28;
  const nodeSVG = nodes.map((n) => {
    const gc = n.group ? ` g-${n.group}` : '', series = n.group ? ` data-series="g-${n.group}"` : '', rootC = n.root ? ' dg-root' : '';
    const lblClamp = textW(n.label || '', 7.4, 13.4) > maxInnerW ? ` textLength="${maxInnerW}" lengthAdjust="spacingAndGlyphs"` : '';
    const subClamp = n.sub && textW(n.sub, 6.0, 11.2) > maxInnerW ? ` textLength="${maxInnerW}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<g class="dg-node${gc}${rootC}" data-node="${esc(n.id)}"${series} transform="translate(${r2(n._x)},${r2(n._y)})" role="group" aria-label="${esc(n.label)} (draggable)" tabindex="0"><rect class="dg-box" width="${NW}" height="${NH}" rx="8"/><text class="dg-label" x="14" y="${n.sub ? 24 : 32}"${lblClamp}>${esc(n.label)}</text>${n.sub ? `<text class="dg-sub" x="14" y="41"${subClamp}>${esc(n.sub)}</text>` : ''}</g>`;
  }).join('');
  let legend = '';
  const hasGroups = nodes.some((n) => n.group);
  if (s.legend !== false && hasGroups) {
    const groups = nodes.filter((n) => n.group).map((n) => n.group).filter((v, i, a) => a.indexOf(v) === i).sort();
    legend = `<div class="cluster dg-legend no-print" role="group" aria-label="Group filter">` + groups.map((g) => `<span class="chip g-${g}" data-filter-key="g-${g}"><span class="dot"></span>${esc((s.groupLabels && s.groupLabels[g]) || ('Group ' + g))}</span>`).join('') + `</div>`;
  }
  const cf = hasGroups ? ' data-crossfilter' : '';
  const diagramTitle = s.title || t('diagram');
  const html = `<figure class="dg card-outlined">` + (s.title ? `<figcaption class="dg-title">${esc(s.title)}</figcaption>` : '') +
    `<section${cf} aria-label="${esc(diagramTitle)}">${legend}` +
    `<div class="stage" data-zoompan data-zoom-min="0.4" data-zoom-max="3" tabindex="0"><div class="zoom-controls no-print"><button class="btn btn-ghost btn-sm" data-zoom-in aria-label="${esc(t('zoomIn'))}">+</button><button class="btn btn-ghost btn-sm" data-zoom-out aria-label="${esc(t('zoomOut'))}">−</button><button class="btn btn-ghost btn-sm" data-zoom-reset aria-label="${esc(t('zoomReset'))}">⤢</button><span class="zoom-readout" data-zoom-readout>100%</span></div>` +
    `<svg viewBox="0 0 ${r2(W)} ${r2(H)}" data-draggable role="img" aria-label="${esc(diagramTitle)} ${esc(t('draggableSuffix'))}"><defs><marker id="${aid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs><g data-viewport>${zoneSVG}${edgeLinesSVG}${nodeSVG}${edgeLabelsSVG}</g></svg></div>` +
    `<button class="btn btn-ghost btn-sm no-print" data-drag-reset>${esc(t('resetLayout'))}</button></section></figure>`;
  return { css: ['__dg__'], html };
};

/* ---- archexplorer: interactive architecture workbench (scenarios + routed edges + inspector)

   Layout contract (why this is not a naive midpoint diagram):
   - Nodes sit in horizontal zone bands; edges are classified down / up / lateral.
   - Multiple edges leaving or entering the same node face are FANNED OUT across that
     face so parallel runs never collapse into one another.
   - Lateral edges that would pass through an intervening node in the same band arc
     over it instead of tunnelling through it.
   - Edge labels are placed by COLLISION SEARCH along the curve (sampled t values x
     normal-direction offsets), scored against node rects and already-placed labels.
     A midpoint label that would cover a node is the single biggest legibility killer
     in this module, so it is a hard-scored constraint, not a hope.
   - Scenario step numbers are emitted as real badges pinned next to each step's edge,
     so the order of a flow is readable ON the diagram, not only in the side panel.
---- */
R.archexplorer = (s, idx) => {
  const nodes = (s.nodes || []).map((n) => ({ ...n }));
  const hasTech = nodes.some((n) => n.tech);
  const maxNodeTextW = Math.max(0, ...nodes.map((n) => Math.max(
    textW(n.label || '', 7.4, 13.4),
    textW(n.sub || '', 6.2, 11.2),
    n.tech ? textW(n.tech, 6.0, 10.5) + 12 : 0
  )));
  const NW = Math.max(196, Math.min(242, Math.ceil(maxNodeTextW + 64)));
  const NH = hasTech ? 72 : 64, padX = 44, padY = 40;
  const byId = {}; nodes.forEach((n) => { byId[n.id] = n; });

  const rawZones = s.zones || [];
  const zoneList = rawZones.map((z, i) => {
    if (typeof z === 'string') return { id: 'z_' + i, name: z, sub: '' };
    return { id: z.id || ('z_' + i), name: z.name || z.title || ('Zone ' + (i + 1)), sub: z.sub || '' };
  });

  const perZone = zoneList.map((z) => nodes.filter((n) => n.zone === z.id || n.zone === z.name));
  const unzoned = nodes.filter((n) => !zoneList.some((z) => z.id === n.zone || z.name === n.zone));
  if (unzoned.length) {
    zoneList.push({ id: 'z_other', name: t('otherComponents'), sub: '' });
    perZone.push(unzoned);
  }
  perZone.forEach((row, zi) => row.forEach((n) => { n._zi = zi; }));

  const maxCols = Math.max(1, ...perZone.map((a) => a.length));
  const colGap = 56, zoneGap = 42, bandPadTop = 50, bandH = NH + bandPadTop + 30;
  // Reserve a right-hand gutter only when an edge genuinely flows upward into an earlier zone.
  const hasUp = (s.edges || []).some((e) => byId[e.from] && byId[e.to] && byId[e.to]._zi < byId[e.from]._zi);
  const W = Math.max(580, padX * 2 + maxCols * NW + (maxCols - 1) * colGap) + (hasUp ? 56 : 0);
  const H = padY * 2 + zoneList.length * bandH + (zoneList.length - 1) * zoneGap;
  const wide = maxCols >= 3 || nodes.length >= 10;

  const bandW = W - (hasUp ? 56 : 0);
  let zoneSVG = '';
  const zoneTextRects = []; // band headings are obstacles too - a label over them is just as unreadable
  zoneList.forEach((z, zi) => {
    const bandY = padY + zi * (bandH + zoneGap);
    const m = perZone[zi].length;
    const totalW = m * NW + (m - 1) * colGap;
    const startX = (bandW - totalW) / 2;
    z.y = bandY; z.h = bandH;
    perZone[zi].forEach((n, i) => {
      n._x = startX + i * (NW + colGap);
      n._y = bandY + bandPadTop;
    });

    const zRectW = bandW - 2 * (padX - 16);
    zoneSVG += `<rect class="zone-rect" x="${padX - 16}" y="${r2(bandY)}" width="${r2(zRectW)}" height="${bandH}" rx="10"/>`;
    zoneSVG += `<text class="zone-title" x="${padX}" y="${r2(bandY + 22)}">${esc(z.name)}</text>`;
    const titleW = textW(z.name, 9.5, 14.0);
    zoneTextRects.push({ x: padX - 8, y: bandY + 4, w: titleW + 16, h: 26 });
    if (z.sub) {
      const subX = padX + 20 + titleW;
      zoneSVG += `<text class="zone-desc" x="${r2(subX)}" y="${r2(bandY + 22)}">${esc(z.sub)}</text>`;
      zoneTextRects.push({ x: subX - 6, y: bandY + 6, w: textW(z.sub, 6.2, 11.2) + 12, h: 24 });
    }
  });

  /* --- geometry helpers --- */
  const rectOf = (n) => ({ x: n._x, y: n._y, w: NW, h: NH });
  const inflate = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
  const hits = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  const bezAt = (p, tt) => {
    const u = 1 - tt, a = u * u * u, b = 3 * u * u * tt, c = 3 * u * tt * tt, d = tt * tt * tt;
    return [a * p[0] + b * p[2] + c * p[4] + d * p[6], a * p[1] + b * p[3] + c * p[5] + d * p[7]];
  };
  const bezNormal = (p, tt) => {
    const u = 1 - tt;
    const dx = 3 * u * u * (p[2] - p[0]) + 6 * u * tt * (p[4] - p[2]) + 3 * tt * tt * (p[6] - p[4]);
    const dy = 3 * u * u * (p[3] - p[1]) + 6 * u * tt * (p[5] - p[3]) + 3 * tt * tt * (p[7] - p[5]);
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  };

  const rawEdges = (s.edges || []).filter((e) => byId[e.from] && byId[e.to]);
  rawEdges.forEach((e) => {
    e._fn = byId[e.from]; e._tn = byId[e.to];
    e._kind = Math.abs(e._fn._y - e._tn._y) < 1 ? 'lateral' : (e._tn._y > e._fn._y ? 'down' : 'up');
  });

  /* --- fan out shared node faces so parallel edges stay distinguishable --- */
  const slots = {};
  const claim = (id, side, e, role) => { const k = id + '|' + side; (slots[k] = slots[k] || []).push({ e, role }); };
  rawEdges.forEach((e) => {
    if (e._kind === 'down') { claim(e.from, 'b', e, 'from'); claim(e.to, 't', e, 'to'); }
    else if (e._kind === 'up') { claim(e.from, 'r', e, 'from'); claim(e.to, 'b', e, 'to'); }
  });
  Object.keys(slots).forEach((k) => {
    const id = k.slice(0, k.lastIndexOf('|')), side = k.slice(k.lastIndexOf('|') + 1);
    const n = byId[id], list = slots[k];
    list.sort((a, b) => {
      const oa = a.role === 'from' ? a.e._tn : a.e._fn;
      const ob = b.role === 'from' ? b.e._tn : b.e._fn;
      return oa._x - ob._x;
    });
    list.forEach((it, i) => {
      const frac = (i + 1) / (list.length + 1);
      if (side === 'r') {
        const py = n._y + NH * frac;
        if (it.role === 'from') it.e._sy = py; else it.e._ey = py;
      } else {
        const px = n._x + NW * frac;
        if (it.role === 'from') it.e._sx = px; else it.e._ex = px;
      }
    });
  });

  const routeD = (segs) => segs.reduce(
    (d, sg) => d + ` C ${r2(sg[2])} ${r2(sg[3])}, ${r2(sg[4])} ${r2(sg[5])}, ${r2(sg[6])} ${r2(sg[7])}`,
    `M ${r2(segs[0][0])} ${r2(segs[0][1])}`);
  const segAt = (segs, tt) => {
    const i = Math.min(segs.length - 1, Math.floor(tt * segs.length));
    return [segs[i], tt * segs.length - i];
  };
  const routeAt = (segs, tt) => { const [sg, lt] = segAt(segs, tt); return bezAt(sg, lt); };
  const routeNormal = (segs, tt) => { const [sg, lt] = segAt(segs, tt); return bezNormal(sg, lt); };
  const routeCost = (segs, fn, tn) => {
    let c = 0;
    for (let i = 1; i < 44; i++) {
      const [px, py] = routeAt(segs, i / 45);
      for (const n of nodes) {
        if (n === fn || n === tn) continue;
        if (px > n._x - 7 && px < n._x + NW + 7 && py > n._y - 7 && py < n._y + NH + 7) { c++; break; }
      }
    }
    return c;
  };
  const routeClear = (segs, fn, tn) => routeCost(segs, fn, tn) === 0;
  const bestOf = (cands, fn, tn) => {
    let best = null, bc = Infinity;
    for (const c of cands) { const k = routeCost(c, fn, tn); if (k < bc) { bc = k; best = c; } if (!k) break; }
    return best;
  };

  // Free vertical channels: the gaps between node columns, plus the outer margins.
  const channelXs = [];
  perZone.forEach((row) => {
    const sorted = row.slice().sort((a, b) => a._x - b._x);
    for (let i = 0; i < sorted.length - 1; i++) channelXs.push((sorted[i]._x + NW + sorted[i + 1]._x) / 2);
  });
  channelXs.push(padX / 2, bandW - padX / 2);
  if (hasUp) channelXs.push(W - 24);

  /* --- route --- */
  const edgeGeo = rawEdges.map((e) => {
    const fn = e._fn, tn = e._tn;
    let segs;
    if (e._kind === 'down') {
      const sx = e._sx != null ? e._sx : fn._x + NW / 2, sy = fn._y + NH;
      const ex = e._ex != null ? e._ex : tn._x + NW / 2, ey = tn._y;
      const dy = ey - sy;
      segs = [[sx, sy, sx, sy + dy * 0.45, ex, ey - dy * 0.45, ex, ey]];
      if (!routeClear(segs, fn, tn)) {
        const chans = channelXs.slice().sort((a, b) => Math.abs(a - (sx + ex) / 2) - Math.abs(b - (sx + ex) / 2));
        const cands = [segs];
        for (const chx of chans) {
          for (const gap of [30, 46]) {
            const y1 = sy + gap, y2 = ey - gap;
            if (y2 <= y1) continue;
            cands.push([
              [sx, sy, sx, sy + gap * 0.85, chx, y1 - gap * 0.85, chx, y1],
              [chx, y1, chx, y1 + (y2 - y1) * 0.34, chx, y2 - (y2 - y1) * 0.34, chx, y2],
              [chx, y2, chx, y2 + gap * 0.85, ex, ey - gap * 0.85, ex, ey],
            ]);
          }
        }
        segs = bestOf(cands, fn, tn);
      }
    } else if (e._kind === 'up') {
      const syc = e._sy != null ? e._sy : fn._y + NH / 2;
      const exc = e._ex != null ? e._ex : tn._x + NW / 2, eyb = tn._y + NH;
      const cands = [];
      for (const pad of [40, 74, 108]) {
        for (const side of [1, -1]) {
          const gx = side > 0
            ? Math.min(W - 14, Math.max(bandW - 12, fn._x + NW + pad, tn._x + NW + pad))
            : Math.max(14, Math.min(18, fn._x - pad, tn._x - pad));
          const sxf = side > 0 ? fn._x + NW : fn._x;
          for (const under of [24, 38]) {
            const yU = eyb + under;
            cands.push([
              [sxf, syc, gx, syc, gx, syc, gx, yU],
              [gx, yU, (gx + exc) / 2, yU, exc, yU, exc, eyb],
            ]);
            const yCor = fn._y - 18;
            const sxTop = fn._x + (side > 0 ? NW * 0.78 : NW * 0.22);
            cands.push([
              [sxTop, fn._y, sxTop, yCor, (sxTop + gx) / 2, yCor, gx, yCor],
              [gx, yCor, gx, (yCor + yU) / 2, gx, (yCor + yU) / 2, gx, yU],
              [gx, yU, (gx + exc) / 2, yU, exc, yU, exc, eyb],
            ]);
          }
        }
      }
      segs = bestOf(cands, fn, tn);
    } else {
      const l2r = fn._x < tn._x;
      const sx = l2r ? fn._x + NW : fn._x, sy = fn._y + NH / 2;
      const ex = l2r ? tn._x : tn._x + NW, ey = tn._y + NH / 2;
      segs = [[sx, sy, (sx + ex) / 2, sy, (sx + ex) / 2, ey, ex, ey]];
      if (!routeClear(segs, fn, tn)) {
        const k = l2r ? 40 : -40;
        const cands = [segs];
        for (const lift of [NH / 2 + 34, NH / 2 + 60, NH / 2 + 88, -(NH / 2 + 34), -(NH / 2 + 60), -(NH / 2 + 88)]) {
          cands.push([[sx, sy, sx + k, sy - lift, ex - k, ey - lift, ex, ey]]);
        }
        segs = bestOf(cands, fn, tn);
      }
    }
    return { e, d: routeD(segs), segs, eid: e.id || `${e.from}-${e.to}` };
  });

  /* --- place labels by collision search --- */
  const LBL_H = 19;
  const nodeObstacles = nodes.map((n) => inflate(rectOf(n), 4));
  const obstacles = nodeObstacles.concat(zoneTextRects);
  const labelled = edgeGeo.filter((g) => g.e.label);
  labelled.forEach((g) => { g._lw = textW(g.e.label, 6.1, 10.5) + 14; });

  // Search this edge's own curve for a slot clear of `others` (rects) and the obstacles.
  const findSlot = (g, others) => {
    const lw = g._lw;
    let best = null, bestScore = Infinity;
    for (const tt of [0.5, 0.38, 0.62, 0.28, 0.72, 0.2, 0.8]) {
      const [px, py] = routeAt(g.segs, tt);
      const [nx, ny] = routeNormal(g.segs, tt);
      const horiz = Math.abs(nx) > Math.abs(ny);
      const offsets = horiz
        ? [0, lw / 2 + 10, -(lw / 2 + 10), lw + 16, -(lw + 16)]
        : [0, 18, -18, 32, -32, 46, -46, 52, -52, 62, -62];
      for (const dist of offsets) {
        const cx = px + nx * dist, cy = py + ny * dist;
        const r = { x: cx - lw / 2, y: cy - LBL_H / 2, w: lw, h: LBL_H };
        if (r.x < 4 || r.x + r.w > W - 4 || r.y < 4 || r.y + r.h > H - 4) continue;
        let score = 0;
        for (const o of nodeObstacles) if (hits(r, o)) score += 120;
        for (const zt of zoneTextRects) if (hits(r, zt)) score += 320;
        for (const p of others) if (hits(r, p)) score += 65;
        score += Math.abs(tt - 0.5) * 10 + (Math.abs(dist) / 14) * 3;
        if (score < bestScore) { bestScore = score; best = { r, cx, cy, score }; }
        if (score < 1) return best;
      }
    }
    return best;
  };

  const commit = (g, slot) => { g.label = { x: slot.cx, y: slot.cy, w: g._lw }; g.labelRect = slot.r; };

  // Pass 1: greedy, in edge order.
  const placedLabels = [];
  labelled.forEach((g) => {
    const slot = findSlot(g, placedLabels);
    if (!slot) return;
    placedLabels.push(slot.r);
    commit(g, slot);
  });

  /* Pass 2: repair against full set */
  for (let round = 0; round < 3; round++) {
    let moved = 0;
    for (const g of labelled) {
      if (!g.labelRect) continue;
      const others = placedLabels.filter((r) => r !== g.labelRect);
      const clashes = obstacles.some((o) => hits(g.labelRect, o)) || others.some((r) => hits(g.labelRect, r));
      if (!clashes) continue;
      const slot = findSlot(g, others);
      if (!slot || slot.score >= 65) continue;
      placedLabels[placedLabels.indexOf(g.labelRect)] = slot.r;
      commit(g, slot);
      moved++;
    }
    if (!moved) break;
  }

  /* Self-audit */
  const pierced = edgeGeo.filter((g) => !routeClear(g.segs, g.e._fn, g.e._tn));
  const lblRect = (g) => ({ x: g.label.x - g.label.w / 2, y: g.label.y - LBL_H / 2, w: g.label.w, h: LBL_H });
  const labeled = edgeGeo.filter((g) => g.label);
  const nodeObs = nodes.map((n) => ({ r: inflate(rectOf(n), 4), what: `node ${n.id}` }));
  const zoneObs = zoneTextRects.map((r, i) => ({ r, what: `zone heading #${i + 1}` }));
  const covered = labeled.map((g, i) => {
    const hitList = [...nodeObs, ...zoneObs].filter((o) => hits(lblRect(g), o.r)).map((o) => o.what);
    labeled.forEach((h, k) => { if (k !== i && hits(lblRect(g), lblRect(h))) hitList.push(`label "${h.e.label}"`); });
    return hitList.length ? `${g.eid} → ${hitList.join(' + ')}` : null;
  }).filter(Boolean);
  const unlabeled = edgeGeo.filter((g) => g.e.label && !g.label);
  const orphanSteps = [];
  (s.scenarios || []).forEach((sc) => (sc.steps || []).forEach((st, i) => {
    const want = st.edge || `${st.from}-${st.to}`;
    if (!edgeGeo.some((x) => x.eid === want || (x.e.from === st.from && x.e.to === st.to))) {
      orphanSteps.push(`${sc.id}#${st.step || i + 1} (${want})`);
    }
  }));
  if (pierced.length || covered.length || unlabeled.length || orphanSteps.length) {
    const where = `arch-explorer "${s.title || 'untitled'}"`;
    if (orphanSteps.length) console.warn(`warn: ${where}: ${orphanSteps.length} scenario step(s) reference an edge that is not in "edges", so they highlight nothing on the diagram: ${orphanSteps.join(', ')}. Add those edges.`);
    if (pierced.length) console.warn(`warn: ${where}: ${pierced.length} edge(s) still cross an unrelated node (${pierced.slice(0, 4).map((g) => g.eid).join(', ')}). Give those zones fewer nodes per band, or split the diagram.`);
    if (covered.length) console.warn(`warn: ${where}: ${covered.length} edge label(s) overlap something: ${covered.slice(0, 5).join('; ')}. Shorten the label, shorten the zone caption it collides with, or split the diagram.`);
    if (unlabeled.length) console.warn(`warn: ${where}: ${unlabeled.length} edge label(s) dropped for lack of space (${unlabeled.slice(0, 4).map((g) => g.eid).join(', ')}).`);
  }

  const edgeSVG = edgeGeo.map((g) => {
    const lbl = g.label
      ? `<rect class="edge-badge-rect" x="${r2(g.label.x - g.label.w / 2)}" y="${r2(g.label.y - LBL_H / 2)}" width="${r2(g.label.w)}" height="${LBL_H}" rx="4"/>` +
        `<text class="edge-label" x="${r2(g.label.x)}" y="${r2(g.label.y + 3.5)}">${esc(g.e.label)}</text>`
      : '';
    return `<g class="archexp-edge-wrap"><path class="edge-path" data-edge data-edge-id="${esc(g.eid)}" data-from="${esc(g.e.from)}" data-to="${esc(g.e.to)}" d="${g.d}" marker-end="url(#archexp-arrow)"/>${lbl}</g>`;
  }).join('');

  /* --- scenario step badges pinned to their edge --- */
  const BR = 11;
  const badgeSVG = (s.scenarios || []).map((sc) => {
    const mine = [];
    return (sc.steps || []).map((st, i) => {
      const num = st.step || (i + 1);
      const want = st.edge || `${st.from}-${st.to}`;
      const g = edgeGeo.find((x) => x.eid === want || (x.e.from === st.from && x.e.to === st.to));
      if (!g) return '';
      const cands = [];
      if (g.label) {
        const lx = g.label.x, ly = g.label.y, hw = g.label.w / 2;
        cands.push([lx - hw - BR - 3, ly], [lx + hw + BR + 3, ly],
          [lx, ly - LBL_H / 2 - BR - 2], [lx, ly + LBL_H / 2 + BR + 2],
          [lx - hw - BR - 3, ly - LBL_H - 2], [lx + hw + BR + 3, ly - LBL_H - 2]);
      }
      for (const tt of [0.5, 0.36, 0.64, 0.26, 0.74]) cands.push(routeAt(g.segs, tt));
      const own = g.labelRect || null;
      let best = cands[0], bestScore = Infinity;
      for (const [cx, cy] of cands) {
        const r = { x: cx - BR, y: cy - BR, w: BR * 2, h: BR * 2 };
        if (r.x < 1 || r.x + r.w > W - 1 || r.y < 1 || r.y + r.h > H - 1) continue;
        let score = 0;
        for (const o of obstacles) if (hits(r, o)) score += 100;
        for (const p of placedLabels) if (p !== own && hits(r, p)) score += 60;
        for (const b of mine) if (hits(r, b)) score += 80;
        if (score < bestScore) { bestScore = score; best = [cx, cy]; }
        if (!score) break;
      }
      mine.push({ x: best[0] - BR, y: best[1] - BR, w: BR * 2, h: BR * 2 });
      return `<g class="archexp-stepbadge hidden" data-step-badge data-scenario="${esc(sc.id)}" data-step="${num}" transform="translate(${r2(best[0])},${r2(best[1])})">` +
        `<circle class="edge-step-badge" r="10.5"/><text class="edge-step-num" y="0.5">${esc(String(num))}</text></g>`;
    }).join('');
  }).join('');

  const maxCardTextW = NW - 62;
  const nodeSVG = nodes.map((n) => {
    const nt = n.type || 'service';
    const icName = n.icon || (nt === 'database' ? 'database' : nt === 'queue' ? 'queue' : nt === 'gateway' ? 'router' : nt === 'worker' ? 'gear' : nt === 'client' ? 'laptop' : nt === 'external' ? 'cloud' : 'spark');
    const specJson = esc(JSON.stringify({
      id: n.id, label: n.label, sub: n.sub, type: nt,
      tech: n.tech, desc: n.desc, inputs: n.inputs, outputs: n.outputs, file: n.file, tags: n.tags
    }));
    const lblClamp = textW(n.label || '', 7.4, 13.4) > maxCardTextW ? ` textLength="${maxCardTextW}" lengthAdjust="spacingAndGlyphs"` : '';
    const subClamp = n.sub && textW(n.sub, 6.2, 11.2) > maxCardTextW ? ` textLength="${maxCardTextW}" lengthAdjust="spacingAndGlyphs"` : '';
    const techClamp = n.tech && textW(n.tech, 6.0, 10.5) > maxCardTextW ? ` textLength="${maxCardTextW}" lengthAdjust="spacingAndGlyphs"` : '';

    return `<g class="archexp-node nt-${nt}" data-node="${esc(n.id)}" data-node-spec="${specJson}" transform="translate(${r2(n._x)},${r2(n._y)})" role="group" aria-label="${esc(n.label)} (${nt})" tabindex="0">` +
      `<rect class="node-card" width="${NW}" height="${NH}" rx="8"/>` +
      `<rect class="node-icon-bg" x="10" y="12" width="34" height="34" rx="6"/>` +
      `<g transform="translate(17, 19)"><svg class="node-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icName] || ICONS.spark}</svg></g>` +
      `<text class="node-label" x="52" y="25"${lblClamp}>${esc(n.label)}</text>` +
      `<text class="node-sub" x="52" y="41"${subClamp}>${esc(n.sub || '')}</text>` +
      (n.tech ? `<text class="node-badge-text" x="52" y="57" text-anchor="start"${techClamp}>${esc(n.tech)}</text>` : '') +
      `</g>`;
  }).join('');

  const scenariosObj = {};
  (s.scenarios || []).forEach((sc) => {
    scenariosObj[sc.id] = { name: sc.name || sc.title, desc: sc.desc || '', steps: sc.steps || [] };
  });
  const scenariosAttr = esc(JSON.stringify(scenariosObj));
  const labelsAttr = esc(JSON.stringify({
    topology: t('systemTopology'), overview: t('architectureOverview'), overviewBody: t('archOverviewBody'),
    spec: t('componentSpec'), flow: t('scenarioFlow'), pipeline: t('scenarioPipeline'),
  }));

  const tabsHtml = `<button class="archexp-tab active" data-scenario-tab="all" role="tab" aria-selected="true">${esc(t('fullTopology'))}</button>` +
    (s.scenarios || []).map((sc, i) => `<button class="archexp-tab" data-scenario-tab="${esc(sc.id)}" role="tab" aria-selected="false">${esc(sc.tab || sc.name || ('Scenario ' + (i + 1)))}</button>`).join('');

  // Only advertise node types that actually appear, so the legend never lists ghosts.
  const LEGEND = [
    ['client', 'var(--cat-2)', 'legendClient'], ['gateway', 'var(--cat-1)', 'legendGateway'],
    ['worker', 'var(--cat-4)', 'legendWorker'], ['queue', 'var(--color-warning)', 'legendQueue'],
    ['database', 'var(--cat-5)', 'legendDatabase'], ['external', 'var(--cat-3)', 'legendExternal'],
  ];
  const usedTypes = new Set(nodes.map((n) => n.type || 'service'));
  const legendHtml = LEGEND.filter((l) => usedTypes.has(l[0]))
    .map((l) => `<span class="archexp-legend-item"><span class="archexp-dot" style="background:${l[1]}"></span> ${esc(t(l[2]))}</span>`).join('');

  const titleHtml = s.title ? `<h2 class="archexp-title">${esc(s.title)}</h2>` : '';
  const descHtml = s.desc ? `<p class="archexp-desc">${esc(s.desc)}</p>` : '';

  const html = `<div class="archexp card-outlined" data-arch-explorer${wide ? ' data-wide' : ''} data-scenarios="${scenariosAttr}" data-labels="${labelsAttr}" aria-label="${esc(s.title || 'Architecture Explorer')}">` +
    `<header class="archexp-head"><div>${titleHtml}${descHtml}</div><nav class="archexp-tabs no-print" role="tablist" aria-label="Architecture Scenarios">${tabsHtml}</nav></header>` +
    `<div class="archexp-workbench">` +
    `<div class="archexp-stage-wrap">` +
    `<div class="archexp-controls no-print"><button class="btn btn-ghost btn-sm" data-zoom-in aria-label="${esc(t('zoomIn'))}">+</button><button class="btn btn-ghost btn-sm" data-zoom-out aria-label="${esc(t('zoomOut'))}">−</button><button class="btn btn-ghost btn-sm" data-zoom-reset aria-label="${esc(t('zoomReset'))}">⤢</button><span class="archexp-readout" data-zoom-readout>100%</span></div>` +
    `<div class="stage" data-zoompan data-zoom-min="0.3" data-zoom-max="2.5" tabindex="0"><svg viewBox="0 0 ${r2(W)} ${r2(H)}" role="img" aria-label="${esc(s.title || 'Architecture Explorer')}"><defs><marker id="archexp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="var(--text-muted)"/></marker><marker id="archexp-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="var(--accent)"/></marker></defs><g data-viewport>${zoneSVG}${edgeSVG}${nodeSVG}${badgeSVG}</g></svg></div>` +
    `<footer class="archexp-legend no-print">${legendHtml}</footer>` +
    `</div>` +
    `<aside class="archexp-inspector" aria-label="${esc(t('inspector'))}"><header class="archexp-insp-head"><span class="archexp-insp-tag" data-insp-title>${esc(t('scenarioFlow'))}</span><button class="archexp-insp-close" data-insp-reset aria-label="${esc(t('reset'))}">↺</button></header><div class="archexp-insp-body" data-insp-content></div></aside>` +
    `</div></div>`;

  return { css: ['arch-explorer'], html };
};
R['arch-explorer'] = R.archexplorer;

/* ---- pipeline-flow: horizontal data/event processing stages ---- */
R.pipelineflow = (s) => {
  const stages = (s.stages || []).map((st, i) => {
    const num = st.num || (i + 1);
    const cards = (st.cards || []).map((c) => {
      let io = '';
      if (c.in || c.out) {
        io = `<div class="pipe-io">` +
          (c.in ? `<div class="pipe-io-row"><span class="pipe-io-lbl">IN:</span><span class="pipe-io-val">${esc(c.in)}</span></div>` : '') +
          (c.out ? `<div class="pipe-io-row"><span class="pipe-io-lbl">OUT:</span><span class="pipe-io-val">${esc(c.out)}</span></div>` : '') +
          `</div>`;
      }
      let branch = '';
      if (Array.isArray(c.branches)) {
        branch = `<div class="pipe-branch">` + c.branches.map((b) => `<span class="pipe-badge pipe-badge-${esc(b.type || b.kind || 'go')}">${esc(b.label)}</span>`).join('') + `</div>`;
      }
      return `<div class="pipe-card"><div class="pipe-card-title">${esc(c.title)}</div><p class="pipe-card-desc">${esc(c.desc)}</p>${io}${branch}</div>`;
    }).join('');

    const emph = st.emphasis === 'hero' || st.emphasis === 'quiet' ? ` pipe-stage-${st.emphasis}` : '';
    return `<article class="pipe-stage${emph}"><header class="pipe-stage-head"><div style="display:flex;align-items:center;gap:var(--sp-2)"><span class="pipe-stage-num">${num}</span><span class="pipe-stage-name">${esc(st.name)}</span></div>${st.proto ? `<span class="pipe-stage-proto">${esc(st.proto)}</span>` : ''}</header><div class="pipe-stage-body">${cards}</div></article>`;
  });
  /* flow:"line" keeps every stage on one row with arrows between them (stacked with down
     arrows in a narrow container), so the reading order survives; the default grid wraps */
  const line = s.flow === 'line';
  const n = (s.stages || []).length;
  const track = line ? stages.join('<span class="pipe-arrow" aria-hidden="true">→</span>') : stages.join('');

  return {
    css: ['pipeline-flow'],
    html: `<section class="pipe card-outlined" aria-label="${esc(s.title || 'Pipeline Flow')}">` +
      (s.title ? `<header class="pipe-head"><h2>${esc(s.title)}</h2>${s.desc ? `<p class="pipe-desc">${esc(s.desc)}</p>` : ''}</header>` : '') +
      `<div class="pipe-track${line ? ' pipe-line' : ''}" style="--pipe-cols:${balancedCols(n)};--pipe-cols-md:${mediumCols(n)}">${track}</div></section>`
  };
};
R['pipeline-flow'] = R.pipelineflow;

/* ---- service-catalog: component & service directory cards ---- */
R.servicecatalog = (s) => {
  const cards = (s.services || []).map((svc) => {
    return `<article class="scat-card">` +
      `<header class="scat-card-head"><div><div class="scat-name">${esc(svc.name)}</div>${svc.path ? `<span class="scat-path">${esc(svc.path)}</span>` : ''}</div>${svc.role ? `<span class="scat-role">${esc(svc.role)}</span>` : ''}</header>` +
      `<div class="scat-card-body"><p class="scat-summary">${esc(svc.desc)}</p>` +
      `<div class="scat-kv">` +
      (svc.tech ? `<div class="scat-row"><span class="scat-k">Tech</span><span class="scat-v">${esc(svc.tech)}</span></div>` : '') +
      (svc.port ? `<div class="scat-row"><span class="scat-k">Port</span><span class="scat-v">${esc(svc.port)}</span></div>` : '') +
      (svc.storage ? `<div class="scat-row"><span class="scat-k">Storage</span><span class="scat-v">${esc(svc.storage)}</span></div>` : '') +
      `</div></div>` +
      (Array.isArray(svc.tags) && svc.tags.length ? `<footer class="scat-card-foot">${svc.tags.map((t) => `<span class="scat-tag">${esc(t)}</span>`).join('')}</footer>` : '') +
      `</article>`;
  }).join('');

  return {
    css: ['service-catalog'],
    html: `<section class="scat card-outlined" aria-label="${esc(s.title || 'Service Catalog')}">` +
      (s.title ? `<header class="scat-head"><h2>${esc(s.title)}</h2>${s.desc ? `<p class="scat-desc">${esc(s.desc)}</p>` : ''}</header>` : '') +
      `<div class="scat-grid">${cards}</div></section>`
  };
};
R['service-catalog'] = R.servicecatalog;

/* ---- request-trace: latency waterfall for one request across the system ---- */
R.requesttrace = (s) => {
  const unit = s.unit || 'ms';
  const hops = (s.hops || []).map((h, i) => ({ ...h, n: h.n || i + 1, start: +h.start || 0, dur: +h.dur || 0 }));
  // Default the window to the end of the last hop, so bars always fill the axis.
  const span = +s.total || hops.reduce((m, h) => Math.max(m, h.start + h.dur), 0) || 1;
  const slowest = hops.reduce((a, b) => (b.dur > (a ? a.dur : -1) ? b : a), null);
  const pct = (v) => Math.max(0, Math.min(100, (v / span) * 100));

  const rows = hops.map((h) => {
    const left = pct(h.start), width = Math.max(0.6, pct(h.dur));
    const txt = `${h.dur}${unit}`;
    // A sliver of a bar cannot hold its own duration text; park it alongside instead.
    // The track is fluid, so assume a pessimistic ~6px per 1% and demand real slack -
    // a clipped "4ms" is worse than the same text sitting just outside the bar.
    const inside = width * 6 >= textW(txt, 6.4, 11) + 18;
    const bar = `<div class="rtrace-bar" style="left:${r2(left)}%;width:${r2(width)}%">${inside ? `<span class="rtrace-dur">${esc(txt)}</span>` : ''}</div>` +
      (inside ? '' : `<span class="rtrace-dur-out" style="left:${r2(Math.min(left + width, 99))}%">${esc(txt)}</span>`);
    return `<div class="rtrace-row rtrace-k-${esc(h.kind || 'compute')}">` +
      `<div class="rtrace-label"><span class="rtrace-comp"><span class="rtrace-n">${h.n}</span>${esc(h.component || '')}</span>` +
      (h.op ? `<span class="rtrace-op">${esc(h.op)}</span>` : '') + `</div>` +
      `<div class="rtrace-track">${bar}</div>` +
      (h.note ? `<div class="rtrace-note">${esc(h.note)}</div>` : '') + `</div>`;
  }).join('');

  const KINDS = [['network', 'traceNetwork'], ['compute', 'traceCompute'], ['db', 'traceDb'],
    ['queue', 'traceQueue'], ['cache', 'traceCache'], ['external', 'traceExternal']];
  const used = new Set(hops.map((h) => h.kind || 'compute'));
  const legend = KINDS.filter((k) => used.has(k[0]))
    .map((k) => `<span class="rtrace-legend-item rtrace-k-${k[0]}"><span class="rtrace-swatch"></span>${esc(t(k[1]))}</span>`).join('');

  return {
    css: ['request-trace'],
    html: `<section class="rtrace card-outlined" aria-label="${esc(s.title || 'Request trace')}">` +
      (s.title ? `<header class="rtrace-head"><h2>${esc(s.title)}</h2>${s.desc ? `<p class="rtrace-desc">${esc(s.desc)}</p>` : ''}</header>` : '') +
      `<div class="rtrace-summary">` +
      `<div class="rtrace-sum-item"><span class="rtrace-sum-key">${esc(t('traceTotal'))}</span><span class="rtrace-sum-val">${r2(span)}${esc(unit)}</span></div>` +
      `<div class="rtrace-sum-item"><span class="rtrace-sum-key">${esc(t('traceHops'))}</span><span class="rtrace-sum-val">${hops.length}</span></div>` +
      (slowest ? `<div class="rtrace-sum-item"><span class="rtrace-sum-key">${esc(t('traceSlowest'))}</span><span class="rtrace-sum-val">${esc(slowest.component || '')} · ${slowest.dur}${esc(unit)}</span></div>` : '') +
      `</div>` +
      `<div class="rtrace-axis" role="presentation"><span></span><div class="rtrace-axis-ticks">` +
      `<span class="rtrace-tick" style="left:0%">0${esc(unit)}</span>` +
      `<span class="rtrace-tick" style="left:50%">${r2(span / 2)}${esc(unit)}</span>` +
      `<span class="rtrace-tick" style="left:100%">${r2(span)}${esc(unit)}</span></div></div>` +
      `<div class="rtrace-rows">${rows}</div>` +
      (legend ? `<footer class="rtrace-legend">${legend}</footer>` : '') +
      `</section>`
  };
};
R['request-trace'] = R.requesttrace;

/* ---- event-catalog: producer → event → consumers fan-out ---- */
R.eventcatalog = (s) => {
  const cards = (s.events || []).map((ev) => {
    const chips = [
      ev.delivery ? `<span class="evcat-chip evcat-chip-strong">${esc(ev.delivery)}</span>` : '',
      ev.transport ? `<span class="evcat-chip">${esc(ev.transport)}</span>` : '',
      ev.volume ? `<span class="evcat-chip">${esc(ev.volume)}</span>` : '',
    ].join('');
    const producers = (ev.producers || []).map((p) => {
      const o = typeof p === 'string' ? { name: p } : p;
      return `<div class="evcat-party evcat-producer"><div class="evcat-party-name">${esc(o.name)}</div>` +
        (o.action ? `<div class="evcat-party-act">${esc(o.action)}</div>` : '') + `</div>`;
    }).join('');
    const consumers = (ev.consumers || []).map((c) => {
      const o = typeof c === 'string' ? { name: c } : c;
      return `<div class="evcat-party evcat-consumer"><div class="evcat-party-name">${esc(o.name)}` +
        (o.async ? ` <span class="evcat-async">async</span>` : '') + `</div>` +
        (o.action ? `<div class="evcat-party-act">${esc(o.action)}</div>` : '') + `</div>`;
    }).join('');
    return `<article class="evcat-card">` +
      `<header class="evcat-card-head"><span class="evcat-name">${esc(ev.name)}</span>${chips}</header>` +
      (ev.desc ? `<p class="evcat-card-desc">${esc(ev.desc)}</p>` : '') +
      `<div class="evcat-flow">` +
      `<div class="evcat-col"><span class="evcat-col-key">${esc(t('producers'))}</span>${producers}</div>` +
      `<div class="evcat-spine" aria-hidden="true"><span class="evcat-spine-dot">&#8623;</span></div>` +
      `<div class="evcat-col"><span class="evcat-col-key">${esc(t('consumers'))} (${(ev.consumers || []).length})</span>${consumers}</div>` +
      `</div>` +
      (ev.payload ? `<div class="evcat-payload">${esc(ev.payload)}</div>` : '') +
      `</article>`;
  }).join('');

  return {
    css: ['event-catalog'],
    html: `<section class="evcat card-outlined" aria-label="${esc(s.title || 'Event catalog')}">` +
      (s.title ? `<header class="evcat-head"><h2>${esc(s.title)}</h2>${s.desc ? `<p class="evcat-desc">${esc(s.desc)}</p>` : ''}</header>` : '') +
      `<div class="evcat-list">${cards}</div></section>`
  };
};
R['event-catalog'] = R.eventcatalog;

/* ---- deployment-topology: region → zone → running unit ---- */
R.deploymenttopology = (s) => {
  const unitHtml = (u) => `<div class="dtopo-unit dtopo-k-${esc(u.kind || 'service')}">` +
    `<div class="dtopo-unit-top"><span class="dtopo-unit-name">${esc(u.name)}</span>` +
    (u.replicas ? `<span class="dtopo-replicas">&times;${esc(String(u.replicas))}</span>` : '') + `</div>` +
    (u.tech ? `<span class="dtopo-unit-tech">${esc(u.tech)}</span>` : '') +
    (u.note ? `<span class="dtopo-unit-note">${esc(u.note)}</span>` : '') + `</div>`;

  const globals = (s.global || []).map(unitHtml).join('');
  const regions = (s.regions || []).map((rg) => {
    const zones = (rg.zones || []).map((z) => `<div class="dtopo-zone">` +
      `<div class="dtopo-zone-name">${esc(z.name)}</div>` +
      `<div class="dtopo-units">${(z.units || []).map(unitHtml).join('')}</div></div>`).join('');
    return `<article class="dtopo-region dtopo-r-${esc(rg.role || 'primary')}">` +
      `<header class="dtopo-region-head"><div><div class="dtopo-region-name">${esc(rg.name)}</div>` +
      (rg.sub ? `<div class="dtopo-region-sub">${esc(rg.sub)}</div>` : '') + `</div>` +
      (rg.role ? `<span class="dtopo-role">${esc(t('role_' + rg.role) !== 'role_' + rg.role ? t('role_' + rg.role) : rg.role)}</span>` : '') +
      `</header><div class="dtopo-zones">${zones}</div></article>`;
  }).join('');

  return {
    css: ['deployment-topology'],
    html: `<section class="dtopo card-outlined" aria-label="${esc(s.title || 'Deployment topology')}">` +
      (s.title ? `<header class="dtopo-head"><h2>${esc(s.title)}</h2>${s.desc ? `<p class="dtopo-desc">${esc(s.desc)}</p>` : ''}</header>` : '') +
      (globals ? `<div class="dtopo-global"><span class="dtopo-global-key">${esc(t('globalEdge'))}</span><div class="dtopo-global-list">${globals}</div></div>` : '') +
      `<div class="dtopo-regions${(s.regions || []).length > 1 ? ' is-multi' : ''}">${regions}</div></section>`
  };
};
R['deployment-topology'] = R.deploymenttopology;

/* ---- failure-modes: component → failure → blast radius → mitigation ---- */
R.failuremodes = (s) => {
  const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  // Severity-first, so the card that would wake someone at 3am is read first.
  const rows = (s.rows || []).slice().sort((a, b) =>
    (ORDER[a.severity] == null ? 9 : ORDER[a.severity]) - (ORDER[b.severity] == null ? 9 : ORDER[b.severity]));

  const cards = rows.map((r) => {
    const line = (key, val, cls) => val
      ? `<div class="fmode-row"><span class="fmode-key">${esc(t(key))}</span><span class="fmode-val${cls ? ' ' + cls : ''}">${esc(val)}</span></div>`
      : '';
    return `<article class="fmode fmode-s-${esc(r.severity || 'medium')}">` +
      `<header class="fmode-head"><span class="fmode-comp">${esc(r.component || '')}</span>` +
      (r.severity ? `<span class="fmode-sev">${esc(r.severity)}</span>` : '') +
      (r.degraded ? `<span class="fmode-degraded">${esc(t('degradedMode'))}</span>` : '') + `</header>` +
      `<div class="fmode-what">${esc(r.failure || '')}</div>` +
      `<div class="fmode-grid">` +
      line('fmImpact', r.impact) + line('fmBlast', r.blast) + line('fmDetect', r.detect) +
      line('fmMitigate', r.mitigate) + line('fmRto', r.rto, 'fmode-rto') +
      `</div></article>`;
  }).join('');

  return {
    css: ['failure-modes'],
    html: `<section class="fmodes card-outlined" aria-label="${esc(s.title || 'Failure modes')}">` +
      (s.title ? `<header class="fmodes-head"><h2>${esc(s.title)}</h2>${s.desc ? `<p class="fmodes-desc">${esc(s.desc)}</p>` : ''}</header>` : '') +
      `<div class="fmodes-list">${cards}</div></section>`
  };
};
R['failure-modes'] = R.failuremodes;

/* ============================ assembler ============================ */
/* give a rendered section's root element an id (keeps an id the markup already has) */
function withId(html, id) {
  const m = html.match(/<([a-zA-Z][\w-]*)([^>]*)>/);
  if (!m) return { html: `<div id="${esc(id)}">${html}</div>`, id };
  const own = m[2].match(/\sid="([^"]+)"/);
  if (own) return { html, id: own[1] };
  return { html: html.slice(0, m.index) + `<${m[1]} id="${esc(id)}"${m[2]}>` + html.slice(m.index + m[0].length), id };
}
/* navigation mode: rail (sticky side TOC + scrollspy, collapses to an inline TOC below
   1100px), toc (inline collapsible TOC under the header), none. "auto" turns the rail on
   for long reading documents only - ≥ 8 titled sections or ≥ 2 chapters, stack layout,
   document target - dashboards and short pages stay chrome-free. */
function navMode(spec, layout, target, entries, chapters) {
  const raw = spec.nav === true ? 'rail' : spec.nav === false ? 'none' : (spec.nav || 'auto');
  if (raw === 'none') return 'none';
  if (raw === 'auto') return (layout === 'stack' && ['document', 'diagram'].includes(target) && (entries >= 8 || chapters >= 2)) ? 'rail' : 'none';
  if (raw === 'rail' && layout !== 'stack') { console.log(`note: nav "rail" needs layout "stack" (got "${layout}") - using the inline "toc" instead`); return 'toc'; }
  return raw;
}
function build(spec) {
  const lang = inferLanguage(spec);
  ACTIVE_LANG = lang;
  const target = normalizeTarget(spec);
  const viewport = normalizeViewport(spec, target);
  ACTIVE_TARGET = target;
  const axes = deriveDefaults(spec);
  const { theme, header, density } = axes;
  let layout = axes.layout;
  const sections = spec.sections || [];
  /* sidebar needs at least one area:"side" section - otherwise downgrade */
  if (layout === 'sidebar' && !sections.some((s) => s.area === 'side')) {
    console.warn('warning: layout=sidebar but no section has area:"side" - downgrading to layout=stack');
    layout = 'stack';
  }
  /* split: the hero section = first emphasis:"hero" section, else the first */
  let heroIdx = -1;
  if (layout === 'split' && sections.length) {
    heroIdx = sections.findIndex((s) => s.emphasis === 'hero');
    if (heroIdx < 0) heroIdx = 0;
  }
  const used = []; const rendered = [];
  const titleDrops = [];
  const toc = [];           // { id, n, label, chapter }
  let chapterNo = 0;
  const spans = layout === 'bento' ? bentoSpans(sections) : [];
  sections.forEach((s, i) => {
    const fn = R[s.type] || (MODULE_IDS.includes(s.type) ? (x, k) => R.html({ ...x, module: x.type }, k) : R.html);
    const out = fn(s, i);
    // self-check: `title`을 줬는데 aria-label을 제외한 화면 텍스트에 안 보이면 silent-drop.
    // (table/kpi류가 title을 aria-label에만 넣고 시각 제목을 안 그리던 회귀 클래스를 빌드 시점에 잡는다.)
    // html passthrough(및 모듈 id 타입)는 title 렌더 계약이 없으므로(본문 html이 자체 제목 보유) 제외한다 -
    // 그 title은 목차(nav) 항목 이름으로만 쓰인다.
    const raw = s.type === 'html' || MODULE_IDS.includes(s.type) && !R[s.type];
    if (s.title && !raw) {
      const visible = String(out.html || '').replace(/\saria-label="[^"]*"/g, '');
      if (!visible.includes(esc(s.title))) titleDrops.push(`#${i + 1}:${s.type}`);
    }
    (out.css || []).forEach((c) => { if (!used.includes(c)) used.push(c); });
    const cls = [];
    if (s.emphasis === 'hero' || i === heroIdx) cls.push('section-hero');
    else if (s.emphasis === 'quiet') cls.push('section-quiet');
    let styleProp = '';
    if (layout === 'bento') styleProp = `--span:${spans[i]}`;
    else if (layout === 'split') styleProp = i === heroIdx ? '--span:12' : `--span:${spanOf(s, 6)}`;
    const placed = withId(decorateRoot(out.html, cls, styleProp), s.id || `s${i + 1}`);
    let chapterHtml = '';
    if (s.chapter) {
      chapterNo++;
      const chId = `ch${chapterNo}`;
      chapterHtml = `<h2 class="ha-chapter" id="${chId}"><span class="n">${String(chapterNo).padStart(2, '0')}</span>${esc(s.chapter)}</h2>\n`;
      toc.push({ id: chId, chapter: s.chapter, n: chapterNo });
    }
    const label = s.navTitle || s.title;
    if (label) toc.push({ id: placed.id, label });
    rendered.push({ s, html: `<!-- section ${i + 1}: ${s.type} -->\n` + chapterHtml + placed.html });
  });
  if (titleDrops.length) process.stderr.write(`[build] WARN: ${titleDrops.length} section(s) set "title" but render no visible heading (aria-label only): ${titleDrops.join(', ')}\n`);
  const entries = toc.filter((x) => x.label).length;
  const nav = navMode(spec, layout, target, entries, chapterNo);
  const tocList = () => {
    let n = 0;
    return `<ol>${toc.map((x) => x.chapter
      ? `<li class="ha-toc-ch">${esc(x.chapter)}</li>`
      : `<li><a href="#${esc(x.id)}"><span class="n">${String(++n).padStart(2, '0')}</span><span>${esc(x.label)}</span></a></li>`).join('')}</ol>`;
  };
  const inlineToc = nav === 'none' || !entries ? '' : `<details class="ha-toc ha-toc-inline no-print"${nav === 'toc' ? ' open' : ''} data-toc-spy><summary class="ha-toc-title">${esc(t('contents'))} · ${entries}</summary>${tocList()}</details>`;
  const railHtml = nav === 'rail' && entries ? `<nav class="ha-rail ha-toc no-print" aria-label="${esc(t('contents'))}" data-toc-spy><p class="ha-toc-title">${esc(t('contents'))}</p>${tocList()}</nav>` : '';
  let mainInner;
  if (layout === 'sidebar') {
    const side = rendered.filter((r) => r.s.area === 'side').map((r) => r.html);
    const main = rendered.filter((r) => r.s.area !== 'side').map((r) => r.html);
    mainInner = `<aside class="layout-side">\n${side.join('\n')}\n</aside>\n<div class="layout-main">\n${main.join('\n')}\n</div>`;
  } else {
    mainInner = rendered.map((r) => r.html).join('\n');
  }
  let modCSS = '';
  used.forEach((c) => {
    if (c === '__dg__') modCSS += '\n/* diagram (builder) */' + DG_CSS + '\n';
    else if (c === '__target__') modCSS += '\n/* target surface (builder) */' + TARGET_CSS + '\n';
    else modCSS += `\n/* module: ${c} */\n` + moduleCSS(c) + '\n';
  });
  const core = ['reset.css', 'tokens.css', 'themes.css', 'elements.css'].map((f) => read(path.join(CORE, f))).join('\n\n');
  const js = read(path.join(CORE, 'interactions.js'));
  if (!used.includes('__target__') && ['mobile-app', 'tablet-app', 'desktop-app'].includes(target)) {
    modCSS += '\n/* target surface (builder) */' + TARGET_CSS + '\n';
  }
  const viewportControls = ['mobile-app', 'tablet-app', 'desktop-app'].includes(target)
    ? `<div class="ha-viewport-controls no-print" aria-label="${esc(t('viewportControls'))}"><button class="btn btn-ghost btn-sm" data-viewport-target="phone" type="button">${esc(t('phone'))}</button><button class="btn btn-ghost btn-sm" data-viewport-target="tablet" type="button">${esc(t('tablet'))}</button><button class="btn btn-ghost btn-sm" data-viewport-target="desktop" type="button">${esc(t('desktop'))}</button></div>`
    : '';
  const pal = spec.palette ? ` style="--accent:${spec.palette.accent};--on-accent:${spec.palette.onAccent || '#fff'}${spec.palette.colorPrimary ? `;--color-primary:${spec.palette.colorPrimary}` : ''}${spec.palette.extra || ''}"` : '';
  /* ---- header variants (§3): toggle/viewport controls emitted in EVERY variant ---- */
  const toggleBtn = `<button class="btn-ghost btn-sm no-print" data-theme-toggle aria-label="${esc(t('toggleTheme'))}" style="position:absolute;top:var(--sp-5);right:${viewportControls ? '220px' : 'var(--sp-5)'}">◐ ${esc(t('theme'))}</button>`;
  const eyebrowHtml = spec.eyebrow ? `<p class="eyebrow">${esc(spec.eyebrow)}</p>` : '';
  const titleHtml = `<h1>${esc(spec.title || '')}</h1>`;
  const ledeHtml = spec.subtitle ? `<p class="lede">${esc(spec.subtitle)}</p>` : '';
  const metaHtml = Array.isArray(spec.meta) && spec.meta.length
    ? `<dl class="header-meta">${spec.meta.map((m) => `<div class="hm-item"><dt>${esc(m.k)}</dt><dd>${esc(m.v)}</dd></div>`).join('')}</dl>`
    : '';
  let headerHtml;
  if (header === 'none') {
    headerHtml = `<header class="page-controls no-print"><button class="btn-ghost btn-sm" data-theme-toggle aria-label="${esc(t('toggleTheme'))}">◐ ${esc(t('theme'))}</button>${viewportControls}</header>`;
  } else if (header === 'banner') {
    headerHtml = `<header class="page-header header-banner"><div class="container header-banner-inner">${toggleBtn}${viewportControls}${eyebrowHtml}${titleHtml}${ledeHtml}${metaHtml}</div></header>`;
  } else if (header === 'split') {
    headerHtml = `<header class="page-header header-split container">${toggleBtn}${viewportControls}<div>${eyebrowHtml}${titleHtml}${ledeHtml}</div>${metaHtml}</header>`;
  } else if (header === 'compact') {
    headerHtml = `<header class="page-header header-compact container">${toggleBtn}${viewportControls}${eyebrowHtml}${titleHtml}${ledeHtml}</header>`;
  } else {
    headerHtml = `<header class="page-header container">${toggleBtn}${viewportControls}${eyebrowHtml}${titleHtml}${ledeHtml}${metaHtml}</header>`;
  }
  const footerHtml = spec.footer ? `<footer class="page-footer container">${esc(spec.footer)}</footer>` : '';
  const mainHtml = `<main class="container layout-${esc(layout)}">\n${inlineToc ? inlineToc + '\n' : ''}${mainInner}\n</main>`;
  const bodyHtml = railHtml
    ? `<div class="ha-doc">\n${railHtml}\n<div class="ha-doc-main">\n${headerHtml}\n${mainHtml}\n${footerHtml}\n</div>\n</div>`
    : `${headerHtml}\n${mainHtml}\n${footerHtml}`;
  return `<!DOCTYPE html>
<!-- generated by html-artifacts tools/build.mjs - deterministic build, do not hand-edit -->
<html lang="${esc(lang)}" data-theme="${esc(theme)}" data-target="${esc(target)}" data-viewport="${esc(viewport)}" data-layout="${esc(layout)}" data-density="${esc(density)}"${pal}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>${esc(spec.title || '')}</title>
<style>
${core}
${modCSS}</style>
</head>
<body>
${bodyHtml}
<script>
${js}</script>
<script>
${TARGET_JS}</script>
</body>
</html>
`;
}

/* ============================ CLI ============================ */
const [, , specPath, outPath] = process.argv;
if (!specPath || !outPath) { console.error('usage: node tools/build.mjs <spec.json> <out.html>'); process.exit(2); }
// There are no flags. Without this, `build.mjs spec.json -o out.html` silently writes a
// file literally named "-o" and reports success, and you go looking for out.html in vain.
if (outPath.startsWith('-')) { console.error(`error: "${outPath}" looks like a flag, but this builder takes no flags.\nusage: node tools/build.mjs <spec.json> <out.html>`); process.exit(2); }
let spec;
try { spec = JSON.parse(read(specPath)); } catch (e) { console.error(`error: ${specPath} is not valid JSON - ${e.message}`); process.exit(1); }
/* spec check: typos, missing data, uncovered requirements and leftover blueprint samples
   stop the build here instead of quietly producing something other than what was asked */
const check = checkSpec(spec, { root: ROOT, buildSrc: read(new URL(import.meta.url).pathname), specPath, moduleIds: MODULE_IDS });
check.notes.forEach((n) => console.log(n));
check.warns.forEach((w) => console.log(`warning: ${w}`));
if (check.errors.length) {
  console.error(`\nspec check FAILED - ${check.errors.length} error(s); nothing was written:`);
  check.errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
}
const html = build(spec);
BUILD_NOTES.forEach((n) => console.log(`note: ${n}`));
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, html);
const effectiveTheme = (html.match(/<html[^>]*\bdata-theme="([^"]+)"/) || [])[1] || 'birchline';
console.log(`built ${outPath}  (${html.length} bytes, ${(spec.sections || []).length} sections, theme=${effectiveTheme})`);
console.log('next: node tools/validate.mjs <out.html> && node tools/render-check.mjs <out.html> --shots=<dir>  (then look at the screenshots)');
