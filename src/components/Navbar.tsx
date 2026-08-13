"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Settings, 
  LogOut, 
  Sun, 
  Moon, 
  User, 
  Receipt, 
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  X,
  ShieldCheck,
  Sparkles,
  WifiOff,
  Wifi
} from "lucide-react";
import { cn } from "../lib/utils";
import { ProfileSettingsModal } from "./settings/ProfileSettingsModal";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  workspaceMode?: 'quotation' | 'invoice' | null;
  setWorkspaceMode?: (mode: 'quotation' | 'invoice' | null) => void;
  onOpenAIGenerator?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, 
  setActiveTab, 
  workspaceMode = 'quotation', 
  setWorkspaceMode,
  onOpenAIGenerator
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isOffline, showRestoredNotice, dismissRestoredNotice } = useNetworkStatus();
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileCanvas, setShowProfileCanvas] = useState(false);

  // Custom profile overrides state (persistent from Profile Settings Modal)
  const [customName, setCustomName] = useState<string | null>(null);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const loadCustomProfile = () => {
      setCustomName(localStorage.getItem("user_custom_display_name"));
      setCustomPhoto(localStorage.getItem("user_custom_photo_url"));
      setImgError(false);
    };
    loadCustomProfile();
    window.addEventListener("user-profile-updated", loadCustomProfile);
    return () => window.removeEventListener("user-profile-updated", loadCustomProfile);
  }, []);

  useEffect(() => {
    if (showSwitchModal || showProfileCanvas) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [showSwitchModal, showProfileCanvas]);

  // Outside click listener to auto-close profile dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".profile-dropdown-container")) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const isInvoiceMode = workspaceMode === 'invoice';

  const navItems = isInvoiceMode
    ? [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "form", label: "New Tax Invoice", icon: FileSpreadsheet },
        { id: "settings", label: "Workspace Settings", icon: Settings },
      ]
    : [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "form", label: "New Quotation", icon: FileSpreadsheet },
        { id: "settings", label: "Workspace Settings", icon: Settings },
      ];

  return (
    <>
      {/* Desktop Header - Interactive 3D Cube Flip & Shrink/Expand Stage */}
      <header className="hidden md:block sticky top-0 z-40 w-full px-3 py-2.5 sm:px-6 transition-all duration-300 [perspective:1200px]">
        <div className={cn(
          "relative w-full mx-auto transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] [transform-style:preserve-3d]",
          isOffline 
            ? "max-w-[480px] h-[56px] [transform:rotateX(-180deg)]" 
            : showRestoredNotice
            ? "max-w-full h-[64px] [transform:rotateX(0deg)]"
            : "max-w-full h-[64px] [transform:rotateX(0deg)]"
        )}>
          
          {/* FRONT FACE: Full Desktop Navbar Header */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateX(0deg)] w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-slate-200/90 dark:border-zinc-800 rounded-[22px] shadow-sm flex items-center justify-between px-3.5 py-2 select-none">
            
            {/* Left Accent Indicator Bar */}
            <div className={cn(
              "w-1 h-9 rounded-full shrink-0 mr-2.5 transition-colors duration-300",
              isInvoiceMode ? "bg-[#7C3AED]" : "bg-[#E55A22]"
            )} />

            {/* Brand Logo & Name */}
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
                alt="Logo"
                className="w-8 h-8 object-contain rounded-md border border-slate-200/60 bg-white shadow-xs"
              />
              
              {/* DARSHAN (Orange) ENTERPRISES (Navy/White) */}
              <span className="font-extrabold text-sm tracking-tight flex items-center" style={{ fontFamily: "Arial Black, sans-serif" }}>
                <span className="text-[#F97316]">DARSHAN</span>
                <span className="text-[#0F172A] dark:text-white ml-1.5">ENTERPRISES</span>
              </span>
            </div>

            {/* Center Nav Items */}
            <nav className="flex items-center gap-1.5 mx-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer",
                      isActive 
                        ? isInvoiceMode
                          ? "bg-[#7C3AED] text-white shadow-md shadow-purple-500/25 scale-[1.02]"
                          : "bg-[#E55A22] text-white shadow-md shadow-orange-500/25 scale-[1.02]" 
                        : "text-[#64748B] dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900"
                    )}
                  >
                    <Icon className="w-4 h-4 stroke-[2.2px]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Controls Menu */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Generate with AI Button */}
              {onOpenAIGenerator && (
                <button
                  type="button"
                  onClick={onOpenAIGenerator}
                  className={cn(
                    "relative group flex items-center gap-2 px-4 py-2 rounded-full text-white font-extrabold text-[12.5px] shadow-lg transition-all duration-300 cursor-pointer select-none border border-white/25 shrink-0 active:scale-95 hover:scale-[1.03]",
                    isInvoiceMode
                      ? "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-500 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-400 shadow-purple-500/30 hover:shadow-purple-500/50"
                      : "bg-gradient-to-r from-[#E55A22] via-orange-500 to-amber-500 hover:from-[#E55A22]/90 hover:via-orange-400 hover:to-amber-400 shadow-orange-500/30 hover:shadow-orange-500/50"
                  )}
                >
                  <Sparkles className="w-4 h-4 text-white/90 animate-pulse stroke-[2.4px]" />
                  <span className="tracking-tight text-white font-black drop-shadow-xs">Generate with AI</span>
                  <span className={cn(
                    "bg-white font-black text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs",
                    isInvoiceMode ? "text-purple-700" : "text-orange-700"
                  )}>
                    NEW
                  </span>
                </button>
              )}

              {/* Switch Portal Button */}
              {setWorkspaceMode && (
                <div className="relative group">
                  <button
                    onClick={() => setShowSwitchModal(true)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer border select-none active:scale-[0.97]",
                      isInvoiceMode
                        ? "border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20 text-[#7C3AED] dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                        : "border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20 text-[#E55A22] dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    )}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.2px]" />
                    <span>Switch Portal</span>
                  </button>
                  <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2.5 scale-0 group-hover:scale-100 transition-all duration-150 rounded-xl bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-3 py-1.5 text-[10.5px] text-white tooltip-text whitespace-nowrap z-50 shadow-2xl origin-top font-bold tracking-wide backdrop-blur-md">
                    {isInvoiceMode ? "Switch to Quotations Suite" : "Switch to Commercial Billing Suite"}
                  </span>
                </div>
              )}

              {/* Theme Toggle */}
              <div className="relative group">
                <button
                  onClick={(e) => toggleTheme(e)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-[#64748B] dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all duration-300 cursor-pointer flex items-center justify-center relative overflow-hidden active:scale-90"
                  aria-label="Toggle theme"
                >
                  <div className="relative w-4 h-4 flex items-center justify-center transition-transform duration-500 group-hover:rotate-45">
                    <Sun className={cn(
                      "w-4 h-4 stroke-[2.2px] absolute transition-all duration-500 transform text-amber-400",
                      theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
                    )} />
                    <Moon className={cn(
                      "w-4 h-4 stroke-[2.2px] absolute transition-all duration-500 transform text-slate-700 dark:text-zinc-300",
                      theme === "light" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
                    )} />
                  </div>
                </button>
                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2.5 scale-0 group-hover:scale-100 transition-all duration-150 rounded-xl bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-3 py-1.5 text-[10.5px] text-white tooltip-text whitespace-nowrap z-50 shadow-2xl origin-top font-bold tracking-wide backdrop-blur-md">
                  {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                </span>
              </div>

              {/* Vertical Divider */}
              <div className="w-[1px] h-5 bg-slate-200 dark:bg-zinc-800 mx-0.5" />

              {/* User Profile Details Pill & Dropdown Menu */}
              {user && (
                <div className="relative profile-dropdown-container">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfileDropdown(prev => !prev);
                      }}
                      className="flex items-center gap-2 px-2 py-1 rounded-xl bg-slate-50 dark:bg-zinc-900/50 hover:bg-slate-100 dark:hover:bg-zinc-800/80 border border-slate-200/70 dark:border-zinc-800 transition-all cursor-pointer select-none active:scale-98"
                      aria-label="User profile menu"
                    >
                      {/* Google Profile Photo Avatar or Custom Uploaded Avatar */}
                      {(!imgError && (customPhoto || user.photoURL)) ? (
                        <img
                          src={customPhoto || user.photoURL || ''}
                          alt={customName || user.displayName || "User"}
                          referrerPolicy="no-referrer"
                          onError={() => setImgError(true)}
                          className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-zinc-700 shrink-0"
                        />
                      ) : (
                        <div className={cn(
                          "w-7 h-7 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-xs border border-white/20",
                          isInvoiceMode
                            ? "bg-gradient-to-tr from-[#7C3AED] to-purple-500"
                            : "bg-gradient-to-tr from-[#E55A22] to-orange-500"
                        )}>
                          {(customName || user.displayName || "HD").substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      
                      {/* User info */}
                      <div className="hidden lg:flex flex-col text-left min-w-0 pr-0.5">
                        <p className="text-[12px] font-extrabold text-[#0F172A] dark:text-white leading-tight truncate max-w-[110px]">
                          {customName || user.displayName || "HD_Mixture"}
                        </p>
                        <p className="text-[9.5px] font-medium text-slate-500 dark:text-zinc-400 leading-none truncate max-w-[110px]">
                          {user.email}
                        </p>
                      </div>

                      <ChevronDown className={cn(
                        "w-3.5 h-3.5 stroke-[2.5px] shrink-0 transition-transform duration-200",
                        showProfileDropdown && "rotate-180",
                        isInvoiceMode ? "text-[#7C3AED] dark:text-purple-400" : "text-[#E55A22] dark:text-orange-400"
                      )} />
                    </button>

                    {/* Logout Button */}
                    <div className="relative group">
                      <button
                        onClick={() => window.dispatchEvent(new Event("request-app-logout"))}
                        className={cn(
                          "p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center",
                          isInvoiceMode 
                            ? "border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20 text-[#7C3AED] dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30" 
                            : "border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20 text-[#E55A22] dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                        )}
                        aria-label="Log Out"
                      >
                        <LogOut className="w-4 h-4 stroke-[2.2px]" />
                      </button>
                      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2.5 scale-0 group-hover:scale-100 transition-all duration-150 rounded-xl bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-3 py-1.5 text-[10.5px] text-white tooltip-text whitespace-nowrap z-50 shadow-2xl origin-top font-bold tracking-wide backdrop-blur-md">
                        Sign Out of Portal
                      </span>
                    </div>
                  </div>

                  {/* Profile Dropdown Menu Card */}
                  {showProfileDropdown && (
                    <div className="absolute top-full right-0 mt-2.5 w-[260px] bg-white dark:bg-zinc-950 border border-slate-200/90 dark:border-zinc-800 rounded-[20px] p-2.5 shadow-2xl shadow-purple-500/10 z-50 animate-in fade-in slide-in-from-top-2 duration-200 select-none">
                      
                      {/* Header User Card */}
                      <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-zinc-900/60 rounded-[14px] mb-1.5 border border-slate-100 dark:border-zinc-800">
                        {(!imgError && (customPhoto || user.photoURL)) ? (
                          <img
                            src={customPhoto || user.photoURL || ''}
                            alt={customName || user.displayName || "User"}
                            referrerPolicy="no-referrer"
                            onError={() => setImgError(true)}
                            className="w-9 h-9 rounded-full object-cover border border-slate-300 dark:border-zinc-700 shrink-0"
                          />
                        ) : (
                          <div className={cn(
                            "w-9 h-9 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs border border-white/20",
                            isInvoiceMode
                              ? "bg-gradient-to-tr from-[#7C3AED] to-purple-500"
                              : "bg-gradient-to-tr from-[#E55A22] to-orange-500"
                          )}>
                            {(customName || user.displayName || "HD").substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-black text-[#0F172A] dark:text-white leading-tight truncate">
                            {customName || user.displayName || "HD_Mixture"}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 leading-tight truncate mt-0.5">
                            {user.email}
                          </span>
                          <span className="inline-flex items-center gap-1 mt-1 text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full w-fit">
                            ● Admin Active
                          </span>
                        </div>
                      </div>

                      {/* Single Option: Profile Settings */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileDropdown(false);
                          setShowProfileCanvas(true);
                        }}
                        className={cn(
                          "flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-slate-800 dark:text-zinc-100 transition-all text-left cursor-pointer group",
                          isInvoiceMode
                            ? "hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-600 dark:hover:text-purple-400"
                            : "hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-[#E55A22] dark:hover:text-orange-400"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Settings className={cn(
                            "w-4 h-4 group-hover:rotate-45 transition-transform duration-300 stroke-[2.2px]",
                            isInvoiceMode ? "text-purple-500" : "text-[#E55A22]"
                          )} />
                          <span>Profile Settings</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* BACK FACE: Compact 3D Flipped Offline / Restored Status Pill Card */}
          <div className={cn(
            "absolute inset-0 [backface-visibility:hidden] [transform:rotateX(-180deg)] w-full rounded-[22px] border shadow-2xl backdrop-blur-xl flex items-center justify-between px-4 py-2 select-none transition-colors duration-300",
            !isOffline && showRestoredNotice
              ? "bg-white/95 dark:bg-zinc-950/95 border-emerald-500/50 dark:border-emerald-500/40 text-slate-900 dark:text-white"
              : "bg-white/95 dark:bg-zinc-950/95 border-amber-500/50 dark:border-amber-500/40 text-slate-900 dark:text-white"
          )}>
            {!isOffline && showRestoredNotice ? (
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Wifi className="w-4 h-4 stroke-[2.2px] animate-bounce" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Connection Restored
                    </span>
                    <span className="text-[10.5px] font-semibold text-slate-600 dark:text-zinc-300">
                      Back online. Cloud sync re-established.
                    </span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={dismissRestoredNotice}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex items-center justify-center shrink-0">
                    <div className="absolute inset-0 rounded-full bg-amber-500/30 animate-ping" />
                    <div className="relative w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                      <WifiOff className="w-4 h-4 stroke-[2.2px]" />
                    </div>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      No Internet Connection
                    </span>
                    <span className="text-[10.5px] font-semibold text-slate-600 dark:text-zinc-300 truncate max-w-[260px]">
                      Operating in offline mode. Local draft active.
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                  Offline
                </span>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Mobile Top Offline / Restored Status Banner */}
      <div className="md:hidden sticky top-0 z-40 w-full px-3 py-2 pointer-events-auto">
        {isOffline && (
          <div className="w-full bg-white/95 dark:bg-zinc-950/95 border border-amber-500/40 rounded-xl p-2.5 shadow-lg flex items-center justify-between gap-2 backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">
                No Internet Connection — Operating Offline
              </span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md border border-amber-500/20">
              Offline
            </span>
          </div>
        )}
        {!isOffline && showRestoredNotice && (
          <div className="w-full bg-white/95 dark:bg-zinc-950/95 border border-emerald-500/40 rounded-xl p-2.5 shadow-lg flex items-center justify-between gap-2 backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <Wifi className="w-4 h-4 text-emerald-500 shrink-0 animate-bounce" />
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                Back Online — Cloud Sync Restored
              </span>
            </div>
            <button type="button" onClick={dismissRestoredNotice} className="p-1 text-slate-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile Bottom Tab Navigation */}
      {activeTab !== "form" && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none mobile-bottom-nav-container transition-all duration-300">
          <nav className={cn(
            "w-full h-16 rounded-2xl flex items-center justify-around px-3 border shadow-2xl pointer-events-auto",
            isInvoiceMode
              ? "bg-[#fcfaff]/95 border-violet-500/15 text-slate-900 backdrop-blur-md dark:bg-[#0b090f]/95 dark:border-violet-500/20 dark:text-white"
              : "glass-panel border-white/20 dark:border-white/5"
          )}>
            {/* Dashboard */}
            <button
              onClick={() => {
                setShowProfileCanvas(false);
                setActiveTab("dashboard");
              }}
              className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group active:scale-90 transition-all duration-150 transform"
            >
              <div 
                className={cn(
                  "py-1.5 px-3.5 rounded-xl transition-all duration-200 flex items-center justify-center relative z-10",
                  activeTab === "dashboard" && !showProfileCanvas
                    ? isInvoiceMode 
                      ? "text-violet-500 bg-violet-500/10 scale-105" 
                      : "text-primary bg-primary/10 scale-105"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutDashboard className="w-5.5 h-5.5" />
              </div>
              <span className={cn(
                "text-[9.5px] mt-0.5 font-bold transition-all duration-200 z-10",
                activeTab === "dashboard" && !showProfileCanvas
                  ? "text-violet-500 dark:text-violet-400 font-extrabold scale-105"
                  : "text-muted-foreground"
              )}>
                {"Dashboard"}
              </span>
              {activeTab === "dashboard" && !showProfileCanvas && (
                <div className={cn("absolute top-1.5 w-1 h-1 rounded-full", isInvoiceMode ? "bg-violet-500" : "bg-primary")} />
              )}
            </button>

            {/* New Quote / New Bill Form Tab */}
            <button
              onClick={() => {
                setShowProfileCanvas(false);
                setActiveTab("form");
              }}
              className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group active:scale-90 transition-all duration-150 transform"
            >
              <div 
                className={cn(
                  "py-1.5 px-3.5 rounded-xl transition-all duration-200 flex items-center justify-center relative z-10",
                  activeTab === "form" && !showProfileCanvas
                    ? isInvoiceMode 
                      ? "text-violet-500 bg-violet-500/10 scale-105" 
                      : "text-primary bg-primary/10 scale-105"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileSpreadsheet className="w-5.5 h-5.5" />
              </div>
              <span className={cn(
                "text-[9.5px] mt-0.5 font-bold transition-all duration-200 z-10",
                activeTab === "form" && !showProfileCanvas
                  ? "text-violet-500 dark:text-violet-400 font-extrabold scale-105"
                  : "text-muted-foreground"
              )}>
                {isInvoiceMode ? "New Bill" : "New Quote"}
              </span>
              {activeTab === "form" && !showProfileCanvas && (
                <div className={cn("absolute top-1.5 w-1 h-1 rounded-full", isInvoiceMode ? "bg-violet-500" : "bg-primary")} />
              )}
            </button>

            {/* Generate with AI Mobile Tab */}
            {onOpenAIGenerator && (
              <button
                onClick={() => {
                  setShowProfileCanvas(false);
                  onOpenAIGenerator();
                }}
                className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group active:scale-90 transition-all duration-150 transform"
              >
                <div className={cn(
                  "py-1.5 px-3.5 rounded-full text-white shadow-md flex items-center justify-center border border-white/20",
                  isInvoiceMode
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 shadow-purple-500/30"
                    : "bg-gradient-to-r from-[#E55A22] to-amber-500 shadow-orange-500/30"
                )}>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <span className={cn(
                  "text-[9.5px] mt-0.5 font-black uppercase tracking-tighter",
                  isInvoiceMode ? "text-purple-600 dark:text-purple-400" : "text-orange-600 dark:text-orange-400"
                )}>
                  AI Gen
                </span>
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => {
                setShowProfileCanvas(false);
                setActiveTab("settings");
              }}
              className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group active:scale-90 transition-all duration-150 transform"
            >
              <div 
                className={cn(
                  "py-1.5 px-3.5 rounded-xl transition-all duration-200 flex items-center justify-center relative z-10",
                  activeTab === "settings" && !showProfileCanvas
                    ? isInvoiceMode 
                      ? "text-violet-500 bg-violet-500/10 scale-105" 
                      : "text-primary bg-primary/10 scale-105"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Settings className="w-5.5 h-5.5" />
              </div>
              <span className={cn(
                "text-[9.5px] mt-0.5 font-bold transition-all duration-200 z-10",
                activeTab === "settings" && !showProfileCanvas
                  ? "text-violet-500 dark:text-violet-400 font-extrabold scale-105"
                  : "text-muted-foreground"
              )}>
                Settings
              </span>
              {activeTab === "settings" && !showProfileCanvas && (
                <div className={cn("absolute top-1.5 w-1 h-1 rounded-full", isInvoiceMode ? "bg-violet-500" : "bg-primary")} />
              )}
            </button>

            {/* Mobile Profile Avatar Tab (Replaces Logout Button) */}
            {(() => {
              const photoUrl = customPhoto || user?.photoURL;
              const nameToUse = customName || user?.displayName || user?.email || "User";
              const initials = nameToUse
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

              return (
                <button
                  onClick={() => setShowProfileCanvas(true)}
                  className="flex flex-col items-center justify-center flex-1 h-full cursor-pointer group active:scale-105 transition-all duration-220 transform select-none"
                  title="Profile Settings"
                >
                  <div 
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-800 shadow-md transition-all duration-220 relative overflow-hidden",
                      showProfileCanvas 
                        ? isInvoiceMode
                          ? "ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-zinc-950 scale-105 shadow-violet-500/30"
                          : "ring-2 ring-[#E55A22] ring-offset-2 dark:ring-offset-zinc-950 scale-105 shadow-orange-500/30"
                        : "group-hover:scale-105"
                    )}
                  >
                    {photoUrl && !imgError ? (
                      <img 
                        src={photoUrl} 
                        alt="User Profile" 
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover rounded-full" 
                      />
                    ) : (
                      <div className={cn(
                        "w-full h-full font-extrabold text-[10px] text-white flex items-center justify-center rounded-full tracking-tighter",
                        isInvoiceMode
                          ? "bg-gradient-to-tr from-violet-600 to-purple-500"
                          : "bg-gradient-to-tr from-[#E55A22] to-amber-500"
                      )}>
                        {initials}
                      </div>
                    )}
                  </div>
                  <span className={cn(
                    "text-[9.5px] mt-0.5 font-bold transition-all duration-200",
                    showProfileCanvas
                      ? isInvoiceMode ? "text-violet-500 dark:text-violet-400 font-extrabold" : "text-[#E55A22] dark:text-orange-400 font-extrabold"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    Profile
                  </span>
                </button>
              );
            })()}
          </nav>
        </div>
      )}

      {/* Switch Portal Confirmation Modal (Desktop & Mobile fallback) */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pb-20 sm:pb-4 animate-in fade-in duration-200">
          <style dangerouslySetInnerHTML={{ __html: `
            .bouncy-modal-desktop-entry {
              animation: bouncyPopNavbarDesktop 0.45s cubic-bezier(0.34, 1.6, 0.64, 1) forwards;
            }
            @keyframes bouncyPopNavbarDesktop {
              0% {
                opacity: 0;
                transform: scale(0.85);
              }
              70% {
                opacity: 1;
                transform: scale(1.03);
              }
              100% {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}} />
          <div 
            className="w-full max-w-md border backdrop-blur-xl p-6 rounded-[28px] text-center shadow-2xl relative select-none bouncy-modal-desktop-entry"
            style={{ 
              backgroundColor: theme === 'dark' ? 'rgba(9, 9, 11, 0.9)' : '#ffffff',
              color: theme === 'dark' ? '#ffffff' : '#0f172a',
              borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(226, 232, 240, 1)',
              boxShadow: theme === 'dark'
                ? workspaceMode === 'invoice'
                  ? "0 20px 50px rgba(139, 92, 246, 0.15), 0 0 50px rgba(0,0,0,0.5)"
                  : "0 20px 50px rgba(229, 90, 34, 0.15), 0 0 50px rgba(0,0,0,0.5)"
                : workspaceMode === 'invoice'
                  ? "0 20px 40px rgba(139, 92, 246, 0.08), 0 0 30px rgba(0,0,0,0.05)"
                  : "0 20px 40px rgba(229, 90, 34, 0.08), 0 0 30px rgba(0,0,0,0.05)"
            }}
          >
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg mb-4 mt-2"
              style={{
                backgroundColor: workspaceMode === 'invoice' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(229, 90, 34, 0.1)',
                borderColor: workspaceMode === 'invoice' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(229, 90, 34, 0.2)',
                color: workspaceMode === 'invoice' ? '#8b5cf6' : '#e55a22'
              }}
            >
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <h3 
              className="text-lg font-black tracking-tight"
              style={{ color: theme === 'dark' ? '#ffffff' : '#0f172a' }}
            >
              Switch Workspace Portal?
            </h3>
            <p 
              className="mt-2 text-xs font-semibold leading-relaxed"
              style={{ color: theme === 'dark' ? '#a1a1aa' : '#475569' }}
            >
              Are you sure you want to exit the current portal and switch to the {workspaceMode === 'invoice' ? "Quotations Suite" : "Commercial Billing Suite"}?
            </p>
            <div className="mt-6 flex flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSwitchModal(false);
                  setWorkspaceMode?.(workspaceMode === 'invoice' ? 'quotation' : 'invoice');
                }}
                className={cn(
                  "flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold border border-transparent text-white cursor-pointer transition-all active:scale-[0.98]",
                  workspaceMode === 'invoice'
                    ? "bg-gradient-to-r from-violet-600 to-[#E55A22] hover:from-violet-500 hover:to-[#E55A22]/90"
                    : "bg-gradient-to-r from-[#E55A22] to-violet-600 hover:from-[#E55A22]/90 hover:to-violet-500"
                )}
              >
                Yes, Switch Portal
              </button>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold cursor-pointer transition-all active:scale-[0.98] border bg-transparent"
                style={{
                  borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(226, 232, 240, 1)',
                  color: theme === 'dark' ? '#a1a1aa' : '#64748b'
                }}
              >
                No, Stay Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS injected style to blur mobile bottom navbar container when body.drawer-open is active */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          body.drawer-open .mobile-bottom-nav-container {
            filter: blur(8px) !important;
            opacity: 0.6 !important;
            pointer-events: none !important;
            transition: filter 0.3s ease, opacity 0.3s ease !important;
        }
      `}} />

      {/* Profile Settings Modal Canvas */}
      <ProfileSettingsModal 
        isOpen={showProfileCanvas} 
        onClose={() => setShowProfileCanvas(false)} 
        workspaceMode={workspaceMode}
        setWorkspaceMode={setWorkspaceMode}
      />
    </>
  );
};

export default Navbar;
