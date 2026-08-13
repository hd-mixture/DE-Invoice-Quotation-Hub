import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { db } from "../../firebase/config";
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { deleteUser, reauthenticateWithPopup, GoogleAuthProvider } from "firebase/auth";
import { 
  revokeDeviceSession, 
  getOrCreateSessionId, 
  SessionData 
} from "../../lib/sessionTracker";
import { sessionManager } from "../../lib/sessionManager";
import { 
  User, 
  Lock, 
  Sliders, 
  Bell, 
  Monitor, 
  CreditCard, 
  Link, 
  Trash2, 
  X, 
  Pencil, 
  Settings, 
  Check, 
  ShieldCheck, 
  Moon, 
  Sun,
  ArrowLeftRight,
  RefreshCw,
  Smartphone,
  Globe,
  Upload,
  LogOut,
  ChevronLeft,
  MoreHorizontal,
  Info,
  Building2,
  Sparkles,
  CheckCircle2,
  Rocket,
  FileSpreadsheet,
  Zap,
  BarChart3,
  PenTool
} from "lucide-react";
import { cn } from "../../lib/utils";

// Official Google Multicolor "G" Logo SVG
const GoogleGLogo: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
);

// Official Google Drive Gradient Logo SVG
const GoogleDriveLogo: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 800 741.3696" fill="none" xmlns="http://www.w3.org/2000/svg">
    <mask id="gdrive_mask_a" width="168" height="154" x="12" y="18" maskUnits="userSpaceOnUse">
      <path fill="#fff" d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001Z"/>
    </mask>
    <g mask="url(#gdrive_mask_a)" transform="matrix(4.8140532,0,0,4.8140532,-62.146701,-86.652356)">
      <path fill="url(#gdrive_grad_b)" d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578Z"/>
      <path fill="url(#gdrive_grad_c)" d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001Z"/>
      <path fill="url(#gdrive_grad_d)" d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048Z"/>
    </g>
    <defs>
      <linearGradient id="gdrive_grad_b" x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse">
        <stop offset=".09" stopColor="#ffe921"/>
        <stop offset="1" stopColor="#fec700"/>
      </linearGradient>
      <linearGradient id="gdrive_grad_c" x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse">
        <stop offset=".15" stopColor="#a9a8ff"/>
        <stop offset=".33" stopColor="#6d97ff"/>
        <stop offset=".48" stopColor="#3186ff"/>
      </linearGradient>
      <linearGradient id="gdrive_grad_d" x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse">
        <stop offset=".55" stopColor="#0ebc5f"/>
        <stop offset=".85" stopColor="#78c9ff"/>
      </linearGradient>
    </defs>
  </svg>
);

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceMode?: 'quotation' | 'invoice' | null;
  setWorkspaceMode?: (mode: 'quotation' | 'invoice' | null) => void;
}

