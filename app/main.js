// 入口與路由。網址格式:
//   #/                         首頁(選擇書庫)
//   #/repo                     倉庫內建的書庫(content/)
//   #/local/<id>               記住的本機資料夾(Chrome / Edge)
//   #/session                  這次開啟的本機資料夾(其他瀏覽器;重新整理後需要再選一次)
//   #/<書庫>/<主題>/<簡報>/<第幾張>
//   #/presenter                講者視窗

import { scanLibrary, loadDeck } from './core/library.js';
import { escapeHTML as esc } from './core/markdown.js';
import { HttpSource, HandleSource, FileListSource, sourceFromDrop, canPickDirectory } from './sources/sources.js';
import { listRecent, remember, getRecent, forget, ensurePermission } from './sources/store.js';
import { renderLibrary } from './ui/library-view.js';
import { Player } from './player/player.js';
import { startPresenter } from './player/presenter.js';
import { applyTheme } from './player/themes.js';

export const VERSION = '1.2.0';
const REPO_URL = 'https://github.com/ToruSmith/Mdslide-Pile';

const app = document.getElementById('app');
const state = { sources: new Map(), libs: new Map(), player: null, playerKey: '', cleanup: null, session: null };

// ---------------- 路由 ----------------
async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'presenter') return startPresenter(app);

  let key, rest;
  if (parts[0] === 'repo' || parts[0] === 'session') { key = parts[0]; rest = parts.slice(1); }
  else if (parts[0] === 'local' && parts[1]) { key = `local/${parts[1]}`; rest = parts.slice(2); }
  else return leavePlayer(), home();

  const [topicId, projectId, n] = rest;
  if (topicId && projectId) {
    const deckKey = `${key}/${topicId}/${projectId}`;
    if (state.player && state.playerKey === deckKey) { if (n) state.player.goTo(Number(n) - 1); return; }
    leavePlayer();
    return openDeck(key, topicId, projectId, Number(n || 1) - 1);
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
}

// ---------------- 資料來源 ----------------
async function getSource(key) {
  if (state.sources.has(key)) return state.sources.get(key);
  let src = null;
  if (key === 'repo') src = await HttpSource.open();
  else if (key === 'session') src = state.session;
  else if (key.startsWith('local/')) {
    const rec = await getRecent(key.slice(6));
    if (!rec) throw new UserError('找不到這個書庫的紀錄,請重新開啟資料夾。');
    if (!(await ensurePermission(rec.handle))) return { needsPermission: rec };
    src = new HandleSource(rec.handle, rec.id);
  }
  if (!src) throw new UserError('這次開啟的資料夾已經失效(重新整理頁面後需要再選一次)。');
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
      <a href="#/repo" class="${active === 'repo' ? 'on' : ''}">內建範例</a>
      <a href="#/" class="${active === 'home' ? 'on' : ''}">我的書庫</a>
      <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </header>`;
}

function loading(msg = '讀取中…') {
  app.innerHTML = `<div class="loading"><div class="spinner"><i></i><i></i><i></i></div><p>${esc(msg)}</p></div>`;
}

function showError(err) {
  console.error(err);
  app.innerHTML = `${header()}<div class="error-box"><h2>出了點問題</h2><p>${esc(err instanceof UserError ? err.message : (err.message || String(err)))}</p><a class="btn" href="#/">回首頁</a></div>`;
}

async function home() {
  applyTheme('paper');
  const recent = await listRecent();
  let repoOK = true;
  try { await getSource('repo'); } catch { repoOK = false; }
  app.innerHTML = `
    ${header('home')}
    <main class="home">
      <section class="hero">
        <div class="hero-text">
          <div class="eyebrow">把資料夾變成會動的簡報</div>
          <h1>網站是遊戲機,<br>你的資料夾是遊戲片。</h1>
          <p>簡報檔案留在你的電腦或隨身碟裡,這裡只負責播放。不用安裝、不用上傳。</p>
          <div class="actions">
            <button class="btn primary open-folder">開啟本機資料夾</button>
            ${repoOK ? '<a class="btn ghost" href="#/repo">看內建範例</a>' : ''}
          </div>
          <p class="small">${canPickDirectory() ? '也可以直接把資料夾拖進這個視窗。Chrome / Edge 會記住你開過的書庫。' : '也可以直接把資料夾拖進這個視窗。這個瀏覽器無法記住資料夾,重新整理後需要再選一次;用 Chrome 或 Edge 體驗最好。'}</p>
        </div>
        <div class="hero-art" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      </section>
      ${recent.length ? `<section class="recent"><h2>最近開啟的書庫</h2><ul>${recent.map(r => `
        <li><a href="#/local/${r.id}"><b>${esc(r.name)}</b><small>${new Date(r.lastOpened).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })}</small></a><button class="forget" data-id="${r.id}" title="從清單移除(不會刪除檔案)">×</button></li>`).join('')}</ul></section>` : ''}
      <section class="howto">
        <div><b>1</b><h3>準備資料夾</h3><p>一個資料夾一份簡報,子資料夾是章節,每個 .md 檔是一張投影片。</p></div>
        <div><b>2</b><h3>開啟</h3><p>開啟整個書庫、一個主題,或單一簡報資料夾都可以,會自動判斷。</p></div>
        <div><b>3</b><h3>上台</h3><p>Enter 放大、方向鍵翻頁、S 開講者視窗、P 存成 PDF。</p></div>
      </section>
      <p class="foot-note">規則說明:<a href="${REPO_URL}/blob/main/製作專案指南.md" target="_blank" rel="noopener">製作專案指南.md</a> · v${VERSION}</p>
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
  loading('讀取書庫目錄…');
  try {
    const source = await getSource(key);
    if (source.needsPermission) return permissionScreen(source.needsPermission);
    const lib = await getLibrary(key, source);
    const urlKey = key;
    if (lib.kind === 'deck' && lib.topics[0]?.projects.length === 1) {
      // 開的是單一簡報資料夾:直接進播放器
      const t = lib.topics[0], p = t.projects[0];
      location.replace(`#/${urlKey}/${encodeURIComponent(t.id)}/${encodeURIComponent(p.id)}`);
      return;
    }
    state.cleanup = renderLibrary(app, {
      lib, source, sourceKey: urlKey.split('/').map(encodeURIComponent).join('/'),
      header: header(key === 'repo' ? 'repo' : 'home'),
      onOpen: (t, p) => { location.hash = `#/${urlKey}/${encodeURIComponent(t)}/${encodeURIComponent(p)}`; },
      onRefresh: key === 'repo' ? null : () => { source.refresh?.(); state.libs.delete(key); showLibrary(key); },
    });
    document.title = `${lib.title} · Mdslide Pile`;
  } catch (e) { showError(e); }
}

