/* HTML 側が満たすべき DOM フック契約は references/assets-contract.md を参照。
 * 優先順位: URL クエリ > body の data-* 属性（テンプレートの __DEFAULT_VIEWPORT__ 等）> target からの既定値 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const page = document.body.dataset.page || "view";
  const target = params.get("target") || document.body.dataset.target || "auto";
  const targetViewport = target === "mobile-app" ? "phone" : target === "tablet-app" ? "tablet" : "desktop";
  const defaultViewport = document.body.dataset.viewport || targetViewport;
  const viewport = params.get("viewport") || defaultViewport;
  const mode = params.get("mode") || document.body.dataset.mode || "app";

  function setActive(selector, attr, value) {
    document.querySelectorAll(selector).forEach((button) => {
      const active = button.dataset[attr] === value;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function applyViewState(nextViewport, nextMode, updateUrl) {
    document.body.dataset.target = target;
    document.body.dataset.viewport = nextViewport;
    document.body.dataset.mode = nextMode;
    document.body.dataset.embed = params.get("embed") || document.body.dataset.embed || "0";
    setActive("[data-viewport-target]", "viewportTarget", nextViewport);
    setActive("[data-mode-target]", "modeTarget", nextMode);
    if (updateUrl) {
      const next = new URLSearchParams(window.location.search);
      next.set("viewport", nextViewport);
      next.set("mode", nextMode);
      next.delete("embed");
      history.replaceState(null, "", `${window.location.pathname}?${next.toString()}`);
    }
  }

  // index のミニプレビュー iframe の論理レンダリング寸法。
  // shared.css の --device-width/height（端末枠の実寸）+ embed 表示の余白を包む外寸。
  // 端末サイズを変えるときは shared.css 側の device-frame 寸法も揃えて更新する。
  function frameBase(vp) {
    if (vp === "tablet") return { width: 820, height: 860 };
    if (vp === "desktop") return { width: 1280, height: 800 };
    return { width: 430, height: 840 };
  }

  function fitFrames() {
    const vp = document.body.dataset.frameViewport || "phone";
    const base = frameBase(vp);
    document.querySelectorAll(".frame").forEach((frame) => {
      const iframe = frame.querySelector("iframe");
      if (!iframe) return;
      iframe.style.width = `${base.width}px`;
      iframe.style.height = `${base.height}px`;
      const scale = frame.clientWidth / base.width;
      iframe.style.transform = `scale(${scale})`;
      frame.style.height = `${base.height * scale}px`;
    });
  }

  function setFrameViewport(vp) {
    document.body.dataset.frameViewport = vp;
    setActive("[data-frame-viewport]", "frameViewport", vp);
    document.querySelectorAll("iframe[data-view-src]").forEach((iframe) => {
      const src = iframe.dataset.viewSrc;
      iframe.src = `${src}?target=${target}&viewport=${vp}&embed=1`;
    });
    document.querySelectorAll(".frame").forEach((frame) => {
      const iframe = frame.querySelector("iframe[data-view-src]");
      const overlay = frame.querySelector(".open-overlay");
      if (iframe && overlay) overlay.href = `${iframe.dataset.viewSrc}?target=${target}&viewport=${vp}`;
    });
    fitFrames();
  }

  // ---- 全画面モーダル ----
  // index の「全画面で開く」を画面遷移ではなく現在画面のオーバーレイで拡大表示する。
  // DOM は JS が生成するのでテンプレート側の追加マークアップは不要。
  // UI ラベルは html lang から自動選択（プレースホルダではない）。
  const fullviewLabels = (() => {
    const lang = (document.documentElement.lang || "en").slice(0, 2);
    if (lang === "ja") return { close: "閉じる", newTab: "新しいタブで開く" };
    if (lang === "ko") return { close: "닫기", newTab: "새 탭에서 열기" };
    return { close: "Close", newTab: "Open in new tab" };
  })();
  let fullview = null;
  let fullviewLastFocus = null;

  function ensureFullview() {
    if (fullview) return fullview;
    const overlay = document.createElement("div");
    overlay.className = "fullview-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="fullview-bar">' +
      '<span class="fullview-title"></span>' +
      '<span class="spacer"></span>' +
      `<a class="btn btn-ghost fullview-newtab" target="_blank" rel="noopener">${fullviewLabels.newTab} ↗</a>` +
      `<button class="btn fullview-close" type="button">✕ ${fullviewLabels.close}</button>` +
      "</div>" +
      '<iframe class="fullview-iframe" title=""></iframe>';
    document.body.appendChild(overlay);
    overlay.querySelector(".fullview-close").addEventListener("click", closeFullview);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) closeFullview();
    });
    fullview = overlay;
    return overlay;
  }

  function openFullview(href, title) {
    const overlay = ensureFullview();
    fullviewLastFocus = document.activeElement;
    overlay.querySelector(".fullview-title").textContent = title || "";
    overlay.querySelector(".fullview-newtab").href = href;
    const iframe = overlay.querySelector(".fullview-iframe");
    iframe.title = title || "";
    iframe.src = href;
    overlay.hidden = false;
    document.body.dataset.fullview = "1";
    overlay.querySelector(".fullview-close").focus();
  }

  function closeFullview() {
    if (!fullview || fullview.hidden) return;
    fullview.hidden = true;
    fullview.querySelector(".fullview-iframe").src = "about:blank";
    delete document.body.dataset.fullview;
    if (fullviewLastFocus && fullviewLastFocus.focus) fullviewLastFocus.focus();
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.open-overlay, a[data-fullview]");
    if (!link) return;
    // 修飾キー付きクリックはブラウザ既定（新規タブ等）に任せる。href は no-JS フォールバック
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const frame = link.closest(".frame");
    const iframe = frame && frame.querySelector("iframe");
    openFullview(link.href, link.dataset.fullviewTitle || (iframe && iframe.title) || "");
  });

  // ---- レビューチェックリスト ----
  // DOM 契約は references/review-checklist.md を参照。
  // [data-checklist] 内の li[data-check-item] に OK / 要修正ボタンを生成し、
  // 判定を localStorage に保存、[data-checklist-progress] に進捗を表示する。
  // ラベルは html lang から自動選択（fullviewLabels と同じパターン）。
  const checklistLabels = (() => {
    const lang = (document.documentElement.lang || "en").slice(0, 2);
    if (lang === "ja")
      return { ok: "OK", ng: "要修正", progress: (n, m, k) => `確認 ${n}/${m} · 指摘 ${k}` };
    if (lang === "ko")
      return { ok: "OK", ng: "수정 필요", progress: (n, m, k) => `확인 ${n}/${m} · 지적 ${k}` };
    return { ok: "OK", ng: "Needs fix", progress: (n, m, k) => `${n}/${m} checked · ${k} issues` };
  })();

  function initChecklist(root) {
    const storeKey = `spec-preview-check:${window.location.pathname}:${root.dataset.checklist || "default"}`;
    let saved = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(storeKey) || "{}");
    } catch (_) {
      saved = {};
    }
    const items = [...root.querySelectorAll("[data-check-item]")];
    const progress = root.querySelector("[data-checklist-progress]");

    function syncButtons(item) {
      item.querySelectorAll(".check-btn").forEach((b) => {
        const active =
          (b.classList.contains("check-btn-ok") && item.dataset.state === "ok") ||
          (b.classList.contains("check-btn-ng") && item.dataset.state === "ng");
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function persist() {
      const state = {};
      items.forEach((item) => {
        if (item.dataset.state) state[item.dataset.checkItem] = item.dataset.state;
      });
      try {
        window.localStorage.setItem(storeKey, JSON.stringify(state));
      } catch (_) {
        /* file:// や private mode で保存不可でも判定 UI 自体は動作継続 */
      }
      if (progress) {
        const done = items.filter((item) => item.dataset.state).length;
        const issues = items.filter((item) => item.dataset.state === "ng").length;
        progress.textContent = checklistLabels.progress(done, items.length, issues);
        progress.classList.toggle("badge-ok", done === items.length && issues === 0);
        progress.classList.toggle("badge-warn", issues > 0);
      }
    }

    items.forEach((item) => {
      const actions = item.querySelector(".check-actions");
      if (!actions) return;
      [
        { state: "ok", label: checklistLabels.ok, cls: "check-btn-ok" },
        { state: "ng", label: checklistLabels.ng, cls: "check-btn-ng" },
      ].forEach(({ state, label, cls }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn check-btn ${cls}`;
        button.textContent = label;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
          // 同じ判定を再クリックで解除、別判定クリックで切替
          if (item.dataset.state === state) delete item.dataset.state;
          else item.dataset.state = state;
          syncButtons(item);
          persist();
        });
        actions.appendChild(button);
      });
      const initial = saved[item.dataset.checkItem];
      if (initial === "ok" || initial === "ng") {
        item.dataset.state = initial;
        syncButtons(item);
      }
    });
    persist();
  }

  document.querySelectorAll("[data-checklist]").forEach(initChecklist);

  // もう一方の軸は body の現在値を読む（初期値の closure を使うと切替が巻き戻る）
  document.querySelectorAll("[data-viewport-target]").forEach((button) => {
    button.addEventListener("click", () => applyViewState(button.dataset.viewportTarget, document.body.dataset.mode || mode, true));
  });
  document.querySelectorAll("[data-mode-target]").forEach((button) => {
    button.addEventListener("click", () => applyViewState(document.body.dataset.viewport || viewport, button.dataset.modeTarget, true));
  });
  document.querySelectorAll("[data-frame-viewport]").forEach((button) => {
    button.addEventListener("click", () => setFrameViewport(button.dataset.frameViewport));
  });

  if (page === "index") {
    document.body.dataset.target = target;
    // テンプレートが置換した data-frame-viewport（__DEFAULT_VIEWPORT__）を初期値として尊重する
    setFrameViewport(params.get("viewport") || document.body.dataset.frameViewport || targetViewport);
    window.addEventListener("resize", fitFrames);
  } else {
    applyViewState(viewport, mode, false);
  }
})();
