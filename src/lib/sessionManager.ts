/**
 * Enterprise Multi-Tab Session Manager
 * Synchronizes authentication, login, logout, and token expiration state
 * in real-time (<100ms) across all open browser tabs and windows while
 * maintaining 100% isolated navigation and UI states per tab.
 */

export interface AuthSessionMessage {
  type: 'LOGIN' | 'LOGOUT' | 'SESSION_EXPIRED' | 'TOKEN_REFRESH';
  sourceTabId: string;
  timestamp: number;
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  reason?: string;
}

// Generate or retrieve tab-isolated identifier for current window session
export const getTabId = (): string => {
  if (typeof window === "undefined") return "server_tab";
  try {
    let id = sessionStorage.getItem("app_unique_tab_id");
    if (!id) {
      id = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem("app_unique_tab_id", id);
    }
    return id;
  } catch (e) {
    return `tab_fallback_${Date.now()}`;
  }
};

const BROADCAST_CHANNEL_NAME = "auth_session_channel";
const STORAGE_EVENT_KEY = "auth_session_broadcast_event";

class SessionManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: AuthSessionMessage) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      // 1. Initialize BroadcastChannel (Primary Cross-Tab Auth Sync API)
      if ("BroadcastChannel" in window) {
        try {
          this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          this.channel.onmessage = (event: MessageEvent<AuthSessionMessage>) => {
            const currentId = getTabId();
            if (event.data && event.data.sourceTabId && event.data.sourceTabId !== currentId) {
              this.notifyListeners(event.data);
            }
          };
        } catch (e) {
          console.warn("BroadcastChannel initialization warning:", e);
        }
      }

      // 2. Storage Event Fallback (Cross-window Redundancy)
      window.addEventListener("storage", (event: StorageEvent) => {
        if (event.key === STORAGE_EVENT_KEY && event.newValue) {
          try {
            const data: AuthSessionMessage = JSON.parse(event.newValue);
            const currentId = getTabId();
            // Ignore messages from same tab or older than 3 seconds
            if (data.sourceTabId && data.sourceTabId !== currentId && (Date.now() - data.timestamp < 3000)) {
              this.notifyListeners(data);
            }
          } catch (err) {
            console.error("Error parsing cross-tab storage event:", err);
          }
        }
      });

      // 3. Clean up unsaved work flag for this specific tab on unload
      window.addEventListener("beforeunload", () => {
        try {
          localStorage.removeItem(`auth_tab_unsaved_work_${getTabId()}`);
        } catch (e) {}
      });
    }
  }

  // Subscribe to real-time auth broadcast events
  public subscribe(callback: (msg: AuthSessionMessage) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Broadcast authentication message ONLY for explicit login/logout events
  public broadcast(type: AuthSessionMessage['type'], payload: Partial<AuthSessionMessage> = {}): void {
    if (typeof window === "undefined") return;

    const message: AuthSessionMessage = {
      type,
      sourceTabId: getTabId(),
      timestamp: Date.now(),
      ...payload,
    };

    // Broadcast via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn("Failed to post message to BroadcastChannel:", err);
      }
    }

    // Broadcast via LocalStorage event fallback
    try {
      localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify({
        ...message,
        _nonce: Math.random()
      }));
    } catch (err) {
      console.warn("Failed to write session storage broadcast event:", err);
    }
  }

  // Set active user session flag
  public setSessionActive(active: boolean): void {
    if (typeof window === "undefined") return;
    if (active) {
      localStorage.setItem("auth_user_active", "true");
    } else {
      localStorage.setItem("auth_user_active", "false");
    }
  }

  // Register or clear unsaved work flag for current tab
  public setTabUnsavedWork(hasUnsaved: boolean): void {
    if (typeof window === "undefined") return;
    const key = `auth_tab_unsaved_work_${getTabId()}`;
    if (hasUnsaved) {
      localStorage.setItem(key, "true");
    } else {
      localStorage.removeItem(key);
    }
  }

  // Check if ANY OTHER open browser tab has registered active unsaved work
  public hasAnyTabUnsavedWork(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const selfKey = `auth_tab_unsaved_work_${getTabId()}`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("auth_tab_unsaved_work_") && key !== selfKey) {
          if (localStorage.getItem(key) === "true") {
            return true;
          }
        }
      }
    } catch (e) {
      console.warn("Error checking tab unsaved work:", e);
    }
    return false;
  }

  // Complete & Clean Session Purge for Logout
  public purgeSessionData(): void {
    if (typeof window === "undefined") return;

    try {
      this.setSessionActive(false);

      localStorage.removeItem("google_drive_access_token");
      localStorage.removeItem("has_google_drive_connected");
      localStorage.removeItem("user_custom_display_name");
      localStorage.removeItem("user_custom_photo_url");
      localStorage.removeItem("user_notifications");
      localStorage.removeItem("user_2fa_enabled");

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith("active_session_id_") || 
          key.startsWith("session_created_") || 
          key.startsWith("auth_tab_unsaved_work_")
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      sessionStorage.clear();
      window.dispatchEvent(new Event("app-session-purged"));
    } catch (err) {
      console.error("Error purging session data:", err);
    }
  }

  // Verify whether current browser storage has valid active user status
  public isStoredSessionValid(): boolean {
    if (typeof window === "undefined") return true;
    const userActive = localStorage.getItem("auth_user_active");
    if (userActive === "false") return false;
    return true;
  }

  private notifyListeners(message: AuthSessionMessage): void {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (err) {
        console.error("Error in auth broadcast listener:", err);
      }
    });
  }
}

export const sessionManager = new SessionManager();
