"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Sparkles, Bot, FileText, Receipt, ArrowLeft, ArrowRight, X, Download, Save, Loader2, CheckCircle2, ChevronDown, LogOut, ShieldAlert } from "lucide-react";
import { cn } from "../../lib/utils";
import AIChatInterface from "./AIChatInterface";
import QuotationPreview from "../quotation/QuotationPreview";
import InvoicePreview from "../invoice/InvoicePreview";
import { DEFAULT_SETTINGS, getAdminSettings, createQuotation, createInvoice, isSettingsCustomized } from "../../firebase/db";
import { AdminSettings } from "../../types";
import { generatePdfBlob, downloadPdf } from "../../services/pdfGenerator";
import { triggerAppToast } from "../notifications/NotificationManager";
import { uploadPdfToGoogleDrive } from "../../services/googleDrive";
import { ReceiptRupee } from "../common/ReceiptRupee";
import { convertAmountToWords } from "../../utils/amountToWords";
import { isNaOrEmptyGSTIN } from "../../utils/gstValidation";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const SparkleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 3c.13 4.94 4.06 8.87 9 9-.13.13-4.06 4.06-9 9-.13-.13-4.06-4.06-9-9 4.94-.13 8.87-4.06 9-9z" />
  </svg>
);

const RupeeInvoiceIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
    <path d="M9 8h6M9 11h5" />
    <path d="M9 8c2.5 0 4.5 1 4.5 2.5S11.5 13 9 13M11 13l3.5 4" />
  </svg>
);

interface AIGeneratorDashboardProps {
  onSwitchWorkspace: (mode?: "quotation" | "invoice" | "ai" | null) => void;
  onGoToSettings?: () => void;
}

