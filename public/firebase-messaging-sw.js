importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
firebase.initializeApp({
  apiKey: "AIzaSyAD3w57QmDr3kFyKFMRyKuuVBuZSDQ_uqk",
  authDomain: "nexora-social-2026.firebaseapp.com",
  projectId: "nexora-social-2026",
  storageBucket: "nexora-social-2026.firebasestorage.app",
  messagingSenderId: "549843291889",
  appId: "1:549843291889:web:044d5024be1ed3a7066350"
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