// 目錄頁:主題 → 簡報卡片。封面只在卡片捲進畫面時才讀(IntersectionObserver)。

import { loadCover, limiter } from '../core/library.js';
import { escapeHTML as esc } from '../core/markdown.js';
import { renderSlide } from '../player/render.js';
import { hydrate } from '../player/hydrate.js';
import { applyUITheme } from '../player/themes.js';
import { checkLibrary } from '../core/check.js';
import { t } from '../core/i18n.js';
import { openCheckPanel } from './check-view.js';

const coverLimit = limiter(3);

export function renderLibrary(root, { lib, source, sourceKey, onOpen, onRefresh, header }) {
  applyUITheme(lib.theme || 'paper');
  const total = lib.topics.reduce((n, tp) => n + tp.projects.length, 0);
  root.innerHTML = `
    <div class="library">
      ${header}
      <div class="lib-head">
        <div>
          <div class="eyebrow">${esc(t('lib.eyebrow', { kind: t(sourceKey === 'repo' ? 'lib.repo' : 'lib.local'), topics: lib.topics.length, decks: total }))}</div>
          <h1>${esc(lib.title)}</h1>
          ${lib.description ? `<p class="desc">${esc(lib.description)}</p>` : ''}
        </div>
        <div class="lib-tools">
          <input type="search" class="search" placeholder="${esc(t('lib.search'))}" aria-label="${esc(t('lib.search'))}">
          <button class="btn ghost check" title="${esc(t('lib.checkTitle'))}">${esc(t('lib.check'))}</button>
          ${onRefresh ? `<button class="btn ghost refresh" title="${esc(t('lib.refreshTitle'))}">${esc(t('lib.refresh'))}</button>` : ''}
        </div>
      </div>
      ${lib.topics.length > 1 ? `<nav class="chips"><button class="chip on" data-topic="*">${esc(t('lib.all'))}</button>${lib.topics.map(tp => `<button class="chip${tp.projects.length ? '' : ' zero'}" data-topic="${esc(tp.id)}" style="--c:${esc(tp.color)}">${esc(tp.title)}<small>${tp.projects.length}</small></button>`).join('')}</nav>` : ''}
      ${lib.issues.length ? `<details class="lib-issues"><summary>${esc(t('lib.issues', { n: lib.issues.length }))}</summary><ul>${lib.issues.map(i => `<li><code>${esc(i.path)}</code>${esc(i.message)}</li>`).join('')}</ul></details>` : ''}
      <p class="found" hidden></p>
      <p class="empty search-empty" hidden></p>
      <div class="topics">
        ${lib.topics.map(tp => `
          <section class="topic" data-topic="${esc(tp.id)}" style="--c:${esc(tp.color)}">
            ${lib.kind === 'library' ? `<header><h2><i></i>${esc(tp.title)}</h2>${tp.description ? `<p>${esc(tp.description)}</p>` : ''}</header>` : ''}
            <div class="grid">
              ${tp.projects.map(p => `
                <a class="deck-card" href="#/${sourceKey}/${encodeURIComponent(tp.id)}/${encodeURIComponent(p.id)}" data-topic="${esc(tp.id)}" data-project="${esc(p.id)}" data-search="${esc([p.title, p.subtitle, p.author, p.event, p.date, p.id, ...p.tags, tp.title].filter(Boolean).join(' ').toLowerCase())}">
                  <div class="thumb"><div class="thumb-inner"></div><div class="shine"></div></div>
                  <div class="info">
                    <h3>${esc(p.title)}</h3>
                    ${p.subtitle ? `<p class="sub">${esc(p.subtitle)}</p>` : ''}
                    ${p.tags.length ? `<div class="tags">${p.tags.map(x => `<span>#${esc(x)}</span>`).join('')}</div>` : ''}
                    <div class="meta">${p.author ? `<span class="author">${esc(p.author)}</span>` : ''}<span class="date">${esc(p.date || '')}</span><span class="count"></span></div>
                  </div>
                </a>`).join('') || `<p class="empty">${esc(t('lib.empty'))}</p>`}
            </div>
          </section>`).join('')}
      </div>
    </div>`;

  const cards = [...root.querySelectorAll('.deck-card')];
  const find = el => lib.topics.find(tp => tp.id === el.dataset.topic)?.projects.find(p => p.id === el.dataset.project);

  // 預設封面:用設定檔就能畫的標題頁,不必讀任何 MD
  for (const el of cards) {
    const p = find(el);
    const inner = el.querySelector('.thumb-inner');
    inner.dataset.theme = p.theme || lib.theme || 'paper'; // 封面用簡報播放時的主題,不跟著目錄頁的深色模式
    inner.innerHTML = coverHTML(p, null);
  }

  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      const el = en.target, p = find(el);
      coverLimit(() => loadCover(source, p)).then(info => {
        el.querySelector('.count').textContent = info.sections ? t('lib.chapters', { n: info.sections }) : '';
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
  // 多個關鍵字用空白分開,全部符合才顯示;只搜尋目錄層已有的資料(不讀 MD 檔)
  let topic = '*', words = [], raw = '';
  const apply = () => {
    let total = 0;
    root.querySelectorAll('.topic').forEach(sec => {
      let shown = 0;
      sec.querySelectorAll('.deck-card').forEach(c => {
        const ok = (topic === '*' || c.dataset.topic === topic) && words.every(w => c.dataset.search.includes(w));
        c.hidden = !ok; if (ok) shown++;
      });
      sec.hidden = shown === 0 && (topic !== '*' || words.length > 0);
      total += shown;
    });
    const found = root.querySelector('.found');
    found.hidden = topic === '*' && !words.length;
    found.textContent = found.hidden ? '' : t('lib.found', { n: total, total: cards.length });
    const empty = root.querySelector('.search-empty');
    empty.hidden = !(words.length && total === 0);
    empty.textContent = empty.hidden ? '' : t('lib.noResults', { q: raw });
  };
  root.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    topic = b.dataset.topic;
    root.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    apply();
  }));
  const search = root.querySelector('.search');
  search.addEventListener('input', () => { raw = search.value.trim(); words = raw.toLowerCase().split(/\s+/).filter(Boolean); apply(); });
  const slash = e => {
    if (e.key === '/' && !e.target.closest?.('input, textarea, select')) { e.preventDefault(); search.focus(); }
    if (e.key === 'Escape' && e.target === search && search.value) { search.value = ''; search.dispatchEvent(new Event('input')); }
  };
  window.addEventListener('keydown', slash);
  root.querySelector('.refresh')?.addEventListener('click', onRefresh);
  root.querySelector('.check')?.addEventListener('click', () => {
    source.refresh?.(); // 讀最新的檔案(使用者可能剛改過)
    openCheckPanel(document.body, onProgress => checkLibrary(source, onProgress));
  });
  return () => { io.disconnect(); window.removeEventListener('keydown', slash); };
}

function coverHTML(project, firstSlide) {
  const deck = { ...project, sections: [{ title: '', color: project.accent || '', slides: [] }] };
  const slide = firstSlide
    ? { ...firstSlide, sec: 0, i: 0 }
    : { layout: 'title', meta: {}, body: '', media: [], file: project.path, sec: 0, i: 0 };
  if (!deck.sections[0].color) delete deck.sections[0].color;
  return renderSlide(slide, { deck, mode: 'thumb', globalIndex: 0, total: 1 });
}
