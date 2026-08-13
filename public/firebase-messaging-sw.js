// Official Firebase Messaging & WebPush Service Worker for Darshan Enterprises
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in the background Service Worker context
firebase.initializeApp({
  apiKey: "AIzaSyBGCtPo6xTU_ykaGStkke7CC-l5XvY5IEY",
  authDomain: "darshan-enterprises.firebaseapp.com",
  projectId: "darshan-enterprises",
  storageBucket: "darshan-enterprises.firebasestorage.app",
  messagingSenderId: "895964008212",
  appId: "1:895964008212:web:20212f481e9ab9ec0e3c01"
});

const messaging = firebase.messaging();

// 1. Firebase Cloud Messaging (FCM) Background broadcast listener
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW Background] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Darshan Enterprises';
  const notificationOptions = {
    body: payload.notification?.body || 'Thank you for using Darshan Enterprises Portal!',
    icon: payload.notification?.icon || '/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg',
    badge: '/favicon.ico',
    tag: 'de-fcm-background',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. Native WebPush Socket Listener (Advanced Dual-Compatibility for Autopilot Cron push)
self.addEventListener('push', (event) => {
  console.log('[SW Background] Received native push event');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  // Extract nested properties (supports standard WebPush and FCM wrapper schemas)
  const notificationTitle = data.notification?.title || data.title || 'Darshan Enterprises';
  const notificationOptions = {
    body: data.notification?.body || data.body || 'Thank you for using Darshan Enterprises Invoicing & Quotation Portal',
    icon: data.notification?.icon || '/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg',
    badge: '/favicon.ico',
    tag: 'de-push-autonomous',
    data: data.data || data
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});
