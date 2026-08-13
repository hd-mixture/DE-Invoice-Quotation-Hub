"use client";

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Shield,
  FileText,
  FileCheck,
  RefreshCcw,
  Lock,
  PieChart,
  CheckCircle2,
  Star
} from "lucide-react";

export const Login: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#EBF2FF] dark:bg-slate-950 relative overflow-y-auto lg:overflow-hidden font-sans text-[#0F172A] dark:text-slate-200 selection:bg-[#2563EB]/20">

      <style>{`
        @keyframes float-img {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0px); }
        }
        @keyframes morph {
          0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
          100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
        }
      `}</style>

      {/* --- BACKGROUND ELEMENTS --- */}

      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#F97316] dark:bg-[#F97316]/20 opacity-10 rounded-full blur-[120px] z-0 pointer-events-none" />

      {/* Solid Blue Wave Background for 3D Elements */}
      <svg className="absolute bottom-0 left-0 w-full h-[500px] z-0 pointer-events-none opacity-80" viewBox="0 0 1440 500" preserveAspectRatio="none">
        <path fill="url(#deep-blue-wave)" d="M0,500 C150,400 350,500 550,350 C750,200 900,300 1100,250 C1300,200 1400,280 1440,250 L1440,500 L0,500 Z" />
        <defs>
          <linearGradient id="deep-blue-wave" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.05" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top center orange swoosh */}
      <svg className="absolute top-[-5%] left-[25%] w-[50vw] h-[25vw] z-0 opacity-70 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
        <path d="M0,0 C30,40 70,40 100,0 Z" fill="#F97316" opacity="0.08" />
      </svg>

      {/* Dot patterns */}
      <div className="absolute top-[12%] right-[32%] w-24 h-24 bg-[radial-gradient(#94A3B8_2px,transparent_2px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
      <div className="absolute top-[42%] left-[2%] w-20 h-20 bg-[radial-gradient(#94A3B8_2px,transparent_2px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      {/* --- MAIN LAYOUT CONTAINER --- */}
      <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-16 xl:px-24 py-6 flex flex-col lg:flex-row min-h-full lg:h-screen relative z-10">

        {/* LEFT COLUMN */}
        <div className="w-full lg:w-[60%] xl:w-[65%] flex flex-col pt-4 relative z-10">

          {/* Logo Section */}
          {/* Logo Section */}
          <div className="flex flex-col items-center lg:items-start mb-8 lg:mb-10 w-max mx-auto lg:mx-0 lg:w-full">
            <div className="flex items-center justify-center lg:justify-start gap-3.5 lg:gap-4">

              {/* Logo Box */}
              <div className="w-[56px] h-[56px] lg:w-12 lg:h-12 shrink-0 bg-white dark:bg-slate-900 rounded-[12px] flex items-center justify-center shadow-sm border border-gray-100 dark:border-slate-800 p-1">
                <img src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg" alt="Logo" className="w-full h-full object-contain rounded-md" />
              </div>

              <div className="text-left flex flex-col justify-center">

                {/* Mobile Heading Layout (matches exact reference) */}
                <div className="flex sm:hidden flex-col w-max font-black text-[#0F172A] dark:text-white leading-none" style={{ fontFamily: "Arial Black, Helvetica, sans-serif" }}>
                  <span className="text-[30px] tracking-tight">DARSHAN</span>
                  <div className="flex items-center w-full justify-between gap-[5px] mt-[1px]">
                    <div className="h-[1.5px] flex-1 bg-[#64748B] dark:bg-slate-500 rounded-full"></div>
                    <span className="text-[10.5px] text-[#64748B] dark:text-slate-400 tracking-[0.25em] ml-[2px]">ENTERPRISES</span>
                    <div className="h-[1.5px] flex-1 bg-[#64748B] dark:bg-slate-500 rounded-full"></div>
                  </div>
                </div>

                {/* Desktop/Tablet Heading Layout */}
                <h1 className="hidden sm:block text-[18px] lg:text-[22px] font-black text-[#0F172A] dark:text-white tracking-wide leading-none" style={{ fontFamily: "Arial Black, Helvetica, sans-serif" }}>
                  DARSHAN ENTERPRISES
                </h1>

                {/* Desktop Subtitle */}
                <p className="hidden sm:block text-[8px] lg:text-[9px] font-[800] text-[#64748B] dark:text-slate-400 tracking-[0.15em] mt-[3px] lg:mt-1.5">
                  INDUSTRIAL PAINTING & SHOT BLASTING
                </p>
              </div>
            </div>

            {/* Mobile Subtitle Pill Badge (Centered below logo block) */}
            <div className="flex sm:hidden justify-center w-full mt-3.5">
              <span className="inline-block px-4 py-[5px] rounded-full bg-[#EBF2FF] dark:bg-blue-900/30 border border-[#BFDBFE] dark:border-blue-800/50 text-[#1E40AF] dark:text-blue-400 text-[8.5px] font-[800] tracking-[0.05em] shadow-[0_2px_10px_rgba(37,99,235,0.05)] dark:shadow-none">
                INDUSTRIAL PAINTING & SHOT BLASTING
              </span>
            </div>
          </div>

          {/* Badge */}
          <div className="mb-6 flex justify-center lg:justify-start">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF2FF] dark:bg-blue-900/30 border border-[#DCE7FF] dark:border-blue-800/50 text-[#2563EB] dark:text-blue-400 text-[11px] font-[800] shadow-sm">
              <Star size={12} strokeWidth={2.5} className="fill-transparent" />
              All-in-One Business Solution
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-[28px] lg:text-[48px] xl:text-[56px] font-[900] text-[#0F172A] dark:text-white leading-[1.12] tracking-tight mb-4 lg:mb-5 text-center lg:text-left">
            Invoice & Quotation<br />
            Management <span className="text-[#2563EB] dark:text-blue-500 relative inline-block">
              Platform
              <svg className="absolute bottom-[-3px] lg:bottom-[-6px] left-[1%] w-[98%] h-[10px] lg:h-[16px]" viewBox="0 0 100 30" preserveAspectRatio="none">
                <path d="M 2 28 Q 40 20 98 18 Q 40 8 2 20 Q -2 24 2 28 Z" fill="#FF7A00" className="dark:fill-[#FF8A1A]" />
              </svg>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-[#475569] dark:text-slate-400 text-[12px] lg:text-[16px] max-w-[550px] leading-[1.5] lg:leading-[1.6] mb-8 lg:mb-10 font-[500] text-center lg:text-left mx-auto lg:mx-0">
            Create, manage and track professional <span className="font-[700] text-[#2563EB] dark:text-blue-400">Invoices & Quotations</span> anytime, anywhere.<br className="hidden lg:block" /> Securely synced with Google Drive.
          </p>

          {/* 5 Feature Cards Row (Desktop Only) */}
          <div className="hidden lg:flex gap-3 max-w-[760px] mb-8">
            {[
              { title: "Smart Invoicing", desc: "Create professional\ninvoices in seconds", icon: FileText, color: "text-[#2563EB] dark:text-blue-400", bg: "bg-[#EEF2FF] dark:bg-blue-900/30" },
              { title: "Quotation\nManagement", desc: "Generate, convert &\nmanage quotes", icon: FileCheck, color: "text-[#F97316] dark:text-orange-400", bg: "bg-[#FFF7ED] dark:bg-orange-900/30" },
              { title: "Auto Sync", desc: "Real-time sync with\nGoogle Drive", icon: RefreshCcw, color: "text-[#10B981] dark:text-emerald-400", bg: "bg-[#ECFDF5] dark:bg-emerald-900/30" },
              { title: "Secure & Private", desc: "Bank-level security\nfor your data", icon: Shield, color: "text-[#8B5CF6] dark:text-purple-400", bg: "bg-[#F5F3FF] dark:bg-purple-900/30" },
              { title: "Business Insights", desc: "Track payments &\nget clear reports", icon: PieChart, color: "text-[#2563EB] dark:text-blue-400", bg: "bg-[#EEF2FF] dark:bg-blue-900/30" }
            ].map((feat, i) => (
              <div key={i} className="flex-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-[16px] p-3.5 shadow-[0_4px_15px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_15px_rgba(0,0,0,0.4)] border border-white dark:border-slate-800 flex flex-col items-center text-center gap-2 hover:-translate-y-1 transition-transform cursor-default">
                <div className={`w-9 h-9 rounded-xl ${feat.bg} flex items-center justify-center ${feat.color} mb-1`}>
                  <feat.icon size={18} strokeWidth={2.5} />
                </div>
                <h3 className="text-[11px] font-[800] text-[#0F172A] dark:text-slate-200 leading-[1.2] whitespace-pre-line">{feat.title}</h3>
                <p className="text-[9px] font-[500] text-[#64748B] dark:text-slate-400 leading-[1.3] whitespace-pre-line">{feat.desc}</p>
              </div>
            ))}
          </div>

          {/* 3D Illustration & Bottom Stats Banner (Desktop Only) */}
          <div className="relative mt-0 lg:mt-[-30px] xl:mt-[-60px] hidden lg:flex flex-col justify-center w-full transform -translate-x-8 xl:-translate-x-16">

            {/* 3D Elements Image */}
            <div className="relative w-full flex justify-start items-center z-10">
              <img
                src="/Cloud synchronization and invoicing elements.png"
                alt="3D Cloud & Invoicing Elements"
                className="w-full max-w-[820px] max-h-[38vh] xl:max-h-[42vh] object-contain drop-shadow-[0_25px_45px_rgba(11,32,70,0.15)] transform -translate-y-6"
              />
            </div>


          </div>

        </div>

        {/* RIGHT COLUMN (Login Card & Footer) */}
        <div className="w-full lg:w-[40%] xl:w-[35%] flex flex-col justify-center items-center lg:items-end relative z-20 h-full py-4 lg:py-12">

          <div className="w-full max-w-[440px] mx-auto lg:ml-auto lg:mr-0 bg-white dark:bg-slate-900 rounded-[36px] p-7 xl:p-9 shadow-[0_25px_60px_rgba(11,32,70,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.4)] border border-gray-50 dark:border-slate-800 flex flex-col items-center relative shrink-0">

            {/* Folder Illustration Image */}
            <div className="relative w-full h-[160px] mb-4 flex justify-center items-center mx-auto pointer-events-none" style={{ animation: 'float-img 4s ease-in-out infinite' }}>
              {/* Soft ambient 'ground' shadow matching the requested color exactly */}
              <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] w-[80%] h-[80%] bg-[#edf2fd] dark:bg-[#1e3a8a]/20 blur-[40px] rounded-full z-0"></div>

              <img
                src="/Stylized business documents and icons.png"
                alt="Documents Illustration"
                className="w-full h-full object-contain relative z-10 drop-shadow-[0_20px_30px_#c1d3f8] dark:drop-shadow-[0_20px_30px_rgba(37,99,235,0.2)]"
              />
            </div>

            {/* Welcome Text Section */}
            <div className="text-center w-full">
              <h2 className="text-[16px] font-[700] text-[#475569] dark:text-slate-400 mb-1.5 tracking-tight">Welcome to</h2>
              <h1 className="text-[28px] font-[900] tracking-tight mb-4 leading-none">
                <span className="text-[#FF7A00] dark:text-[#FF8A1A]">Darshan</span> <span className="text-[#0B2046] dark:text-white">Enterprises</span>
              </h1>

              {/* Exact Line & Dot Divider */}
              <div className="flex items-center justify-center gap-2 mb-5 w-full max-w-[180px] mx-auto">
                <div className="h-[2px] w-[25px] bg-gradient-to-r from-transparent to-[#CBD5E1] dark:to-slate-700 rounded-full"></div>
                <div className="w-[5px] h-[5px] rounded-full bg-[#FF7A00] dark:bg-[#FF8A1A]"></div>
                <div className="w-[5px] h-[5px] rounded-full bg-[#2563EB] dark:bg-blue-500"></div>
                <div className="w-[5px] h-[5px] rounded-full bg-[#FF7A00] dark:bg-[#FF8A1A]"></div>
                <div className="h-[2px] w-[25px] bg-gradient-to-l from-transparent to-[#CBD5E1] dark:to-slate-700 rounded-full"></div>
              </div>

              <p className="text-[13px] text-[#475569] dark:text-slate-400 font-[500] leading-relaxed mb-6">
                Sign in with Google to access your<br />Invoice & Quotation Management Platform
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50/80 border border-red-100 text-red-600 text-[13px] text-center font-[600] shadow-sm w-full">
                {error}
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full relative flex items-center justify-center gap-4 py-[10px] rounded-[14px] bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8] text-white shadow-[0_12px_24px_rgba(37,99,235,0.25)] hover:shadow-[0_16px_32px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <div className="w-[28px] h-[28px] rounded-full bg-white flex items-center justify-center p-[5px] shadow-sm transform transition-transform group-hover:scale-105">
                  <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </div>
              )}
              <span className="font-[700] text-[16px] tracking-wide">Continue with Google</span>
            </button>

            {/* Bottom 3 Trust Feature Columns with Vertical Dividers */}
            <div className="w-full flex justify-between items-center mt-7 pt-4 px-1 border-t border-slate-50 dark:border-slate-800/50">

              {/* Left Column */}
              <div className="flex flex-col items-center text-center w-1/3 group/trust">
                <div className="w-8 h-8 rounded-full bg-[#EFF6FF] dark:bg-blue-900/30 flex items-center justify-center mb-1.5 transition-transform group-hover/trust:-translate-y-1">
                  <svg className="w-[14px] h-[14px] text-[#2563EB] dark:text-blue-400" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8 16L4.35009 13.3929C2.24773 11.8912 1 9.46667 1 6.88306V3L8 0L15 3V6.88306C15 9.46667 13.7523 11.8912 11.6499 13.3929L8 16ZM12.2071 5.70711L10.7929 4.29289L7 8.08579L5.20711 6.29289L3.79289 7.70711L7 10.9142L12.2071 5.70711Z" />
                  </svg>
                </div>
                <span className="text-[12px] font-[800] text-[#0B2046] dark:text-white mb-0.5">Secure</span>
                <span className="text-[10px] text-[#64748B] dark:text-slate-400 font-[500] leading-snug">Protected<br />Data</span>
              </div>

              {/* Vertical Divider */}
              <div className="w-[1px] h-[30px] bg-[#E2E8F0] dark:bg-slate-800"></div>

              {/* Center Column */}
              <div className="flex flex-col items-center text-center w-1/3 group/trust">
                <div className="w-8 h-8 rounded-full bg-[#F8FAFC] dark:bg-slate-800 flex items-center justify-center mb-1.5 transition-transform group-hover/trust:-translate-y-1 shadow-sm border border-gray-50 dark:border-slate-700">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/5f/Google_Drive_icon_%282026%29.svg" className="w-[16px] h-[16px] object-contain" alt="Google Drive" />
                </div>
                <span className="text-[12px] font-[800] text-[#0B2046] dark:text-white mb-0.5">Drive Sync</span>
                <span className="text-[10px] text-[#64748B] dark:text-slate-400 font-[500] leading-snug">Automatic<br />Backup</span>
              </div>

              {/* Vertical Divider */}
              <div className="w-[1px] h-[30px] bg-[#E2E8F0] dark:bg-slate-800"></div>

              {/* Right Column */}
              <div className="flex flex-col items-center text-center w-1/3 group/trust">
                <div className="w-8 h-8 rounded-full bg-[#F5F3FF] dark:bg-purple-900/30 flex items-center justify-center mb-1.5 transition-transform group-hover/trust:-translate-y-1">
                  <svg className="w-[14px] h-[14px] text-[#9333EA] dark:text-purple-400" viewBox="0 0 320 448" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 128 0 C 74.815992 0 32 42.815992 32 96 L 32 192 C 14.271989 192 0 206.27199 0 224 L 0 320 L 0 416 L 0 448 L 32 448 L 288 448 L 320 448 L 320 416 L 320 320 L 320 224 C 320 206.27199 305.72801 192 288 192 L 288 96 C 288 42.815992 245.18401 0 192 0 L 128 0 z M 128 48 L 192 48 C 218.59201 48 240 69.407989 240 96 L 240 192 L 80 192 L 80 96 C 80 69.407989 101.40799 48 128 48 z M 160 256 A 32 32.000004 0 0 1 192 288 A 32 32.000004 0 0 1 173.62305 316.91797 L 191.42578 384 L 128 384 L 145.86719 316.66602 A 32 32.000004 0 0 1 128 288 A 32 32.000004 0 0 1 160 256 z" />
                  </svg>
                </div>
                <span className="text-[12px] font-[800] text-[#0B2046] dark:text-white mb-0.5">100% Safe</span>
                <span className="text-[10px] text-[#64748B] dark:text-slate-400 font-[500] leading-snug">Your data is<br />private</span>
              </div>
            </div>

          </div>

          {/* Custom Footer */}
          <div className="w-full max-w-[440px] mx-auto lg:ml-auto lg:mr-0 mt-6 flex flex-col items-center gap-1.5 text-center">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
              &copy; 2026 Darshan Enterprises. All rights reserved.<br />
              Authorized personnel only.
            </p>
            <div className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 mt-1">
              Developed by
              <div className="relative group inline-block">
                <a href="https://hdmixture.site" target="_blank" rel="noopener noreferrer" className="text-[#4F46E5] dark:text-indigo-400 hover:text-[#4338CA] dark:hover:text-indigo-300 transition-colors relative z-10 cursor-pointer font-bold">
                  HD_Mixture
                </a>

                {/* Hover Tooltip with Iframe (Desktop Preview) */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[260px] h-[160px] bg-white rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.12)] border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 origin-bottom z-[100] overflow-hidden transform scale-95 group-hover:scale-100 pointer-events-none flex flex-col p-2">
                  <div className="w-full h-full relative bg-slate-50 overflow-hidden rounded-xl pointer-events-auto border border-slate-100 shadow-inner">
                    {/* Scale down the iframe to fit nicely and force Desktop layout (width 1280px) */}
                    <iframe
                      src="https://hdmixture.site"
                      className="absolute top-0 left-0 w-[1280px] h-[760px] origin-top-left border-0 bg-white"
                      style={{ transform: 'scale(0.19)' }}
                      title="HD_Mixture Portfolio"
                      loading="lazy"
                    />
                  </div>
                  {/* Little arrow at the bottom */}
                  <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-r border-b border-slate-200 z-[101]" />
                </div>
              </div>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <svg className="w-4 h-4 text-[#6366F1] dark:text-indigo-400 fill-current" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
          </div>

        </div>
      </div>

      {/* Global Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(15deg); }
          50% { transform: translateY(-5px) rotate(16deg); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 6s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

export default Login;
