// دكتور أور — Service Worker
// الواجهة: شبكة أولاً مع نسخة احتياطية للعمل دون اتصال. الملفات الثابتة: من الذاكرة مع تحديث بالخلفية.
// لا يُخزَّن أي طلب لخوادم Supabase أو الخرائط: بيانات الحسابات لا تبقى على الجهاز.
const VERSION = '5.1.0';
const CACHE = 'basma-' + VERSION;
const SHELL = ['./', './index.html', './offline.html', './css/app.css?v=5.1.0', './js/app.js?v=5.1.0', './js/theme-init.js',
  './js/core/util.js', './js/core/native.js', './js/core/art.js', './js/core/state.js', './js/core/maps.js', './js/core/media.js', './js/components/doctor.js',
  './js/services/live.js', './js/services/demo.js', './js/pages/home.js', './js/pages/map.js', './js/pages/doctor.js', './js/pages/booking.js',
  './js/pages/auth.js', './js/pages/dash.js', './js/pages/admin.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('basma-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/config.js')) { e.respondWith(fetch(r).catch(() => caches.match(r))); return; }
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); return res; })
      .catch(() => caches.match('./index.html').then(x => x || caches.match('./offline.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
