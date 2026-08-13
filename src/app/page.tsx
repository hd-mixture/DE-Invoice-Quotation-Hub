"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import Login from "../components/Login";
import Navbar from "../components/Navbar";
import Dashboard from "../components/dashboard/Dashboard";
import QuotationForm from "../components/quotation/QuotationForm";
import InvoiceDashboard from "../components/dashboard/InvoiceDashboard";
import InvoiceForm from "../components/invoice/InvoiceForm";
import AdminSettingsPanel from "../components/settings/AdminSettings";
import AIGeneratorDashboard from "../components/ai/AIGeneratorDashboard";
import AIChatInterface from "../components/ai/AIChatInterface";
import { Quotation, TaxInvoice } from "../types";
import { Loader2, ShieldAlert, FileText, Receipt, LogOut, ArrowRight, Sparkles, X } from "lucide-react";
import { cn } from "../lib/utils";
import { useTheme } from "../context/ThemeContext";
import { NotificationManager } from "../components/notifications/NotificationManager";
import { PwaSplashScreen } from "../components/common/PwaSplashScreen";
import { ReceiptRupee } from "../components/common/ReceiptRupee";
import { sessionManager } from "../lib/sessionManager";
import { convertAmountToWords } from "../utils/amountToWords";
import { isNaOrEmptyGSTIN } from "../utils/gstValidation";

const SparkleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 3c.13 4.94 4.06 8.87 9 9-.13.13-4.06 4.06-9 9-.13-.13-4.06-4.06-9-9 4.94-.13 8.87-4.06 9-9z"/>
  </svg>
);

