const CACHE_NAME = 'dashboard-ti-v2'
const APP_SHELL = ['/', '/favicon.png', '/manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(chave => chave !== CACHE_NAME).map(chave => caches.delete(chave))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(resposta => {
          const copia = resposta.clone()
          caches.open(CACHE_NAME).then(cache => cache.put('/', copia))
          return resposta
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then(cache => cache || fetch(event.request).then(resposta => {
      if (resposta.ok) {
        const copia = resposta.clone()
        caches.open(CACHE_NAME).then(armazenamento => armazenamento.put(event.request, copia))
      }
      return resposta
    }))
  )
})
