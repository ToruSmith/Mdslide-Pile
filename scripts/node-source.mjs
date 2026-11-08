// Node 版資料來源:讓建置腳本與檢查工具使用和瀏覽器完全相同的解析器(app/core)。

import { readdir, readFile } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';

export function nodeSource(root) {
  const abs = resolve(root);
  return {
    label: basename(abs),
    root: abs,
    async list(path) {
      const entries = await readdir(join(abs, path), { withFileTypes: true });
      return entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({ name: e.name, kind: e.isDirectory() ? 'dir' : 'file' }));
    },
    async readText(path) { return readFile(join(abs, path), 'utf8'); },
    async mediaURL(path) { return path; },
  };
}

/** 走訪整棵樹,回傳 { 路徑: 清單 }(給 catalog.json 用)。 */
export async function walkTree(source, path = '', tree = {}) {
  const entries = await source.list(path);
  tree[path] = entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) if (e.kind === 'dir') await walkTree(source, path ? `${path}/${e.name}` : e.name, tree);
  return tree;
}
