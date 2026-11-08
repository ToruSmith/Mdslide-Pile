#!/usr/bin/env node
// Mdslide Pile 書庫檢查工具(單檔版 v1.2.0)
// 由 scripts/bundle-check.mjs 自動產生,請不要手動修改。原始碼:https://github.com/ToruSmith/Mdslide-Pile
//
// 用法(需要 Node.js 18 以上):
//   node mdslide-check.mjs                 檢查這個檔案所在的資料夾(放在書庫根目錄時 = 整個書庫)
//   node mdslide-check.mjs <資料夾>         檢查指定的書庫、主題或單一簡報
//   node mdslide-check.mjs <資料夾> --slides 連每張投影片都列出來
// Windows 也可以直接雙擊「檢查書庫.cmd」,Mac 雙擊「檢查書庫.command」。

import * as fsp from 'node:fs/promises';
import * as nodePath from 'node:path';
import { fileURLToPath as __toPath } from 'node:url';

// ───────── app/core/yaml.js ─────────
// 精簡 YAML 解析器:只支援設定檔需要的子集,零依賴。
//
// 支援:
//   key: value            字串、數字、布林、null、引號字串
//   巢狀物件              以縮排表示
//   - item / - key: v     清單與「物件清單」
//   [a, b, c]             行內陣列
//   key: |                多行文字(保留換行);> 會把換行併成空白
//   # 註解
// 不支援:錨點、標籤、多文件、行內物件 {}。
// 解析失敗時丟出 YamlError(含行號),呼叫端負責轉成使用者看得懂的提示。

class YamlError extends Error {
  constructor(message, line) {
    super(line ? `第 ${line} 行:${message}` : message);
    this.line = line;
  }
}

function parseYaml(text) {
  const lines = [];
  text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    const stripped = stripComment(raw);
    if (!stripped.trim()) { lines.push({ blank: true, raw, no: i + 1 }); return; }
    if (/^\t/.test(raw)) throw new YamlError('請用空白縮排,不要用 Tab', i + 1);
    lines.push({ indent: stripped.match(/^ */)[0].length, text: stripped.trim(), raw, no: i + 1 });
  });
  const state = { lines, i: 0 };
  skipBlank(state);
  if (state.i >= lines.length) return {};
  const value = parseBlock(state, lines[state.i].indent);
  skipBlank(state);
  if (state.i < lines.length) throw new YamlError('縮排不一致', lines[state.i].no);
  return value;
}

function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).replace(/\s+$/, '');
  }
  return line.replace(/\s+$/, '');
}

function skipBlank(s) { while (s.i < s.lines.length && s.lines[s.i].blank) s.i++; }

function parseBlock(s, indent) {
  skipBlank(s);
  const first = s.lines[s.i];
  return first.text.startsWith('- ') || first.text === '-' ? parseList(s, indent) : parseMap(s, indent);
}

function parseMap(s, indent) {
  const obj = {};
  while (true) {
    skipBlank(s);
    const ln = s.lines[s.i];
    if (!ln || ln.indent < indent) break;
    if (ln.indent > indent) throw new YamlError('縮排過多', ln.no);
    if (ln.text.startsWith('- ')) throw new YamlError('這裡應該是「名稱: 值」,不是清單', ln.no);
    const m = ln.text.match(/^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*))?$/);
    if (!m) throw new YamlError(`看不懂「${ln.text}」,格式應為「名稱: 值」`, ln.no);
    const key = unquote(m[1]);
    const rest = m[2] ?? '';
    s.i++;
    obj[key] = parseValueAfterKey(s, indent, rest, ln.no);
  }
  return obj;
}

function parseList(s, indent) {
  const arr = [];
  while (true) {
    skipBlank(s);
    const ln = s.lines[s.i];
    if (!ln || ln.indent < indent) break;
    if (ln.indent > indent) throw new YamlError('縮排過多', ln.no);
    if (!(ln.text.startsWith('- ') || ln.text === '-')) break;
    const rest = ln.text === '-' ? '' : ln.text.slice(2).trim();
    if (!rest) { s.i++; skipBlank(s); arr.push(s.lines[s.i] && s.lines[s.i].indent > indent ? parseBlock(s, s.lines[s.i].indent) : null); continue; }
    // 「- key: value」才算物件;「- https://x」這種冒號後面沒有空白的不算
    if (/^("[^"]*"|'[^']*'|[^"'\[\s][^:]*?)\s*:(\s|$)/.test(rest)) {
      // 物件清單:把「- 」後面當成縮排 +2 的物件第一行
      const childIndent = ln.indent + 2;
      s.lines[s.i] = { ...ln, indent: childIndent, text: rest };
      arr.push(parseMap(s, childIndent));
    } else {
      s.i++;
      arr.push(scalar(rest, ln.no));
    }
  }
  return arr;
}