export default function Home() {
  const { user, loading, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  // Workspace Mode: 'quotation' | 'invoice' | 'ai' | null
  const [workspaceMode, setWorkspaceMode] = useState<'quotation' | 'invoice' | 'ai' | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlModule = params.get("module") as any;
      if (urlModule && ['quotation', 'invoice', 'ai'].includes(urlModule)) {
        return urlModule;
      }
      return (sessionStorage.getItem("portal_workspace_mode") as any) || null;
    }
    return null;
  });

  // Navigation states: 'dashboard', 'form', 'settings'
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      if (urlTab === "settings" || urlTab === "admin") return "settings";
      return sessionStorage.getItem("portal_active_tab") || "dashboard";
    }
    return "dashboard";
  });
  
  const [showAIChatModal, setShowAIChatModal] = useState<boolean>(false);

  // Context-Aware Direct AI Generation Finish Handler
  const handleAIGenerateFinish = (data: any) => {
    if (workspaceMode === "invoice") {
      let subTotal = 0;
      const items = (data.items || []).map((item: any, idx: number) => {
        const amount = (Number(item.qty) || 1) * (Number(item.rate) || 0);
        subTotal += amount;
        return {
          id: Date.now().toString() + idx,
          srNo: idx + 1,
          description: item.desc || item.description || "",
          hsnSac: item.hsnSac || "",
          qty: Number(item.qty) || 1,
          unit: item.unit || "Nos",
          rate: Number(item.rate) || 0,
          amount: amount
        };
      });

      const isNaGstin = isNaOrEmptyGSTIN(data.gstin || data.clientGstin);
      const isGstEnabled = !isNaGstin && data.gstEnabled !== false;
      const gstRate = isGstEnabled ? (Number(data.gstRate) || 18) : 0;
      const cgstRate = gstRate / 2;
      const sgstRate = gstRate / 2;
      const cgstAmount = (subTotal * cgstRate) / 100;
      const sgstAmount = (subTotal * sgstRate) / 100;
      const gstTotal = cgstAmount + sgstAmount;
      const grandTotal = subTotal + gstTotal;

      const newInvoice: TaxInvoice = {
        id: "",
        billNumber: data.billNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        billDate: data.billDate || data.date || new Date().toISOString().split("T")[0],
        poNumber: data.poNumber || "",
        poDate: data.poDate || new Date().toISOString().split("T")[0],
        consigneeDetails: {
          companyName: data.clientName || "",
          address: data.clientAddress || "",
          gstin: data.gstin || ""
        },
        billedTo: {
          clientName: data.clientName || "",
          clientAddress: data.clientAddress || "",
          clientGstin: data.gstin || ""
        },
        jobDescription: data.jobDescription || data.subject || "Supply of Materials & Technical Services",
        items: items,
        subTotal: subTotal,
        cgstRate: cgstRate,
        sgstRate: sgstRate,
        igstRate: 0,
        cgstAmount: cgstAmount,
        sgstAmount: sgstAmount,
        igstAmount: 0,
        gstTotal: gstTotal,
        grandTotal: grandTotal,
        rupeesInWords: convertAmountToWords(grandTotal),
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || "",
        creatorEmail: user?.email || "",
        status: "draft",
        isImported: true,
        invoiceType: "imported",
        importSource: "excel"
      };

      setEditInvoice(newInvoice);
      setActiveTab("form");
      setShowAIChatModal(false);
    } else {
      // Quotation Mode
      let subTotal = 0;
      const items = (data.items || []).map((item: any, idx: number) => {
        const amount = (Number(item.qty) || 1) * (Number(item.rate) || 0);
        subTotal += amount;
        return {
          id: Date.now().toString() + idx,
          srNo: idx + 1,
          description: item.desc || item.description || "",
          hsnSac: item.hsnSac || "",
          qty: Number(item.qty) || 1,
          unit: item.unit || "Nos",
          rate: Number(item.rate) || 0,
          amount: amount
        };
      });

      const isNaGstinQuote = isNaOrEmptyGSTIN(data.gstin || data.clientGstin);
      const gstRate = (!isNaGstinQuote && data.gstEnabled !== false) ? (Number(data.gstRate) || 18) : 0;
      const gstAmount = (subTotal * gstRate) / 100;
      const grandTotal = subTotal + gstAmount;

      const newQuote: Quotation = {
        id: "",
        number: `Q-${Math.floor(1000 + Math.random() * 9000)}`,
        date: data.date || new Date().toISOString().split("T")[0],
        clientDetails: {
          companyName: data.clientName || "",
          address: data.clientAddress || "",
          districtState: data.districtStatePincode || "",
          kindAttention: data.kindAttention || "",
          subject: data.subject || "Commercial Supply & Technical Quotation",
          dearSirText: "Dear Sir, We are pleased to submit our commercial quotation as below:"
        },
        items: items,
        subTotal: subTotal,
        gstRate: gstRate,
        gstAmount: gstAmount,
        grandTotal: grandTotal,
        customTerms: data.terms || [
          "Payment terms: 50% advance along with P.O.",
          "GST extra as applicable at current rates.",
          "Validity: This quotation is valid for 30 days."
        ],
        letterheadMode: data.showLetterhead ?? true,
        isAiGenerated: true,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || "",
        creatorEmail: user?.email || "",
        status: "draft"
      };

      setEditQuotation(newQuote);
      setActiveTab("form");
      setShowAIChatModal(false);
    }
  };

  // Track unsaved changes across settings, quotations, and invoices
  const [unsavedChanges, setUnsavedChanges] = useState<boolean>(false);

  // Sync tab unsaved state to sessionManager for cross-tab inspection
  useEffect(() => {
    sessionManager.setTabUnsavedWork(unsavedChanges);
  }, [unsavedChanges]);

  // States to handle the custom modern unsaved changes warning dialog
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [pendingWorkspaceMode, setPendingWorkspaceMode] = useState<'quotation' | 'invoice' | 'ai' | null>(null);
  const [isPendingLogout, setIsPendingLogout] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Logout interceptor: checks if CURRENT tab OR ANY OTHER TAB has registered unsaved work
  const handleLogoutWithCheck = () => {
    const isSelfUnsaved = unsavedChanges;
    const isOtherTabUnsaved = sessionManager.hasAnyTabUnsavedWork();

    if (isSelfUnsaved || isOtherTabUnsaved) {
      setIsPendingLogout(true);
      setShowConfirmModal(true);
    } else {
      logout();
    }
  };

  // Listen for global request-app-logout event from child components
  useEffect(() => {
    const handleLogoutRequest = () => {
      handleLogoutWithCheck();
    };
    window.addEventListener("request-app-logout", handleLogoutRequest);
    return () => {
      window.removeEventListener("request-app-logout", handleLogoutRequest);
    };
  }, [unsavedChanges]);
  
  // Holds the quotation currently being edited
  const [editQuotation, setEditQuotation] = useState<Quotation | null>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("portal_edit_quotation");
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  // Holds the invoice currently being edited
  const [editInvoice, setEditInvoice] = useState<TaxInvoice | null>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("portal_edit_invoice");
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  // Refs to prevent infinite history state pushes when navigating back/forward
  const isNavigatingHistory = React.useRef(false);
  const popstateConfirmTriggered = React.useRef(false);

  // Helper to push history state
  const pushHistoryState = (
    mode: 'quotation' | 'invoice' | 'ai' | null, 
    tab: string, 
    hasEditQuo: boolean, 
    hasEditInv: boolean
  ) => {
    if (typeof window === "undefined") return;
    if (isNavigatingHistory.current) {
      isNavigatingHistory.current = false;
      return;
    }
    window.history.pushState({
      workspaceMode: mode,
      activeTab: tab,
      isEditQuotation: hasEditQuo,
      isEditInvoice: hasEditInv
    }, "");
  };

  // Sync workspaceMode to sessionStorage & URL search parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (workspaceMode) {
        sessionStorage.setItem("portal_workspace_mode", workspaceMode);
        url.searchParams.set("module", workspaceMode);
      } else {
        sessionStorage.removeItem("portal_workspace_mode");
        url.searchParams.delete("module");
      }
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [workspaceMode]);

  // Sync activeTab to sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("portal_active_tab", activeTab);
    }
  }, [activeTab]);

  // Sync editQuotation to sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (editQuotation) {
        sessionStorage.setItem("portal_edit_quotation", JSON.stringify(editQuotation));
      } else {
        sessionStorage.removeItem("portal_edit_quotation");
      }
    }
  }, [editQuotation]);

  // Sync editInvoice to sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (editInvoice) {
        sessionStorage.setItem("portal_edit_invoice", JSON.stringify(editInvoice));
      } else {
        sessionStorage.removeItem("portal_edit_invoice");
      }
    }
  }, [editInvoice]);

  // Set up initial history entry for browser back navigation support
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState({
        workspaceMode: workspaceMode,
        activeTab: activeTab,
        isEditQuotation: !!editQuotation,
        isEditInvoice: !!editInvoice
      }, "");
    }
  }, []);

  // Browser state pop (Back/Forward button handler!)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!user) return; // Route Protection: Block browser back/forward history navigation when unauthenticated
      const state = event.state;
      if (!state) return;

      // Handle unsaved changes check
      if (unsavedChanges) {
        // Block back navigation by pushing current state back onto history stack
        window.history.pushState({
          workspaceMode: workspaceMode,
          activeTab: activeTab,
          isEditQuotation: !!editQuotation,
          isEditInvoice: !!editInvoice
        }, "");

        // Open unsaved warning confirm modal
        setPendingWorkspaceMode(state.workspaceMode);
        setPendingTab(state.activeTab);
        popstateConfirmTriggered.current = true;
        setShowConfirmModal(true);
        return;
      }

      // Navigate to popped state peacefully
      isNavigatingHistory.current = true;
      setWorkspaceMode(state.workspaceMode);
      setActiveTab(state.activeTab);
      if (!state.isEditQuotation) setEditQuotation(null);
      if (!state.isEditInvoice) setEditInvoice(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [unsavedChanges, workspaceMode, activeTab, editQuotation, editInvoice]);

  // Track if user was ever logged in within this tab instance
  const wasLoggedInRef = useRef(false);

  // Reset navigation states ONLY when user explicitly logs out
  useEffect(() => {
    if (user) {
      wasLoggedInRef.current = true;
    } else if (!user && !loading && wasLoggedInRef.current) {
      wasLoggedInRef.current = false;
      setActiveTab("dashboard");
      setEditQuotation(null);
      setEditInvoice(null);
      setUnsavedChanges(false);
      setPendingTab(null);
      setPendingWorkspaceMode(null);
      setShowConfirmModal(false);
      setWorkspaceMode(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("portal_active_tab");
        sessionStorage.removeItem("portal_edit_quotation");
        sessionStorage.removeItem("portal_edit_invoice");
        sessionStorage.removeItem("portal_workspace_mode");
      }
    }
  }, [user, loading]);

  // Intercept tab changes to check for unsaved work
  const handleTabChange = (newTab: string) => {
    if (newTab === activeTab) return;
    if (unsavedChanges) {
      setPendingTab(newTab);
      setPendingWorkspaceMode(null);
      setShowConfirmModal(true);
    } else {
      setActiveTab(newTab);
      pushHistoryState(workspaceMode, newTab, !!editQuotation, !!editInvoice);
    }
  };

  // Portal Transition State
  const [transitionState, setTransitionState] = useState<{
    isActive: boolean;
    stage: 'entering' | 'active' | 'exiting';
    targetPortal: 'quotation' | 'invoice' | 'ai' | null;
  }>({
    isActive: false,
    stage: 'active',
    targetPortal: null,
  });

  // Scroll Lock when modals or transitions are active
  useEffect(() => {
    if (showConfirmModal || showAIChatModal || transitionState.isActive) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [showConfirmModal, showAIChatModal, transitionState.isActive]);

  const triggerPortalTransition = (target: 'quotation' | 'invoice' | 'ai' | null) => {
    // If transitioning back to selection menu (null), transition quickly
    if (target === null) {
      setWorkspaceMode(null);
      setActiveTab("dashboard");
      pushHistoryState(null, "dashboard", false, false);
      return;
    }

    setTransitionState({
      isActive: true,
      stage: 'entering',
      targetPortal: target,
    });

    // Step 1: Smooth backdrop blur and card entry animation
    setTimeout(() => {
      // Step 2: Under-the-hood mode shift
      setWorkspaceMode(target);
      setActiveTab("dashboard");
      pushHistoryState(target, "dashboard", false, false);
      
      // Step 3: Transition to active status display
      setTransitionState(prev => ({
        ...prev,
        stage: 'active'
      }));

      // Step 4: Show the Switched message peacefully, then start exiting
      setTimeout(() => {
        setTransitionState(prev => ({
          ...prev,
          stage: 'exiting'
        }));
        
        // Step 5: Clean up transition states
        setTimeout(() => {
          setTransitionState({
            isActive: false,
            stage: 'active',
            targetPortal: null,
          });
        }, 300); // match exit transition duration
      }, 1800);
    }, 450); // match entry transition duration
  };

  // Intercept workspace switching to check for unsaved work
  const handleWorkspaceChange = (newMode: 'quotation' | 'invoice' | 'ai' | null) => {
    if (unsavedChanges) {
      setPendingWorkspaceMode(newMode);
      setPendingTab(null);
      setShowConfirmModal(true);
    } else {
      triggerPortalTransition(newMode);
    }
  };

  // Browser-level reload/close intercept
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [unsavedChanges]);

  // loading view
  if (loading) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden p-4 select-none transition-colors duration-300 bg-gradient-to-tr from-[#f5f3ff] via-[#f8fafc] via-[#eff6ff] to-[#fff7ed] text-slate-900 dark:bg-none dark:bg-zinc-950 dark:text-white"
      >
        {/* Ambient Glow Meshes matching Select Management Module */}
        <div 
          className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none animate-pulse transition-colors duration-300 bg-orange-300/20 dark:bg-orange-600/10" 
        />
        <div 
          className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none animate-pulse transition-colors duration-300 bg-purple-300/25 dark:bg-violet-600/10" 
        />

        {/* Loading Card */}
        <div className="relative z-10 flex flex-col items-center text-center pt-10 sm:pt-12 pb-8 sm:pb-10 px-8 sm:px-10 max-w-sm w-full rounded-3xl shadow-2xl border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 transition-colors bg-white/95 border-slate-200/80 text-slate-900 shadow-slate-900/10 dark:bg-zinc-900/95 dark:border-white/10 dark:text-white dark:shadow-black/50 space-y-4">
          <div className="relative flex items-center justify-center pt-1">
            <div className="absolute w-20 h-20 bg-[#E55A22]/20 rounded-full blur-2xl animate-pulse" />
            <img
              src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
              alt="Logo"
              className="relative z-10 w-14 h-14 object-contain rounded-2xl shadow-xl border border-slate-200/80 dark:border-white/10 bg-white p-1"
            />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black tracking-wider uppercase" style={{ fontFamily: "Arial Black, sans-serif" }}>
              <span className="text-[#E55A22]">DARSHAN</span>{" "}
              <span className="text-[#09357B] dark:text-blue-400">ENTERPRISES</span>
            </h2>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-widest font-extrabold text-slate-500 dark:text-zinc-400">
              Synchronizing Cloud Data...
            </p>
          </div>

          <div className="pt-1">
            <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
          </div>
        </div>
      </div>
    );
  }

  // Guest view redirect
  if (!user) {
    return <Login />;
  }

  if (user && workspaceMode === null) {
    return (
      <div 
        className="min-h-screen flex flex-col relative overflow-hidden items-center justify-start pt-14 sm:justify-center sm:pt-0 p-4 transition-colors duration-300 bg-gradient-to-tr from-[#f5f3ff] via-[#f8fafc] via-[#eff6ff] to-[#fff7ed] text-slate-900 dark:bg-none dark:bg-zinc-950 dark:text-white"
      >
        {/* Glow meshes */}
        <div 
          className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none animate-pulse transition-colors duration-300 bg-orange-300/20 dark:bg-orange-600/10" 
        />
        <div 
          className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none animate-pulse transition-colors duration-300 bg-purple-300/25 dark:bg-violet-600/10" 
        />
        <div 
          className="absolute top-[40%] left-[40%] w-[400px] h-[400px] rounded-full blur-[150px] pointer-events-none animate-pulse transition-colors duration-300 bg-blue-300/20 dark:bg-cyan-600/10" 
        />

        {/* Branding header */}
        <div className="w-full max-w-4xl mx-auto text-center space-y-3 sm:space-y-4 relative z-10 mb-6 sm:mb-12 flex flex-col items-center">
          <div className="inline-flex items-center justify-center gap-2 p-1 border rounded-2xl select-none px-3 py-1.5 sm:px-4 sm:py-2 transition-all duration-300 bg-white/90 backdrop-blur-md border-slate-200/80 shadow-md dark:bg-white/5 dark:border-white/10">
            <img
              src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
              alt="Logo"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-lg border border-border/10 bg-white"
            />
            <span className="font-extrabold text-xs sm:text-sm tracking-wider uppercase" style={{ fontFamily: "Arial Black, sans-serif" }}>
              <span className="text-[#E55A22]">DARSHAN</span>{" "}
              <span className="text-[#09357B] dark:text-blue-400">ENTERPRISES</span>
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl sm:text-4xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
              Select Management Module
            </h2>
            <p className="text-[10px] sm:text-sm max-w-xl mx-auto font-semibold sm:font-medium px-4 sm:px-0 leading-relaxed text-slate-500 dark:text-zinc-400">
              Enter the specialized document workspaces below to manage quotations, commercial billing logs, and tax returns.
            </p>
          </div>
        </div>

        {/* Triple Card Layout */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-[1100px] mx-auto relative z-10 px-2 sm:px-0">
          
          {/* Card 1: Quotations Portal */}
          <div 
            onClick={() => {
              setWorkspaceMode("quotation");
              setActiveTab("dashboard");
            }}
            className="group relative border cursor-pointer transition-all duration-300 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99] select-none w-full p-5 md:p-8 rounded-[28px] md:rounded-[32px] min-h-[290px] md:min-h-[320px] items-center md:items-start text-center md:text-left bg-white/70 hover:bg-white border-orange-200/60 hover:border-orange-500/50 shadow-md shadow-slate-100 hover:shadow-2xl hover:shadow-orange-500/10 text-slate-900 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 dark:border-orange-500/20 dark:hover:border-orange-500/50 dark:shadow-sm dark:shadow-orange-500/5 dark:hover:shadow-2xl dark:hover:shadow-orange-500/10 dark:text-white"
          >
            {/* Sparkles around card */}
            <div className="absolute top-3 right-3 text-orange-400/40 pointer-events-none group-hover:scale-125 transition-transform duration-500">
              <SparkleIcon className="w-3.5 h-3.5" />
            </div>
            <div className="absolute bottom-16 left-3 text-orange-400/30 pointer-events-none">
              <SparkleIcon className="w-3 h-3" />
            </div>

            <div className="flex flex-col items-center md:items-start gap-4 w-full">
              {/* Icon Container with glowing background */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-orange-400/10 blur-md" />
                <div className="relative w-16 h-16 md:w-14 md:h-14 rounded-full bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/10 flex items-center justify-center text-orange-500 shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <FileText className="w-7 h-7 md:w-6 md:h-6" />
                </div>
              </div>
              
              <div className="space-y-1.5 w-full">
                <h3 className="text-sm md:text-lg font-black transition-colors leading-tight text-slate-900 group-hover:text-orange-500 dark:text-white dark:group-hover:text-orange-400">
                  Quotation Portal
                </h3>
                <p className="text-[10px] md:text-xs font-semibold leading-normal md:leading-relaxed text-slate-500 dark:text-zinc-400">
                  <span className="md:hidden">Create customer proposals & sync to Google Drive</span>
                  <span className="hidden md:inline">Maintain and generate official customer business proposals. Supports default Ankleshwar jurisdiction formatting, classic orange aesthetics, custom terms lists, and Google Drive PDF syncing.</span>
                </p>
              </div>
            </div>

            {/* Mobile explore button */}
            <div className="px-4 py-2 rounded-full font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 text-orange-500 dark:text-orange-400 border border-orange-200/50 dark:border-zinc-700 md:hidden mt-4 shadow-sm transition-colors duration-300">
              Explore <ArrowRight className="w-3.5 h-3.5" />
            </div>

            {/* Desktop Button */}
            <button
              type="button"
              className="mt-6 w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-2xl cursor-pointer transition-all select-none uppercase tracking-wider hidden md:block"
            >
              Enter Quotation Suite
            </button>
          </div>

          {/* Card 2: Tax Invoice Portal */}
          <div 
            onClick={() => {
              setWorkspaceMode("invoice");
              setActiveTab("dashboard");
            }}
            className="group relative border cursor-pointer transition-all duration-300 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99] select-none w-full p-4 md:p-8 rounded-[28px] md:rounded-[32px] min-h-[290px] md:min-h-[320px] items-center md:items-start text-center md:text-left bg-white/70 hover:bg-white border-violet-200/60 hover:border-violet-500/50 shadow-md shadow-slate-100 hover:shadow-2xl hover:shadow-violet-500/10 text-slate-900 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 dark:border-violet-500/20 dark:hover:border-violet-500/50 dark:shadow-sm dark:shadow-violet-500/5 dark:hover:shadow-2xl dark:hover:shadow-violet-500/10 dark:text-white"
          >
            {/* Sparkles around card */}
            <div className="absolute top-3 right-3 text-violet-400/40 pointer-events-none group-hover:scale-125 transition-transform duration-500">
              <SparkleIcon className="w-3.5 h-3.5" />
            </div>
            <div className="absolute bottom-16 left-3 text-violet-400/30 pointer-events-none">
              <SparkleIcon className="w-3 h-3" />
            </div>

            <div className="flex flex-col items-center md:items-start gap-4 w-full">
              {/* Icon Container with glowing background */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-violet-400/10 blur-md" />
                <div className="relative w-16 h-16 md:w-14 md:h-14 rounded-full bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/10 flex items-center justify-center text-violet-400 shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <ReceiptRupee className="w-7 h-7 md:w-6 md:h-6" />
                </div>
              </div>
              
              <div className="space-y-1.5 w-full">
                <h3 className="text-sm md:text-lg font-black transition-colors leading-tight text-slate-900 group-hover:text-violet-500 dark:text-white dark:group-hover:text-violet-400">
                  Tax Invoice Billing
                </h3>
                <p className="text-[10px] md:text-xs font-semibold leading-normal md:leading-relaxed text-slate-500 dark:text-zinc-400">
                  <span className="md:hidden">Manage commercial billing, CGST/SGST, and compliance</span>
                  <span className="hidden md:inline">Manage commercial corporate billing registers. Features deep dark-violet workspaces, customizable HSN product details tables, double-bordered A4 invoice prints, CGST/SGST splitting, and bank account configurations.</span>
                </p>
              </div>
            </div>

            {/* Mobile explore button */}
            <div className="px-4 py-2 rounded-full font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 text-violet-500 dark:text-violet-400 border border-violet-200/50 dark:border-zinc-700 md:hidden mt-4 shadow-sm transition-colors duration-300">
              Explore <ArrowRight className="w-3.5 h-3.5" />
            </div>

            {/* Desktop Button */}
            <button
              type="button"
              className="mt-6 w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-2xl cursor-pointer transition-all select-none uppercase tracking-wider hidden md:block"
            >
              Enter Billing Suite
            </button>
          </div>

          {/* Card 3: AI Generator Portal */}
          <div 
            onClick={() => {
              setWorkspaceMode("ai");
              setActiveTab("dashboard");
            }}
            className="group relative border cursor-pointer transition-all duration-300 flex hover:scale-[1.02] active:scale-[0.99] select-none w-full col-span-2 md:col-span-1 p-4 md:p-8 rounded-[24px] md:rounded-[32px] min-h-[115px] md:min-h-[320px] flex-row md:flex-col justify-between items-center md:items-start text-left md:justify-between bg-white/70 hover:bg-white border-cyan-200/60 hover:border-cyan-500/50 shadow-md shadow-slate-100 hover:shadow-2xl hover:shadow-cyan-500/10 text-slate-900 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 dark:border-cyan-500/25 dark:hover:border-cyan-500/50 dark:shadow-sm dark:shadow-cyan-500/5 dark:hover:shadow-2xl dark:hover:shadow-cyan-500/10 dark:text-white"
          >
            {/* Sparkles around card */}
            <div className="absolute top-3 right-4 text-cyan-400/40 pointer-events-none group-hover:scale-125 transition-transform duration-500">
              <SparkleIcon className="w-3.5 h-3.5" />
            </div>
            <div className="absolute bottom-3 left-4 text-cyan-400/30 pointer-events-none hidden md:block">
              <SparkleIcon className="w-3 h-3" />
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-start gap-4 w-full flex-1 min-w-0">
              {/* Icon Container with glowing background */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-md" />
                <div className="relative w-14 h-14 md:w-14 md:h-14 rounded-full bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  {/* Custom Starburst/Sparkle SVG matching the mockup */}
                  <svg className="w-6 h-6 md:w-6.5 md:h-6.5 animate-[spin_25s_linear_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="2" x2="12" y2="5" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
                    <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
                    <line x1="2" y1="12" x2="5" y2="12" />
                    <line x1="19" y1="12" x2="22" y2="12" />
                    <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
                    <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
                  </svg>
                </div>
              </div>
              
              <div className="space-y-0.5 md:space-y-1.5 text-left flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm md:text-lg font-black transition-colors leading-tight flex items-center gap-1.5 text-slate-900 group-hover:text-cyan-600 dark:text-white dark:group-hover:text-cyan-400">
                    Generate with AI
                  </h3>
                  <span className="text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-extrabold shadow-sm border border-cyan-500/30 animate-pulse shrink-0">
                    New
                  </span>
                </div>
                <p className="text-[10px] md:text-xs font-semibold leading-normal md:leading-relaxed text-slate-500 dark:text-zinc-400">
                  <span className="md:hidden">Draft documents using interactive chat wizard</span>
                  <span className="hidden md:inline">Experience the future of document creation. Use our smart Chat Wizard to rapidly draft quotations and tax invoices step-by-step through an interactive, guided interface.</span>
                </p>
              </div>
            </div>

            <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-cyan-200/50 dark:border-zinc-700 shadow-sm flex items-center justify-center text-cyan-500 shrink-0 md:hidden group-hover:translate-x-1 transition-transform duration-300">
              <ArrowRight className="w-5 h-5" />
            </div>

            <button
              type="button"
              className="mt-6 w-full py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs rounded-2xl cursor-pointer transition-all select-none uppercase tracking-wider shadow-lg shadow-cyan-500/20 hidden md:block"
            >
              Open AI Wizard
            </button>
          </div>

        </div>

        {/* Footer logout shortcut */}
        <button 
          onClick={handleLogoutWithCheck}
          className="mt-8 sm:mt-12 text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer relative z-10 px-6 py-2.5 rounded-full border shadow-sm transition-all active:scale-95 bg-white/80 border-slate-200/80 hover:bg-slate-50 text-slate-500 hover:text-slate-800 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 dark:text-zinc-400 dark:hover:text-white"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out of Account</span>
        </button>



        {/* Bottom waves decoration matching the mockup */}
        <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none overflow-hidden z-0">
          <svg className="absolute bottom-0 w-full h-full text-purple-200/20 dark:text-purple-950/5" viewBox="0 0 1440 320" fill="currentColor" preserveAspectRatio="none">
            <path d="M0,160 C288,224 576,224 864,160 C1152,96 1440,96 1440,160 L1440,320 L0,320 Z" />
          </svg>
          <svg className="absolute bottom-0 w-full h-20 text-indigo-300/15 dark:text-indigo-900/5" viewBox="0 0 1440 320" fill="currentColor" preserveAspectRatio="none">
            <path d="M0,192 C288,256 576,192 864,192 C1152,192 1440,256 1440,192 L1440,320 L0,320 Z" />
          </svg>
        </div>
      </div>
    );
  }


  const isInvoiceMode = workspaceMode === "invoice";
  const isAIMode = workspaceMode === "ai";

  // Authenticated Workspace Dashboard Layout
  return (
    <div className={cn(
      "flex flex-col bg-background relative transition-colors duration-300",
      workspaceMode === 'ai' ? "h-screen overflow-hidden" : "min-h-screen",
      workspaceMode === 'invoice' 
        ? isDark ? "bg-[#0b090f] text-zinc-100" : "bg-[#f3f0f8] text-slate-900" 
        : workspaceMode === 'ai'
        ? isDark ? "bg-[#050f1a] text-zinc-100" : "bg-[#f0f8fa] text-slate-900"
        : ""
    )}>
      {/* Dynamic Background Mesh depending on selected Portal */}
      {workspaceMode === 'invoice' ? (
        <>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />
        </>
      ) : workspaceMode === 'ai' ? (
        <>
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        </>
      ) : (
        <>
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />
        </>
      )}

      {/* Navigation Headers */}
      {workspaceMode !== "ai" && (
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          workspaceMode={workspaceMode} 
          setWorkspaceMode={handleWorkspaceChange}
          onOpenAIGenerator={() => setShowAIChatModal(true)}
        />
      )}

      {/* Page Content Panel */}
      <main className={cn(
        "flex-1 w-full mx-auto relative z-10 flex flex-col",
        workspaceMode !== "ai" && "px-4 sm:px-6 lg:px-8",
        workspaceMode === "invoice" ? "max-w-[1650px]" : workspaceMode === "quotation" ? "max-w-[1650px]" : "max-w-full h-full"
      )}>
        
        {/* Render Quotation Portal components */}
        {workspaceMode === "quotation" && (
          <>
            {activeTab === "dashboard" && (
              <Dashboard 
                onCreateNew={() => {
                  setEditQuotation(null);
                  setActiveTab("form");
                }}
                onEdit={(quotation) => {
                  setEditQuotation(quotation);
                  setActiveTab("form");
                }}
                onGoToSettings={() => handleTabChange("settings")}
              />
            )}

            {activeTab === "form" && (
              <QuotationForm
                editQuotation={editQuotation}
                onUnsavedChangesChange={setUnsavedChanges}
                onClose={(forceClose) => {
                  if (unsavedChanges && forceClose !== true) {
                    setPendingTab("dashboard");
                    setShowConfirmModal(true);
                  } else {
                    setUnsavedChanges(false);
                    setEditQuotation(null);
                    setActiveTab("dashboard");
                  }
                }}
              />
            )}
          </>
        )}

        {/* Render Tax Invoice Portal components */}
        {workspaceMode === "invoice" && (
          <div className="invoice-workspace-theme">
            {activeTab === "dashboard" && (
              <InvoiceDashboard 
                onCreateNew={() => {
                  setEditInvoice(null);
                  setActiveTab("form");
                }}
                onEdit={(invoice) => {
                  setEditInvoice(invoice);
                  setActiveTab("form");
                }}
                onGoToSettings={() => handleTabChange("settings")}
                onSwitchWorkspace={() => handleWorkspaceChange(null)}
              />
            )}

            {activeTab === "form" && (
              <InvoiceForm
                editInvoice={editInvoice}
                onUnsavedChangesChange={setUnsavedChanges}
                onClose={(forceClose) => {
                  if (unsavedChanges && forceClose !== true) {
                    setPendingTab("dashboard");
                    setShowConfirmModal(true);
                  } else {
                    setUnsavedChanges(false);
                    setEditInvoice(null);
                    setActiveTab("dashboard");
                  }
                }}
              />
            )}
          </div>
        )}

        {/* Render AI Generator Portal */}
        {workspaceMode === "ai" && (
          <div className="ai-workspace-theme h-full flex flex-col w-full">
            <AIGeneratorDashboard 
              onSwitchWorkspace={(mode) => handleWorkspaceChange(mode ?? null)}
              onGoToSettings={() => handleTabChange("settings")}
            />
          </div>
        )}

        {/* Settings are shared globally, but styled depending on workspace context */}
        {activeTab === "settings" && (
          <div className={cn(isInvoiceMode ? "invoice-workspace-theme" : "")}>
            <AdminSettingsPanel 
              onUnsavedChangesChange={setUnsavedChanges} 
              workspaceMode={workspaceMode === "ai" ? null : workspaceMode}
              setWorkspaceMode={handleWorkspaceChange}
            />
          </div>
        )}
      </main>

      {/* Custom Modern Unsaved Changes Confirmation Dialog */}
      {showConfirmModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/75 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/5 p-6 sm:p-8 rounded-[28px] text-center shadow-2xl relative select-none animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ease-out"
            style={{ 
              boxShadow: isDark 
                ? isInvoiceMode 
                  ? "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px 0 rgba(139, 92, 246, 0.05)" 
                  : "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px 0 rgba(229, 90, 34, 0.05)"
                : isInvoiceMode
                  ? "0 25px 50px -12px rgba(0, 0, 0, 0.06), 0 0 40px 0 rgba(139, 92, 246, 0.03)"
                  : "0 25px 50px -12px rgba(0, 0, 0, 0.06), 0 0 40px 0 rgba(229, 90, 34, 0.03)"
            }}
          >
            {/* Warning Icon Container */}
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg mb-5",
              isPendingLogout 
                ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/5"
                : isInvoiceMode
                ? "bg-violet-500/10 text-violet-500 border-violet-500/20 shadow-violet-500/5"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5"
            )}>
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {isPendingLogout ? "Unsaved Progress Warning!" : "Unsaved Changes!"}
            </h3>
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">
              {isPendingLogout
                ? "You have unsaved work in progress. Logging out now will permanently discard your draft changes. Are you sure you want to log out?"
                : "You have unsaved changes on this page. Leaving will discard your modifications and they cannot be recovered."}
            </p>

            {/* Buttons Layout */}
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setIsPendingLogout(false);
                  setPendingTab(null);
                  setPendingWorkspaceMode(null);
                }}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold border border-slate-200 dark:border-zinc-700/60 bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all active:scale-[0.98]"
              >
                {isPendingLogout ? "Stay & Save Work" : "Stay & Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnsavedChanges(false);
                  setShowConfirmModal(false);
                  
                  if (isPendingLogout) {
                    setIsPendingLogout(false);
                    logout();
                    return;
                  }

                  if (popstateConfirmTriggered.current) {
                    popstateConfirmTriggered.current = false;
                    isNavigatingHistory.current = true;
                    window.history.back();
                    return;
                  }
                  
                  if (pendingTab) {
                    if (pendingTab === "dashboard") {
                      setEditQuotation(null);
                      setEditInvoice(null);
                    }
                    setActiveTab(pendingTab);
                    setPendingTab(null);
                  }
                  
                  if (pendingWorkspaceMode !== null) {
                    setEditQuotation(null);
                    setEditInvoice(null);
                    triggerPortalTransition(pendingWorkspaceMode);
                    setPendingWorkspaceMode(null);
                  }
                }}
                className={cn(
                  "flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold border border-transparent text-white cursor-pointer transition-all active:scale-[0.98]",
                  isPendingLogout
                    ? "bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 hover:shadow-lg hover:shadow-red-500/20"
                    : isInvoiceMode
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-400 hover:shadow-lg hover:shadow-violet-500/15"
                    : "bg-gradient-to-r from-[#E55A22] to-rose-500 hover:from-[#E55A22]/90 hover:to-rose-500/90 hover:shadow-lg hover:shadow-orange-500/15"
                )}
              >
                {isPendingLogout ? "Discard & Log Out" : "Discard Changes"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <NotificationManager />
      <PwaSplashScreen />

      {/* Peaceful Portal Switch Transition Overlay */}
      {transitionState.isActive && (
        <div 
          className={cn(
            "fixed inset-0 z-[200] flex items-center justify-center select-none pointer-events-auto transition-all duration-300",
            transitionState.stage === 'exiting' ? "opacity-0 backdrop-blur-none" : "opacity-100 backdrop-blur-sm bg-slate-900/20 dark:bg-black/60"
          )}
          style={{
            animation: transitionState.stage === 'entering' ? "overlay-fade-in 0.4s ease-out forwards" : ""
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes overlay-fade-in {
              from { opacity: 0; backdrop-filter: blur(0px); }
              to { opacity: 1; backdrop-filter: blur(24px); }
            }
            
            @keyframes peaceful-scale {
              0% { transform: scale(0.92) rotateY(-8deg); opacity: 0; filter: blur(5px); }
              100% { transform: scale(1) rotateY(0deg); opacity: 1; filter: blur(0px); }
            }
            
            @keyframes peaceful-ripple {
              0% { transform: scale(0.85); opacity: 0.6; }
              50% { transform: scale(1.05); opacity: 0.2; }
              100% { transform: scale(1.25); opacity: 0; }
            }
            
            @keyframes peaceful-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            
            .animate-peaceful-scale {
              animation: peaceful-scale 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
            }
            
            .animate-peaceful-spin {
              animation: peaceful-spin 10s linear infinite;
            }
          `}} />
          
          <div 
            className={cn(
              "w-full max-w-[340px] p-8 rounded-[36px] border text-center shadow-2xl flex flex-col items-center justify-center relative bg-white/95 dark:bg-zinc-900/95 border-slate-200 dark:border-white/10 backdrop-blur-xl animate-peaceful-scale",
              transitionState.stage === 'entering' ? "scale-95 opacity-50 blur-sm duration-300" : ""
            )}
            style={{
              boxShadow: transitionState.targetPortal === 'invoice'
                ? "0 25px 60px -15px rgba(139, 92, 246, 0.12), 0 0 50px rgba(0,0,0,0.15)"
                : "0 25px 60px -15px rgba(229, 90, 34, 0.12), 0 0 50px rgba(0,0,0,0.15)"
            }}
          >
            {/* Visual Icon with Pulsing Rings */}
            <div className="relative w-24 h-24 flex items-center justify-center mb-6 select-none">
              {/* Outer Ripple Rings */}
              <div 
                className={cn(
                  "absolute inset-0 rounded-full border opacity-0",
                  transitionState.targetPortal === 'invoice' ? "border-violet-500/25 bg-violet-500/5" : "border-orange-500/25 bg-orange-500/5"
                )}
                style={{ animation: "peaceful-ripple 2s cubic-bezier(0.16, 1, 0.3, 1) infinite" }}
              />
              <div 
                className={cn(
                  "absolute inset-[-12px] rounded-full border opacity-0",
                  transitionState.targetPortal === 'invoice' ? "border-violet-500/15" : "border-orange-500/15"
                )}
                style={{ animation: "peaceful-ripple 2s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.6s" }}
              />
              
              {/* Spinning subtle backdrop pattern */}
              <div 
                className={cn(
                  "absolute inset-2 rounded-[28px] border border-dashed opacity-25 animate-peaceful-spin",
                  transitionState.targetPortal === 'invoice' ? "border-violet-500" : "border-orange-500"
                )}
              />

              {/* Central Glowing Icon Container */}
              <div 
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center border shadow-xl relative z-10 transition-transform duration-500 ease-out",
                  transitionState.targetPortal === 'invoice'
                    ? "bg-violet-600/10 text-violet-500 border-violet-500/25 shadow-violet-500/10"
                    : "bg-orange-500/10 text-orange-500 border-orange-500/25 shadow-orange-500/10"
                )}
              >
                {transitionState.stage === 'entering' ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : transitionState.targetPortal === 'invoice' ? (
                  <ReceiptRupee className="w-8 h-8" />
                ) : (
                  <FileText className="w-8 h-8" />
                )}
              </div>
            </div>

            {/* Peaceful Text */}
            <div className="space-y-1.5 select-none">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                {transitionState.stage === 'entering' ? "Loading Suite..." : "Switched to"}
              </span>
              <h3 
                className={cn(
                  "text-lg font-black tracking-tight",
                  transitionState.targetPortal === 'invoice'
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-orange-600 dark:text-orange-400"
                )}
              >
                {transitionState.targetPortal === 'invoice' ? "Invoice Dashboard" : "Quotation Dashboard"}
              </h3>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest opacity-60">
                {transitionState.stage === 'entering' ? "Preparing Workspace..." : "Workspace Ready"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Context-Aware Direct AI Chat Canvas Modal Overlay */}
      {showAIChatModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200 select-none">
          <div className={cn(
            "relative w-full max-w-4xl h-[92vh] max-h-[850px] bg-white dark:bg-zinc-950 rounded-[32px] overflow-hidden flex flex-col border shadow-2xl animate-in zoom-in-95 duration-300",
            workspaceMode === "invoice" ? "border-purple-500/40 shadow-purple-500/20" : "border-orange-500/40 shadow-orange-500/20"
          )}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                <div className={cn(
                  "w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-bold shadow-xs border shrink-0",
                  workspaceMode === "invoice" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                )}>
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                      {workspaceMode === "invoice" ? "AI Invoice Assistant" : "AI Quotation Assistant"}
                    </h3>
                    <span className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-black text-[8.5px] sm:text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                      Live Context
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                    {workspaceMode === "invoice" ? "Directly opens New Tax Invoice" : "Directly opens New Quotation"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAIChatModal(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5px]" />
              </button>
            </div>

            {/* Embedded Interactive AI Chat Wizard */}
            <div className="flex-1 w-full overflow-hidden p-2 sm:p-4">
              <AIChatInterface
                docType={workspaceMode === "invoice" ? "invoice" : "quotation"}
                onFinish={handleAIGenerateFinish}
                onCancel={() => setShowAIChatModal(false)}
                isDirectRedirection={true}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
