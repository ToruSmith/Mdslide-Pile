import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml } from '../app/core/yaml.js';
import { renderMarkdown } from '../app/core/markdown.js';
import { parseSlideFile } from '../app/core/slide.js';
import { classifyMedia, resolveMediaPath } from '../app/core/media.js';
import { splitOrder } from '../app/core/names.js';
import { detectRootKind, scanLibrary, loadCover, loadDeck, flatten } from '../app/core/library.js';
import { memorySource } from './helpers.mjs';

test('yaml: 巢狀物件、物件清單、行內陣列、多行文字、註解', () => {
  const y = parseYaml(`
title: 標題 # 註解
date: 2026-11-20
count: 3
on: true
url: https://example.com/a#b
layout:
  stage: pile
  transition: shuffle
tags: [a, "b, c", 3]
sections:
  - folder: 01-問題
    color: "#b4654a"
  - folder: 02-方法
    hidden: true
list:
  - https://x.y/z
  - 純文字
desc: |
  第一行
  第二行
`);
  assert.equal(y.title, '標題');
  assert.equal(y.date, '2026-11-20');
  assert.equal(y.count, 3);
  assert.equal(y.on, true);
  assert.equal(y.url, 'https://example.com/a#b');
  assert.deepEqual(y.layout, { stage: 'pile', transition: 'shuffle' });
  assert.deepEqual(y.tags, ['a', 'b, c', 3]);
  assert.deepEqual(y.sections, [{ folder: '01-問題', color: '#b4654a' }, { folder: '02-方法', hidden: true }]);
  assert.deepEqual(y.list, ['https://x.y/z', '純文字']);
  assert.equal(y.desc, '第一行\n第二行');
});

test('yaml: 錯誤會帶行號', () => {
  assert.throws(() => parseYaml('a: 1\n\tb: 2'), /第 2 行/);
});

test('markdown: 區塊與行內語法,並跳脫 HTML', () => {
  const h = renderMarkdown('# 標題\n- 一 **粗**\n  - 二\n- [x] 完成\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\n<script>x</script>\n第一行\n第二行 ==亮==\n\n```js\nconst a = 1 < 2\n```');
  assert.match(h, /<h1>標題<\/h1>/);
  assert.match(h, /<ul><li>一 <strong>粗<\/strong><ul><li>二<\/li><\/ul><\/li><li class="task done">完成<\/li><\/ul>/);
  assert.match(h, /<td style="text-align:right">2<\/td>/);
  assert.match(h, /&lt;script&gt;/);
  assert.match(h, /第一行<br>第二行 <mark>亮<\/mark>/);
  assert.match(h, /<pre data-lang="js"><code>const a = 1 &lt; 2<\/code><\/pre>/);
});

test('slide: front matter、--- 拆張、備註、媒體、自動版型', () => {
  const { slides, issues } = parseSlideFile(`---
step: true
---
# 第一張
- 甲

Note: 這是備註
第二行備註
---
![說明](media/a.jpg)
---
> 寫筆記是為了未來的自己
— 某人
---
<!-- layout: stats -->
- **3** 種
---
## 68%
示範數據
---
\`\`\`
---
\`\`\`
`, { path: 'd/01/a.md' });
  assert.equal(issues.length, 0);
  assert.equal(slides.length, 6);
  assert.equal(slides[0].title, '第一張');
  assert.equal(slides[0].meta.step, true);
  assert.equal(slides[0].notes, '這是備註\n第二行備註');
  assert.equal(slides[0].layout, 'text');
  assert.equal(slides[1].layout, 'full');
  assert.equal(slides[1].media[0].kind, 'image');
  assert.equal(slides[2].layout, 'quote');
  assert.equal(slides[3].layout, 'stats');
  assert.equal(slides[4].layout, 'number');
  assert.match(slides[5].body, /---/);
});

test('media: 線上嵌入與路徑規則', () => {
  assert.equal(classifyMedia('https://youtu.be/aqz-KE-bpKQ?t=30').provider, 'YouTube');
  assert.match(classifyMedia('https://www.youtube.com/watch?v=aqz-KE-bpKQ').embed, /embed\/aqz-KE-bpKQ/);
  assert.equal(classifyMedia('https://www.bilibili.com/video/BV1GJ411x7h7/').provider, 'Bilibili');
  assert.match(classifyMedia('https://drive.google.com/file/d/abc_123/view').embed, /abc_123\/preview/);
  assert.equal(classifyMedia('media/x.MP4').kind, 'video');
  const ctx = { projectPath: 't/p', filePath: 't/p/01-s/a.md' };
  assert.equal(resolveMediaPath('media/a.jpg', ctx), 't/p/media/a.jpg');
  assert.equal(resolveMediaPath('./a.jpg', ctx), 't/p/01-s/a.jpg');
  assert.equal(resolveMediaPath('../media/a.jpg', ctx), 't/p/media/a.jpg');
  assert.equal(resolveMediaPath('/media/a.jpg', ctx), 't/p/media/a.jpg');
});

