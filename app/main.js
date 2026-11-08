// 入口與路由。網址格式:
//   #/                         首頁(選擇書庫)
//   #/repo                     倉庫內建的書庫(content/)
//   #/local/<id>               記住的本機資料夾(Chrome / Edge)
//   #/session                  這次開啟的本機資料夾(其他瀏覽器;重新整理後需要再選一次)
//   #/<書庫>/<主題>/<簡報>/<第幾張>
//   #/presenter                講者視窗

import { scanLibrary, loadDeck, refreshProject } from './core/library.js';
import { escapeHTML as esc } from './core/markdown.js';
import { HttpSource, HandleSource, FileListSource, sourceFromDrop, canPickDirectory } from './sources/sources.js';
import { listRecent, remember, getRecent, forget, ensurePermission } from './sources/store.js';
import { renderLibrary } from './ui/library-view.js';
import { Player } from './player/player.js';
import { openExportDialog } from './player/export.js';
import { startPresenter } from './player/presenter.js';
import { applyTheme } from './player/themes.js';
import { t, setLang, getLang, normalizeLang } from './core/i18n.js';

export const VERSION = '1.6.1';
const REPO_URL = 'https://github.com/ToruSmith/Mdslide-Pile';

const app = document.getElementById('app');

// ---------------- 介面語言 ----------------
// 順序:使用者選擇(localStorage)→ 瀏覽器語言(zh 開頭 = 繁中,其他 = 英文)→ 繁中
const LANG_KEY = 'mdslide-lang';
function pickLang() {
  let saved = null;
  try { saved = normalizeLang(localStorage.getItem(LANG_KEY)); } catch { /* 隱私模式 */ }
  if (saved) return saved;
  const nav = navigator.language;
  return nav ? (normalizeLang(nav) === 'zh-Hant' ? 'zh-Hant' : 'en') : 'zh-Hant';
}
function applyLang(lang) {
  setLang(lang);
  document.documentElement.lang = getLang();
  document.body.dataset.drop = t('drop.hint');
}
applyLang(pickLang());
const state = { sources: new Map(), libs: new Map(), player: null, playerKey: '', cleanup: null, session: null };

// ---------------- 路由 ----------------
async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'presenter') return startPresenter(app);

  let key, rest;
  if (parts[0] === 'repo' || parts[0] === 'session') { key = parts[0]; rest = parts.slice(1); }
  else if (parts[0] === 'local' && parts[1]) { key = `local/${parts[1]}`; rest = parts.slice(2); }
  else return leavePlayer(), home();

  const [topicId, projectId, n, view] = rest;
  if (topicId && projectId) {
    const deckKey = `${key}/${topicId}/${projectId}`;
    const reading = view === 'read'; // …/第幾張/read = 閱讀模式(可以直接分享這個連結)
    if (state.player && state.playerKey === deckKey) {
      if (reading && !state.player.reader) state.player.openReading();
      else if (!reading && state.player.reader) state.player.closeReading();
      else if (n && !state.player.reader) state.player.goTo(Number(n) - 1);
      return;
    }
    leavePlayer();
    return openDeck(key, topicId, projectId, Number(n || 1) - 1, reading);
  }
  leavePlayer();
  return showLibrary(key);
}

function leavePlayer() {
  state.player?.destroy();
  state.player = null;
  state.playerKey = '';
  state.cleanup?.();
  state.cleanup = null;
  state.stopWatch?.();
  state.stopWatch = null;
}

// ---------------- 資料來源 ----------------
async function getSource(key) {
  if (state.sources.has(key)) return state.sources.get(key);
  let src = null;
  if (key === 'repo') src = await HttpSource.open();
  else if (key === 'session') src = state.session;
  else if (key.startsWith('local/')) {
    const rec = await getRecent(key.slice(6));
    if (!rec) throw new UserError(t('err.noRecord'));
    if (!(await ensurePermission(rec.handle))) return { needsPermission: rec };
    src = new HandleSource(rec.handle, rec.id);
  }
  if (!src) throw new UserError(t('err.sessionGone'));
  state.sources.set(key, src);
  return src;
}

async function getLibrary(key, source) {
  if (!state.libs.has(key)) state.libs.set(key, await scanLibrary(source));
  return state.libs.get(key);
}

class UserError extends Error {}

// ---------------- 畫面 ----------------
function header(active = '') {
  return `<header class="topbar">
    <a class="brand" href="#/"><span class="logo"><i></i><i></i><i></i></span>Mdslide Pile</a>
    <nav>
      <a href="#/repo" class="${active === 'repo' ? 'on' : ''}">${t('nav.repo')}</a>
      <a href="#/" class="${active === 'home' ? 'on' : ''}">${t('nav.home')}</a>
      <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a>
      <button class="lang-toggle" aria-label="${esc(t('lang.label'))}" title="${esc(t('lang.label'))}"><b class="${getLang() === 'zh-Hant' ? 'on' : ''}">${t('lang.zhShort')}</b> / <b class="${getLang() === 'en' ? 'on' : ''}">EN</b></button>
    </nav>
  </header>`;
}

