// 目錄頁:主題 → 簡報卡片。封面只在卡片捲進畫面時才讀(IntersectionObserver)。

import { loadCover, limiter } from '../core/library.js';
import { escapeHTML as esc } from '../core/markdown.js';
import { renderSlide } from '../player/render.js';
import { hydrate } from '../player/hydrate.js';
import { applyTheme } from '../player/themes.js';
import { checkLibrary } from '../core/check.js';
import { openCheckPanel } from './check-view.js';

const coverLimit = limiter(3);

export function renderLibrary(root, { lib, source, sourceKey, onOpen, onRefresh, header }) {
  applyTheme(lib.theme || 'paper');
  const total = lib.topics.reduce((n, t) => n + t.projects.length, 0);
  root.innerHTML = `
    <div class="library">
      ${header}
      <div class="lib-head">
        <div>
          <div class="eyebrow">${esc(sourceKey === 'repo' ? '內建書庫' : '本機書庫')} · ${lib.topics.length} 個主題 · ${total} 份簡報</div>
          <h1>${esc(lib.title)}</h1>
          ${lib.description ? `<p class="desc">${esc(lib.description)}</p>` : ''}
        </div>
        <div class="lib-tools">
          <input type="search" class="search" placeholder="搜尋簡報標題、標籤…">
          <button class="btn ghost check" title="檢查所有簡報是否符合規則">✓ 檢查</button>
          ${onRefresh ? '<button class="btn ghost refresh" title="重新讀取資料夾">↻ 重新整理</button>' : ''}
        </div>
      </div>
      ${lib.topics.length > 1 ? `<nav class="chips"><button class="chip on" data-topic="*">全部</button>${lib.topics.map(t => `<button class="chip" data-topic="${esc(t.id)}" style="--c:${esc(t.color)}">${esc(t.title)}<small>${t.projects.length}</small></button>`).join('')}</nav>` : ''}
      ${lib.issues.length ? `<details class="lib-issues"><summary>⚠ ${lib.issues.length} 個設定檔問題</summary><ul>${lib.issues.map(i => `<li><code>${esc(i.path)}</code>${esc(i.message)}</li>`).join('')}</ul></details>` : ''}
      <div class="topics">
        ${lib.topics.map(t => `
          <section class="topic" data-topic="${esc(t.id)}" style="--c:${esc(t.color)}">
            ${lib.kind === 'library' ? `<header><h2><i></i>${esc(t.title)}</h2>${t.description ? `<p>${esc(t.description)}</p>` : ''}</header>` : ''}
            <div class="grid">
              ${t.projects.map(p => `
                <a class="deck-card" href="#/${sourceKey}/${encodeURIComponent(t.id)}/${encodeURIComponent(p.id)}" data-topic="${esc(t.id)}" data-project="${esc(p.id)}" data-search="${esc([p.title, p.subtitle, p.author, p.event, ...p.tags, t.title].join(' ').toLowerCase())}">
                  <div class="thumb"><div class="thumb-inner"></div><div class="shine"></div></div>
                  <div class="info">
                    <h3>${esc(p.title)}</h3>
                    ${p.subtitle ? `<p class="sub">${esc(p.subtitle)}</p>` : ''}
                    <div class="meta"><span>${esc(p.date || '')}</span><span class="count"></span></div>
                    ${p.tags.length ? `<div class="tags">${p.tags.map(x => `<span>#${esc(x)}</span>`).join('')}</div>` : ''}
                  </div>
                </a>`).join('') || '<p class="empty">這個主題還沒有簡報</p>'}
            </div>
          </section>`).join('')}
      </div>
    </div>`;

  const cards = [...root.querySelectorAll('.deck-card')];
  const find = el => lib.topics.find(t => t.id === el.dataset.topic)?.projects.find(p => p.id === el.dataset.project);

  // 預設封面:用設定檔就能畫的標題頁,不必讀任何 MD
  for (const el of cards) {
    const p = find(el);
    const inner = el.querySelector('.thumb-inner');
    if (p.theme) inner.dataset.theme = p.theme; // 封面用簡報自己的主題
    inner.innerHTML = coverHTML(p, null);
  }

  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      const el = en.target, p = find(el);
      coverLimit(() => loadCover(source, p)).then(info => {
        el.querySelector('.count').textContent = info.sections ? `${info.sections} 章` : '';
        const inner = el.querySelector('.thumb-inner');
        if (info.firstSlide) inner.innerHTML = coverHTML(p, info.firstSlide);
        hydrate(inner, source);
      }, () => {});
    }
  }, { rootMargin: '200px' });
  cards.forEach(c => io.observe(c));

  // 卡片 3D 傾斜
  for (const el of cards) {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', `${-y * 10}deg`);
      el.style.setProperty('--ry', `${x * 12}deg`);
      el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    el.addEventListener('click', e => { e.preventDefault(); onOpen(el.dataset.topic, el.dataset.project); });
  }

  // 篩選與搜尋
  let topic = '*', q = '';
  const apply = () => {
    root.querySelectorAll('.topic').forEach(sec => {
      let shown = 0;
      sec.querySelectorAll('.deck-card').forEach(c => {
        const ok = (topic === '*' || c.dataset.topic === topic) && (!q || c.dataset.search.includes(q));
        c.hidden = !ok; if (ok) shown++;
      });
      sec.hidden = shown === 0 && (topic !== '*' || q);
    });
  };
  root.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    topic = b.dataset.topic;
    root.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    apply();
  }));
  root.querySelector('.search')?.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); apply(); });
  root.querySelector('.refresh')?.addEventListener('click', onRefresh);
  root.querySelector('.check')?.addEventListener('click', () => {
    source.refresh?.(); // 讀最新的檔案(使用者可能剛改過)
    openCheckPanel(document.body, onProgress => checkLibrary(source, onProgress));
  });
  return () => io.disconnect();
}

function coverHTML(project, firstSlide) {
  const deck = { ...project, sections: [{ title: '', color: project.accent || '', slides: [] }] };
  const slide = firstSlide
    ? { ...firstSlide, sec: 0, i: 0 }
    : { layout: 'title', meta: {}, body: '', media: [], file: project.path, sec: 0, i: 0 };
  if (!deck.sections[0].color) delete deck.sections[0].color;
  return renderSlide(slide, { deck, mode: 'thumb', globalIndex: 0, total: 1 });
}
