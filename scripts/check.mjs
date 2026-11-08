#!/usr/bin/env node
// 檢查一個資料夾(書庫、主題或單一簡報)是否符合規則,並印出結構摘要。
// 給人用,也給 AI 用:做完簡報後先跑這個,確認沒有警告再交付。
//
//   node scripts/check.mjs <資料夾>          例:node scripts/check.mjs content
//   node scripts/check.mjs <資料夾> --slides  連每張投影片的版型與標題都列出來

import { nodeSource } from './node-source.mjs';
import { scanLibrary, loadDeck } from '../app/core/library.js';
import { resolveMediaPath } from '../app/core/media.js';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2];
const verbose = process.argv.includes('--slides');
if (!dir) { console.log('用法:node scripts/check.mjs <資料夾> [--slides]'); process.exit(1); }

const source = nodeSource(dir);
const lib = await scanLibrary(source);
const kindName = { library: '書庫', topic: '主題', deck: '單一簡報' }[lib.kind];
console.log(`📚 ${lib.title}(偵測為:${kindName})`);

let problems = [...lib.issues];
for (const t of lib.topics) {
  if (lib.kind === 'library') console.log(`\n▸ 主題:${t.title}  [${t.path}]`);
  for (const p of t.projects) {
    const deck = await loadDeck(source, p);
    const total = deck.sections.reduce((n, s) => n + s.slides.length, 0);
    console.log(`  ▪ ${deck.title}${deck.date ? `(${deck.date})` : ''}— ${deck.sections.length} 章、${total} 張${p.hasConfig ? '' : '、沒有 deck.yml'}`);
    for (const s of deck.sections) {
      console.log(`      ${s.title || '(開場)'}:${s.slides.length} 張`);
      for (const sl of s.slides) {
        if (verbose) console.log(`        - [${sl.layout}] ${sl.title || '(無標題)'}${sl.notes ? '  📝' : ''}${sl.auto ? '  (自動)' : ''}`);
        for (const m of sl.media) {
          if (m.remote) continue;
          const path = resolveMediaPath(m.src, { projectPath: p.path, filePath: sl.file });
          try { await access(join(source.root, path)); }
          catch { problems.push({ path: sl.file, message: `找不到素材 ${m.src}(實際路徑 ${path})` }); }
        }
      }
    }
    if (total > 45) problems.push({ path: p.path, message: `共 ${total} 張,25–30 分鐘的報告建議 20–35 張` });
    problems.push(...deck.issues);
  }
}

if (problems.length) {
  console.log(`\n⚠ ${problems.length} 個問題:`);
  for (const i of problems) console.log(`  - ${i.path}:${i.message}`);
  process.exitCode = 1;
} else {
  console.log('\n✓ 沒有發現問題');
}
