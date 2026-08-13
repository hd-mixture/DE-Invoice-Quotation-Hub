"use client";

import React from "react";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";
import { WifiOff, Wifi, X } from "lucide-react";

export const OfflineBanner: React.FC = () => {
  const { isOffline, showRestoredNotice, dismissRestoredNotice } = useNetworkStatus();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (!isOffline && !showRestoredNotice) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999999] max-w-lg w-[calc(100%-2rem)] pointer-events-auto select-none transition-all duration-300">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div 
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300",
            isDark 
              ? "bg-zinc-950/95 border-amber-500/40 text-white shadow-black/80" 
              : "bg-white/95 border-amber-500/50 text-slate-900 shadow-amber-500/10"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full bg-amber-500/30 animate-ping" />
              <div className="relative w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                <WifiOff className="w-4 h-4 stroke-[2.2px]" />
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black tracking-wide uppercase text-amber-600 dark:text-amber-400">
                No Internet Connection
              </span>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 truncate">
                Operating in offline mode. Changes will sync when reconnected.
              </span>
            </div>
          </div>
          <span className="shrink-0 text-[9.5px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
            Offline
          </span>
        </div>
      )}

      {/* Connection Restored Alert Banner */}
      {!isOffline && showRestoredNotice && (
        <div 
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300",
            isDark 
              ? "bg-zinc-950/95 border-emerald-500/40 text-white shadow-black/80" 
              : "bg-white/95 border-emerald-500/50 text-slate-900 shadow-emerald-500/10"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4 stroke-[2.2px] animate-bounce" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black tracking-wide uppercase text-emerald-600 dark:text-emerald-400">
                Connection Restored
              </span>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 truncate">
                You are back online. Cloud synchronization re-established.
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={dismissRestoredNotice}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer p-1"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
