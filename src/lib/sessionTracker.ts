import { db } from "../firebase/config";
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

export interface SessionData {
  id: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ip: string;
  location: string;
  hostname: string;
  lastActive: string;
  createdAt: string;
  isCurrent?: boolean;
}

// Generate or retrieve persistent Session ID for this browser tab session
export function getOrCreateSessionId(userId: string): string {
  if (typeof window === "undefined") return "server_session";
  try {
    const key = `unique_device_session_id_${userId}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return `sess_fallback_${Date.now()}`;
  }
}

// Detailed User-Agent Browser & Device Parser
export function parseDeviceInfo() {
  if (typeof window === "undefined") {
    return {
      deviceName: "Desktop Workstation",
      deviceType: "desktop" as const,
      browser: "Google Chrome",
      os: "Windows PC"
    };
  }

  const ua = navigator.userAgent;
  const isSmallScreen = window.innerWidth < 768;
  const isMobileUA = /Android|iPhone|iPod/i.test(ua);
  const isTabletUA = /iPad/i.test(ua) || (ua.includes("Android") && !isMobileUA);

  let os = "Windows PC";
  if (ua.includes("Win")) os = "Windows 11 / 10";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS Workstation";
  else if (ua.includes("Android")) os = "Android Device";
  else if (ua.includes("iPhone")) os = "iOS iPhone";
  else if (ua.includes("iPad")) os = "iPadOS Tablet";
  else if (ua.includes("Linux")) os = "Linux Workstation";

  let deviceType: 'desktop' | 'mobile' | 'tablet' = "desktop";
  if (isMobileUA && isSmallScreen) {
    deviceType = "mobile";
  } else if (isTabletUA) {
    deviceType = "tablet";
  } else {
    deviceType = "desktop";
  }

  let browser = "Google Chrome";
  if (ua.includes("Firefox")) browser = "Mozilla Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Apple Safari";
  else if (ua.includes("Edg")) browser = "Microsoft Edge";
  else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";

  const deviceName = `${os} (${browser})`;
  return { deviceName, deviceType, browser, os };
}

// Register or heartbeat session in Firestore
export async function registerDeviceSession(userId: string, userEmail: string): Promise<string> {
  const sessionId = getOrCreateSessionId(userId);
  const { deviceName, deviceType, browser, os } = parseDeviceInfo();
  
  // Try to fetch public IP asynchronously with timeout fallback
  let publicIp = "103.217.x.x";
  try {
    const res = await Promise.race([
      fetch("https://api.ipify.org?format=json").then(r => r.json()),
      new Promise((_, reject) => setTimeout(() => reject("timeout"), 2000))
    ]) as { ip?: string };
    if (res && res.ip) {
      publicIp = res.ip;
    }
  } catch (e) {
    // Fallback if IP service is offline/blocked
  }

  const sessionRef = doc(db, "users", userId, "sessions", sessionId);
  const nowIso = new Date().toISOString();

  await setDoc(sessionRef, {
    id: sessionId,
    userId,
    userEmail,
    deviceName,
    deviceType,
    browser,
    os,
    ip: publicIp,
    location: "Verified Region",
    hostname: typeof window !== "undefined" ? window.location.hostname : "localhost",
    lastActive: nowIso,
    updatedAt: serverTimestamp(),
    createdAt: localStorage.getItem(`session_created_${sessionId}`) || nowIso
  }, { merge: true });

  if (!localStorage.getItem(`session_created_${sessionId}`)) {
    localStorage.setItem(`session_created_${sessionId}`, nowIso);
  }

  return sessionId;
}

// Revoke specific session by ID
export async function revokeDeviceSession(userId: string, sessionIdToRevoke: string): Promise<void> {
  const sessionRef = doc(db, "users", userId, "sessions", sessionIdToRevoke);
  await deleteDoc(sessionRef);
}

// Listen for session revocation on current device
export function listenForSessionRevocation(userId: string, currentSessionId: string, onRevoked: () => void) {
  const sessionRef = doc(db, "users", userId, "sessions", currentSessionId);
  let docExistedPreviously = false;

  return onSnapshot(sessionRef, (snapshot) => {
    if (snapshot.exists()) {
      docExistedPreviously = true;
    } else if (docExistedPreviously) {
      // Document existed previously and was explicitly deleted by remote revoke action!
      console.warn("Session doc was revoked remotely from Firestore.");
      onRevoked();
    }
  });
}
