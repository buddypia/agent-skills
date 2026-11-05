/* html-artifacts · in-browser render audit (evaluated by tools/render-check.mjs)
   ----------------------------------------------------------------------------
   One expression, no dependencies. Evaluated inside the rendered page at a given
   viewport width; returns { width, fail: [...], warn: [...] } describing defects
   that a static validator cannot see because they only exist after layout:

     FAIL  page-overflow   the page scrolls sideways (something is wider than the viewport)
     FAIL  broken-anchor   <a href="#x"> with no element id="x"
     FAIL  broken-image    <img> that failed to load
     WARN  tiny-text       rendered text smaller than 10px (SVG text is measured after
                           viewBox scaling - the usual cause of unreadable chart labels)
     WARN  label-collision two SVG <text> labels overlap each other
     WARN  label-clipped   an SVG <text> label sticks out of its own <svg> box
     WARN  text-spill      text runs outside its box (no clipping, no ellipsis)
     WARN  orphan-row      a ≥3-column grid whose last row holds a single item
     WARN  cramped-box     a bordered card whose first text touches its top border
     WARN  empty-section   a top-level section that renders no text and no graphic

   Every finding names the element (tag.class "text…") so the fix can be located. */
(() => {
  const W = document.documentElement.clientWidth;
  const fail = [], warn = [];
  const MAX = 12;
  const push = (arr, kind, msg) => { if (arr.filter((x) => x.kind === kind).length < MAX) arr.push({ kind, msg }); else { const o = arr.find((x) => x.kind === kind && x.more != null) || arr.find((x) => x.kind === kind); o.more = (o.more || 0) + 1; } };
  const visible = (el) => {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    }
    return true;
  };
  const name = (el) => {
    const tag = (el.tagName || '').toLowerCase();
    const raw = el.getAttribute && el.getAttribute('class');
    const cls = raw ? '.' + raw.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return `${tag}${cls}${txt ? ` "${txt}"` : ''}`;
  };
  const scrollsX = (el) => { const o = getComputedStyle(el).overflowX; return o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip'; };
  const insideScroller = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (scrollsX(n)) return true; return false; };

  /* 1. page-level horizontal overflow: report the outermost offenders only */
  if (document.documentElement.scrollWidth > W + 1) {
    const offenders = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (!visible(el) || insideScroller(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > W + 1 && !offenders.some((o) => o.contains(el))) offenders.push(el);
    });
    const list = offenders.filter((el) => !offenders.some((o) => o !== el && o.contains(el)));
    push(fail, 'page-overflow', `page is ${document.documentElement.scrollWidth}px wide at a ${W}px viewport - ${list.slice(0, 4).map((el) => `${name(el)} (right edge ${Math.round(el.getBoundingClientRect().right)}px)`).join(', ') || 'offender not isolated'}`);
  }

  /* 2. broken in-page anchors / images */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (id && !document.getElementById(id)) push(fail, 'broken-anchor', `${name(a)} → #${id} does not exist`);
  });
  document.querySelectorAll('img').forEach((img) => { if (img.complete && img.naturalWidth === 0 && visible(img)) push(fail, 'broken-image', name(img)); });

  /* 3. tiny text (HTML + SVG, measured as rendered) */
  const tiny = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    // zoomable diagrams ([data-zoompan]) are exempt: the reader zooms them instead
    if (!el || seen.has(el) || el.closest('script,style,title,defs,[data-zoompan]')) continue;
    seen.add(el);
    if (!visible(el)) continue;
    let px = parseFloat(getComputedStyle(el).fontSize) || 0;
    if (el instanceof SVGElement && el.ownerSVGElement) {
      const m = el.getScreenCTM();
      if (m) px *= Math.hypot(m.a, m.b);
    }
    if (px > 0 && px < 10) tiny.push({ el, px });
  }
  if (tiny.length) {
    tiny.sort((a, b) => a.px - b.px);
    push(warn, 'tiny-text', `${tiny.length} text element(s) render below 10px; smallest: ${tiny.slice(0, 4).map((t) => `${name(t.el)} @${t.px.toFixed(1)}px`).join(', ')}`);
  }

  /* 4. SVG label collisions and clipped labels */
  document.querySelectorAll('svg').forEach((svg) => {
    if (!visible(svg)) return;
    const box = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll('text')].filter((t) => visible(t) && t.textContent.trim()).map((t) => ({ t, r: t.getBoundingClientRect() })).filter((x) => x.r.width > 0);
    let hits = 0;
    for (let i = 0; i < texts.length && hits < 3; i++) {
      for (let j = i + 1; j < texts.length && hits < 3; j++) {
        const a = texts[i].r, b = texts[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) { hits++; push(warn, 'label-collision', `${name(texts[i].t)} overlaps ${name(texts[j].t)}`); }
      }
    }
    if (getComputedStyle(svg).overflow !== 'visible') {
      texts.forEach(({ t, r }) => {
        if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) push(warn, 'label-clipped', `${name(t)} is cut off by its <svg> box`);
      });
    }
  });

  /* 5. text spilling outside its own box (visible overflow, no ellipsis) */
  document.querySelectorAll('body *').forEach((el) => {
    if (el instanceof SVGElement || !el.childNodes.length) return;
    const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim());
    if (!own) return;
    const cs = getComputedStyle(el);
    if (cs.display.startsWith('inline') && cs.display !== 'inline-block' && cs.display !== 'inline-flex' && cs.display !== 'inline-grid') return;
    if (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis') return;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && visible(el)) push(warn, 'text-spill', `${name(el)} content ${el.scrollWidth}px in a ${el.clientWidth}px box`);
  });

  /* 6. orphan last row in multi-column grids (e.g. 5 KPI cards → 4 + 1) */
  document.querySelectorAll('body *').forEach((el) => {
    if (el.matches('main[class*="layout-"]')) return;
    const cs = getComputedStyle(el);
    if (cs.display !== 'grid' || !visible(el)) return;
    const kids = [...el.children].filter((k) => visible(k) && getComputedStyle(k).position !== 'absolute');
    if (kids.length < 4) return;
    // only uniform card grids: a row template whose cells differ in width is a layout, not a card set
    const ws = kids.map((k) => k.getBoundingClientRect().width);
    if (Math.max(...ws) > Math.min(...ws) * 1.15) return;
    const rows = new Map();
    kids.forEach((k) => { const top = Math.round(k.getBoundingClientRect().top); rows.set(top, (rows.get(top) || 0) + 1); });
    const counts = [...rows.values()];
    if (counts.length >= 2 && counts[0] >= 3 && counts[counts.length - 1] === 1) push(warn, 'orphan-row', `${name(el)} lays out ${kids.length} items as ${counts.join('+')} - the last one sits alone`);
  });

  /* 6b. cramped boxes: a bordered card whose text touches its own border (lost padding) */
  document.querySelectorAll('body *').forEach((el) => {
    if (el instanceof SVGElement || !visible(el)) return;
    const cs = getComputedStyle(el);
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(cs[`border${k}Width`]) || 0);
    if (bw.some((w) => w < 1) || cs.borderTopStyle === 'none') return;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 48) return;                      // chips, badges, inputs
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() && n.parentElement && visible(n.parentElement) && !(n.parentElement instanceof SVGElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const first = tw.nextNode();
    if (!first) return;
    const range = document.createRange(); range.selectNodeContents(first);
    const t = range.getBoundingClientRect();
    if (!t.height) return;
    const gapTop = t.top - (r.top + bw[0]);
    if (gapTop >= 0 && gapTop < 3) push(warn, 'cramped-box', `${name(el)}: its text starts ${gapTop.toFixed(1)}px below the top border (no padding)`);
  });

  /* 7. empty top-level sections */
  document.querySelectorAll('main > *, .layout-main > *, .layout-side > *').forEach((el) => {
    if (/^(STYLE|SCRIPT|ASIDE|DIV)$/.test(el.tagName) && el.matches('.layout-main,.layout-side')) return;
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT' || !visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return;                       // .sr-only live regions etc.
    if (!el.textContent.trim() && !el.querySelector('svg,img,canvas,input,select,textarea')) push(warn, 'empty-section', name(el));
  });

  return { width: W, height: document.documentElement.scrollHeight, fail, warn };
})()