function permissionScreen(rec) {
  app.innerHTML = `${header('home')}<div class="error-box"><h2>重新連線「${esc(rec.name)}」</h2><p>為了保護你的檔案,瀏覽器每次重新開啟都需要再確認一次讀取權限。<br>如果是隨身碟,請先確認已經插上。</p><button class="btn primary grant">允許讀取</button> <a class="btn ghost" href="#/">回首頁</a></div>`;
  app.querySelector('.grant').onclick = async () => {
    try {
      if (await ensurePermission(rec.handle, true)) { await remember(rec.handle); route(); }
    } catch (e) { showError(new UserError('無法讀取這個資料夾,可能已被移動或隨身碟未插上。')); }
  };
}

async function openDeck(key, topicId, projectId, start) {
  loading('讀取簡報…');
  try {
    const source = await getSource(key);
    if (source.needsPermission) return permissionScreen(source.needsPermission);
    const lib = await getLibrary(key, source);
    const project = lib.topics.find(t => t.id === topicId)?.projects.find(p => p.id === projectId);
    if (!project) throw new UserError('找不到這份簡報,可能已經改名或移除。');
    const deck = await loadDeck(source, project);
    if (!deck.sections.length) throw new UserError('這份簡報裡沒有投影片。');
    const base = `#/${key.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(topicId)}/${encodeURIComponent(projectId)}`;
    const backToLibrary = lib.kind === 'deck' ? '#/' : `#/${key}`;
    state.playerKey = `${key}/${topicId}/${projectId}`;
    state.player = new Player(app, {
      deck, source, start, theme: deck.theme || lib.theme,
      onExit: () => { location.hash = backToLibrary; },
      onIndex: i => history.replaceState(null, '', `${base}/${i + 1}`),
    });
    document.title = `${deck.title} · Mdslide Pile`;
  } catch (e) { showError(e); }
}

// ---------------- 拖放資料夾 ----------------
window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
window.addEventListener('drop', async e => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  if (state.player) return;
  try {
    const src = await sourceFromDrop(e.dataTransfer);
    if (src) useSession(src); else showError(new UserError('請拖入「資料夾」,不是單一檔案。'));
  } catch (err) { showError(err); }
});

window.addEventListener('hashchange', route);
route();

// 離線也能用:把網站本身快取起來(你的簡報檔案不會被快取)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