function loading(msg = t('loading')) {
  app.innerHTML = `<div class="loading"><div class="spinner"><i></i><i></i><i></i></div><p>${esc(msg)}</p></div>`;
}

// 連不上網路時,各瀏覽器丟出的錯誤:Chrome「Failed to fetch」、Firefox「NetworkError…」、Safari「Load failed」
const isNetworkError = err => err instanceof TypeError && /fetch|network|load failed/i.test(err.message);

function showError(err) {
  console.error(err);
  const offline = isNetworkError(err) || navigator.onLine === false;
  const msg = err instanceof UserError ? err.message : offline ? t('err.offline') : (err.message || String(err));
  app.innerHTML = `${header()}<div class="error-box"><h2>${t(offline ? 'err.offlineTitle' : 'err.title')}</h2><p>${esc(msg)}</p><a class="btn" href="#/">${t('nav.backHome')}</a></div>`;
}

async function home() {
  applyTheme('paper');
  document.title = t('doc.title');
  const recent = await listRecent();
  let repoOK = true;
  try { await getSource('repo'); } catch { repoOK = false; }
  app.innerHTML = `
    ${header('home')}
    <main class="home">
      <section class="hero">
        <div class="hero-text">
          <div class="eyebrow">${t('home.eyebrow')}</div>
          <h1>${t('home.title')}</h1>
          <p>${t('home.lead')}</p>
          <div class="actions">
            <button class="btn primary open-folder">${t('home.open')}</button>
            ${repoOK ? `<a class="btn ghost" href="#/repo">${t('home.repo')}</a>` : ''}
          </div>
          <p class="small">${canPickDirectory() ? t('home.tipPicker') : t('home.tipNoPicker')}</p>
        </div>
        <div class="hero-art" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      </section>
      ${recent.length ? `<section class="recent"><h2>${t('home.recent')}</h2><ul>${recent.map(r => `
        <li><a href="#/local/${r.id}"><b>${esc(r.name)}</b><small>${new Date(r.lastOpened).toLocaleString(getLang() === 'en' ? 'en-US' : 'zh-TW', { dateStyle: 'medium', timeStyle: 'short' })}</small></a><button class="forget" data-id="${r.id}" title="${esc(t('home.forget'))}" aria-label="${esc(t('home.forget'))}">×</button></li>`).join('')}</ul></section>` : ''}
      <section class="howto">
        <div><b>1</b><h3>${t('home.step1.title')}</h3><p>${t('home.step1.text')}</p></div>
        <div><b>2</b><h3>${t('home.step2.title')}</h3><p>${t('home.step2.text')}</p></div>
        <div><b>3</b><h3>${t('home.step3.title')}</h3><p>${t('home.step3.text')}</p></div>
      </section>
      <p class="foot-note">${t('home.rules')}<a href="${REPO_URL}/blob/main/${t('home.guidePath')}" target="_blank" rel="noopener">${t('home.guideName')}</a> · v${VERSION}</p>
      <input type="file" class="dir-input" webkitdirectory directory multiple hidden>
    </main>`;

  app.querySelector('.open-folder').onclick = openFolder;
  app.querySelectorAll('.forget').forEach(b => b.onclick = async e => { e.preventDefault(); await forget(b.dataset.id); home(); });
  const input = app.querySelector('.dir-input');
  input.onchange = () => { if (input.files.length) useSession(FileListSource.fromInput(input.files)); };
}

async function openFolder() {
  if (canPickDirectory()) {
    try {
      const handle = await window.showDirectoryPicker({ id: 'mdslide-library', mode: 'read' });
      const id = await remember(handle);
      state.sources.delete(`local/${id}`);
      state.libs.delete(`local/${id}`);
      location.hash = `#/local/${id}`;
    } catch (e) { if (e.name !== 'AbortError') showError(e); }
  } else {
    app.querySelector('.dir-input')?.click();
  }
}

async function useSession(source) {
  if (source instanceof HandleSource) {
    const id = await remember(source.handle);
    state.sources.delete(`local/${id}`); state.libs.delete(`local/${id}`);
    location.hash = `#/local/${id}`;
    return;
  }
  state.session = source;
  state.sources.delete('session');
  state.libs.delete('session');
  leavePlayer();
  if (location.hash === '#/session') route(); else location.hash = '#/session';
}

