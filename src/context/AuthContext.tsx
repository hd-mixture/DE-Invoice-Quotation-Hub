"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { 
  User, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithCredential
} from "firebase/auth";
import { auth, db } from "../firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { registerDeviceSession, listenForSessionRevocation } from "../lib/sessionTracker";
import { sessionManager, AuthSessionMessage } from "../lib/sessionManager";
import { useTheme } from "../context/ThemeContext";
import { cn } from "../lib/utils";
import { LogOut, X, Loader2, CheckCircle2 } from "lucide-react";
import { OfflineBanner } from "../components/common/OfflineBanner";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleAccessToken: string | null;
  remoteNotice: string | null;
  isLoggingOut: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: (isRemote?: any, reason?: string) => Promise<void>;
  refreshGoogleToken: () => Promise<string | null>;
  clearRemoteNotice: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  googleAccessToken: null,
  remoteNotice: null,
  isLoggingOut: false,
  loginWithGoogle: async () => {},
  logout: async () => {},
  refreshGoogleToken: async () => null,
  clearRemoteNotice: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [user, setUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);

  const clearRemoteNotice = () => setRemoteNotice(null);

  // Helper method: Silent Access Token Renewal using Firestore stored Refresh Token
  const refreshGoogleToken = async (): Promise<string | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log("Cannot refresh token: No user is authenticated in Firebase Auth.");
      return null;
    }

    try {
      // 1. Fetch Google Refresh Token securely from Firestore subcollection
      const tokenDocRef = doc(db, "users", currentUser.uid, "secure", "googleDrive");
      const tokenDocSnap = await getDoc(tokenDocRef);

      if (!tokenDocSnap.exists()) {
        console.log("No stored Google Drive credentials found for user:", currentUser.uid);
        return null;
      }

      const refreshToken = tokenDocSnap.data().refreshToken;
      if (!refreshToken) {
        console.log("Refresh token is empty in user Firestore record");
        return null;
      }

      // 2. Query Next.js API route to refresh the token
      const response = await fetch("/api/auth/google/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 || response.status === 401) {
          console.warn("Stored Google Drive refresh token is invalid or revoked. Clearing drive token.");
          setGoogleAccessToken(null);
          localStorage.removeItem("google_drive_access_token");
        }
        throw new Error(data.error || "Failed to renew access token");
      }

      const newAccessToken = data.accessToken;
      if (newAccessToken) {
        setGoogleAccessToken(newAccessToken);
        localStorage.setItem("google_drive_access_token", newAccessToken);
        return newAccessToken;
      }
      return null;
    } catch (error) {
      console.error("Silent token refresh failed:", error);
      return null;
    }
  };

  // Perform logout (either local user action or remote cross-tab broadcast)
  const logout = async (isRemote: any = false, reason?: string) => {
    const isRemoteBool = typeof isRemote === "boolean" ? isRemote : false;
    const noticeReason = typeof isRemote === "string" ? isRemote : reason;

    // Trigger full-screen visual logout overlay
    setIsLoggingOut(true);
    setLogoutReason(noticeReason || "Safely clearing security tokens & closing session...");

    try {
      if (!isRemoteBool) {
        // Broadcast logout event to all other open tabs instantly (<100ms)
        sessionManager.broadcast("LOGOUT", { reason: noticeReason });
      } else {
        // Display toast notice for remote cross-tab logout
        const noticeMsg = noticeReason || "Your session has ended in another tab.";
        setRemoteNotice(noticeMsg);
        setTimeout(() => setRemoteNotice(null), 5000);
      }

      // Brief delay to display smooth logout visual animation before state reset
      await new Promise((r) => setTimeout(r, 600));

      // Purge all tokens, cached profiles, session storage, and draft states
      sessionManager.purgeSessionData();

      // Sign out from Firebase Auth
      await signOut(auth);

      setGoogleAccessToken(null);
      setUser(null);

      // Prevent unauthorized history navigation back into protected screens
      if (typeof window !== "undefined") {
        window.history.replaceState({ workspaceMode: null, activeTab: "dashboard" }, "", window.location.pathname);
      }
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      setTimeout(() => {
        setIsLoggingOut(false);
        setLogoutReason(null);
        setLoading(false);
      }, 300);
    }
  };

  // Subscribe to real-time BroadcastChannel & Storage events across tabs
  useEffect(() => {
    const unsubscribeManager = sessionManager.subscribe((msg: AuthSessionMessage) => {
      if (msg.type === "LOGOUT" || msg.type === "SESSION_EXPIRED") {
        console.warn(`[Auth Sync] Received ${msg.type} event from remote tab.`);
        logout(true, msg.reason || "Your session has ended in another tab.");
      } else if (msg.type === "LOGIN") {
        console.log(`[Auth Sync] Received LOGIN event from remote tab. Instant user sync.`);
        sessionManager.setSessionActive(true);
        setRemoteNotice("Signed in from another tab.");
        setTimeout(() => setRemoteNotice(null), 4000);

        const savedToken = localStorage.getItem("google_drive_access_token");
        if (savedToken) setGoogleAccessToken(savedToken);

        // Construct instant user payload so remote tab transitions to post-login screen with 0ms delay
        const immediateUser = auth.currentUser || ({
          uid: msg.uid || "user_sync",
          email: msg.email || "",
          displayName: msg.displayName || msg.email?.split("@")[0] || "User",
          photoURL: msg.photoURL || null,
          emailVerified: true,
          isAnonymous: false,
          metadata: {},
          providerData: [],
          refreshToken: "",
          tenantId: null,
          delete: async () => {},
          getIdToken: async () => "",
          getIdTokenResult: async () => ({} as any),
          reload: async () => {},
          toJSON: () => ({}),
        } as unknown as User);

        setUser(immediateUser);
        setLoading(false);

        const syncRemoteUser = () => {
          if (auth.currentUser) {
            setUser(auth.currentUser);
            setLoading(false);
          } else {
            const unsub = onAuthStateChanged(auth, (u) => {
              if (u) {
                setUser(u);
                setLoading(false);
              }
              unsub();
            });
          }
        };

        // Immediate check + retries at 150ms and 400ms to catch committed IndexedDB auth token
        syncRemoteUser();
        setTimeout(syncRemoteUser, 150);
        setTimeout(syncRemoteUser, 400);
      }
    });

    return () => unsubscribeManager();
  }, []);

  // Verify session validity on window focus
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleFocus = () => {
      if (auth.currentUser && !sessionManager.isStoredSessionValid()) {
        console.warn("[Session Validation] Tab focused but local tokens are missing. Triggering sync logout.");
        logout(true, "Your session has ended in another tab.");
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const sessionUnsubRef = useRef<(() => void) | null>(null);

  // Enforce session persistence and restore state on mount
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Firebase Auth persistence setup failed:", err);
    });

    const savedToken = localStorage.getItem("google_drive_access_token");
    if (savedToken) {
      setGoogleAccessToken(savedToken);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        sessionManager.setSessionActive(true);

        // Register current device session in Firestore
        try {
          const currentSessId = await registerDeviceSession(currentUser.uid, currentUser.email || "");
          
          if (!sessionUnsubRef.current) {
            sessionUnsubRef.current = listenForSessionRevocation(currentUser.uid, currentSessId, () => {
              console.warn("Device session revoked remotely from Firestore.");
              logout(true, "Your device session was revoked.");
            });
          }
        } catch (sessErr) {
          console.warn("Session registration warning:", sessErr);
        }

        // If we have a user but no access token in memory, silently attempt a refresh
        if (!savedToken) {
          console.log("Auth restored. Silently fetching fresh Google Drive token...");
          await refreshGoogleToken();
        }
      } else {
        setGoogleAccessToken(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (sessionUnsubRef.current) {
        sessionUnsubRef.current();
        sessionUnsubRef.current = null;
      }
    };
  }, []);

  // Securely trigger the Google consent screen requesting offline access in a popup
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const redirectUri = typeof window !== "undefined" 
        ? `${window.location.origin}/auth/google-callback` 
        : (process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/google-callback");

      if (!clientId || !redirectUri) {
        throw new Error("Missing Google OAuth environment variables in the client configuration.");
      }

      const scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file"
      ].join(" ");

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes,
        access_type: "offline",
        prompt: "consent",
      }).toString();

      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        "google-oauth-popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        throw new Error("Authorization popup window was blocked by your browser. Please enable popups to connect Google Drive.");
      }

      return new Promise<void>((resolve, reject) => {
        const handleMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;

          if (event.data && event.data.type === "google-drive-connected") {
            const { accessToken, refreshToken, idToken } = event.data;
            
            window.removeEventListener("message", handleMessage);
            clearInterval(checkClosed);

            try {
              const credential = GoogleAuthProvider.credential(idToken, accessToken);
              const userCredential = await signInWithCredential(auth, credential);
              const userId = userCredential.user.uid;

              if (refreshToken) {
                await setDoc(
                  doc(db, "users", userId, "secure", "googleDrive"),
                  {
                    refreshToken,
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true }
                );
              }

              if (accessToken) {
                setGoogleAccessToken(accessToken);
                localStorage.setItem("google_drive_access_token", accessToken);
              }
              
              setUser(userCredential.user);
              sessionManager.setSessionActive(true);
              sessionManager.broadcast("LOGIN", { 
                uid: userId,
                email: userCredential.user.email,
                displayName: userCredential.user.displayName,
                photoURL: userCredential.user.photoURL
              });
              setLoading(false);
              resolve();
            } catch (err) {
              console.error("Firebase popup-login execution failed inside parent context:", err);
              setLoading(false);
              reject(err);
            }
          }
        };

        window.addEventListener("message", handleMessage);

        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", handleMessage);
            setLoading(false);
            
            if (auth.currentUser) {
              resolve();
            } else {
              reject(new Error("Login popup was closed before authentication finished."));
            }
          }
        }, 1000);
      });

    } catch (error) {
      console.error("Google Authentication Flow error:", error);
      setLoading(false);
      throw error;
    }
  };

  // Automatic logout on expired session signal
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSessionExpired = () => {
      console.warn("Google Drive session expired. Triggering automatic renewal attempts...");
      refreshGoogleToken().then((newToken) => {
        if (!newToken) {
          console.warn("Silent Google Drive renewal failed. Clearing Google Drive access token.");
          setGoogleAccessToken(null);
          localStorage.removeItem("google_drive_access_token");
        }
      });
    };

    window.addEventListener("google-session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("google-session-expired", handleSessionExpired);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      googleAccessToken, 
      remoteNotice,
      isLoggingOut,
      loginWithGoogle, 
      logout, 
      refreshGoogleToken,
      clearRemoteNotice
    }}>
      {children}

      {/* Full-Screen Glassmorphic Session Logout Visual Overlay */}
      {isLoggingOut && (
        <div className={cn(
          "fixed inset-0 z-[99999999] flex flex-col items-center justify-center backdrop-blur-2xl animate-in fade-in duration-300 select-none transition-colors",
          isDark ? "bg-zinc-950/85 text-white" : "bg-slate-900/40 text-slate-900"
        )}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes logoutPulseRing {
              0% { transform: scale(0.8); opacity: 0.8; }
              50% { transform: scale(1.15); opacity: 0.35; }
              100% { transform: scale(1.4); opacity: 0; }
            }
            .logout-ring-anim {
              animation: logoutPulseRing 2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
            }
          `}} />

          <div className={cn(
            "relative flex flex-col items-center text-center p-8 rounded-[36px] border shadow-2xl max-w-sm w-full mx-4 backdrop-blur-xl animate-in zoom-in-95 duration-300 transition-all",
            isDark 
              ? "bg-zinc-900/95 border-white/10 text-white shadow-[0_25px_60px_rgba(0,0,0,0.6)]" 
              : "bg-white/95 border-slate-200 text-slate-900 shadow-[0_25px_60px_rgba(15,23,42,0.15)]"
          )}>
            
            {/* Outer Glowing Rings */}
            <div className="relative w-20 h-20 flex items-center justify-center mb-5">
              <div className={cn("absolute inset-0 rounded-full logout-ring-anim", isDark ? "bg-red-500/20" : "bg-red-500/25")} />
              <div className={cn("absolute inset-0 rounded-full logout-ring-anim", isDark ? "bg-orange-500/20" : "bg-orange-500/25")} style={{ animationDelay: '0.6s' }} />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-orange-500 text-white flex items-center justify-center shadow-xl shadow-red-500/30">
                <LogOut className="w-8 h-8 stroke-[2.2px] animate-pulse text-white" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className={cn(
                "text-xl font-black uppercase tracking-wider",
                isDark ? "text-white" : "text-slate-900"
              )}>
                Session Logout
              </h3>
              <p className={cn(
                "text-xs font-semibold leading-relaxed",
                isDark ? "text-zinc-300" : "text-slate-600"
              )}>
                {logoutReason || "Safely clearing security tokens & closing session..."}
              </p>
            </div>

            <div className={cn(
              "mt-5 flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10.5px] font-bold transition-colors",
              isDark 
                ? "bg-white/10 border-white/10 text-zinc-300" 
                : "bg-slate-100 border-slate-200 text-slate-700"
            )}>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
              <span>Redirecting to Login...</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cross-Tab Session Notification Toast */}
      {remoteNotice && !isLoggingOut && (
        <div className={cn(
          "fixed top-5 right-5 z-[9999999] flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 transition-colors",
          isDark 
            ? "bg-zinc-950/95 text-white shadow-black/50" 
            : "bg-white/95 text-slate-900 shadow-slate-300/50",
          remoteNotice.toLowerCase().includes("signed in") || remoteNotice.toLowerCase().includes("login")
            ? "border-emerald-500/40"
            : "border-amber-500/40"
        )}>
          {remoteNotice.toLowerCase().includes("signed in") || remoteNotice.toLowerCase().includes("login") ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 stroke-[2.2px] shrink-0" />
          ) : (
            <LogOut className="w-4 h-4 text-amber-500 stroke-[2.2px] shrink-0" />
          )}
          <span className="text-xs font-extrabold tracking-wide">{remoteNotice}</span>
          <button 
            type="button"
            onClick={clearRemoteNotice}
            className="ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
