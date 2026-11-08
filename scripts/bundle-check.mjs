#!/usr/bin/env node
// 把檢查工具打包成「單一檔案」dist/mdslide-check.mjs,可以直接複製到任何書庫資料夾使用。
// 內容由 app/core/ 與 scripts/node-source.mjs 自動組合,請不要手動修改 dist/ 裡的檔案;
// 改了 app/core/ 之後執行:node scripts/bundle-check.mjs(tests/bundle.test.mjs 會檢查是否同步)。

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// 入口:從這兩個檔案開始,依 import 自動找出所有需要的模組並排好順序(不用手動維護清單)
const ENTRIES = ['app/core/check.js', 'scripts/node-source.mjs'];

async function collect() {
  const order = [], seen = new Set();
  const visit = async rel => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const src = await readFile(root + rel, 'utf8');
    for (const m of src.matchAll(/^import\s+[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) {
      await visit(new URL(m[1], 'file:///' + rel).pathname.slice(1));
    }
    order.push(rel); // 相依的模組先放
  };
  for (const e of ENTRIES) await visit(e);
  return order;
}

export async function bundle() {
  const nodeImports = new Set();
  const parts = [];
  for (const m of await collect()) {
    let src = await readFile(root + m, 'utf8');
    src = src.replace(/^import\s+[^;]*?from\s+['"]([^'"]+)['"];?\s*$/gm, (line, from) => {
      if (from.startsWith('node:')) nodeImports.add(line.trim());
      return '';
    });
    src = src.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, '')
             .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
             .replace(/^#!.*\n/, '');
    parts.push(`// ───────── ${m} ─────────\n${src.trim()}\n`);
  }
  const version = JSON.parse(await readFile(root + 'package.json', 'utf8')).version || '';
  return `#!/usr/bin/env node
// Mdslide Pile 書庫檢查工具(單檔版${version ? ' v' + version : ''})
// 由 scripts/bundle-check.mjs 自動產生,請不要手動修改。原始碼:https://github.com/ToruSmith/Mdslide-Pile
//
// 用法(需要 Node.js 18 以上):
//   node mdslide-check.mjs                 檢查這個檔案所在的資料夾(放在書庫根目錄時 = 整個書庫)
//   node mdslide-check.mjs <資料夾>         檢查指定的書庫、主題或單一簡報
//   node mdslide-check.mjs <資料夾> --slides 連每張投影片都列出來
// Windows 也可以直接雙擊「檢查書庫.cmd」,Mac 雙擊「檢查書庫.command」。

${[...nodeImports].sort().join('\n')}
import { fileURLToPath as __toPath } from 'node:url';

${parts.join('\n')}
// ───────── 命令列 ─────────
const __dir = process.argv.slice(2).find(a => !a.startsWith('--')) || __toPath(new URL('.', import.meta.url));
const __report = await checkLibrary(nodeSource(__dir));
console.log(formatReport(__report, { verbose: process.argv.includes('--slides') }));
if (__report.problems.length) process.exitCode = 1;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await mkdir(root + 'dist', { recursive: true });
  await writeFile(root + 'dist/mdslide-check.mjs', await bundle());
  console.log('已產生 dist/mdslide-check.mjs');
}
