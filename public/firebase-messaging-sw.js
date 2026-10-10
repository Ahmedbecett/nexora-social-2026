importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
firebase.initializeApp({
  apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: "nexora-social-2026.firebaseapp.com",
  projectId: "nexora-social-2026",
  storageBucket: "nexora-social-2026.firebasestorage.app",
  messagingSenderId: "549843291889",
  appId: "REPLACE_WITH_FIREBASE_WEB_APP_ID"
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification?.title || "NEXORA", {
    body: payload.notification?.body || "You have a new update.",
    icon: "/icon.svg",
    data: payload.data || {}
  });
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});