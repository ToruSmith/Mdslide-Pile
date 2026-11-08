// 把 render.js 輸出的媒體佔位(data-media / data-embed / data-bg)換成真正的網址。
// 只在需要時呼叫:縮圖只處理目前章節附近,放大時才建立 iframe 與播放影片。

import { isURL } from '../core/names.js';
import { escapeHTML } from '../core/markdown.js';
import { t } from '../core/i18n.js';

export async function hydrate(root, source, { full = false } = {}) {
  const jobs = [];
  for (const el of root.querySelectorAll('[data-media]:not([data-ready])')) {
    el.dataset.ready = '1';
    const path = el.dataset.media;
    jobs.push((isURL(path) ? Promise.resolve(path) : source.mediaURL(path)).then(url => {
      if (el.tagName === 'IMG') { el.decoding = 'async'; el.src = url; el.onerror = () => missing(el, path); }
      else { el.preload = full ? 'auto' : 'metadata'; el.src = url; }
    }, () => missing(el, path)));
  }
  for (const el of root.querySelectorAll('img[data-thumb]:not([data-ready])')) {
    el.dataset.ready = '1';
    el.onerror = () => el.remove(); // 縮圖載入失敗(例如離線)就直接移除,露出預設底色
    el.src = el.dataset.thumb;
  }
  const slides = root.matches?.('.slide[data-bg]') ? [root] : [...root.querySelectorAll('.slide[data-bg]:not([data-ready])')];
  for (const s of slides) {
    s.dataset.ready = '1';
    const p = s.dataset.bg;
    jobs.push((isURL(p) ? Promise.resolve(p) : source.mediaURL(p)).then(url => {
      s.style.background = `linear-gradient(color-mix(in srgb, var(--slide-bg) 78%, transparent), color-mix(in srgb, var(--slide-bg) 78%, transparent)), url("${url}") center / cover`;
    }, () => {}));
  }
  if (full) {
    for (const fig of root.querySelectorAll('[data-embed]')) {
      if (fig.querySelector('iframe')) continue;
      const f = document.createElement('iframe');
      f.src = fig.dataset.embed;
      f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      // 嵌入的播放器不能把整頁導走、不能下載或送出表單;播放、全螢幕、在新分頁開啟仍可用
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox');
      fig.querySelector('.poster')?.remove();
      fig.prepend(f);
    }
  }
  await Promise.all(jobs);
}

function missing(el, path) {
  const fig = el.closest('figure');
  const box = document.createElement('div');
  box.className = 'missing';
  const lang = el.closest('[lang]')?.getAttribute('lang'); // 依簡報語言,不是介面語言
  box.innerHTML = `${escapeHTML(t('slide.missingMedia', null, lang))}<br><small>${escapeHTML(path)}</small>`;
  if (fig) { el.remove(); fig.append(box); } else el.replaceWith(box);
}

export function playMedia(root, { sound = false } = {}) {
  for (const v of root.querySelectorAll('video, audio')) {
    if (sound) { v.muted = false; v.controls = true; v.currentTime = 0; }
    v.play()?.catch(() => { v.muted = true; v.play()?.catch(() => {}); });
  }
}

export function stopMedia(root) {
  for (const v of root.querySelectorAll('video, audio')) v.pause();
  for (const f of root.querySelectorAll('iframe')) f.src = 'about:blank';
}
