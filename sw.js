/* Yörünge Ağı — çevrimdışı oynama için service worker
   Kod dosyaları: önce ağ (güncellemeler hemen gelsin), yoksa önbellek
   Büyük sabit dosyalar (three.js, dokular, simgeler): önce önbellek */
const VERSION = 'ya-v3-3';
const CORE = [
  './', 'css/style.css', 'manifest.webmanifest', 'favicon.svg',
  'js/textures.js', 'js/sim.js', 'js/progress.js', 'js/models.js', 'js/hangar.js', 'js/game.js',
  'vendor/three/build/three.module.js',
  'vendor/three/examples/jsm/environments/RoomEnvironment.js',
  'vendor/three/examples/jsm/postprocessing/EffectComposer.js', 'vendor/three/examples/jsm/postprocessing/RenderPass.js',
  'vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js', 'vendor/three/examples/jsm/postprocessing/OutputPass.js',
  'vendor/three/examples/jsm/postprocessing/Pass.js', 'vendor/three/examples/jsm/postprocessing/ShaderPass.js', 'vendor/three/examples/jsm/postprocessing/MaskPass.js',
  'vendor/three/examples/jsm/shaders/CopyShader.js', 'vendor/three/examples/jsm/shaders/LuminosityHighPassShader.js', 'vendor/three/examples/jsm/shaders/OutputShader.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const STATIC = /\/(vendor|icons)\/|textures(-hi)?\.js$/;
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.includes('/api/')) return;
  if (STATIC.test(url.pathname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; })));
    return;
  }
  e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match('./'))));
});
