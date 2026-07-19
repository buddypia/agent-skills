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
  // [data-checklist] 内の li[data-check-item] に OK / 要修正ボタンとメモ欄を生成し、
  // 判定を localStorage に保存、[data-checklist-progress] に進捗を表示する。
  // 判定の回収（CLI 連携）は2経路: 「結果をコピー」(slug 付き Markdown) と、
  // review-bridge.mjs への自動送信（.tmp/<slug>/review-result.json）。
  // ラベルは html lang から自動選択（fullviewLabels と同じパターン）。
  const checklistLabels = (() => {
    const lang = (document.documentElement.lang || "en").slice(0, 2);
    if (lang === "ja")
      return {
        ok: "OK", ng: "要修正", unchecked: "未確認",
        progress: (n, m, k) => `確認 ${n}/${m} · 指摘 ${k}`,
        copy: "結果をコピー", copied: "コピーしました ✓",
        notePh: "要修正の理由・箇所（CLI に渡されます）",
        bridgeOn: "自動保存: 接続中", bridgeOff: "自動保存: 未接続",
        resultTitle: "UIレビュー結果",
      };
    if (lang === "ko")
      return {
        ok: "OK", ng: "수정 필요", unchecked: "미확인",
        progress: (n, m, k) => `확인 ${n}/${m} · 지적 ${k}`,
        copy: "결과 복사", copied: "복사됨 ✓",
        notePh: "수정 필요 사유·위치 (CLI로 전달됩니다)",
        bridgeOn: "자동 저장: 연결됨", bridgeOff: "자동 저장: 미연결",
        resultTitle: "UI 리뷰 결과",
      };
    return {
      ok: "OK", ng: "Needs fix", unchecked: "Unchecked",
      progress: (n, m, k) => `${n}/${m} checked · ${k} issues`,
      copy: "Copy result", copied: "Copied ✓",
      notePh: "Why it needs a fix (passed to the CLI)",
      bridgeOn: "Auto-save: connected", bridgeOff: "Auto-save: off",
      resultTitle: "UI review result",
    };
  })();

  // review-bridge.mjs（起動していれば）への自動送信。未起動でもチェックリストは動作し、
  // コピー経路にフォールバックする。port の既定は 7357（?bridge= / data-bridge-port で変更可）。
  const fetchTimeout = (ms) =>
    typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
  const bridge = {
    base: `http://127.0.0.1:${params.get("bridge") || document.body.dataset.bridgePort || "7357"}`,
    connected: false,
    statusEls: [],
    lastPayloads: new Map(),
    render() {
      this.statusEls.forEach((el) => {
        el.dataset.connected = this.connected ? "1" : "0";
        el.textContent = this.connected ? checklistLabels.bridgeOn : checklistLabels.bridgeOff;
      });
    },
    update(on) {
      const was = this.connected;
      this.connected = on;
      this.render();
      // 後からブリッジが起動された場合も、再接続時に最新状態を同期する
      if (on && !was) this.lastPayloads.forEach((payload) => this.post(payload));
    },
    async ping() {
      try {
        const res = await fetch(`${this.base}/ping`, { signal: fetchTimeout(700) });
        this.update(res.ok);
      } catch (_) {
        this.update(false);
      }
    },
    async post(payload) {
      try {
        const res = await fetch(`${this.base}/review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: fetchTimeout(1500),
        });
        if (!res.ok) this.update(false);
      } catch (_) {
        this.update(false);
      }
    },
    send(payload) {
      this.lastPayloads.set(payload.checklist, payload);
      if (this.connected) this.post(payload);
    },
  };

  function checklistToMarkdown(data) {
    const stateLabel = (s) =>
      s === "ok" ? checklistLabels.ok : s === "ng" ? checklistLabels.ng : checklistLabels.unchecked;
    const lines = data.items.map((item) => {
      const note = item.state === "ng" && item.note ? ` — ${item.note}` : "";
      return `- [${stateLabel(item.state)}] ${item.label} (${item.slug})${note}`;
    });
    return [
      `## ${checklistLabels.resultTitle} — ${data.checklist}`,
      checklistLabels.progress(data.summary.checked, data.summary.total, data.summary.ng),
      ...lines,
    ].join("\n");
  }

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
    const notes = new Map();
    let noteTimer = null;

    function collect() {
      const entries = items.map((item) => {
        const label = item.querySelector(".check-label b");
        const desc = item.querySelector(".check-label .muted");
        const note = notes.get(item);
        return {
          slug: item.dataset.checkItem,
          label: label ? label.textContent.trim() : item.dataset.checkItem,
          desc: desc ? desc.textContent.trim() : "",
          state: item.dataset.state || null,
          note: note ? note.value.trim() : "",
        };
      });
      return {
        tool: "spec-preview",
        version: 1,
        checklist: root.dataset.checklist || "default",
        page: window.location.pathname,
        lang: (document.documentElement.lang || "en").slice(0, 2),
        updatedAt: new Date().toISOString(),
        summary: {
          total: entries.length,
          checked: entries.filter((e) => e.state).length,
          ok: entries.filter((e) => e.state === "ok").length,
          ng: entries.filter((e) => e.state === "ng").length,
        },
        items: entries,
      };
    }

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
        const note = notes.get(item);
        const entry = { state: item.dataset.state || null, note: note ? note.value.trim() : "" };
        if (entry.state || entry.note) state[item.dataset.checkItem] = entry;
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
      bridge.send(collect());
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
      // ng 時のみ表示されるメモ欄（shared.css が data-state で切替）。指摘理由が CLI 連携の中身になる
      const savedEntry = saved[item.dataset.checkItem];
      const initialState = typeof savedEntry === "string" ? savedEntry : savedEntry && savedEntry.state;
      const note = document.createElement("input");
      note.type = "text";
      note.className = "check-note";
      note.placeholder = checklistLabels.notePh;
      note.value = (savedEntry && typeof savedEntry === "object" && savedEntry.note) || "";
      note.addEventListener("input", () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(persist, 400);
      });
      item.appendChild(note);
      notes.set(item, note);
      if (initialState === "ok" || initialState === "ng") {
        item.dataset.state = initialState;
        syncButtons(item);
      }
    });

    // 回収 UI（コピー + ブリッジ状態）はテンプレート側マークアップ不要 — ここで生成する
    const footer = document.createElement("div");
    footer.className = "check-footer";
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn check-copy";
    copyBtn.textContent = checklistLabels.copy;
    copyBtn.addEventListener("click", async () => {
      const text = checklistToMarkdown(collect());
      let done = false;
      try {
        await navigator.clipboard.writeText(text);
        done = true;
      } catch (_) {
        /* file:// 等で Clipboard API 不可 → execCommand フォールバック */
      }
      if (!done) {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        try {
          done = document.execCommand("copy");
        } catch (_) {}
        helper.remove();
      }
      if (done) {
        copyBtn.textContent = checklistLabels.copied;
        setTimeout(() => {
          copyBtn.textContent = checklistLabels.copy;
        }, 1600);
      }
    });
    const status = document.createElement("span");
    status.className = "check-bridge";
    bridge.statusEls.push(status);
    footer.append(copyBtn, status);
    root.appendChild(footer);
    bridge.render();
    persist();
  }

  document.querySelectorAll("[data-checklist]").forEach(initChecklist);
  if (document.querySelector("[data-checklist]")) {
    bridge.ping();
    // ブリッジが後から起動されても拾えるよう、未接続の間だけ定期 ping
    setInterval(() => {
      if (!bridge.connected) bridge.ping();
    }, 3000);
  }

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
