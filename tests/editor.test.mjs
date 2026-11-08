// 編輯模式的純邏輯:分段、下一個檔名、換掉備註。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentRanges, nextName, replaceNotes } from '../app/player/editor.js';
import { parseSlideFile } from '../app/core/slide.js';

test('segmentRanges:和投影片的切法一致(程式碼區塊裡的 --- 不算)', () => {
  const text = '# A\n\n---\n\n# B\n\n```\n---\n```\n\n---\n\n# C';
  const ranges = segmentRanges(text);
  assert.equal(ranges.length, parseSlideFile(text, { path: 'x.md' }).slides.length);
  assert.equal(ranges.length, 3);
  for (const r of ranges) assert.ok(r.from <= r.to && r.to <= text.length);
  assert.match(text.slice(ranges[0].from, ranges[0].to), /^# A/);
  assert.match(text.slice(ranges[2].from, ranges[2].to), /# C$/);
  // front matter 也不能被當成分隔
  const fm = '---\nlayout: center\n---\n# One';
  assert.equal(segmentRanges(fm).length, 1);
});

test('nextName:接續現有編號', () => {
  assert.equal(nextName(['01-a.md', '02-b.md'], '新的一張'), '03-新的一張.md');
  assert.equal(nextName([], ''), '01-slide.md');
  assert.equal(nextName(['09-x.md'], 'x'), '10-x.md');
  assert.doesNotMatch(nextName([], 'a/b:c*?'), /[\\/:*?"<>|]/, '檔名不能有危險字元');
});

test('replaceNotes:只動指定那一段的備註,內容不受影響', () => {
  const text = '# A\n\n- x\n\nNote:\n舊備註\n\n---\n\n# B\n';
  const out = replaceNotes(text, 0, '新備註');
  assert.match(out, /# A/); assert.match(out, /- x/); assert.match(out, /新備註/);
  assert.doesNotMatch(out, /舊備註/);
  assert.equal(parseSlideFile(out, { path: 'x.md' }).slides.length, 2, '張數不能變');
  assert.equal(parseSlideFile(out, { path: 'x.md' }).slides[0].notes, '新備註');
  assert.equal(parseSlideFile(out, { path: 'x.md' }).slides[1].title, 'B', '另一段不能被動到');
  // 原本沒有備註 → 加上;清空 → 移除
  const added = replaceNotes('# A\n', 0, '來一句');
  assert.equal(parseSlideFile(added, { path: 'x.md' }).slides[0].notes, '來一句');
  const removed = replaceNotes(added, 0, '  ');
  assert.ok(!parseSlideFile(removed, { path: 'x.md' }).slides[0].notes);
  // 第二段
  const second = replaceNotes(text, 1, 'B 的備註');
  assert.equal(parseSlideFile(second, { path: 'x.md' }).slides[0].notes, '舊備註');
  assert.equal(parseSlideFile(second, { path: 'x.md' }).slides[1].notes, 'B 的備註');
});
