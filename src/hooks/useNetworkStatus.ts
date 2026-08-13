"use client";

import { useState, useEffect } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return navigator.onLine;
    }
    return true;
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowRestoredNotice(true);
        const timer = setTimeout(() => {
          setShowRestoredNotice(false);
          setWasOffline(false);
        }, 4500);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowRestoredNotice(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setIsOnline(false);
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    showRestoredNotice,
    dismissRestoredNotice: () => setShowRestoredNotice(false)
  };
}