function parseValueAfterKey(s, indent, rest, no) {
  if (rest === '|' || rest === '|-' || rest === '>' || rest === '>-') return blockScalar(s, indent, rest[0] === '>');
  if (rest !== '') return scalar(rest, no);
  skipBlank(s);
  const next = s.lines[s.i];
  if (next && next.indent > indent) return parseBlock(s, next.indent);
  if (next && next.indent === indent && next.text.startsWith('- ')) return parseList(s, indent);
  return null;
}

function blockScalar(s, indent, fold) {
  const out = [];
  let base = null;
  while (s.i < s.lines.length) {
    const ln = s.lines[s.i];
    if (ln.blank) { out.push(''); s.i++; continue; }
    if (ln.indent <= indent) break;
    if (base == null) base = ln.indent;
    out.push(ln.raw.slice(base));
    s.i++;
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return fold ? out.join('\n').replace(/([^\n])\n(?!\n)/g, '$1 ') : out.join('\n');
}

function unquote(t) {
  t = t.trim();
  if (t.length >= 2 && t[0] === '"' && t.at(-1) === '"') return t.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
  if (t.length >= 2 && t[0] === "'" && t.at(-1) === "'") return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

function scalar(t, no) {
  t = t.trim();
  if (t.startsWith('[')) {
    if (!t.endsWith(']')) throw new YamlError('行內陣列缺少 ]', no);
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map(x => scalar(x, no));
  }
  if (/^["']/.test(t)) return unquote(t);
  if (/^(true|yes|on)$/i.test(t)) return true;
  if (/^(false|no|off)$/i.test(t)) return false;
  if (/^(null|~)$/i.test(t)) return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function splitTopLevel(s) {
  const out = []; let cur = '', q = null, depth = 0;
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[') depth++;
    if (c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ───────── app/core/names.js ─────────
// 檔名與路徑的共用規則。瀏覽器與 Node 腳本都會用到,請保持零依賴。

/** 以 `/` 串接路徑片段,忽略空字串。 */
function join(...parts) {
  return parts.filter(p => p !== '' && p != null).join('/').replace(/\/+/g, '/');
}

/** 取得副檔名(小寫、不含點)。 */
function ext(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** 底線或點開頭 = 草稿或系統檔,解析時略過(設定檔另外處理)。 */
function isHidden(name) {
  return name.startsWith('.') || name.startsWith('_');
}

/** 保留名稱:這些資料夾只放素材,不會被當成章節。 */
const RESERVED_DIRS = new Set(['media', 'assets', 'images', 'img', 'video', 'videos', 'node_modules']);

/** 不當成投影片的 MD 檔(說明文件)。 */
function isDocFile(name) {
  return /^(readme|agents|claude|license|changelog)(\..*)?$/i.test(name);
}

function isMarkdown(name) {
  return ext(name) === 'md' && !isHidden(name) && !isDocFile(name);
}

/**
 * 拆出排序前綴:`01-問題` → { order: 1, label: '問題' }。
 * 沒有前綴時 order 為 null,label 為原名(去掉副檔名)。
 */
function splitOrder(name) {
  const base = name.replace(/\.(md|ya?ml)$/i, '');
  // 日期前綴 `2026-11-筆記`、`2026-11-20 讀書會`:不是排序數字,而是日期
  const d = base.match(/^(\d{4}-\d{2}(?:-\d{2})?)[\s._-]+(.+)$/);
  if (d) return { order: null, date: d[1], label: d[2].trim() };
  const m = base.match(/^(\d+)[\s._-]+(.+)$/);
  return m ? { order: Number(m[1]), label: m[2].trim() } : { order: null, label: base };
}

/** 依前綴數字排序,沒有前綴的依名稱排在後面。 */
function byOrder(a, b) {
  const A = splitOrder(a.name), B = splitOrder(b.name);
  if (A.order != null && B.order != null && A.order !== B.order) return A.order - B.order;
  if (A.order != null && B.order == null) return -1;
  if (A.order == null && B.order != null) return 1;
  return a.name.localeCompare(b.name, 'zh-Hant', { numeric: true });
}

/** 連結是否為外部網址。 */
function isURL(s) {
  return /^(https?:)?\/\//i.test(s) || /^data:/i.test(s);
}

// ───────── app/core/media.js ─────────
// 判斷媒體類型:本機圖片 / 本機影片 / 線上嵌入(YouTube、Bilibili、Google Drive、Vimeo)。


const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp']);
const VIDEO = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);

/**
 * @returns {{ kind: 'image'|'video'|'audio'|'embed'|'unknown', src: string, provider?: string, embed?: string, thumb?: string, remote: boolean }}
 */
function classifyMedia(src) {
  const s = src.trim();
  const remote = isURL(s);
  if (remote) {
    let m;
    if ((m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/))) {
      const t = s.match(/[?&](?:t|start)=(\d+)/);
      return { kind: 'embed', src: s, remote, provider: 'YouTube',
        embed: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&playsinline=1${t ? `&start=${t[1]}` : ''}`,
        thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
    }
    if ((m = s.match(/bilibili\.com\/video\/(BV[\w]+|av\d+)/i)) || (m = s.match(/b23\.tv\/(BV[\w]+)/i))) {
      const id = m[1];
      const q = id.startsWith('av') ? `aid=${id.slice(2)}` : `bvid=${id}`;
      const p = s.match(/[?&]p=(\d+)/);
      return { kind: 'embed', src: s, remote, provider: 'Bilibili',
        embed: `https://player.bilibili.com/player.html?${q}&page=${p ? p[1] : 1}&autoplay=0&high_quality=1` };
    }
    if ((m = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/))) {
      return { kind: 'embed', src: s, remote, provider: 'Google Drive', embed: `https://drive.google.com/file/d/${m[1]}/preview` };
    }
    if ((m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
      return { kind: 'embed', src: s, remote, provider: 'Vimeo', embed: `https://player.vimeo.com/video/${m[1]}` };
    }
  }
  const e = ext(s.split(/[?#]/)[0]);
  if (IMAGE.has(e)) return { kind: 'image', src: s, remote };
  if (VIDEO.has(e)) return { kind: 'video', src: s, remote };
  if (AUDIO.has(e)) return { kind: 'audio', src: s, remote };
  if (/^data:image\//.test(s)) return { kind: 'image', src: s, remote: true };
  return { kind: remote ? 'image' : 'unknown', src: s, remote };
}

/**
 * 素材路徑規則:
 *   media/a.jpg   → 相對於「簡報資料夾」(建議寫法,任何章節都通用)
 *   ./a.jpg       → 相對於這個 MD 檔所在的資料夾
 *   ../x/a.jpg    → 同上,可往上
 *   /a.jpg        → 相對於簡報資料夾
 */
function resolveMediaPath(src, { projectPath, filePath }) {
  if (isURL(src)) return src;
  const parts = [];
  let rel = src;
  if (rel.startsWith('./') || rel.startsWith('../')) {
    parts.push(...filePath.split('/').slice(0, -1));
  } else {
    parts.push(...projectPath.split('/').filter(Boolean));
    rel = rel.replace(/^\/+/, '');
  }
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return parts.join('/');
}

// ───────── app/core/color.js ─────────
// 顏色值白名單。設定檔與投影片裡的顏色會直接放進 style 屬性,
// 只接受下列格式,避免 `red;background:url(...)` 這類內容注入樣式。
//   #rgb  #rrggbb  #rrggbbaa   rgb()/rgba()/hsl()/hsla()(只含數字)   英文顏色名稱(red、teal…)

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(?:rgb|rgba|hsl|hsla)\(\s*[\d.\s,/%+-]+(?:deg)?[\d.\s,/%+-]*\)$/i;
const NAMED = /^[a-z]{3,24}$/i;

/** 合法就回傳整理過的顏色字串,否則回傳 null。 */
function safeColor(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v || v.length > 64) return null;
  return HEX.test(v) || FUNC.test(v) || NAMED.test(v) ? v : null;
}

// ───────── app/core/slide.js ─────────
// 把一個 MD 檔解析成一張或多張投影片的資料(還不是 HTML)。




/** 所有支援的版型。新增版型時,記得同步更新 製作專案指南.md 與 app/player/render.js。 */
const LAYOUTS = ['auto', 'text', 'center', 'split', 'split-left', 'full', 'quote', 'number', 'stats', 'timeline', 'columns', 'agenda', 'chart', 'title', 'section', 'end'];

const MEDIA_LINE = /^\s*!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)\s*$/;
const NOTE_LINE = /^\s*(?:note|notes|備註|講者備註)\s*[:：]\s*(.*)$/i;
const META_LINE = /^\s*<!--\s*([\w-]+)\s*:\s*(.*?)\s*-->\s*$/;

/**
 * @param {string} text 檔案內容
 * @param {{ path: string }} info
 * @returns {{ slides: object[], issues: {path:string, message:string}[] }}
 */
function parseSlideFile(text, { path }) {
  const issues = [];
  let src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let fileMeta = {};

  // 檔案開頭的 front matter
  const fm = src.match(/^---\n([\s\S]*?)\n---[ \t]*(\n|$)/);
  if (fm) {
    try { fileMeta = parseYaml(fm[1]) || {}; }
    catch (e) { issues.push({ path, message: `開頭設定(front matter)${e instanceof YamlError ? e.message : '無法解析'}` }); }
    src = src.slice(fm[0].length);
  }

  const segments = splitSegments(src);
  const slides = [];
  segments.forEach((seg, index) => {
    if (!seg.trim() && segments.length > 1) return;
    slides.push(parseSegment(seg, { path, index, fileMeta, issues }));
  });
  if (!slides.length) slides.push(parseSegment('', { path, index: 0, fileMeta, issues }));
  return { slides, issues };
}

/** 依單獨一行的 `---` 切開(程式碼區塊裡的不算)。 */
function splitSegments(src) {
  const out = [[]];
  let fence = null;
  for (const line of src.split('\n')) {
    const f = line.match(/^\s*(```+|~~~+)/);
    if (f) fence = fence ? (line.trim().startsWith(fence) ? null : fence) : f[1];
    if (!fence && /^---\s*$/.test(line)) { out.push([]); continue; }
    out.at(-1).push(line);
  }
  return out.map(l => l.join('\n'));
}

function parseSegment(seg, { path, index, fileMeta, issues }) {
  const meta = { ...fileMeta };
  let lines = seg.split('\n');

  // 段落開頭的 <!-- key: value --> 設定(只影響這一張)
  while (lines.length && (lines[0].trim() === '' || META_LINE.test(lines[0]))) {
    const m = lines[0].match(META_LINE);
    if (m) meta[m[1]] = coerce(m[2]);
    lines.shift();
  }

  // 講者備註
  let notes = '';
  const n = lines.findIndex(l => NOTE_LINE.test(l));
  if (n >= 0) {
    const first = lines[n].match(NOTE_LINE)[1];
    notes = [first, ...lines.slice(n + 1)].join('\n').trim();
    lines = lines.slice(0, n);
  }

  // 單獨一行的圖片 / 影片 = 這張投影片的主要媒體
  const media = [];
  let fence = false;
  const bodyLines = [];
  for (const l of lines) {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    const m = !fence && l.match(MEDIA_LINE);
    if (m) media.push({ alt: m[1], caption: m[3] || m[1], ...classifyMedia(m[2]) });
    else bodyLines.push(l);
  }
  const body = bodyLines.join('\n').replace(/^\n+|\n+$/g, '');

  if (meta.color != null && !safeColor(meta.color)) {
    issues.push({ path, message: `顏色「${meta.color}」格式不正確,已改用章節顏色` });
    delete meta.color;
  }

  let layout = String(meta.layout || 'auto').toLowerCase();
  if (!LAYOUTS.includes(layout)) {
    issues.push({ path, message: `未知的版型「${layout}」,改用自動判斷。可用:${LAYOUTS.join(', ')}` });
    layout = 'auto';
  }
  if (layout === 'auto') layout = autoLayout(body, media);

  const heading = body.match(/^#{1,3}\s+(.+)$/m);
  const firstLine = body.split('\n').find(l => l.trim())?.replace(/^\s*(>|[-*+]|\d+[.)])\s*/, '').replace(/[*_`~=#]/g, '').trim() || '';
  const title = String(meta.title || (heading ? heading[1].replace(/[*_`~=]/g, '').trim() : (media[0]?.caption || firstLine.slice(0, 40))));

  return { file: path, index, meta, layout, body, notes, media, title };
}

function autoLayout(body, media) {
  const text = body.trim();
  if (media.length && !text) return 'full';
  if (media.length) return 'split';
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length && lines.every(l => /^\s*>/.test(l) || /^\s*(—|--|──)/.test(l))) return 'quote';
  const big = lines[0]?.match(/^##\s+(.+)$/);
  if (big && big[1].length <= 14 && lines.length <= 3) return 'number';
  return 'text';
}

function coerce(v) {
  if (/^(true|false)$/i.test(v)) return /^true$/i.test(v);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/^["']|["']$/g, '');
}

// ───────── app/core/library.js ─────────
// 書庫掃描:把「資料來源」轉成 書庫 → 主題 → 專案(簡報)→ 章節 → 投影片。
//
// 讀取分三層,只在需要時往下讀(本機資料可能在隨身碟上,越少讀越好):
//   1. scanLibrary()  只讀資料夾清單 + _site.yml / _topic.yml / deck.yml   → 目錄頁
//   2. loadCover()    進入畫面範圍的專案才讀:章節數、第一張投影片        → 封面卡片
//   3. loadDeck()     點進簡報才讀全部 MD                                 → 播放器
// 圖片與影片則由播放器在「快要看到時」才向來源要網址。
//
// 資料來源(source)只需要實作:
//   list(path)     → Promise<{ name, kind: 'file'|'dir' }[]>   path '' 代表根目錄
//   readText(path) → Promise<string>
//   mediaURL(path) → Promise<string>





const SCHEMA_VERSION = 1;
const PALETTE = ['#c0674a', '#5f8a64', '#4f73a6', '#b08a3a', '#8a5fa6', '#3f8f8f', '#b0566e', '#6b7a8f'];

const CONFIG = { site: '_site.yml', topic: '_topic.yml', deck: 'deck.yml' };

/** 同時最多幾個讀取,避免隨身碟或網路被塞爆。 */
function limiter(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}
const limit = limiter(6);

async function listSafe(source, path) {
  try { return await source.list(path); } catch { return []; }
}

async function readYaml(source, path, issues) {
  let text;
  try { text = await limit(() => source.readText(path)); } catch { return null; }
  try { return parseYaml(text) || {}; }
  catch (e) {
    issues.push({ path, message: e instanceof YamlError ? e.message : String(e.message || e) });
    return {};
  }
}

const has = (entries, name, kind = 'file') => entries.some(e => e.name === name && e.kind === kind);
const dirs = entries => entries.filter(e => e.kind === 'dir' && !isHidden(e.name) && !RESERVED_DIRS.has(e.name.toLowerCase())).sort(byOrder);
const mds = entries => entries.filter(e => e.kind === 'file' && isMarkdown(e.name)).sort(byOrder);

/**
 * 判斷使用者開啟的資料夾是哪一層。
 * 規則(依序):deck.yml → 簡報;_topic.yml → 主題;_site.yml → 書庫;
 * 根目錄直接有 MD → 簡報;子資料夾有 deck.yml → 主題;子資料夾有 _topic.yml → 書庫;
 * 子資料夾直接有 MD → 簡報(子資料夾是章節);孫資料夾有 deck.yml → 書庫;其他 → 書庫。
 */
async function detectRootKind(source) {
  const root = await source.list('');
  if (has(root, CONFIG.deck)) return 'deck';
  if (has(root, CONFIG.topic)) return 'topic';
  if (has(root, CONFIG.site)) return 'library';
  if (mds(root).length) return 'deck';
  const children = dirs(root).slice(0, 8);
  const lists = await Promise.all(children.map(d => listSafe(source, d.name)));
  if (lists.some(l => has(l, CONFIG.deck))) return 'topic';
  if (lists.some(l => has(l, CONFIG.topic))) return 'library';
  if (lists.some(l => mds(l).length)) return 'deck';
  return 'library';
}

/** 第 1 層:目錄。只讀資料夾清單與設定檔。 */
async function scanLibrary(source) {
  const issues = [];
  const kind = await detectRootKind(source);
  const rootEntries = await source.list('');
  const label = source.label || '書庫';

  if (kind === 'deck') {
    const project = await readProject(source, '', label, '_', issues);
    return finish({ kind, title: project.title, description: '', theme: project.theme, topics: [makeTopic('_', '', { name: label }, [project], 0)] });
  }
  if (kind === 'topic') {
    const conf = (await readYaml(source, CONFIG.topic, issues)) || {};
    const projects = await readProjects(source, '', rootEntries, conf, '_', issues);
    const topic = makeTopic('_', '', { name: label, ...conf, color: color(conf.color, null, CONFIG.topic, issues) }, projects, 0);
    return finish({ kind, title: topic.title, description: topic.description, theme: conf.theme, topics: [topic] });
  }

  const site = (await readYaml(source, CONFIG.site, issues)) || {};
  let topicDirs = dirs(rootEntries);
  topicDirs = applyOrder(topicDirs, site.topics);
  const topics = await Promise.all(topicDirs.map(async (d, i) => {
    const entries = await listSafe(source, d.name);
    const conf = (await readYaml(source, join(d.name, CONFIG.topic), issues)) || {};
    const projects = await readProjects(source, d.name, entries, conf, d.name, issues);
    return makeTopic(d.name, d.name, { ...conf, color: color(conf.color, null, join(d.name, CONFIG.topic), issues) }, projects, i);
  }));
  return finish({ kind, title: site.title || label, description: site.description || '', theme: site.theme, topics });

  function finish(lib) { return { ...lib, source: label, issues, scannedAt: Date.now() }; }
}

function applyOrder(list, order) {
  if (!Array.isArray(order) || !order.length) return list;
  const key = n => [n, splitOrder(n).label];
  const picked = [];
  for (const want of order.map(String)) {
    const hit = list.find(d => key(d.name).includes(want) && !picked.includes(d));
    if (hit) picked.push(hit);
  }
  return [...picked, ...list.filter(d => !picked.includes(d))];
}

function makeTopic(id, path, conf, projects, i) {
  const folder = path.split('/').pop() || conf.name || '';
  return {
    id, path,
    title: conf.name || conf.title || splitOrder(folder).label,
    description: conf.description || '',
    color: conf.color || PALETTE[i % PALETTE.length],
    projects,
  };
}

async function readProjects(source, topicPath, entries, topicConf, topicId, issues) {
  let list = dirs(entries);
  list = applyOrder(list, topicConf.order);
  const projects = await Promise.all(list.map(d => readProject(source, join(topicPath, d.name), d.name, topicId, issues)));
  if (!Array.isArray(topicConf.order)) {
    // 沒指定順序:有前綴的依前綴,其他依日期新到舊
    projects.sort((a, b) => {
      const A = splitOrder(a.folder).order, B = splitOrder(b.folder).order;
      if (A != null || B != null) return (A ?? 1e9) - (B ?? 1e9);
      return String(b.date || '').localeCompare(String(a.date || '')) || a.folder.localeCompare(b.folder, 'zh-Hant');
    });
  }
  return projects;
}

async function readProject(source, path, folder, topicId, issues) {
  const conf = (await readYaml(source, join(path, CONFIG.deck), issues)) || {};
  const label = splitOrder(folder).label;
  return {
    id: folder || '_', topicId, folder, path,
    hasConfig: Object.keys(conf).length > 0,
    title: str(conf.title) || label,
    subtitle: str(conf.subtitle),
    author: str(conf.author),
    date: conf.date != null ? String(conf.date) : (splitOrder(folder).date || ''),
    event: str(conf.event),
    tags: Array.isArray(conf.tags) ? conf.tags.map(String) : [],
    theme: str(conf.theme),
    accent: color(conf.accent, null, join(path, CONFIG.deck), issues) || safeColor(Array.isArray(conf.sections) && conf.sections[0]?.color) || '',
    coverImage: str(conf.cover_image || conf.coverImage),
    config: conf,
  };
}

const str = v => (v == null ? '' : String(v));

/** 設定檔裡的顏色:不合法就回報並改用預設值。 */
function color(value, fallback, path, issues) {
  if (value == null || value === '') return fallback;
  const c = safeColor(value);
  if (!c) issues.push({ path, message: `顏色「${value}」格式不正確,已改用預設顏色` });
  return c || fallback;
}

/** 第 2 層:封面。只列出專案資料夾,必要時讀第一張投影片。 */
async function loadCover(source, project) {
  const entries = await listSafe(source, project.path);
  const sectionDirs = dirs(entries);
  const info = { sections: sectionDirs.length || (mds(entries).length ? 1 : 0), firstSlide: null };
  if (project.hasConfig && project.config.title) return info; // 有標題就用自動產生的標題頁當封面,不必再讀
  let file = mds(entries)[0] && join(project.path, mds(entries)[0].name);
  if (!file && sectionDirs[0]) {
    const inner = await listSafe(source, join(project.path, sectionDirs[0].name));
    if (mds(inner)[0]) file = join(project.path, sectionDirs[0].name, mds(inner)[0].name);
  }
  if (file) {
    try { info.firstSlide = parseSlideFile(await limit(() => source.readText(file)), { path: file }).slides[0]; } catch { /* 封面讀不到就用預設 */ }
  }
  return info;
}

/** 第 3 層:整份簡報。 */
async function loadDeck(source, project) {
  const issues = [];
  const conf = project.config || {};
  const entries = await source.list(project.path);
  const confSections = Array.isArray(conf.sections) ? conf.sections.filter(s => s && typeof s === 'object') : [];

  // 章節順序一律依資料夾前綴;deck.yml 的 sections 只覆寫標題、顏色、隱藏等屬性
  const sectionDirs = dirs(entries);

  const sections = [];
  const rootFiles = mds(entries);
  if (rootFiles.length) sections.push({ folder: '', path: project.path, files: rootFiles.map(f => join(project.path, f.name)), intro: sectionDirs.length > 0 });
  await Promise.all(sectionDirs.map(async d => {
    const path = join(project.path, d.name);
    const files = mds(await source.list(path)).map(f => join(path, f.name));
    sections.push({ folder: d.name, path, files });
  }));
  const orderOf = s => s.folder === '' ? -1 : sectionDirs.findIndex(d => d.name === s.folder);
  sections.sort((a, b) => orderOf(a) - orderOf(b));

  const autoCovers = conf.section_covers !== false && conf.sectionCovers !== false;
  let colorIndex = 0;
  const built = [];
  for (const s of sections) {
    const c = confSections.find(x => x.folder === s.folder || x.folder === splitOrder(s.folder).label) || {};
    if (c.hidden) continue;
    const texts = await Promise.all(s.files.map(f => limit(() => source.readText(f)).then(t => [f, t], () => [f, null])));
    const slides = [];
    for (const [f, t] of texts) {
      if (t == null) { issues.push({ path: f, message: '讀取失敗' }); continue; }
      const r = parseSlideFile(t, { path: f });
      issues.push(...r.issues);
      slides.push(...r.slides.filter(sl => !sl.meta.hidden));
    }
    const title = c.title || (s.folder ? splitOrder(s.folder).label : '');
    const auto = s.folder ? PALETTE[colorIndex++ % PALETTE.length] : project.accent || PALETTE[PALETTE.length - 1];
    const secColor = color(c.color, auto, join(project.path, CONFIG.deck), issues);
    const section = { id: s.folder || '_intro', folder: s.folder, path: s.path, title, subtitle: str(c.subtitle), color: secColor, slides };
    if (autoCovers && s.folder && sections.filter(x => x.folder).length > 1 && c.cover !== false) {
      slides.unshift({ file: s.path, index: -1, meta: {}, layout: 'section', body: '', notes: str(c.notes), media: [], title, auto: true });
    }
    if (slides.length) built.push(section);
  }

  // 自動標題頁與結尾頁
  if (conf.cover !== false && conf.cover !== 'none') {
    // 標題頁放在第一個章節的最前面,不另外成一疊
    const titleSlide = { file: project.path, index: -1, meta: {}, layout: 'title', body: '', notes: str(conf.cover_notes), media: [], title: project.title, auto: true };
    if (built[0]) built[0].slides.unshift(titleSlide);
  }
  if (conf.end) {
    const last = built.at(-1);
    if (last) last.slides.push({ file: project.path, index: -1, meta: {}, layout: 'end', body: '', notes: str(conf.end_notes), media: [], title: String(conf.end), auto: true });
  }

  if (!built.some(s => s.slides.some(sl => !sl.auto))) issues.push({ path: project.path, message: '這個資料夾裡沒有找到任何投影片(.md 檔)' });
  if (conf.mdslide && Number(conf.mdslide) > SCHEMA_VERSION) issues.push({ path: join(project.path, CONFIG.deck), message: `此簡報需要較新版本的工具(mdslide: ${conf.mdslide})` });

  const layout = typeof conf.layout === 'object' && conf.layout ? conf.layout : { stage: conf.layout };
  return {
    ...project,
    sections: built,
    stage: str(layout.stage || layout.default || 'pile'),
    transition: str(layout.transition || 'shuffle'),
    issues,
  };
}

/** 給播放器用:把所有章節攤平成一個陣列,並標上章節索引。 */
function flatten(deck) {
  const out = [];
  deck.sections.forEach((sec, si) => sec.slides.forEach((s, i) => out.push({ ...s, sec: si, i, count: sec.slides.length })));
  return out;
}

// ───────── app/core/chart.js ─────────
// 圖表資料解析與座標軸級距。render.js(畫圖)與 check.js(檢查)共用,純函式、零依賴。

/**
 * 把表格裡的一格轉成數字。支援千分位、全形負號(−)、%、單位後綴(點、億、張…)與常見貨幣前綴。
 * 無法解析(空白、N/A、—、文字)時回傳 null。
 */
function parseNumber(cell) {
  let s = String(cell ?? '').trim();
  if (!s || /^(n\/?a|na|null|none|—|–|-|－|無|缺)$/i.test(s)) return null;
  s = s.replace(/^(NT\$|US\$|HK\$|NTD|USD|\$|¥|€|£)\s*/i, '');
  const m = s.match(/^([+\-−–－]?)\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*([^\d].*)?$/);
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return m[1] && m[1] !== '+' ? -n : n;
}

/**
 * 從投影片內文取出第一個表格。第一欄是標籤,其餘欄是數列。
 * @returns {null | { labels: string[], series: { name: string, values: (number|null)[] }[], before: string, after: string, bad: { row: number, col: number, text: string }[] }}
 */
function parseChartTable(body) {
  const lines = String(body).split('\n');
  const start = lines.findIndex((l, k) => l.includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[k + 1] || ''));
  if (start < 0) return null;
  let end = start + 2;
  while (end < lines.length && lines[end].includes('|') && lines[end].trim()) end++;
  const row = l => l.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
  const header = row(lines[start]);
  const rows = lines.slice(start + 2, end).map(row);
  const bad = [];
  const series = header.slice(1).map((name, k) => ({
    name,
    values: rows.map((r, ri) => {
      const v = parseNumber(r[k + 1]);
      if (v == null && String(r[k + 1] ?? '').trim() && !/^(n\/?a|na|—|–|-|－|無|缺)$/i.test(String(r[k + 1]).trim())) bad.push({ row: ri + 1, col: k + 2, text: String(r[k + 1]) });
      return v;
    }),
  }));
  return { labels: rows.map(r => r[0] ?? ''), series, before: lines.slice(0, start).join('\n'), after: lines.slice(end).join('\n'), bad };
}

/**
 * 座標軸範圍:一定包含 0,級距為 1/2/5×10ⁿ,選「不超過 6 格」中最細的級距。
 * @returns {{ lo: number, hi: number, step: number, ticks: number[] }}
 */
function niceScale(min, max) {
  let lo = Math.min(0, min), hi = Math.max(0, max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (lo === hi) hi = lo + 1;
  const range = hi - lo;
  let step = 1;
  for (let e = Math.floor(Math.log10(range / 6)) - 1; ; e++) {
    const hit = [1, 2, 5].map(m => m * 10 ** e).find(s => Math.ceil(hi / s - 1e-9) - Math.floor(lo / s + 1e-9) <= 6);
    if (hit) { step = hit; break; }
  }
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const ticks = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return { lo: ticks[0], hi: ticks.at(-1), step, ticks };
}

// ───────── app/core/check.js ─────────
// 檢查書庫或單份簡報是否符合規則。網站的「檢查」按鈕、scripts/check.mjs、
// 書庫裡的單檔版 mdslide-check.mjs 都用這一份,規則只在這裡維護。
// 只使用資料來源介面(list / readText),瀏覽器與 Node 都能跑。




const MAX_SLIDES = 45;

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
async function checkDeck(source, project) {
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
async function checkLibrary(source, onProgress) {
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
function formatReport(report, { verbose = false } = {}) {
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

// ───────── scripts/node-source.mjs ─────────
// Node 版資料來源:讓建置腳本與檢查工具使用和瀏覽器完全相同的解析器(app/core)。

// 用命名空間匯入,避免打包成單檔時與 app/core 的同名函式衝突


function nodeSource(root) {
  const abs = nodePath.resolve(root);
  return {
    label: nodePath.basename(abs),
    root: abs,
    async list(path) {
      const entries = await fsp.readdir(nodePath.join(abs, path), { withFileTypes: true });
      return entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({ name: e.name, kind: e.isDirectory() ? 'dir' : 'file' }));
    },
    async readText(path) { return fsp.readFile(nodePath.join(abs, path), 'utf8'); },
    async mediaURL(path) { return path; },
  };
}

/** 走訪整棵樹,回傳 { 路徑: 清單 }(給 catalog.json 用)。 */
async function walkTree(source, path = '', tree = {}) {
  const entries = await source.list(path);
  tree[path] = entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) if (e.kind === 'dir') await walkTree(source, path ? `${path}/${e.name}` : e.name, tree);
  return tree;
}

// ───────── 命令列 ─────────
const __dir = process.argv.slice(2).find(a => !a.startsWith('--')) || __toPath(new URL('.', import.meta.url));
const __report = await checkLibrary(nodeSource(__dir));
console.log(formatReport(__report, { verbose: process.argv.includes('--slides') }));
if (__report.problems.length) process.exitCode = 1;
