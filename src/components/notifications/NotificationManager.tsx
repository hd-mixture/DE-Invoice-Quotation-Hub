"use client";

import React, { useState, useEffect } from "react";
import { Bell, X, CloudLightning, Sparkles, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { db, messaging } from "../../firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";

export const triggerAppToast = (message: string, type: "success" | "info" = "success") => {
  if (typeof window !== "undefined") {
    const event = new CustomEvent("app-toast", { detail: { message, type } });
    window.dispatchEvent(event);
  }
};

const TAGLINES = {
  morning: [
    "Hii '{name}'! Kickstart your workday! Create professional Quotations & Invoices in seconds.",
    "Rise and shine, '{name}'! Let's clear your billing checklist before your morning coffee.",
    "A productive morning starts here, '{name}'! Generate your invoices with one click."
  ],
  lunch: [
    "🍽️ Hii '{name}' Create a Quotation in a minute... until you finish your lunch!",
    "🍽️ Hello '{name}' Quick invoice during your lunch break? Done in less than 60 seconds."
  ],
  afternoon: [
    "Beat the afternoon slump, '{name}'! Power through your quotations instantly.",
    "Hello '{name}'! Close your business deals today! Send beautiful quotations in a flash."
  ],
  evening: [
    "Wrap up your day in style, '{name}'! Sync and save your final invoices flawlessly.",
    "All caught up, '{name}'? Sleep easy knowing your billing details are safely synced!"
  ]
};

// Helper to select a tagline based on current hour and interpolate user name
const getActiveTagline = (name: string): string => {
  const hour = new Date().getHours();
  let category: "morning" | "lunch" | "afternoon" | "evening";

  if (hour >= 6 && hour < 12) {
    category = "morning";
  } else if (hour >= 12 && hour < 14) {
    category = "lunch";
  } else if (hour >= 14 && hour < 18) {
    category = "afternoon";
  } else {
    category = "evening";
  }

  const list = TAGLINES[category];
  const randomIndex = Math.floor(Math.random() * list.length);
  const template = list[randomIndex];
  
  // Interpolate display name
  return template.replace(/{name}/g, name || "there");
};

// Helper to convert VAPID public key Base64 string to Uint8Array for PushManager subscription
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationManager: React.FC = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);
  
  // Synchronous lock to prevent parallel token registration race conditions
  const isRegisteringRef = React.useRef(false);

  const triggerToast = (message: string, type: "success" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const handleAppToast = (e: any) => {
      triggerToast(e.detail.message, e.detail.type);
    };
    window.addEventListener("app-toast", handleAppToast);
    return () => window.removeEventListener("app-toast", handleAppToast);
  }, []);

  // Cross-Platform notification triggers (Android/Chrome mobile & Desktop Compatible)
  const showPlatformNotification = async (title: string, options: NotificationOptions) => {
    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg) {
          await reg.showNotification(title, options);
          return;
        }
      }
      // Fallback for desktop standard browser environments
      new Notification(title, options);
    } catch (err) {
      console.warn("Service worker showNotification failed, trying constructor fallback...", err);
      try {
        new Notification(title, options);
      } catch (fallbackErr) {
        console.error("Platform does not support native Notification constructor:", fallbackErr);
      }
    }
  };

  // Registers background Push Notification token in Firestore (Self-Healing & Rules-Compliant)
  const registerPushNotifications = async (currentUser: any) => {
    if (!messaging || !currentUser || isRegisteringRef.current) return;
    isRegisteringRef.current = true;
    
    try {
      let freshSubscription = null;

      // 1. Explicitly register and wait for the Service Worker to avoid deadlocks
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        console.log("Registering service worker explicitly...");
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("Service Worker registered successfully:", registration);
        
        await navigator.serviceWorker.ready;
        
        // Force clear any existing/stale PushManager subscriptions
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Unsubscribe if present to allow fresh subscription with new VAPID key
          await subscription.unsubscribe();
          console.log("Stale push manager subscription successfully cleared.");
        }

        // Register a fresh browser WebPush subscription using the correct public VAPID key
        freshSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array("BMC2IrZ7PwRo8iJ1BXYnSl4_cOdbXLMJxOQJwRZf06c1gP7WDJ1_z-G8vlTJaBZkjwSYinna33sEM1MXSEuIiM4")
        });
        console.log("Fresh WebPush subscription successfully registered:", freshSubscription);
      }

      // 2. Request a new token using the correct VAPID key pair for FCM compatibility
      const token = await getToken(messaging, {
        vapidKey: "BMC2IrZ7PwRo8iJ1BXYnSl4_cOdbXLMJxOQJwRZf06c1gP7WDJ1_z-G8vlTJaBZkjwSYinna33sEM1MXSEuIiM4"
      });

      if (token) {
        console.log("FCM Registration VAPID Token successfully generated:", token);
        
        // Save the token and subscription inside the user's admin settings document (allowed by Firestore rules)
        await setDoc(doc(db, "admin", currentUser.uid), {
          fcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString(),
          fcmSubscription: freshSubscription ? JSON.parse(JSON.stringify(freshSubscription)) : null,
          userName: currentUser.displayName || "Guest User"
        }, { merge: true });

        console.log("FCM Token & WebPush Subscription successfully synced to Firestore admin settings.");
      }
    } catch (err) {
      console.warn("FCM registration or token retrieval error:", err);
      
      // If subscription fails due to key mismatch, force-unregister service worker to reset it completely on next load
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
            console.log("Mismatched Service Worker successfully unregistered.");
          }
        } catch (swErr) {
          console.error("Failed to unregister service worker:", swErr);
        }
      }
    } finally {
      isRegisteringRef.current = false;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !user) return;

    setPermission(Notification.permission);

    // If permissions are already granted, ensure token is refreshed and synced in Firestore
    if (Notification.permission === "granted") {
      registerPushNotifications(user);
    }

    // Show prompt if permission is default and not dismissed recently
    const dismissed = localStorage.getItem("de_notifications_dismissed");
    if (Notification.permission === "default" && !dismissed) {
      // Delay showing the prompt slightly for an elegant user experience
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Sync Foreground incoming FCM push messages
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Foreground push notification payload received:", payload);
      if (payload.notification) {
        triggerToast(`🔔 ${payload.notification.title}: ${payload.notification.body}`, "success");
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to tab closing / tab switching to send encouraging tagline notifications as a local fallback
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || permission !== "granted" || !user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const tagline = getActiveTagline(user.displayName || "there");
        showPlatformNotification("Thank you for using Darshan Enterprises Invoicing & Quotation Portal", {
          body: tagline,
          icon: "/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg",
          tag: "de-portal-exit",
          silent: false
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [permission, user]);

  const handleRequestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !user) return;

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      setShowPrompt(false);

      if (res === "granted") {
        triggerToast("Notifications enabled successfully! 🎉", "success");
        
        // Sync FCM Token
        await registerPushNotifications(user);

        // Show immediate warm welcome notification (Cross-platform compatible)
        showPlatformNotification("Darshan Enterprises", {
          body: `Thank you for enabling notifications, ${user.displayName || "User"}! We will keep you updated.`,
          icon: "/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
        });
      } else {
        triggerToast("Notifications blocked. You can enable them in browser settings.", "info");
      }
    } catch (err) {
      console.error("Failed to request permission:", err);
    }
  };

  const handleDismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem("de_notifications_dismissed", "true");
  };

  if (!showPrompt && !toast) return null;

  return (
    <>
      {/* Floating Permission Prompt Banner (Canva Style) */}
      {showPrompt && (
        <div className="fixed bottom-6 left-6 z-[100] max-w-sm w-[calc(100%-48px)] p-5 rounded-[24px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col gap-4 text-slate-800 dark:text-zinc-100 animate-in fade-in slide-in-from-bottom-5 duration-350">
          {/* Header */}
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 shadow-sm border border-violet-500/10">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 leading-none">
                <span>Enable Notifications</span>
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-snug">
                Get warm greetings, fast saving tips, and motivational billing reminders tailored directly to you!
              </p>
            </div>
            <button
              onClick={handleDismissPrompt}
              className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDismissPrompt}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-center"
            >
              Later
            </button>
            <button
              onClick={handleRequestPermission}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-750 text-white text-xs font-bold shadow-lg shadow-violet-500/15 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>Enable Now</span>
            </button>
          </div>
        </div>
      )}

      {/* Internal success feedback toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] p-4 rounded-2xl bg-zinc-900 dark:bg-zinc-950 text-white border border-emerald-500/50 shadow-2xl flex items-center gap-2.5 max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-lg shadow-emerald-500/60" />
          <span className="text-xs font-bold text-zinc-100">{toast.message}</span>
        </div>
      )}
    </>
  );
};
