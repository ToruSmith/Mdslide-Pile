// 播放器:3D 舞台(各種排列)+ 單張放大 + 鍵盤操作 + 講者視窗同步 + 列印。

import { flatten } from '../core/library.js';
import { escapeHTML as esc, renderMarkdown } from '../core/markdown.js';
import { renderSlide } from './render.js';
import { hydrate, playMedia, stopMedia } from './hydrate.js';
import { STAGES, STAGE_ORDER, CW, poseTransform, worldTransform } from './layouts.js';
import { THEMES, THEME_NAMES, applyTheme, currentTheme } from './themes.js';

const EASE = 'cubic-bezier(.65, 0, .35, 1)';
const pad = n => String(n).padStart(2, '0');

const KEYS = [
  ['← →', '上一張 / 下一張(翻頁筆也可以)'], ['↑ ↓', '上一章 / 下一章(牌堆會洗牌)'], ['Enter', '放大 / 縮回'],
  ['Esc', '縮回、離開總覽、回目錄'], ['1–9', '跳到第幾章'], ['Home End', '第一張 / 最後一張'],
  ['O', '總覽'], ['L', '切換排列'], ['T', '切換主題'], ['B', '黑屏'], ['F', '全螢幕'],
  ['S', '開啟講者視窗'], ['P', '列印 / 存成 PDF'], ['K', '影片播放 / 暫停'], ['?', '這個說明'],
];

export class Player {
  constructor(root, { deck, source, start = 0, onExit, onIndex, theme }) {
    this.root = root;
    this.deck = deck;
    this.source = source;
    this.onExit = onExit;
    this.onIndex = onIndex;
    this.slides = flatten(deck);
    this.sections = deck.sections;
    this.focus = Math.min(Math.max(0, start), this.slides.length - 1);
    this.cur = this.slides[this.focus]?.sec ?? 0;
    this.stage = STAGES[deck.stage] ? deck.stage : 'pile';
    this.lastStage = this.stage === 'overview' ? 'pile' : this.stage;
    this.viewing = false;
    this.steps = [];
    this.stepIndex = 0;
    this.hydrated = new Set();
    this.channel = 'BroadcastChannel' in window ? new BroadcastChannel('mdslide-presenter') : null;
    this.startedAt = Date.now();
    applyTheme(theme || deck.theme || 'paper');
    this.build();
    this.bind();
    this.intro();
  }

  // ---------------- 建立畫面 ----------------
  build() {
    const d = this.deck;
    this.root.innerHTML = `
      <div class="player">
        <header class="pbar">
          <button class="pbtn back" data-act="exit" title="回到目錄(Esc)">‹ 目錄</button>
          <div class="ptitle"><div class="deck-name">${esc(d.title)}</div><div class="sec-name"></div></div>
          <nav class="tabs"></nav>
          <div class="ptools">
            <select class="stage-select" title="排列方式(L)">${Object.entries(STAGES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
            <button class="pbtn" data-act="theme" title="切換主題(T)">主題</button>
            <button class="pbtn" data-act="present" title="放大播放(Enter)">▶</button>
            <button class="pbtn" data-act="help" title="快捷鍵(?)">?</button>
          </div>
        </header>
        <div class="stage"><div class="world"></div></div>
        <div class="viewer"><div class="frame"></div></div>
        <footer class="pfoot"><div class="progress"></div><div class="hint">← → 翻頁 · ↑ ↓ 換章 · Enter 放大 · L 排列 · ? 說明</div></footer>
        <div class="black"></div>
        <div class="help-panel"><div class="help-card"><h2>快捷鍵</h2><dl>${KEYS.map(([k, v]) => `<dt>${k.split(' ').map(x => `<kbd>${x}</kbd>`).join('')}</dt><dd>${v}</dd>`).join('')}</dl><p>點卡片選取,再點一次放大。滑鼠滾輪也可以翻頁。</p></div></div>
        <div class="issues"></div>
      </div>`;
    const $ = s => this.root.querySelector(s);
    this.el = { player: $('.player'), world: $('.world'), stage: $('.stage'), viewer: $('.viewer'), frame: $('.frame'), tabs: $('.tabs'), secName: $('.sec-name'), progress: $('.progress'), select: $('.stage-select'), black: $('.black'), help: $('.help-panel'), issues: $('.issues') };

    this.cards = this.slides.map((s, gi) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = renderSlide(s, { deck: d, mode: 'thumb', globalIndex: gi, total: this.slides.length });
      card.addEventListener('click', e => { e.stopPropagation(); this.onCardClick(gi); });
      this.el.world.appendChild(card);
      return card;
    });

