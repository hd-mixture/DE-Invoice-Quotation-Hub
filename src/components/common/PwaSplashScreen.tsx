"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, FileText, Users } from "lucide-react";

export const PwaSplashScreen: React.FC = () => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect if running as installed standalone PWA app or if force preview via URL ?splash=true
    const urlParams = new URLSearchParams(window.location.search);
    const forcePreview = urlParams.get("splash") === "true";

    const isStandaloneMode =
      forcePreview ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandaloneMode) {
      setIsStandalone(true);
      setShowSplash(true);

      // Trigger fade out transition after 2.8 seconds
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
      }, 2800);

      // Unmount splash element from DOM after fade out completes
      const unmountTimer = setTimeout(() => {
        setShowSplash(false);
      }, 3300);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, []);

  if (!isStandalone || !showSplash) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999999] bg-gradient-to-b from-[#FFFDF9] via-[#FFF9F2] to-[#FFF4EC] text-slate-900 flex flex-col items-center justify-between p-4 sm:p-6 select-none transition-opacity duration-500 overflow-hidden ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Background Decorative Pattern Graphics */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Radial Glow Spotlights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-orange-300/30 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-blue-300/20 blur-[120px]" />

        {/* Decorative Concentric Rings (Top Right & Bottom Left) */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full border border-orange-500/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-orange-500/5" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full border border-orange-500/10" />

        {/* Subtle Decorative Dot Matrix */}
        <div className="absolute top-16 left-6 grid grid-cols-4 gap-2 opacity-20">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          ))}
        </div>
      </div>

      {/* TOP HEADER: Pill Badge */}
      <div className="w-full max-w-sm flex items-center justify-center pt-4 z-10 animate-in fade-in slide-in-from-top-4 duration-700">
        {/* Official Corporate App Badge */}
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/90 border border-orange-200/80 text-[#FF7A00] shadow-sm shadow-orange-950/5 backdrop-blur-md text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-[#FF7A00]" />
          <span>Official Corporate App</span>
        </div>
      </div>

      {/* BRANDING SECTION: Logo + Title + Tagline */}
      <div className="flex flex-col items-center text-center space-y-2.5 z-10 pt-1 animate-in zoom-in-95 fade-in duration-700">
        {/* 3D Brand Logo */}
        <div className="relative group">
          <div className="absolute -inset-2 bg-gradient-to-r from-[#FF7A00] to-[#1E4ED8] rounded-full blur-xl opacity-40 animate-pulse" />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-white shadow-2xl bg-white flex items-center justify-center p-1">
            <img
              src="/Graphic Assets/DE_3D_Circle_Logo.png"
              alt="DE Brand Logo"
              className="w-full h-full object-contain scale-105"
            />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase flex items-center justify-center gap-1.5">
            <span className="text-[#1E293B]">DARSHAN</span>
            <span className="text-[#FF7A00]">ENTERPRISES</span>
          </h1>

          {/* Tagline with Side Accent Lines */}
          <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-black text-slate-500 tracking-widest uppercase">
            <span className="w-6 h-[1.5px] bg-gradient-to-r from-transparent to-[#FF7A00]" />
            <span>INVOICING & QUOTATION HUB</span>
            <span className="w-6 h-[1.5px] bg-gradient-to-l from-transparent to-[#FF7A00]" />
          </div>
        </div>
      </div>

      {/* MAIN ISOMETRIC WORKSPACE ILLUSTRATION (BIGGER SIZE) */}
      <div className="relative w-full max-w-[360px] sm:max-w-[420px] my-auto py-1 flex items-center justify-center z-10 animate-in zoom-in-95 fade-in duration-700">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-400/20 via-blue-400/10 to-transparent blur-3xl" />
        <img
          src="/Isometric_Workspace.png"
          alt="Corporate Invoicing & Quotation Workspace Illustration"
          className="relative w-full h-auto object-contain drop-shadow-2xl scale-105"
        />
      </div>

      {/* BOTTOM SECTION: Features Row + Tagline + Progress Bar */}
      <div className="w-full max-w-sm space-y-3.5 pb-3 flex flex-col items-center z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* 3 Short Feature Highlights Card Row */}
        <div className="w-full bg-white/95 border border-slate-200/80 divide-x divide-slate-200/70 rounded-2xl p-3 shadow-xl shadow-slate-900/5 backdrop-blur-md grid grid-cols-3 text-center">
          {/* Feature 1: Secure & Reliable */}
          <div className="flex flex-col items-center justify-center px-1 space-y-1">
            <div className="w-7 h-7 rounded-xl bg-orange-500/10 text-[#FF7A00] flex items-center justify-center border border-orange-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-black text-slate-900">Secure</p>
              <p className="text-[9.5px] font-bold text-slate-500">& Reliable</p>
            </div>
          </div>

          {/* Feature 2: Smart Invoicing */}
          <div className="flex flex-col items-center justify-center px-1 space-y-1">
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-[#1E4ED8] flex items-center justify-center border border-blue-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-black text-slate-900">Smart</p>
              <p className="text-[9.5px] font-bold text-slate-500">Invoicing</p>
            </div>
          </div>

          {/* Feature 3: Built for Businesses */}
          <div className="flex flex-col items-center justify-center px-1 space-y-1">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-black text-slate-900">Built for</p>
              <p className="text-[9.5px] font-bold text-slate-500">Businesses</p>
            </div>
          </div>
        </div>

        {/* Motivating Tagline */}
        <div className="text-center space-y-0.5">
          <h2 className="text-xs sm:text-sm font-black tracking-tight text-slate-900">
            Streamline Your Business.
          </h2>
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500">
            Create, Manage & Grow with Confidence.
          </p>
        </div>

        {/* Loading Progress Bar & Loading Text */}
        <div className="w-full max-w-xs space-y-1.5 flex flex-col items-center pt-1">
          <div className="w-48 sm:w-56 h-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div className="h-full bg-gradient-to-r from-[#FF7A00] via-orange-400 to-[#1E4ED8] rounded-full animate-mobile-splash-progress" />
          </div>

          <p className="text-[11px] font-bold text-[#FF7A00] flex items-center gap-1.5">
            <span>Loading...</span>
            <span className="inline-flex gap-1">
              <span className="w-1 h-1 rounded-full bg-[#FF7A00] animate-bounce" />
              <span className="w-1 h-1 rounded-full bg-[#FF7A00] animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-1 rounded-full bg-[#FF7A00] animate-bounce [animation-delay:0.4s]" />
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