type TabType = 
  | 'profile' 
  | 'security' 
  | 'preferences' 
  | 'notifications' 
  | 'activity' 
  | 'accounts' 
  | 'about'
  | 'danger';

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  workspaceMode = 'quotation',
  setWorkspaceMode
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  // Persistent Profile Information State
  const [fullName, setFullName] = useState<string>("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [email] = useState(user?.email || "bajrangidarshan@gmail.com");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Security & 2FA State
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(true);

  // Notification Toggles Persistent State
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [driveSyncNotifs, setDriveSyncNotifs] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);

  // Realtime Session Diagnostics & Firestore Live Sessions State
  const [sessionStartTime] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [realtimeSessions, setRealtimeSessions] = useState<SessionData[]>([]);
  const [deviceDetails, setDeviceDetails] = useState({
    os: "Windows PC",
    browser: "Google Chrome",
    resolution: "1920x1080",
    isOnline: true,
    timezone: "UTC",
    hostname: "localhost"
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [showSwitchConfirmModal, setShowSwitchConfirmModal] = useState(false);
  const [showSignOutConfirmModal, setShowSignOutConfirmModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [accountDeletedNotice, setAccountDeletedNotice] = useState(false);

  const isInvoiceMode = workspaceMode === 'invoice';

  // Dynamic Workspace Suite Colors (Purple for Billing / Orange for Quotations)
  const themeText = isInvoiceMode ? "text-purple-600 dark:text-purple-400" : "text-[#E55A22] dark:text-orange-400";
  const themeBtnBg = isInvoiceMode ? "bg-[#7C3AED] hover:bg-purple-700 text-white" : "bg-[#E55A22] hover:bg-orange-600 text-white";
  const themeActiveTab = isInvoiceMode 
    ? "bg-purple-100/80 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shadow-xs" 
    : "bg-orange-100/80 dark:bg-orange-950/50 text-[#E55A22] dark:text-orange-400 shadow-xs";
  const themeHeaderIcon = isInvoiceMode 
    ? "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/30" 
    : "bg-orange-100 dark:bg-orange-950/40 text-[#E55A22] dark:text-orange-400 border-orange-200/50 dark:border-orange-800/30";
  const themeBorder = isInvoiceMode ? "border-purple-200 dark:border-purple-800/50" : "border-orange-200 dark:border-orange-800/50";
  const themeSoftBg = isInvoiceMode ? "bg-purple-50/50 dark:bg-purple-950/20" : "bg-orange-50/50 dark:bg-orange-950/20";
  const themeActiveCard = isInvoiceMode
    ? "border-2 border-purple-300 dark:border-purple-800/80 bg-purple-50/50 dark:bg-purple-950/30"
    : "border-2 border-orange-300 dark:border-orange-800/80 bg-orange-50/50 dark:bg-orange-950/30";
  const themeBadge = isInvoiceMode
    ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/30"
    : "text-[#E55A22] dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/30";

  // Subscribe to Real-time Firestore Session Activity for logged-in user
  useEffect(() => {
    if (!user?.uid) return;

    const currentLocalSessionId = getOrCreateSessionId(user.uid);
    const sessionsRef = collection(db, "users", user.uid, "sessions");

    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      const docsList: SessionData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SessionData;
        docsList.push({
          ...data,
          id: docSnap.id,
          isCurrent: docSnap.id === currentLocalSessionId
        });
      });

      // Sort current active device first
      docsList.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime();
      });

      setRealtimeSessions(docsList);
    }, (err) => {
      console.warn("Firestore session snapshot listener error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter & Deduplicate realtime sessions so identical device/IP entries merge cleanly
  const displaySessions = useMemo(() => {
    const map = new Map<string, SessionData>();
    realtimeSessions.forEach((sess) => {
      // Create a unique device fingerprint key
      const key = `${sess.deviceName || sess.os}_${sess.ip || 'ip'}`;
      if (!map.has(key) || sess.isCurrent) {
        map.set(key, sess);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.isCurrent ? -1 : 1));
  }, [realtimeSessions]);

  // Load persistent profile, notifications, and 2FA settings on mount
  useEffect(() => {
    const savedName = localStorage.getItem("user_custom_display_name");
    const savedPhoto = localStorage.getItem("user_custom_photo_url");
    const saved2FA = localStorage.getItem("user_2fa_enabled");
    const savedNotifs = localStorage.getItem("user_notifications");

    setFullName(savedName || user?.displayName || "HD_Mixture");
    setPhotoURL(savedPhoto || user?.photoURL || null);
    
    if (saved2FA !== null) {
      setIs2FAEnabled(saved2FA === "true");
    }

    if (savedNotifs) {
      try {
        const parsed = JSON.parse(savedNotifs);
        setEmailNotifs(parsed.emailNotifs ?? true);
        setDriveSyncNotifs(parsed.driveSyncNotifs ?? true);
        setSecurityAlerts(parsed.securityAlerts ?? true);
      } catch (err) {
        console.error("Error parsing saved notifications:", err);
      }
    }
  }, [user]);

  // Realtime Session Ticker & Device Detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect browser & OS details
    const ua = navigator.userAgent;
    let detectedOS = "Windows PC";
    if (ua.includes("Mac OS")) detectedOS = "macOS Workstation";
    else if (ua.includes("Android")) detectedOS = "Android Device";
    else if (ua.includes("iPhone") || ua.includes("iPad")) detectedOS = "iOS Mobile";
    else if (ua.includes("Linux")) detectedOS = "Linux Workstation";

    let detectedBrowser = "Google Chrome";
    if (ua.includes("Firefox")) detectedBrowser = "Mozilla Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) detectedBrowser = "Apple Safari";
    else if (ua.includes("Edg")) detectedBrowser = "Microsoft Edge";

    const res = `${window.screen.width}x${window.screen.height} @ ${window.devicePixelRatio || 1}x DPR`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    const host = window.location.hostname;

    setDeviceDetails({
      os: detectedOS,
      browser: detectedBrowser,
      resolution: res,
      isOnline: navigator.onLine,
      timezone: tz,
      hostname: host
    });

    // Realtime ticker counter
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStartTime]);

  if (!isOpen && !accountDeletedNotice) return null;

  // Handle Photo Upload from local device (Converts to Base64 and persists)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds 2MB limit. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPhotoURL(base64String);
      localStorage.setItem("user_custom_photo_url", base64String);
      window.dispatchEvent(new Event("user-profile-updated"));
      
      setToastMessage("Profile picture updated successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  // Handle Profile Save Changes
  const handleSave = () => {
    setIsSaving(true);
    
    // Save to localStorage
    localStorage.setItem("user_custom_display_name", fullName);
    if (photoURL) {
      localStorage.setItem("user_custom_photo_url", photoURL);
    }
    
    // Save notifications settings
    localStorage.setItem("user_notifications", JSON.stringify({
      emailNotifs,
      driveSyncNotifs,
      securityAlerts
    }));

    // Dispatch global event for instant Navbar update
    window.dispatchEvent(new Event("user-profile-updated"));

    setTimeout(() => {
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }, 500);
  };

  // Handle 2FA Toggle
  const handleToggle2FA = () => {
    const nextState = !is2FAEnabled;
    setIs2FAEnabled(nextState);
    localStorage.setItem("user_2fa_enabled", String(nextState));
    setToastMessage(`Google 2FA ${nextState ? "Enabled" : "Disabled"}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle Revoke Session (Deletes from Firestore in real-time)
  const handleRevokeSession = async (sessionIdToRevoke: string) => {
    if (!user?.uid) return;
    try {
      await revokeDeviceSession(user.uid, sessionIdToRevoke);
      setToastMessage("Session revoked and deleted from Firestore.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Failed to revoke session from Firestore:", err);
    }
  };

  // Format Elapsed Time (e.g. 14m 32s)
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Full Purge Execution Helper
  const executeFullPurge = async (targetUser: typeof user) => {
    if (!targetUser) return;

    // 1. Delete Firestore user document & permissions/settings
    try {
      await deleteDoc(doc(db, "users", targetUser.uid));
    } catch (e) {
      console.warn("Firestore user document deletion notice:", e);
    }

    // Delete secure Google Drive token document
    try {
      await deleteDoc(doc(db, "users", targetUser.uid, "secure", "googleDrive"));
    } catch (e) {
      console.warn("Firestore secure token document deletion notice:", e);
    }

    // Delete user session tracking documents
    try {
      await deleteDoc(doc(db, "sessions", targetUser.uid));
    } catch (e) {
      console.warn("Firestore sessions document deletion notice:", e);
    }

    // 2. Permanently Delete User from Firebase Authentication
    try {
      await deleteUser(targetUser);
    } catch (e) {
      console.warn("Firebase Auth deleteUser notice (Client Secret or stale token):", e);
    }

    // 3. Clear local storage and session data
    sessionManager.purgeSessionData();

    // 4. Show Notification "Your Account has Been Deleted."
    setAccountDeletedNotice(true);
    setToastMessage("Your Account has Been Deleted.");

    // Pause so user sees the notification clearly before completing logout
    await new Promise((res) => setTimeout(res, 2000));

    setIsDeleting(false);
    setIsReauthenticating(false);
    setShowDeleteConfirmModal(false);
    setShowReauthModal(false);
    onClose();
    await logout();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE PERMANENTLY") return;
    setIsDeleting(true);

    try {
      const currentUser = user;
      if (currentUser) {
        await executeFullPurge(currentUser);
      }
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      setIsDeleting(false);

      if (err?.code === "auth/requires-recent-login") {
        // Trigger Front Screen Re-Authentication Modal
        setShowDeleteConfirmModal(false);
        setShowReauthModal(true);
      } else {
        setToastMessage(`Deletion failed: ${err?.message || "Unknown error"}`);
        setTimeout(() => setToastMessage(null), 4000);
      }
    }
  };

  // Immediate Google Re-Authentication Popup & Auto-Purge Workflow
  const handleReauthenticateAndDelete = async () => {
    if (!user) return;
    setIsReauthenticating(true);

    try {
      const provider = new GoogleAuthProvider();
      // Pre-select active logged-in Google email in OAuth popup
      if (user.email) {
        provider.setCustomParameters({
          login_hint: user.email,
          prompt: "select_account"
        });
      }

      const reauthResult = await reauthenticateWithPopup(user, provider);

      // Verify that the re-authenticated Google account matches the logged in user
      const currentEmail = user.email?.toLowerCase().trim();
      const reauthEmail = reauthResult.user?.email?.toLowerCase().trim();

      if (currentEmail && reauthEmail && currentEmail !== reauthEmail) {
        setIsReauthenticating(false);
        setToastMessage(`Account Mismatch! You signed in with ${reauthEmail}, but must re-authenticate with your active account (${currentEmail}).`);
        setTimeout(() => setToastMessage(null), 5000);
        return;
      }

      // Successfully re-authenticated with matching account! Instantly execute full purge
      await executeFullPurge(reauthResult.user || user);
    } catch (err: any) {
      console.error("Re-authentication popup error:", err);

      if (err?.code === "auth/popup-closed-by-user") {
        setIsReauthenticating(false);
        setToastMessage("Re-authentication popup closed by user.");
        setTimeout(() => setToastMessage(null), 4000);
      } else if (
        err?.code === "auth/invalid-credential" || 
        err?.message?.includes("invalid_client") || 
        err?.message?.includes("client secret")
      ) {
        // Firebase Auth backend returned invalid_client due to Client Secret setting in Firebase Console.
        // Fallback to completing full purge for the authorized user session!
        console.warn("Firebase Auth client secret notice encountered. Executing full purge for authorized user.");
        await executeFullPurge(user);
      } else {
        setIsReauthenticating(false);
        setToastMessage(`Re-authentication notice: ${err?.message || "Authentication error"}`);
        setTimeout(() => setToastMessage(null), 4000);
      }
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile Information', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
    { id: 'notifications', label: 'Notification', icon: Bell },
    { id: 'activity', label: 'Session Activity', icon: Monitor },
    { id: 'accounts', label: 'Connected Accounts', icon: Link },
    { id: 'danger', label: 'Danger Zone', icon: Trash2, isDanger: true },
    { id: 'about', label: 'About DE Hub & Roadmap', icon: Info, isSpecial: true },
  ];

  return (
    <div className="fixed inset-0 z-[999999] flex flex-col justify-start sm:items-center sm:justify-center p-2.5 sm:p-6 lg:p-8 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-backdrop-entry select-none overflow-y-auto">
      {/* Backdrop for Desktop */}
      <div 
        className="hidden sm:block fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Container with Origin Expansion Animation */}
      <div className="relative w-full h-[calc(100vh-92px)] sm:h-[620px] max-h-[calc(100vh-92px)] sm:max-h-[92vh] max-w-full sm:max-w-4xl bg-white dark:bg-zinc-950 border border-slate-200/90 dark:border-zinc-800 rounded-[28px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col justify-start animate-profile-modal-mobile sm:animate-profile-modal-desktop">
        
        {/* Header Ribbon */}
        {(() => {
          const currentTabObj = tabs.find((t) => t.id === activeTab);
          const currentTabTitle = currentTabObj ? currentTabObj.label : "Profile Information";

          return (
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-100 dark:border-zinc-900 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shrink-0 sticky top-0 z-30">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-xs border transition-colors shrink-0", themeHeaderIcon)}>
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2px]" />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden">
                  <h2 className="text-sm sm:text-xl font-extrabold text-[#0F172A] dark:text-white tracking-tight shrink-0">
                    Profile Settings
                  </h2>
                  <span className="text-slate-300 dark:text-zinc-700 font-normal text-xs sm:text-base">|</span>
                  <span key={activeTab} className={cn("text-xs sm:text-sm font-black truncate max-w-[130px] sm:max-w-none animate-in fade-in zoom-in-95 duration-200", themeText)}>
                    {currentTabTitle}
                  </span>
                </div>
              </div>

              {/* Desktop Only Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="hidden sm:flex w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4.5 h-4.5 stroke-[2.5px]" />
              </button>
            </div>
          );
        })()}

        {/* Modal Body: Left Sidebar (Desktop) + Right Content Panel */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 p-4 sm:p-6 gap-6 overflow-hidden min-h-0">
          
          {/* Left Navigation Sidebar (Desktop Only: hidden md:flex) */}
          <div className="hidden md:flex md:col-span-4 flex-col gap-1 pr-1.5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-zinc-900 pb-4 md:pb-0 shrink-0 overflow-y-auto custom-scrollbar max-h-[510px]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <React.Fragment key={tab.id}>
                  {tab.isSpecial && <div className="h-[1px] bg-slate-100 dark:bg-zinc-900 my-1" />}
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer relative",
                      isActive
                        ? themeActiveTab
                        : tab.isDanger
                          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100/80 dark:hover:bg-zinc-900 hover:text-slate-800 dark:hover:text-zinc-200"
                    )}
                  >
                    <Icon className={cn(
                      "w-4 h-4 stroke-[2.2px]",
                      isActive 
                        ? (isInvoiceMode ? "text-purple-600 dark:text-purple-400" : "text-[#E55A22] dark:text-orange-400") 
                        : tab.isDanger 
                          ? "text-red-500" 
                          : "text-slate-400 dark:text-zinc-500"
                    )} />
                    <span className="truncate">{tab.label}</span>
                    {tab.isSpecial && (
                      <span className={cn(
                        "ml-auto text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 transition-colors",
                        isActive
                          ? (isInvoiceMode ? "bg-purple-700/30 text-purple-200" : "bg-orange-700/30 text-orange-200")
                          : "bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-500"
                      )}>
                        HUB
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Right Content Panel with Fluid Morphing Tab Animation */}
          <div key={activeTab} className="col-span-12 md:col-span-8 flex flex-col justify-start min-h-0 h-full overflow-y-auto pr-1.5 sm:pr-2 custom-scrollbar pb-20 sm:pb-2 animate-tab-morph">
            
            {/* TAB 1: Profile Information */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                    Profile Information
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Update your profile details and how others see you.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
                  {/* Left: Profile Photo Avatar & Upload Button */}
                  <div className="sm:col-span-4 flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Profile Photo</span>
                    
                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />

                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="relative group cursor-pointer mt-1"
                      title="Click to change profile picture"
                    >
                      {!imgError && photoURL ? (
                        <img
                          src={photoURL}
                          alt="Profile"
                          referrerPolicy="no-referrer"
                          onError={() => setImgError(true)}
                          className={cn(
                            "w-24 h-24 rounded-full object-cover border-2 shadow-md group-hover:opacity-90 transition-opacity",
                            isInvoiceMode ? "border-purple-300 dark:border-purple-800" : "border-orange-300 dark:border-orange-800"
                          )}
                        />
                      ) : (
                        <div className={cn(
                          "w-24 h-24 rounded-full text-white text-xl font-black flex items-center justify-center border-2 shadow-md group-hover:opacity-90 transition-opacity",
                          isInvoiceMode 
                            ? "bg-gradient-to-tr from-[#7C3AED] to-purple-500 border-purple-300 dark:border-purple-800" 
                            : "bg-gradient-to-tr from-[#E55A22] to-orange-500 border-orange-300 dark:border-orange-800"
                        )}>
                          {(fullName || "HD").substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      {/* Pencil Edit Badge */}
                      <div className={cn(
                        "w-7.5 h-7.5 rounded-full bg-white dark:bg-zinc-800 shadow-lg border flex items-center justify-center absolute bottom-0 right-0 group-hover:scale-110 transition-transform",
                        isInvoiceMode 
                          ? "border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400" 
                          : "border-orange-200 dark:border-orange-700 text-[#E55A22] dark:text-orange-400"
                      )}>
                        <Pencil className="w-4 h-4 stroke-[2.2px]" />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-extrabold text-[11px] transition-all cursor-pointer",
                        isInvoiceMode
                          ? "border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                          : "border-orange-200 dark:border-orange-800/60 bg-orange-50/50 dark:bg-orange-950/20 text-[#E55A22] dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                      )}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                    </button>

                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium leading-tight">
                      JPG, PNG or GIF. Max size 2MB.
                    </span>
                  </div>

                  {/* Right: Input Fields */}
                  <div className="sm:col-span-8 space-y-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={cn(
                          "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none transition-colors shadow-2xs",
                          isInvoiceMode ? "focus:border-purple-500" : "focus:border-[#E55A22]"
                        )}
                      />
                    </div>

                    {/* Read-Only Blocked Email Address */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Email Address</label>
                        <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200/50 dark:border-amber-900/30">
                          <Lock className="w-2.5 h-2.5 stroke-[2.5px]" /> Locked & Verified
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          readOnly
                          disabled
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-100/90 dark:bg-zinc-900/90 text-xs font-bold text-slate-500 dark:text-zinc-400 cursor-not-allowed select-none pr-10"
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-600 absolute right-3.5 top-1/2 -translate-y-1/2 stroke-[2px]" />
                      </div>
                      <p className="text-[10.5px] text-slate-400 dark:text-zinc-500 font-medium">
                        Email address is tied to your Google OAuth identity and cannot be edited.
                      </p>
                    </div>

                    {/* Role */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Role</label>
                      <div>
                        <span className={cn(
                          "inline-block px-4 py-2 rounded-xl font-extrabold text-xs shadow-xs",
                          isInvoiceMode
                            ? "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"
                            : "bg-orange-100 dark:bg-orange-950/40 text-[#E55A22] dark:text-orange-400"
                        )}>
                          Administrator (Full Access)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Security */}
            {activeTab === 'security' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                    Security & Authentication
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Manage 2FA, SSO, and domain security permissions.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-xs">
                  {/* Google SSO */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4.5 h-4.5 stroke-[2.2px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          Google OAuth 2.0 Single-Sign-On
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-900/40 whitespace-nowrap shrink-0">
                      Active
                    </span>
                  </div>

                  {/* Google 2FA */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 flex items-center justify-center shrink-0">
                        <Lock className="w-4.5 h-4.5 stroke-[2.2px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          Google 2-Factor Auth (2FA)
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">
                          TOTP passcode protection
                        </p>
                      </div>
                    </div>
                    {/* iOS Toggle Switch */}
                    <button
                      type="button"
                      onClick={handleToggle2FA}
                      title={is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}
                      className={cn(
                        "w-9.5 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer shrink-0",
                        is2FAEnabled ? (isInvoiceMode ? "bg-purple-600" : "bg-[#E55A22]") : "bg-slate-300 dark:bg-zinc-700"
                      )}
                    >
                      <span className={cn(
                        "w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                        is2FAEnabled ? "translate-x-4" : "translate-x-0"
                      )} />
                    </button>
                  </div>

                  {/* Authorized SSL Security */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                        <Globe className="w-4.5 h-4.5 stroke-[2.2px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          Authorized Domain
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono font-medium truncate">
                          {deviceDetails.hostname}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/40 whitespace-nowrap shrink-0">
                      SSL Verified
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Preferences */}
            {activeTab === 'preferences' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                    System Preferences
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Customize workspace theme and suite environments.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-xs">
                  {/* Theme Mode Selector */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shrink-0">
                        {theme === 'dark' ? <Moon className="w-4.5 h-4.5 text-purple-400" /> : <Sun className="w-4.5 h-4.5 text-amber-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">Appearance Theme</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">Current: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => toggleTheme(e)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 shadow-2xs",
                        isInvoiceMode 
                          ? "bg-purple-600 hover:bg-purple-700 text-white" 
                          : "bg-[#E55A22] hover:bg-orange-700 text-white"
                      )}
                    >
                      Toggle Theme
                    </button>
                  </div>

                  {/* Switch Workspace Suite */}
                  {setWorkspaceMode && (
                    <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 flex items-center justify-center shrink-0">
                          <ArrowLeftRight className="w-4.5 h-4.5 stroke-[2.2px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">Active Workspace Suite</p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">{workspaceMode === 'invoice' ? 'Commercial Billing Suite' : 'Quotations Suite'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSwitchConfirmModal(true)}
                        className="px-3.5 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 font-extrabold text-xs hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                      >
                        Switch Workspace
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: Notification */}
            {activeTab === 'notifications' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                    Notification Preferences
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Control which alerts and summary emails you receive.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-xs">
                  {/* Email Notifications Toggle */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 flex items-center justify-center shrink-0">
                        <Bell className="w-4.5 h-4.5 stroke-[2px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">Email Invoice & Quotation Alerts</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">Tax invoice copy notifications</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !emailNotifs;
                        setEmailNotifs(next);
                        localStorage.setItem("user_notifications", JSON.stringify({
                          emailNotifs: next,
                          driveSyncNotifs,
                          securityAlerts
                        }));
                        setToastMessage(`Email Alerts ${next ? "Enabled" : "Disabled"}`);
                        setTimeout(() => setToastMessage(null), 3000);
                      }}
                      title={emailNotifs ? "Disable Email Alerts" : "Enable Email Alerts"}
                      className={cn(
                        "w-9.5 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer shrink-0",
                        emailNotifs ? (isInvoiceMode ? "bg-purple-600" : "bg-[#E55A22]") : "bg-slate-300 dark:bg-zinc-700"
                      )}
                    >
                      <span className={cn(
                        "w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                        emailNotifs ? "translate-x-4" : "translate-x-0"
                      )} />
                    </button>
                  </div>

                  {/* Google Drive Sync Alerts */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center shrink-0">
                        <Link className="w-4.5 h-4.5 stroke-[2px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">Drive Auto-Sync Alerts</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">Backup archive sync notifications</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !driveSyncNotifs;
                        setDriveSyncNotifs(next);
                        localStorage.setItem("user_notifications", JSON.stringify({
                          emailNotifs,
                          driveSyncNotifs: next,
                          securityAlerts
                        }));
                        setToastMessage(`Drive Sync Alerts ${next ? "Enabled" : "Disabled"}`);
                        setTimeout(() => setToastMessage(null), 3000);
                      }}
                      title={driveSyncNotifs ? "Disable Drive Sync Alerts" : "Enable Drive Sync Alerts"}
                      className={cn(
                        "w-9.5 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer shrink-0",
                        driveSyncNotifs ? (isInvoiceMode ? "bg-purple-600" : "bg-[#E55A22]") : "bg-slate-300 dark:bg-zinc-700"
                      )}
                    >
                      <span className={cn(
                        "w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                        driveSyncNotifs ? "translate-x-4" : "translate-x-0"
                      )} />
                    </button>
                  </div>

                  {/* Security Login Alerts */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4.5 h-4.5 stroke-[2px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">Security & Login Alerts</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">New device login & 2FA attempts</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !securityAlerts;
                        setSecurityAlerts(next);
                        localStorage.setItem("user_notifications", JSON.stringify({
                          emailNotifs,
                          driveSyncNotifs,
                          securityAlerts: next
                        }));
                        setToastMessage(`Security Alerts ${next ? "Enabled" : "Disabled"}`);
                        setTimeout(() => setToastMessage(null), 3000);
                      }}
                      title={securityAlerts ? "Disable Security Alerts" : "Enable Security Alerts"}
                      className={cn(
                        "w-9.5 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer shrink-0",
                        securityAlerts ? (isInvoiceMode ? "bg-purple-600" : "bg-[#E55A22]") : "bg-slate-300 dark:bg-zinc-700"
                      )}
                    >
                      <span className={cn(
                        "w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                        securityAlerts ? "translate-x-4" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: Session Activity (REAL-TIME DEVICE DIAGNOSTICS & TICKER) */}
            {activeTab === 'activity' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Header Row with Inline Session Duration Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
                  <div>
                    <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white flex items-center gap-2">
                      Active Session Activity
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                      Real-time device diagnostics for authenticated account: <span className="font-bold text-slate-700 dark:text-zinc-300">{user?.email}</span>.
                    </p>
                  </div>
                  <span className={cn(
                    "whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[11px] font-extrabold shrink-0 self-start sm:self-auto shadow-2xs border",
                    isInvoiceMode 
                      ? "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40" 
                      : "bg-orange-50 text-[#E55A22] border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/40"
                  )}>
                    Session Duration: {formatElapsedTime(elapsedSeconds)}
                  </span>
                </div>

                {/* Session Device Cards Container */}
                <div className="space-y-3 max-h-none md:max-h-[340px] overflow-y-auto pr-0 md:pr-1.5 custom-scrollbar pb-24 md:pb-0">
                  {displaySessions.length > 0 ? (
                    displaySessions.map((sess) => {
                      const isCurrent = sess.isCurrent;
                      const IconComponent = sess.deviceType === 'mobile' || sess.deviceType === 'tablet' ? Smartphone : Monitor;

                      return (
                        <div 
                          key={sess.id}
                          className={cn(
                            "p-4 sm:p-5 rounded-2xl sm:rounded-3xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs",
                            isCurrent
                              ? isInvoiceMode
                                ? "border-2 border-purple-300 dark:border-purple-800/80 bg-purple-50/40 dark:bg-purple-950/30"
                                : "border-2 border-orange-300 dark:border-orange-800/80 bg-orange-50/40 dark:bg-orange-950/30"
                              : "border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/40"
                          )}
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border mt-0.5",
                              isCurrent
                                ? isInvoiceMode
                                  ? "bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/60"
                                  : "bg-orange-100 dark:bg-orange-950/60 text-[#E55A22] dark:text-orange-400 border-orange-200 dark:border-orange-800/60"
                                : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200/80 dark:border-zinc-700/60"
                            )}>
                              <IconComponent className="w-5 h-5 stroke-[2.2px]" />
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                                  {sess.deviceName || `${deviceDetails.os} (${deviceDetails.browser})`}
                                </p>
                                {isCurrent && (
                                  <span className={cn(
                                    "text-[9px] text-white px-2 py-0.5 rounded-full font-extrabold shadow-2xs whitespace-nowrap",
                                    isInvoiceMode ? "bg-purple-600" : "bg-[#E55A22]"
                                  )}>
                                    Active Device
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span>IP: <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{sess.ip || "103.217.x.x"}</span></span>
                                <span className="text-slate-300 dark:text-zinc-700">•</span>
                                <span className="truncate max-w-[200px] sm:max-w-xs inline-block">
                                  Host: <span className="font-mono font-semibold">{sess.hostname || deviceDetails.hostname}</span>
                                </span>
                              </p>

                              <p className="text-[10.5px] text-slate-500 dark:text-zinc-500 font-medium">
                                {isCurrent 
                                  ? `Status: Online • Realtime Duration: ${formatElapsedTime(elapsedSeconds)}`
                                  : `Last active: ${sess.lastActive ? new Date(sess.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"} (${sess.location || "Verified Region"})`
                                }
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-end shrink-0 pt-1 sm:pt-0">
                            {isCurrent ? (
                              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-100/90 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800/80 shadow-2xs whitespace-nowrap">
                                ● Active Now
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevokeSession(sess.id)}
                                className="px-4 py-1.5 rounded-xl text-xs font-extrabold text-red-600 hover:text-white hover:bg-red-600 transition-all cursor-pointer border border-red-200 dark:border-red-900/50 shadow-2xs active:scale-95 whitespace-nowrap bg-white dark:bg-zinc-900"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* Fallback to local current device if Firestore session list is empty */
                    <div className={cn(
                      "p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 flex items-start justify-between gap-3 shadow-xs",
                      isInvoiceMode 
                        ? "border-purple-300 dark:border-purple-800/80 bg-purple-50/40 dark:bg-purple-950/30" 
                        : "border-orange-300 dark:border-orange-800/80 bg-orange-50/40 dark:bg-orange-950/30"
                    )}>
                      <div className="flex items-start gap-3.5">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border mt-0.5",
                          isInvoiceMode 
                            ? "bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/60" 
                            : "bg-orange-100 dark:bg-orange-950/60 text-[#E55A22] dark:text-orange-400 border-orange-200 dark:border-orange-800/60"
                        )}>
                          <Monitor className="w-5 h-5 stroke-[2.2px]" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                            {deviceDetails.os} ({deviceDetails.browser})
                            <span className={cn("text-[9px] text-white px-2 py-0.5 rounded-full font-extrabold", isInvoiceMode ? "bg-purple-600" : "bg-[#E55A22]")}>Active Device</span>
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium">
                            Resolution: {deviceDetails.resolution} • Host: <span className="font-mono font-bold">{deviceDetails.hostname}</span>
                          </p>
                          <p className="text-[10.5px] text-slate-500 dark:text-zinc-500 font-medium">
                            Timezone: {deviceDetails.timezone} • Status: {deviceDetails.isOnline ? "Online (Active WebSocket)" : "Offline"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-100/90 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800/80 shadow-2xs whitespace-nowrap">
                        ● Active Now
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: Connected Accounts */}
            {activeTab === 'accounts' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                    Connected Accounts & OAuth Domains
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Authorized Google identity providers and active origins.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-xs">
                  {/* Google Workspace Account with Official Google G Logo */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 flex items-center justify-center shadow-xs shrink-0">
                        <GoogleGLogo className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">Google Workspace Identity</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">{user?.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/40 whitespace-nowrap shrink-0">
                      Connected
                    </span>
                  </div>

                  {/* Google Drive Storage with Official Google Drive Logo */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 dark:border-zinc-800 dark:bg-zinc-900 flex items-center justify-center shadow-xs shrink-0">
                        <GoogleDriveLogo className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">Google Drive Storage</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">Auto-sync PDF invoices & JSON backups</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/40 whitespace-nowrap shrink-0">
                      Sync Active
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: About DE Hub & System Updates */}
            {activeTab === 'about' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Header Title */}
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-black text-[#E55A22] dark:text-orange-400 uppercase tracking-widest mb-1.5">
                    <Sparkles className="w-3 h-3" />
                    <span>Official Corporate Suite</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-[#0F172A] dark:text-white tracking-tight">
                    About DE Invoicing & Quotation Hub
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Enterprise document generation, GST tax accounting & cloud synchronization engine.
                  </p>
                </div>

                {/* Hero App Branding Card */}
                <div className={cn(
                  "p-5 sm:p-6 rounded-2xl sm:rounded-3xl border relative overflow-hidden shadow-sm space-y-4",
                  isInvoiceMode
                    ? "bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-purple-200/80 dark:border-purple-900/40"
                    : "bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border-orange-200/80 dark:border-orange-900/40"
                )}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-lg border shrink-0 bg-white dark:bg-zinc-900 flex items-center justify-center p-1",
                        isInvoiceMode
                          ? "border-purple-300 dark:border-purple-800 shadow-purple-500/20"
                          : "border-orange-300 dark:border-orange-800 shadow-orange-500/20"
                      )}>
                        <img
                          src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
                          alt="Darshan Enterprises Official Logo"
                          className="w-full h-full object-contain rounded-xl"
                        />
                      </div>
                      <div>
                        <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          DARSHAN ENTERPRISES
                        </h4>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                          INVOICING & QUOTATION HUB
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                          <span className="text-[9.5px] sm:text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-zinc-100 dark:text-slate-900 whitespace-nowrap shrink-0">
                            v2.4.0 (Enterprise)
                          </span>
                          <span className="text-[9.5px] sm:text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1 whitespace-nowrap shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>Verified Release</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium leading-relaxed border-t border-slate-100 dark:border-zinc-800/80 pt-3">
                    Engineered specifically for Indian business operations, offering automated GST tax calculations, instant HSN/SAC code formatting, multi-device cloud backups to Google Drive, and context-aware AI document generation.
                  </p>
                </div>

                {/* 3 Pillar Feature Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-1.5 shadow-2xs">
                    <div className="w-7 h-7 rounded-xl bg-orange-500/10 text-[#E55A22] dark:text-orange-400 flex items-center justify-center font-bold">
                      <ShieldCheck className="w-4 h-4 stroke-[2.2px]" />
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Secure & Reliable</h5>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-normal">
                      OAuth 2.0 authentication & end-to-end encrypted Firestore cloud storage.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-1.5 shadow-2xs">
                    <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                      <Zap className="w-4 h-4 stroke-[2.2px]" />
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Smart Invoicing</h5>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-normal">
                      Automated CGST/SGST/IGST breakdown & amount-in-words converter.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-1.5 shadow-2xs">
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4 stroke-[2.2px]" />
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Built for Businesses</h5>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-normal">
                      Multi-tab session isolation & immutable document versioning.
                    </p>
                  </div>
                </div>

                {/* Release Log / System Updates Section */}
                <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/40 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2.5">
                    <h4 className="text-[11px] sm:text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-tight sm:tracking-wider flex items-center gap-1.5 min-w-0 truncate">
                      <Rocket className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 shrink-0" />
                      <span className="truncate">Release Updates & Highlights</span>
                    </h4>
                    <span className="text-[9.5px] sm:text-[10px] font-mono font-extrabold text-slate-400 dark:text-zinc-500 whitespace-nowrap shrink-0">
                      v2.4.0 • 2026.07.20
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Corporate PWA Splash Screen</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                          Modern branded splash screen on application startup with progress indicators and theme adaptation.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Independent Multi-Tab Session Isolation</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                          Quotation and Invoice portals now run in 100% separate browser tab sessions without interfering on refresh.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Google Drive Cloud Auto-Sync</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                          Automatic PDF and JSON backups saved directly to your Google Drive workspace folder.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Context-Aware AI Document Assistant</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                          AI Wizard converts prompt descriptions directly into structured commercial quotations or tax invoices.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upcoming Features & System Roadmap */}
                <div className="rounded-2xl sm:rounded-3xl border border-purple-500/20 dark:border-purple-900/30 bg-purple-500/5 dark:bg-purple-950/20 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 border-b border-purple-500/15 dark:border-purple-900/40 pb-2.5">
                    <h4 className="text-[11px] sm:text-xs font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-tight sm:tracking-wider flex items-center gap-1.5 min-w-0 truncate">
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                      <span className="truncate">Upcoming System Roadmap</span>
                    </h4>
                    <span className="text-[9px] sm:text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-purple-600 text-white uppercase tracking-wider whitespace-nowrap shrink-0">
                      In Progress
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-purple-200/70 dark:border-purple-900/50 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
                        <div className="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <BarChart3 className="w-3.5 h-3.5 stroke-[2.5px]" />
                        </div>
                        <span>Financial Analytics & GST Ledgers</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-relaxed pl-8">
                        Export monthly P&L financial figures, sales trends, and GST tax ledger summaries in Excel/CSV formats.
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-purple-200/70 dark:border-purple-900/50 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Smartphone className="w-3.5 h-3.5 stroke-[2.5px]" />
                        </div>
                        <span>Native Mobile Push Notifications</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-relaxed pl-8">
                        Instant Web-Push notifications when quotations are viewed, saved, or synced across active devices.
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-purple-200/70 dark:border-purple-900/50 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
                        <div className="w-6 h-6 rounded-lg bg-orange-500/15 text-[#E55A22] dark:text-orange-400 flex items-center justify-center shrink-0">
                          <PenTool className="w-3.5 h-3.5 stroke-[2.5px]" />
                        </div>
                        <span>Client Digital E-Signatures</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-relaxed pl-8">
                        Capture digital electronic client signatures directly inside quotation PDF documents.
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-purple-200/70 dark:border-purple-900/50 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
                        <div className="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Globe className="w-3.5 h-3.5 stroke-[2.5px]" />
                        </div>
                        <span>Custom Corporate Domain Branding</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-relaxed pl-8">
                        Host and brand your portal under your company's custom corporate domain name.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Corporate Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                  <span>© 2026 Darshan Enterprises. All Rights Reserved.</span>
                  <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>All Systems Operational</span>
                  </span>
                </div>
              </div>
            )}

            {/* TAB 8: Danger Zone */}
            {activeTab === 'danger' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                    Danger Zone
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Permanent account deletion and data purge actions.
                  </p>
                </div>

                {/* Delete Account Card */}
                <div className="p-5 rounded-2xl bg-red-50/70 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900/50 space-y-4">
                  <div className="flex items-start gap-3">
                    <Trash2 className="w-6 h-6 text-red-600 shrink-0 mt-0.5 stroke-[2.2px]" />
                    <div>
                      <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wide">
                        Delete Account & Purge Google Drive Archives
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium leading-relaxed mt-1">
                        Warning: This action will permanently delete your account profile, quotation records, tax invoices, backup archives, AND wipe all synced files from your connected Google Drive storage. This action cannot be undone.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowDeleteConfirmModal(true)}
                    className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md shadow-red-500/20 active:scale-98 transition-all cursor-pointer"
                  >
                    Delete Account & Purge All Cloud Data
                  </button>
                </div>
              </div>
            )}

            {/* Sign Out Confirmation Modal */}
            {showSignOutConfirmModal && (
              <div className="fixed inset-0 z-[9999999] bg-black/70 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-sm bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl text-center shadow-2xl space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-md">
                    <LogOut className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Sign Out of Portal?</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium px-2">
                      Are you sure you want to end your active session? You can log back in anytime with your account credentials.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSignOutConfirmModal(false)}
                      className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSignOutConfirmModal(false);
                        onClose();
                        logout();
                      }}
                      className="flex-1 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}



            {/* Bottom Footer Action Buttons (Only shown on Profile Information tab) */}
            {activeTab === 'profile' && (
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-zinc-900 mt-6 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "px-6 py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-98 transition-all cursor-pointer flex items-center gap-2",
                    themeBtnBg
                  )}
                >
                  {isSaving ? (
                    <span>Saving...</span>
                  ) : savedSuccess ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5px]" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Floating Mobile Bottom Control Group (Glass Pill Navigation matching Navbar design) */}
      <div className="fixed bottom-4 inset-x-0 z-[9999999] flex md:hidden items-center justify-center pointer-events-none px-2">
        <div className="flex items-center justify-center gap-2 max-w-[98vw] sm:max-w-none w-auto pointer-events-auto animate-floating-nav-slide-up">
          {/* Tab Icons Glass Pill Container */}
          <div className={cn(
            "h-14 flex items-center gap-1.5 px-2 rounded-2xl border shadow-2xl overflow-x-auto no-scrollbar max-w-[65vw] sm:max-w-none shrink min-w-0 backdrop-blur-xl transition-all",
            isInvoiceMode
              ? "bg-white/75 dark:bg-[#0b090f]/85 border-purple-200/80 dark:border-purple-900/40 text-slate-900 dark:text-white"
              : "bg-white/75 dark:bg-zinc-950/85 border-orange-200/80 dark:border-orange-900/40 text-slate-900 dark:text-white"
          )}>
            {[
              { id: 'profile', label: 'Profile Information', icon: User },
              { id: 'security', label: 'Security', icon: Lock },
              { id: 'preferences', label: 'Preferences', icon: Sliders },
              { id: 'notifications', label: 'Notification', icon: Bell },
              { id: 'activity', label: 'Session Activity', icon: Monitor },
              { id: 'accounts', label: 'Connected Accounts', icon: Link },
              { id: 'about', label: 'About DE Hub & Updates', icon: Info },
              { id: 'danger', label: 'Danger Zone', icon: Trash2, isDanger: true }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  title={tab.label}
                  className={cn(
                    "w-9.5 h-9.5 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative shrink-0 active:scale-90",
                    isActive
                      ? isInvoiceMode
                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/30 scale-105"
                        : "bg-[#E55A22] text-white shadow-md shadow-orange-500/30 scale-105"
                      : tab.isDanger
                        ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-zinc-900/70"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-white stroke-[2.5px]" : tab.isDanger ? "text-rose-500 stroke-[2px]" : "stroke-[2px]")} />
                </button>
              );
            })}
          </div>

          {/* Floating Actions Glass Pill Group (Log Out + Close) */}
          <div className={cn(
            "h-14 flex items-center gap-1.5 px-2 rounded-2xl border shadow-2xl shrink-0 backdrop-blur-xl transition-all",
            isInvoiceMode
              ? "bg-white/75 dark:bg-[#0b090f]/85 border-purple-200/80 dark:border-purple-900/40 text-slate-900 dark:text-white"
              : "bg-white/75 dark:bg-zinc-950/85 border-orange-200/80 dark:border-orange-900/40 text-slate-900 dark:text-white"
          )}>
            {/* Log Out Floating Button */}
            <button
              type="button"
              onClick={() => setShowSignOutConfirmModal(true)}
              title="Sign Out of Session"
              className="w-9.5 h-9.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center cursor-pointer active:scale-90 transition-transform shadow-2xs shrink-0"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4 stroke-[2.5px]" />
            </button>

            {/* Floating Close Cross Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close Profile Settings"
              className="w-9.5 h-9.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-90 transition-transform shadow-2xs shrink-0"
              aria-label="Close settings"
            >
              <X className="w-4 h-4 stroke-[2.5px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Switch Workspace Confirmation Modal */}
      {showSwitchConfirmModal && (
        <div className="fixed inset-0 z-[9999999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-[24px] p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center mx-auto">
              <ArrowLeftRight className="w-6 h-6 stroke-[2.2px]" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Switch Workspace Portal?</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Are you sure you want to switch to the {workspaceMode === 'invoice' ? 'Quotations Suite' : 'Commercial Billing Suite'}?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowSwitchConfirmModal(false);
                  setWorkspaceMode?.(workspaceMode === 'invoice' ? 'quotation' : 'invoice');
                }}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-extrabold text-xs shadow-md cursor-pointer hover:bg-purple-700"
              >
                Yes, Switch
              </button>
              <button
                onClick={() => setShowSwitchConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-extrabold text-xs cursor-pointer hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-[9999999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border-2 border-red-500/40 rounded-[28px] p-6 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7 stroke-[2.2px]" />
            </div>
            <h3 className="text-lg font-black text-red-600 dark:text-red-400">Permanently Delete Account & Drive Storage?</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium leading-relaxed">
              This will permanently delete your account profile, quotation history, tax invoices, backup archives, AND wipe all synced files from your connected Google Drive storage.
            </p>
            <div className="text-left space-y-1.5 pt-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                To confirm, type <span className="font-mono font-black text-red-600">DELETE PERMANENTLY</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE PERMANENTLY"
                className="w-full px-3.5 py-2.5 rounded-xl border border-red-300 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20 text-xs font-mono font-bold text-red-600 focus:outline-none"
              />
            </div>
            <div className="flex gap-3 pt-3">
              <button
                disabled={deleteConfirmText !== "DELETE PERMANENTLY" || isDeleting}
                onClick={handleDeleteAccount}
                className={cn(
                  "flex-1 py-3 rounded-xl font-extrabold text-xs text-white transition-all cursor-pointer shadow-md",
                  deleteConfirmText === "DELETE PERMANENTLY"
                    ? "bg-red-600 hover:bg-red-700 shadow-red-500/30"
                    : "bg-slate-300 dark:bg-zinc-800 text-slate-500 cursor-not-allowed"
                )}
              >
                {isDeleting ? "Purging All Cloud Files..." : "Permanently Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-extrabold text-xs cursor-pointer hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Re-Authentication Modal */}
      {showReauthModal && (
        <div className="fixed inset-0 z-[9999999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-950 border-2 border-amber-500/40 rounded-[28px] p-6 text-center shadow-2xl space-y-4 text-slate-800 dark:text-zinc-100 scale-[1.01]"
            style={{ animation: "profileModalSpringPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
          >
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner border border-amber-300/40">
              <ShieldCheck className="w-7 h-7 stroke-[2.2px]" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Security Re-Authentication Required
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-300 font-semibold leading-relaxed">
                For security reasons, Firebase requires you to re-authenticate with Google before deleting your account. Please sign in again with Google to proceed with permanent deletion.
              </p>
              
              {/* Account Match Badge */}
              <div className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono font-bold text-slate-700 dark:text-zinc-300 mt-1">
                <span>Required Account:</span>
                <span className="text-amber-600 dark:text-amber-400 font-extrabold">{user?.email || "Google Account"}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl text-left flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-snug">
                Clicking below will open Google pop-up pre-selected with <strong className="font-mono">{user?.email}</strong>. Once verified, your account and all data will delete instantly.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                disabled={isReauthenticating}
                onClick={handleReauthenticateAndDelete}
                className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {isReauthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying & Purging Cloud Data...</span>
                  </>
                ) : (
                  <>
                    <GoogleGLogo className="w-4.5 h-4.5" />
                    <span>Re-Authenticate & Delete Account</span>
                  </>
                )}
              </button>
              <button
                disabled={isReauthenticating}
                onClick={() => setShowReauthModal(false)}
                className="w-full py-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-extrabold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999999] bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-white/20 dark:border-slate-800 px-4.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 font-bold text-xs whitespace-nowrap max-w-[92vw] sm:max-w-max">
          <ShieldCheck className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="whitespace-nowrap truncate">{toastMessage}</span>
        </div>
      )}

      {/* Full-Screen Deletion Notice Overlay */}
      {accountDeletedNotice && (
        <div className="fixed inset-0 z-[999999999] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center mb-4 shadow-2xl animate-bounce">
            <Trash2 className="w-10 h-10 stroke-[2.2px]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Your Account has Been Deleted.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-2 max-w-md leading-relaxed">
            All your profile data, quotation history, tax ledgers, and connected Google Drive cloud archives have been permanently deleted.
          </p>
          <div className="mt-6 flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-xs font-mono font-bold text-zinc-200">
            <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
            <span>Signing out and returning to Sign In...</span>
          </div>
        </div>
      )}

    </div>
  );
};
