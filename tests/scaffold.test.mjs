// scripts/new-deck.mjs:產生的骨架要能通過檢查,也不能覆蓋既有資料夾。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/new-deck.mjs', import.meta.url));
const run = (...args) => execFileSync(process.execPath, [script, ...args, '--lang', 'en'], { encoding: 'utf8' });

for (const [name, lang, first] of [['2026-11-季報', 'zh-Hant', '01-開場'], ['03-Team-update', 'en', '01-Opening']]) {
  test(`new-deck:${lang} 骨架通過檢查`, async () => {
    const dir = join(await mkdtemp(join(tmpdir(), 'mdslide-')), name);
    const out = run(dir);
    assert.match(out, /No problems found/);
    assert.match(await readFile(join(dir, 'deck.yml'), 'utf8'), new RegExp(`lang: ${lang}`));
    assert.ok((await readdir(dir)).includes(first));
  });
}

test('new-deck:資料夾已有檔案就停止', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mdslide-'));
  await mkdir(join(dir, 'x'));
  await writeFile(join(dir, 'x', 'a.md'), '# keep');
  assert.throws(() => run(join(dir, 'x')));
  assert.equal(await readFile(join(dir, 'x', 'a.md'), 'utf8'), '# keep');
});

test('build-starter:範例書庫含檢查工具、不含官方範例,且通過檢查', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const out = join(await mkdtemp(join(tmpdir(), 'mdslide-')), 'lib');
  execFileSync(process.execPath, ['scripts/build-starter.mjs', out], { cwd: root });
  const names = await readdir(out);
  for (const n of ['README.md', '_site.yml', 'mdslide-check.mjs']) assert.ok(names.includes(n), n);
  assert.ok(!names.some(n => n.startsWith('00-')));
  const report = execFileSync(process.execPath, [join(out, 'mdslide-check.mjs'), out, '--lang', 'en'], { encoding: 'utf8' });
  assert.match(report, /No problems found/);
});
