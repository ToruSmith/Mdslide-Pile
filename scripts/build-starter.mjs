#!/usr/bin/env node
// 組出「範例書庫」資料夾:starter/ 的說明 + content/ 的主題(不含官方範例)+ dist/ 的檢查工具。
// 發布新版時由 .github/workflows/release.yml 執行並打包成 Mdslide-library-vX.Y.Z.zip(解壓後是「Mdslide書庫」資料夾)。
//   node scripts/build-starter.mjs <輸出資料夾>      例:node scripts/build-starter.mjs build/Mdslide書庫

import { cp, readdir, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) { console.error('usage: node scripts/build-starter.mjs <out-dir>'); process.exit(1); }
const SKIP = new Set(['00-官方範例', '_site.yml']); // 官方範例留在網站上;書庫有自己的 _site.yml

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const dir of ['starter', 'dist']) await cp(dir, out, { recursive: true });
for (const name of await readdir('content')) if (!SKIP.has(name)) await cp(join('content', name), join(out, name), { recursive: true });
console.log(out);
