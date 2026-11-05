/* ============================================================================
   interactions.js  -  Layer 3 / Behaviors  (v2 - visual + interactive)
   ONE dependency-free library that wires every interactive module via
   data-attributes (no per-component scripts). Auto-initialises on
   DOMContentLoaded; each behaviour is isolated (one failure never breaks others).

   ── Markup contract (add the attribute, the behaviour attaches itself) ──
   BASIC
     [data-theme-toggle]                 swap to the theme's light/dark counterpart and back
     [data-toc-spy] a[href="#id"]        scrollspy: aria-current on the section in view
     table[data-sortable]                click <th> to sort (asc/desc, num-aware)
     [data-filter] + [data-filter-in]    live text filter (toggles .hidden; scoped to its own
                                         [data-filter-scope] / .data-table when the selector matches there)
     [data-kanban] + [data-col] + .kanban-card     drag cards across columns
     [data-copy] / [data-copy-text]      copy target/literal to clipboard (auto i18n feedback + file:// fallback)
     [data-switch-group="G"] [data-switch="v"] ↔ [data-switch-for="G"][data-switch-case="v"]  page-wide switcher
     [data-slider="--var"][data-out]     live CSS var + readout
     [data-tabs] + .tab[data-tab] + [data-panel]   tabbed panels
     [data-form-mock] (<form>)           intercept submit → confirm in place (.form-status), never navigate
   VISUAL / INTERACTIVE  (the html-visual power tools)
     [data-zoompan] > svg > g[data-viewport]       wheel-zoom + drag-pan + fit
        controls: [data-zoom-in] [data-zoom-out] [data-zoom-reset] [data-zoom-readout]
        keys: + / - / 0 ;  opts: data-zoom-min data-zoom-max
     svg[data-draggable] g[data-node="id"]         drag nodes (SVG-CTM accurate)
        edges: line[data-edge][data-from][data-to] auto-track node centres
        keyboard: focus node, arrow keys move ; [data-drag-reset] restores
     [data-tree] [data-tree-toggle] → [data-children]   collapse/expand subtree
     [data-crossfilter] [data-filter-key="k"] ↔ [data-series="k"]   click to dim/show
     table[data-paginate][data-page-size] (+ optional row [data-row-select])
     [data-chart-tip] [data-tip="text"]            hover tooltip on bars/points
     [data-counter] (data-to=NUM data-dur=ms data-prefix= data-suffix=)   count-up on reveal
     [data-reveal] (data-reveal-delay=ms)          fade/slide in on scroll
     [data-reorder] + [data-reorder-item][data-rid]   drag/keyboard reorder blocks
        scope: data-reorder-scope=regions|cards|elements ; mode=insert|swap (geometric)
        handle: [data-reorder-handle] ; controls: [data-reorder-reset] [data-reorder-export]
        a11y: roving tabindex + Space pick-up / Arrows move / Space drop / Esc cancel ;
              injects [data-reorder-live] ; FLIP composes each block's resting rotation
     [data-wf-palette] [data-wf-add=type] + [data-wf-board] [data-wf-el][data-el-type]
        element editor (HA.wfedit): ADD typed lo-fi elements into the active card,
        DELETE via ✕ / Delete on a focused element, MOVE reuses [data-reorder].
        active card tracked by focusin ; export gains a live per-card element tree.
   ============================================================================ */
  /* (HA.reorder + HA.wfedit are defined below; both no-op with zero footprint when their attrs are absent.) */
