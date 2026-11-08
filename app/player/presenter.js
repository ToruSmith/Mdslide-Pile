// 講者視窗:顯示目前投影片、下一張、備註、計時。與主視窗透過 BroadcastChannel 同步。
// 媒體網址由主視窗提供(本機檔案的 blob 網址在同網域的視窗間可以共用)。

import { escapeHTML as esc } from '../core/markdown.js';
import { applyTheme } from './themes.js';
import { t, setLang, getLang } from '../core/i18n.js';
import { Ink } from './ink.js';

export function startPresenter(root) {
  try { setLang(localStorage.getItem('mdslide-lang') || (navigator.language?.toLowerCase().startsWith('zh') ? 'zh-Hant' : 'en')); } catch { /* 隱私模式 */ }
  document.documentElement.lang = getLang();
  document.title = t('pv.docTitle');
  root.innerHTML = `
    <div class="presenter">
      <section class="pv-main">
        <div class="pv-label pv-ink-row"><span>${t('pv.current')}</span><span class="pv-ink">${['none', 'laser', 'pen', 'highlight', 'eraser'].map(k => `<button data-ink="${k}">${esc(t(k === 'none' ? 'pv.inkNone' : 'ink.' + k))}</button>`).join('')}<button data-ink="undo">${esc(t('ink.undo'))}</button><button data-ink="clear">${esc(t('ink.clear'))}</button></span></div>
        <div class="pv-box cur"><div class="pv-frame"></div></div>
        <div class="pv-ink-hint">${t('pv.inkHint')}</div>
      </section>
      <aside class="pv-side">
        <div class="pv-clock"><div><small>${t('pv.elapsed')}</small><b class="elapsed">00:00</b></div><div><small>${t('pv.now')}</small><b class="now">--:--</b></div><button class="reset">${t('pv.reset')}</button></div>
        <div class="pv-label">${t('pv.next')}</div><div class="pv-box next"><div class="pv-frame"></div></div>
        <div class="pv-meta"></div>
        <div class="pv-label">${t('pv.notes')}</div><div class="pv-notes"><p class="empty">${t('pv.waiting')}</p></div>
        <div class="pv-keys">${t('pv.keys')}</div>
      </aside>
    </div>`;
  const $ = s => root.querySelector(s);
  const ch = new BroadcastChannel('mdslide-presenter');
  let startedAt = Date.now();
  // 在講者視窗畫的內容同步到觀眾畫面,反過來也一樣
  const ink = new Ink({ onOp: op => ch.postMessage({ type: 'ink', op }), onChange: () => {
    root.querySelectorAll('.pv-ink [data-ink]').forEach(b => b.classList.toggle('on', b.dataset.ink === (ink.enabled ? ink.tool : 'none')));
  } });
  root.querySelector('.pv-ink').addEventListener('click', e => {
    const k = e.target.closest('[data-ink]')?.dataset.ink;
    if (!k) return;
    if (k === 'undo') return ink.undo();
    if (k === 'clear') return ink.clear();
    if (k === 'none') return ink.setEnabled(false);
    ink.setTool(k);
    ink.setEnabled(true);
  });

  const place = (box, html, media) => {
    const frame = box.querySelector('.pv-frame');
    frame.innerHTML = html || `<div class="pv-end">${t('pv.last')}</div>`;
    frame.querySelectorAll('[data-media]').forEach(el => { const u = media[el.dataset.media]; if (u) el.src = u; });
    frame.querySelectorAll('img[data-thumb]').forEach(el => { el.onerror = () => el.remove(); el.src = el.dataset.thumb; });
    frame.querySelectorAll('.slide[data-bg]').forEach(el => { const u = media[el.dataset.bg]; if (u) el.style.backgroundImage = `url("${u}")`; });
    const sc = box.clientWidth / 1280;
    frame.style.transform = `scale(${sc})`;
    box.style.height = `${720 * sc}px`;
  };

  let last = null;
  ch.onmessage = e => {
    const m = e.data;
    if (m?.type === 'ink' && m.op) return ink.apply(m.op);
    if (m?.type !== 'state') return;
    last = m;
    applyTheme(m.theme);
    startedAt = m.startedAt || startedAt;
    place($('.pv-box.cur'), m.cur, m.media);
    ink.store.set(m.gi, m.ink || []);
    ink.mount($('.pv-box.cur .pv-frame'), m.gi);
    place($('.pv-box.next'), m.next, m.media);
    $('.pv-meta').innerHTML = `<b>${m.n}</b> / ${m.total} · ${esc(m.section || m.title)}${m.steps ? esc(t('pv.steps', { a: m.step, b: m.steps })) : ''}${m.viewing ? '' : t('pv.notViewing')}`;
    $('.pv-notes').innerHTML = m.notes || `<p class="empty">${t('pv.noNotes')}</p>`;
  };
  ch.postMessage({ type: 'hello' });

  window.addEventListener('keydown', e => {
    if (ink.enabled && (e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); return ink.undo(); }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    ch.postMessage({ type: 'key', key: e.key });
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('resize', () => { if (last) ch.onmessage({ data: last }); });
  $('.reset').onclick = () => { startedAt = Date.now(); };
  const tick = () => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    $('.elapsed').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    $('.now').textContent = new Date().toLocaleTimeString(getLang() === 'en' ? 'en-GB' : 'zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}
