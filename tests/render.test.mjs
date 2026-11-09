// 投影片輸出(render.js)與圖表解析(core/chart.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSlide } from '../app/player/render.js';
import { parseChartTable, parseNumber, niceScale } from '../app/core/chart.js';

const deck = { title: 'D', path: 'p', sections: [{ title: 'S', color: '#4f73a6', folder: '01-s', slides: [] }] };
const render = (layout, body, meta = {}) => renderSlide({ layout, body, meta, media: [], file: 'p/01-s/a.md', sec: 0, i: 0, title: 'T' }, { deck, mode: 'thumb', globalIndex: 0, total: 1 });
const table = rows => `# T\n| k | v |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}`;
const heights = html => [...html.matchAll(/<rect[^>]*?height="([-\d.e]+)"/g)].map(m => Number(m[1]));

for (const type of ['bar', 'hbar', 'line']) {
  test(`chart ${type}:負值、全負、缺值、單列都不會產生負高度`, () => {
    const cases = [
      [['a', -300], ['b', 100]],
      [['a', -5], ['b', -1]],
      [['a', 'N/A'], ['b', '—'], ['c', ''], ['d', 3]],
      [['only', 42]],
    ];
    for (const rows of cases) {
      const h = render('chart', table(rows), { chart: type });
      assert.ok(heights(h).every(x => x >= 0), `${type} ${JSON.stringify(rows)} 出現負高度`);
      assert.ok(!/NaN|Infinity/.test(h), `${type} ${JSON.stringify(rows)} 出現 NaN`);
      assert.match(h, /<svg class="chart"[^>]*role="img"><title>T<\/title>/);
    }
  });
}

test('chart:缺值顯示「–」,不顯示 0', () => {
  const h = render('chart', table([['a', 'N/A'], ['b', 5]]), { chart: 'bar' });
  assert.match(h, />–</);
  assert.ok(!/>0<\/text><text x="[\d.]+" y="[\d.]+" text-anchor="middle" font-size="22">a</.test(h));
});

test('chart:單欄(只有標籤)不會壞', () => {
  const h = render('chart', '| k |\n|---|\n| a |', { chart: 'bar' });
  assert.ok(!/NaN/.test(h));
});

test('parseNumber:千分位、全形負號、%、單位、缺值', () => {
  assert.deepEqual(['1,234', '−5,510 點', '12.5%', 'NT$ 300', 'N/A', '—', '', 'abc', '-0.5'].map(parseNumber), [1234, -5510, 12.5, 300, null, null, null, null, -0.5]);
});

test('parseChartTable:無法解析的格子會回報', () => {
  const t = parseChartTable(table([['a', 'abc'], ['b', 'N/A'], ['c', 1]]));
  assert.deepEqual(t.bad.map(b => b.text), ['abc']);
  assert.deepEqual(t.series[0].values, [null, null, 1]);
});

test('niceScale:1/2/5 級距、包含 0、格數 3–6', () => {
  for (const max of [101, 7, 0.3, 1873]) {
    const s = niceScale(0, max);
    assert.ok(s.hi >= max && s.hi < max * 2, `max ${max} → hi ${s.hi}`);
    const n = s.ticks.length - 1;
    assert.ok(n >= 3 && n <= 6, `max ${max} → ${n} 格`);
    assert.match(String(s.step / 10 ** Math.floor(Math.log10(s.step) + 1e-9)), /^(1|2|5)$/);
  }
  const neg = niceScale(-300, 100);
  assert.ok(neg.lo <= -300 && neg.hi >= 100 && neg.ticks.includes(0));
});

test('stats:長數值自動縮小字級,所有卡片同一大小', () => {
  const h = render('stats', '# t\n- **−5,510 點** a\n- **−20.3%** b\n- **3** c\n- **1** d');
  const sizes = [...h.matchAll(/font-size:(\d+)px/g)].map(m => Number(m[1]));
  assert.equal(new Set(sizes).size, 1);
  assert.ok(sizes[0] < 88);
});

test('timeline:(now) 標記目前位置', () => {
  const h = render('timeline', '# t\n- **A** 一\n- **B** 二 (now)');
  assert.match(h, /tl-item now/);
  assert.ok(!h.includes('(now)'));
});

test('columns:+++ 分欄,第一段標題當整張標題', () => {
  const h = render('columns', '# 標題\n+++\n## 左\n+++\n## 右');
  assert.match(h, /--n:2/);
  assert.equal((h.match(/class="col md"/g) || []).length, 2);
  assert.match(h, /<h1>標題<\/h1>/);
});

test('各版型都能輸出且帶 l-<版型> class', () => {
  for (const l of ['text', 'center', 'quote', 'number', 'agenda', 'end', 'title', 'section', 'split', 'full']) {
    assert.match(render(l, '# x\n- y'), new RegExp(`class="slide l-${l}`));
  }
});

import { scanLibrary } from '../app/core/library.js';
import { memorySource } from './helpers.mjs';

test('brand:頁尾文字、標誌與字型', () => {
  const d = { ...deck, brand: { logo: 'media/logo.svg', footer: 'ACME · 內部', fontDisplay: '"Inter"', fontBody: '' } };
  const h = renderSlide({ layout: 'text', body: '# x', meta: {}, media: [], file: 'p/01-s/a.md', sec: 0, i: 0 }, { deck: d, mode: 'thumb', globalIndex: 0, total: 1 });
  assert.match(h, /<span class="foot-brand"><img class="logo" data-media="p\/media\/logo\.svg" alt="">ACME · 內部<\/span>/);
  assert.match(h, /--brand-display:&quot;Inter&quot;,/);
  assert.ok(!h.includes('--brand-body'));
});

test('brand:不合法的字型名稱會回報並忽略', async () => {
  const src = memorySource({ 'deck.yml': 'title: X\nbrand:\n  font_display: "x;}body{background:url(//evil)"\n  font_body: Inter, Noto Sans TC', '01-a/a.md': '# a' });
  const lib = await scanLibrary(src);
  const b = lib.topics[0].projects[0].brand;
  assert.equal(b.fontDisplay, '');
  assert.equal(b.fontBody, '"Inter", "Noto Sans TC"');
  assert.equal(lib.issues.length, 1);
});

test('size: compact:每張、整份與 normal 取消', () => {
  const deck = { path: 'd', title: 'T', sections: [{ title: 'S', color: '#4f73a6' }] };
  const one = (meta, d = deck, layout = 'text') => renderSlide({ layout, meta, body: '# A', media: [], sec: 0, title: 'A' }, { deck: d, mode: 'full', globalIndex: 0, total: 1 });
  assert.match(one({ size: 'compact' }), /class="slide l-text compact"/);
  assert.doesNotMatch(one({}), /compact/);
  assert.match(one({}, { ...deck, size: 'compact' }), /compact/, 'deck.yml 的 size 整份套用');
  assert.doesNotMatch(one({ size: 'normal' }, { ...deck, size: 'compact' }), /compact/, 'size: normal 取消整份的設定');
  assert.doesNotMatch(one({ size: 'compact' }, deck, 'section'), /compact/, '章節頁不縮');
});
