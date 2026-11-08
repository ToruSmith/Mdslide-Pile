// 資料來源:把「倉庫裡的檔案」與「使用者電腦裡的資料夾」包成同一個介面。
//
// 介面(core/library.js 只認這四個):
//   label                 顯示名稱
//   list(path)            → [{ name, kind: 'file'|'dir' }]
//   readText(path)        → string
//   mediaURL(path)        → 可放進 <img>/<video> 的網址
//   releaseMedia()        釋放 mediaURL 產生的暫存網址(離開簡報時呼叫)
//
// 本機來源讀到的清單都會快取:同一個資料夾只列一次,減少隨身碟讀取。

const enc = p => p.split('/').map(encodeURIComponent).join('/');
import { t } from '../core/i18n.js';

/** 倉庫模式:讀 GitHub Pages 上的 content/,目錄清單來自建置時產生的 catalog.json。 */
export class HttpSource {
  constructor(base, catalog) {
    this.kind = 'repo';
    this.base = base.replace(/\/?$/, '/');
    this.tree = catalog.tree;
    this.label = catalog.title || t('source.repoLabel');
  }
  static async open(base = 'content/', catalogURL = 'catalog.json') {
    const res = await fetch(catalogURL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(t('source.noCatalog'));
    return new HttpSource(base, await res.json());
  }
  async list(path) {
    const entries = this.tree[path];
    if (!entries) throw new Error('not found: ' + path);
    return entries;
  }
  async readText(path) {
    const i = path.lastIndexOf('/');
    const dir = this.tree[i < 0 ? '' : path.slice(0, i)];
    if (!dir || !dir.some(e => e.name === path.slice(i + 1))) throw new Error('not found: ' + path); // 不存在就不發請求
    const res = await fetch(this.base + enc(path));
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.text();
  }
  async mediaURL(path) { return this.base + enc(path); }
  releaseMedia() {}
}

/** 本機模式(Chrome / Edge):FileSystemDirectoryHandle,可以記住並在下次重新連線。 */
export class HandleSource {
  constructor(handle, id = null) {
    this.kind = 'handle';
    this.handle = handle;
    this.id = id;
    this.label = handle.name;
    this.dirCache = new Map([['', handle]]);
    this.listCache = new Map();
    this.urls = new Map();
  }
  async dir(path) {
    if (this.dirCache.has(path)) return this.dirCache.get(path);
    const i = path.lastIndexOf('/');
    const parent = await this.dir(i < 0 ? '' : path.slice(0, i));
    const h = await parent.getDirectoryHandle(path.slice(i + 1));
    this.dirCache.set(path, h);
    return h;
  }
  async list(path) {
    if (this.listCache.has(path)) return this.listCache.get(path);
    const d = await this.dir(path);
    const out = [];
    for await (const [name, h] of d.entries()) {
      out.push({ name, kind: h.kind === 'directory' ? 'dir' : 'file' });
      if (h.kind === 'directory') this.dirCache.set(path ? `${path}/${name}` : name, h);
    }
    this.listCache.set(path, out);
    return out;
  }
  async file(path) {
    const i = path.lastIndexOf('/');
    const d = await this.dir(i < 0 ? '' : path.slice(0, i));
    return (await d.getFileHandle(path.slice(i + 1))).getFile();
  }
  async readText(path) { return (await this.file(path)).text(); }
  async mediaURL(path) {
    if (!this.urls.has(path)) this.urls.set(path, this.file(path).then(f => URL.createObjectURL(f)));
    return this.urls.get(path);
  }
  releaseMedia() {
    for (const p of this.urls.values()) p.then(u => URL.revokeObjectURL(u), () => {});
    this.urls.clear();
  }
  /** 重新整理:清掉快取,下次會重新讀資料夾。 */
  refresh() { this.listCache.clear(); this.dirCache = new Map([['', this.handle]]); }
}

/** 本機模式(所有瀏覽器):<input webkitdirectory> 或拖放取得的檔案清單。只讀到檔名,內容等需要時才讀。 */
export class FileListSource {
  constructor(files, label) {
    this.kind = 'files';
    this.files = new Map();
    this.dirs = new Map([['', new Map()]]);
    this.urls = new Map();
    let root = label;
    for (const { file, path } of files) {
      const parts = path.split('/').filter(Boolean);
      if (!root) root = parts[0];
      if (parts[0] === root && parts.length > 1) parts.shift(); // 去掉最外層的資料夾名稱
      this.files.set(parts.join('/'), file);
      for (let i = 0; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/');
        if (!this.dirs.has(dir)) this.dirs.set(dir, new Map());
        this.dirs.get(dir).set(parts[i], i === parts.length - 1 ? 'file' : 'dir');
      }
    }
    this.label = root || t('source.localLabel');
  }
  static fromInput(fileList) {
    return new FileListSource([...fileList].map(f => ({ file: f, path: f.webkitRelativePath || f.name })));
  }
  async list(path) {
    const d = this.dirs.get(path);
    if (!d) throw new Error('not found: ' + path);
    return [...d].map(([name, kind]) => ({ name, kind }));
  }
  async readText(path) {
    const f = this.files.get(path);
    if (!f) throw new Error('not found: ' + path);
    return f.text();
  }
  async mediaURL(path) {
    if (!this.urls.has(path)) {
      const f = this.files.get(path);
      if (!f) throw new Error('not found: ' + path);
      this.urls.set(path, URL.createObjectURL(f));
    }
    return this.urls.get(path);
  }
  releaseMedia() { for (const u of this.urls.values()) URL.revokeObjectURL(u); this.urls.clear(); }
}

/** 拖放:Chrome/Edge 優先拿到可記住的 handle;其他瀏覽器逐層走訪(只讀檔名)。 */
export async function sourceFromDrop(dataTransfer) {
  const item = [...dataTransfer.items].find(i => i.kind === 'file');
  if (!item) return null;
  if (item.getAsFileSystemHandle) {
    const h = await item.getAsFileSystemHandle();
    if (h && h.kind === 'directory') return new HandleSource(h);
  }
  const entry = item.webkitGetAsEntry?.();
  if (!entry || !entry.isDirectory) return null;
  const files = [];
  const readAll = reader => new Promise((res, rej) => {
    const out = [];
    const step = () => reader.readEntries(batch => batch.length ? (out.push(...batch), step()) : res(out), rej);
    step();
  });
  const walk = async (dir, prefix) => {
    for (const e of await readAll(dir.createReader())) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      if (e.isDirectory) await walk(e, `${prefix}/${e.name}`);
      else files.push({ file: await new Promise((res, rej) => e.file(res, rej)), path: `${prefix}/${e.name}` });
    }
  };
  await walk(entry, entry.name);
  return new FileListSource(files, entry.name);
}

export const canPickDirectory = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;
