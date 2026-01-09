/*
 * SabziXpress - PWA Service Worker
 * Caches static assets for offline capability
 */

const CACHE_NAME = 'sabzi-express-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/admin.html',
    '/delivery.html',
    '/css/style.css',
    '/css/theme.css',
    '/js/firebase.js',
    '/js/auth.js',
    '/js/orders.js',
    '/js/inventory.js',
    '/js/admin.js',
    '/js/delivery.js',
    '/js/notifications.js',
    '/manifest.json',
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js'
];

// 1. Install Event - Cache Files
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing Service Worker ...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating Service Worker ...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// 3. Fetch Event - Network First, then Cache (for API) or Cache First (for Assets)
// Simple strategy: Stale-While-Revalidate for text/html, Cache First for others
self.addEventListener('fetch', (event) => {
    
    // Bypass Firestore/Firebase requests to ensure realtime data (handled by SDK mainly, but just in case HTTP fetch)
    if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
        return; // Let browser/SDK handle network
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchRes) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, fetchRes.clone());
                    return fetchRes;
                });
            });
        }).catch(() => {
            // Fallback for offline (optional: separate offline.html)
            if(event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        })
    );
});