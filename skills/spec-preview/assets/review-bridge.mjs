#!/usr/bin/env node
/* spec-preview review bridge — ブラウザのチェックリスト判定を review-result.json に書き出す。
 *
 * 使い方:
 *   node review-bridge.mjs --out <project>/.tmp/<slug>/review-result.json [--port 7357]
 *
 * `open index.html` の前にバックグラウンド起動しておくと、preview.js が自動検出して
 * 判定・メモをリアルタイム送信してくる（未起動でもチェックリストは動く）。
 * データ契約・回収手順の正本は references/review-checklist.md の「CLI 連携」節。
 * 127.0.0.1 のみ bind。書き出し先は起動時の --out に固定（ページ側からは変更不可）。 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const out = flag("out", "");
const port = Number(flag("port", "7357"));
if (!out || Number.isNaN(port)) {
  console.error("usage: node review-bridge.mjs --out <path/review-result.json> [--port 7357]");
  process.exit(1);
}
const outPath = path.resolve(out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });

// file:// で開いたページ（origin "null"）からの fetch を受けるための CORS 応答
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/ping") {
    res.writeHead(200, { ...CORS, "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, tool: "spec-preview-bridge", out: outPath }));
    return;
  }
  if (req.method === "POST" && req.url === "/review") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 512 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        payload.receivedAt = new Date().toISOString();
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
        const s = payload.summary || {};
        console.log(
          `[review-bridge] ${payload.checklist || "?"}: 確認 ${s.checked ?? "?"}/${s.total ?? "?"} · 指摘 ${s.ng ?? "?"} → ${outPath}`
        );
        res.writeHead(200, { ...CORS, "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { ...CORS, "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
      }
    });
    return;
  }
  res.writeHead(404, CORS);
  res.end();
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(
      `[review-bridge] port ${port} は使用中。--port <別番号> で起動し、index.html を ?bridge=<別番号> 付きで開いてください`
    );
    process.exit(1);
  }
  throw e;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[review-bridge] http://127.0.0.1:${port} で待機中 → ${outPath}`);
});