    this.sections.forEach((sec, si) => {
      const b = document.createElement('button');
      b.textContent = sec.folder ? pad(this.sections.filter(s => s.folder).indexOf(sec) + 1) : '●';
      b.title = sec.title || d.title;
      b.style.setProperty('--c', sec.color);
      b.onclick = () => this.setSection(si);
      this.el.tabs.appendChild(b);
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.style.flex = sec.slides.length;
      seg.style.setProperty('--c', sec.color);
      seg.innerHTML = '<i></i>';
      this.el.progress.appendChild(seg);
    });
    if (this.sections.length < 2) this.el.tabs.style.display = 'none';

    if (d.issues?.length) {
      this.el.issues.innerHTML = `<details><summary>⚠ ${d.issues.length} 個提醒</summary><ul>${d.issues.map(i => `<li><code>${esc(i.path)}</code>${esc(i.message)}</li>`).join('')}</ul></details>`;
    }
  }

  bind() {
    this.handlers = {
      key: e => this.onKey(e),
      resize: () => this.layout('resize'),
      wheel: e => this.onWheel(e),
      msg: e => this.onPresenterMessage(e.data),
    };
    window.addEventListener('keydown', this.handlers.key);
    window.addEventListener('resize', this.handlers.resize);
    this.el.stage.addEventListener('wheel', this.handlers.wheel, { passive: false });
    this.channel?.addEventListener('message', this.handlers.msg);
    this.root.querySelector('.pbar').addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'exit') this.exit();
      if (act === 'theme') this.cycleTheme();
      if (act === 'present') this.viewing ? this.closeViewer() : this.openViewer();
      if (act === 'help') this.toggleHelp();
    });
    this.el.select.value = this.stage;
    this.el.select.addEventListener('change', () => { this.setStage(this.el.select.value); this.el.select.blur(); });
    this.el.frame.addEventListener('click', e => { e.stopPropagation(); if (!e.target.closest('video, audio, iframe, a')) this.next(); });
    this.el.viewer.addEventListener('click', () => this.closeViewer());
    this.el.help.addEventListener('click', () => this.toggleHelp(false));
    this.el.black.addEventListener('click', () => this.el.black.classList.remove('on'));
  }

  destroy() {
    window.removeEventListener('keydown', this.handlers.key);
    window.removeEventListener('resize', this.handlers.resize);
    this.channel?.removeEventListener('message', this.handlers.msg);
    this.channel?.close();
    stopMedia(this.root);
    this.source.releaseMedia?.();
    this.root.innerHTML = '';
  }

  exit() { this.onExit?.(); }

  // ---------------- 版面與動畫 ----------------
  computeLayout() {
    const { innerWidth: vw, innerHeight: vh } = window;
    return STAGES[this.stage].fn({ slides: this.slides, sections: this.sections, cur: this.cur, focus: this.focus, vw, vh });
  }

  layout(kind = 'focus') {
    const { poses, world } = this.computeLayout();
    this.el.world.style.transition = kind === 'resize' ? 'none' : `transform ${kind === 'focus' ? 0.6 : 1.1}s ${EASE}`;
    this.el.world.style.transform = worldTransform(world);
    let leave = 0, enter = 0;
    poses.forEach((to, gi) => {
      const el = this.cards[gi];
      const from = el._pose;
      const cs = getComputedStyle(el);
      const fromT = cs.transform === 'none' ? poseTransform(from || to) : cs.transform;
      const fromO = cs.opacity;
      el.getAnimations().forEach(a => a.cancel());
      let frames, delay = 0, dur = 450;
      const crossing = kind === 'shuffle' && from && (from.d === 0) !== (to.d === 0);
      if (kind === 'resize') frames = null;
      else if (crossing) {
        const leaving = from.d === 0;
        const mid = { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 260, y: (from.y + to.y) / 2 + (leaving ? -300 : 260),
          z: Math.max(from.z, to.z) + (leaving ? 80 : 220), rx: leaving ? 35 : -25, ry: (Math.random() - 0.5) * 50, rz: (Math.random() - 0.5) * 36, s: 1 };
        frames = [{ transform: fromT, opacity: fromO }, { transform: poseTransform(mid), opacity: leaving ? 0.75 : 0.95, offset: 0.5 }, { transform: poseTransform(to), opacity: to.o }];
        dur = 1150;
        delay = leaving ? leave++ * 45 : 330 + enter++ * 60;
      } else {
        frames = [{ transform: fromT, opacity: fromO }, { transform: poseTransform(to), opacity: to.o }];
        if (kind === 'shuffle') { dur = 1000; delay = 200 + Math.random() * 200; }
        if (kind === 'stage') { dur = 1100; delay = Math.random() * 280; }
        if (kind === 'intro') { dur = 1300; delay = 150 + Math.min(gi, 40) * 28; }
      }
      el.style.transform = poseTransform(to);
      el.style.opacity = to.o;
      el.style.pointerEvents = to.o < 0.2 ? 'none' : '';
      el.style.visibility = to.o === 0 && !frames ? 'hidden' : '';
      if (frames) el.animate(frames, { duration: dur, delay, easing: EASE, fill: 'backwards' });
      el._pose = to;
      el.classList.toggle('focus', gi === this.focus && !this.viewing);
    });
    this.updateChrome();
    this.hydrateNearby();
    this.syncThumbVideo();
    this.onIndex?.(this.focus);
    this.broadcast();
  }

  intro() {
    this.cards.forEach((el, i) => {
      el._pose = { x: 0, y: 40, z: -900 + i * 3, rx: 0, ry: 0, rz: (Math.random() - 0.5) * 20, s: 1, o: 0, d: 9 };
      el.style.transform = poseTransform(el._pose);
      el.style.opacity = 0;
    });
    requestAnimationFrame(() => this.layout('intro'));
  }

  hydrateNearby() {
    this.slides.forEach((s, gi) => {
      if (this.hydrated.has(gi)) return;
      const near = Math.abs(gi - this.focus) <= 10 || Math.abs(s.sec - this.cur) <= 1;
      const visible = (this.cards[gi]._pose?.o ?? 0) > 0;
      if (near && visible) { this.hydrated.add(gi); hydrate(this.cards[gi], this.source); }
    });
  }

  syncThumbVideo() {
    this.cards.forEach((c, gi) => c.querySelectorAll('video').forEach(v => {
      if (gi === this.focus && !this.viewing) v.play()?.catch(() => {}); else v.pause();
    }));
  }

  updateChrome() {
    const sec = this.sections[this.cur];
    this.el.secName.textContent = sec?.title || '';
    this.el.player.style.setProperty('--c', sec?.color || '');
    [...this.el.tabs.children].forEach((b, i) => b.classList.toggle('on', i === this.cur));
    const s = this.slides[this.focus];
    [...this.el.progress.children].forEach((seg, i) => {
      seg.firstChild.style.transform = `scaleX(${i < this.cur ? 1 : i > this.cur ? 0 : (s.i + 1) / this.sections[i].slides.length})`;
    });
    this.el.select.value = this.stage;
  }

  // ---------------- 導覽 ----------------
  goTo(gi, { fromViewer = false } = {}) {
    gi = Math.max(0, Math.min(this.slides.length - 1, gi));
    if (gi === this.focus && !fromViewer) return;
    const prevSec = this.cur, dir = Math.sign(gi - this.focus) || 1;
    this.focus = gi;
    this.cur = this.slides[gi].sec;
    if (this.stage === 'overview' && !this.viewing) this.stage = 'overview';
    this.layout(this.cur !== prevSec && STAGES[this.stage].shuffle ? 'shuffle' : 'focus');
    if (this.viewing) this.showInViewer(dir);
  }

  next() {
    if (this.viewing && this.stepIndex < this.steps.length) { this.steps[this.stepIndex++].classList.remove('hidden'); this.broadcast(); return; }
    this.goTo(this.focus + 1);
  }

  prev() {
    if (this.viewing && this.stepIndex > 0) { this.steps[--this.stepIndex].classList.add('hidden'); this.broadcast(); return; }
    const target = this.focus - 1;
    this.goTo(target);
    if (this.viewing && this.steps.length) { this.steps.forEach(s => s.classList.remove('hidden')); this.stepIndex = this.steps.length; }
  }

  setSection(si) {
    si = (si + this.sections.length) % this.sections.length;
    const gi = this.slides.findIndex(s => s.sec === si);
    if (this.stage === 'overview') this.stage = this.lastStage;
    if (gi >= 0) this.goTo(gi);
  }

  setStage(name) {
    if (!STAGES[name]) return;
    if (name !== 'overview') this.lastStage = name;
    this.stage = name;
    if (this.viewing) this.closeViewer();
    this.layout('stage');
  }

  cycleStage() {
    const i = STAGE_ORDER.indexOf(this.stage);
    this.setStage(STAGE_ORDER[(i + 1) % STAGE_ORDER.length]);
  }

  toggleOverview() { this.setStage(this.stage === 'overview' ? this.lastStage : 'overview'); }

  cycleTheme() {
    const i = THEMES.indexOf(currentTheme());
    applyTheme(THEMES[(i + 1) % THEMES.length]);
    this.toast(`主題:${THEME_NAMES[currentTheme()]}`);
  }

  onCardClick(gi) {
    if (this.stage === 'overview') { this.stage = this.lastStage; this.focus = gi; this.cur = this.slides[gi].sec; this.layout('stage'); return; }
    if (gi === this.focus) return this.openViewer();
    const prevSec = this.cur;
    this.focus = gi;
    this.cur = this.slides[gi].sec;
    this.layout(this.cur !== prevSec && STAGES[this.stage].shuffle ? 'shuffle' : 'focus');
  }

  onWheel(e) {
    e.preventDefault();
    const now = Date.now();
    if (now - (this.lastWheel || 0) < 160) return;
    this.lastWheel = now;
    const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(d) < 4) return;
    d > 0 ? this.goTo(this.focus + 1) : this.goTo(this.focus - 1);
  }

  onKey(e) {
    if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (this.el.black.classList.contains('on')) { e.preventDefault(); this.el.black.classList.remove('on'); return; }
    if (this.el.help.classList.contains('on') && k !== '?') { this.toggleHelp(false); if (k === 'Escape') return; }
    const handled = this.command(k);
    if (handled) e.preventDefault();
  }

  command(k) {
    switch (k) {
      case 'ArrowRight': case 'PageDown': case 'n': case 'N': this.next(); break;
      case 'ArrowLeft': case 'PageUp': this.prev(); break;
      case ' ': this.viewing ? this.next() : this.openViewer(); break;
      case 'ArrowDown': this.setSection(this.cur + 1); break;
      case 'ArrowUp': this.setSection(this.cur - 1); break;
      case 'Home': this.goTo(0); break;
      case 'End': this.goTo(this.slides.length - 1); break;
      case 'Enter': this.viewing ? this.closeViewer() : this.openViewer(); break;
      case 'Escape':
        if (this.viewing) this.closeViewer();
        else if (this.stage === 'overview') this.toggleOverview();
        else if (document.fullscreenElement) document.exitFullscreen();
        else this.exit();
        break;
      case 'o': case 'O': this.toggleOverview(); break;
      case 'l': case 'L': this.cycleStage(); break;
      case 't': case 'T': this.cycleTheme(); break;
      case 'b': case 'B': case '.': this.el.black.classList.add('on'); break;
      case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); break;
      case 's': case 'S': this.openPresenter(); break;
      case 'p': case 'P': this.print(); break;
      case 'k': case 'K': this.el.frame.querySelectorAll('video, audio').forEach(v => (v.paused ? v.play() : v.pause())); break;
      case '?': case '/': this.toggleHelp(); break;
      default:
        if (/^[1-9]$/.test(k)) { const numbered = this.sections.map((s, i) => [s, i]).filter(([s]) => s.folder); const t = numbered[+k - 1]; if (t) this.setSection(t[1]); break; }
        return false;
    }
    return true;
  }

  toggleHelp(force) { this.el.help.classList.toggle('on', force); }

  toast(msg) {
    let t = this.root.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; this.el.player.appendChild(t); }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('on'), 1600);
  }

  // ---------------- 放大檢視 ----------------
  fit() {
    const sc = Math.min(window.innerWidth * 0.92 / 1280, (window.innerHeight - 96) / 720);
    return { sc, t: `translate(${(window.innerWidth - 1280 * sc) / 2}px, ${(window.innerHeight - 720 * sc) / 2 - 6}px) scale(${sc})` };
  }

  renderFull(gi) {
    return renderSlide(this.slides[gi], { deck: this.deck, mode: 'full', globalIndex: gi, total: this.slides.length });
  }

  openViewer() {
    if (this.stage === 'overview') { this.stage = this.lastStage; this.layout('stage'); }
    const card = this.cards[this.focus];
    const r = card.getBoundingClientRect();
    this.viewing = true;
    this.fillFrame();
    const f = this.fit();
    this.el.frame.style.transform = f.t;
    this.el.frame.style.opacity = 1;
    this.el.frame.animate([{ transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / 1280})` }, { transform: f.t }], { duration: 560, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    this.el.viewer.classList.add('on');
    this.el.player.classList.add('viewing');
    this.hideCard(card);
    card.classList.remove('focus');
    this.syncThumbVideo();
    this.broadcast();
  }

  closeViewer() {
    if (!this.viewing) return;
    this.viewing = false;
    stopMedia(this.el.frame);
    const card = this.cards[this.focus];
    const r = card.getBoundingClientRect();
    this.el.viewer.classList.remove('on');
    this.el.player.classList.remove('viewing');
    const a = this.el.frame.animate([{ transform: this.fit().t }, { transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / 1280})` }], { duration: 440, easing: 'cubic-bezier(.4, 0, .2, 1)' });
    this.el.frame.style.opacity = 0;
    a.onfinish = () => { this.showCard(); card.classList.add('focus'); this.el.frame.innerHTML = ''; this.syncThumbVideo(); };
    this.broadcast();
  }

  hideCard(card) { this.showCard(); this.hiddenCard = card; card.style.visibility = 'hidden'; }
  showCard() { if (this.hiddenCard) this.hiddenCard.style.visibility = ''; this.hiddenCard = null; }

  fillFrame() {
    stopMedia(this.el.frame);
    this.el.frame.innerHTML = this.renderFull(this.focus);
    const slide = this.slides[this.focus];
    this.steps = [];
    this.stepIndex = 0;
    if (slide.meta?.step) {
      this.steps = [...this.el.frame.querySelectorAll('.md > ul > li, .md > ol > li, .stat, .tl-item, .col, .ag')];
      this.steps.forEach(s => s.classList.add('step', 'hidden'));
    }
    hydrate(this.el.frame, this.source, { full: true }).then(() => { if (this.viewing) playMedia(this.el.frame, { sound: true }); });
  }

  showInViewer(dir) {
    this.hideCard(this.cards[this.focus]);
    this.fillFrame();
    this.el.frame.firstElementChild?.animate([{ transform: `translateX(${dir * 70}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }

  // ---------------- 講者視窗 ----------------
  openPresenter() {
    if (!this.channel) return this.toast('這個瀏覽器不支援講者視窗');
    const w = window.open(`${location.pathname}#/presenter`, 'mdslide-presenter', 'width=1200,height=760');
    if (!w) this.toast('瀏覽器擋住了彈出視窗,請允許後再按 S');
    this.startedAt = Date.now();
  }

  onPresenterMessage(m) {
    if (!m) return;
    if (m.type === 'hello') { this.presenterSeen = true; this.broadcast(); }
    if (m.type === 'key') this.command(m.key);
  }

  async broadcast() {
    if (!this.channel || !this.presenterSeen) return; // 沒開講者視窗就不做事
    const gi = this.focus;
    const cur = this.renderFull(gi);
    const next = gi + 1 < this.slides.length ? this.renderFull(gi + 1) : '';
    const paths = [...(cur + next).matchAll(/data-(?:media|bg)="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
    const media = {};
    await Promise.all(paths.map(p => (/^(https?:|data:)/.test(p) ? Promise.resolve(p) : this.source.mediaURL(p)).then(u => { media[p] = u; }, () => {})));
    const s = this.slides[gi];
    this.channel.postMessage({
      type: 'state', title: this.deck.title, section: this.sections[s.sec]?.title || '',
      n: gi + 1, total: this.slides.length, cur, next, media, theme: currentTheme(),
      notes: s.notes ? renderMarkdown(s.notes) : '', steps: this.steps.length, step: this.stepIndex, viewing: this.viewing, startedAt: this.startedAt,
    });
  }

  // ---------------- 列印 / PDF ----------------
  async print() {
    this.toast('準備列印中…');
    const box = document.createElement('div');
    box.id = 'print-root';
    box.innerHTML = this.slides.map((_, gi) => `<div class="print-page">${this.renderFull(gi)}</div>`).join('');
    document.body.appendChild(box);
    await hydrate(box, this.source);
    await Promise.all([...box.querySelectorAll('img')].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
    document.documentElement.classList.add('printing');
    const done = () => { document.documentElement.classList.remove('printing'); box.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(() => { if (document.getElementById('print-root')) done(); }, 60000);
  }
}

export { CW };