test('names: 排序前綴', () => {
  assert.deepEqual(splitOrder('01-問題'), { order: 1, label: '問題' });
  assert.deepEqual(splitOrder('03_三種卡片.md'), { order: 3, label: '三種卡片' });
  assert.deepEqual(splitOrder('README'), { order: null, label: 'README' });
});

const LIB = {
  '_site.yml': 'title: 我的書架\ntopics: [工作]',
  '01-教學/_topic.yml': 'name: 教學\ncolor: "#123456"',
  '01-教學/2026-11-筆記/deck.yml': 'title: 筆記系統\ndate: 2026-11-20\nsections:\n  - folder: 02-方法\n    title: 方法論\n  - folder: 03-草稿\n    hidden: true\nend: 謝謝',
  '01-教學/2026-11-筆記/01-問題/01-a.md': '# A\n---\n# B',
  '01-教學/2026-11-筆記/01-問題/_draft.md': '# 草稿',
  '01-教學/2026-11-筆記/02-方法/01-c.md': '# C',
  '01-教學/2026-11-筆記/03-草稿/01-x.md': '# X',
  '01-教學/2026-11-筆記/media/a.jpg': 'bin',
  '01-教學/2025-01-舊/01-章/a.md': '# 舊簡報第一張',
  '02-工作/週報/a.md': '# 週報',
};

test('library: 根目錄類型偵測', async () => {
  assert.equal(await detectRootKind(memorySource(LIB)), 'library');
  assert.equal(await detectRootKind(memorySource({ 'deck.yml': 'title: x', '01/a.md': '#' })), 'deck');
  assert.equal(await detectRootKind(memorySource({ '01-s/a.md': '#', '02-s/b.md': '#' })), 'deck');
  assert.equal(await detectRootKind(memorySource({ 'a.md': '#' })), 'deck');
  assert.equal(await detectRootKind(memorySource({ 'p1/deck.yml': 'title: x', 'p1/a.md': '#' })), 'topic');
  assert.equal(await detectRootKind(memorySource({ 't/p/deck.yml': 'x: 1' })), 'library');
});

test('library: 第 1 層只讀設定檔,不讀任何 MD', async () => {
  const src = memorySource(LIB);
  const lib = await scanLibrary(src);
  assert.equal(lib.title, '我的書架');
  assert.deepEqual(lib.topics.map(t => t.title), ['工作', '教學']);
  assert.equal(lib.topics[1].color, '#123456');
  assert.deepEqual(lib.topics[1].projects.map(p => p.title), ['筆記系統', '舊']);
  assert.ok(src.reads.every(p => p.endsWith('.yml')), '目錄層只應讀 yml:' + src.reads.join(', '));
});

test('library: 第 2 層封面,有標題時不讀 MD', async () => {
  const src = memorySource(LIB);
  const lib = await scanLibrary(src);
  const [withConf, noConf] = lib.topics[1].projects;
  src.reads.length = 0;
  const c1 = await loadCover(src, withConf);
  assert.equal(c1.sections, 3);
  assert.equal(src.reads.length, 0);
  const c2 = await loadCover(src, noConf);
  assert.equal(c2.firstSlide.title, '舊簡報第一張');
  assert.equal(src.reads.length, 1);
});

test('library: 第 3 層整份簡報', async () => {
  const src = memorySource(LIB);
  const lib = await scanLibrary(src);
  const deck = await loadDeck(src, lib.topics[1].projects[0]);
  assert.deepEqual(deck.sections.map(s => s.title), ['問題', '方法論']);
  const flat = flatten(deck);
  assert.deepEqual(flat.map(s => s.layout), ['title', 'section', 'text', 'text', 'section', 'text', 'end']);
  assert.ok(!src.reads.some(p => p.includes('_draft') || p.includes('03-草稿')));
  assert.equal(deck.issues.length, 0);
});

test('library: 單一簡報資料夾(零設定)', async () => {
  const src = memorySource({ '01-開場/a.md': '# 你好', '02-結尾/b.md': '# 再見' }, '我的報告');
  const lib = await scanLibrary(src);
  assert.equal(lib.kind, 'deck');
  const deck = await loadDeck(src, lib.topics[0].projects[0]);
  assert.equal(deck.title, '我的報告');
  assert.deepEqual(flatten(deck).map(s => s.title), ['我的報告', '開場', '你好', '結尾', '再見']);
});
