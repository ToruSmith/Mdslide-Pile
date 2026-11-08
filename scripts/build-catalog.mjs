#!/usr/bin/env node
// 產生 catalog.json:content/ 的資料夾清單,讓網站在 GitHub Pages 上能列出內建簡報。
// GitHub Actions 部署時會自動執行;本機想用 http 伺服器預覽時也可以手動執行:
//   node scripts/build-catalog.mjs

import { writeFile } from 'node:fs/promises';
import { nodeSource, walkTree, detectNodeLang } from './node-source.mjs';
import { t, setLang } from '../app/core/i18n.js';

setLang(detectNodeLang());
import { scanLibrary, loadDeck } from '../app/core/library.js';

const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--lang');
const root = args[0] || 'content';
const out = args[1] || 'catalog.json';

const source = nodeSource(root);
const tree = await walkTree(source);
const lib = await scanLibrary(source);

// 順便檢查每份簡報,有問題就印出來(不中斷部署)
const issues = [...lib.issues];
let decks = 0, slides = 0;
for (const tp of lib.topics) for (const p of tp.projects) {
  const d = await loadDeck(source, p);
  decks++;
  slides += d.sections.reduce((n, s) => n + s.slides.length, 0);
  issues.push(...d.issues);
}

await writeFile(out, JSON.stringify({ version: 1, title: lib.title, generated: new Date().toISOString(), tree }) + '\n');
console.log(t('catalog.done', { topics: lib.topics.length, decks, slides }));
for (const i of issues) console.warn(`  ⚠ ${i.path}:${i.message}`);
