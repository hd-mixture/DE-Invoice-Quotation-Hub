"use client";

import React, { useState, useEffect } from "react";
import { Quotation, AdminSettings } from "../../types";
import { getQuotations, deleteQuotation, createQuotation, updateQuotation, getFolders, createFolder, deleteFolder, getAdminSettings, isSettingsCustomized } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { 
  Search, 
  Plus, 
  FileSpreadsheet, 
  Trash2, 
  Edit3, 
  Copy, 
  ExternalLink, 
  MessageCircle, 
  Mail, 
  Calendar, 
  FileText,
  Loader2,
  TrendingUp,
  Sparkles,
  CheckCircle,
  FileCheck,
  Share2,
  MoreVertical,
  Download,
  AlertCircle,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderMinus,
  LayoutGrid,
  List,
  Star,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "../../lib/utils";
import { useShareQuotation } from "../../hooks/useShareQuotation";
import { ShareActionsModal } from "./ShareActions";
import { QuotationPreview } from "../quotation/QuotationPreview";
import { downloadPdf, generatePdfBlob } from "../../services/pdfGenerator";

// Helper to format relative time
const formatRelativeTime = (dateStr: string): string => {
  if (!dateStr) return "just now";
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  } else {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }
};

interface DashboardProps {
  onCreateNew: () => void;
  onEdit: (quotation: Quotation) => void;
  onGoToSettings?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onCreateNew, onEdit, onGoToSettings }) => {
  const { user, googleAccessToken } = useAuth();
  const { theme } = useTheme();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [mobileActionsQuotation, setMobileActionsQuotation] = useState<Quotation | null>(null);

  // Canva & Folder Upgrade States
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [toggleHovered, setToggleHovered] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>("all");
  const [draggedOverFolderId, setDraggedOverFolderId] = useState<string | null>(null);
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [movingQuotationId, setMovingQuotationId] = useState<string | null>(null);
  const [draggableQuotationId, setDraggableQuotationId] = useState<string | null>(null);
  const [showFolderSubMenu, setShowFolderSubMenu] = useState(false);
  const [showAllFoldersOnMobile, setShowAllFoldersOnMobile] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);

  // Drawer drag down to close states
  const [drawerTranslateY, setDrawerTranslateY] = useState(0);
  const [isDraggingDrawer, setIsDraggingDrawer] = useState(false);
  const drawerTouchStartY = React.useRef(0);
  const drawerScrollRef = React.useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const {
    sharingState,
    activeQuotation,
    adminSettings,
    tempUrl,
    modalOpen,
    triggerShare,
    closeModal
  } = useShareQuotation(showToast);

  useEffect(() => {
    if (user) {
      loadData();
      loadFolders();
    }
  }, [user]);

  // Global click outside listener to close dropdowns flawlessly
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".actions-menu-container") && !target.closest(".actions-trigger-btn")) {
        setMobileActionsQuotation(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);



  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = sessionStorage.getItem("highlight_ai_doc");
      if (id) {
        sessionStorage.removeItem("highlight_ai_doc");
        // Wait 2200ms for portal blur transition to finish before highlighting and shaking
        setTimeout(() => {
          setHighlightId(id);
          // Scroll to the highlighted item
          setTimeout(() => {
            const el = document.getElementById(`quotation-${id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 100);
          setTimeout(() => setHighlightId(null), 4000);
        }, 2200);
      }
    }
  }, []);

  useEffect(() => {
    setShowFolderSubMenu(false);
    setDrawerTranslateY(0);
    setIsDraggingDrawer(false);
    
    // Prevent background scrolling and hide mobile nav when actions drawer is open (only on mobile viewports!)
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (mobileActionsQuotation && isMobile) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("drawer-open");
    } else {
      document.body.style.overflow = "";
      document.body.classList.remove("drawer-open");
    }
    
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("drawer-open");
    };
  }, [mobileActionsQuotation]);

  useEffect(() => {
    if (folderToDelete || deleteConfirmId) {
      document.body.classList.add("drawer-open", "overflow-hidden");
    } else {
      document.body.classList.remove("drawer-open", "overflow-hidden");
    }
    return () => {
      document.body.classList.remove("drawer-open", "overflow-hidden");
    };
  }, [folderToDelete, deleteConfirmId]);


  // Swipe-down-to-close handlers for the Canva-style bottom drawer
  const handleTouchStart = (e: React.TouchEvent) => {
    const isAtTop = drawerScrollRef.current ? drawerScrollRef.current.scrollTop === 0 : true;
    drawerTouchStartY.current = e.touches[0].clientY;
    setIsDraggingDrawer(isAtTop); // Only eligible for dragging if scrolled to top
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingDrawer) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - drawerTouchStartY.current;
    
    // Only prevent default and animate drawer translation if swipe gesture is deliberate (> 8px)
    // This ensures micro-touch-move movements during single clicks/taps don't block click events
    if (deltaY > 8) {
      if (e.cancelable) e.preventDefault();
      setDrawerTranslateY(deltaY - 8);
    }
  };

  const handleTouchEnd = () => {
    setIsDraggingDrawer(false);
    if (drawerTranslateY > 90) {
      // Animate slide down and close
      setMobileActionsQuotation(null);
      setShowFolderSubMenu(false);
    }
    setDrawerTranslateY(0);
  };

  async function loadFolders() {
    if (!user) return;
    try {
      const folderList = await getFolders(user.uid);
      // Filter only quotation folders (either explicitly type === 'quotation' OR type is not set, for legacy folders)
      const quotationFolders = folderList.filter(f => !f.type || f.type === 'quotation');
      setFolders(quotationFolders);
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  }

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await createFolder({
        name: newFolderName.trim(),
        userId: user.uid,
        createdAt: new Date().toISOString(),
        type: 'quotation'
      } as any);
      setNewFolderName("");
      setShowAddFolderModal(false);
      showToast("Folder created successfully.", "success");
      await loadFolders();
    } catch (err) {
      showToast("Failed to create folder.", "error");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFolderToDelete({ id: folderId, name: folderName });
  };

  const executeDeleteFolder = async () => {
    if (!folderToDelete) return;
    const { id, name } = folderToDelete;
    setFolderToDelete(null);
    try {
      const quotationsInFolder = quotations.filter((q) => q.folderId === id);
      await Promise.all(
        quotationsInFolder.map((q) => updateQuotation(q.id, { folderId: "" }))
      );
      await deleteFolder(id);
      if (activeFolderId === id) {
        setActiveFolderId("all");
      }
      showToast(`Folder "${name}" deleted.`, "info");
      await loadFolders();
      await loadData();
    } catch (err) {
      showToast("Failed to delete folder.", "error");
    }
  };

  const moveQuotationToFolder = async (quotationId: string, targetFolderId: string | null) => {
    setMovingQuotationId(quotationId);
    try {
      await updateQuotation(quotationId, { folderId: targetFolderId || "" });
      setQuotations(prev => prev.map(item => item.id === quotationId ? { ...item, folderId: targetFolderId || "" } : item));
      const folderName = targetFolderId === "drafts" ? "Drafts" : (targetFolderId ? folders.find(f => f.id === targetFolderId)?.name || "Folder" : "All");
      showToast(`Moved to ${folderName} successfully.`, "success");
    } catch (err) {
      showToast("Failed to move quotation.", "error");
    } finally {
      setMovingQuotationId(null);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, quotation: Quotation) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const newPinnedState = !quotation.isPinned;
      await updateQuotation(quotation.id, { isPinned: newPinnedState });
      
      // Update local state and sort immediately
      setQuotations((prev) => {
        const updated = prev.map((item) => 
          item.id === quotation.id ? { ...item, isPinned: newPinnedState } : item
        );
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });
      
      showToast(newPinnedState ? "Quotation pinned to top!" : "Quotation unpinned.", "success");
    } catch (err) {
      showToast("Failed to update pin state.", "error");
    }
  };

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getQuotations(user.uid);
      const sortedData = data.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setQuotations(sortedData);
    } catch (err) {
      console.error("Failed to load quotations:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Delete (Triggers Custom Modal)
  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  // Actual Execution after custom modal confirmation
  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      await deleteQuotation(id);
      setQuotations(quotations.filter((q) => q.id !== id));
      showToast("Quotation deleted successfully.", "success");
    } catch (err) {
      showToast("Failed to delete quotation.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Duplicate
  const handleDuplicate = async (quotation: Quotation) => {
    if (!user) return;
    setDuplicatingId(quotation.id);
    try {
      const newNumber = `${quotation.number}-Copy`;
      const newCompanyName = `${quotation.clientDetails.companyName} (Copy)`;

      // Make a clean clone of the quotation object and explicitly delete the ID to prevent it from overwriting doc keys in Firestore!
      const duplicateData = JSON.parse(JSON.stringify(quotation));
      delete duplicateData.id;

      const duplicated: Omit<Quotation, "id"> = {
        ...duplicateData,
        number: newNumber,
        clientDetails: {
          ...quotation.clientDetails,
          companyName: newCompanyName
        },
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
        status: "draft"
      };
      
      // Delete Google Drive links since this is a new draft
      delete (duplicated as any).driveUrl;
      delete (duplicated as any).driveFileId;

      await createQuotation(duplicated);
      await loadData();
      
      showToast(`Quotation ${newNumber} created as a draft!`, "success");

      if (typeof window !== "undefined") {
        import("canvas-confetti").then((module) => {
          module.default({
            particleCount: 50,
            spread: 45,
            origin: { y: 0.8 }
          });
        });
      }
    } catch (err) {
      showToast("Failed to duplicate quotation.", "error");
    } finally {
      setDuplicatingId(null);
    }
  };



  // Filters & Sorting (Most recently edited/created first)
  const filteredQuotations = quotations
    .filter((q) => {
      // 1. Filter by search query
      const searchLower = search.toLowerCase();
      const matchesSearch = (
        q.clientDetails.companyName.toLowerCase().includes(searchLower) ||
        q.clientDetails.subject.toLowerCase().includes(searchLower) ||
        q.number.toLowerCase().includes(searchLower)
      );
      
      if (!matchesSearch) return false;
      
      // 2. Filter by active folder
      if (activeFolderId === "all") {
        return true;
      } else if (activeFolderId === "drafts") {
        return q.status === "draft";
      } else {
        return q.folderId === activeFolderId;
      }
    })
    .sort((a, b) => {
      // Pinned items stay at top
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // Sort by most recently updated or created (most recent first)
      const timeA = new Date(a.updatedAt || a.createdAt || a.date).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || b.date).getTime();
      return timeB - timeA;
    });

  // Stats Calculations
  const totalRevenue = quotations.reduce((acc, curr) => acc + curr.grandTotal, 0);
  const driveSyncedCount = quotations.filter((q) => q.driveUrl).length;

  // Month-over-Month Analytics Calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const getYearMonth = (dateStr: string) => {
    const parts = dateStr.split("T")[0].split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // Convert 1-12 to 0-11
    return { year: y, month: m };
  };

  // 1. Current Month Quotations
  const currentMonthQuotations = quotations.filter((q) => {
    const { year, month } = getYearMonth(q.date);
    return year === currentYear && month === currentMonth;
  });

  // 2. Previous Month Date calculations
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonthQuotations = quotations.filter((q) => {
    const { year, month } = getYearMonth(q.date);
    return year === prevMonthYear && month === prevMonth;
  });

  // Quotation Count Metrics
  const curMonthCount = currentMonthQuotations.length;
  const prevMonthCount = prevMonthQuotations.length;
  
  // Calculate Quotation count percentage change
  let countChangePercent = 0;
  if (prevMonthCount > 0) {
    countChangePercent = Math.round(((curMonthCount - prevMonthCount) / prevMonthCount) * 100);
  } else if (curMonthCount > 0) {
    countChangePercent = 100; // 100% increase if last month was 0
  }

  // Revenue Metrics
  const curMonthRevenue = currentMonthQuotations.reduce((sum, q) => sum + q.grandTotal, 0);
  const prevMonthRevenue = prevMonthQuotations.reduce((sum, q) => sum + q.grandTotal, 0);

  // Calculate Revenue percentage change
  let revenueChangePercent = 0;
  if (prevMonthRevenue > 0) {
    revenueChangePercent = Math.round(((curMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
  } else if (curMonthRevenue > 0) {
    revenueChangePercent = 100;
  }

  // Synced Drive Metrics for Current Month
  const curMonthSynced = currentMonthQuotations.filter((q) => q.driveUrl).length;


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-semibold animate-pulse">Retrieving quotations dashboard...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1650px] mx-auto px-2 sm:px-4 lg:px-6 pt-16 pb-8 sm:py-8 space-y-7 sm:space-y-8 pb-24">
      {/* Dynamic Keyframes for mobile actions spring pop-out */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes mobilePopOut {
          from {
            opacity: 0;
            transform: translateY(-50%) scale(0.4) translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) scale(1) translateX(0);
          }
        }
        
        @media (max-width: 767px) {
          /* Hide mobile bottom navbar when bottom actions drawer is open */
          body.drawer-open .mobile-bottom-nav-container {
            opacity: 0 !important;
            transform: translateY(100%) !important;
            pointer-events: none !important;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease !important;
          }
          
          /* Blur the main sticky page header and the dashboard main content when bottom actions drawer is open */
          body.drawer-open header,
          body.drawer-open .dashboard-main-content {
            filter: blur(10px) !important;
            opacity: 0.35 !important;
            pointer-events: none !important;
            transition: filter 0.3s ease, opacity 0.3s ease !important;
          }
        }
      `}} />

      <div className="dashboard-main-content space-y-7 sm:space-y-8 transition-all duration-300">

        {/* Upper Brand Section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest animate-pulse select-none">
            <Sparkles className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
            <span>{(() => {
              const hour = new Date().getHours();
              const name = user?.displayName ? user.displayName.split(" ")[0] : "User";
              if (hour < 12) return `Good Morning, ${name} ☀️`;
              if (hour < 17) return `Good Afternoon, ${name} ☀️`;
              if (hour < 22) return `Good Evening, ${name} 🌙`;
              return `Good Night, ${name} 🌙`;
            })()}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Quotation Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage corporate accounts, review calculations, and monitor Google Drive uploads.</p>
        </div>
        
        <button
          onClick={onCreateNew}
          className="flex items-center justify-center gap-2 bg-[#E55A22] hover:bg-[#d44e19] text-white py-3 px-5 rounded-2xl font-bold cursor-pointer transition-all shadow-lg shadow-orange-500/20 scale-[1.01] active:scale-[0.99]"
        >
          <Plus className="w-5 h-5" />
          <span>New Quotation</span>
        </button>
      </div>

      {/* KPI Cards Grid - 3-column compact layout on mobile, spacious grid on desktop! */}
      {quotations.length === 0 ? (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-transparent to-blue-500/5 text-left relative overflow-hidden shadow-xl space-y-6 select-none">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200/60 dark:border-white/10 pb-6">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-black text-[#E55A22] dark:text-orange-400 uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Welcome to Quotation Portal</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Create Your First Commercial Quotation
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 font-medium leading-relaxed">
                Your quotation metrics, client records, custom letterhead previews, and Google Drive cloud archives will automatically populate here as soon as you generate your first document.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
              <button
                onClick={onCreateNew}
                className="flex items-center justify-center gap-2 bg-[#E55A22] hover:bg-[#d44e19] text-white font-extrabold py-3 px-5 rounded-2xl transition-all cursor-pointer shadow-lg shadow-orange-500/25 active:scale-98 text-xs uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                <span>New Quotation</span>
              </button>
            </div>
          </div>

          {/* 3 Interactive Highlight Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/5 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-[#E55A22] dark:text-orange-400 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">1. Professional PDFs</h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Generate A4 commercial proposals with auto GST and terms & conditions.</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/5 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#09357B] dark:text-blue-400 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">2. Revenue & CRM Tracking</h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Keep track of client company records, draft proposals, and financial figures.</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/5 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <FileCheck className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">3. Google Drive Auto-Sync</h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Instantly sync every compiled quotation to your personal Google Drive folder.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5 sm:gap-5 w-full">
          {/* Total Quotations */}
          <div className="glass-panel p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/20 dark:border-white/5 flex flex-col items-center sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shadow-sm hover:shadow-md transition-all select-none">
            <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 flex-1 w-full">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center text-[#E55A22] dark:text-orange-400 shrink-0">
                <FileSpreadsheet className="w-4.5 h-4.5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[9px] sm:text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider truncate">Quotations</p>
                <p className="text-sm sm:text-2xl font-black mt-0.5 leading-none text-slate-900 dark:text-white">{quotations.length}</p>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 sm:mt-1.5 text-[9px] sm:text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex-wrap">
                  <span className="hidden sm:inline truncate">{curMonthCount} this month</span>
                  <span className={cn(
                    "inline-flex items-center px-1 rounded font-bold text-[8px] sm:text-[10px] shrink-0",
                    countChangePercent >= 0 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                      : "bg-destructive/15 text-destructive"
                  )}>
                    {countChangePercent >= 0 ? `+${countChangePercent}%` : `${countChangePercent}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cumulative Total (Revenue) */}
          <div className="glass-panel p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/20 dark:border-white/5 flex flex-col items-center sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shadow-sm hover:shadow-md transition-all select-none">
            <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 flex-1 w-full">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <TrendingUp className="w-4.5 h-4.5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[9px] sm:text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider truncate">Revenue</p>
                <p className="text-sm sm:text-2xl font-black mt-0.5 leading-none text-slate-900 dark:text-white truncate">
                  <span className="sm:hidden">₹ {formatCurrency(Math.round(totalRevenue))}</span>
                  <span className="hidden sm:inline">₹ {formatCurrency(totalRevenue)}</span>
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 sm:mt-1.5 text-[9px] sm:text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex-wrap">
                  <span className="hidden sm:inline truncate">₹ {formatCurrency(curMonthRevenue)} this month</span>
                  <span className={cn(
                    "inline-flex items-center px-1 rounded font-bold text-[8px] sm:text-[10px] shrink-0",
                    revenueChangePercent >= 0 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                      : "bg-destructive/15 text-destructive"
                  )}>
                    {revenueChangePercent >= 0 ? `+${revenueChangePercent}%` : `${revenueChangePercent}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Synced to Drive */}
          <div className="glass-panel p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/20 dark:border-white/5 flex flex-col items-center sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shadow-sm hover:shadow-md transition-all select-none">
            <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 flex-1 w-full">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                <FileCheck className="w-4.5 h-4.5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[9px] sm:text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider truncate">Synced</p>
                <p className="text-sm sm:text-2xl font-black mt-0.5 leading-none text-slate-900 dark:text-white">{driveSyncedCount} / {quotations.length}</p>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 sm:mt-1.5 text-[9px] sm:text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex-wrap">
                  <span className="hidden sm:inline truncate">{curMonthSynced} synced this month</span>
                  <span className="inline-flex items-center px-1 rounded font-bold text-[8px] sm:text-[10px] bg-orange-500/10 text-[#E55A22] shrink-0">
                    {curMonthCount > 0 ? Math.round((curMonthSynced / curMonthCount) * 100) : 0}% rate
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <>
          {/* Search & Actions Panel */}
          <div className="flex items-center gap-3 select-none w-full pt-1.5 justify-between">
            <div className="relative w-full lg:max-w-md flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client name, subject, or quotation number..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-900/40 focus:border-[#E55A22] dark:focus:border-[#E55A22] focus:bg-white dark:focus:bg-zinc-900/80 outline-none transition-all text-slate-900 dark:text-white font-medium text-xs placeholder-slate-400 dark:placeholder-zinc-500 shadow-inner"
              />
            </div>

            {/* Desktop ViewMode Toggle */}
            <div className="hidden sm:flex shrink-0 relative group/tooltip">
              <button
                onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
                className="w-9 h-9 rounded-xl text-[#E55A22] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-[#E55A22] dark:hover:border-[#E55A22] transition-all duration-300 flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                aria-label="Toggle view layout"
              >
                {viewMode === "grid" ? (
                  <List className="w-4.5 h-4.5" />
                ) : (
                  <LayoutGrid className="w-4.5 h-4.5" />
                )}
              </button>
              {/* Custom designed premium tooltip */}
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-xl bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-2.5 py-1 text-[9px] text-white tooltip-text font-extrabold tracking-wide whitespace-nowrap z-50 shadow-2xl origin-bottom backdrop-blur-md">
                {viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
              </span>
            </div>
          </div>

      {/* Folders Navigation Bar (Drag & Drop Drop-zone Targets!) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#E55A22]" />
            <span>Workspace Folders</span>
          </h2>
          
          {/* Desktop Right Side: New Folder button only */}
          <div className="hidden sm:flex items-center">
            <button
              onClick={() => setShowAddFolderModal(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-[#E55A22] hover:text-[#E55A22]/80 transition-colors cursor-pointer bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1 rounded-lg border border-orange-500/20"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
          </div>

          {/* Mobile Right Side: Compact premium icon row for View Switcher + New Folder */}
          <div className="flex sm:hidden items-center gap-1.5">
            {/* New Folder Icon Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                onClick={() => setShowAddFolderModal(true)}
                className="p-2 rounded-xl text-[#E55A22] bg-orange-500/10 active:bg-orange-500/20 border border-orange-500/20 transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-900/90 border border-white/10 px-2.5 py-1 text-[9px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                New Folder
              </span>
            </div>

            {/* Premium View Mode Toggle Button */}
            <div className="relative group/tooltip flex items-center justify-center">
              <button
                onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground bg-muted/40 active:bg-muted/80 border border-border/20 transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              >
                {viewMode === "grid" ? (
                  <List className="w-4 h-4" />
                ) : (
                  <LayoutGrid className="w-4.5 h-4.5" />
                )}
              </button>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-900/90 border border-white/10 px-2.5 py-1 text-[9px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                {viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
              </span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-3 sm:overflow-x-auto sm:pt-2 sm:pb-7 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 sm:-mx-4 sm:px-4 md:mx-0 md:px-0">
          {/* All Folder */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDraggedOverFolderId("all");
            }}
            onDragLeave={() => setDraggedOverFolderId(null)}
            onDrop={async (e) => {
              e.preventDefault();
              setDraggedOverFolderId(null);
              const quotationId = e.dataTransfer.getData("text/plain");
              if (quotationId) {
                await moveQuotationToFolder(quotationId, null);
              }
            }}
            onClick={() => setActiveFolderId("all")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none sm:shrink-0 w-full sm:w-auto sm:min-w-[130px] relative shadow-sm group/all",
              activeFolderId === "all"
                ? "bg-[#E55A22] text-white border-[#E55A22] shadow-lg shadow-orange-500/20 scale-[1.01]"
                : "bg-background/40 hover:bg-muted/40 border-border/40 text-foreground hover:-translate-y-0.5 hover:border-orange-500/45 hover:shadow-md hover:shadow-orange-500/5",
              draggedOverFolderId === "all" && "border-dashed border-orange-500 ring-2 ring-orange-500/40 bg-orange-500/10 scale-[1.03]"
            )}
          >
            <Folder className={cn("w-4.5 h-4.5 shrink-0 transition-transform duration-300", activeFolderId === "all" ? "" : "group-hover/all:scale-110 group-hover/all:rotate-3")} />
            <div className="text-left min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight truncate">All Quotations</p>
              <p className={cn("text-[10px] font-semibold mt-0.5", activeFolderId === "all" ? "text-white/80" : "text-muted-foreground")}>
                {quotations.length} files
              </p>
            </div>
          </div>

          {/* Drafts Folder */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDraggedOverFolderId("drafts-blocked");
            }}
            onDragLeave={() => setDraggedOverFolderId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDraggedOverFolderId(null);
              showToast("Cannot move quotations here. Drafts folder is updated automatically based on status.", "error");
            }}
            onClick={() => setActiveFolderId("drafts")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none sm:shrink-0 w-full sm:w-auto sm:min-w-[130px] relative shadow-sm group/drafts",
              activeFolderId === "drafts"
                ? "bg-[#E55A22] text-white border-[#E55A22] shadow-lg shadow-orange-500/20 scale-[1.01]"
                : "bg-background/40 hover:bg-muted/40 border-border/40 text-foreground hover:-translate-y-0.5 hover:border-orange-500/45 hover:shadow-md hover:shadow-orange-500/5",
              draggedOverFolderId === "drafts-blocked" && "border-dashed border-destructive ring-2 ring-destructive/40 bg-destructive/10 text-destructive scale-[1.03]"
            )}
          >
            <FileText className={cn("w-4.5 h-4.5 shrink-0 transition-transform duration-300", activeFolderId === "drafts" ? "" : "group-hover/drafts:scale-110 group-hover/drafts:rotate-3")} />
            <div className="text-left min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight truncate">Drafts</p>
              <p className={cn("text-[10px] font-semibold mt-0.5", activeFolderId === "drafts" ? "text-white/80" : "text-muted-foreground")}>
                {quotations.filter(q => q.status === "draft").length} files
              </p>
            </div>
          </div>

          {/* Custom User Folders */}
          {folders.map((folder, index) => {
            const count = quotations.filter(q => q.folderId === folder.id).length;
            const isActive = activeFolderId === folder.id;
            const isDraggedOver = draggedOverFolderId === folder.id;
            
            // On mobile, if not expanded, only show up to 2 custom folders (total 4 cards visible: All + Drafts + Custom 1 + Custom 2)
            const isHiddenOnMobile = !showAllFoldersOnMobile && index >= 2;
            
            return (
              <div
                key={folder.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDraggedOverFolderId(folder.id);
                }}
                onDragLeave={() => setDraggedOverFolderId(null)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDraggedOverFolderId(null);
                  const quotationId = e.dataTransfer.getData("text/plain");
                  if (quotationId) {
                    await moveQuotationToFolder(quotationId, folder.id);
                  }
                }}
                onClick={() => setActiveFolderId(folder.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none sm:shrink-0 w-full sm:w-auto sm:min-w-[140px] relative group/folder shadow-sm",
                  isActive
                    ? "bg-[#E55A22] text-white border-[#E55A22] shadow-lg shadow-orange-500/20 scale-[1.01]"
                    : "bg-background/40 hover:bg-muted/40 border-border/40 text-foreground hover:-translate-y-0.5 hover:border-orange-500/45 hover:shadow-md hover:shadow-orange-500/5",
                  isDraggedOver && "border-dashed border-orange-500 ring-2 ring-orange-500/40 bg-orange-500/10 scale-[1.03]",
                  isHiddenOnMobile && "hidden sm:flex"
                )}
              >
                <Folder className={cn("w-4.5 h-4.5 text-amber-500 shrink-0 transition-transform duration-300", isActive ? "text-amber-200" : "group-hover/folder:scale-110 group-hover/folder:rotate-3")} />
                <div className="text-left min-w-0 flex-1 pr-4">
                  <p className="text-xs font-bold leading-tight truncate">{folder.name}</p>
                  <p className={cn("text-[10px] font-semibold mt-0.5", isActive ? "text-white/80" : "text-muted-foreground")}>
                    {count} files
                  </p>
                </div>
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 group/tooltip">
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, folder.name, e)}
                    className={cn(
                      "p-1 rounded-md opacity-100 sm:opacity-0 sm:group-hover/folder:opacity-100 transition-all hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer",
                      isActive ? "text-white hover:text-white" : "text-muted-foreground hover:text-destructive"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-2.5 py-1 text-[9px] text-white tooltip-text font-extrabold tracking-wide whitespace-nowrap z-50 shadow-xl origin-top backdrop-blur-sm normal-case">
                    Delete Folder
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Show More/Less Folders Toggle - Centered chevron button */}
        {folders.length > 2 && (
          <div className="flex sm:hidden justify-center pt-1.5 w-full">
            <button
              type="button"
              onClick={() => setShowAllFoldersOnMobile(!showAllFoldersOnMobile)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09357B]/5 dark:bg-blue-500/5 hover:bg-[#09357B]/10 dark:hover:bg-blue-500/10 text-[#09357B] dark:text-blue-400 border border-primary/10 text-[10px] font-extrabold uppercase tracking-wide transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <span>{showAllFoldersOnMobile ? "Show Less" : `Show More (${folders.length - 2} ${folders.length - 2 === 1 ? "folder" : "folders"})`}</span>
              {showAllFoldersOnMobile ? (
                <ChevronUp className="w-3 h-3 text-[#09357B] dark:text-blue-400 shrink-0" />
              ) : (
                <ChevronDown className="w-3 h-3 text-[#09357B] dark:text-blue-400 shrink-0" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Main Table / Mobile Cards Container (Blocked dropzone detector) */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedOverFolderId !== "blocked" && draggedOverFolderId !== "all" && draggedOverFolderId !== "drafts" && !folders.some(f => f.id === draggedOverFolderId)) {
            setDraggedOverFolderId("blocked");
          }
        }}
        onDragLeave={() => setDraggedOverFolderId(null)}
        className={cn(
          "w-full transition-all duration-300 rounded-3xl p-1",
          draggedOverFolderId === "blocked" && "ring-2 ring-destructive/40 bg-destructive/5"
        )}
      >
        {/* Main Table / Mobile Cards */}
        {filteredQuotations.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-white/20 dark:border-white/5 flex flex-col items-center justify-center gap-4">
          <FileText className="w-12 h-12 text-muted-foreground animate-bounce" />
          <div>
            <h3 className="font-bold text-lg">No Quotations Found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try expanding your search query or generate your first quotation banner.</p>
          </div>
          <button
            onClick={onCreateNew}
            className="bg-orange-500/10 hover:bg-[#E55A22] hover:text-white border border-orange-500/20 text-[#E55A22] py-2.5 px-5 rounded-xl font-bold cursor-pointer transition-all"
          >
            Create Quotation Now
          </button>
        </div>
      ) : (
        <>
          {/* Canva Card Grid View */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {filteredQuotations.map((q, index) => (
                <div
                  key={`${q.id}-${index}`}
                  id={`quotation-${q.id}`}
                  draggable={true}
                  onDragEnd={() => {
                    setDraggableQuotationId(null);
                    setDraggedOverFolderId(null);
                  }}
                  onClick={(e) => {
                    // Single click to open/edit!
                    onEdit(q);
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", q.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className={cn(
                    "glass-panel rounded-3xl border border-white/20 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md shadow-sm flex flex-col transition-all hover:-translate-y-1.5 hover:shadow-xl relative group cursor-pointer",
                    highlightId === q.id ? "animate-shake ring-2 ring-violet-500 shadow-lg shadow-violet-500/30" : ""
                  )}
                >
                  {/* Aspect Ratio Document Preview Header Container */}
                  <div className="aspect-[4/3] w-full bg-gradient-to-tr from-orange-600/10 via-amber-500/5 to-orange-500/10 dark:from-orange-950/20 dark:to-amber-950/20 relative flex items-center justify-center p-4 border-b border-border/10 overflow-hidden rounded-t-[22px]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(14,165,233,0.15),transparent_50%),radial-gradient(circle_at_0%_0%,rgba(99,102,241,0.1),transparent_40%)]" />
                    
                    {/* The Micro A4 Sheet CSS representation */}
                    <div className="w-[80px] sm:w-[110px] h-[110px] sm:h-[150px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg shadow-lg relative p-1 sm:p-2 flex flex-col justify-between overflow-hidden scale-[1.02] sm:scale-[1.05] group-hover:scale-[1.1] transition-transform duration-300 origin-center select-none pointer-events-none">
                      {/* Micro Header */}
                      <div className="w-full flex items-center justify-between mb-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-1 shrink-0">
                        <div className="flex items-center gap-0.5">
                          <div className="w-2 h-2 rounded bg-[#E55A22] flex items-center justify-center text-[5px] text-white font-black">D</div>
                          <div className="w-8 h-1 bg-zinc-800 dark:bg-zinc-200 rounded" />
                        </div>
                        <div className="w-5 h-1 bg-zinc-400 dark:bg-zinc-600 rounded" />
                      </div>

                      {/* Micro Recipient */}
                      <div className="space-y-1 mb-1.5 shrink-0">
                        <div className="w-[60%] h-1 bg-zinc-300 dark:bg-zinc-700 rounded" />
                        <div className="w-[45%] h-[3px] bg-zinc-200 dark:bg-zinc-800 rounded" />
                        <div className="w-[70%] h-[3px] bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </div>

                      {/* Micro Table */}
                      <div className="border border-zinc-100 dark:border-zinc-800 rounded-sm overflow-hidden flex-1 mb-1.5 flex flex-col">
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 px-1 py-[1.5px] border-b border-zinc-100 dark:border-zinc-800 flex justify-between shrink-0">
                          <div className="w-8 h-[2px] bg-zinc-400 dark:bg-zinc-600 rounded-sm" />
                          <div className="w-4 h-[2px] bg-zinc-400 dark:bg-zinc-600 rounded-sm" />
                        </div>
                        <div className="p-1 space-y-1 flex-1 flex flex-col justify-start">
                          <div className="flex justify-between items-center shrink-0">
                            <div className="w-10 h-0.5 bg-zinc-200 dark:bg-zinc-700 rounded" />
                            <div className="w-3 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
                          </div>
                          <div className="flex justify-between items-center shrink-0">
                            <div className="w-7 h-0.5 bg-zinc-200 dark:bg-zinc-700 rounded" />
                            <div className="w-4 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
                          </div>
                          <div className="flex justify-between items-center shrink-0">
                            <div className="w-[32px] h-0.5 bg-zinc-200 dark:bg-zinc-700 rounded" />
                            <div className="w-2.5 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
                          </div>
                        </div>
                      </div>

                      {/* Micro Totals & Signature */}
                      <div className="flex justify-between items-end border-t border-zinc-100 dark:border-zinc-800 pt-1 shrink-0">
                        <div className="space-y-0.5">
                          <div className="w-6 h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded" />
                          <div className="w-[18px] h-1 bg-[#E55A22]/75 rounded" />
                        </div>
                        <div className="flex flex-col items-center">
                          <svg className="w-6 h-2 text-[#E55A22] shrink-0 opacity-70" viewBox="0 0 24 8" fill="none" stroke="currentColor" strokeWidth="0.8">
                            <path d="M2 5c2-3 4-1 6-3s3 4 5 1 4-3 6-1 2 2 3-1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="w-8 h-[1px] bg-zinc-300 dark:bg-zinc-700" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pinned Star Toggle Button */}
                  <div className="absolute top-2.5 left-2.5 z-20 group/tooltip">
                    <button
                      onClick={(e) => handleTogglePin(e, q)}
                      className={cn(
                        "p-1.5 rounded-xl border shadow-sm transition-all cursor-pointer",
                        q.isPinned
                          ? "bg-amber-500 text-white border-amber-500 scale-100 opacity-100"
                          : "bg-background/80 hover:bg-background border-border/10 text-muted-foreground hover:text-amber-500 scale-95 opacity-0 group-hover:opacity-100 hover:scale-100"
                      )}
                    >
                      <Star className={cn("w-4 h-4", q.isPinned && "fill-current")} />
                    </button>
                    {/* Custom designed premium tooltip */}
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-2.5 py-1 text-[9px] text-white font-extrabold tracking-wide whitespace-nowrap z-50 shadow-xl origin-bottom backdrop-blur-sm">
                      {q.isPinned ? "Unpin from Top" : "Pin to Top"}
                    </span>
                  </div>

                  {/* Absolute menu trigger */}
                  <div className="absolute top-2.5 right-2.5 z-20 group/tooltip">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowFolderSubMenu(false);
                        setMobileActionsQuotation(mobileActionsQuotation?.id === q.id ? null : q);
                      }}
                      className={`actions-trigger-btn p-1.5 rounded-xl border shadow-sm transition-all cursor-pointer ${
                        mobileActionsQuotation?.id === q.id 
                          ? "bg-[#E55A22] text-white border-[#E55A22]" 
                          : "bg-background/80 hover:bg-background border-border/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {/* Custom designed premium tooltip */}
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-2.5 py-1 text-[9px] text-white font-extrabold tracking-wide whitespace-nowrap z-50 shadow-xl origin-bottom backdrop-blur-sm">
                      More Actions
                    </span>
                  </div>

                  {/* Card Content body */}
                  <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 flex-1 flex flex-col justify-between relative">
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-1 sm:gap-2">
                        <span className="text-[8px] sm:text-[9px] font-mono font-bold bg-orange-500/10 dark:bg-orange-500/20 text-[#E55A22] dark:text-orange-400 px-1.5 sm:px-2 py-0.5 rounded shrink-0">
                          {q.number}
                        </span>
                        
                        {/* Folder Badge Indicator with Tooltip */}
                        {q.folderId && q.folderId !== "drafts" && (
                          <div className="relative group/tooltip flex items-center gap-0.5 sm:gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold min-w-0 shrink-0 select-none">
                            <Folder className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 text-amber-500" />
                            <span className="truncate max-w-[45px] sm:max-w-[65px]">
                              {folders.find(f => f.id === q.folderId)?.name || "Folder"}
                            </span>
                            
                            {/* Visual Tooltip */}
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-900/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[10px] text-white whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                              Folder: {folders.find(f => f.id === q.folderId)?.name || "Custom"}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <h4 className="font-extrabold text-[12px] sm:text-[14px] leading-snug text-foreground tracking-tight group-hover:text-[#E55A22] transition-colors mt-1.5 sm:mt-2 flex items-center gap-1.5">
                        <span className="truncate">{q.clientDetails.companyName}</span>
                        {q.isAiGenerated && (
                          <div className="relative group/tooltip inline-flex items-center">
                            <div className="flex shrink-0 items-center justify-center bg-orange-500/10 text-orange-500 rounded-md p-0.5 cursor-default">
                              <Sparkles className="w-3 h-3" />
                            </div>
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-800/95 border border-white/10 px-2.5 py-1 text-[10px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                              Generated with AI Wizard
                            </span>
                          </div>
                        )}
                      </h4>
                      <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground line-clamp-1">
                        {q.clientDetails.subject}
                      </p>
 
                      {/* Canva-style A4 relative time metadata */}
                      <div className="flex items-center gap-1 sm:gap-1.5 mt-1 text-[8px] sm:text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        <span className="inline-flex items-center justify-center px-0.5 sm:px-1 py-0.5 bg-orange-500/10 text-[#E55A22] text-[7px] sm:text-[8px] rounded font-black tracking-normal">A4</span>
                        <span>•</span>
                        <span className="normal-case font-semibold text-muted-foreground/85 truncate max-w-[90px] sm:max-w-none">
                          Edited {formatRelativeTime(q.updatedAt || q.createdAt || q.date)}
                        </span>
                      </div>
                    </div>
 
                    <div className="flex items-center justify-between border-t border-border/20 pt-2 sm:pt-3 mt-0.5 sm:mt-1 shrink-0">
                      <p className="font-mono font-black text-xs sm:text-sm text-foreground">₹ {formatCurrency(q.grandTotal)}</p>
                      
                      {q.driveUrl ? (
                        <a 
                          href={q.driveUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-[8px] sm:text-[10px] font-bold shrink-0 hover:bg-emerald-500/20 transition-colors"
                        >
                          <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                          <span>Synced</span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-[8px] sm:text-[10px] font-bold shrink-0">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Popover Bubble Menu relative to the card container (direct child!) */}
                  {mobileActionsQuotation?.id === q.id && (
                    <div className="hidden md:block">
                      <div 
                        className="fixed inset-0 z-30" 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setMobileActionsQuotation(null);
                        }} 
                      />
                      
                      <div 
                        className="absolute right-2.5 top-11 z-40 bg-background/95 dark:bg-zinc-900/95 border border-white/20 dark:border-white/10 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl flex flex-col gap-0.5 min-w-[185px] text-left animate-in fade-in zoom-in-95 duration-150 actions-menu-container"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                      >
                        {!showFolderSubMenu ? (
                          <>
                            {q.driveFileId && (
                              <>
                                <button
                                  onClick={() => { triggerShare(q, "whatsapp"); setMobileActionsQuotation(null); }}
                                  disabled={sharingState !== null}
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {sharingState === "whatsapp" && activeQuotation?.id === q.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>WhatsApp</span>
                                </button>

                                <button
                                  onClick={() => { triggerShare(q, "email"); setMobileActionsQuotation(null); }}
                                  disabled={sharingState !== null}
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {sharingState === "email" && activeQuotation?.id === q.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>Email</span>
                                </button>

                                <button
                                  onClick={() => { triggerShare(q, "share"); setMobileActionsQuotation(null); }}
                                  disabled={sharingState !== null}
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {sharingState === "share" && activeQuotation?.id === q.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Share2 className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>Universal Share</span>
                                </button>

                                <button
                                  onClick={() => { triggerShare(q, "download"); setMobileActionsQuotation(null); }}
                                  disabled={sharingState !== null}
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {sharingState === "download" && activeQuotation?.id === q.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>Download PDF</span>
                                </button>

                                <div className="h-[1px] bg-border/20 my-1 shrink-0" />
                              </>
                            )}

                            <button
                              onClick={() => { handleDuplicate(q); setMobileActionsQuotation(null); }}
                              disabled={duplicatingId === q.id}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {duplicatingId === q.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>Duplicate</span>
                            </button>

                            <button
                              onClick={() => { onEdit(q); setMobileActionsQuotation(null); }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-[#E55A22] hover:bg-orange-500/10 rounded-xl transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 shrink-0" />
                              <span>Edit Quotation</span>
                            </button>

                             {/* Move / Remove Folder options */}
                             {q.folderId && q.folderId !== "drafts" ? (
                               <>
                                 <button
                                   onClick={async () => {
                                     await moveQuotationToFolder(q.id, null);
                                     setMobileActionsQuotation(null);
                                   }}
                                   className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                                 >
                                   <FolderMinus className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                   <span>Remove from Folder</span>
                                 </button>
                                 
                                 <button
                                   onClick={() => setShowFolderSubMenu(true)}
                                   className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-500 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer"
                                 >
                                   <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                   <span>Change Folder</span>
                                 </button>
                               </>
                             ) : (
                               <button
                                 onClick={() => setShowFolderSubMenu(true)}
                                 className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-500 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer"
                               >
                                 <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                 <span>Move to Folder</span>
                               </button>
                             )}

                            <button
                              onClick={() => { handleDelete(q.id); setMobileActionsQuotation(null); }}
                              disabled={deletingId === q.id}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {deletingId === q.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>Delete</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Scrollable list of folder destinations */}
                            <button
                              onClick={() => setShowFolderSubMenu(false)}
                              className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer border-b border-border/10 pb-1.5 mb-1 shrink-0"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                              </svg>
                              <span>Back</span>
                            </button>

                            <button
                              onClick={async () => {
                                await moveQuotationToFolder(q.id, null);
                                setMobileActionsQuotation(null);
                              }}
                              className={cn(
                                "flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer",
                                !q.folderId ? "bg-orange-500/10 text-[#E55A22] font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <Folder className="w-3.5 h-3.5 shrink-0" />
                                <span>All Quotations</span>
                              </span>
                              {!q.folderId && <CheckCircle className="w-3 h-3 text-[#E55A22] shrink-0" />}
                            </button>

                            {folders.length > 0 && <div className="h-[1px] bg-border/20 my-1 shrink-0" />}

                            <div className="max-h-[160px] overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                              {folders.map((f) => (
                                <button
                                  key={f.id}
                                  onClick={async () => {
                                    await moveQuotationToFolder(q.id, f.id);
                                    setMobileActionsQuotation(null);
                                  }}
                                  className={cn(
                                    "flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer",
                                    q.folderId === f.id ? "bg-orange-500/10 text-[#E55A22] font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                  )}
                                >
                                  <span className="flex items-center gap-2 truncate pr-2">
                                    <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span className="truncate">{f.name}</span>
                                  </span>
                                  {q.folderId === f.id && <CheckCircle className="w-3 h-3 text-[#E55A22] shrink-0" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-hidden rounded-3xl border border-border/40 glass-panel shadow-md animate-in fade-in duration-200">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="px-6 py-4">Ref Number</th>
                      <th className="px-6 py-4">Client Company</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Grand Total</th>
                      <th className="px-6 py-4 text-center">Cloud Sync</th>
                      <th className="px-6 py-4 text-right pr-8">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-sm">
                    {filteredQuotations.map((q, index) => (
                      <tr 
                        key={`${q.id}-${index}`} 
                        id={`quotation-${q.id}`}
                        className={cn(
                          "hover:bg-muted/30 transition-all cursor-pointer",
                          highlightId === q.id ? "animate-shake bg-violet-100/50 dark:bg-violet-900/20 shadow-[inset_4px_0_0_0_#8b5cf6]" : ""
                        )}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", q.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => onEdit(q)}
                      >
                        <td className="px-6 py-4 font-mono font-bold text-foreground">
                          {q.number}
                        </td>
                        <td className="px-6 py-4 font-bold text-foreground max-w-[200px] truncate">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{q.clientDetails.companyName}</span>
                            {q.isAiGenerated && (
                              <div className="relative group/tooltip inline-flex items-center">
                                <div className="flex shrink-0 items-center justify-center bg-orange-500/10 text-orange-500 rounded-md p-1 cursor-default">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </div>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-800/95 border border-white/10 px-2.5 py-1 text-[10px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                                  Generated with AI Wizard
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-muted-foreground max-w-[200px] truncate">
                          {q.clientDetails.subject}
                        </td>
                        <td className="px-6 py-4 font-medium text-muted-foreground shrink-0">
                          {formatDate(q.date)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-foreground">
                          ₹ {formatCurrency(q.grandTotal)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {q.driveUrl ? (
                            <a 
                              href={q.driveUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold transition-all cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Synced</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right pr-6 shrink-0">
                          <div className="flex justify-end gap-1.5">
                            {/* Whatsapp Share Link */}
                            {q.driveFileId && (
                              <div className="relative group">
                                <button
                                  onClick={(e) => { e.stopPropagation(); triggerShare(q, "whatsapp"); }}
                                  disabled={sharingState !== null}
                                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                                >
                                  {sharingState === "whatsapp" && activeQuotation?.id === q.id ? (
                                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                  ) : (
                                    <MessageCircle className="w-4.5 h-4.5" />
                                  )}
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-all duration-150 rounded-lg bg-zinc-900/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[11px] text-white whitespace-nowrap z-50 shadow-xl origin-bottom font-bold tracking-wide backdrop-blur-sm">
                                  Share on WhatsApp
                                </span>
                              </div>
                            )}

                            {/* Email Share Link */}
                            {q.driveFileId && (
                              <div className="relative group">
                                <button
                                  onClick={(e) => { e.stopPropagation(); triggerShare(q, "email"); }}
                                  disabled={sharingState !== null}
                                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                                >
                                  {sharingState === "email" && activeQuotation?.id === q.id ? (
                                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                  ) : (
                                    <Mail className="w-4.5 h-4.5" />
                                  )}
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-all duration-150 rounded-lg bg-zinc-900/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[11px] text-white whitespace-nowrap z-50 shadow-xl origin-bottom font-bold tracking-wide backdrop-blur-sm">
                                  Share via Email
                                </span>
                              </div>
                            )}

                            {/* Share Physical PDF File */}
                            {q.driveFileId && (
                              <div className="relative group">
                                <button
                                  onClick={(e) => { e.stopPropagation(); triggerShare(q, "share"); }}
                                  disabled={sharingState !== null}
                                  className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                                >
                                  {sharingState === "share" && activeQuotation?.id === q.id ? (
                                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                  ) : (
                                    <Share2 className="w-4.5 h-4.5" />
                                  )}
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-all duration-150 rounded-lg bg-zinc-900/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[11px] text-white whitespace-nowrap z-50 shadow-xl origin-bottom font-bold tracking-wide backdrop-blur-sm">
                                  Share PDF Document
                                </span>
                              </div>
                            )}

                            {/* Download PDF */}
                            {q.driveFileId && (
                              <div className="relative group">
                                <button
                                  onClick={(e) => { e.stopPropagation(); triggerShare(q, "download"); }}
                                  disabled={sharingState !== null}
                                  className="p-2 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                                >
                                  {sharingState === "download" && activeQuotation?.id === q.id ? (
                                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                  ) : (
                                    <Download className="w-4.5 h-4.5" />
                                  )}
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-all duration-150 rounded-lg bg-zinc-900/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[11px] text-white whitespace-nowrap z-50 shadow-xl origin-bottom font-bold tracking-wide backdrop-blur-sm">
                                  Download PDF Document
                                </span>
                              </div>
                            )}

                            {/* Duplicate */}
                            <div className="relative group">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDuplicate(q); }}
                                disabled={duplicatingId === q.id}
                                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                              >
                                {duplicatingId === q.id ? (
                                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                ) : (
                                  <Copy className="w-4.5 h-4.5" />
                                )}
                              </button>
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-all duration-150 rounded-lg bg-zinc-900/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[11px] text-white whitespace-nowrap z-50 shadow-xl origin-bottom font-bold tracking-wide backdrop-blur-sm">
                                Duplicate Quotation
                              </span>
                            </div>

                            {/* Edit */}
                            <div className="relative group">
                              <button
                                onClick={(e) => { e.stopPropagation(); onEdit(q); }}
                                className="p-2 text-[#E55A22] hover:bg-orange-500/10 rounded-xl transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                              >
                                <Edit3 className="w-4.5 h-4.5" />
                              </button>
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-all duration-150 rounded-lg bg-zinc-900/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[11px] text-white whitespace-nowrap z-50 shadow-xl origin-bottom font-bold tracking-wide backdrop-blur-sm">
                                Edit Quotation
                              </span>
                            </div>

                            {/* Delete */}
                            <div className="relative group">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                                disabled={deletingId === q.id}
                                className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                              >
                                {deletingId === q.id ? (
                                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4.5 h-4.5" />
                                )}
                              </button>
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-all duration-150 rounded-lg bg-zinc-900/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[11px] text-white whitespace-nowrap z-50 shadow-xl origin-bottom font-bold tracking-wide backdrop-blur-sm">
                                Delete Quotation
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Canva List View (since a table would break screens on mobile!) */}
              <div className="md:hidden flex flex-col gap-2.5 animate-in fade-in duration-200">
                {filteredQuotations.map((q, index) => (
                  <div
                    key={`${q.id}-${index}-mobile-list`}
                    id={`quotation-${q.id}`}
                    draggable={true}
                    onDragEnd={() => {
                      setDraggableQuotationId(null);
                      setDraggedOverFolderId(null);
                    }}
                    onClick={(e) => {
                      onEdit(q);
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", q.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn(
                      "glass-panel rounded-2xl border border-white/20 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md p-3 flex items-center gap-3 relative cursor-pointer hover:bg-muted/40 transition-all shadow-sm select-none",
                      highlightId === q.id ? "animate-shake ring-2 ring-violet-500 shadow-lg shadow-violet-500/30" : ""
                    )}
                  >
                    {/* Pinned Star Toggle Button */}
                    <div className="absolute -top-1 -left-1 z-20">
                      <button
                        onClick={(e) => handleTogglePin(e, q)}
                        className={cn(
                          "p-1 rounded-lg border border-border/10 shadow-md transition-all cursor-pointer",
                          q.isPinned
                            ? "bg-amber-500 text-white border-amber-500 scale-100 opacity-100"
                            : "bg-background/95 dark:bg-zinc-900/95 text-muted-foreground hover:text-amber-500 opacity-60 active:opacity-100 scale-90"
                        )}
                      >
                        <Star className={cn("w-3 h-3", q.isPinned && "fill-current")} />
                      </button>
                    </div>

                    {/* Small document preview container on the left */}
                    <div className="w-[50px] h-[65px] bg-gradient-to-tr from-orange-600/10 via-amber-500/5 to-orange-500/10 dark:from-orange-950/20 dark:to-amber-950/20 rounded-lg flex items-center justify-center relative overflow-hidden shrink-0 border border-border/10">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(14,165,233,0.15),transparent_50%)]" />
                      
                      {/* Miniature CSS A4 Page */}
                      <div className="w-[32px] h-[45px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded shadow-md relative p-0.5 flex flex-col justify-between overflow-hidden scale-[1.05] pointer-events-none select-none">
                        {/* Micro Top Header */}
                        <div className="w-full flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-[1px] shrink-0 mb-[1px]">
                          <div className="w-1 h-1 bg-[#E55A22] rounded-full animate-pulse" />
                          <div className="w-3 h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                        </div>
                        
                        {/* Micro lines representing details */}
                        <div className="space-y-[1px] flex-1 flex flex-col justify-center">
                          <div className="w-[80%] h-[1.5px] bg-zinc-400 dark:bg-zinc-650 rounded-full" />
                          <div className="w-[50%] h-[1px] bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                        </div>
                        
                        {/* Micro Footer Signature */}
                        <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-[1px] shrink-0">
                          <div className="w-2 h-[1px] bg-primary/75" />
                          <div className="w-1.5 h-[1.5px] bg-zinc-350 dark:bg-zinc-700 rounded-full" />
                        </div>
                      </div>
                    </div>

                    {/* Middle Details Block */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
                      <h4 className="font-extrabold text-xs text-foreground leading-tight truncate">
                        {q.clientDetails.companyName}
                      </h4>
                      <p className="text-[10px] font-semibold text-muted-foreground truncate leading-normal">
                        {q.clientDetails.subject}
                      </p>
                      
                      {/* Meta row: badges and time */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[7px] font-mono font-bold bg-[#09357B]/10 dark:bg-blue-500/10 text-[#09357B] dark:text-blue-400 px-1 py-0.2 rounded shrink-0">
                          {q.number}
                        </span>
                        
                        {/* Folder Badge Indicator */}
                        {q.folderId && q.folderId !== "drafts" && (
                           <div className="flex items-center gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded text-[7px] font-bold shrink-0">
                             <Folder className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                             <span className="truncate max-w-[50px]">{folders.find(f => f.id === q.folderId)?.name || "Folder"}</span>
                           </div>
                        )}
                        
                        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                          A4
                        </span>
                        <span className="text-[8px] font-semibold text-muted-foreground/80 lowercase truncate">
                          • edited {formatRelativeTime(q.updatedAt || q.createdAt || q.date)}
                        </span>
                      </div>
                    </div>

                    {/* Right side: Grand total & Action verticaldots trigger */}
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-mono font-black text-xs text-foreground">₹{formatCurrency(q.grandTotal)}</p>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setShowFolderSubMenu(false);
                          setMobileActionsQuotation(mobileActionsQuotation?.id === q.id ? null : q);
                        }}
                        className="actions-trigger-btn p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all active:scale-95 shrink-0"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      </div>
    </>
  </div>
      {/* Hidden Offscreen Container for Dynamic on-the-fly PDF Generation */}
      {activeQuotation && adminSettings && (
        <div style={{ position: "absolute", top: "-9999px", left: "-9999px", pointerEvents: "none", zIndex: -1000 }}>
          <QuotationPreview 
            quotation={activeQuotation} 
            settings={adminSettings} 
          />
        </div>
      )}

      {/* Advanced Desktop Share Modal */}
      <ShareActionsModal
        isOpen={modalOpen}
        onClose={closeModal}
        quotation={activeQuotation}
        downloadUrl={tempUrl}
        onDownloadLocal={async () => {
          if (!activeQuotation || !adminSettings) return;
          try {
            showToast("Generating local A4 PDF download...", "info");
            const pdfBlob = await generatePdfBlob("quotation-pdf-container", {
              isCustomized: isSettingsCustomized(adminSettings),
              themeColor: "quotation"
            });
            downloadPdf(pdfBlob, `Quotation_${activeQuotation.number}.pdf`);
            showToast("PDF downloaded locally successfully!", "success");
          } catch (err) {
            console.error(err);
            showToast("Failed to compile local PDF download.", "error");
          }
        }}
      />



      {/* Premium Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/75 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 p-6 sm:p-8 rounded-[28px] text-center shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto border-2 border-red-500/20 shadow-lg mb-5">
              <AlertCircle className="w-7 h-7 animate-pulse text-red-500" />
            </div>
            
            <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Delete Quotation?
            </h3>
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">
              Are you sure you want to permanently delete this quotation? This action is irreversible and the document records will be erased.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Folder Modal Dialog */}
      {showAddFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/75 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={handleAddFolder}
            className="w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 p-6 sm:p-8 rounded-[28px] space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white"
          >
            <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center text-[#E55A22] mx-auto border-2 border-orange-500/20 shadow-lg mb-2">
              <FolderPlus className="w-7 h-7 animate-pulse text-[#E55A22]" />
            </div>
            
            <div className="space-y-2 text-center">
              <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Create New Folder
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">
                Add a custom category to group related quotations. You can drag and drop quotation cards directly into this folder.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 block">Folder Name</label>
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Ankleshwar, Mata Prasad, May 2026..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-black/40 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E55A22] outline-none transition-all"
                autoFocus
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowAddFolderModal(false); setNewFolderName(""); }}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingFolder || !newFolderName.trim()}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold bg-[#E55A22] hover:bg-[#d44e19] text-white cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20 disabled:opacity-50"
              >
                {creatingFolder ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Create Folder"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Premium Canva-Style sliding bottom actions drawer for mobile viewports */}
      {mobileActionsQuotation && (
        <div className="md:hidden">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] transition-opacity animate-in fade-in duration-300"
            onClick={() => {
              setMobileActionsQuotation(null);
              setShowFolderSubMenu(false);
            }}
          />
          
          {/* Sliding Bottom Sheet Drawer */}
          <div 
            style={{ 
              transform: drawerTranslateY > 0 ? `translateY(${drawerTranslateY}px)` : undefined, 
              transition: isDraggingDrawer ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
            }}
            className="fixed bottom-0 left-0 right-0 max-h-[92vh] bg-background dark:bg-zinc-950/95 border-t border-border dark:border-white/10 rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)] z-[150] flex flex-col max-w-lg mx-auto text-left actions-menu-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Bar (Swipe Down handle target!) */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-12 h-1 bg-muted-foreground/30 dark:bg-white/20 rounded-full mx-auto mt-3.5 mb-2 shrink-0 cursor-grab active:cursor-grabbing select-none" 
              style={{ touchAction: "none" }}
            />
            
            {/* Header Section */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="px-5 pt-2 pb-4 shrink-0 relative flex flex-col select-none" 
              style={{ touchAction: "none" }}
            >
              {/* Close button X */}
              <button
                onClick={() => {
                  setMobileActionsQuotation(null);
                  setShowFolderSubMenu(false);
                }}
                className="absolute top-2 right-4 p-1.5 bg-muted dark:bg-white/5 hover:bg-muted/80 dark:hover:bg-white/10 text-muted-foreground dark:text-white/70 hover:text-foreground dark:hover:text-white border border-border/20 dark:border-white/10 rounded-full transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* File details title */}
              <div className="pr-10">
                <h3 className="text-base font-extrabold text-foreground leading-snug line-clamp-1">
                  {mobileActionsQuotation.clientDetails.companyName}
                </h3>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">
                  A4 • Ref: {mobileActionsQuotation.number} • Edited {formatRelativeTime(mobileActionsQuotation.updatedAt || mobileActionsQuotation.createdAt || mobileActionsQuotation.date)}
                </p>
              </div>

              {/* Centered Premium Canva Card Vector Preview */}
              <div className="w-full max-w-[200px] h-[130px] bg-gradient-to-tr from-blue-600/10 via-primary/5 to-indigo-500/10 dark:from-blue-950/20 dark:via-primary/5 dark:to-indigo-950/20 rounded-2xl flex items-center justify-center p-3 border border-border dark:border-white/10 mt-4 mb-2 mx-auto relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(14,165,233,0.1),transparent_50%)] animate-pulse" />
                
                {/* The CSS Preview Sheet in high quality inside drawer */}
                <div className="w-[70px] h-[95px] bg-white border border-zinc-200 rounded shadow-2xl relative p-1.5 flex flex-col justify-between overflow-hidden scale-[1.05] pointer-events-none select-none text-[4px] leading-none text-zinc-800">
                  <div className="w-full flex items-center justify-between mb-1 border-b border-zinc-150 pb-0.5 shrink-0">
                    <div className="flex items-center gap-[1px]">
                      <div className="w-1.5 h-1.5 rounded-sm bg-primary flex items-center justify-center text-[3px] text-white font-black">D</div>
                      <div className="w-5 h-0.5 bg-zinc-800 rounded-sm" />
                    </div>
                    <div className="w-3 h-0.5 bg-zinc-400 rounded-sm" />
                  </div>
                  <div className="space-y-[2px] mb-1 shrink-0">
                    <div className="w-[60%] h-0.5 bg-zinc-300 rounded-sm" />
                    <div className="w-[45%] h-[1.5px] bg-zinc-205 rounded-sm" />
                  </div>
                  <div className="border border-zinc-100 rounded-sm overflow-hidden flex-1 mb-1 flex flex-col justify-start">
                    <div className="p-0.5 space-y-[2px] flex-1">
                      <div className="flex justify-between items-center">
                        <div className="w-6 h-0.5 bg-zinc-200 rounded-sm" />
                        <div className="w-2 h-0.5 bg-zinc-300 rounded-sm" />
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="w-5 h-0.5 bg-zinc-200 rounded-sm" />
                        <div className="w-3 h-0.5 bg-zinc-300 rounded-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end border-t border-zinc-150 pt-0.5 shrink-0">
                    <div className="w-4 h-[2px] bg-primary/75 rounded-sm" />
                    <svg className="w-4 h-1 text-primary shrink-0 opacity-60" viewBox="0 0 24 8" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M2 5c2-3 4-1 6-3s3 4 5 1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Divider */}
            <div className="h-[1px] bg-border dark:bg-white/10 shrink-0 mx-5" />
            
            {/* Scrollable list content */}
            <div ref={drawerScrollRef} className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 max-h-[50vh]">
              {!showFolderSubMenu ? (
                <>
                  {/* WhatsApp Share */}
                  {mobileActionsQuotation.driveFileId && (
                    <button
                      onClick={() => { triggerShare(mobileActionsQuotation, "whatsapp"); setMobileActionsQuotation(null); }}
                      className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 rounded-2xl transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-5 h-5 shrink-0 text-emerald-500" />
                      <span>Share on WhatsApp</span>
                    </button>
                  )}
                  
                  {/* Email Share */}
                  {mobileActionsQuotation.driveFileId && (
                    <button
                      onClick={() => { triggerShare(mobileActionsQuotation, "email"); setMobileActionsQuotation(null); }}
                      className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 rounded-2xl transition-colors cursor-pointer"
                    >
                      <Mail className="w-5 h-5 shrink-0 text-blue-400" />
                      <span>Share via Email</span>
                    </button>
                  )}
                  
                  {/* Universal Share */}
                  {mobileActionsQuotation.driveFileId && (
                    <button
                      onClick={() => { triggerShare(mobileActionsQuotation, "share"); setMobileActionsQuotation(null); }}
                      className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/10 rounded-2xl transition-colors cursor-pointer"
                    >
                      <Share2 className="w-5 h-5 shrink-0 text-indigo-400" />
                      <span>Universal PDF Share</span>
                    </button>
                  )}
                  
                  {/* Download PDF */}
                  {mobileActionsQuotation.driveFileId ? (
                    <button
                      onClick={() => { triggerShare(mobileActionsQuotation, "download"); setMobileActionsQuotation(null); }}
                      className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 dark:hover:bg-sky-500/10 rounded-2xl transition-colors cursor-pointer"
                    >
                      <Download className="w-5 h-5 shrink-0 text-sky-400" />
                      <span>Download PDF Document</span>
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const q = mobileActionsQuotation;
                        setMobileActionsQuotation(null);
                        if (!adminSettings) return;
                        try {
                          showToast("Generating local A4 PDF download...", "info");
                          const pdfBlob = await generatePdfBlob("quotation-pdf-container", {
                            isCustomized: isSettingsCustomized(adminSettings),
                            themeColor: "quotation"
                          });
                          downloadPdf(pdfBlob, `Quotation_${q.number}.pdf`);
                          showToast("PDF downloaded locally successfully!", "success");
                        } catch (err) {
                          console.error(err);
                          showToast("Failed to compile local PDF download.", "error");
                        }
                      }}
                      className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-sky-650 dark:text-sky-400 hover:bg-sky-500/10 dark:hover:bg-sky-500/10 rounded-2xl transition-colors cursor-pointer"
                    >
                      <Download className="w-5 h-5 shrink-0 text-sky-455" />
                      <span>Download Local PDF (A4)</span>
                    </button>
                  )}

                  <div className="h-[1px] bg-border dark:bg-white/5 my-1.5 shrink-0" />

                  {/* Edit Document */}
                  <button
                    onClick={() => { onEdit(mobileActionsQuotation); setMobileActionsQuotation(null); }}
                    className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-foreground/90 hover:bg-muted dark:hover:bg-white/5 rounded-2xl transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-5 h-5 shrink-0 text-primary" />
                    <span>Edit Quotation Details</span>
                  </button>

                  {/* Duplicate Document */}
                  <button
                    onClick={() => { handleDuplicate(mobileActionsQuotation); setMobileActionsQuotation(null); }}
                    className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-foreground/90 hover:bg-muted dark:hover:bg-white/5 rounded-2xl transition-colors cursor-pointer"
                  >
                    <Copy className="w-5 h-5 shrink-0 text-muted-foreground" />
                    <span>Duplicate as Draft</span>
                  </button>

                  {/* Move / Remove Folder options for mobile actions drawer */}
                   {mobileActionsQuotation.folderId && mobileActionsQuotation.folderId !== "drafts" ? (
                     <>
                       <button
                         onClick={async () => {
                           const qId = mobileActionsQuotation.id;
                           setMobileActionsQuotation(null);
                           await moveQuotationToFolder(qId, null);
                         }}
                         className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-550 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 rounded-2xl transition-colors cursor-pointer"
                       >
                         <FolderMinus className="w-5 h-5 shrink-0 text-rose-500" />
                         <span>Move out from Folder</span>
                       </button>

                       <button
                         onClick={() => setShowFolderSubMenu(true)}
                         className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-500 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 rounded-2xl transition-colors cursor-pointer"
                       >
                         <Folder className="w-5 h-5 shrink-0 text-amber-500" />
                         <span>Change Folder</span>
                       </button>
                     </>
                   ) : (
                     <button
                       onClick={() => setShowFolderSubMenu(true)}
                       className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-500 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 rounded-2xl transition-colors cursor-pointer"
                     >
                       <Folder className="w-5 h-5 shrink-0 text-amber-500" />
                       <span>Move to another Folder</span>
                     </button>
                   )}

                  {/* Delete Document */}
                  <button
                    onClick={() => { handleDelete(mobileActionsQuotation.id); setMobileActionsQuotation(null); }}
                    className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/10 rounded-2xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5 shrink-0 text-destructive" />
                    <span>Permanently Delete Quotation</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Nested Folder Destination List inside bottom sheet */}
                  <button
                    onClick={() => setShowFolderSubMenu(false)}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer border-b border-border dark:border-white/10 pb-3 mb-2 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    <span>Back to Options</span>
                  </button>

                  {/* All Quotations */}
                  <button
                    onClick={async () => {
                      const qId = mobileActionsQuotation.id;
                      setMobileActionsQuotation(null);
                      setShowFolderSubMenu(false);
                      await moveQuotationToFolder(qId, null);
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-3 text-sm font-semibold rounded-2xl transition-colors cursor-pointer",
                      !mobileActionsQuotation.folderId ? "bg-primary/10 text-primary font-bold dark:bg-primary/20 dark:text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/5"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Folder className="w-5 h-5 shrink-0 text-muted-foreground" />
                      <span>All Quotations</span>
                    </span>
                    {!mobileActionsQuotation.folderId && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                  </button>

                  {folders.length > 0 && <div className="h-[1px] bg-border dark:bg-white/10 my-1 shrink-0" />}

                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={async () => {
                        const qId = mobileActionsQuotation.id;
                        setMobileActionsQuotation(null);
                        setShowFolderSubMenu(false);
                        await moveQuotationToFolder(qId, f.id);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-4 py-3 text-sm font-semibold rounded-2xl transition-colors cursor-pointer",
                        mobileActionsQuotation.folderId === f.id ? "bg-primary/10 text-primary font-bold dark:bg-primary/20 dark:text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/5"
                      )}
                    >
                      <span className="flex items-center gap-3 truncate pr-2">
                        <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </span>
                      {mobileActionsQuotation.folderId === f.id && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Premium Toast Notification */}
      {notification && (
        <div className="fixed top-6 left-4 right-4 md:top-auto md:bottom-6 md:left-auto md:right-6 z-50 mx-auto max-w-[calc(100%-32px)] md:max-w-sm select-none" style={{ animation: "premiumBounceIn 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275) both" }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes premiumBounceIn {
              0% {
                opacity: 0;
                transform: translateY(-30px) scale(0.9);
              }
              50% {
                opacity: 1;
                transform: translateY(5px) scale(1.03);
              }
              75% {
                transform: translateY(-2px) scale(0.98);
              }
              100% {
                transform: translateY(0) scale(1);
              }
            }
          `}} />
          <div className={`px-5 py-3.5 rounded-2xl border shadow-2xl flex items-center justify-center gap-2.5 w-full bg-zinc-900 dark:bg-zinc-950 text-white ${
            notification.type === "success" 
              ? "border-emerald-500/50" 
              : notification.type === "error"
              ? "border-red-500/50 animate-shake"
              : "border-zinc-700"
          }`}>
            {notification.type === "success" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-lg shadow-emerald-500/60" />
            )}
            {notification.type === "error" && (
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-lg shadow-red-500/60" />
            )}
            <span className="text-xs sm:text-sm font-extrabold tracking-wide text-center leading-snug">
              {notification.message}
            </span>
          </div>
        </div>
      )}

      {/* Delete Folder Custom Confirmation Modal (Floating centered curves!) */}
      {folderToDelete && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm border backdrop-blur-xl p-6 rounded-[28px] text-center shadow-2xl relative select-none bouncy-modal-entry"
            style={{ 
              backgroundColor: theme === 'dark' ? 'rgba(9, 9, 11, 0.9)' : '#ffffff',
              color: theme === 'dark' ? '#ffffff' : '#0f172a',
              borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(226, 232, 240, 1)',
              boxShadow: theme === 'dark'
                ? "0 20px 50px rgba(229, 90, 34, 0.15), 0 0 50px rgba(0,0,0,0.5)"
                : "0 20px 40px rgba(229, 90, 34, 0.08), 0 0 30px rgba(0,0,0,0.05)"
            }}
          >
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg mb-4 mt-2"
              style={{
                backgroundColor: 'rgba(229, 90, 34, 0.1)',
                borderColor: 'rgba(229, 90, 34, 0.2)',
                color: '#e55a22'
              }}
            >
              <FolderMinus className="w-6 h-6 animate-pulse" />
            </div>
            <h3 
              className="text-lg font-black tracking-tight"
              style={{ color: theme === 'dark' ? '#ffffff' : '#0f172a' }}
            >
              Delete Folder?
            </h3>
            <p 
              className="mt-2 text-xs font-semibold leading-relaxed"
              style={{ color: theme === 'dark' ? '#a1a1aa' : '#475569' }}
            >
              Are you sure you want to delete the folder <span className="font-black text-[#e55a22]">"{folderToDelete.name}"</span>? All quotations inside will return to the 'All' category.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={executeDeleteFolder}
                className="w-full py-3 px-5 rounded-2xl text-xs font-extrabold border border-transparent text-white cursor-pointer transition-all active:scale-[0.98] bg-gradient-to-r from-[#E55A22] to-orange-600 hover:from-[#E55A22]/90 hover:to-orange-500"
              >
                Yes, Delete Folder
              </button>
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="w-full py-3 px-5 rounded-2xl text-xs font-extrabold cursor-pointer transition-all active:scale-[0.98] border bg-transparent"
                style={{
                  borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(226, 232, 240, 1)',
                  color: theme === 'dark' ? '#a1a1aa' : '#64748b'
                }}
              >
                No, Keep It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Dashboard;
