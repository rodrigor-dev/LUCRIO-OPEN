const CACHE_NAME = "lucrio-cache-v1";
const STATIC_CACHE = "lucrio-static-v1";

const urlsParaCache = [
  "/",
  "/login",
  "/cadastro",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(urlsParaCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomesCache) => {
      return Promise.all(
        nomesCache
          .filter((nome) => nome !== CACHE_NAME && nome !== STATIC_CACHE)
          .map((nome) => caches.delete(nome))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((resposta) => {
          const clone = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return resposta;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((respostaCache) => {
      if (respostaCache) {
        fetch(request)
          .then((resposta) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, resposta);
            });
          })
          .catch(() => {});
        return respostaCache;
      }

      return fetch(request).then((resposta) => {
        if (!resposta || resposta.status !== 200) return resposta;

        const clone = resposta.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, clone);
        });

        return resposta;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  const dados = event.data?.json() || {};

  const opcoes = {
    body: dados.body || "Você tem uma nova notificação",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: { url: dados.url || "/dashboard" },
  };

  event.waitUntil(
    self.registration.showNotification(
      dados.titulo || "LUCRIO",
      opcoes
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.openWindow(event.notification.data.url)
  );
});
