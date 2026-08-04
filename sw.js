const CACHE='lumi-v17';
const CORE=['./','./index.html','./styles.css?v=17','./data.js?v=17','./content.js?v=17','./app.js?v=17'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin===location.origin&&(u.pathname.endsWith('/')||u.pathname.endsWith('.html')||u.pathname.endsWith('.js')||u.pathname.endsWith('.css'))){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));}else{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));}});
