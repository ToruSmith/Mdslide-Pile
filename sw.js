// 離線快取:只快取「網站本身」(遊戲機),不快取你的簡報內容。
// 策略:先用快取回應、同時在背景更新(stale-while-revalidate),所以不需要手動改版本號;
// 部署新版後,使用者重新整理第二次就會拿到新版。

const CACHE = 'mdslide-shell';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const shell = url.pathname.endsWith('/') || /\.(html|js|css|svg|ico|webmanifest)$/.test(url.pathname);
  if (!shell || url.pathname.includes('/content/')) return; // 簡報內容與 catalog.json 一律走網路
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request);
    const fresh = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