(function () {
  "use strict";
  var HA = (window.HA = window.HA || {});
  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ===================== BASIC ===================== */

  /* Light ↔ dark counterpart of the page's own theme (same structural family where one
     exists), so a dark theme toggles to LIGHT instead of to another dark theme. */
  var THEME_PAIR = { birchline: "sunset", rose: "sunset", forest: "dark-focus", minimal: "dark-focus", slate: "midnight",
    "interactive-warm": "nord", midnight: "slate", nord: "interactive-warm", sunset: "birchline", "dark-focus": "birchline" };
  HA.themeToggle = function (root) {
    $all("[data-theme-toggle]", root).forEach(function (btn) {
      if (btn._ha) return; btn._ha = true;
      btn.addEventListener("click", function () {
        var html = document.documentElement;
        var cur = html.getAttribute("data-theme") || "birchline";
        var next = html.dataset.prevTheme || THEME_PAIR[cur] || "dark-focus";
        html.dataset.prevTheme = cur;
        html.setAttribute("data-theme", next);
      });
    });
  };

  /* Table-of-contents scrollspy: in a [data-toc-spy] nav, the link of the section now at
     the top of the viewport gets aria-current="true" (rail + inline toc stay in sync). */
  HA.tocSpy = function (root) {
    $all("[data-toc-spy]", root).forEach(function (nav) {
      if (nav._spy) return; nav._spy = true;
      var links = $all('a[href^="#"]', nav), targets = [];
      links.forEach(function (a) {
        var el = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
        if (el) targets.push({ el: el, a: a });
      });
      if (!targets.length) return;
      var ticking = false, last = null;
      // current = the last section whose top has passed a reading line near the top of the viewport
      // (at the very bottom of the page: the last section, which may never reach the line)
      function update() {
        ticking = false;
        var line = Math.min(window.innerHeight * 0.3, 140), cur = targets[0];
        targets.forEach(function (t) { if (t.el.getBoundingClientRect().top <= line) cur = t; });
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = targets[targets.length - 1];
        if (cur === last) return; last = cur;
        links.forEach(function (a) { a.removeAttribute("aria-current"); });
        cur.a.setAttribute("aria-current", "true");
      }
      window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      window.addEventListener("resize", update);
      update();
    });
  };

  HA.sortable = function (root) {
    $all("table[data-sortable]", root).forEach(function (table) {
      var ths = table.tHead ? table.tHead.rows[0].cells : [];
      Array.prototype.forEach.call(ths, function (th, idx) {
        th.style.cursor = "pointer"; th.setAttribute("role", "button");
        th.addEventListener("click", function () {
          var tbody = table.tBodies[0];
          var rows = Array.prototype.slice.call(tbody.rows);
          var asc = th.dataset.sort !== "asc";
          Array.prototype.forEach.call(ths, function (h) { h.removeAttribute("data-sort"); });
          th.dataset.sort = asc ? "asc" : "desc";
          rows.sort(function (a, b) {
            var x = a.cells[idx].textContent.trim(), y = b.cells[idx].textContent.trim();
            var nx = parseFloat(x.replace(/[^0-9.\-]/g, "")), ny = parseFloat(y.replace(/[^0-9.\-]/g, ""));
            var both = !isNaN(nx) && !isNaN(ny);
            var cmp = both ? nx - ny : x.localeCompare(y);
            return asc ? cmp : -cmp;
          });
          rows.forEach(function (r) { tbody.appendChild(r); });
          if (table._repage) table._repage();
        });
      });
    });
  };

  HA.filter = function (root) {
    $all("[data-filter]", root).forEach(function (input) {
      var sel = input.getAttribute("data-filter-in");
      // two tables on one page share ".dt-row": search only inside the input's own table block
      var scope = input.closest("[data-filter-scope], .data-table");
      if (!scope || !scope.querySelector(sel)) scope = document;
      input.addEventListener("input", function () {
        var q = input.value.toLowerCase();
        $all(sel, scope).forEach(function (el) {
          el.classList.toggle("hidden", !!q && el.textContent.toLowerCase().indexOf(q) === -1);
        });
        $all("table[data-paginate]").forEach(function (t) { if (t._repage) t._repage(); });
      });
    });
  };

  HA.kanban = function (root) {
    $all("[data-kanban]", root).forEach(function (board) {
      var dragged = null;
      $all(".kanban-card", board).forEach(function (card) {
        card.setAttribute("draggable", "true");
        card.addEventListener("dragstart", function () { dragged = card; setTimeout(function () { card.classList.add("dragging"); }, 0); });
        card.addEventListener("dragend", function () { card.classList.remove("dragging"); dragged = null; });
      });
      $all("[data-col]", board).forEach(function (col) {
        col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("drop-target"); });
        col.addEventListener("dragleave", function () { col.classList.remove("drop-target"); });
        col.addEventListener("drop", function (e) {
          e.preventDefault(); col.classList.remove("drop-target");
          if (dragged) (col.querySelector(".kanban-cards") || col).appendChild(dragged);
        });
      });
    });
  };

  HA.copy = function (root) {
    $all("[data-copy],[data-copy-text]", root).forEach(function (btn) {
      if (btn._haCopy) return; btn._haCopy = true;
      btn.addEventListener("click", function () {
        var lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
        var doneMsg = btn.getAttribute("data-copy-done") || (lang.indexOf("ja") === 0 ? "✓ コピーしました！" : lang.indexOf("ko") === 0 ? "✓ 복사되었습니다!" : "Copied ✓");
        var failMsg = btn.getAttribute("data-copy-failed") || (lang.indexOf("ja") === 0 ? "コピーできませんでした" : lang.indexOf("ko") === 0 ? "복사하지 못했습니다" : "Copy failed");
        function flash(message, ok) {
          var old = btn.dataset.origLabel || btn.textContent;
          btn.dataset.origLabel = old;
          btn.textContent = message;
          btn.classList.toggle("copied", ok);
          clearTimeout(btn._copyTimer);
          btn._copyTimer = setTimeout(function () { btn.textContent = old; btn.classList.remove("copied"); }, 1600);
        }
        function done() { flash(doneMsg, true); }
        function failed() { flash(failMsg, false); }
        var text = btn.getAttribute("data-copy-text");
        if (text === null) {
          try {
            var selector = btn.getAttribute("data-copy");
            var target = selector ? document.querySelector(selector) : null;
            if (!target) { failed(); return; }
            text = "value" in target ? target.value : target.textContent;
          } catch (e) { failed(); return; }
        }
        function fallback() { if (fallbackCopy(text)) done(); else failed(); }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, fallback);
          } else fallback();
        } catch (e) { fallback(); }
      });
    });
    function fallbackCopy(text) {
      var ta, focused = document.activeElement;
      try {
        ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        return document.execCommand("copy") === true;
      } catch (e) { return false; }
      finally {
        if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
        if (focused && focused.focus) focused.focus({ preventScroll: true });
      }
    }
  };

  HA.switcher = function (root) {
    $all("[data-switch-group]", root).forEach(function (bar) {
      if (bar._haSwitch) return; bar._haSwitch = true;
      var group = bar.getAttribute("data-switch-group");
      if (!group) return;
      function apply(val) {
        $all('[data-switch-group="' + group + '"] [data-switch]').forEach(function (b) {
          var on = b.getAttribute("data-switch") === val;
          b.classList.toggle("active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        $all('[data-switch-for="' + group + '"]').forEach(function (el) {
          var cases = (el.getAttribute("data-switch-case") || "").split(/[\s,]+/).filter(Boolean);
          var only = el.hasAttribute("data-switch-only");
          var show = (val === "all" && !only) || cases.indexOf("all") !== -1 || cases.indexOf(val) !== -1;
          el.classList.toggle("hidden", !show);
          if (show && HA.fitSvgText) HA.fitSvgText(el);
        });
      }
      $all("[data-switch]", bar).forEach(function (btn) {
        btn.addEventListener("click", function () { apply(btn.getAttribute("data-switch")); });
      });
    });
  };

  HA.slider = function (root) {
    $all("[data-slider]", root).forEach(function (input) {
      var varName = input.getAttribute("data-slider");
      var out = input.getAttribute("data-out") ? document.querySelector(input.getAttribute("data-out")) : null;
      function sync() {
        if (varName) document.documentElement.style.setProperty(varName, input.value + (input.dataset.unit || ""));
        if (out) out.textContent = input.value + (input.dataset.unit || "");
      }
      input.addEventListener("input", sync); sync();
    });
  };

  HA.tabs = function (root) {
    $all("[data-tabs]", root).forEach(function (group) {
      var tabs = $all(".tab", group);
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          tabs.forEach(function (t) { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
          $all("[data-panel]", group).forEach(function (p) { p.classList.add("hidden"); });
          tab.classList.add("active"); tab.setAttribute("aria-selected", "true");
          var panel = group.querySelector('[data-panel="' + tab.getAttribute("data-tab") + '"]');
          if (panel) { panel.classList.remove("hidden"); if (HA.fitSvgText) HA.fitSvgText(panel); }
        });
      });
    });
  };

  /* ===================== VISUAL / INTERACTIVE ===================== */

  /* Zoom + pan any SVG: wrap content in <g data-viewport>. Source: demo2 arch-microservices. */
  HA.zoompan = function (root) {
    $all("[data-zoompan]", root).forEach(function (stage) {
      var svg = stage.matches("svg") ? stage : stage.querySelector("svg");
      var vp = svg && svg.querySelector("[data-viewport]");
      if (!svg || !vp) return;
      svg.style.touchAction = "none";
      var MIN = parseFloat(stage.dataset.zoomMin || "0.4"), MAX = parseFloat(stage.dataset.zoomMax || "2.6");
      var view = { s: 1, tx: 0, ty: 0 };
      var readout = stage.querySelector("[data-zoom-readout]");
      function apply() {
        vp.setAttribute("transform", "translate(" + view.tx + "," + view.ty + ") scale(" + view.s + ")");
        if (readout) readout.textContent = Math.round(view.s * 100) + "%";
      }
      function zoomAt(f, cx, cy) {
        var r = stage.getBoundingClientRect();
        if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
        var ns = Math.max(MIN, Math.min(MAX, view.s * f)), k = ns / view.s;
        view.tx = cx - k * (cx - view.tx); view.ty = cy - k * (cy - view.ty); view.s = ns; apply();
      }
      function reset() { view = { s: 1, tx: 0, ty: 0 }; apply(); }
      stage.addEventListener("wheel", function (e) {
        e.preventDefault(); var r = stage.getBoundingClientRect();
        zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      var panning = false, last = null;
      stage.addEventListener("pointerdown", function (e) {
        if (e.target.closest("[data-node]")) return;       // don't pan when grabbing a node
        panning = true; last = { x: e.clientX, y: e.clientY }; stage.classList.add("panning");
        try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      });
      stage.addEventListener("pointermove", function (e) {
        if (!panning) return; view.tx += e.clientX - last.x; view.ty += e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY }; apply();
      });
      function end(e) { panning = false; stage.classList.remove("panning"); try { stage.releasePointerCapture(e.pointerId); } catch (x) {} }
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { stage.addEventListener(ev, end); });
      var qs = function (s) { return stage.querySelector(s); };
      if (qs("[data-zoom-in]")) qs("[data-zoom-in]").addEventListener("click", function () { zoomAt(1.2); });
      if (qs("[data-zoom-out]")) qs("[data-zoom-out]").addEventListener("click", function () { zoomAt(1 / 1.2); });
      if (qs("[data-zoom-reset]")) qs("[data-zoom-reset]").addEventListener("click", reset);
      stage.addEventListener("keydown", function (e) {
        if (e.key === "+" || e.key === "=") zoomAt(1.2);
        else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.2);
        else if (e.key === "0") reset();
      });
      apply();
    });
  };

  /* Draggable diagram nodes with auto-tracking edges. Source: demo2 erd-blog-schema. */
  HA.dragNode = function (root) {
    $all("svg[data-draggable]", root).forEach(function (svg) {
      var nodes = $all("[data-node]", svg), edges = $all("[data-edge]", svg), drag = null, init = {};
      function toSvg(e) {
        var pt = svg.createSVGPoint(), src = e.touches ? e.touches[0] : e;
        pt.x = src.clientX; pt.y = src.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
      }
      function translate(g) { var m = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)/.exec(g.getAttribute("transform") || ""); return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 }; }
      function centre(id) {
        var g = svg.querySelector('[data-node="' + id + '"]'); if (!g) return null;
        var t = translate(g), b;
        try { b = g.getBBox(); } catch (e) { b = { x: 0, y: 0, width: 0, height: 0 }; }
        return { x: t.x + b.x + b.width / 2, y: t.y + b.y + b.height / 2, hw: b.width / 2, hh: b.height / 2 };
      }
      // point on p's bounding-box border in the direction of `toward` - so edges stop
      // at the node edge (arrowheads stay visible) instead of hiding under the box.
      function border(p, toward) {
        var dx = toward.x - p.x, dy = toward.y - p.y;
        if (!dx && !dy) return { x: p.x, y: p.y };
        var tx = (p.hw > 0 && dx) ? p.hw / Math.abs(dx) : Infinity;
        var ty = (p.hh > 0 && dy) ? p.hh / Math.abs(dy) : Infinity;
        var t = Math.min(tx, ty, 1);
        return { x: p.x + dx * t, y: p.y + dy * t };
      }
      /* `initial` = the load-time pass. A builder that computed a real route (curves,
         detours around other cards) encodes it as a `C` path; flattening that to a
         centre-to-centre straight line on load silently destroys the layout and sends
         edges through unrelated nodes. Once the user actually drags a node the stored
         route no longer describes reality, so from then on we do re-route everything. */
      function routeEdges(initial) {
        var nBoxes = nodes.map(function (g) {
          var id = g.getAttribute("data-node"), c = centre(id);
          return c ? { id: id, x1: c.x - c.hw - 4, y1: c.y - c.hh - 4, x2: c.x + c.hw + 4, y2: c.y + c.hh + 4 } : null;
        }).filter(Boolean);
        var placedLbls = [];
        edges.forEach(function (ed) {
          if (initial && (ed.getAttribute("d") || "").indexOf("C") !== -1) return;
          var fromId = ed.getAttribute("data-from"), toId = ed.getAttribute("data-to");
          var a = centre(fromId), c = centre(toId); if (!a || !c) return;
          var pa = border(a, c), pc = border(c, a);
          if (ed.tagName.toLowerCase() === "line") { ed.setAttribute("x1", pa.x); ed.setAttribute("y1", pa.y); ed.setAttribute("x2", pc.x); ed.setAttribute("y2", pc.y); }
          else ed.setAttribute("d", "M" + pa.x + " " + pa.y + " L" + pc.x + " " + pc.y);
          var lbl = svg.querySelector('[data-edge-label="' + fromId + "-" + toId + '"]');
          if (lbl) {
            var lw = Math.max(36, (lbl.textContent || "").length * 6.5 + 12), lh = 15;
            var bestX = (pa.x + pc.x) / 2, bestY = (pa.y + pc.y) / 2 - 8, bestScore = 1e9;
            [0.5, 0.3, 0.7, 0.22, 0.78].forEach(function (t) {
              [[-8, 0], [12, 0], [-18, 0], [0, -14], [0, 14]].forEach(function (off) {
                var lx = pa.x + (pc.x - pa.x) * t + off[1];
                var ly = pa.y + (pc.y - pa.y) * t + off[0];
                var score = Math.abs(t - 0.5) * 20 + Math.abs(off[0] + 8) * 0.5 + Math.abs(off[1]) * 0.5;
                nBoxes.forEach(function (b) {
                  if (b.id === fromId || b.id === toId) return;
                  if (lx + lw / 2 > b.x1 && lx - lw / 2 < b.x2 && ly + 3 > b.y1 && ly - lh < b.y2) score += 500;
                });
                placedLbls.forEach(function (p) {
                  if (Math.abs(lx - p.x) < (lw + p.w) / 2 + 4 && Math.abs(ly - p.y) < lh) score += 300;
                });
                if (score < bestScore) { bestScore = score; bestX = lx; bestY = ly; }
              });
            });
            lbl.setAttribute("x", Math.round(bestX * 10) / 10);
            lbl.setAttribute("y", Math.round(bestY * 10) / 10);
            placedLbls.push({ x: bestX, y: bestY, w: lw });
          }
        });
      }
      // auto-fit <foreignObject> cards to their content height. HTML-in-SVG can't
      // auto-size, so a card with more rows than its declared height clips its bottom
      // rows. We measure the rendered card and grow the foreignObject (+ its .erd-hit)
      // to match - robust across themes/fonts/row-counts. Runs before routeEdges.
      function fitForeignObjects() {
        var ctm = svg.getScreenCTM(); var scale = ctm ? ctm.a : 1;
        $all("foreignObject", svg).forEach(function (fo) {
          var card = fo.firstElementChild; if (!card) return;
          var h = card.getBoundingClientRect().height; if (h < 4) return;
          var userH = Math.ceil(h / (scale || 1)) + 2;
          fo.setAttribute("height", userH);
          var node = fo.closest("[data-node]"); var hit = node && node.querySelector(".erd-hit");
          if (hit) hit.setAttribute("height", userH);
        });
      }
      nodes.forEach(function (g) {
        g.style.cursor = "grab"; g.setAttribute("tabindex", "0");
        init[g.getAttribute("data-node")] = translate(g);
        g.addEventListener("pointerdown", function (e) {
          e.preventDefault(); var p = toSvg(e), t = translate(g);
          drag = { g: g, offX: p.x - t.x, offY: p.y - t.y }; g.classList.add("dragging");
          var firstLbl = svg.querySelector("[data-edge-label]");
          if (firstLbl && firstLbl.parentNode === g.parentNode) g.parentNode.insertBefore(g, firstLbl);
          else g.parentNode.appendChild(g);
          try { g.setPointerCapture(e.pointerId); } catch (x) {}
        });
        g.addEventListener("pointermove", function (e) {
          if (!drag || drag.g !== g) return; var p = toSvg(e);
          g.setAttribute("transform", "translate(" + (p.x - drag.offX) + "," + (p.y - drag.offY) + ")"); routeEdges();
        });
        g.addEventListener("pointerup", function () { g.classList.remove("dragging"); drag = null; });
        g.addEventListener("keydown", function (e) {
          var t = translate(g), step = e.shiftKey ? 24 : 8, moved = true;
          if (e.key === "ArrowLeft") t.x -= step; else if (e.key === "ArrowRight") t.x += step;
          else if (e.key === "ArrowUp") t.y -= step; else if (e.key === "ArrowDown") t.y += step; else moved = false;
          if (moved) { e.preventDefault(); g.setAttribute("transform", "translate(" + t.x + "," + t.y + ")"); routeEdges(); }
        });
      });
      $all("[data-drag-reset]", svg.parentNode || document).forEach(function (btn) {
        btn.addEventListener("click", function () {
          nodes.forEach(function (g) { var p = init[g.getAttribute("data-node")]; g.setAttribute("transform", "translate(" + p.x + "," + p.y + ")"); });
          routeEdges();
        });
      });
      fitForeignObjects();
      if (HA.fitSvgText) HA.fitSvgText(svg);
      routeEdges(true);
    });
  };

  /* Drag/keyboard REORDER of sibling blocks. Opt-in via [data-reorder]; pointer-events
     based (NOT native DnD, NEVER draggable="true"/data-draggable, so validate.mjs rule 5
     stays N/A). FLIP-animated (composes with each block's resting rotation), fully
     keyboard-accessible (roving tabindex + aria-live), reduced-motion aware. No footprint
     when absent (early return). Two modes: insert (placeholder splice - regions) and
     swap (exchange two nodes - the cards "drag to swap positions"). Source: wireframe-block. */
  HA.reorder = function (root) {
    var boards = $all("[data-reorder]", root);
    if (!boards.length) return;                          // zero footprint when unused
    function reduced() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

    // one shared visually-hidden live region (authored or injected once)
    var live = document.querySelector("[data-reorder-live]");
    if (!live) {
      live = document.createElement("div"); live.className = "sr-only";
      live.setAttribute("data-reorder-live", ""); live.setAttribute("aria-live", "polite"); live.setAttribute("aria-atomic", "true");
      document.body.appendChild(live);
    }
    // clear-then-set on a later frame so repeated identical messages re-fire for SRs
    function announce(m) { live.textContent = ""; requestAnimationFrame(function () { live.textContent = m; }); }

    function items(c) { return $all(":scope > [data-reorder-item]", c); }
    function pos(c, el) { var s = items(c); return { i: s.indexOf(el) + 1, n: s.length }; }
    function noun(c) { return c.getAttribute("data-reorder-noun") || (c.getAttribute("data-reorder-scope") === "cards" ? "card" : "block"); }
    function label(el) { return String(el.getAttribute("data-rid") || ""); }
    function nextItem(el) { var n = el.nextElementSibling; while (n && !n.hasAttribute("data-reorder-item")) n = n.nextElementSibling; return n; }
    function prevItem(el) { var p = el.previousElementSibling; while (p && !p.hasAttribute("data-reorder-item")) p = p.previousElementSibling; return p; }
    function roveTo(c, el) { items(c).forEach(function (x) { x.setAttribute("tabindex", x === el ? "0" : "-1"); }); }
    // resting rotation a block returns to (cards alternate by position; regions fixed via data-rest-rot)
    function restRot(c, el) { if (reduced()) return 0; if (el.closest && el.closest("[data-wf-flat]")) return 0; if (el.dataset.restRot != null) return parseFloat(el.dataset.restRot) || 0; var i = items(c).indexOf(el); return i % 2 === 0 ? -0.5 : 0.5; }
    function settle(el) { if (reduced()) return; el.classList.remove("just-dropped"); void el.offsetWidth; el.classList.add("just-dropped"); setTimeout(function () { el.classList.remove("just-dropped"); }, 600); }
    function swapNodes(a, b) { var m = document.createComment(""); a.parentNode.insertBefore(m, a); b.parentNode.insertBefore(a, b); m.parentNode.insertBefore(b, m); m.parentNode.removeChild(m); }

    // FLIP: First/Last/Invert/Play across a container, composing each block's resting rotation
    function flip(c, mutate) {
      var before = items(c), rects = before.map(function (el) { return el.getBoundingClientRect(); });
      mutate();
      var now = items(c);
      if (reduced()) { now.forEach(function (el) { el.style.transition = ""; el.style.transform = ""; }); return; }
      now.forEach(function (el) {
        var k = before.indexOf(el); if (k < 0) return;
        var L = el.getBoundingClientRect(), dx = rects[k].left - L.left, dy = rects[k].top - L.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) { el.style.transition = ""; el.style.transform = ""; return; }
        el.style.transition = "none";                    // INVERT: translate BEFORE rotate (screen-space delta) + resting tilt
        el.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + restRot(c, el) + "deg)";
      });
      requestAnimationFrame(function () {                 // PLAY
        now.forEach(function (el) {
          if (before.indexOf(el) < 0 || !el.style.transform) return;
          el.style.transition = "transform var(--dur-mid) var(--ease)";
          el.style.transform = "rotate(" + restRot(c, el) + "deg)";
          var done = function (ev) { if (ev && ev.propertyName !== "transform") return; el.style.transition = ""; el.style.transform = ""; el.removeEventListener("transitionend", done); };
          el.addEventListener("transitionend", done);
        });
      });
    }

    // ---- pointer hit-tests (geometric - work for flex-wrap, grid, column, row alike) ----
    function rectOf(el) { var r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
    function hitSwap(c, dragged, x, y) {           // card under the pointer to exchange with
      var best = null, bd = Infinity;
      items(c).forEach(function (el) { if (el === dragged) return; var R = rectOf(el); if (x >= R.l && x <= R.r && y >= R.t && y <= R.b) { var d = (x - R.cx) * (x - R.cx) + (y - R.cy) * (y - R.cy); if (d < bd) { bd = d; best = el; } } });
      return best;
    }
    function hitBefore(c, dragged, x, y) {         // sibling to insert before (null = append)
      var sibs = items(c).filter(function (el) { return el !== dragged; });
      if (!sibs.length) return null;
      // Detect the board's primary axis from its first two items (column vs row), then test ONLY
      // that axis. A vertical stack must compare Y alone: the old combined test (`y<cy || (y<=bottom && x<cx)`)
      // broke DOWNWARD dragging because the grab handle sits on the LEFT, so the pointer x stayed
      // left-of-centre for the whole drag → `x<cx` was always true → every hovered item read as
      // "insert before it" → an item could move UP but never DOWN. Axis detection fixes both layouts.
      var horizontal = false;
      if (sibs.length > 1) { var a = rectOf(sibs[0]), b = rectOf(sibs[1]); horizontal = Math.abs(b.cx - a.cx) > Math.abs(b.cy - a.cy); }
      for (var i = 0; i < sibs.length; i++) { var R = rectOf(sibs[i]); if (horizontal ? (x < R.cx) : (y < R.cy)) return sibs[i]; }
      return null;
    }

    // per-item wiring - extracted so a RUNTIME-added element (HA.wfedit) can be wired
    // with the exact same code path. Idempotent (it._wired) so a stray re-call no-ops.
    function wireItem(c, it) {
      if (it._wired) return; it._wired = true;
      var mode = c.getAttribute("data-reorder-mode") || "insert";   // read per-call → each board keeps its own mode
      it.setAttribute("role", "listitem");
      it.setAttribute("aria-roledescription", "reorderable " + noun(c));
      it.setAttribute("tabindex", "-1");                            // roving fixed by the boot loop / roveTo
      it.setAttribute("aria-grabbed", "false");
      var handle = it.querySelector("[data-reorder-handle]") || it;
      var startX = 0, startY = 0, offX = 0, offY = 0, dragging = false, capId = null, ph = null, target = null;
      var curC = null, dragGroup = null, srcAtBegin = null, hotBoard = null;   // insert-mode cross-board drag state

      // element-only: inject the ✕ delete button once (gated on data-wf-el; pointer path)
      if (it.hasAttribute("data-wf-el") && !it.querySelector(".wf-el-del")) {
        var _head = it.querySelector(".wf-el-head") || it, _del = document.createElement("button");
        _del.type = "button"; _del.className = "wf-el-del"; _del.tabIndex = -1;
        _del.setAttribute("aria-label", "Delete " + (it.getAttribute("data-el-type") || "element")); _del.textContent = "✕";
        _del.addEventListener("click", function (e) { e.stopPropagation(); if (HA.wfedit && HA.wfedit.remove) HA.wfedit.remove(it); });
        _head.appendChild(_del);
      }

      // Pointer drag is driven by DOCUMENT-level listeners, NOT setPointerCapture. The
      // insert-mode ghost is reparented to <body> (so position:fixed maps to the viewport,
      // not a rotated ancestor); reparenting DROPS pointer capture, which intermittently
      // stranded the node mid-air ("drag could not settle"). Document listeners always observe
      // pointermove/up regardless of capture, so a drag can never fail to terminate.
      // (No draggable attribute is set → validate rule 5 stays N/A.)
      function onDocMove(e) {
        if (e.pointerId !== capId) return;
        var dx = e.clientX - startX, dy = e.clientY - startY;
        if (!dragging) { if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return; dragging = true; begin(e); }
        if (e.cancelable) e.preventDefault();
        onMove(e);
      }
      function onDocUp(e) { if (e.pointerId !== capId) return; finish(); }
      function onWinBlur() { if (capId != null && dragging) finish(); }   // window lost focus mid-drag → terminate, never strand (only when actually dragging)
      function attach() {
        document.addEventListener("pointermove", onDocMove, true);
        document.addEventListener("pointerup", onDocUp, true);
        document.addEventListener("pointercancel", onDocUp, true);
        window.addEventListener("blur", onWinBlur);          // NON-capture: only the window's OWN blur. (Capture=true would also catch every element `blur` in the capture phase - e.g. when begin() reparents the focused item - firing finish() mid-drag and stranding the node.)
      }
      function detach() {
        document.removeEventListener("pointermove", onDocMove, true);
        document.removeEventListener("pointerup", onDocUp, true);
        document.removeEventListener("pointercancel", onDocUp, true);
        window.removeEventListener("blur", onWinBlur);
      }
      handle.addEventListener("pointerdown", function (e) {
        if (e.button != null && e.button !== 0) return;
        if (handle === it && e.target.closest && e.target.closest("[data-wf-editable],.wf-el-del,button,a,input,select,textarea")) return;
        startX = e.clientX; startY = e.clientY; dragging = false; target = null; capId = e.pointerId;
        e.preventDefault();                                          // no native drag / text-selection
        attach();
      });

      function crossOf(b) { return b && b.getAttribute("data-reorder-cross"); }
      function curBoard() { return it.closest("[data-reorder]") || c; }          // LIVE owning board (changes after a cross-page move)
      function targetBoard(x, y) {                                                // board under the pointer that accepts this cross-page drop
        if (!dragGroup) return null;                                             // cross-board not enabled on the source → stay put
        var at = document.elementFromPoint(x, y);                                // the ghost has pointer-events:none → this sees the board UNDER it
        var b = at && at.closest ? at.closest('[data-reorder][data-reorder-mode="insert"]') : null;
        return (b && crossOf(b) === dragGroup && !it.contains(b)) ? b : null;     // same cross-group, never the dragged node's own descendants
      }
      function begin(e) {
        var srcC = curBoard();                                     // live source board (may differ from wire-time c after a prior cross-move)
        srcAtBegin = srcC; curC = srcC; dragGroup = crossOf(srcC);   // dragGroup non-null ⇒ cross-page moves are enabled
        var P = pos(srcC, it);                                     // capture the slot BEFORE any reparent (insert mode moves `it` out of srcC)
        it.classList.add("is-grabbed"); it.setAttribute("aria-grabbed", "true");
        document.body.classList.add("is-wf-dragging");             // grabbing cursor + suppress text-selection page-wide
        var r = it.getBoundingClientRect(); offX = startX - r.left; offY = startY - r.top;
        if (mode === "insert") {
          ph = document.createElement("div"); ph.className = "wf-placeholder";
          ["-full", "-rail", "-main"].forEach(function (m2) { if (it.classList.contains(m2)) ph.classList.add(m2); });
          ph.style.height = r.height + "px";
          srcC.insertBefore(ph, it);
          it.style.width = r.width + "px"; it.style.height = r.height + "px"; it.style.margin = "0";
          it.style.position = "fixed"; it.style.left = r.left + "px"; it.style.top = r.top + "px";
          it.style.zIndex = "60"; it.style.pointerEvents = "none";
          // a transform/filter on an ancestor (e.g. a rotated card/page) would make
          // position:fixed resolve against THAT box, not the viewport - shifting the ghost
          // down-right. Reparent to <body> (untransformed) so fixed left/top map to viewport
          // coords. Pointer capture is irrelevant now - document listeners catch every move/up.
          document.body.appendChild(it);
        }
        announce("Grabbed " + noun(srcC) + " '" + label(it) + "'. " + P.i + "/" + P.n + ". " + (dragGroup ? "Can also drag to another page. " : "") + "Release to drop.");
      }
      function onMove(e) {
        if (!dragging) return;                                       // defensive: never act on a torn-down drag
        if (mode === "insert") {
          if (!curC) return;                                         // begin() didn't establish a board (corrupt state) - bail rather than crash
          it.style.left = (e.clientX - offX) + "px"; it.style.top = (e.clientY - offY) + "px";
          var tb = targetBoard(e.clientX, e.clientY);
          if (tb) curC = tb;                                       // follow the board under the pointer (else keep the last valid one)
          var nh = (curC !== srcAtBegin) ? curC : null;            // highlight ONLY a different destination board
          if (nh !== hotBoard) { if (hotBoard) hotBoard.classList.remove("wf-drop-hot"); hotBoard = nh; if (hotBoard) hotBoard.classList.add("wf-drop-hot"); }
          var b = hitBefore(curC, it, e.clientX, e.clientY);
          if (b) { if (b !== ph) curC.insertBefore(ph, b); } else if (curC.lastChild !== ph) curC.appendChild(ph);
        } else {
          it.style.transform = "translate(" + (e.clientX - startX) + "px," + (e.clientY - startY) + "px) rotate(" + restRot(c, it) + "deg) scale(1.03)";
          var t = hitSwap(c, it, e.clientX, e.clientY);
          if (t !== target) { if (target) target.classList.remove("is-swap-target"); target = t; if (target) target.classList.add("is-swap-target"); }
        }
      }
      function finish() {
        if (it._finishing) return;                                   // re-entrancy guard: a stray focus/blur/pointer event during the DOM moves below must not re-enter
        it._finishing = true;
        try { finishInner(); } finally { it._finishing = false; }
      }
      function finishInner() {
        detach();
        document.body.classList.remove("is-wf-dragging");
        if (hotBoard) { hotBoard.classList.remove("wf-drop-hot"); hotBoard = null; }
        if (!dragging) { capId = null; roveTo(curBoard(), it); try { it.focus(); } catch (x) {} return; }   // sub-threshold press = click → focus for keyboard ops
        it.classList.remove("is-grabbed"); it.setAttribute("aria-grabbed", "false");
        var msg = "";
        if (mode === "insert") {
          it.style.position = it.style.left = it.style.top = it.style.width = it.style.height = it.style.zIndex = it.style.pointerEvents = it.style.margin = "";
          var targetC = (ph && ph.parentNode) ? ph.parentNode : srcAtBegin, anchor = ph;
          flip(targetC, function () { targetC.insertBefore(it, anchor); if (anchor && anchor.parentNode === targetC) targetC.removeChild(anchor); });   // moves `it` from <body> into the (possibly DIFFERENT) destination board
          ph = null; settle(it);
          var crossed = targetC !== srcAtBegin;
          if (crossed) { var s0 = items(srcAtBegin)[0]; if (s0) roveTo(srcAtBegin, s0); }   // the source board lost its roving item to the destination → re-seed its tabindex=0
          msg = "Moved " + noun(targetC) + " '" + label(it) + "' to " + pos(targetC, it).i + "/" + pos(targetC, it).n + (crossed ? " on another page." : ".");
        } else {
          it.style.transform = "";
          if (target) { var t = target; t.classList.remove("is-swap-target"); target = null; flip(c, function () { swapNodes(it, t); }); settle(it); settle(t); msg = "Swapped " + noun(c) + " '" + label(it) + "' and '" + label(t) + "'."; }
        }
        dragging = false; capId = null; curC = null;
        var fin = curBoard(); roveTo(fin, it); try { it.focus(); } catch (x) {}   // focusin → HA.wfedit re-tracks the new active board (announces its readout)
        if (msg) announce(msg);                                                    // announce the MOVE last so it wins over the active-board readout
      }

      // ---- keyboard parity (de-duped for nested containers) ----
      it.addEventListener("keydown", function (e) {
        if (e.target.isContentEditable) return;                                            // typing in an editable label - never hijack keys
        if ((e.target.closest && e.target.closest("[data-reorder-item]")) !== it) return;   // nearest item only
        var k = e.key;
        if ((k === "Delete" || k === "Backspace") && it.hasAttribute("data-wf-el") && e.target === it) { e.preventDefault(); if (HA.wfedit && HA.wfedit.remove) HA.wfedit.remove(it); return; }
        if (k === " " || k === "Enter") { e.preventDefault(); it._kb ? kbDrop() : kbPickup(); return; }
        if (k === "Escape" && it._kb) { e.preventDefault(); kbCancel(); return; }
        var dir = (k === "ArrowLeft" || k === "ArrowUp") ? -1 : (k === "ArrowRight" || k === "ArrowDown") ? 1 : 0;
        if (!dir) return; e.preventDefault();
        it._kb ? kbMove(dir) : roveFocus(dir);
      });
      function kbPickup() { var kc = curBoard(); it._kb = true; it._savedBefore = nextItem(it); it.classList.add("is-grabbed"); it.setAttribute("aria-grabbed", "true"); announce("Grabbed " + noun(kc) + " '" + label(it) + "'. " + pos(kc, it).i + "/" + pos(kc, it).n + ". Arrow keys to move, Space to drop, Esc to cancel."); }
      function kbDrop() { var kc = curBoard(); it._kb = false; it.classList.remove("is-grabbed"); it.setAttribute("aria-grabbed", "false"); settle(it); announce("Dropped " + noun(kc) + " '" + label(it) + "' at " + pos(kc, it).i + "/" + pos(kc, it).n + "."); }
      function kbCancel() { var kc = curBoard(); it._kb = false; it.classList.remove("is-grabbed"); it.setAttribute("aria-grabbed", "false"); flip(kc, function () { kc.insertBefore(it, (it._savedBefore && it._savedBefore.parentNode === kc) ? it._savedBefore : null); }); roveTo(kc, it); try { it.focus(); } catch (x) {} announce("Cancelled the move and returned " + noun(kc) + " to " + pos(kc, it).i + "/" + pos(kc, it).n + "."); }
      function kbMove(dir) {
        var kc = curBoard(), sibs = items(kc), i = sibs.indexOf(it), j = i + dir;
        if (j < 0 || j >= sibs.length) { announce("Edge reached."); return; }
        // keyboard matches the pointer strategy: swap exchanges with the neighbour,
        // insert shifts one slot - so kbd and drag agree even with 3+ items.
        flip(kc, function () { if (mode === "swap") swapNodes(it, sibs[j]); else if (dir > 0) kc.insertBefore(it, sibs[j].nextSibling); else kc.insertBefore(it, sibs[j]); });
        roveTo(kc, it); try { it.focus(); } catch (x) {} announce("Moved " + noun(kc) + " to " + pos(kc, it).i + "/" + pos(kc, it).n + ".");
      }
      function roveFocus(dir) { var kc = curBoard(), sibs = items(kc), i = sibs.indexOf(it), j = i + dir; if (j < 0 || j >= sibs.length) return; roveTo(kc, sibs[j]); try { sibs[j].focus(); } catch (x) {} }
    }

    boards.forEach(function (c) {
      c.setAttribute("role", "list");
      var its = items(c), fresh = c._seed === undefined;
      if (fresh) c._seed = its.slice();                       // capture the wire-time baseline ONCE (a 2nd HA.init must not clobber Reset)
      its.forEach(function (it) { wireItem(c, it); });         // idempotent - also wires any node inserted between inits
      if (fresh && its[0]) roveTo(c, its[0]);                  // initial roving only on first init (don't reset the user's focus)
      c._wireItem = function (el) { wireItem(c, el); };        // wire ONE runtime-added node (idempotent)
    });

    // expose engine helpers so the sibling HA.wfedit behaviour reuses MOVE/FLIP/announce
    HA.reorder.items = items; HA.reorder.flip = flip; HA.reorder.announce = announce;
    HA.reorder.roveTo = roveTo; HA.reorder.nextItem = nextItem; HA.reorder.prevItem = prevItem;
    HA.reorder.hitBefore = hitBefore;                    // reused by HA.wfedit's palette drag-to-place

    // ---- controls (reset / export) - idempotent (survive a second HA.init) ----
    $all("[data-reorder-reset]", root).forEach(function (btn) {
      if (btn._wfBound) return; btn._wfBound = true;
      btn.addEventListener("click", function () {
        // TRUE factory reset: drop runtime-added items, restore the wire-time children + order
        boards.forEach(function (c) {
          flip(c, function () {
            items(c).forEach(function (it) { if (c._seed.indexOf(it) === -1) c.removeChild(it); });
            c._seed.forEach(function (it) { c.appendChild(it); });
          });
          if (c._seed[0]) roveTo(c, c._seed[0]);
        });
        if (HA.wfedit && HA.wfedit.refreshActive) HA.wfedit.refreshActive();   // method-level guard: HA.wfedit (a fn) is always truthy even when it early-returned
        announce("Reset the layout to its initial state.");
      });
    });
    $all("[data-reorder-export]", root).forEach(function (btn) {
      if (btn._wfBound) return; btn._wfBound = true;
      btn.addEventListener("click", function () {
        var data = { version: 1, scopes: {} };
        boards.forEach(function (c) {
          var scope = c.getAttribute("data-reorder-scope") || "items";
          if (scope === "elements") return;                 // per-card/page element detail goes in data.pages / data.elements
          data.scopes[scope] = items(c).map(function (it) { return it.getAttribute("data-rid"); });
        });
        if (HA.wfflow && HA.wfflow.exportFlow) {             // multi-page screen-flow: pages (with element trees) + connecting arrows
          var fl = HA.wfflow.exportFlow();
          if (fl) { data.pages = fl.pages; data.flow = fl.flow; }
        } else {                                            // standalone editor (no flow): keep the per-card element tree
          var elBoards = boards.filter(function (c) { return c.getAttribute("data-reorder-scope") === "elements"; });
          if (elBoards.length && HA.wfedit && HA.wfedit.elementsOf) {
            data.elements = {};
            elBoards.forEach(function (c) { var card = c.closest("[data-rid]"); if (card) data.elements[card.getAttribute("data-rid")] = HA.wfedit.elementsOf(c); });
          }
        }
        var json = JSON.stringify(data, null, 2), sink = document.querySelector("[data-reorder-sink]");
        function reveal() { if (sink) { sink.textContent = json; sink.hidden = false; } }
        function ok() { var o = btn.textContent; btn.textContent = "Copied ✓"; btn.classList.add("is-copied"); setTimeout(function () { btn.textContent = o; btn.classList.remove("is-copied"); }, 1200); announce("Copied the layout JSON."); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(ok, function () { reveal(); announce("Clipboard unavailable, so the JSON is shown below."); });
        else { reveal(); announce("Clipboard unavailable, so the JSON is shown below."); }
      });
    });
  };

  /* Element editor - ADD (palette click OR palette drag-to-place) / DELETE of typed
     lo-fi UI elements; MOVE reuses HA.reorder. Opt-in via [data-wf-palette] /
     [data-wf-board]; zero footprint when absent. Runtime nodes are wired via the
     board's c._wireItem (the SAME wireItem path), so an added element is a first-class
     reorder item with no double-binding. The palette is an INDUSTRY-STANDARD wireframe
     kit (16 primitives: heading/text/button/link/badge/image/avatar/input/textarea/
     select/checkbox/radio/toggle/search/list/divider). */
  HA.wfedit = function (root) {
    if (!$all("[data-wf-palette]", root).length && !$all("[data-wf-board]", root).length && !$all("[data-wf-editable]", root).length) return;
    var R = HA.reorder || {};
    var announce = R.announce || function () {};
    // SINGLETON state on HA.wfedit (NOT closure-local). A later HA.init() re-runs this
    // behaviour and builds a FRESH closure, but the palette buttons + focusin tracker stay
    // bound to the FIRST closure via their idempotency guards. Sharing the active board and
    // the el-<n> counter across every run prevents S._active desync (highlight vs add-target)
    // and duplicate-rid collisions between runtime-added elements.
    var S = HA.wfedit;
    if (S._active === undefined) S._active = $all("[data-wf-board]", document)[0] || null;
    if (S._seq === undefined) S._seq = 0;
    var NS = "http://www.w3.org/2000/svg";
    var TYPES = {
      heading: "Heading", text: "Text", button: "Button", link: "Link", badge: "Badge",
      image: "Image", avatar: "Avatar", input: "Input", textarea: "Textarea", select: "Select",
      checkbox: "Checkbox", radio: "Radio", toggle: "Toggle", search: "Search", list: "List", divider: "Divider",
      // nested CONTAINERS / composite blocks (each holds drop-target sub-boards → complex 2-D layouts).
      // dashboard = a ready-made 3-column KPI cluster (each column pre-seeded heading+text).
      cols2: "2 Columns", cols3: "3 Columns", card: "Card", dashboard: "Dashboard"
    };
    var CONTAINER = { cols2: 1, cols3: 1, card: 1, dashboard: 1 };

    // raise the shared el-<n> counter past EVERY rid in the document (covers nodes other runs
    // created too - deterministic; no Date/random) so two runs never mint the same rid
    $all("[data-rid]", document).forEach(function (el) { var m = /^el-(\d+)$/.exec(el.getAttribute("data-rid") || ""); if (m) S._seq = Math.max(S._seq, +m[1]); });

    function cardLabel(c) { var card = c.closest("[data-rid]"); if (!card) return ""; var l = card.querySelector(".wf-page-title,.wf-label"); return l ? l.textContent.trim() : card.getAttribute("data-rid"); }
    function posStr(c, el) { var s = R.items(c); return (s.indexOf(el) + 1) + "/" + s.length; }
    function refreshReadout() { $all("[data-wf-target-readout]", root).forEach(function (s) { s.textContent = S._active ? ("Add to: " + cardLabel(S._active)) : ""; }); }
    function applyActive() { $all("[data-wf-board]", document).forEach(function (b) { b.classList.toggle("wf-active", b === S._active); if (b === S._active) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); }); refreshReadout(); }
    function setActive(b) { if (b === S._active) return; S._active = b; applyActive(); announce("Add to: " + cardLabel(S._active)); }
    function refreshActive() { if (!S._active || !document.contains(S._active)) S._active = $all("[data-wf-board]", document)[0] || null; applyActive(); }

    function gbar(cls) { var d = document.createElement("div"); d.className = cls; return d; }
    function span(cls, txt, editable) { var s = document.createElement("span"); s.className = cls; if (editable) s.setAttribute("data-wf-editable", ""); if (txt != null) s.textContent = txt; return s; }
    // a nested drop-target board - itself a reorder/insert board in the SAME cross-group ("el"),
    // so elements drag freely between pages AND in/out of containers (arbitrarily nestable).
    function subboard() {
      var b = gbar("wf-card-body wf-subboard");
      b.setAttribute("data-reorder", ""); b.setAttribute("data-reorder-scope", "elements"); b.setAttribute("data-reorder-mode", "insert");
      b.setAttribute("data-reorder-noun", "element"); b.setAttribute("data-reorder-cross", "el"); b.setAttribute("data-wf-board", ""); b.setAttribute("tabindex", "-1");
      return b;
    }
    function imgbox() {                                     // canonical aria-hidden X-cross box (validate rule-6 safe)
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "wf-imgbox"); svg.setAttribute("viewBox", "0 0 240 90"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
      var rect = document.createElementNS(NS, "rect"); rect.setAttribute("x", "1"); rect.setAttribute("y", "1"); rect.setAttribute("width", "238"); rect.setAttribute("height", "88"); svg.appendChild(rect);
      [["1", "1", "239", "89"], ["239", "1", "1", "89"]].forEach(function (p) { var ln = document.createElementNS(NS, "line"); ln.setAttribute("x1", p[0]); ln.setAttribute("y1", p[1]); ln.setAttribute("x2", p[2]); ln.setAttribute("y2", p[3]); svg.appendChild(ln); });
      return svg;
    }
    // lo-fi body per element type - gray bars + dashed boxes; editable spans where a real
    // control would carry text (button/link/badge/select/option/search/list). All via
    // createElement (never innerHTML) → no XSS, no stray template tokens.
    function body(type) {
      var f = document.createDocumentFragment(), row;
      switch (type) {
        case "heading": f.appendChild(gbar("wf-line -head")); break;
        case "text": ["-w90", "-w75", "-w60"].forEach(function (w) { f.appendChild(gbar("wf-line " + w)); }); break;
        case "button": f.appendChild(span("wf-btn", "Button", true)); break;
        case "link": f.appendChild(span("wf-link", "Link", true)); break;
        case "badge": f.appendChild(span("wf-badge", "Badge", true)); break;
        case "image": f.appendChild(imgbox()); break;
        case "input": f.appendChild(gbar("wf-input")); break;
        case "textarea": f.appendChild(gbar("wf-textarea")); break;
        case "select": { var sel = gbar("wf-select"); sel.appendChild(span("wf-select-label", "Select…", true)); sel.appendChild(span("wf-select-caret", "▾", false)); f.appendChild(sel); break; }
        case "checkbox": row = gbar("wf-optrow"); row.appendChild(span("wf-check", null, false)); row.appendChild(span("wf-opt-label", "Option", true)); f.appendChild(row); break;
        case "radio": row = gbar("wf-optrow"); row.appendChild(span("wf-radio", null, false)); row.appendChild(span("wf-opt-label", "Option", true)); f.appendChild(row); break;
        case "toggle": row = gbar("wf-optrow"); row.appendChild(span("wf-toggle", null, false)); row.appendChild(span("wf-opt-label", "On / Off", true)); f.appendChild(row); break;
        case "avatar": { row = gbar("wf-optrow"); row.appendChild(span("wf-avatar", null, false)); var meta = gbar("wf-avatar-meta"); meta.appendChild(span("wf-opt-label", "Username", true)); meta.appendChild(gbar("wf-line -w45")); row.appendChild(meta); f.appendChild(row); break; }
        case "search": { var sb = gbar("wf-search"); sb.appendChild(span("wf-search-ic", null, false)); sb.appendChild(span("wf-search-ph", "Search…", true)); f.appendChild(sb); break; }
        case "list": ["Item 1", "Item 2", "Item 3"].forEach(function (t) { var lr = gbar("wf-listrow"); lr.appendChild(span("wf-bullet", null, false)); lr.appendChild(span("wf-list-label", t, true)); f.appendChild(lr); }); break;
        case "divider": { var hr = document.createElement("hr"); hr.className = "wf-divider"; f.appendChild(hr); break; }
        case "cols2": { var w2 = gbar("wf-cols"); w2.appendChild(subboard()); w2.appendChild(subboard()); f.appendChild(w2); break; }
        case "cols3": { var w3 = gbar("wf-cols"); w3.appendChild(subboard()); w3.appendChild(subboard()); w3.appendChild(subboard()); f.appendChild(w3); break; }
        case "card": { var panel = gbar("wf-panel"); panel.appendChild(span("wf-panel-title", "Card", true)); panel.appendChild(subboard()); f.appendChild(panel); break; }
        // composite: a 3-column KPI cluster, each column PRE-SEEDED with a heading + body line
        // (real, movable, deletable child elements - the same factory path, so they wire identically).
        case "dashboard": { var dw = gbar("wf-cols"); for (var di = 0; di < 3; di++) { var sb = subboard(); sb.appendChild(factory("heading")); sb.appendChild(factory("text")); dw.appendChild(sb); } f.appendChild(dw); break; }
        default: f.appendChild(gbar("wf-line -w75"));
      }
      return f;
    }
    // head type-label: containers / composites read with a proper name (e.g. "2 Columns", "Dashboard")
    // instead of a code-y "COLS2"; the 16 lo-fi primitives keep the wireframe uppercase convention.
    function headLabel(type) { return CONTAINER[type] ? (TYPES[type] || type) : (type || "").toUpperCase(); }
    function factory(type) {                                // No data-rest-rot → restRot uses position parity (matches CSS nth-child).
      var el = document.createElement("div"); el.className = "wf-card-el wf-sketch";
      el.setAttribute("data-reorder-item", ""); el.setAttribute("data-wf-el", ""); el.setAttribute("data-el-type", type); el.setAttribute("data-rid", "el-" + (++S._seq));
      var head = document.createElement("div"); head.className = "wf-el-head";
      var h = document.createElement("span"); h.className = "wf-handle"; h.setAttribute("data-reorder-handle", ""); h.setAttribute("aria-hidden", "true");
      var lab = document.createElement("span"); lab.className = "wf-label"; lab.setAttribute("data-wf-editable", ""); lab.textContent = headLabel(type);
      head.appendChild(h); head.appendChild(lab); el.appendChild(head); el.appendChild(body(type));   // ✕ injected by wireItem
      return el;
    }
    // the body label that carries an element's user-facing text (prefer the in-body
    // editable; fall back to the head type-label). Used by export.
    var LBL_SEL = ".wf-btn,.wf-link,.wf-badge,.wf-select-label,.wf-opt-label,.wf-search-ph,.wf-list-label,.wf-panel-title";
    function ownLabel(it) {                                  // this element's OWN text label - never a descendant container's child label
      var cands = $all(LBL_SEL, it);
      for (var i = 0; i < cands.length; i++) { if (cands[i].closest("[data-wf-el]") === it) return cands[i]; }
      return it.querySelector(".wf-label");                  // head type-label fallback (head is it's first child → always its own)
    }
    function elementsOf(c) {
      return R.items(c).map(function (it) {
        var lbl = ownLabel(it);
        var entry = { type: it.getAttribute("data-el-type"), rid: it.getAttribute("data-rid"), label: lbl ? lbl.textContent.trim() : "" };
        var own = $all("[data-wf-board]", it).filter(function (b) { return b.closest("[data-wf-el]") === it; });   // this container's OWN sub-boards (not deeper nested ones)
        if (own.length) entry.cols = own.map(function (b) { return elementsOf(b); });                              // recurse → full nested tree
        return entry;
      });
    }
    // turn a text span into an inline-editable label (button names, captions, options…)
    function makeEditable(el) {
      if (el._editable) return; el._editable = true;
      el.setAttribute("contenteditable", "true"); el.setAttribute("role", "textbox"); el.setAttribute("spellcheck", "false");
      if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", "Label (click to edit)");   // purpose, not value → never goes stale after an edit
      el.addEventListener("keydown", function (e) {                 // keep keystrokes out of reorder/delete; single-line
        e.stopPropagation();
        if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); el.blur(); }
      });
      el.addEventListener("pointerdown", function (e) { e.stopPropagation(); });   // a click on a label edits text - never starts a drag
      el.addEventListener("paste", function (e) {                   // plain text only - no live nodes enter the DOM (img onerror, etc.)
        e.preventDefault();
        var t = ((e.clipboardData || window.clipboardData) || { getData: function () { return ""; } }).getData("text/plain");
        try { document.execCommand("insertText", false, t.replace(/\s+/g, " ")); } catch (x) { el.textContent = (el.textContent + t).replace(/\s+/g, " ").trim(); }
      });
      el.addEventListener("blur", function () {
        var t = el.textContent.replace(/\s+/g, " ").trim();
        el.textContent = t;                                        // textContent only → strips any pasted markup
        announce("Changed the label to '" + (t || "(empty)") + "'.");
      });
    }
    // ADD - click adds after the focused item in the active board; drag-to-place passes an
    // explicit target board + anchor (the drop placeholder), then removes the placeholder.
    function add(type, board, before, phNode) {
      var c = board || S._active;
      if (!c) { announce("Select a card first."); return null; }
      var ref = before;
      if (ref === undefined) { var fcs = document.activeElement; ref = (fcs && c.contains(fcs) && fcs.matches && fcs.matches("[data-reorder-item]")) ? fcs.nextElementSibling : null; }
      var el = factory(type);
      R.flip(c, function () { c.insertBefore(el, ref || null); if (phNode && phNode.parentNode === c) c.removeChild(phNode); });
      if (c._wireItem) c._wireItem(el);
      if (CONTAINER[type] && HA.reorder) HA.reorder(el);     // wire the container's nested drop-target sub-boards (insert, cross-group "el")
      $all("[data-wf-editable]", el).forEach(makeEditable); R.roveTo(c, el); try { el.focus(); } catch (x) {}
      if (c !== S._active) { S._active = c; applyActive(); }
      announce("Added '" + (TYPES[type] || type) + "'. " + posStr(c, el) + ".");
      return el;
    }
    function remove(el) {
      var c = el.closest("[data-wf-board]"); if (!c) return;
      var succ = R.nextItem(el) || R.prevItem(el) || c, type = el.getAttribute("data-el-type");
      R.flip(c, function () { c.removeChild(el); });
      var left = R.items(c).length;
      if (succ === c) { try { c.focus(); } catch (x) {} } else { R.roveTo(c, succ); try { succ.focus(); } catch (x) {} }
      announce("Deleted '" + (TYPES[type] || type) + "'. " + (left ? left + " remaining." : "This card is empty. Add elements from the palette."));
    }

    // ---- palette button: click = add to active card · drag = place at the drop point ----
    function dropBefore(c, x, y) {                          // vertical stack → first item whose mid-Y is below the pointer (null = append)
      var sibs = R.items(c);
      for (var i = 0; i < sibs.length; i++) { var r = sibs[i].getBoundingClientRect(); if (y < r.top + r.height / 2) return sibs[i]; }
      return null;
    }
    function wireAddBtn(btn) {
      if (btn._wfBound) return; btn._wfBound = true;
      var type = btn.getAttribute("data-wf-add");
      var sx = 0, sy = 0, capId = null, dragging = false, ghost = null, ph = null, overBoard = null, suppressClick = false;
      function clearHot() { if (overBoard) overBoard.classList.remove("wf-drop-hot"); if (ph && ph.parentNode) ph.parentNode.removeChild(ph); ph = null; }
      function dMove(e) {
        if (e.pointerId !== capId) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (!dragging) { if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; dragging = true; startGhost(); }
        if (e.cancelable) e.preventDefault();
        moveGhost(e);
      }
      function dUp(e) { if (e.pointerId !== capId) return; endDrag(); }
      function attach() { document.addEventListener("pointermove", dMove, true); document.addEventListener("pointerup", dUp, true); document.addEventListener("pointercancel", dUp, true); }
      function detach() { document.removeEventListener("pointermove", dMove, true); document.removeEventListener("pointerup", dUp, true); document.removeEventListener("pointercancel", dUp, true); }
      function startGhost() {
        document.body.classList.add("is-wf-dragging");
        ghost = document.createElement("div"); ghost.className = "wf-drag-ghost"; ghost.setAttribute("aria-hidden", "true"); ghost.textContent = "+ " + (TYPES[type] || type);
        document.body.appendChild(ghost);
        announce("Dragging '" + (TYPES[type] || type) + "'. Release over a card to place it.");
      }
      function moveGhost(e) {
        ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px";
        var at = document.elementFromPoint(e.clientX, e.clientY);
        var board = at && at.closest ? at.closest("[data-wf-board]") : null;
        if (board !== overBoard) { clearHot(); overBoard = board; if (board) board.classList.add("wf-drop-hot"); }
        if (board) {
          var b = dropBefore(board, e.clientX, e.clientY);
          if (!ph) { ph = document.createElement("div"); ph.className = "wf-placeholder -slim"; }
          if (b) { if (b.previousSibling !== ph) board.insertBefore(ph, b); }
          else if (board.lastChild !== ph) board.appendChild(ph);
        }
      }
      function endDrag() {
        detach();
        if (!dragging) { capId = null; return; }            // sub-threshold → a plain click (handled by the click listener)
        // swallow ONLY the synthetic click the browser fires immediately after this gesture
        // (if any) - cleared on the next tick so a LATER genuine click on the same button
        // still adds. A dragged pointerup often fires no click at all, so don't latch it.
        suppressClick = true; setTimeout(function () { suppressClick = false; }, 0);
        document.body.classList.remove("is-wf-dragging");
        var board = overBoard, anchor = ph;
        if (board) add(type, board, anchor, anchor);
        else announce("Released outside a card. Placement cancelled.");
        clearHot();
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost); ghost = null;
        overBoard = null; capId = null; dragging = false;
      }
      btn.addEventListener("pointerdown", function (e) { if (e.button != null && e.button !== 0) return; sx = e.clientX; sy = e.clientY; capId = e.pointerId; dragging = false; attach(); });
      btn.addEventListener("click", function (e) { if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); return; } add(type); });
    }

    $all("[data-wf-add]", root).forEach(wireAddBtn);
    if (!HA.wfedit._focusBound) {                           // one delegated focusin tracks the active card (idempotent across re-init)
      HA.wfedit._focusBound = true;
      document.addEventListener("focusin", function (e) { var b = e.target && e.target.closest && e.target.closest("[data-wf-board]"); if (b && b !== S._active) setActive(b); });
    }
    $all("[data-wf-editable]", root).forEach(makeEditable);  // wire authored editable labels (button names, captions, headings, page titles)
    HA.wfedit.add = add; HA.wfedit.remove = remove; HA.wfedit.refreshActive = refreshActive;
    HA.wfedit.factory = factory; HA.wfedit.makeEditable = makeEditable; HA.wfedit.elementsOf = elementsOf;
    refreshActive();                                        // mark the first board active at boot (works before any focus)
  };

  /* Screen-flow - multiple wireframe PAGES connected by auto-routed arrows. Opt-in via
     [data-wf-flow] (zero footprint when absent). Pages are reorder items (insert mode);
     "+ Add page" ([data-wf-add-page]) appends a fresh page, the per-page ✕
     ([data-wf-del-page]) removes one. Arrows are an SVG overlay (.wf-arrows) drawn between
     ADJACENT pages and re-routed by a dirty-checked rAF loop, so they follow pointer drags,
     FLIP settles, element add/delete, label edits, resizes and horizontal scroll - with no
     coupling back into the reorder engine. Export gains data.pages + data.flow. */
  HA.wfflow = function (root) {
    var flows = $all("[data-wf-flow]", root);
    if (!flows.length) return;                             // zero footprint when unused
    var R = HA.reorder || {}, NS = "http://www.w3.org/2000/svg";
    var announce = R.announce || function () {};

    function trackOf(flow) { return flow.querySelector("[data-wf-flow-track]"); }
    function pagesOf(flow) { var t = trackOf(flow); return t ? $all(":scope > [data-wf-page]", t) : []; }
    function ce(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
    function r1(n) { return Math.round(n * 10) / 10; }
    function nextPageSeq() { var n = 0; $all("[data-rid]", document).forEach(function (el) { var m = /^page-(\d+)$/.exec(el.getAttribute("data-rid") || ""); if (m) n = Math.max(n, +m[1]); }); return n + 1; }

    // geometry: the point where the ray center→(dx,dy) crosses the box border, +pad outward
    function edgePoint(cx, cy, hw, hh, dx, dy, pad) {
      if (!dx && !dy) return { x: cx, y: cy };
      var k = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
      var ex = cx + dx * k, ey = cy + dy * k, len = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x: ex + dx / len * pad, y: ey + dy / len * pad };
    }
    function arrowSeg(a, b) {                               // a,b = {l,t,w,h} in track content coords
      var ca = { x: a.l + a.w / 2, y: a.t + a.h / 2 }, cb = { x: b.l + b.w / 2, y: b.t + b.h / 2 };
      var dx = cb.x - ca.x, dy = cb.y - ca.y;
      var p1 = edgePoint(ca.x, ca.y, a.w / 2, a.h / 2, dx, dy, 4);
      var p2 = edgePoint(cb.x, cb.y, b.w / 2, b.h / 2, -dx, -dy, 9);   // leave clearance for the arrowhead
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    function reroute(flow) {
      var t = trackOf(flow), svg = flow.querySelector(".wf-arrows"), layer = svg && svg.querySelector(".wf-arrow-layer");
      if (!t || !svg || !layer) return;
      var W = t.scrollWidth, H = t.scrollHeight;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.style.width = W + "px"; svg.style.height = H + "px";
      var ps = pagesOf(flow), tr = t.getBoundingClientRect();
      function box(el) { var r = el.getBoundingClientRect(); return { l: r.left - tr.left + t.scrollLeft, t: r.top - tr.top + t.scrollTop, w: r.width, h: r.height }; }
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      for (var i = 0; i < ps.length - 1; i++) {
        var s = arrowSeg(box(ps[i]), box(ps[i + 1])), p = document.createElementNS(NS, "path");
        p.setAttribute("class", "wf-arrow"); p.setAttribute("marker-end", "url(#wf-ah)");
        p.setAttribute("d", "M" + r1(s.x1) + " " + r1(s.y1) + " L" + r1(s.x2) + " " + r1(s.y2));
        layer.appendChild(p);
      }
    }
    function signature(flow) {                              // cheap geometry/set fingerprint → only redraw on change
      var t = trackOf(flow); if (!t) return "";
      var tr = t.getBoundingClientRect();                   // SCROLL-INDEPENDENT content coords (match reroute/box): scrolling alone must not force a redraw - the SVG scrolls with the content
      return pagesOf(flow).map(function (p) { var r = p.getBoundingClientRect(); return (p.getAttribute("data-rid") || "") + ":" + Math.round(r.left - tr.left + t.scrollLeft) + "," + Math.round(r.top - tr.top + t.scrollTop) + "," + Math.round(r.width) + "," + Math.round(r.height); }).join("|");
    }

    function F(tp) { return (HA.wfedit && HA.wfedit.factory) ? HA.wfedit.factory(tp) : null; }
    function fillCols(container, idx, types) {              // append seed elements into a container's OWN nth sub-board (nesting-safe: ignores deeper sub-boards)
      var bs = $all("[data-wf-board]", container).filter(function (b) { return b.closest("[data-wf-el]") === container; });
      var b = bs[idx]; if (!b) return;
      types.forEach(function (tp) { var e = F(tp); if (e) b.appendChild(e); });
    }
    // PAGE TEMPLATES - real-product complex screens, declared as op lists. A string op appends
    // that element; an array op ["cols2"|"cols3"|"card", col0types[], col1types[], …] creates a
    // nested container and seeds each of its sub-boards. Extend freely - purely declarative.
    // `w` = WIDTH TIER (data-wf-width on .wf-page): omitted = narrow 300px (single-column screens),
    // "md" = cols2, "lg" = cols3 / dense dashboards, "xl" = kanban-class boards. Complex layouts
    // grow the page so their columns aren't cramped; the SVG arrows re-route to the new geometry.
    var TEMPLATES = {
      blank:      { t: "Page",                       ops: ["heading", "text", "button"] },
      login:      { t: "Login",                      ops: ["heading", "input", "input", "button", "link"] },
      signup:     { t: "Sign up",                    ops: ["heading", "text", "input", "input", "input", "checkbox", "button"] },
      dashboard:  { t: "Dashboard",     w: "lg",     ops: ["search", ["cols3", ["heading", "text"], ["heading", "text"], ["heading", "text"]], ["cols2", ["heading", "list"], ["heading", "text", "button"]]] },
      analytics:  { t: "Analytics",     w: "lg",     ops: ["heading", "search", ["cols2", ["heading", "image"], ["heading", "image"]], ["cols3", ["heading", "text"], ["heading", "text"], ["heading", "text"]]] },
      form:       { t: "Form",                       ops: ["heading", "input", "input", "select", "textarea", ["cols2", ["checkbox"], ["checkbox"]], "button"] },
      detail:     { t: "Detail",        w: "md",     ops: [["cols2", ["search", "list"], ["image", "heading", "text", "button"]]] },
      settings:   { t: "Settings",      w: "md",     ops: ["heading", ["cols2", ["list"], ["heading", "toggle", "toggle", "toggle", "button"]]] },
      profile:    { t: "Profile",       w: "md",     ops: [["cols2", ["avatar", "heading", "text"], ["heading", "list"]], "button"] },
      pricing:    { t: "Pricing",       w: "lg",     ops: ["heading", ["cols3", ["heading", "text", "list", "button"], ["heading", "text", "list", "button"], ["heading", "text", "list", "button"]]] },
      checkout:   { t: "Checkout",      w: "md",     ops: [["cols2", ["heading", "list", "divider", "heading", "text"], ["heading", "input", "input", "select", "button"]]] },
      table:      { t: "Table",         w: "md",     ops: ["search", "heading", "list", "list", "button"] },
      chat:       { t: "Chat",          w: "md",     ops: [["cols2", ["search", "list"], ["heading", "text", "text", "input"]]] },
      feed:       { t: "Feed",                       ops: ["search", ["card", ["avatar", "text", "image", "button"]], ["card", ["avatar", "text", "button"]]] },
      kanban:     { t: "Kanban",        w: "xl",     ops: ["heading", ["cols3", ["heading", "card", "card"], ["heading", "card"], ["heading", "card", "card"]]] },
      onboarding: { t: "Onboarding",                 ops: ["image", "heading", "text", ["cols2", ["button"], ["link"]]] },
      search:     { t: "Search results",             ops: ["search", "list", "list", "button"] },
      empty:      { t: "Empty state",                ops: ["image", "heading", "text", "button"] },
      error:      { t: "Error",                      ops: ["image", "heading", "text", "button", "link"] }
    };
    function buildOps(target, ops) {
      ops.forEach(function (op) {
        if (typeof op === "string") { var e = F(op); if (e) target.appendChild(e); return; }
        if (op && op.length) {                              // [containerType, col0types, col1types, …]
          var cont = F(op[0]); if (!cont) return;
          for (var i = 1; i < op.length; i++) fillCols(cont, i - 1, op[i]);
          target.appendChild(cont);
        }
      });
    }
    function seedPage(bodyB, template) { if (HA.wfedit && HA.wfedit.factory) buildOps(bodyB, (TEMPLATES[template] || TEMPLATES.blank).ops); }   // presence check only - NEVER F("text") (that would mint+discard a live el-N rid)
    function buildPage(template) {
      template = TEMPLATES[template] ? template : "blank";
      var n = nextPageSeq(), page = ce("div", "wf-page wf-sketch");
      page.setAttribute("data-reorder-item", ""); page.setAttribute("data-wf-page", ""); page.setAttribute("data-rid", "page-" + n); page.setAttribute("data-rest-rot", "0");
      var w = TEMPLATES[template].w; if (w) page.setAttribute("data-wf-width", w);   // complex templates grow wider so their columns aren't cramped
      var head = ce("div", "wf-page-head");
      var handle = ce("span", "wf-handle"); handle.setAttribute("data-reorder-handle", ""); handle.setAttribute("aria-hidden", "true");
      var dots = ce("span", "wf-dots"); dots.setAttribute("aria-hidden", "true");
      var title = ce("span", "wf-page-title"); title.setAttribute("data-wf-editable", ""); title.textContent = TEMPLATES[template].t + " " + n;
      var del = ce("button", "wf-page-del"); del.type = "button"; del.setAttribute("data-wf-del-page", ""); del.setAttribute("aria-label", "Delete this page"); del.textContent = "✕";
      head.appendChild(handle); head.appendChild(dots); head.appendChild(title); head.appendChild(del);
      var bodyB = ce("div", "wf-page-body wf-card-body");
      bodyB.setAttribute("data-reorder", ""); bodyB.setAttribute("data-reorder-scope", "elements"); bodyB.setAttribute("data-reorder-mode", "insert"); bodyB.setAttribute("data-reorder-noun", "element"); bodyB.setAttribute("data-reorder-cross", "el"); bodyB.setAttribute("data-wf-board", ""); bodyB.setAttribute("tabindex", "-1");
      seedPage(bodyB, template);
      page.appendChild(head); page.appendChild(bodyB);
      return page;
    }
    function addPage(flow) {
      var t = trackOf(flow); if (!t) return;
      var tplSel = document.querySelector("[data-wf-page-template]");
      var page = buildPage(tplSel ? tplSel.value : "blank");
      t.appendChild(page);
      HA.init();                                            // idempotent: wires the page as a track item + its inner board + ✕ + labels
      if (HA.wfedit && HA.wfedit.makeEditable) $all("[data-wf-editable]", page).forEach(HA.wfedit.makeEditable);
      var title = page.querySelector(".wf-page-title");
      if (R.roveTo) R.roveTo(t, page);
      try { (title || page).focus(); } catch (x) {}
      announce("Added a page. Page " + pagesOf(flow).length + ". Connected with an arrow from the previous page.");
      reroute(flow);
    }
    function delPage(flow, page) {
      var t = trackOf(flow), ps = pagesOf(flow);
      if (ps.length <= 1) { announce("The last page cannot be deleted."); return; }
      var i = ps.indexOf(page), succ = ps[i + 1] || ps[i - 1];
      if (R.flip) R.flip(t, function () { t.removeChild(page); }); else t.removeChild(page);
      if (succ) { if (R.roveTo) R.roveTo(t, succ); try { (succ.querySelector(".wf-page-title") || succ).focus(); } catch (x) {} }
      if (HA.wfedit && HA.wfedit.refreshActive) HA.wfedit.refreshActive();
      announce("Deleted a page. " + pagesOf(flow).length + " remaining.");
      reroute(flow);
    }

    flows.forEach(function (flow) {
      if (!flow._wfflowSetup) {
        flow._wfflowSetup = true;
        flow.addEventListener("click", function (e) {        // delegated ✕ (pages are created at runtime)
          var d = e.target && e.target.closest && e.target.closest("[data-wf-del-page]");
          if (!d) return; e.stopPropagation(); var pg = d.closest("[data-wf-page]"); if (pg) delPage(flow, pg);
        });
        var lastSig = "";                                    // dirty-checked rAF loop - redraw only when geometry/set changes
        (function tick() {
          if (!document.contains(flow)) return;              // self-GC once the flow leaves the DOM
          if (!document.hidden) { var sig = signature(flow); if (sig !== lastSig) { lastSig = sig; reroute(flow); } }
          requestAnimationFrame(tick);
        })();
        window.addEventListener("resize", function () { reroute(flow); });
      }
      reroute(flow);
    });

    $all("[data-wf-add-page]", root).forEach(function (btn) {
      if (btn._wfBound) return; btn._wfBound = true;
      btn.addEventListener("click", function () { addPage(btn.closest("[data-wf-flow]") || flows[0]); });
    });

    HA.wfflow.exportFlow = function () {                    // consumed by HA.reorder's [data-reorder-export]
      var flow = $all("[data-wf-flow]", document)[0]; if (!flow) return null;
      var ps = pagesOf(flow);
      var pages = ps.map(function (p) {
        var title = p.querySelector(".wf-page-title"), board = p.querySelector("[data-wf-board]");
        return { rid: p.getAttribute("data-rid"), title: title ? title.textContent.trim() : "", elements: (HA.wfedit && HA.wfedit.elementsOf && board) ? HA.wfedit.elementsOf(board) : [] };
      });
      var flowArr = [];
      for (var i = 0; i < ps.length - 1; i++) flowArr.push([ps[i].getAttribute("data-rid"), ps[i + 1].getAttribute("data-rid")]);
      return { pages: pages, flow: flowArr };
    };
  };

  /* Design picker - choose among multiple UI designs at runtime. Two independent selectors:
     [data-theme-pick] swaps the whole-document THEME (<html data-theme>), [data-wf-skin-pick]
     swaps the wireframe SKIN ([data-wf-skin] on the flow: sketch/clean/blueprint/mono; the
     non-sketch skins add [data-wf-flat] so HA.reorder's restRot()→0 and the lo-fi tilt drops).
     Zero footprint when neither selector is present. */
  HA.designpick = function (root) {
    $all("[data-theme-pick]", root).forEach(function (sel) {
      if (sel._wfBound) return; sel._wfBound = true;
      var cur = document.documentElement.getAttribute("data-theme"); if (cur) sel.value = cur;
      sel.addEventListener("change", function () { document.documentElement.setAttribute("data-theme", sel.value); });
    });
    var FLAT = { clean: 1, blueprint: 1, mono: 1 };
    $all("[data-wf-skin-pick]", root).forEach(function (sel) {
      if (sel._wfBound) return; sel._wfBound = true;
      function apply() {
        var t = sel.closest("[data-wf-flow]") || document.querySelector("[data-wf-flow]");
        if (!t) return;
        t.setAttribute("data-wf-skin", sel.value);
        if (FLAT[sel.value]) t.setAttribute("data-wf-flat", ""); else t.removeAttribute("data-wf-flat");
      }
      sel.addEventListener("change", apply); apply();
    });
  };

  /* Collapsible tree (mindmap / nested outline). */
  HA.tree = function (root) {
    $all("[data-tree]", root).forEach(function (tree) {
      $all("[data-tree-toggle]", tree).forEach(function (tog) {
        tog.setAttribute("role", "button"); tog.setAttribute("tabindex", "0"); tog.setAttribute("aria-expanded", "true");
        function flip() {
          var node = tog.closest("[data-tree-node]") || tog.parentNode;
          var kids = node.querySelector("[data-children]"); if (!kids) return;
          var open = kids.classList.toggle("collapsed");
          tog.setAttribute("aria-expanded", open ? "false" : "true"); tog.classList.toggle("is-collapsed", open);
        }
        tog.addEventListener("click", flip);
        tog.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
      });
    });
  };

  /* Cross-filter: click a category to dim/restore all matching series. Source: demo2 dashboard/arch legend. */
  HA.crossfilter = function (root) {
    $all("[data-crossfilter]", root).forEach(function (scope) {
      var active = {};
      var keys = $all("[data-filter-key]", scope);
      function apply() {
        var any = Object.keys(active).some(function (k) { return active[k]; });
        $all("[data-series]", scope).forEach(function (el) {
          el.classList.toggle("dimmed", any && !active[el.getAttribute("data-series")]);
        });
        // diagrams: light up the selected nodes, every edge touching them and the nodes on the other end; fade the rest
        var on = {}, near = {};
        $all("[data-node][data-series]", scope).forEach(function (n) { if (any && active[n.getAttribute("data-series")]) on[n.getAttribute("data-node")] = 1; });
        $all("[data-edge]", scope).forEach(function (e) {
          var f = e.getAttribute("data-from"), t = e.getAttribute("data-to"), hit = !!(on[f] || on[t]);
          if (hit) { near[f] = near[t] = 1; }
          [e, scope.querySelector('[data-edge-label="' + f + "-" + t + '"]')].forEach(function (x) {
            if (!x) return;
            x.classList.toggle("cf-on", hit);
            x.classList.toggle("cf-off", any && !hit);
          });
        });
        $all("[data-node]", scope).forEach(function (n) {
          var id = n.getAttribute("data-node");
          n.classList.toggle("cf-on", !!on[id]);
          n.classList.toggle("cf-near", any && !on[id] && !!near[id]);
          n.classList.toggle("cf-off", any && !on[id] && !near[id]);
        });
        keys.forEach(function (k) { k.classList.toggle("active", !!active[k.getAttribute("data-filter-key")]); k.setAttribute("aria-pressed", !!active[k.getAttribute("data-filter-key")]); });
      }
      keys.forEach(function (k) {
        k.setAttribute("role", "button"); k.setAttribute("tabindex", "0");
        function toggle() { var key = k.getAttribute("data-filter-key"); active[key] = !active[key]; apply(); }
        k.addEventListener("click", toggle);
        k.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
      });
    });
  };

  /* Pagination (+ optional row selection). Coexists with filter + sort. */
  HA.paginate = function (root) {
    $all("table[data-paginate]", root).forEach(function (table) {
      var size = parseInt(table.dataset.pageSize || "10", 10), page = 0;
      // the table may sit in a horizontal-scroll wrapper (.dt-scroll); the pager is its sibling
      var pager = table.parentNode.querySelector("[data-pager]") || (table.closest(".data-table, section") || table.parentNode).querySelector("[data-pager]");
      function vis() { return Array.prototype.slice.call(table.tBodies[0].rows).filter(function (r) { return !r.classList.contains("hidden"); }); }
      function repage() {
        var rows = vis(), pages = Math.max(1, Math.ceil(rows.length / size));
        if (page >= pages) page = pages - 1;
        Array.prototype.slice.call(table.tBodies[0].rows).forEach(function (r) { r.classList.add("page-hidden"); });
        rows.slice(page * size, page * size + size).forEach(function (r) { r.classList.remove("page-hidden"); });
        if (pager) {
          pager.innerHTML = "";
          var mk = function (label, dis, fn) { var b = document.createElement("button"); b.className = "btn btn-ghost btn-sm"; b.textContent = label; b.disabled = dis; if (!dis) b.addEventListener("click", fn); return b; };
          pager.appendChild(mk("‹ Prev", page === 0, function () { page--; repage(); }));
          var info = document.createElement("span"); info.className = "small muted"; info.style.padding = "0 var(--sp-3)";
          info.textContent = (page + 1) + " / " + pages + " (" + rows.length + " rows)"; pager.appendChild(info);
          pager.appendChild(mk("Next ›", page >= pages - 1, function () { page++; repage(); }));
        }
      }
      table._repage = repage;
      if (table.dataset.rowSelect != null) {
        $all("tbody tr", table).forEach(function (tr) {
          tr.addEventListener("click", function (e) { if (e.target.closest("a,button,input")) return; tr.classList.toggle("selected"); });
        });
      }
      repage();
    });
  };

  /* Chart hover tooltip. */
  HA.tooltip = function (root) {
    $all("[data-chart-tip]", root).forEach(function (chart) {
      var tip = document.createElement("div"); tip.className = "ha-tooltip hidden"; document.body.appendChild(tip);
      function move(e, t) { tip.textContent = t; tip.classList.remove("hidden"); tip.style.left = (e.clientX + 12) + "px"; tip.style.top = (e.clientY + 12) + "px"; }
      $all("[data-tip]", chart).forEach(function (el) {
        el.addEventListener("pointerenter", function (e) { move(e, el.getAttribute("data-tip")); });
        el.addEventListener("pointermove", function (e) { move(e, el.getAttribute("data-tip")); });
        el.addEventListener("pointerleave", function () { tip.classList.add("hidden"); });
      });
    });
  };

  /* Count-up numbers (fires when revealed, or immediately). */
  HA.counter = function (root) {
    var els = $all("[data-counter]", root);
    function run(el) {
      if (el._done) return; el._done = true;
      var to = parseFloat(el.getAttribute("data-to") || el.textContent.replace(/[^0-9.\-]/g, "")) || 0;
      var suffix = el.getAttribute("data-suffix") || "", dur = parseInt(el.getAttribute("data-dur") || "900", 10);
      var dec = (String(to).split(".")[1] || "").length;
      function group(str) { var p = String(str).split("."); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); return p.join("."); }
      var prefix = el.getAttribute("data-prefix") || "";
      if (prefersReduced) { el.textContent = prefix + group(to.toFixed(dec)) + suffix; return; }
      var start = null;
      function step(ts) { if (!start) start = ts; var p = Math.min(1, (ts - start) / dur); var v = to * (1 - Math.pow(1 - p, 3)); el.textContent = prefix + group(v.toFixed(dec)) + suffix; if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    }
    el_observe(els, run);
  };

  /* Scroll reveal (fade/slide in). */
  HA.reveal = function (root) {
    var els = $all("[data-reveal]", root);
    if (prefersReduced || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    el_observe(els, function (el) {
      var d = parseInt(el.getAttribute("data-reveal-delay") || "0", 10);
      setTimeout(function () { el.classList.add("in"); }, d);
    });
  };

  /* shared IntersectionObserver helper for counter + reveal */
  function el_observe(els, cb) {
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach(cb); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { cb(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.2 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---- formMock: a prototype <form data-form-mock> intercepts submit, reveals
     its .form-status, and stays put - so a mock form is never a dead control and
     never navigates. No-op (zero footprint) when the attribute is absent. ---- */
  HA.formMock = function (root) {
    (root || document).querySelectorAll("[data-form-mock]").forEach(function (form) {
      if (form.__haFormMock) return; form.__haFormMock = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        form.classList.add("is-submitted");
        var st = form.querySelector(".form-status");
        if (st) st.setAttribute("aria-hidden", "false");
      });
    });
  };

  /* ---- archExplorer: interactive architecture workbench with scenario filters,
     node-to-edge flow animations, and inspector panel synchronization. ---- */
  HA.archExplorer = function (root) {
    (root || document).querySelectorAll("[data-arch-explorer]").forEach(function (bench) {
      if (bench.__haArchExplorer) return; bench.__haArchExplorer = true;

      var tabs = $all("[data-scenario-tab]", bench);
      var nodes = $all("[data-node]", bench);
      var edges = $all("[data-edge]", bench);
      var inspTitle = bench.querySelector("[data-insp-title]");
      var inspBody = bench.querySelector("[data-insp-content]");
      var inspReset = bench.querySelector("[data-insp-reset]");

      var scenarios = {};
      var rawScenarios = bench.getAttribute("data-scenarios");
      if (rawScenarios) {
        try { scenarios = JSON.parse(rawScenarios); } catch (e) { scenarios = {}; }
      }

      /* Localized chrome supplied by the builder; English fallbacks keep the module
         usable when the block was hand-pasted rather than generated. */
      var L = { topology: "System topology", overview: "Architecture overview",
        overviewBody: "Pick a scenario tab above to trace a data flow step by step, or click a node to inspect it.",
        spec: "Component spec", flow: "Scenario flow", pipeline: "Scenario pipeline" };
      var rawLabels = bench.getAttribute("data-labels");
      if (rawLabels) {
        try { var pl = JSON.parse(rawLabels); for (var k in pl) if (pl[k]) L[k] = pl[k]; } catch (e) { /* keep defaults */ }
      }

      var activeScenario = "all";

      /* Default ("all") state used to be a paragraph and nothing else. Give it a real
         index of the scenarios so the panel is a way in, not dead space. */
      function legendListHTML() {
        var ids = Object.keys(scenarios);
        if (!ids.length) return "";
        var h = '<ol class="archexp-steps-list" role="list">';
        ids.forEach(function (id, i) {
          var sc = scenarios[id];
          h += '<li class="archexp-step-item" data-scenario-jump="' + id + '" tabindex="0" role="listitem">' +
            '<span class="archexp-step-num">' + (i + 1) + '</span>' +
            '<div><div class="archexp-step-title">' + (sc.name || id) + '</div>' +
            '<div class="archexp-step-desc">' + (sc.desc || "") + '</div>' +
            '<span class="archexp-step-proto">' + ((sc.steps || []).length) + ' steps →</span></div></li>';
        });
        return h + "</ol>";
      }

      function renderScenarioView(scId) {
        activeScenario = scId;
        nodes.forEach(function (n) { n.classList.remove("is-selected"); });

        if (scId === "all" || !scenarios[scId]) {
          nodes.forEach(function (n) { n.classList.remove("is-dimmed"); });
          edges.forEach(function (e) { e.classList.remove("is-dimmed", "is-active"); });
          $all("[data-step-badge]", bench).forEach(function (b) { b.classList.add("hidden"); });
          if (inspTitle) inspTitle.textContent = L.topology;
          if (inspBody) {
            inspBody.innerHTML = '<div class="archexp-node-spec"><div class="role-badge">' + L.topology +
              '</div><h3>' + L.overview + '</h3><p>' + L.overviewBody + '</p></div>' + legendListHTML();
          }
          return;
        }

        var sc = scenarios[scId];
        var allowedNodes = new Set();
        var allowedEdges = new Set();

        (sc.steps || []).forEach(function (st) {
          if (st.from) allowedNodes.add(st.from);
          if (st.to) allowedNodes.add(st.to);
          if (st.edge) allowedEdges.add(st.edge);
          else if (st.from && st.to) allowedEdges.add(st.from + "-" + st.to);
        });

        nodes.forEach(function (n) {
          var nid = n.getAttribute("data-node");
          n.classList.toggle("is-dimmed", !allowedNodes.has(nid));
        });

        edges.forEach(function (e) {
          var from = e.getAttribute("data-from"), to = e.getAttribute("data-to");
          var eid = e.getAttribute("data-edge-id") || (from + "-" + to);
          var active = allowedEdges.has(eid) || allowedEdges.has(from + "-" + to);
          e.classList.toggle("is-active", active);
          e.classList.toggle("is-dimmed", !active);
        });

        $all("[data-step-badge]", bench).forEach(function (b) {
          var bSc = b.getAttribute("data-scenario");
          b.classList.toggle("hidden", bSc !== scId);
        });

        if (inspTitle) inspTitle.textContent = sc.name || L.flow;
        if (inspBody) {
          var html = '<div class="archexp-node-spec"><div class="role-badge">' + L.pipeline + '</div><h3>' + (sc.name || "") + '</h3><p>' + (sc.desc || "") + '</p></div>';
          html += '<ol class="archexp-steps-list" role="list">';
          (sc.steps || []).forEach(function (st, idx) {
            var stepNum = st.step || (idx + 1);
            html += '<li class="archexp-step-item" data-scenario-step="' + stepNum + '" data-from="' + (st.from || "") + '" data-to="' + (st.to || "") + '" tabindex="0" role="listitem">';
            html += '<span class="archexp-step-num">' + stepNum + '</span>';
            html += '<div><div class="archexp-step-title">' + (st.title || "") + '</div><div class="archexp-step-desc">' + (st.desc || "") + '</div>';
            if (st.proto) html += '<span class="archexp-step-proto">' + st.proto + '</span>';
            html += '</div></li>';
          });
          html += '</ol>';
          inspBody.innerHTML = html;

          /* Hovering a step should point at exactly one thing on the canvas: its edge,
             its badge, and the two nodes it connects. Everything else recedes. */
          $all("[data-scenario-step]", inspBody).forEach(function (sEl) {
            function focusStep() {
              $all(".archexp-step-item", inspBody).forEach(function (it) { it.classList.remove("is-active"); });
              sEl.classList.add("is-active");
              var f = sEl.getAttribute("data-from"), tg = sEl.getAttribute("data-to");
              var num = sEl.getAttribute("data-scenario-step");
              edges.forEach(function (ed) {
                ed.classList.toggle("is-focus", ed.getAttribute("data-from") === f && ed.getAttribute("data-to") === tg);
              });
              nodes.forEach(function (n) {
                var nid = n.getAttribute("data-node");
                n.classList.toggle("is-focus", nid === f || nid === tg);
              });
              $all("[data-step-badge]", bench).forEach(function (b) {
                b.classList.toggle("is-focus", b.getAttribute("data-scenario") === scId && b.getAttribute("data-step") === num);
              });
            }
            function blurStep() {
              edges.forEach(function (ed) { ed.classList.remove("is-focus"); });
              nodes.forEach(function (n) { n.classList.remove("is-focus"); });
              $all("[data-step-badge]", bench).forEach(function (b) { b.classList.remove("is-focus"); });
            }
            sEl.addEventListener("click", focusStep);
            sEl.addEventListener("mouseenter", focusStep);
            sEl.addEventListener("focus", focusStep);
            sEl.addEventListener("mouseleave", blurStep);
            sEl.addEventListener("blur", blurStep);
          });
        }
      }

      function showNodeSpec(nodeEl) {
        var nid = nodeEl.getAttribute("data-node");
        var raw = nodeEl.getAttribute("data-node-spec");
        if (!raw) return;
        var spec;
        try { spec = JSON.parse(raw); } catch (e) { return; }

        nodes.forEach(function (n) { n.classList.remove("is-selected"); });
        nodeEl.classList.add("is-selected");

        if (inspTitle) inspTitle.textContent = L.spec;
        if (inspBody) {
          var html = '<div class="archexp-node-spec">';
          html += '<div class="role-badge">' + (spec.type || "SERVICE").toUpperCase() + '</div>';
          html += '<h3>' + (spec.label || nid) + '</h3>';
          if (spec.sub) html += '<p style="color:var(--text-muted);font-weight:600;font-size:12px;margin-bottom:var(--sp-2);">' + spec.sub + '</p>';
          if (spec.desc) html += '<p>' + spec.desc + '</p>';

          html += '<dl class="archexp-spec-dl">';
          if (spec.tech) html += '<div class="archexp-spec-row"><dt class="archexp-spec-key">Tech</dt><dd class="archexp-spec-val"><code>' + spec.tech + '</code></dd></div>';
          if (spec.file) html += '<div class="archexp-spec-row"><dt class="archexp-spec-key">File / Module</dt><dd class="archexp-spec-val"><code>' + spec.file + '</code></dd></div>';
          if (spec.inputs && spec.inputs.length) html += '<div class="archexp-spec-row"><dt class="archexp-spec-key">Inputs</dt><dd class="archexp-spec-val">' + spec.inputs.join("<br>") + '</dd></div>';
          if (spec.outputs && spec.outputs.length) html += '<div class="archexp-spec-row"><dt class="archexp-spec-key">Outputs</dt><dd class="archexp-spec-val">' + spec.outputs.join("<br>") + '</dd></div>';
          if (spec.tags && spec.tags.length) html += '<div class="archexp-spec-row"><dt class="archexp-spec-key">Tags</dt><dd class="archexp-spec-val">' + spec.tags.map(function (t) { return '<span class="badge badge-accent" style="font-size:10px;margin-right:4px;">' + t + '</span>'; }).join("") + '</dd></div>';
          html += '</dl>';
          html += '</div>';
          inspBody.innerHTML = html;
        }
      }

      function selectTab(scId) {
        tabs.forEach(function (t) {
          var on = t.getAttribute("data-scenario-tab") === scId;
          t.classList.toggle("active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderScenarioView(scId);
      }

      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () { selectTab(tab.getAttribute("data-scenario-tab")); });
      });

      /* Scenario index cards in the default panel double as tab triggers. */
      bench.addEventListener("click", function (ev) {
        var jump = ev.target.closest && ev.target.closest("[data-scenario-jump]");
        if (jump) selectTab(jump.getAttribute("data-scenario-jump"));
      });

      nodes.forEach(function (n) {
        n.addEventListener("click", function () { showNodeSpec(n); });
        n.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            showNodeSpec(n);
          }
        });
      });

      if (inspReset) {
        inspReset.addEventListener("click", function () {
          renderScenarioView(activeScenario);
        });
      }

      renderScenarioView("all");
    });
  };

  /* ===================== SVG TEXT FITTING ===================== */
  HA.fitSvgText = function (root) {
    var svgs = (root && root.tagName && root.tagName.toLowerCase() === "svg") ? [root] : $all("svg", root);
    svgs.forEach(function (svg) {
      // 1. Bubble chart circles: move labels below small bubbles or fit inside large ones
      $all("g", svg).forEach(function (g) {
        var cir = g.querySelector(":scope > circle.b-dot, :scope > circle");
        var lbl = g.querySelector(":scope > text.b-label");
        if (cir && lbl && lbl.getComputedTextLength) {
          var cx = parseFloat(cir.getAttribute("cx") || 0);
          var cy = parseFloat(cir.getAttribute("cy") || 0);
          var r = parseFloat(cir.getAttribute("r") || 0);
          var tl = lbl.getComputedTextLength();
          if (r > 0 && tl > r * 1.75) {
            if (r < 34) {
              lbl.setAttribute("x", String(cx));
              lbl.setAttribute("y", String(Math.round(cy + r + 13)));
              lbl.style.paintOrder = "stroke";
              lbl.style.stroke = "var(--bg-surface)";
              lbl.style.strokeWidth = "3px";
              lbl.style.strokeLinejoin = "round";
            } else {
              lbl.setAttribute("textLength", String(Math.floor(r * 1.72)));
              lbl.setAttribute("lengthAdjust", "spacingAndGlyphs");
            }
          }
        }
      });

      // 2. Diagram nodes (<rect>, <ellipse>, <polygon>, <circle>): clamp overflowing <text>
      $all("g", svg).forEach(function (g) {
        var rect = g.querySelector(":scope > rect.node-card, :scope > rect.dg-box, :scope > rect.sd-state, :scope > rect.sw-node, :scope > rect.oc-box, :scope > rect.kt-box, :scope > rect.actor-box, :scope > rect.dt-box, :scope > rect.c4-box");
        if (!rect) {
          var rects = $all(":scope > rect", g).filter(function (r) {
            var cls = r.getAttribute("class") || "";
            if (/node-accent|node-icon-bg|node-badge-bg|erd-hit|dg-zone|zone-bg|sw-lane|dt-zone|sd-bar/.test(cls)) return false;
            return parseFloat(r.getAttribute("width") || 0) >= 48 && parseFloat(r.getAttribute("height") || 0) >= 22;
          });
          rect = rects[0] || null;
        }
        var rx, rw;
        if (rect) {
          rx = parseFloat(rect.getAttribute("x") || 0);
          rw = parseFloat(rect.getAttribute("width") || 0);
        } else {
          var shape = g.querySelector(":scope > ellipse, :scope > polygon, :scope > circle");
          if (!shape || !shape.getBBox) return;
          try {
            var sb = shape.getBBox();
            var factor = shape.tagName.toLowerCase() === "polygon" ? 0.62 : 0.82;
            rw = sb.width * factor;
            rx = sb.x + (sb.width - rw) / 2;
          } catch (e) { return; }
        }
        if (rw < 36) return;

        var badgeBg = g.querySelector(":scope > rect.node-badge-bg");
        var badgeTxt = g.querySelector(":scope > text.node-badge-text");
        if (badgeBg && badgeTxt && badgeTxt.getComputedTextLength) {
          var prevBtl = badgeTxt.getAttribute("textLength"), prevBla = badgeTxt.getAttribute("lengthAdjust");
          if (prevBtl) { badgeTxt.removeAttribute("textLength"); badgeTxt.removeAttribute("lengthAdjust"); }
          var btl = badgeTxt.getComputedTextLength();
          if (btl > 0) {
            var bx = parseFloat(badgeBg.getAttribute("x") || 0);
            var maxBw = Math.max(36, (rx + rw - 8) - bx);
            if (btl + 12 > maxBw) {
              badgeTxt.setAttribute("textLength", String(Math.floor(maxBw - 12)));
              badgeTxt.setAttribute("lengthAdjust", "spacingAndGlyphs");
              btl = maxBw - 12;
            }
            var finalBw = Math.ceil(btl + 12);
            badgeBg.setAttribute("width", String(finalBw));
            badgeTxt.setAttribute("x", String(Math.round((bx + finalBw / 2) * 10) / 10));
          } else if (prevBtl) {
            badgeTxt.setAttribute("textLength", prevBtl);
            if (prevBla) badgeTxt.setAttribute("lengthAdjust", prevBla);
          }
        }

        $all(":scope > text", g).forEach(function (t) {
          if ((badgeBg && t === badgeTxt) || !t.getComputedTextLength) return;
          var cls = t.getAttribute("class") || "";
          if (/sd-guard|edge-label|dg-elabel|zone-title|zone-desc|dg-zlabel/.test(cls)) return;
          var prevTL = t.getAttribute("textLength"), prevLA = t.getAttribute("lengthAdjust");
          if (prevTL) { t.removeAttribute("textLength"); t.removeAttribute("lengthAdjust"); }
          var tl = t.getComputedTextLength();
          if (!tl || tl <= 0) {
            if (prevTL) { t.setAttribute("textLength", prevTL); if (prevLA) t.setAttribute("lengthAdjust", prevLA); }
            return;
          }
          var tx = parseFloat(t.getAttribute("x") || 0);
          var anchor = t.getAttribute("text-anchor") || (window.getComputedStyle ? window.getComputedStyle(t).textAnchor : "") || "start";
          var maxW;
          if (anchor === "middle") {
            maxW = Math.min(tx - rx, (rx + rw) - tx) * 2 - 12;
          } else if (anchor === "end") {
            maxW = (tx - rx) - 8;
          } else {
            maxW = (rx + rw - tx) - 8;
          }
          if (maxW > 24 && tl > maxW + 0.5) {
            t.setAttribute("textLength", String(Math.floor(maxW)));
            t.setAttribute("lengthAdjust", "spacingAndGlyphs");
          }
        });
      });
    });
  };

  /* ===================== BOOT ===================== */
  HA.init = function (root) {
    root = root || document;
    ["themeToggle", "sortable", "filter", "kanban", "copy", "switcher", "slider", "tabs",
     "zoompan", "fitSvgText", "dragNode", "tree", "crossfilter", "paginate", "tooltip", "counter", "reveal", "reorder", "wfedit", "wfflow", "designpick", "formMock", "archExplorer", "tocSpy"
    ].forEach(function (fn) { try { HA[fn](root); } catch (e) { /* isolate */ } });
    $all("details", root).forEach(function (d) {
      d.addEventListener("toggle", function () { if (d.open && HA.fitSvgText) HA.fitSvgText(d); });
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (HA.fitSvgText) HA.fitSvgText(root); });
    }
  };
  if (document.readyState !== "loading") HA.init();
  else document.addEventListener("DOMContentLoaded", function () { HA.init(); });
})();