export default function AIGeneratorDashboard({ onSwitchWorkspace, onGoToSettings }: AIGeneratorDashboardProps) {
  const { user, logout, googleAccessToken } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [docType, setDocType] = useState<"quotation" | "invoice" | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [fileNameInput, setFileNameInput] = useState("");
  const [userSettings, setUserSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    async function loadSettings() {
      if (user?.uid) {
        try {
          const s = await getAdminSettings(user.uid);
          setUserSettings(s);
        } catch (err) {
          console.error("Failed to load user settings:", err);
        }
      }
    }
    loadSettings();

    const handleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setUserSettings(customEvent.detail);
      }
    };
    window.addEventListener("user-settings-updated", handleUpdated);
    return () => {
      window.removeEventListener("user-settings-updated", handleUpdated);
    };
  }, [user?.uid]);

  // State for preview and generated document
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Lock global body scroll when inside the interactive wizard (desktop only)
  useEffect(() => {
    const handleScrollLock = () => {
      const isMobile = window.innerWidth < 768;
      if (docType && !isMobile) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };
    handleScrollLock();
    window.addEventListener("resize", handleScrollLock);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener("resize", handleScrollLock);
    };
  }, [docType]);

  // Handlers for generation
  const handleWizardFinish = async (data: any) => {
    setIsProcessing(true);

    // Simulate slight processing delay for AI feel
    await new Promise(r => setTimeout(r, 1000));

    if (docType === "quotation") {
      // Calculate totals
      let subTotal = 0;
      const items = data.items.map((item: any, idx: number) => {
        const amount = item.qty * item.rate;
        subTotal += amount;
        return {
          id: Date.now().toString() + idx,
          srNo: idx + 1,
          description: item.desc,
          hsnSac: item.hsnSac || "",
          qty: item.qty,
          unit: item.unit || "Nos",
          rate: item.rate,
          amount: amount
        };
      });

      const isNaGstinQuote = isNaOrEmptyGSTIN(data.gstin || data.clientGstin);
      const gstRate = (!isNaGstinQuote && data.gstEnabled !== false) ? 18 : 0;
      const gstAmount = (subTotal * gstRate) / 100;
      const grandTotal = subTotal + gstAmount;

      const newQuote = {
        number: `AI-Q-${Math.floor(Math.random() * 10000)}`,
        date: data.date || new Date().toISOString().split("T")[0],
        clientDetails: {
          companyName: data.companyName,
          address: data.address || "",
          districtState: data.districtState || "",
          kindAttention: data.kindAttention || "",
          subject: data.subject || "Quotation",
          dearSirText: "Dear Sir,"
        },
        items,
        subTotal,
        gstRate,
        gstAmount,
        grandTotal,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || "",
        creatorEmail: user?.email || "",
        status: "draft",
        customTerms: Array.isArray(data.customTerms) ? data.customTerms : (data.customTerms ? [data.customTerms] : []),
        letterheadMode: data.letterheadMode || false
      };

      setGeneratedDoc(newQuote);
    } else {
      // Invoice Flow
      let subTotal = 0;
      const items = data.items.map((item: any, idx: number) => {
        const amount = item.qty * item.rate;
        subTotal += amount;
        return {
          id: Date.now().toString() + idx,
          srNo: idx + 1,
          description: item.desc,
          hsnSac: "",
          qty: item.qty,
          unit: item.unit || "Nos",
          rate: item.rate,
          amount: amount
        };
      });
      const isNaGstinInv = isNaOrEmptyGSTIN(data.gstin || data.clientGstin);
      const isGstEnabled = !isNaGstinInv && (data.gstEnabled !== undefined ? data.gstEnabled : true);
      const isIgst = Boolean(data.isIgstMode || data.igstMode || (data.igstRate && data.igstRate > 0));
      const cgstRate = isGstEnabled ? (isIgst ? 0 : 9) : 0;
      const sgstRate = isGstEnabled ? (isIgst ? 0 : 9) : 0;
      const igstRate = isGstEnabled ? (isIgst ? 18 : 0) : 0;
      const cgstAmount = (subTotal * cgstRate) / 100;
      const sgstAmount = (subTotal * sgstRate) / 100;
      const igstAmount = (subTotal * igstRate) / 100;
      const gstTotal = cgstAmount + sgstAmount + igstAmount;
      const grandTotal = subTotal + gstTotal;

      const newInvoice = {
        billNumber: data.billNumber || `AI-INV-${Math.floor(Math.random() * 10000)}`,
        billDate: data.billDate || new Date().toISOString().split("T")[0],
        poNumber: data.buyerOrderNo || "",
        poDate: data.buyerOrderDate || "",
        consigneeDetails: {
          companyName: "",
          address: "",
          gstin: ""
        },
        billedTo: {
          clientName: data.companyName,
          clientAddress: data.address || "",
          clientGstin: data.gstin || ""
        },
        jobDescription: data.jobDescription || "",
        items,
        subTotal,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        gstTotal,
        grandTotal,
        rupeesInWords: convertAmountToWords(grandTotal),
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || "",
        creatorEmail: user?.email || "",
        status: "draft",
        invoiceType: "manual",
        customTerms: Array.isArray(data.customTerms) ? data.customTerms : (data.customTerms ? [data.customTerms] : []),
        letterheadMode: data.letterheadMode || false,
        gstEnabled: isGstEnabled
      };

      setGeneratedDoc(newInvoice);
    }

    setIsProcessing(false);
  };

  const initiateDownload = () => {
    const defaultName = docType === "quotation" ? generatedDoc.number : generatedDoc.billNumber;
    setFileNameInput(defaultName);
    setShowSavePrompt(true);
  };

  const confirmDownloadAndSave = async () => {
    if (!fileNameInput.trim()) return;
    setShowSavePrompt(false);
    setIsProcessing(true);

    try {
      const elementId = docType === "quotation" ? "ai-quote-pdf-render" : "ai-invoice-pdf-render";
      const blob = await generatePdfBlob(elementId, {
        isCustomized: isSettingsCustomized(userSettings),
        themeColor: docType || "quotation"
      });
      downloadPdf(blob, fileNameInput);

      // Auto-save to dashboard
      const docWithAIFlag = { ...generatedDoc, isAiGenerated: true };

      if (googleAccessToken) {
        try {
          const cleanFileName = `${fileNameInput.replace(/[^a-z0-9]/gi, "_")}.pdf`;
          const driveResult = await uploadPdfToGoogleDrive(googleAccessToken, blob, cleanFileName);
          docWithAIFlag.driveUrl = driveResult.driveUrl;
          docWithAIFlag.driveFileId = driveResult.driveFileId;
          docWithAIFlag.status = "sent";
        } catch (err) {
          console.error("Google Drive sync failed:", err);
        }
      }

      let savedId = "";
      if (docType === "quotation") {
        savedId = await createQuotation(docWithAIFlag);
      } else {
        savedId = await createInvoice(docWithAIFlag);
      }

      triggerAppToast("Successfully downloaded, saved, and synced to Drive!");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("highlight_ai_doc", savedId);
      }

      onSwitchWorkspace(docType); // Go back to corresponding dashboard
    } catch (e) {
      console.error(e);
      triggerAppToast("Failed to download or save", "info");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn(
      "relative w-full bg-gradient-to-br from-purple-50/80 via-blue-50/40 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex flex-col items-center justify-center font-sans p-3 sm:p-4 transition-all h-[100dvh] overflow-hidden"
    )}>

      {/* Background ambient blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-300/20 dark:bg-purple-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/20 dark:bg-blue-900/20 blur-[120px] pointer-events-none" />

      {/* Floating animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes float-slow {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        @keyframes float-medium {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 4s ease-in-out infinite; }
      `}} />

      {/* Minimal Top Header */}
      <div className={cn(
        "absolute top-0 left-0 w-full px-4 py-4 sm:px-6 sm:py-6 flex items-center justify-between z-20",
        !docType ? "hidden md:flex" : "flex"
      )}>
        <div className="flex items-center gap-2 sm:gap-3">
          <img
            src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
            alt="Darshan Enterprises Logo"
            className="h-8 sm:h-10 w-auto rounded object-contain mix-blend-multiply dark:mix-blend-normal"
          />
          <span className="font-extrabold tracking-tight text-slate-800 dark:text-zinc-100 text-sm sm:text-lg uppercase hidden sm:block">
            DARSHAN <span className="text-slate-500 dark:text-zinc-400">ENTERPRISES</span>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => onSwitchWorkspace(null)}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-full bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs sm:text-sm transition-all active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Back
          </button>

          {/* User Profile - Only show in Wizard */}
          {user && docType && (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-1.5 p-1 sm:pl-2 sm:pr-3.5 rounded-full bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-100" />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
                  </div>
                )}
                <div className="flex flex-col items-start hidden sm:flex">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 leading-none mb-1">{user.displayName || "User"}</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-none">{user.email}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 ml-0.5 sm:ml-1" />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-100 dark:border-zinc-800 py-2 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-bold transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!docType ? (
        <>
          {/* Desktop Version */}
          <div className="hidden md:flex relative z-10 flex flex-col items-center justify-center w-full max-w-5xl mx-auto pt-6 pb-2">

            {/* Hero Section */}
            <div className="text-center mb-6 flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[10px] font-black uppercase tracking-widest mb-4 border border-purple-200/50 dark:border-purple-500/20 shadow-sm animate-float-medium">
                <Sparkles className="w-3 h-3" />
                AI GENERATOR SUITE
              </div>

              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                Generate with <span className="text-purple-600 dark:text-purple-400">AI</span>
                <Sparkles className="w-8 h-8 text-purple-400 -mt-4 animate-pulse" />
              </h1>
              <p className="text-slate-500 dark:text-zinc-400 font-medium text-base max-w-lg mb-6">
                Select a document type to start the interactive AI wizard
              </p>

              <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                <div className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-full shadow-[0_0_60px_rgba(168,85,247,0.2)] animate-pulse" />
                <div className="absolute inset-1.5 bg-gradient-to-tr from-purple-50 to-blue-50 dark:from-purple-900/40 dark:to-blue-900/40 rounded-full border border-white dark:border-white/10" />
                <Sparkles className="w-10 h-10 text-purple-600 dark:text-purple-400 relative z-10 animate-float-slow" />

                {/* Floating particles */}
                <div className="absolute top-1 left-2 w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute bottom-4 right-1 w-1 h-1 rounded-full bg-blue-400 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute -top-2 right-6 w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" style={{ animationDuration: '4s' }} />
              </div>

              <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">What would you like to create?</h2>
              <p className="text-slate-500 dark:text-zinc-400 text-xs max-w-md mx-auto leading-relaxed">
                Our AI Chat Wizard will ask you a series of questions to quickly gather all necessary details and generate a professional document instantly.
              </p>
            </div>

            {/* Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mb-8">

              {/* Quotation Card */}
              <button
                onClick={() => setDocType("quotation")}
                className="group relative flex flex-col items-start p-6 rounded-[28px] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-orange-200/50 dark:border-orange-500/20 hover:border-orange-400/50 dark:hover:border-orange-500/50 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_15px_30px_rgba(249,115,22,0.1)] text-left"
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm border border-orange-100 dark:border-orange-500/20">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">Quotation</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed mb-6 font-medium">
                  Generate a business proposal with standard terms.
                </p>
                <div className="mt-auto flex items-center gap-2 text-orange-600 dark:text-orange-400 font-extrabold text-[10px] uppercase tracking-widest group-hover:gap-3 transition-all">
                  START WIZARD <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Invoice Card */}
              <button
                onClick={() => setDocType("invoice")}
                className="group relative flex flex-col items-start p-6 rounded-[28px] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-purple-200/50 dark:border-purple-500/20 hover:border-purple-400/50 dark:hover:border-purple-500/50 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_15px_30px_rgba(168,85,247,0.1)] text-left"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm border border-purple-100 dark:border-purple-500/20">
                  <ReceiptRupee className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">Tax Invoice</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed mb-6 font-medium">
                  Generate a commercial billing log with tax info.
                </p>
                <div className="mt-auto flex items-center gap-2 text-purple-600 dark:text-purple-400 font-extrabold text-[10px] uppercase tracking-widest group-hover:gap-3 transition-all">
                  START WIZARD <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

            </div>

            {/* Bottom Feature Strip */}
            <div className="w-full max-w-5xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 dark:border-white/5 shadow-sm hidden sm:flex items-center justify-between divide-x divide-slate-100 dark:divide-white/5">
              <div className="flex items-center gap-4 px-6 flex-1">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-xs">100% Accurate</h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">Reliable & error-free</p>
                </div>
              </div>

              <div className="flex items-center gap-4 px-6 flex-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <div className="font-black text-lg">⚡</div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-xs">Save Time</h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">Generate in seconds</p>
                </div>
              </div>

              <div className="flex items-center gap-4 px-6 flex-1">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                  <div className="font-black text-lg text-purple-500">🔒</div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-xs">Secure Data</h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">Your data is protected</p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 flex-1">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-xs">AI Powered</h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">Smart & intelligent</p>
                </div>
              </div>
            </div>

          </div>

          {/* Mobile Version */}
          <div className="flex md:hidden relative z-10 flex-col items-center w-full h-full max-w-sm mx-auto pt-2 pb-2 px-1 justify-between">
            {/* Top Section */}
            <div className="w-full flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <img
                  src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
                  alt="Logo"
                  className="h-7 w-auto rounded object-contain mix-blend-multiply dark:mix-blend-normal"
                />
                <span className="font-extrabold tracking-tight text-xs uppercase">
                  <span className="text-orange-500">DARSHAN</span>{" "}
                  <span className="text-slate-800 dark:text-zinc-200">ENTERPRISES</span>
                </span>
              </div>
              <button
                onClick={() => onSwitchWorkspace(null)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 shadow-sm text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] active:scale-95 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            </div>

            {/* Main Centered Content */}
            <div className="flex-1 flex flex-col items-center justify-center w-full w-full py-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase tracking-wider border border-purple-100 dark:border-purple-500/20 shadow-sm mb-1 animate-float-medium">
                <Sparkles className="w-3 h-3 text-purple-500" />
                AI GENERATOR SUITE
              </div>

              {/* Large Heading */}
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white text-center flex items-center justify-center gap-1.5">
                Generate with <span className="bg-gradient-to-r from-purple-600 to-indigo-500 bg-clip-text text-transparent dark:from-purple-400 dark:to-indigo-300">AI</span>
                <SparkleIcon className="w-4 h-4 text-purple-500 dark:text-purple-400 animate-pulse" />
              </h1>

              {/* Short subtitle */}
              <p className="text-slate-500 dark:text-zinc-400 font-medium text-xs text-center max-w-[300px] mt-0.5 leading-relaxed">
                Use our AI assistant to create professional documents in just a few simple steps.
              </p>

              {/* Hero Section: Glowing AI Orb / AI Core */}
              <div className="relative w-24 h-24 flex items-center justify-center my-3">
                {/* Animated rings */}
                <div className="absolute inset-0 rounded-full border border-purple-500/10 dark:border-purple-400/10 animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-1.5 rounded-full border border-dashed border-indigo-500/20 dark:border-indigo-400/20 animate-[spin_15s_linear_infinite_reverse]" />
                <div className="absolute inset-3 rounded-full border border-purple-500/30 dark:border-purple-400/30 animate-pulse" style={{ animationDuration: '3s' }} />

                {/* Glowing Orb Backdrop */}
                <div className="absolute inset-4.5 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full blur-xl opacity-20 dark:opacity-30 animate-pulse" style={{ animationDuration: '4s' }} />

                {/* Glassmorphic Core */}
                <div className="absolute w-12 h-12 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-white dark:border-white/10 shadow-[0_8px_32px_0_rgba(168,85,247,0.15)] flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                </div>

                {/* Floating particles */}
                <div className="absolute top-2 left-4 w-1 h-1 rounded-full bg-orange-400 animate-ping" style={{ animationDuration: '2.5s' }} />
                <div className="absolute bottom-4 right-6 w-1 h-1 rounded-full bg-blue-400 animate-ping" style={{ animationDuration: '1.8s' }} />
                <div className="absolute top-6 right-2 w-1 h-1 rounded-full bg-purple-400 animate-ping" style={{ animationDuration: '3.2s' }} />
                <div className="absolute bottom-5 left-6 w-1 h-1 rounded-full bg-indigo-400 animate-ping" style={{ animationDuration: '2.2s' }} />
              </div>

              {/* Greeting Section */}
              <div className="text-center mb-3">
                <h2 className="text-base font-black text-slate-800 dark:text-white mb-0.5">
                  Hi {user?.displayName ? user.displayName.split(" ")[0] : "Darshan"} 👋
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  What would you like to <span className="text-purple-600 dark:text-purple-400 font-bold">create</span> today?
                </p>
              </div>

              {/* Document Selection: side-by-side cards */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-3 shrink-0">
                {/* Quotation Card */}
                <button
                  onClick={() => setDocType("quotation")}
                  className="group relative flex flex-col items-center p-3 rounded-[28px] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-orange-200/50 dark:border-orange-500/20 active:border-orange-400/80 dark:active:border-orange-500/80 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.03)] active:scale-95 text-center min-h-[180px]"
                >
                  {/* Icon container */}
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-950/10 flex items-center justify-center mb-1.5 text-orange-500 border border-orange-100/80 dark:border-orange-500/20 shadow-[0_4px_10px_rgba(249,115,22,0.1)]">
                    <FileText className="w-4.5 h-4.5" />
                    <Sparkles className="absolute -top-1 -right-0.5 w-2.5 h-2.5 text-orange-300 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white mb-1">Quotation</h3>
                  <p className="text-slate-500 dark:text-zinc-400 text-[10px] leading-relaxed mb-2 font-medium flex-1">
                    Create professional quotations and proposals for your customers.
                  </p>
                  <div className="w-full py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-orange-100 dark:border-orange-500/20 flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400 font-extrabold text-[9px] uppercase tracking-wider shadow-sm">
                    Create <ArrowRight className="w-2.5 h-2.5" />
                  </div>
                </button>

                {/* Tax Invoice Card */}
                <button
                  onClick={() => setDocType("invoice")}
                  className="group relative flex flex-col items-center p-3 rounded-[28px] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-purple-200/50 dark:border-purple-500/20 active:border-purple-400/80 dark:active:border-purple-500/80 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.03)] active:scale-95 text-center min-h-[180px]"
                >
                  {/* Icon container */}
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-950/10 flex items-center justify-center mb-1.5 text-purple-600 dark:text-purple-400 border border-purple-100/80 dark:border-purple-500/20 shadow-[0_4px_10px_rgba(168,85,247,0.1)]">
                    <RupeeInvoiceIcon className="w-4.5 h-4.5" />
                    <Sparkles className="absolute -top-1 -right-0.5 w-2.5 h-2.5 text-purple-300 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white mb-1">Tax Invoice</h3>
                  <p className="text-slate-500 dark:text-zinc-400 text-[10px] leading-relaxed mb-2 font-medium flex-1">
                    Generate GST invoices with tax details and professional formatting.
                  </p>
                  <div className="w-full py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400 font-extrabold text-[9px] uppercase tracking-wider shadow-sm">
                    Create <ArrowRight className="w-2.5 h-2.5" />
                  </div>
                </button>
              </div>

              {/* Trust Section */}
              <div className="w-full max-w-sm bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-2 border border-slate-200/50 dark:border-white/5 shadow-sm flex items-center justify-between text-[9px] font-black text-slate-600 dark:text-zinc-300 shrink-0">
                <div className="flex-1 flex justify-center items-center gap-0.5">
                  <span>⚡</span> Fast & Smart
                </div>
                <div className="h-3 w-px bg-slate-200 dark:bg-white/10" />
                <div className="flex-1 flex justify-center items-center gap-0.5">
                  <span>🛡️</span> 100% Accurate
                </div>
                <div className="h-3 w-px bg-slate-200 dark:bg-white/10" />
                <div className="flex-1 flex justify-center items-center gap-0.5">
                  <span>🔒</span> Secure & Safe
                </div>
              </div>
            </div>

            {/* Footer / Privacy & Security Note */}
            <div className="w-full max-w-sm bg-purple-50/20 dark:bg-purple-950/5 rounded-2xl p-2.5 border border-purple-100/30 dark:border-purple-500/10 flex items-center justify-center gap-2.5 text-xs text-slate-500 dark:text-zinc-400 font-medium shadow-sm shrink-0">
              <div className="w-5.5 h-5.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-500 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <p className="leading-normal text-center text-[11px] flex-1">
                Your data is secure and used only to generate documents. Learn more in our{" "}
                <a href="#" className="text-purple-600 dark:text-purple-400 font-bold underline hover:text-purple-700">
                  privacy policy.
                </a>
              </p>
            </div>
          </div>
        </>
      ) : (
        /* Chat Wizard Interface */
        <div className="relative z-10 w-full md:flex-1 flex flex-col h-[calc(100dvh-45px)] md:h-full pt-20 sm:pt-28 pb-4 px-2 sm:px-6 lg:px-8 md:overflow-hidden">
          <AIChatInterface
            docType={docType}
            onFinish={handleWizardFinish}
            onCancel={() => setDocType(null)}
          />
        </div>
      )}

      {/* Preview Overlay */}
      {generatedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={cn(
            "bg-slate-100 dark:bg-zinc-900 w-full max-w-5xl h-[90vh] rounded-[32px] overflow-hidden flex flex-col border shadow-2xl",
            docType === "quotation" ? "border-orange-500/30" : "border-violet-500/30"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  docType === "quotation" ? "bg-orange-500/10 text-orange-500" : "bg-violet-500/10 text-violet-500"
                )}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">AI Generated Document</h3>
                  <p className="text-xs text-muted-foreground font-medium">Review your generated {docType}</p>
                </div>
              </div>
              <button
                onClick={() => setGeneratedDoc(null)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hidden Unscaled Render for pristine PDF Generation */}
            <div className="absolute left-[-9999px] top-[-9999px] pointer-events-none opacity-0">
              <div className="bg-white w-[794px]">
                {docType === "quotation" ? (
                  <QuotationPreview quotation={generatedDoc} settings={userSettings} id="ai-quote-pdf-render" />
                ) : (
                  <InvoicePreview invoice={generatedDoc} settings={userSettings} id="ai-invoice-pdf-render" />
                )}
              </div>
            </div>

            {/* Preview Container - Mobile (With Pan & Zoom) */}
            <div className="flex-1 overflow-hidden bg-slate-200/50 dark:bg-black/50 w-full relative flex md:hidden">
              <TransformWrapper
                initialScale={typeof window !== 'undefined' && window.innerWidth < 768 ? 0.35 : 0.9}
                minScale={0.15}
                maxScale={4}
                centerOnInit={true}
                wheel={{ step: 0.1 }}
                pinch={{ step: 5 }}
              >
                <TransformComponent 
                  wrapperStyle={{ width: "100%", height: "100%" }} 
                  contentStyle={{ width: "max-content", height: "max-content", display: "flex", alignItems: "center", justifyContent: "center", minWidth: "100%", minHeight: "100%" }}
                >
                  <div className="bg-white shadow-2xl rounded-sm">
                    {docType === "quotation" ? (
                      <QuotationPreview quotation={generatedDoc} settings={userSettings} id="ai-quote-preview-mobile" />
                    ) : (
                      <InvoicePreview invoice={generatedDoc} settings={userSettings} id="ai-invoice-preview-mobile" />
                    )}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            </div>

            {/* Preview Container - Desktop (Standard Clean View) */}
            <div className="flex-1 overflow-y-auto bg-slate-200/50 dark:bg-black/50 p-6 hidden md:flex justify-center">
              <div className="bg-white shadow-2xl rounded-sm transform scale-90 sm:scale-100 origin-top h-max">
                {docType === "quotation" ? (
                  <QuotationPreview quotation={generatedDoc} settings={userSettings} id="ai-quote-preview-desktop" />
                ) : (
                  <InvoicePreview invoice={generatedDoc} settings={userSettings} id="ai-invoice-preview-desktop" />
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-white/10 shrink-0 flex flex-col sm:flex-row gap-3 justify-end items-center">
              <button
                onClick={initiateDownload}
                disabled={isProcessing}
                className={cn(
                  "w-full sm:w-auto px-8 py-2.5 rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100 text-sm",
                  docType === "quotation"
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25"
                    : "bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 shadow-lg shadow-violet-500/25"
                )}
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Download className="w-4 h-4" /> Download & Save</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elegant Custom Save Prompt Modal */}
      {showSavePrompt && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={cn(
            "bg-white dark:bg-zinc-950 w-full max-w-md rounded-[28px] p-6 shadow-2xl border animate-in zoom-in-95 duration-200",
            docType === "quotation" ? "border-orange-500/20" : "border-violet-500/20"
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                docType === "quotation" ? "bg-orange-50 dark:bg-orange-500/10 text-orange-500" : "bg-violet-50 dark:bg-violet-500/10 text-violet-500"
              )}>
                <Save className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Save AI Document</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6 pl-13">Choose a file name for your generated PDF.</p>

            <input
              type="text"
              value={fileNameInput}
              onChange={(e) => setFileNameInput(e.target.value)}
              className={cn(
                "w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 focus:outline-none font-semibold text-slate-800 dark:text-zinc-100 mb-6 transition-all",
                docType === "quotation" ? "focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" : "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              )}
              autoFocus
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSavePrompt(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDownloadAndSave}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-bold text-white shadow-sm transition-colors text-sm flex items-center gap-2",
                  docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600"
                )}
              >
                <Download className="w-4 h-4" /> Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
