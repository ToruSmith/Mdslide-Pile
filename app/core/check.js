// 檢查書庫或單份簡報是否符合規則。網站的「檢查」按鈕、scripts/check.mjs、
// 書庫裡的單檔版 mdslide-check.mjs 都用這一份,規則只在這裡維護。
// 只使用資料來源介面(list / readText),瀏覽器與 Node 都能跑。

import { scanLibrary, loadDeck } from './library.js';
import { resolveMediaPath } from './media.js';
import { parseChartTable } from './chart.js';

export const MAX_SLIDES = 45;

/** 檔案是否存在:列出上一層資料夾來確認(本機來源會快取清單,不會重複讀)。 */
async function exists(source, path) {
  const i = path.lastIndexOf('/');
  try {
    const entries = await source.list(i < 0 ? '' : path.slice(0, i));
    return entries.some(e => e.name === path.slice(i + 1) && e.kind === 'file');
  } catch { return false; }
}

/**
 * 檢查一份簡報。
 * @returns {{ title, date, hasConfig, total, noted, layouts: string[], sections: {title, count}[], slides: {layout, title, notes: boolean, auto: boolean}[], problems: {path, message}[] }}
 */
export async function checkDeck(source, project) {
  const deck = await loadDeck(source, project);
  const problems = [...deck.issues];
  const all = deck.sections.flatMap(s => s.slides);

  for (const sl of all) {
    if (sl.layout === 'chart') {
      const t = parseChartTable(sl.body);
      if (!t) problems.push({ path: sl.file, message: 'chart 版型找不到表格' });
      else for (const b of t.bad) problems.push({ path: sl.file, message: `圖表第 ${b.row} 列第 ${b.col} 欄「${b.text}」不是數字,會顯示為空白` });
    }
    for (const m of sl.media) {
      if (m.remote) continue;
      const path = resolveMediaPath(m.src, { projectPath: project.path, filePath: sl.file });
      if (!(await exists(source, path))) problems.push({ path: sl.file, message: `找不到素材 ${m.src}(實際路徑 ${path || '(簡報資料夾)'})` });
    }
    const bg = sl.meta?.background;
    if (bg && !/^(https?:|data:)/.test(String(bg))) {
      const path = resolveMediaPath(String(bg), { projectPath: project.path, filePath: sl.file });
      if (!(await exists(source, path))) problems.push({ path: sl.file, message: `找不到背景圖 ${bg}` });
    }
  }
  if (project.coverImage && !(await exists(source, resolveMediaPath(project.coverImage, { projectPath: project.path, filePath: project.path + '/deck.yml' })))) {
    problems.push({ path: project.path || '(簡報資料夾)', message: `找不到 cover_image ${project.coverImage}` });
  }
  if (all.length > MAX_SLIDES) problems.push({ path: project.path || '(簡報資料夾)', message: `共 ${all.length} 張,25–30 分鐘的報告建議 20–30 張` });

  return {
    title: deck.title,
    date: deck.date,
    hasConfig: project.hasConfig,
    total: all.length,
    noted: all.filter(s => s.notes).length,
    layouts: [...new Set(all.map(s => s.layout))],
    sections: deck.sections.map(s => ({ title: s.title || '(開場)', count: s.slides.length })),
    slides: all.map(s => ({ layout: s.layout, title: s.title, notes: !!s.notes, auto: !!s.auto })),
    problems,
  };
}

/**
 * 檢查整個資料夾(書庫、主題或單份簡報都可以)。
 * @param {(done: number, total: number, title: string) => void} [onProgress]
 */
export async function checkLibrary(source, onProgress) {
  const lib = await scanLibrary(source);
  const total = lib.topics.reduce((n, t) => n + t.projects.length, 0);
  let done = 0;
  const topics = [];
  for (const t of lib.topics) {
    const decks = [];
    for (const p of t.projects) {
      onProgress?.(done, total, p.title);
      try { decks.push({ id: p.id, ...(await checkDeck(source, p)) }); }
      catch (e) { decks.push({ id: p.id, title: p.title, total: 0, noted: 0, layouts: [], sections: [], slides: [], problems: [{ path: p.path, message: `無法讀取:${e.message || e}` }] }); }
      done++;
    }
    topics.push({ id: t.id, title: t.title, decks });
  }
  onProgress?.(done, total, '');
  const problems = [...lib.issues, ...topics.flatMap(t => t.decks.flatMap(d => d.problems))];
  return { kind: lib.kind, title: lib.title, topics, problems };
}

const KIND = { library: '書庫', topic: '主題', deck: '單一簡報' };

/** 把檢查結果排成純文字報告(給命令列用)。 */
export function formatReport(report, { verbose = false } = {}) {
  const out = [`📚 ${report.title}(偵測為:${KIND[report.kind] || report.kind})`];
  for (const t of report.topics) {
    if (report.kind === 'library') out.push('', `▸ 主題:${t.title}`);
    if (!t.decks.length) out.push('  (還沒有簡報)');
    for (const d of t.decks) {
      out.push(`  ▪ ${d.title}${d.date ? `(${d.date})` : ''}— ${d.sections.length} 章、${d.total} 張、${d.layouts.length} 種版型、備註 ${d.noted}/${d.total}${d.hasConfig === false ? '、沒有 deck.yml' : ''}`);
      if (!verbose) continue;
      let k = 0;
      for (const s of d.sections) {
        out.push(`      ${s.title}:${s.count} 張`);
        for (const sl of d.slides.slice(k, k + s.count)) out.push(`        - [${sl.layout}] ${sl.title || '(無標題)'}${sl.notes ? '  📝' : ''}${sl.auto ? '  (自動)' : ''}`);
        k += s.count;
      }
    }
  }
  if (report.problems.length) {
    out.push('', `⚠ ${report.problems.length} 個問題:`);
    for (const i of report.problems) out.push(`  - ${i.path}:${i.message}`);
  } else {
    out.push('', '✓ 沒有發現問題');
  }
  return out.join('\n');
}
