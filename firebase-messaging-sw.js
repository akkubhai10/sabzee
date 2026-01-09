/*
 * SabziXpress - FCM Service Worker
 * Handles background notifications
 */

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// 1. Initialize Firebase inside SW
firebase.initializeApp({
    apiKey: "AIzaSyCi0pzEGkSIVZ5XlcYpyWzKBeZZPOmmtLc",
    authDomain: "sabzee-6c5ad.firebaseapp.com",
    projectId: "sabzee-6c5ad",
    messagingSenderId: "537431620130",
    appId: "1:537431620130:web:2b11f3bae972928fa4287b"
});

// 2. Retrieve Messaging Instance
const messaging = firebase.messaging();

// 3. Background Message Handler
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/images/icons/icon-192x192.png', // Ensure this exists in manifest
        badge: '/images/icons/badge.png',
        vibrate: [200, 100, 200],
        tag: 'sabzi-notification',
        renotify: true,
        data: {
            url: payload.notification.click_action || '/index.html'
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 4. Notification Click Listener
self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Check if there is already a window open with this URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});