async function showLibrary(key) {
  loading(t('loading.library'));
  try {
    const source = await getSource(key);
    if (source.needsPermission) return permissionScreen(source.needsPermission);
    const lib = await getLibrary(key, source);
    const urlKey = key;
    if (lib.kind === 'deck' && lib.topics[0]?.projects.length === 1) {
      // 開的是單一簡報資料夾:直接進播放器
      const tp = lib.topics[0], p = tp.projects[0];
      location.replace(`#/${urlKey}/${encodeURIComponent(tp.id)}/${encodeURIComponent(p.id)}`);
      return;
    }
    state.cleanup = renderLibrary(app, {
      lib, source, sourceKey: urlKey.split('/').map(encodeURIComponent).join('/'),
      header: header(key === 'repo' ? 'repo' : 'home'),
      onOpen: (topic, p) => { location.hash = `#/${urlKey}/${encodeURIComponent(topic)}/${encodeURIComponent(p)}`; },
      onRefresh: key === 'repo' ? null : () => { source.refresh?.(); state.libs.delete(key); showLibrary(key); },
    });
    document.title = `${lib.title} · Mdslide Pile`;
  } catch (e) { showError(e); }
}

function permissionScreen(rec) {
  app.innerHTML = `${header('home')}<div class="error-box"><h2>${t('perm.title', { name: esc(rec.name) })}</h2><p>${t('perm.text')}</p><button class="btn primary grant">${t('perm.grant')}</button> <a class="btn ghost" href="#/">${t('nav.backHome')}</a></div>`;
  app.querySelector('.grant').onclick = async () => {
    try {
      if (await ensurePermission(rec.handle, true)) { await remember(rec.handle); route(); }
    } catch (e) { showError(new UserError(t('err.cannotRead'))); }
  };
}

async function openDeck(key, topicId, projectId, start, reading = false) {
  loading(t('loading.deck'));
  try {
    const source = await getSource(key);
    if (source.needsPermission) return permissionScreen(source.needsPermission);
    const lib = await getLibrary(key, source);
    const project = lib.topics.find(tp => tp.id === topicId)?.projects.find(p => p.id === projectId);
    if (!project) throw new UserError(t('err.noDeck'));
    const deck = await loadDeck(source, project);
    if (!deck.sections.length) throw new UserError(t('err.emptyDeck'));
    const base = `#/${key.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(topicId)}/${encodeURIComponent(projectId)}`;
    const backToLibrary = lib.kind === 'deck' ? '#/' : `#/${key}`;
    state.playerKey = `${key}/${topicId}/${projectId}`;
    // 即時重新載入:只有 Chrome / Edge 的資料夾(HandleSource)偵測得到檔案變動
    let current = project, busy = false;
    const reload = source.kind === 'handle' ? async () => {
      if (busy) return null;
      busy = true;
      try {
        source.refresh();
        state.libs.delete(key); // 回到目錄時重新讀取(標題可能改了)
        current = await refreshProject(source, current);
        return await loadDeck(source, current);
      } finally { busy = false; }
    } : null;
    state.player = new Player(app, {
      deck, source, start, reading, theme: deck.theme || lib.theme, onReload: reload,
      onExport: openExportDialog,
      onExit: () => { location.hash = backToLibrary; },
      onIndex: (i, read) => history.replaceState(null, '', `${base}/${i + 1}${read ?? state.player?.reader ? '/read' : ''}`),
    });
    document.title = `${deck.title} · Mdslide Pile`;
    if (reload) {
      const dirs = [...new Set([deck.path, ...deck.sections.map(s => s.path)])];
      state.stopWatch = source.watch(dirs, async () => {
        const next = await reload();
        if (next && state.player) state.player.replaceDeck(next);
      });
    }
  } catch (e) { showError(e); }
}

// ---------------- 切換語言 ----------------
document.addEventListener('click', e => {
  if (!e.target.closest('.lang-toggle')) return;
  const next = getLang() === 'zh-Hant' ? 'en' : 'zh-Hant';
  try { localStorage.setItem(LANG_KEY, next); } catch { /* 隱私模式 */ }
  applyLang(next);
  state.libs.clear(); // 目錄裡的提醒訊息是讀取時產生的,換語言要重讀
  route();
});

// ---------------- 拖放資料夾 ----------------
window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
window.addEventListener('drop', async e => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  if (state.player) return;
  try {
    const src = await sourceFromDrop(e.dataTransfer);
    if (src) useSession(src); else showError(new UserError(t('err.dropFolder')));
  } catch (err) { showError(err); }
});

window.addEventListener('hashchange', route);
route();

// 離線也能用:把網站本身快取起來(你的簡報檔案不會被快取)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // updateViaCache: 'none':檢查新版時不要用瀏覽器快取(GitHub Pages 會快取 10 分鐘)
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => {});
  // 新版接手後,目前這一頁還是舊程式:提示重新整理(不自動重新整理,以免打斷正在播放的簡報)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || document.querySelector('.update-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span>${esc(t('update.ready'))}</span><button class="btn primary" data-u="reload">${esc(t('update.reload'))}</button><button class="btn ghost" data-u="later">${esc(t('update.later'))}</button>`;
    bar.addEventListener('click', e => {
      const u = e.target.closest('[data-u]')?.dataset.u;
      if (u === 'reload') location.reload();
      if (u === 'later') bar.remove();
    });
    document.body.append(bar);
  });
}
