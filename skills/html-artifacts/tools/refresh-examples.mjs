#!/usr/bin/env node
// Keep the checked-in demos on the canonical CSS/JS and deterministic build specs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((x) => x !== '--check')) {
  console.error('usage: node tools/refresh-examples.mjs [--check]');
  process.exit(2);
}
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const core = ['reset', 'tokens', 'themes', 'elements'].map((id) => read(`templates/core/${id}.css`).trim()).join('\n\n');
const js = read('templates/core/interactions.js').trim();
const scratch = execFileSync('mktemp', ['-d'], { encoding: 'utf8' }).trim();
let changed = 0, total = 0;
function sync(file, content) {
  total++;
  if (read(file) === content) return;
  changed++;
  if (check) console.error(`stale: ${file}`);
  else fs.writeFileSync(path.join(root, file), content);
}
try {
  const specs = fs.readdirSync(path.join(root, 'examples/specs')).filter((x) => x.endsWith('.spec.json')).sort()
    .map((x) => `examples/specs/${x}`);
  specs.push('examples/example-demo-gallery.spec.json');
  for (const spec of specs) {
    const name = path.basename(spec, '.spec.json') + '.html';
    const output = path.join(scratch, name);
    execFileSync(process.execPath, [path.join(root, 'tools/build.mjs'), path.join(root, spec), output], { stdio: 'pipe' });
    sync(`examples/${name}`, fs.readFileSync(output, 'utf8'));
  }
  for (const file of ['index.html', ...[3, 4, 5, 6].map((v) => `examples/example-v${v}-gallery.html`)]) {
    let html = read(file), styles = 0, scripts = 0;
    html = html.replace(/<style>([\s\S]*?)<\/style>/, (_, css) => {
      styles++;
      let suffix;
      if (file === 'index.html') {
        const at = css.indexOf('index-only styles');
        if (at < 0) throw new Error(`${file}: missing index-only styles marker`);
        suffix = css.slice(css.lastIndexOf('/*', at)).trim();
      } else {
        const ids = [...css.matchAll(/\/\*\s*-+\s*module:\s*([a-z0-9-]+)\s*-+\s*\*\//g)].map((m) => m[1]);
        if (!ids.length) throw new Error(`${file}: missing module markers`);
        suffix = ids.map((id) => {
          const source = read(`templates/modules/${id}.html`).replace(/<!--[\s\S]*?-->/g, '');
          const body = source.match(/<style data-module="[^"]+">([\s\S]*?)<\/style>/);
          if (!body) throw new Error(`${id}: missing canonical module style`);
          return `/* ---- module: ${id} ---- */\n${body[1].trim()}`;
        }).join('\n\n');
      }
      return `<style>\n${core}\n\n${suffix}\n</style>`;
    });
    html = html.replace(/<script>([\s\S]*?)<\/script>/g, (tag, body) => {
      if (!body.includes('interactions.js')) return tag;
      scripts++;
      return `<script>\n${js}\n</script>`;
    });
    if (styles !== 1 || scripts !== 1) throw new Error(`${file}: expected one core stylesheet and one interactions script`);
    sync(file, html);
  }
  console.log(`${check && changed ? 'FAIL' : 'PASS'}  ${total} demos ${check ? 'checked' : 'refreshed'}, ${changed} ${check ? 'stale' : 'updated'}`);
  process.exitCode = check && changed ? 1 : 0;
} finally {
  fs.rmSync(scratch, { recursive: true });
}
