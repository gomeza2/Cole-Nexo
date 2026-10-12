/* NEXO PWA: cache only the static app shell, never API responses or user data. */
"use strict";

const CACHE_NAME = "nexo-app-shell-v3";
const SHELL_ASSETS = [
  "./index.html",
  "./styles.css",
  "./state-store.js",
  "./news-config.js",
  "./companion-config.js",
  "./community-config.js",
  "./app.js",
  "./community.js",
  "./cloud-sync.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./nexo-icon.svg",
  "./nexo-icon-192.svg",
  "./nexo-icon-512.svg"
];
const SHELL_URL = new URL("./index.html", self.registration.scope).href;
const CACHE_URLS = new Set(
  SHELL_ASSETS.map((asset) => new URL(asset, self.registration.scope).href)
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([...CACHE_URLS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith("nexo-app-shell-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const safeCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, safeCopy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cachedShell = await caches.match(SHELL_URL);
          return cachedShell || new Response(
            "<!doctype html><html lang='es'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>NEXO sin conexión</title><body style='font:16px system-ui;padding:2rem;line-height:1.6'><h1>NEXO</h1><p>No hay conexión y esta versión todavía no está guardada. Volvé a abrir NEXO cuando tengas internet para preparar el modo sin conexión.</p></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
          );
        })
    );
    return;
  }

  const cacheKey = new URL(requestUrl.pathname, requestUrl.origin).href;
  if (!CACHE_URLS.has(cacheKey)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cachedAsset = await caches.match(cacheKey);
        return cachedAsset || Response.error();
      })
  );
});
