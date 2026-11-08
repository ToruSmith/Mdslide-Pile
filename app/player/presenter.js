// 講者視窗:顯示目前投影片、下一張、備註、計時。與主視窗透過 BroadcastChannel 同步。
// 媒體網址由主視窗提供(本機檔案的 blob 網址在同網域的視窗間可以共用)。

import { escapeHTML as esc } from '../core/markdown.js';
import { applyTheme } from './themes.js';

export function startPresenter(root) {
  document.title = '講者視窗 · Mdslide Pile';
  root.innerHTML = `
    <div class="presenter">
      <section class="pv-main"><div class="pv-label">目前</div><div class="pv-box cur"><div class="pv-frame"></div></div></section>
      <aside class="pv-side">
        <div class="pv-clock"><div><small>經過</small><b class="elapsed">00:00</b></div><div><small>現在</small><b class="now">--:--</b></div><button class="reset">重設</button></div>
        <div class="pv-label">下一張</div><div class="pv-box next"><div class="pv-frame"></div></div>
        <div class="pv-meta"></div>
        <div class="pv-label">備註</div><div class="pv-notes"><p class="empty">等待主視窗…(在主視窗按 S 開啟)</p></div>
        <div class="pv-keys">← → 翻頁 · ↑ ↓ 換章 · Enter 放大 · B 黑屏 · 這個視窗的按鍵會同步到主視窗</div>
      </aside>
    </div>`;
  const $ = s => root.querySelector(s);
  const ch = new BroadcastChannel('mdslide-presenter');
  let startedAt = Date.now();

  const place = (box, html, media) => {
    const frame = box.querySelector('.pv-frame');
    frame.innerHTML = html || '<div class="pv-end">(最後一張)</div>';
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
    if (m?.type !== 'state') return;
    last = m;
    applyTheme(m.theme);
    startedAt = m.startedAt || startedAt;
    place($('.pv-box.cur'), m.cur, m.media);
    place($('.pv-box.next'), m.next, m.media);
    $('.pv-meta').innerHTML = `<b>${m.n}</b> / ${m.total} · ${esc(m.section || m.title)}${m.steps ? ` · 逐步 ${m.step}/${m.steps}` : ''}${m.viewing ? '' : ' · <em>主畫面未放大</em>'}`;
    $('.pv-notes').innerHTML = m.notes || '<p class="empty">這張沒有備註</p>';
  };
  ch.postMessage({ type: 'hello' });

  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    ch.postMessage({ type: 'key', key: e.key });
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('resize', () => { if (last) ch.onmessage({ data: last }); });
  $('.reset').onclick = () => { startedAt = Date.now(); };
  const tick = () => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    $('.elapsed').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    $('.now').textContent = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}
