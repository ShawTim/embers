const CACHE_NAME = "embers-v3";
// All 17 character models + 4 anim rigs + 4 decorations that the game
// actually uses.  Listing them here means the service worker pre-caches
// them on install so subsequent page loads hit the cache without the
// loader doing a network round-trip.
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.png",
  "./models/characters/Paladin.glb",
  "./models/characters/Paladin_with_Helmet.glb",
  "./models/characters/BlackKnight.glb",
  "./models/characters/Witch.glb",
  "./models/characters/Druid.glb",
  "./models/characters/Ranger.glb",
  "./models/characters/Protagonist_A.glb",
  "./models/characters/Protagonist_B.glb",
  "./models/characters/Vampire.glb",
  "./models/characters/Tiefling.glb",
  "./models/characters/OrcBrute.glb",
  "./models/characters/Barbarian.glb",
  "./models/characters/Monstrosity.glb",
  "./models/characters/Knight.glb",
  "./models/characters/Mage.glb",
  "./models/characters/Rogue.glb",
  "./models/characters/Rogue_Hooded.glb",
  "./models/animations/Rig_Medium_General.glb",
  "./models/animations/Rig_Medium_MovementBasic.glb",
  "./models/animations/Rig_Medium_CombatMelee.glb",
  "./models/animations/Rig_Medium_CombatRanged.glb",
  "./models/decorations/tree_single_A.gltf",
  "./models/decorations/trees_A_small.gltf",
  "./models/decorations/trees_A_medium.gltf",
  "./models/decorations/flag_blue.gltf",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Pre-cache in the background — don't block install on the full
  // download.  Files added to the cache this way are available on the
  // very next navigation.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => { if (res.ok) cache.put(url, res.clone()); })
            .catch(() => {}) // network failure is OK; we still try on first load
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin http/https requests
  if (url.protocol !== "https:" && url.protocol !== "http:") return;
  if (url.origin !== self.location.origin) return;

  // Static assets — cache-first
  if (url.pathname.match(/\.(glb|gltf|bin|png|jpg|jpeg|svg|woff2?|js|css|wasm)$/)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return res;
        }).catch(() => cached || new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Navigation — network-first, fallback to cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Other same-origin — stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
