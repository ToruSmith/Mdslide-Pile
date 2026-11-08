// 編輯模式:左邊改 Markdown 原文,右邊即時看結果。只在 Chrome / Edge 開啟的本機資料夾能存檔。
//
// 安全做法(見 app/sources/sources.js 的寫入規則):
//   - 一份一份檔案編輯,存檔前比對打開時的檔案狀態,別的程式改過就停下來問。
//   - 沒存的修改離開前會詢問;隨時可以「還原」回打開時的內容。
//   - 新增投影片會自動取下一個編號;「封存」是搬到 _封存/,不真的刪檔。
// 其他瀏覽器與倉庫模式只能看與下載(或到 GitHub 編輯)。

import { escapeHTML as esc } from '../core/markdown.js';
import { parseSlideFile } from '../core/slide.js';
import { renderSlide } from './render.js';
import { hydrate, stopMedia } from './hydrate.js';
import { t } from '../core/i18n.js';
import { splitOrder } from '../core/names.js';

const PREVIEW_DELAY = 180;

/**
 * 檔案裡每一張投影片在原文中的位置,和 core/slide.js 的切法一致:
 * 先去掉開頭的 front matter,再依單獨一行的 `---` 切開(程式碼區塊裡的不算),空白段落略過。
 */
export function segmentRanges(text) {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fm = src.match(/^---\n[\s\S]*?\n---[ \t]*(\n|$)/);
  const offset = fm ? fm[0].length : 0;
  const lines = src.slice(offset).split('\n');
  const cuts = [];
  let fence = null;
  lines.forEach((line, i) => {
    const f = line.match(/^\s*(```+|~~~+)/);
    if (f) fence = fence ? (line.trim().startsWith(fence) ? null : fence) : f[1];
    else if (!fence && /^---\s*$/.test(line)) cuts.push(i);
  });
  const bounds = [-1, ...cuts, lines.length];
  const at = n => offset + lines.slice(0, n).reduce((sum, l) => sum + l.length + 1, 0);
  const out = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i] + 1, b = bounds[i + 1];
    if (bounds.length > 2 && !lines.slice(a, b).join('\n').trim()) continue; // 空白段落:和播放器一樣略過
    out.push({ from: at(a), to: Math.max(at(a), at(b) - 1) });
  }
  return out.length ? out : [{ from: offset, to: src.length }];
}

/** 下一個可用的檔名編號:01-x.md、02-y.md → 03。 */
export function nextName(names, title) {
  let max = 0;
  for (const n of names) {
    const m = n.match(/^(\d+)[-_. ]/);
    if (m) max = Math.max(max, +m[1]);
  }
  const num = String(max + 1).padStart(2, '0');
  const safe = String(title || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').trim().slice(0, 40);
  return `${num}-${safe || 'slide'}.md`;
}

export function openEditor(player, { onSaved, onClose }) {
  const { source } = player;
  const canWrite = !!source.canWrite;
  const el = document.createElement('div');
  el.className = 'editor';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', t('editor.label'));
  el.innerHTML = `
    <header class="ebar">
      <button class="pbtn" data-e="close">${esc(t('editor.close'))}</button>
      <div class="efile"></div>
      <div class="egrow"></div>
      <button class="pbtn" data-e="add" title="${esc(t('editor.addTitle'))}">${esc(t('editor.add'))}</button>
      <button class="pbtn" data-e="archive" title="${esc(t('editor.archiveTitle'))}">${esc(t('editor.archive'))}</button>
      <a class="pbtn gh" hidden target="_blank" rel="noopener">${esc(t('editor.onGitHub'))}</a>
      <button class="pbtn" data-e="revert">${esc(t('editor.revert'))}</button>
      <button class="pbtn primary" data-e="save">${esc(t('editor.save'))}</button>
    </header>
    <div class="ebody">
      <div class="epane">
        <textarea class="etext" spellcheck="false" aria-label="${esc(t('editor.label'))}"></textarea>
        <div class="estatus"></div>
      </div>
      <div class="epane epreview"><div class="eslide"><div class="escale"></div></div><div class="eissues"></div></div>
    </div>`;
  player.el.player.append(el);
  const $ = s => el.querySelector(s);
  const ta = $('.etext');
  const state = { path: null, stat: null, original: '', seg: 0 };

  const dirty = () => ta.value !== state.original;
  const setStatus = (msg, kind = '') => { $('.estatus').textContent = msg; $('.estatus').className = `estatus ${kind}`; };

  // 倉庫模式(網站內建書庫)不能存檔,但可以直接到 GitHub 上編輯
  const ghBase = (() => {
    const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
    const repo = location.pathname.split('/').filter(Boolean)[0];
    return source.kind === 'repo' && m && repo ? `https://github.com/${m[1]}/${repo}/edit/main/${source.base || 'content/'}` : '';
  })();

  const scale = () => el.style.setProperty('--es', ($('.eslide').clientWidth || 1280) / 1280);
  const ro = new ResizeObserver(scale);
  ro.observe($('.eslide'));

  /** 重畫右邊:目前游標所在的那一段(檔案裡可能有好幾張)。 */
  let timer = 0;
  function preview() {
    const text = ta.value;
    const ranges = segmentRanges(text);
    const caret = ta.selectionStart;
    state.seg = Math.max(0, ranges.findIndex(r => caret <= r.to));
    if (/\.ya?ml$/i.test(state.path || '')) { $('.escale').innerHTML = ''; $('.eissues').innerHTML = `<p>${esc(t('editor.yamlNote'))}</p>`; return; }
    let slides = [], issues = [];
    try {
      const parsed = parseSlideFile(text, { path: state.path || 'untitled.md' });
      slides = parsed.slides;
      issues = parsed.issues || [];
    } catch (e) {
      issues = [{ message: String(e.message || e) }];
    }
    const slide = slides[Math.min(state.seg, slides.length - 1)];
    const box = $('.escale');
    stopMedia(box);
    box.innerHTML = slide ? renderSlide({ ...slide, sec: player.slides[player.focus]?.sec ?? 0 }, { deck: player.deck, mode: 'full', globalIndex: player.focus, total: player.slides.length }) : '';
    hydrate(box, source, { full: false });
    const extra = slides.length > 1 ? t('editor.segment', { n: state.seg + 1, total: slides.length }) : '';
    $('.eissues').innerHTML = [...issues.map(i => `<p class="warn">${esc(i.message)}</p>`), extra ? `<p>${esc(extra)}</p>` : ''].join('');
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(preview, PREVIEW_DELAY); };

  /** 打開某一個檔案。segment = 要先顯示檔案裡的第幾張。 */
  async function load(path, { segment = 0, note = '' } = {}) {
    if (!(await confirmLeave())) return false;
    let text;
    try {
      text = await source.readText(path);
    } catch {
      setStatus(t('editor.openFailed', { path }), 'warn');
      return false;
    }
    state.path = path;
    state.original = text;
    state.stat = source.stat ? await source.stat(path) : null;
    ta.value = text;
    const at = segmentRanges(text)[segment]?.from ?? 0; // 游標放在這張投影片的開頭
    ta.setSelectionRange(at, at);
    $('.efile').textContent = path;
    $('.ebar').dataset.yaml = /\.ya?ml$/i.test(path) ? '1' : ''; // deck.yml:不提供新增 / 封存
    const gh = $('.gh');
    gh.hidden = !ghBase;
    if (ghBase) gh.href = ghBase + path.split('/').map(encodeURIComponent).join('/');
    setStatus(note || (canWrite ? t('editor.ready') : t('editor.readOnly')), note ? 'warn' : '');
    preview();
    return true;
  }

  async function save() {
    if (!canWrite) return download();
    if (!dirty()) return setStatus(t('editor.noChange'));
    setStatus(t('editor.saving'));
    try {
      state.stat = await source.writeText(state.path, ta.value, { expect: state.stat });
      state.original = ta.value;
      setStatus(t('editor.saved', { time: new Date().toLocaleTimeString() }), 'ok');
      onSaved?.();
    } catch (e) {
      const m = String(e.message || e);
      if (m === 'stale') {
        // 別的程式改過這個檔案:讓使用者選,不自動蓋掉
        if (confirm(t('editor.staleAsk'))) { state.stat = await source.stat(state.path); return save(); }
        setStatus(t('editor.staleKept'), 'warn');
      } else if (m === 'denied') setStatus(t('editor.denied'), 'warn');
      else setStatus(t('editor.failed', { message: m }), 'warn');
    }
  }

  /** 不能存檔時的退路:下載這個檔案。 */
  function download() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ta.value], { type: 'text/markdown;charset=utf-8' }));
    a.download = state.path.split('/').pop();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
    setStatus(t('editor.downloaded'), 'ok');
  }

  async function addSlide() {
    if (!canWrite) return setStatus(t('editor.readOnly'), 'warn');
    if (!(await confirmLeave())) return;
    const dir = state.path.slice(0, state.path.lastIndexOf('/'));
    const names = (await source.list(dir)).filter(e => e.kind === 'file').map(e => e.name);
    const title = prompt(t('editor.addAsk'), '');
    if (title === null) return;
    const name = nextName(names, title);
    const path = `${dir}/${name}`;
    try {
      await source.writeText(path, `# ${title || splitOrder(name).label}\n`);
      onSaved?.();
      setStatus(t('editor.added', { name }), 'ok');
      await load(path);
    } catch (e) {
      setStatus(t('editor.failed', { message: String(e.message || e) }), 'warn');
    }
  }

  async function archive() {
    if (!canWrite) return setStatus(t('editor.readOnly'), 'warn');
    if (!confirm(t('editor.archiveAsk', { name: state.path.split('/').pop() }))) return;
    try {
      const to = await source.archive(state.path, `${player.deck.path}/_封存`); // i18n-ok:資料夾名稱,底線開頭代表略過
      state.original = ta.value; // 已經搬走,不要再問未存檔
      setStatus(t('editor.archived', { path: to }), 'ok');
      onSaved?.();
      close();
    } catch (e) {
      setStatus(t('editor.failed', { message: String(e.message || e) }), 'warn');
    }
  }

  async function confirmLeave() {
    if (!dirty()) return true;
    return confirm(t('editor.unsavedAsk'));
  }

  async function close() {
    if (!(await confirmLeave())) return;
    ro.disconnect();
    stopMedia(el);
    el.remove();
    onClose?.();
  }

  el.addEventListener('click', e => {
    const k = e.target.closest('[data-e]')?.dataset.e;
    if (k === 'close') close();
    if (k === 'save') save();
    if (k === 'add') addSlide();
    if (k === 'archive') archive();
    if (k === 'revert') { if (!dirty() || confirm(t('editor.revertAsk'))) { ta.value = state.original; preview(); setStatus(t('editor.reverted')); } }
  });
  ta.addEventListener('input', () => { schedule(); if (dirty()) setStatus(t('editor.unsaved'), 'warn'); });
  ta.addEventListener('click', schedule);
  ta.addEventListener('keyup', e => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') schedule(); });
  ta.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return save(); }
    if (e.key === 'Escape') { e.preventDefault(); return close(); }
    if (e.key === 'Tab') { // Tab 縮排,不要跳走
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b } = ta;
      ta.setRangeText('  ', a, b, 'end');
      schedule();
    }
    if (e.key === 'Enter') { // 自動接續清單符號
      const before = ta.value.slice(0, ta.selectionStart);
      const line = before.slice(before.lastIndexOf('\n') + 1);
      const m = line.match(/^(\s*)([-*+]|\d+\.)\s+/);
      if (m && line.trim() !== m[2]) {
        e.preventDefault();
        const next = /^\d+\./.test(m[2]) ? `${parseInt(m[2], 10) + 1}.` : m[2];
        ta.setRangeText(`\n${m[1]}${next} `, ta.selectionStart, ta.selectionEnd, 'end');
        schedule();
      }
    }
  });
  window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

  return { load, close, save, get dirty() { return dirty(); }, el };
}

const NOTE_LINE = /^\s*(?:note|notes|備註|講者備註)\s*[:：]/i; // 和 core/slide.js 的備註標記一致(i18n-ok:語法關鍵字)

/** 換掉檔案裡第 index 段(由單獨一行 --- 分隔)的 Note: 區塊。text 為空就移除備註。 */
export function replaceNotes(fileText, index, text) {
  const ranges = segmentRanges(fileText);
  const r = ranges[Math.min(index, ranges.length - 1)];
  const seg = fileText.slice(r.from, r.to);
  const lines = seg.split('\n');
  let at = -1, fence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    else if (!fence && at < 0 && NOTE_LINE.test(l)) at = i;
  });
  const body = (at < 0 ? seg : lines.slice(0, at).join('\n')).replace(/\s+$/, '');
  const note = text.trim();
  const next = note ? `${body}\n\nNote:\n${note}\n` : `${body}\n`;
  return fileText.slice(0, r.from) + next + fileText.slice(r.to);
}
