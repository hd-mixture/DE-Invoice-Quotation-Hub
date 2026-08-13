"use client";

import React, { useState, useEffect } from "react";
import { TaxInvoice, AdminSettings, Folder, Customer } from "../../types";
import { getInvoices, deleteInvoice, createInvoice, updateInvoice, getFolders, createFolder, deleteFolder, getAdminSettings, getCustomers, createCustomer, updateCustomer, deleteCustomer, isSettingsCustomized } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import {
  Search,
  Plus,
  FileText,
  Trash2,
  Edit3,
  Copy,
  ExternalLink,
  MessageCircle,
  Mail,
  Calendar,
  Loader2,
  TrendingUp,
  Receipt,
  FileCheck,
  CheckCircle,
  Share2,
  MoreVertical,
  Download,
  AlertCircle,
  Folder as FolderIcon,
  FolderPlus,
  FolderOpen,
  FolderMinus,
  LayoutGrid,
  List,
  Star,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CloudUpload,
  LogOut,
  Sparkles,
  Paperclip,
  Users,
  UserPlus,
  Filter,
  UploadCloud,
  FileSpreadsheet,
  FileImage,
  FilePlus,
  TrendingDown,
  Wallet
} from "lucide-react";
import { parseExcelInvoice } from "../../lib/importUtils";
import { formatCurrency, formatDate, cn, parseDateStringToYearMonthDay } from "../../lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, ComposedChart, LabelList, AreaChart, Area } from 'recharts';
import { useShareInvoice } from "../../hooks/useShareInvoice";
import { ShareActionsModal } from "../dashboard/ShareActions"; // Reuse share modal
import { InvoicePreview } from "../invoice/InvoicePreview";
import { downloadPdf, generatePdfBlob } from "../../services/pdfGenerator";
import { useTheme } from "../../context/ThemeContext";
import { AnalyticsModals } from "./AnalyticsModals";

// Relative date helper
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

const isInvoiceOverdue = (inv: TaxInvoice): boolean => {
  if (inv.status !== "sent") return false;
  if (!inv.billDate) return false;
  const billDate = new Date(inv.billDate);
  const today = new Date();
  const diffTime = today.getTime() - billDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 15;
};

interface InvoiceDashboardProps {
  onCreateNew: () => void;
  onEdit: (invoice: TaxInvoice) => void;
  onGoToSettings?: () => void;
  onSwitchWorkspace?: () => void;
}

export const InvoiceDashboard: React.FC<InvoiceDashboardProps> = ({
  onCreateNew,
  onEdit,
  onGoToSettings,
  onSwitchWorkspace
}) => {
  const { user, googleAccessToken, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [mobileActionsInvoice, setMobileActionsInvoice] = useState<TaxInvoice | null>(null);

  // Layout View Toggles
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [toggleHovered, setToggleHovered] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>("all");
  const [draggedOverFolderId, setDraggedOverFolderId] = useState<string | null>(null);
  const [deleteModalFolder, setDeleteModalFolder] = useState<Folder | null>(null);
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [activeAnalyticsModal, setActiveAnalyticsModal] = useState<'invoices' | 'revenue' | 'backups' | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [movingInvoiceId, setMovingInvoiceId] = useState<string | null>(null);
  const [draggableInvoiceId, setDraggableInvoiceId] = useState<string | null>(null);
  const [showFolderSubMenu, setShowFolderSubMenu] = useState(false);
  const [showAllFoldersOnMobile, setShowAllFoldersOnMobile] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);

  // CRM & Payment status outstanding tracking states
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all');
  const [showPaymentFilterDropdown, setShowPaymentFilterDropdown] = useState(false);
  const [showStatusSubMenu, setShowStatusSubMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [mobileFabOpen, setMobileFabOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [aiAnalysisStatus, setAiAnalysisStatus] = useState<{
    isAnalyzing: boolean;
    fileName: string;
    step: number;
    stepMessage: string;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'excel' | 'pdf' | 'vision'>('excel');
  const [activeSubTab, setActiveSubTab] = useState<'documents' | 'analytics' | 'crm'>('documents');
  const [crmCustomers, setCrmCustomers] = useState<Customer[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);

  const [crmSearch, setCrmSearch] = useState("");
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custFormName, setCustFormName] = useState("");
  const [custFormAddress, setCustFormAddress] = useState("");
  const [custFormGstin, setCustFormGstin] = useState("");
  const [custFormAttention, setCustFormAttention] = useState("");
  const [custFormSalutation, setCustFormSalutation] = useState("");
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [hoveredKpiNode, setHoveredKpiNode] = useState<{ cardId: string; label: string; value: string | number; x: number; y: number } | null>(null);
  const [hoveredOverviewBar, setHoveredOverviewBar] = useState<{ label: string; value: string; x: number; y: number; color: string } | null>(null);
  const [showOverviewDropdown, setShowOverviewDropdown] = useState(false);
  const [isSyncingLedgers, setIsSyncingLedgers] = useState(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isImageOrPdf = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(fileExt) || 
                         file.type.startsWith('image/') || 
                         file.type === 'application/pdf';
    const isExcel = ['xlsx', 'xls', 'csv'].includes(fileExt) || 
                    file.type.includes('spreadsheet') || 
                    file.type.includes('excel') || 
                    file.type === 'text/csv';

    if (!isImageOrPdf && !isExcel) {
      showToast(`Unsupported File Format (.${fileExt.toUpperCase()}). Please upload an Excel spreadsheet (.xlsx, .csv) or PDF/Image document.`, "error");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const effectiveMode = isExcel ? 'excel' : 'vision';

    setIsImporting(true);
    setShowImportMenu(false);

    if (effectiveMode === 'vision') {
      setAiAnalysisStatus({
        isAnalyzing: true,
        fileName: file.name,
        step: 1,
        stepMessage: "⚡ Scanning document layout, text & handwriting..."
      });
    } else {
      showToast(`Parsing spreadsheet ${file.name}...`, "info");
    }

    let step2Timer: any = null;
    let step3Timer: any = null;

    try {
      let parsedData: Partial<TaxInvoice>;

      if (effectiveMode === 'vision') {
        step2Timer = setTimeout(() => {
          setAiAnalysisStatus(prev => prev ? {
            ...prev,
            step: 2,
            stepMessage: "🧠 Decrypting text, handwritten tables & GST codes..."
          } : null);
        }, 1500);

        step3Timer = setTimeout(() => {
          setAiAnalysisStatus(prev => prev ? {
            ...prev,
            step: 3,
            stepMessage: "✨ Structuring line items & calculating tax totals..."
          } : null);
        }, 3200);

        const { processDocumentWithAI } = await import("../../lib/aiVisionApi");
        parsedData = await processDocumentWithAI(file);
      } else {
        parsedData = await parseExcelInvoice(file);
      }

      if (!parsedData.items || parsedData.items.length === 0) {
        throw new Error("Unrecognized Document Content: No line items or quotation/invoice data could be extracted. Please ensure you upload a valid commercial document.");
      }

      const detectedSource: "pdf" | "excel" | "jpeg" = 
        effectiveMode === 'excel' ? 'excel' : 
        (file.type === "application/pdf" || fileExt === 'pdf' ? 'pdf' : 'jpeg');

      const newInvoice: TaxInvoice = {
        id: "",
        billNumber: "",
        billDate: new Date().toISOString().split("T")[0],
        poNumber: "",
        poDate: new Date().toISOString().split("T")[0],
        consigneeDetails: { companyName: "", address: "", gstin: "" },
        billedTo: { clientName: "", clientAddress: "", clientGstin: "" },
        jobDescription: "",
        items: [],
        subTotal: 0,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 18,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        gstTotal: 0,
        grandTotal: 0,
        rupeesInWords: "",
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || "",
        creatorEmail: user?.email || "",
        status: "draft",
        isImported: true,
        invoiceType: "imported",
        importSource: detectedSource,
        ...parsedData,
      };

      newInvoice.isImported = true;
      newInvoice.invoiceType = "imported";
      newInvoice.importSource = detectedSource;

      if (newInvoice.items && newInvoice.items.length > 0) {
        newInvoice.subTotal = newInvoice.items.reduce((sum, item) => sum + item.amount, 0);
      }

      showToast("Invoice data extracted and imported successfully!", "success");
      onEdit(newInvoice);
    } catch (err: any) {
      console.error("Upload parsing error:", err);
      const errorMessage = err?.message || "Failed to process document. Please check file format and content.";
      showToast(errorMessage, "error");
    } finally {
      if (step2Timer) clearTimeout(step2Timer);
      if (step3Timer) clearTimeout(step3Timer);
      setIsImporting(false);
      setAiAnalysisStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadCrmCustomers = async () => {
    if (!user) return;
    setCrmLoading(true);
    try {
      const list = await getCustomers(user.uid);
      setCrmCustomers(list);
    } catch (err) {
      console.error("Failed to load CRM customers:", err);
    } finally {
      setCrmLoading(false);
    }
  };

  const handleUpdateStatus = async (invId: string, newStatus: 'draft' | 'sent' | 'paid' | 'cancelled') => {
    try {
      await updateInvoice(invId, { status: newStatus });
      setInvoices(prev => prev.map(inv => inv.id === invId ? { ...inv, status: newStatus } : inv));
      showToast(`Status updated to ${newStatus.toUpperCase()}`, "success");
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !custFormName.trim() || !custFormAddress.trim()) {
      showToast("Customer Name and Address are required.", "error");
      return;
    }

    const customerData = {
      companyName: custFormName.trim(),
      address: custFormAddress.trim(),
      gstin: custFormGstin.trim().toUpperCase(),
      kindAttention: custFormAttention.trim(),
      dearSirText: custFormSalutation.trim() || "Dear Sir,",
      createdBy: user.uid,
      createdAt: new Date().toISOString()
    };

    try {
      if (editingCustomer && editingCustomer.id) {
        await updateCustomer(editingCustomer.id, customerData);
        showToast("Customer details updated successfully!", "success");
      } else {
        await createCustomer(customerData);
        showToast("New Customer added to CRM successfully!", "success");
      }

      // Reset form fields
      setCustFormName("");
      setCustFormAddress("");
      setCustFormGstin("");
      setCustFormAttention("");
      setCustFormSalutation("");
      setEditingCustomer(null);
      setShowAddCustomerModal(false);
      await loadCrmCustomers();
    } catch (err) {
      showToast("Failed to save customer record.", "error");
    }
  };
  const handleDownloadFinancialReport = () => {
    import("jspdf").then((module) => {
      const doc = new module.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const activeInvoices = invoices.filter(i => i.status === 'paid' || i.status === 'sent');
      const totalRevenue = invoices.reduce((acc, curr) => acc + curr.grandTotal, 0);
      const totalCgst = activeInvoices.reduce((sum, i) => sum + (i.cgstAmount || 0), 0);
      const totalSgst = activeInvoices.reduce((sum, i) => sum + (i.sgstAmount || 0), 0);
      const totalIgst = activeInvoices.reduce((sum, i) => sum + (i.igstAmount || 0), 0);
      const totalTax = totalCgst + totalSgst + totalIgst;

      // Header details
      doc.setFillColor(139, 92, 246); // violet primary
      doc.rect(0, 0, 210, 35, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("DARSHAN ENTERPRISES", 15, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Annual Financial & Tax Ledger Summary Report", 15, 22);
      doc.text(`Generated Date: ${new Date().toLocaleDateString('en-IN')}`, 15, 28);

      // Box stats
      doc.setFillColor(245, 243, 255); // light violet backglow
      doc.rect(15, 45, 180, 25, "F");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("FINANCIAL SUMMARY METRICS:", 20, 52);

      doc.setFont("helvetica", "normal");
      doc.text(`Total Billed Revenue: Rs. ${formatCurrency(totalRevenue)}`, 20, 60);
      doc.text(`Cumulative GST Billed: Rs. ${formatCurrency(totalTax)}`, 110, 60);
      doc.text(`CGST Billed: Rs. ${formatCurrency(totalCgst)}`, 20, 66);
      doc.text(`SGST Billed: Rs. ${formatCurrency(totalSgst)}`, 65, 66);
      doc.text(`IGST Billed: Rs. ${formatCurrency(totalIgst)}`, 110, 66);
      doc.text(`Active Bill Count: ${activeInvoices.length}`, 155, 66);

      // Table headers
      doc.setFillColor(139, 92, 246);
      doc.rect(15, 78, 180, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Bill ID", 18, 83);
      doc.text("Client Name", 40, 83);
      doc.text("Date", 100, 83);
      doc.text("Status", 125, 83);
      doc.text("Tax Billed", 150, 83);
      doc.text("Billed Total", 175, 83);

      // Rows list
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      let y = 91;
      activeInvoices.forEach((inv) => {
        if (y > 270) {
          doc.addPage();
          y = 20; // reset y

          // Reprint table headers
          doc.setFillColor(139, 92, 246);
          doc.rect(15, y - 5, 180, 7, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.text("Bill ID", 18, y);
          doc.text("Client Name", 40, y);
          doc.text("Date", 100, y);
          doc.text("Status", 125, y);
          doc.text("Tax Billed", 150, y);
          doc.text("Billed Total", 175, y);
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "normal");
          y += 8;
        }

        // Render row details
        doc.text(String(inv.billNumber), 18, y);
        doc.text(String(inv.billedTo.clientName).slice(0, 32), 40, y);
        doc.text(String(inv.billDate), 100, y);
        doc.text(String(inv.status).toUpperCase(), 125, y);

        const taxBilled = (inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0);
        doc.text(`Rs. ${formatCurrency(taxBilled)}`, 150, y);
        doc.text(`Rs. ${formatCurrency(inv.grandTotal)}`, 175, y);

        // Draw division line
        doc.setDrawColor(226, 232, 240);
        doc.line(15, y + 2, 195, y + 2);

        y += 7.5;
      });

      doc.save(`Darshan_Enterprises_Financial_Report_${new Date().getFullYear()}.pdf`);
      showToast("Financial Summary PDF downloaded successfully!", "success");
    });
  };

  // Drawer Touch drag closed states
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

  const triggerManualSync = () => {
    setIsSyncingLedgers(true);
    setTimeout(() => {
      setIsSyncingLedgers(false);
      showToast("Google Drive backups verified and up-to-date!", "success");
      if (typeof window !== "undefined") {
        import("canvas-confetti").then((module) => {
          module.default({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.8 }
          });
        });
      }
    }, 1500);
  };

  const getMonthOptions = () => {
    const optionsMap = new Map<string, string>();
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const curLabel = now.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    optionsMap.set(curKey, curLabel);

    invoices.forEach(inv => {
      if (!inv.billDate) return;
      const d = new Date(inv.billDate);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      optionsMap.set(key, label);
    });

    return Array.from(optionsMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const renderKpiSparkline = (
    data: any[],
    metric: 'count' | 'revenue' | 'synced',
    strokeColor: string,
    gradId: string,
    cardId: string,
    selectedIndex: number
  ) => {
    return (
      <div className="w-full h-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <RechartsTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 text-slate-800 dark:text-white text-[10px] py-1.5 px-2.5 rounded-lg shadow-xl z-50 flex flex-col gap-0.5 pointer-events-none">
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-zinc-400">{d.label}</div>
                      <div className="font-black" style={{ color: strokeColor }}>
                        {metric === 'revenue' ? `₹${formatCurrency(d[metric])}` : `${d[metric]} ${metric === 'count' ? 'invoices' : 'backups'}`}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={strokeColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradId})`}
              isAnimationActive={true}
              activeDot={{ r: 4, fill: strokeColor, stroke: '#fff', strokeWidth: 1.5 }}
              dot={(props: any) => {
                const { cx, cy, index } = props;
                if (index === selectedIndex) {
                  return (
                    <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={strokeColor} stroke="#fff" strokeWidth={1.5} className="animate-pulse" />
                  );
                }
                return <React.Fragment key={`dot-${index}`} />;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Attach PDF sharing hook
  const {
    sharingState,
    activeInvoice,
    adminSettings,
    tempUrl,
    modalOpen,
    triggerShare,
    closeModal
  } = useShareInvoice(showToast);

  const [dashboardSettings, setDashboardSettings] = useState<AdminSettings | null>(null);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getInvoices(user.uid);
      const sortedData = data.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setInvoices(sortedData);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFolders() {
    if (!user) return;
    try {
      const folderList = await getFolders(user.uid);
      // Filter only invoice folders (explicitly type === 'invoice')
      const invoiceFolders = folderList.filter(f => f.type === 'invoice');
      setFolders(invoiceFolders);
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  }
  useEffect(() => {
    if (user) {
      loadData();
      loadFolders();
      loadCrmCustomers();
    }
  }, [user]);

  // Handle outside click & scroll menus closures
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".actions-menu-container") && !target.closest(".actions-trigger-btn")) {
        setMobileActionsInvoice(null);
        setShowStatusSubMenu(false);
      }
      if (!target.closest(".import-dropdown-container")) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Instantly close Mobile FAB Speed-Dial Stack on outside click/touch or scroll
  useEffect(() => {
    if (!mobileFabOpen) return;

    const handleOutsideFab = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".mobile-fab-container")) {
        setMobileFabOpen(false);
      }
    };

    const handleFabScroll = () => {
      setMobileFabOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideFab);
    document.addEventListener("touchstart", handleOutsideFab);
    window.addEventListener("scroll", handleFabScroll, { passive: true, capture: true });

    return () => {
      document.removeEventListener("mousedown", handleOutsideFab);
      document.removeEventListener("touchstart", handleOutsideFab);
      window.removeEventListener("scroll", handleFabScroll, { capture: true });
    };
  }, [mobileFabOpen]);



  // Set drawer overflow lock
  useEffect(() => {
    setShowFolderSubMenu(false);
    setShowStatusSubMenu(false);
    setDrawerTranslateY(0);
    setIsDraggingDrawer(false);

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (mobileActionsInvoice && isMobile) {
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
  }, [mobileActionsInvoice]);

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

  // Swipe drawer drag closed handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const isAtTop = drawerScrollRef.current ? drawerScrollRef.current.scrollTop === 0 : true;
    drawerTouchStartY.current = e.touches[0].clientY;
    setIsDraggingDrawer(isAtTop);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingDrawer) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - drawerTouchStartY.current;
    if (deltaY > 0) {
      setDrawerTranslateY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingDrawer) return;
    if (drawerTranslateY > 120) {
      setMobileActionsInvoice(null); // swipe to dismiss
    }
    setDrawerTranslateY(0);
  };

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await createFolder({
        name: newFolderName.trim(),
        userId: user.uid,
        createdAt: new Date().toISOString(),
        type: 'invoice'
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
      const invoicesInFolder = invoices.filter((i) => i.folderId === id);
      await Promise.all(
        invoicesInFolder.map((i) => updateInvoice(i.id, { folderId: "" }))
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

  const moveInvoiceToFolder = async (invoiceId: string, targetFolderId: string | null) => {
    setMovingInvoiceId(invoiceId);
    try {
      await updateInvoice(invoiceId, { folderId: targetFolderId || "" });
      setInvoices(prev => prev.map(item => item.id === invoiceId ? { ...item, folderId: targetFolderId || "" } : item));
      const folderName = targetFolderId === "drafts" ? "Drafts" : (targetFolderId ? folders.find(f => f.id === targetFolderId)?.name || "Folder" : "All");
      showToast(`Moved to ${folderName} successfully.`, "success");
    } catch (err) {
      showToast("Failed to move invoice.", "error");
    } finally {
      setMovingInvoiceId(null);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, inv: TaxInvoice) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const newPinnedState = !inv.isPinned;
      await updateInvoice(inv.id, { isPinned: newPinnedState });

      setInvoices((prev) => {
        const updated = prev.map((item) =>
          item.id === inv.id ? { ...item, isPinned: newPinnedState } : item
        );
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });

      showToast(newPinnedState ? "Invoice pinned to top!" : "Invoice unpinned.", "success");
    } catch (err) {
      showToast("Failed to update pin state.", "error");
    }
  };

  const handleDeleteTrigger = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      await deleteInvoice(id);
      setInvoices(invoices.filter((inv) => inv.id !== id));
      showToast("Tax Invoice deleted successfully.", "success");
    } catch (err) {
      showToast("Failed to delete invoice.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (inv: TaxInvoice) => {
    if (!user) return;
    setDuplicatingId(inv.id);
    try {
      const newNumber = `${inv.billNumber}-Copy`;
      const duplicateData = JSON.parse(JSON.stringify(inv));
      delete duplicateData.id;

      const duplicated: Omit<TaxInvoice, "id"> = {
        ...duplicateData,
        billNumber: newNumber,
        billDate: new Date().toISOString().split("T")[0],
        poDate: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
        status: "draft"
      };

      delete (duplicated as any).driveUrl;
      delete (duplicated as any).driveFileId;

      await createInvoice(duplicated);
      await loadData();

      showToast(`Invoice ${newNumber} created as a draft!`, "success");

      if (typeof window !== "undefined") {
        import("canvas-confetti").then((module) => {
          module.default({ particleCount: 50, spread: 45, origin: { y: 0.8 } });
        });
      }
    } catch (err) {
      showToast("Failed to duplicate invoice.", "error");
    } finally {
      setDuplicatingId(null);
    }
  };

  // Search, folder & payment status filtration
  const filteredInvoices = invoices.filter((inv) => {
    // Hide soft-deleted invoices from main views
    if (inv.isDeleted) return false;

    const searchLower = search.toLowerCase();
    const matchesSearch = (
      inv.billedTo.clientName.toLowerCase().includes(searchLower) ||
      inv.jobDescription.toLowerCase().includes(searchLower) ||
      inv.billNumber.toLowerCase().includes(searchLower)
    );

    if (!matchesSearch) return false;

    // Filter by payment status
    if (paymentFilter === "draft") {
      if (inv.status !== "draft") return false;
    } else if (paymentFilter === "sent") {
      if (inv.status !== "sent" || isInvoiceOverdue(inv)) return false;
    } else if (paymentFilter === "paid") {
      if (inv.status !== "paid") return false;
    } else if (paymentFilter === "overdue") {
      if (!isInvoiceOverdue(inv)) return false;
    }

    if (activeFolderId === "all") {
      return true;
    } else if (activeFolderId === "drafts") {
      return inv.status === "draft";
    } else {
      return inv.folderId === activeFolderId;
    }
  });

  // Calculate local invoice statistics
  const totalRevenue = invoices.reduce((acc, curr) => acc + curr.grandTotal, 0);
  const syncedCount = invoices.filter((i) => i.driveUrl).length;

  // Month-over-Month Analytics Calculations
  const currentYear = parseInt(selectedMonthYear.split("-")[0], 10);
  const currentMonth = parseInt(selectedMonthYear.split("-")[1], 10) - 1; // 0-indexed

  const getYearMonth = (dateStr: string | undefined | null) => {
    const parsed = parseDateStringToYearMonthDay(dateStr);
    if (!parsed) return { year: 0, month: -1 };
    return { year: parsed.year, month: parsed.month };
  };

  // 1. Current Month Invoices (including deleted for analytics)
  const currentMonthInvoices = invoices.filter((inv) => {
    const dateToUse = inv.billDate || inv.createdAt;
    if (!dateToUse) return false;
    const { year, month } = getYearMonth(dateToUse);
    return year === currentYear && month === currentMonth;
  });

  // 2. Previous Month Date calculations
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonthInvoices = invoices.filter((inv) => {
    const dateToUse = inv.billDate || inv.createdAt;
    if (!dateToUse) return false;
    const { year, month } = getYearMonth(dateToUse);
    return year === prevMonthYear && month === prevMonth;
  });

  // Invoice Count Metrics
  const curMonthCount = currentMonthInvoices.length;
  const prevMonthCount = prevMonthInvoices.length;

  // Calculate Invoice count percentage change
  let countChangePercent = 0;
  if (prevMonthCount > 0) {
    countChangePercent = Math.round(((curMonthCount - prevMonthCount) / prevMonthCount) * 100);
  } else if (curMonthCount > 0) {
    countChangePercent = 100; // 100% increase if last month was 0
  }

  // Revenue Metrics
  const curMonthRevenue = currentMonthInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const prevMonthRevenue = prevMonthInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

  // Calculate Revenue percentage change
  let revenueChangePercent = 0;
  if (prevMonthRevenue > 0) {
    revenueChangePercent = Math.round(((curMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
  } else if (curMonthRevenue > 0) {
    revenueChangePercent = 100;
  }

  // Synced Drive Metrics for Current Month
  const curMonthSynced = currentMonthInvoices.filter((inv) => inv.driveUrl).length;

  const getLast6MonthsData = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const result = [];
    // Base 6 months period off of the currently selected month
    const anchorDate = new Date(currentYear, currentMonth, 1);

    for (let i = 5; i >= 0; i--) {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
      const mName = months[d.getMonth()];
      const yearShort = d.getFullYear().toString().slice(-2);
      const label = `${mName} '${yearShort}`;

      // Filter invoices in this month
      const monthInvoices = invoices.filter(inv => {
        const dateToUse = inv.billDate || inv.createdAt;
        if (!dateToUse) return false;
        const { year, month } = getYearMonth(dateToUse);
        return year === d.getFullYear() && month === d.getMonth();
      });

      // Advanced Analytics Calculations
      const createdCount = monthInvoices.filter(inv => inv.invoiceType === "manual" || !inv.invoiceType).length;
      const importedCount = monthInvoices.filter(inv => inv.invoiceType === "imported" || inv.isImported).length;
      const paidCount = monthInvoices.filter(inv => inv.status === "paid" || inv.paymentStatus === "paid").length;
      const cancelledCount = monthInvoices.filter(inv => inv.status === "cancelled" || inv.isCancelled).length;
      const deletedCount = monthInvoices.filter(inv => inv.isDeleted).length;

      const activeCount = createdCount + importedCount - deletedCount - cancelledCount;

      // Revenue only counts Paid invoices as requested
      const paidInvoices = monthInvoices.filter(inv => (inv.status === "paid" || inv.paymentStatus === "paid") && !inv.isDeleted && !inv.isCancelled);
      const rev = paidInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

      const cgst = monthInvoices.reduce((sum, inv) => sum + (inv.cgstAmount || 0), 0);
      const sgst = monthInvoices.reduce((sum, inv) => sum + (inv.sgstAmount || 0), 0);
      const igst = monthInvoices.reduce((sum, inv) => sum + (inv.igstAmount || 0), 0);

      const synced = monthInvoices.filter(inv => inv.driveUrl && !inv.isDeleted).length;
      const failed = monthInvoices.filter(inv => !inv.driveUrl && !inv.isDeleted).length;

      result.push({
        label,
        revenue: rev,
        cgst,
        sgst,
        igst,
        tax: cgst + sgst + igst,
        count: monthInvoices.filter(inv => !inv.isDeleted).length,
        created: createdCount,
        imported: importedCount,
        paid: paidCount,
        cancelled: cancelledCount,
        deleted: deletedCount,
        active: activeCount,
        synced,
        failed,
        pending: failed // using failed count as pending for now if not synced
      });
    }
    return result;
  };

  const monthlyAnalyticsData = getLast6MonthsData();

  const getYearlyData = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const result = [];
    const year = currentYear;

    let totalInvoices = 0;
    let totalRevenue = 0;
    let totalSynced = 0;

    for (let i = 0; i < 12; i++) {
      const mName = months[i];
      const label = `${mName} ${year}`;

      const monthInvoices = invoices.filter(inv => {
        if (!inv.billDate) return false;
        const bDate = new Date(inv.billDate);
        return bDate.getFullYear() === year && bDate.getMonth() === i;
      });

      const count = monthInvoices.filter(inv => !inv.isDeleted).length;

      const paidInvoices = monthInvoices.filter(inv => (inv.status === "paid" || inv.paymentStatus === "paid") && !inv.isDeleted && !inv.isCancelled);
      const rev = paidInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

      const synced = monthInvoices.filter(inv => inv.driveUrl && !inv.isDeleted).length;
      const failed = monthInvoices.filter(inv => !inv.driveUrl && !inv.isDeleted).length;

      totalInvoices += count;
      totalRevenue += rev;
      totalSynced += synced;

      result.push({
        label,
        monthIndex: i,
        count,
        revenue: rev,
        synced,
        failed,
      });
    }

    return { data: result, totalInvoices, totalRevenue, totalSynced, year };
  };

  const yearlyAnalytics = getYearlyData();

  const nowForLabel = new Date();
  const currentRealKey = `${nowForLabel.getFullYear()}-${String(nowForLabel.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = selectedMonthYear === currentRealKey;
  const selectedDateLabel = new Date(currentYear, currentMonth, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  const displayMonthLabel = isCurrentMonth ? "This Month" : selectedDateLabel;

  return (
    <div className="w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 sm:py-8 space-y-7 sm:space-y-8 pb-24 invoice-workspace-theme text-left">
      {styleBlock}

      <div className="dashboard-main-content space-y-7 sm:space-y-8 transition-all duration-300">

        {/* Upper Brand Section (Sleek dark violet layout!) */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-black text-violet-400 uppercase tracking-widest animate-pulse select-none">
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
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Invoice Dashboard
            </h1>
            <p className="text-zinc-400 text-sm">
              Manage corporate billing ledgers, calculate CGST/SGST breakdowns, and back up files to Google Drive.
            </p>
          </div>

          <div className="hidden sm:flex flex-col sm:flex-row items-center import-dropdown-container relative z-30">
            {/* Inline-block relative wrapper so dropdown matches 100% of button width */}
            <div className="relative inline-block w-auto">
              {/* Soft lavender glow underneath to make it appear floating */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#D946EF]/20 via-[#7C3AED]/20 to-[#6366F1]/20 rounded-[26px] blur-xl opacity-70 group-hover:opacity-100 transition duration-300 pointer-events-none -z-10" />

              {/* Main Compact Button Container */}
              <div className="group relative flex items-center justify-between bg-white dark:bg-zinc-900 border border-[rgba(99,102,241,0.08)] dark:border-zinc-800 rounded-[22px] sm:rounded-[24px] h-[62px] sm:h-[66px] w-auto px-1.5 shadow-[0_12px_40px_rgba(91,94,255,0.10),0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_48px_rgba(91,94,255,0.18),0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-300 select-none">
                
                {/* Left Section: Create New Invoice */}
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="flex items-center gap-3 h-full pl-1 pr-3 cursor-pointer group/btn"
                >
                  {/* 48x48 Circular Gradient Icon (#D946EF -> #7C3AED -> #4F46E5) */}
                  <div className="w-[48px] h-[48px] sm:w-[50px] sm:h-[50px] rounded-full bg-gradient-to-tr from-[#D946EF] via-[#7C3AED] to-[#4F46E5] flex items-center justify-center text-white shadow-md shadow-purple-500/30 border border-white/30 group-hover/btn:scale-[1.05] group-hover/btn:shadow-lg group-hover/btn:shadow-purple-500/50 group-hover/btn:brightness-110 transition-all duration-200 shrink-0">
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5px]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                  </div>
                  {/* Title: 16-17px Bold Inter font #0F172A */}
                  <span className="text-[16px] sm:text-[17px] font-bold text-[#0F172A] dark:text-white tracking-tight font-sans whitespace-nowrap">
                    New Invoice
                  </span>
                </button>

                {/* Divider: width 1px, height 32px, bg #ECECF5 */}
                <div className="w-[1px] h-[32px] bg-[#ECECF5] dark:bg-zinc-800 shrink-0 mx-0.5" />

                {/* Dropdown Button: Compact 50x50 interaction area */}
                <button
                  type="button"
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  className="w-[48px] h-[48px] sm:w-[50px] sm:h-[50px] flex items-center justify-center rounded-[16px] hover:bg-[#F5F2FF] dark:hover:bg-zinc-800 transition-colors duration-200 cursor-pointer disabled:opacity-50 shrink-0"
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#7C3AED]" />
                  ) : (
                    <ChevronDown
                      className={cn(
                        "w-[20px] h-[20px] stroke-[2.5px] text-[#0F172A] dark:text-white transition-transform duration-[220ms] ease-in-out",
                        showImportMenu && "rotate-180"
                      )}
                    />
                  )}
                </button>
              </div>

              {/* Dropdown Menu Card - EXACT MATCHING 100% BUTTON WIDTH */}
              {showImportMenu && (
                <div className="absolute left-0 right-0 w-full top-[calc(100%+8px)] z-50 bg-white dark:bg-zinc-950 border border-[#F1F1F5] dark:border-zinc-800 rounded-[20px] p-[6px] shadow-[0_20px_50px_rgba(80,60,255,0.12)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-[6px] select-none">
                  
                  {/* Item 1 (Primary - Soft Lavender Highlighted Card) */}
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('vision');
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                        fileInputRef.current.accept = "image/jpeg,image/png,image/jpg,application/pdf";
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex items-center gap-2.5 w-full h-[52px] px-2 py-1.5 rounded-[14px] bg-[#F8F5FF] dark:bg-purple-950/30 border border-[#EBE4FF] dark:border-purple-800/30 hover:bg-[#F2EBFF] dark:hover:bg-purple-900/40 hover:-translate-y-[1px] transition-all duration-[200ms] ease-out text-left cursor-pointer group/item1 overflow-hidden"
                  >
                    {/* Compact soft lavender icon container with Purple Sparkle */}
                    <div className="w-[34px] h-[34px] rounded-[10px] bg-[#EFE9FF] dark:bg-purple-500/20 flex items-center justify-center shrink-0 group-hover/item1:scale-105 transition-transform duration-200">
                      <Sparkles className="w-4 h-4 text-[#7C3AED] dark:text-purple-400" />
                    </div>
                    <div className="flex flex-col justify-center min-w-0 flex-1 overflow-hidden">
                      <span className="text-[12.5px] font-bold text-[#0F172A] dark:text-white tracking-tight leading-tight truncate">
                        Upload JPG/PDF & Auto-Fill
                      </span>
                      <span className="text-[10px] font-medium text-[#64748B] dark:text-zinc-400 mt-0.5 truncate">
                        AI-powered extraction
                      </span>
                    </div>
                  </button>

                  {/* Item 2 (Excel Option Card) */}
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('excel');
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                        fileInputRef.current.accept = ".xlsx,.csv,.xls";
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex items-center gap-2.5 w-full h-[52px] px-2 py-1.5 rounded-[14px] bg-white dark:bg-zinc-900/50 hover:bg-[#F8F5FF] dark:hover:bg-zinc-800/60 hover:-translate-y-[1px] transition-all duration-[200ms] ease-out text-left cursor-pointer group/item2 overflow-hidden"
                  >
                    {/* Compact soft mint-green icon container with Excel icon */}
                    <div className="w-[34px] h-[34px] rounded-[10px] bg-[#E8F8F0] dark:bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover/item2:scale-105 transition-transform duration-200">
                      <FileSpreadsheet className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
                    </div>
                    <div className="flex flex-col justify-center min-w-0 flex-1 overflow-hidden">
                      <span className="text-[12.5px] font-bold text-[#0F172A] dark:text-white tracking-tight leading-tight truncate">
                        Import Excel File
                      </span>
                      <span className="text-[10px] font-medium text-[#64748B] dark:text-zinc-400 mt-0.5 truncate">
                        Upload spreadsheets
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".xlsx,.csv,.xls,image/jpeg,image/png,image/jpg,application/pdf"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* 2-Column Canvas Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start mt-6">

          {/* Left Column: Quick Access Sidebar */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 select-none text-left">
            <div className="hidden lg:flex glass-panel rounded-3xl border border-white/20 dark:border-white/5 p-4 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl shadow-sm flex-col w-full relative overflow-hidden select-none">
              <div className="flex items-center gap-2 px-2 py-3 border-b border-slate-100 dark:border-white/5 shrink-0 select-none mb-3">
                <FolderOpen className="w-4 h-4 text-violet-500 dark:text-violet-400 shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-zinc-200">Quick Access</span>
              </div>

              <div className="grid grid-cols-3 lg:flex lg:flex-col gap-2 relative">
                {[
                  {
                    id: 'documents',
                    label: 'Folders',
                    desktopLabel: 'Folders & Library',
                    icon: FolderOpen,
                    desc: 'Manage your files & documents',
                    colorClass: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-500/20 border-violet-500/10',
                    activeBorderColor: 'border-t-violet-600 lg:border-l-violet-600 dark:border-t-violet-500 dark:lg:border-l-violet-500',
                    activeText: 'text-violet-600 dark:text-violet-400',
                    activeBg: 'bg-gradient-to-tr from-violet-500/10 to-indigo-500/5 dark:from-violet-500/20 dark:to-indigo-500/10 border-violet-500/30 shadow-[0_4px_20px_rgba(139,92,246,0.15)] dark:shadow-[0_4px_20px_rgba(139,92,246,0.25)]',
                    activeBackdrop: 'bg-violet-50/90 dark:bg-violet-950/30 border-violet-100 dark:border-violet-500/10'
                  },
                  {
                    id: 'analytics',
                    label: 'Reports',
                    desktopLabel: 'Reports & Analytics',
                    icon: TrendingUp,
                    desc: 'View insights & performance',
                    colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/10',
                    activeBorderColor: 'border-t-emerald-600 lg:border-l-emerald-600 dark:border-t-emerald-500 dark:lg:border-l-emerald-500',
                    activeText: 'text-emerald-600 dark:text-emerald-400',
                    activeBg: 'bg-gradient-to-tr from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/20 dark:to-teal-500/10 border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.15)] dark:shadow-[0_4px_20px_rgba(16,185,129,0.25)]',
                    activeBackdrop: 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-500/10'
                  },
                  {
                    id: 'crm',
                    label: 'Customers',
                    desktopLabel: 'Customers CRM',
                    icon: Users,
                    desc: 'Manage customers & leads',
                    colorClass: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/10',
                    activeBorderColor: 'border-t-orange-600 lg:border-l-orange-600 dark:border-t-orange-500 dark:lg:border-l-orange-500',
                    activeText: 'text-orange-600 dark:text-orange-400',
                    activeBg: 'bg-gradient-to-tr from-orange-500/10 to-amber-500/5 dark:from-orange-500/20 dark:to-amber-500/10 border-orange-500/30 shadow-[0_4px_20px_rgba(249,115,22,0.15)] dark:shadow-[0_4px_20px_rgba(249,115,22,0.25)]',
                    activeBackdrop: 'bg-orange-50/90 dark:bg-orange-950/30 border-orange-100 dark:border-orange-500/10'
                  }
                ].map(tab => {
                  const Icon = tab.id === 'documents' ? (activeSubTab === 'documents' ? FolderOpen : FolderIcon) : tab.icon;
                  const active = activeSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveSubTab(tab.id as any);
                        if (tab.id === 'crm') {
                          loadCrmCustomers();
                        }
                      }}
                      className={cn(
                        "flex flex-col lg:flex-row lg:items-center justify-center lg:justify-between gap-2 lg:gap-3 px-2 py-3 lg:px-4 lg:py-4 rounded-2xl cursor-pointer select-none text-center lg:text-left relative group/tab outline-none border-t-2 lg:border-t-0 lg:border-l-4 transition-all duration-200 transform active:scale-95 active:brightness-95 active:duration-75 touch-manipulation overflow-hidden",
                        active
                          ? cn(tab.activeBackdrop, tab.activeBorderColor, "lg:shadow-none", tab.activeBg)
                          : "border-transparent bg-slate-50/20 dark:bg-zinc-900/10 lg:bg-transparent lg:dark:bg-transparent border border-slate-100/50 dark:border-white/5 lg:border-0 hover:bg-slate-50/30 dark:hover:bg-white/2"
                      )}
                    >
                      {/* Premium vertical accent bar matching the user's mockup */}
                      <div
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl transition-all duration-300",
                          active
                            ? (tab.id === 'documents' ? "bg-violet-600 dark:bg-violet-400 shadow-[2px_0_10px_rgba(139,92,246,0.4)]"
                              : tab.id === 'analytics' ? "bg-emerald-600 dark:bg-emerald-400 shadow-[2px_0_10px_rgba(16,185,129,0.4)]"
                                : "bg-orange-600 dark:bg-orange-400 shadow-[2px_0_10px_rgba(249,115,22,0.4)]")
                            : "bg-slate-200/60 dark:bg-zinc-800/40"
                        )}
                      />

                      <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-3 min-w-0 pl-1.5 lg:pl-2">
                        <div className={cn(
                          "w-8 h-8 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300",
                          tab.colorClass,
                          active
                            ? "scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                            : "group-hover/tab:scale-110 group-hover/tab:rotate-3 group-active/tab:scale-95"
                        )}>
                          <Icon className={cn(
                            "w-4 h-4 lg:w-4.5 lg:h-4.5 shrink-0 transition-all duration-300",
                            active && tab.id === 'documents' ? "animate-folder-pop text-violet-600 dark:text-violet-300" : ""
                          )} />
                        </div>

                        <div className="min-w-0 flex flex-col items-center lg:items-start">
                          <span className={cn(
                            "text-[9px] lg:text-xs font-black tracking-wider uppercase transition-colors duration-300",
                            active ? tab.activeText : "text-slate-800 dark:text-zinc-300"
                          )}>
                            <span className="lg:hidden">{tab.label}</span>
                            <span className="hidden lg:inline">{tab.desktopLabel}</span>
                          </span>
                          <span className="hidden lg:inline text-[9px] text-muted-foreground font-semibold mt-0.5 truncate max-w-[130px] lg:max-w-[110px] xl:max-w-[140px]">
                            {tab.desc}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className={cn(
                        "hidden lg:inline w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0 transition-all duration-300",
                        active ? cn("scale-110", tab.activeText) : "group-hover/tab:translate-x-1"
                      )} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Premium "MONTHLY OVERVIEW" Bar Chart Widget */}
            {(() => {
              const monthOptions = getMonthOptions();

              // Filter invoices for the specifically selected month
              const monthlyInvoices = invoices.filter(inv => {
                if (!inv.billDate) return false;
                return inv.billDate.startsWith(selectedMonthYear);
              });

              // Create daily buckets exactly as the user requested
              const dailyBuckets = [
                { label: "01", days: [1, 2, 3], count: 0, revenue: 0 },
                { label: "05", days: [4, 5, 6, 7], count: 0, revenue: 0 },
                { label: "10", days: [8, 9, 10, 11, 12], count: 0, revenue: 0 },
                { label: "15", days: [13, 14, 15, 16, 17], count: 0, revenue: 0 },
                { label: "20", days: [18, 19, 20, 21, 22], count: 0, revenue: 0 },
                { label: "25", days: [23, 24, 25, 26, 27], count: 0, revenue: 0 },
                { label: "30", days: [28, 29, 30, 31], count: 0, revenue: 0 }
              ];

              monthlyInvoices.forEach(inv => {
                if (!inv.billDate) return;
                const day = new Date(inv.billDate).getDate();
                const bucket = dailyBuckets.find(b => b.days.includes(day));
                if (bucket) {
                  bucket.count += 1;
                  bucket.revenue += inv.grandTotal;
                }
              });

              // Totals for the selected month
              const selectedMonthTotalInvoices = monthlyInvoices.length;
              const selectedMonthTotalAmount = monthlyInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

              const CustomTooltip = ({ active, payload, label }: any) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-xl">
                      <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 mb-2">Days {label}</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-violet-500" />
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Invoices:</span>
                          <span className="text-[10px] font-black text-slate-900 dark:text-white ml-auto">{payload[0]?.value}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Amount:</span>
                          <span className="text-[10px] font-black text-slate-900 dark:text-white ml-auto">₹ {formatCurrency(payload[1]?.value || 0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              };

              // To format Y Axis
              const formatYAxisCount = (val: number) => val.toString();
              const formatYAxisAmount = (val: number) => {
                if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
                return `₹${val}`;
              };

              return (
                <div className="hidden lg:flex glass-panel rounded-[20px] border border-white/20 dark:border-white/5 p-3 bg-white dark:bg-zinc-950/40 backdrop-blur-xl shadow-sm flex-col w-full text-left relative overflow-visible select-none">

                  {/* Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-white/5 mb-2.5 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600 shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h2 className="text-[13px] font-black text-slate-900 dark:text-white leading-tight">Monthly<br />Overview</h2>
                      </div>
                    </div>

                    {/* Premium custom month selector dropdown */}
                    <div className="relative text-left flex items-center justify-end z-50">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOverviewDropdown(!showOverviewDropdown);
                        }}
                        className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-800 dark:text-zinc-200 outline-none cursor-pointer flex items-center gap-1 hover:border-violet-300 dark:hover:border-violet-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all select-none"
                      >
                        <span>{monthOptions.find(([k]) => k === selectedMonthYear)?.[1] || "Select Month"}</span>
                        <ChevronDown className={cn("w-2.5 h-2.5 text-slate-500 transition-transform duration-200", showOverviewDropdown && "rotate-180")} />
                      </button>

                      {showOverviewDropdown && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowOverviewDropdown(false);
                            }}
                          />
                          <div
                            className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl flex flex-col min-w-[120px] max-h-[200px] overflow-y-auto text-left animate-in fade-in zoom-in-95 duration-100 select-none custom-scrollbar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {monthOptions.map(([key, val]) => {
                              const isSelected = key === selectedMonthYear;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setSelectedMonthYear(key);
                                    setShowOverviewDropdown(false);
                                  }}
                                  className={cn(
                                    "flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-left transition-all cursor-pointer border-none outline-none select-none",
                                    isSelected
                                      ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                                      : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                  )}
                                >
                                  <span>{val}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chart Legends */}
                  <div className="flex items-center justify-center gap-2.5 pb-2.5">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                      <span className="text-[9px] font-bold text-slate-800 dark:text-zinc-200">Invoices</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[9px] font-bold text-slate-800 dark:text-zinc-200">Amount (₹)</span>
                    </div>
                  </div>

                  {/* Recharts ComposedChart - Daily Data */}
                  <div className="w-full h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dailyBuckets} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorInvoicesOverview" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600 }}
                          dy={8}
                        />
                        <YAxis
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8b5cf6', fontSize: 9, fontWeight: 700 }}
                          tickFormatter={formatYAxisCount}
                          dx={-4}
                          width={24}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#10b981', fontSize: 9, fontWeight: 700 }}
                          tickFormatter={formatYAxisAmount}
                          dx={4}
                          width={48}
                        />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(200,200,200,0.05)' }} />
                        <Bar
                          yAxisId="left"
                          dataKey="count"
                          fill="url(#colorInvoicesOverview)"
                          barSize={12}
                          radius={[3, 3, 3, 3]}
                        >
                          <LabelList dataKey="count" position="top" fill="#8b5cf6" fontSize={9} fontWeight={800} offset={3} />
                        </Bar>
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="revenue"
                          stroke="#10b981"
                          strokeWidth={1.5}
                          dot={{ r: 2.5, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }}
                          activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bottom Summary Cards - Ultra Compact Horizontal */}
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    {/* Total Invoices Card */}
                    <div className="bg-violet-50/50 dark:bg-violet-500/5 rounded-xl p-2.5 flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-violet-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start text-left min-w-0">
                        <p className="text-[9px] font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider truncate w-full">Invoices</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <p className="text-[13px] font-black text-slate-900 dark:text-white leading-none truncate">{selectedMonthTotalInvoices}</p>
                          <span className={cn(
                            "px-1 py-[1px] rounded text-[7.5px] font-black flex items-center gap-0.5",
                            countChangePercent >= 0 ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                          )}>
                            {countChangePercent >= 0 ? <TrendingUp className="w-1.5 h-1.5" /> : <TrendingDown className="w-1.5 h-1.5" />}
                            {Math.abs(countChangePercent)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Total Amount Card */}
                    <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-xl p-2.5 flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start text-left min-w-0">
                        <p className="text-[9px] font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider truncate w-full">Amount</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <p className="text-[13px] font-black text-emerald-600 leading-none truncate">₹{formatCurrency(selectedMonthTotalAmount)}</p>
                          <span className={cn(
                            "px-1 py-[1px] rounded text-[7.5px] font-black flex items-center gap-0.5",
                            revenueChangePercent >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                          )}>
                            {revenueChangePercent >= 0 ? <TrendingUp className="w-1.5 h-1.5" /> : <TrendingDown className="w-1.5 h-1.5" />}
                            {Math.abs(revenueChangePercent)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right Column: Main Dynamic Canvas Dashboard */}
          <div className="lg:col-span-3 space-y-6">

            {/* Hidden File Input for Native File Chooser */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv,.pdf,image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {/* KPI Cards Grid - 3-column compact layout on mobile, spacious grid on desktop! */}
            {invoices.length === 0 ? (
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-transparent to-emerald-500/5 text-left relative overflow-hidden shadow-xl space-y-6 select-none">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200/60 dark:border-white/10 pb-6">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Welcome to Commercial Tax Billing</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Ready to Create or Import Your First Invoice?
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 font-medium leading-relaxed">
                      Your live revenue analytics, monthly billing growth, automated GST tax reports, and Google Drive cloud backups will automatically activate here as soon as you create or import your first document.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
                    <button
                      onClick={onCreateNew}
                      className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-extrabold py-3 px-5 rounded-2xl transition-all cursor-pointer shadow-lg shadow-violet-500/25 active:scale-98 text-xs uppercase tracking-wider"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Tax Invoice</span>
                    </button>
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                          fileInputRef.current.click();
                        }
                      }}
                      className="flex items-center justify-center gap-2 border border-violet-300 dark:border-violet-800/80 bg-violet-50/50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 font-extrabold py-3 px-5 rounded-2xl transition-all cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                      {isImporting ? <Loader2 className="w-4 h-4 animate-spin text-violet-600" /> : <FileSpreadsheet className="w-4 h-4" />}
                      <span>{isImporting ? "Parsing File..." : "Import Excel / PDF"}</span>
                    </button>
                  </div>
                </div>

                {/* 3 Interactive Highlight Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">1. Revenue Analytics</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Track paid vs unpaid status, overdue notifications, and monthly growth trends.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">2. GST Tax Breakdown</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Automated calculations for CGST, SGST, IGST collections and tax export reports.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      <CloudUpload className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">3. Google Drive Backups</h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Every generated PDF is synced and safely archived directly to your Google Drive.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
                {(() => {
                  const todayStr = new Date().toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                  const today = new Date();
                  const todayInvoices = invoices.filter(inv => {
                    if (!inv.createdAt) return false;
                    const invDate = new Date(inv.createdAt);
                    return invDate.getDate() === today.getDate() &&
                      invDate.getMonth() === today.getMonth() &&
                      invDate.getFullYear() === today.getFullYear() &&
                      !inv.isDeleted;
                  });
                  const todayCreatedBills = todayInvoices.length;
                  const todayRevenue = todayInvoices.filter(i => !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0);
                  const todaySynced = todayInvoices.filter(i => i.driveUrl).length;

                  return (
                    <>
                      {/* Total Invoices */}
                      <div
                        onClick={() => setActiveAnalyticsModal('invoices')}
                        className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/20 dark:border-white/5 flex flex-col shadow-sm hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-violet-500/50 select-none bg-white dark:bg-zinc-950/40"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-650 dark:text-violet-400 shrink-0">
                              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div>
                              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Invoices</p>
                            </div>
                          </div>
                          <div className="px-2.5 py-1 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-full text-[9px] font-bold text-slate-600 dark:text-zinc-400 uppercase">
                            {todayStr}: {todayCreatedBills} Bills
                          </div>
                        </div>

                        <div className="flex justify-between items-end mt-4 sm:mt-5 relative z-10">
                          <div>
                            <p className="text-3xl sm:text-4xl font-black leading-none text-slate-900 dark:text-white">
                              {yearlyAnalytics.totalInvoices}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-zinc-400">{displayMonthLabel}</span>
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                countChangePercent >= 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-red-500 bg-red-50 dark:bg-red-500/10 dark:text-red-400"
                              )}>
                                {countChangePercent >= 0 ? `+${countChangePercent}%` : `${countChangePercent}%`}
                              </span>
                            </div>
                          </div>
                          <div className="w-24 sm:w-32 h-12 sm:h-16 shrink-0 -mr-2 relative z-0">
                            {renderKpiSparkline(yearlyAnalytics.data, 'count', '#8B5CF6', 'sparkline-invoices', 'sparkline-invoices', currentMonth)}
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-4 gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-violet-500"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Created</span></div>
                            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{currentMonthInvoices.filter(i => (i.invoiceType === "manual" || !i.invoiceType) && !i.isImported && !i.importSource && !i.isDeleted).length}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Imported</span></div>
                            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{currentMonthInvoices.filter(i => (i.invoiceType === "imported" || i.isImported || !!i.importSource) && !i.isDeleted).length}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Cancelled</span></div>
                            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{currentMonthInvoices.filter(i => (i.status === "cancelled" || i.isCancelled) && !i.isDeleted).length}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-red-400"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Deleted</span></div>
                            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{currentMonthInvoices.filter(i => i.isDeleted).length}</div>
                          </div>
                        </div>
                      </div>

                      {/* Billed Revenue */}
                      <div
                        onClick={() => setActiveAnalyticsModal('revenue')}
                        className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/20 dark:border-white/5 flex flex-col shadow-sm hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-emerald-500/50 select-none bg-white dark:bg-zinc-950/40"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-650 dark:text-emerald-400 shrink-0">
                              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div>
                              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Revenue</p>
                            </div>
                          </div>
                          <div className="px-2.5 py-1 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-full text-[9px] font-bold text-slate-600 dark:text-zinc-400 uppercase">
                            {todayStr}: ₹ {formatCurrency(Math.round(todayRevenue))}
                          </div>
                        </div>

                        <div className="flex justify-between items-end mt-4 sm:mt-5 relative z-10">
                          <div>
                            <p className="text-2xl sm:text-[28px] lg:text-3xl font-black leading-none text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                              ₹ {formatCurrency(Math.round(yearlyAnalytics.totalRevenue))}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-zinc-400">{displayMonthLabel}</span>
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded",
                                revenueChangePercent >= 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-red-500 bg-red-50 dark:bg-red-500/10 dark:text-red-400"
                              )}>
                                {revenueChangePercent >= 0 ? `+${revenueChangePercent}%` : `${revenueChangePercent}%`}
                              </span>
                            </div>
                          </div>
                          <div className="w-24 sm:w-32 h-12 sm:h-16 shrink-0 -mr-2 relative z-0">
                            {renderKpiSparkline(yearlyAnalytics.data, 'revenue', '#10B981', 'sparkline-revenue', 'sparkline-revenue', currentMonth)}
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-3 gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Paid</span></div>
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">₹ {formatCurrency(Math.round(currentMonthInvoices.filter(i => (i.status === "paid" || i.paymentStatus === "paid") && !i.isDeleted && !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0)))}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-emerald-300"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Unpaid</span></div>
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">₹ {formatCurrency(Math.round(currentMonthInvoices.filter(i => (i.status === "draft" || i.status === "sent" || i.paymentStatus === "unpaid") && !i.isDeleted && !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0)))}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Overdue</span></div>
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">₹ {formatCurrency(Math.round(currentMonthInvoices.filter(i => isInvoiceOverdue(i) && !i.isDeleted && !i.isCancelled && i.status !== "paid").reduce((acc, curr) => acc + curr.grandTotal, 0)))}</div>
                          </div>
                        </div>
                      </div>

                      {/* Drive Backups */}
                      <div
                        onClick={() => setActiveAnalyticsModal('backups')}
                        className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/20 dark:border-white/5 flex flex-col shadow-sm hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-blue-500/50 select-none bg-white dark:bg-zinc-950/40"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                              <CloudUpload className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div>
                              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Backups</p>
                            </div>
                          </div>
                          <div className="px-2.5 py-1 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-white/5 rounded-full text-[9px] font-bold text-slate-600 dark:text-zinc-400 uppercase">
                            {todayStr}: {todaySynced} / {todayCreatedBills}
                          </div>
                        </div>

                        <div className="flex justify-between items-end mt-4 sm:mt-5 relative z-10">
                          <div>
                            <p className="text-3xl sm:text-4xl font-black leading-none text-slate-900 dark:text-white">
                              {yearlyAnalytics.totalSynced} <span className="text-xl sm:text-2xl text-slate-300 dark:text-zinc-700">/ {yearlyAnalytics.totalInvoices}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-zinc-400">Synced {displayMonthLabel}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400">
                                {yearlyAnalytics.totalInvoices > 0 ? Math.round((yearlyAnalytics.totalSynced / yearlyAnalytics.totalInvoices) * 100) : 0}% rate
                              </span>
                            </div>
                          </div>
                          <div className="w-24 sm:w-32 h-12 sm:h-16 shrink-0 -mr-2 relative z-0">
                            {renderKpiSparkline(yearlyAnalytics.data, 'synced', '#3B82F6', 'sparkline-drive', 'sparkline-drive', currentMonth)}
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-3 gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Synced</span></div>
                            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{currentMonthInvoices.filter(i => i.driveUrl && !i.isDeleted).length}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-violet-500"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Pending</span></div>
                            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{currentMonthInvoices.filter(i => !i.driveUrl && !i.isDeleted).length}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-zinc-400">Failed</span></div>
                            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">0</div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Mobile-Only Quick Access Segmented Card - Placed cleanly below KPI Cards! */}
            <div className="flex lg:hidden glass-panel rounded-3xl border border-white/20 dark:border-white/5 p-4 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl shadow-sm flex-col w-full relative overflow-hidden select-none">
              <div className="flex items-center gap-2 px-2 py-3 border-b border-slate-100 dark:border-white/5 shrink-0 select-none mb-3">
                <FolderOpen className="w-4 h-4 text-violet-500 dark:text-violet-400 shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-zinc-200">Quick Access</span>
              </div>

              <div className="grid grid-cols-3 gap-2 relative">
                {[
                  {
                    id: 'documents',
                    label: 'Folders',
                    icon: FolderOpen,
                    colorClass: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-500/20 border-violet-500/10',
                    activeBorderColor: 'border-t-violet-600 dark:border-t-violet-500',
                    activeText: 'text-violet-600 dark:text-violet-400',
                    activeBg: 'bg-gradient-to-tr from-violet-500/10 to-indigo-500/5 dark:from-violet-500/20 dark:to-indigo-500/10 border-violet-500/30 shadow-[0_4px_20px_rgba(139,92,246,0.15)] dark:shadow-[0_4px_20px_rgba(139,92,246,0.25)]'
                  },
                  {
                    id: 'analytics',
                    label: 'Reports',
                    icon: TrendingUp,
                    colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/10',
                    activeBorderColor: 'border-t-emerald-600 dark:border-t-emerald-500',
                    activeText: 'text-emerald-600 dark:text-emerald-400',
                    activeBg: 'bg-gradient-to-tr from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/20 dark:to-teal-500/10 border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.15)] dark:shadow-[0_4px_20px_rgba(16,185,129,0.25)]'
                  },
                  {
                    id: 'crm',
                    label: 'Customers',
                    icon: Users,
                    colorClass: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/10',
                    activeBorderColor: 'border-t-orange-600 dark:border-t-orange-500',
                    activeText: 'text-orange-600 dark:text-orange-400',
                    activeBg: 'bg-gradient-to-tr from-orange-500/10 to-amber-500/5 dark:from-orange-500/20 dark:to-amber-500/10 border-orange-500/30 shadow-[0_4px_20px_rgba(249,115,22,0.15)] dark:shadow-[0_4px_20px_rgba(249,115,22,0.25)]'
                  }
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = activeSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveSubTab(tab.id as any);
                        if (tab.id === 'crm') {
                          loadCrmCustomers();
                        }
                      }}
                      className={cn(
                        "flex flex-col justify-center gap-2 px-2 py-3 rounded-2xl cursor-pointer select-none text-center relative group/tab outline-none border-t-2 transition-all duration-200 transform active:scale-95 active:brightness-95 active:duration-75 touch-manipulation",
                        active
                          ? cn(tab.activeBorderColor, tab.activeBg)
                          : "border-transparent bg-slate-50/20 dark:bg-zinc-900/10 border border-slate-100/50 dark:border-white/5 hover:bg-slate-50/30 dark:hover:bg-white/2"
                      )}
                    >
                      <div className="flex flex-col items-center gap-2 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
                          tab.colorClass,
                          active
                            ? "scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                            : "group-hover/tab:scale-110 group-hover/tab:rotate-3 group-active/tab:scale-95"
                        )}>
                          <Icon className="w-4.5 h-4.5 shrink-0 transition-transform duration-300 group-active/tab:scale-90" />
                        </div>

                        <div className="min-w-0 flex flex-col items-center">
                          <span className={cn(
                            "text-[9px] font-black tracking-wider uppercase transition-colors duration-300",
                            active ? tab.activeText : "text-slate-800 dark:text-zinc-300"
                          )}>
                            {tab.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeSubTab === 'documents' && (
              <>
                {/* Unified Control Console: Search, Filters, and View Switcher */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 select-none w-full pt-1.5 pb-1">
                  <div className="flex items-center gap-2 w-full lg:w-auto flex-1">
                    {/* Search Bar */}
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-zinc-500" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search client name, PO number, or invoice ID..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-900/40 focus:border-violet-500 dark:focus:border-violet-500 focus:bg-white dark:focus:bg-zinc-900/80 outline-none transition-all text-slate-900 dark:text-white font-medium text-xs placeholder-slate-400 dark:placeholder-zinc-500 shadow-inner"
                      />
                    </div>

                    {/* Mobile Filter Dropdown - Custom Designed & High-End! */}
                    <div className="relative lg:hidden shrink-0">
                      <div className="relative">
                        {/* Visual Trigger Button */}
                        <button
                          type="button"
                          onClick={() => setShowPaymentFilterDropdown(!showPaymentFilterDropdown)}
                          className={cn(
                            "h-[38px] px-3.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 outline-none select-none",
                            paymentFilter === 'all'
                              ? "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300"
                              : paymentFilter === 'overdue'
                                ? "bg-red-600 border-red-650 text-white shadow-md shadow-red-500/20"
                                : paymentFilter === 'paid'
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                  : "bg-violet-650 border-violet-650 text-white shadow-md shadow-violet-500/20"
                          )}
                        >
                          <Filter className="w-3.5 h-3.5 shrink-0" />
                          <span className="max-w-[75px] truncate">
                            {paymentFilter === 'all' && 'All'}
                            {paymentFilter === 'draft' && 'Drafts'}
                            {paymentFilter === 'sent' && 'Sent'}
                            {paymentFilter === 'paid' && 'Paid'}
                            {paymentFilter === 'overdue' && 'Overdue'}
                          </span>
                          <ChevronDown className={cn("w-3 h-3 opacity-60 shrink-0 transition-transform duration-200", showPaymentFilterDropdown && "rotate-180")} />
                        </button>

                        {/* Click Away Overlay Backing */}
                        {showPaymentFilterDropdown && (
                          <div
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={() => setShowPaymentFilterDropdown(false)}
                          />
                        )}

                        {/* Gorgeous Custom Dropdown Panel */}
                        {showPaymentFilterDropdown && (
                          <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-black/40 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 origin-top-right select-none">
                            {[
                              { id: 'all', label: 'All Invoices', count: invoices.length, themeClass: 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300', activeClass: 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border-slate-200 dark:border-white/10' },
                              { id: 'draft', label: 'Drafts', count: invoices.filter(i => i.status === 'draft').length, themeClass: 'hover:bg-violet-500/5 dark:hover:bg-violet-500/10 text-slate-700 dark:text-zinc-300', activeClass: 'bg-violet-650 border-violet-650 text-white shadow-md shadow-violet-500/20' },
                              { id: 'sent', label: 'Sent / Pending', count: invoices.filter(i => i.status === 'sent' && !isInvoiceOverdue(i)).length, themeClass: 'hover:bg-violet-500/5 dark:hover:bg-violet-500/10 text-slate-700 dark:text-zinc-300', activeClass: 'bg-violet-650 border-violet-650 text-white shadow-md shadow-violet-500/20' },
                              { id: 'paid', label: 'Paid', count: invoices.filter(i => i.status === 'paid').length, themeClass: 'hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 text-slate-700 dark:text-zinc-300', activeClass: 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20' },
                              { id: 'overdue', label: 'Overdue', count: invoices.filter(i => isInvoiceOverdue(i)).length, themeClass: 'hover:bg-red-500/5 dark:hover:bg-red-500/10 text-slate-700 dark:text-zinc-300', activeClass: 'bg-red-650 border-red-650 text-white shadow-md shadow-red-500/20' }
                            ].map(item => {
                              const isSelected = paymentFilter === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setPaymentFilter(item.id as any);
                                    setShowPaymentFilterDropdown(false);
                                  }}
                                  className={cn(
                                    "w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 cursor-pointer outline-none border active:scale-98 select-none text-left mb-0.5 last:mb-0",
                                    isSelected
                                      ? item.activeClass
                                      : cn("border-transparent", item.themeClass)
                                  )}
                                >
                                  <span>{item.label}</span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-black leading-none shrink-0",
                                    isSelected
                                      ? "bg-white/20 text-white"
                                      : "bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-zinc-400"
                                  )}>
                                    {item.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Filters & View Switcher Row - Desktop Only */}
                  <div className="hidden lg:flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto shrink-0">
                    {/* Payment Status Filter Chips */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                      {[
                        { id: 'all', label: 'All Invoices', count: invoices.length },
                        { id: 'draft', label: 'Drafts', count: invoices.filter(i => i.status === 'draft').length },
                        { id: 'sent', label: 'Sent / Pending', count: invoices.filter(i => i.status === 'sent' && !isInvoiceOverdue(i)).length },
                        { id: 'paid', label: 'Paid', count: invoices.filter(i => i.status === 'paid').length },
                        { id: 'overdue', label: 'Overdue 🔔', count: invoices.filter(i => isInvoiceOverdue(i)).length }
                      ].map(chip => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => setPaymentFilter(chip.id as any)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0",
                            paymentFilter === chip.id
                              ? chip.id === 'overdue'
                                ? "bg-red-650 border-red-650 text-white shadow-lg shadow-red-500/20"
                                : chip.id === 'paid'
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                                  : "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/20"
                              : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10"
                          )}
                        >
                          <span>{chip.label}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black leading-none",
                            paymentFilter === chip.id
                              ? "bg-white/20 text-white"
                              : "bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-zinc-400"
                          )}>
                            {chip.count}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Grid vs List Toggles */}
                    <div className="hidden sm:flex shrink-0 relative group/tooltip">
                      <button
                        onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
                        className="w-9 h-9 rounded-xl text-violet-500 dark:text-violet-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-violet-500 dark:hover:border-violet-500 transition-all duration-300 flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
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
                </div>

                {/* Folders Navigation Bar (Drag & Drop Drop-zone Targets!) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1 border-b border-white/5 pb-2">
                    <h2 className="text-xs font-extrabold tracking-wider uppercase text-violet-400 flex items-center gap-2 select-none">
                      <FolderOpen className="w-4 h-4 text-violet-500" />
                      <span>Invoice Categories</span>
                    </h2>

                    {/* Desktop Right Side: New Category button only */}
                    <div className="hidden sm:flex items-center">
                      <button
                        onClick={() => setShowAddFolderModal(true)}
                        className="flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer bg-violet-500/5 hover:bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/10"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>New Category</span>
                      </button>
                    </div>

                    {/* Mobile Right Side: Compact premium icon row for View Switcher + New Folder */}
                    <div className="flex sm:hidden items-center gap-1.5">
                      {/* New Folder Icon Button */}
                      <div className="relative group/tooltip flex items-center justify-center">
                        <button
                          onClick={() => setShowAddFolderModal(true)}
                          className="p-2 rounded-xl text-violet-400 bg-violet-500/5 active:bg-violet-500/10 border border-violet-500/10 transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                        >
                          <FolderPlus className="w-4 h-4" />
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-900/90 border border-white/10 px-2.5 py-1 text-[9px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                          New Category
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
                            <LayoutGrid className="w-4 h-4" />
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
                        const invoiceId = e.dataTransfer.getData("text/plain");
                        if (invoiceId) {
                          await moveInvoiceToFolder(invoiceId, null);
                        }
                      }}
                      onClick={() => setActiveFolderId("all")}
                      className={cn(
                        "flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none sm:shrink-0 w-full sm:w-auto sm:min-w-[130px] relative shadow-sm group/all",
                        activeFolderId === "all"
                          ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/20 scale-[1.01]"
                          : "bg-background/40 hover:bg-muted/40 border-border/40 text-foreground hover:-translate-y-0.5 hover:border-violet-500/45 hover:shadow-md hover:shadow-violet-500/5",
                        draggedOverFolderId === "all" && "border-dashed border-violet-600 ring-2 ring-violet-500/40 bg-violet-500/10 scale-[1.03]"
                      )}
                    >
                      <FolderIcon className={cn("w-4.5 h-4.5 shrink-0 transition-transform duration-300", activeFolderId === "all" ? "" : "group-hover/all:scale-110 group-hover/all:rotate-3")} />
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-xs font-bold leading-tight truncate">All Bills</p>
                        <p className={cn("text-[10px] font-semibold mt-0.5", activeFolderId === "all" ? "text-white/80" : "text-zinc-400 dark:text-zinc-500")}>
                          {invoices.length} files
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
                        showToast("Cannot move invoices here. Drafts folder is updated automatically based on status.", "error");
                      }}
                      onClick={() => setActiveFolderId("drafts")}
                      className={cn(
                        "flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none sm:shrink-0 w-full sm:w-auto sm:min-w-[130px] relative shadow-sm group/drafts",
                        activeFolderId === "drafts"
                          ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/20 scale-[1.01]"
                          : "bg-background/40 hover:bg-muted/40 border-border/40 text-foreground hover:-translate-y-0.5 hover:border-violet-500/45 hover:shadow-md hover:shadow-violet-500/5",
                        draggedOverFolderId === "drafts-blocked" && "border-dashed border-destructive ring-2 ring-destructive/40 bg-destructive/10 text-destructive scale-[1.03]"
                      )}
                    >
                      <FileText className={cn("w-4.5 h-4.5 shrink-0 transition-transform duration-300", activeFolderId === "drafts" ? "" : "group-hover/drafts:scale-110 group-hover/drafts:rotate-3")} />
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-xs font-bold leading-tight truncate">Drafts</p>
                        <p className={cn("text-[10px] font-semibold mt-0.5", activeFolderId === "drafts" ? "text-white/80" : "text-zinc-400 dark:text-zinc-500")}>
                          {invoices.filter((i) => i.status === "draft").length} files
                        </p>
                      </div>
                    </div>

                    {/* Custom User Folders */}
                    {folders.map((folder, index) => {
                      const count = invoices.filter((i) => i.folderId === folder.id).length;
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
                            const invoiceId = e.dataTransfer.getData("text/plain");
                            if (invoiceId) {
                              await moveInvoiceToFolder(invoiceId, folder.id);
                            }
                          }}
                          onClick={() => setActiveFolderId(folder.id)}
                          className={cn(
                            "flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none sm:shrink-0 w-full sm:w-auto sm:min-w-[140px] relative group/folder shadow-sm",
                            isActive
                              ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/20 scale-[1.01]"
                              : "bg-background/40 hover:bg-muted/40 border-border/40 text-foreground hover:-translate-y-0.5 hover:border-violet-500/45 hover:shadow-md hover:shadow-violet-500/5",
                            isDraggedOver && "border-dashed border-violet-600 ring-2 ring-violet-500/40 bg-violet-500/10 scale-[1.03]",
                            isHiddenOnMobile && "hidden sm:flex"
                          )}
                        >
                          <FolderIcon className={cn("w-4.5 h-4.5 text-amber-500 shrink-0 transition-transform duration-300", isActive ? "text-amber-200" : "group-hover/folder:scale-110 group-hover/folder:rotate-3")} />
                          <div className="text-left min-w-0 flex-1 pr-4">
                            <p className="text-xs font-bold leading-tight truncate">{folder.name}</p>
                            <p className={cn("text-[10px] font-semibold mt-0.5", isActive ? "text-white/80" : "text-zinc-400 dark:text-zinc-500")}>
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/5 dark:bg-violet-500/5 hover:bg-violet-500/10 dark:hover:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/10 text-[10px] font-extrabold uppercase tracking-wide transition-all active:scale-95 cursor-pointer shadow-sm"
                      >
                        <span>{showAllFoldersOnMobile ? "Show Less" : `Show More (${folders.length - 2} ${folders.length - 2 === 1 ? "folder" : "folders"})`}</span>
                        {showAllFoldersOnMobile ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Dashboard Grid cards or table row panels */}
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-violet-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-zinc-500 text-xs font-bold animate-pulse">Synchronizing invoices...</p>
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-violet-500/20 dark:border-white/10 rounded-[32px] bg-[#fcfaff] dark:bg-zinc-950/20 space-y-4 shadow-sm">
                    <AlertCircle className="w-10 h-10 mx-auto text-violet-500 dark:text-zinc-500" />
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white">No Tax Invoices found</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Start by drafting your first commercial Tax Invoice bill above.</p>
                    </div>

                    <button
                      onClick={onCreateNew}
                      className="py-2.5 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.97]"
                    >
                      Create Invoice
                    </button>
                  </div>
                ) : viewMode === "grid" ? (
                  /* Canva aspect-[4/3] grid cards styled in dark-violet */
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {filteredInvoices.map((inv) => {
                      const relativeTime = formatRelativeTime(inv.createdAt);

                      return (
                        <div
                          key={inv.id}
                          draggable={true}
                          onDragEnd={() => {
                            setDraggableInvoiceId(null);
                            setDraggedOverFolderId(null);
                          }}
                          onClick={(e) => {
                            onEdit(inv);
                          }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", inv.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className="glass-panel rounded-3xl border border-violet-500/15 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md shadow-sm flex flex-col transition-all hover:-translate-y-1.5 hover:shadow-xl relative group cursor-pointer"
                        >
                          {/* Aspect Ratio Preview Header */}
                          <div className="aspect-[4/3] w-full bg-gradient-to-tr from-violet-600/10 via-violet-500/5 to-emerald-500/10 dark:from-violet-950/20 dark:to-emerald-950/20 relative flex items-center justify-center p-4 border-b border-violet-500/10 dark:border-white/5 overflow-hidden rounded-t-[22px]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(139,92,246,0.15),transparent_50%),radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.1),transparent_40%)]" />

                            {/* The Micro A4 Sheet representation */}
                            <div className="w-[80px] sm:w-[110px] h-[110px] sm:h-[150px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg shadow-lg relative p-1 sm:p-2 flex flex-col justify-between overflow-hidden scale-[1.02] sm:scale-[1.05] group-hover:scale-[1.1] transition-transform duration-300 origin-center select-none pointer-events-none">
                              {/* Micro Header */}
                              <div className="w-full flex items-center justify-between mb-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-1 shrink-0">
                                <div className="flex items-center gap-0.5">
                                  <div className="w-2 h-2 rounded bg-violet-600 flex items-center justify-center text-[5px] text-white font-black">D</div>
                                  <div className="w-8 h-1 bg-zinc-800 dark:bg-zinc-200 rounded" />
                                </div>
                                <div className="w-5 h-1 bg-zinc-400 dark:bg-zinc-600 rounded" />
                              </div>

                              {/* Micro Recipient */}
                              <div className="space-y-1 mb-1.5 shrink-0">
                                <div className="w-[60%] h-1 bg-zinc-300 dark:bg-zinc-700 rounded" />
                                <div className="w-[45%] h-[3px] bg-zinc-200 dark:bg-zinc-800 rounded" />
                              </div>

                              {/* Micro Table */}
                              <div className="border border-zinc-100 dark:border-zinc-800 rounded-sm overflow-hidden flex-1 mb-1.5 flex flex-col justify-start">
                                <div className="p-1 space-y-1">
                                  <div className="flex justify-between items-center">
                                    <div className="w-10 h-0.5 bg-zinc-200 dark:bg-zinc-700 rounded" />
                                    <div className="w-3 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <div className="w-7 h-0.5 bg-zinc-200 dark:bg-zinc-700 rounded" />
                                    <div className="w-4 h-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
                                  </div>
                                </div>
                              </div>

                              {/* Micro Totals */}
                              <div className="flex justify-between items-end border-t border-zinc-100 dark:border-zinc-800 pt-1 shrink-0">
                                <div className="space-y-0.5">
                                  <div className="w-[18px] h-1 bg-violet-600/75 rounded" />
                                </div>
                                <div className="flex flex-col items-center">
                                  <svg className="w-6 h-2 text-violet-500 shrink-0 opacity-70" viewBox="0 0 24 8" fill="none" stroke="currentColor" strokeWidth="0.8">
                                    <path d="M2 5c2-3 4-1 6-3s3 4 5 1" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Pinned Star Toggle Button */}
                          <div className="absolute top-2.5 left-2.5 z-20 group/tooltip">
                            <button
                              onClick={(e) => handleTogglePin(e, inv)}
                              className={cn(
                                "p-1.5 rounded-xl border shadow-sm transition-all cursor-pointer",
                                inv.isPinned
                                  ? "bg-amber-500 text-white border-amber-500 scale-100 opacity-100"
                                  : "bg-background/80 hover:bg-background border-border/10 text-muted-foreground hover:text-amber-500 scale-95 opacity-0 group-hover:opacity-100 hover:scale-100"
                              )}
                            >
                              <Star className={cn("w-4 h-4", inv.isPinned && "fill-current")} />
                            </button>
                            {/* Custom designed premium tooltip */}
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-2.5 py-1 text-[9px] text-white tooltip-text font-extrabold tracking-wide whitespace-nowrap z-50 shadow-xl origin-bottom backdrop-blur-sm">
                              {inv.isPinned ? "Unpin from Top" : "Pin to Top"}
                            </span>
                          </div>

                          {/* Absolute menu trigger */}
                          <div className="absolute top-2.5 right-2.5 z-20 group/tooltip">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setShowFolderSubMenu(false);
                                setMobileActionsInvoice(mobileActionsInvoice?.id === inv.id ? null : inv);
                              }}
                              className={`actions-trigger-btn p-1.5 rounded-xl border shadow-sm transition-all cursor-pointer ${mobileActionsInvoice?.id === inv.id
                                ? "bg-violet-600 text-white border-violet-600"
                                : "bg-background/80 hover:bg-background border-border/10 text-muted-foreground hover:text-foreground"
                                }`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {/* Custom designed premium tooltip */}
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-900/95 border border-white/10 dark:border-white/5 px-2.5 py-1 text-[9px] text-white tooltip-text font-extrabold tracking-wide whitespace-nowrap z-50 shadow-xl origin-bottom backdrop-blur-sm">
                              More Actions
                            </span>
                          </div>

                          {/* Card Content body */}
                          <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 flex-1 flex flex-col justify-between relative text-left">
                            <div className="space-y-0.5">
                              <div className="flex items-center justify-between gap-1 sm:gap-2">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-[8px] sm:text-[9px] font-mono font-bold bg-violet-500/10 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 sm:px-2 py-0.5 rounded shrink-0">
                                    {inv.billNumber}
                                  </span>
                                  {inv.isImported && (
                                    <div className="relative group/tooltip inline-flex items-center">
                                      <span className={cn(
                                        "flex items-center gap-0.5 border px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shrink-0 cursor-default",
                                        inv.importSource === "pdf" ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" :
                                        inv.importSource === "jpeg" || inv.importSource === "jpg" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                                        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                      )}>
                                        {inv.importSource === "pdf" ? <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> :
                                         inv.importSource === "jpeg" || inv.importSource === "jpg" ? <FileImage className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> :
                                         <FileSpreadsheet className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                                        <span className="hidden sm:inline">
                                          {inv.importSource === "pdf" ? "PDF" : inv.importSource === "jpeg" || inv.importSource === "jpg" ? "JPG" : "Excel"}
                                        </span>
                                      </span>
                                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-800/95 border border-white/10 px-2.5 py-1 text-[10px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                                        Imported from {inv.importSource === "pdf" ? "PDF Document" : inv.importSource === "jpeg" || inv.importSource === "jpg" ? "JPG Image" : "Excel File"}
                                      </span>
                                    </div>
                                  )}
                                  {inv.poAttachmentUrl && (
                                    <div className="relative group/tooltip inline-flex items-center">
                                      <a
                                        href={inv.poAttachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-0.5 rounded hover:bg-violet-500/15 text-violet-500 dark:text-violet-400 shrink-0 transition-colors"
                                      >
                                        <Paperclip className="w-3.5 h-3.5" />
                                      </a>
                                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-800/95 border border-white/10 px-2.5 py-1 text-[10px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                                        PO Attached: {inv.poAttachmentName ? (inv.poAttachmentName.length > 25 ? inv.poAttachmentName.slice(0, 22) + '...' + (inv.poAttachmentName.split('.').pop() || '') : inv.poAttachmentName) : "PO document"}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Folder Badge Indicator with Tooltip */}
                                {inv.folderId && inv.folderId !== "drafts" && (
                                  <div className="relative group/tooltip flex items-center gap-0.5 sm:gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold min-w-0 shrink-0 select-none">
                                    <FolderIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 text-amber-500" />
                                    <span className="truncate max-w-[45px] sm:max-w-[65px]">
                                      {folders.find(f => f.id === inv.folderId)?.name || "Folder"}
                                    </span>

                                    {/* Visual Tooltip */}
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/90 dark:bg-zinc-800/90 border border-white/10 px-2.5 py-1 text-[10px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                                      Folder: {folders.find(f => f.id === inv.folderId)?.name || "Custom"}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <h4 className="font-extrabold text-[12px] sm:text-[14px] leading-snug text-foreground tracking-tight line-clamp-1 group-hover:text-violet-600 transition-colors mt-1.5 sm:mt-2">
                                {inv.billedTo.clientName}
                              </h4>
                              <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground line-clamp-1">
                                {inv.jobDescription}
                              </p>

                              {/* Canva-style A4 relative time metadata */}
                              <div className="flex items-center gap-1 sm:gap-1.5 mt-1 text-[8px] sm:text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                <span className="inline-flex items-center justify-center px-0.5 sm:px-1 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[7px] sm:text-[8px] rounded font-black tracking-normal">A4</span>
                                <span>•</span>
                                <span className="normal-case font-semibold text-muted-foreground/85 truncate max-w-[90px] sm:max-w-none">
                                  Edited {formatRelativeTime(inv.updatedAt || inv.createdAt || inv.billDate)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-border/20 pt-2 sm:pt-3 mt-0.5 sm:mt-1 shrink-0 flex-wrap gap-2">
                              <p className="font-mono font-black text-xs sm:text-sm text-foreground">₹ {formatCurrency(inv.grandTotal)}</p>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Custom visual payment tracker status */}
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0",
                                  isInvoiceOverdue(inv)
                                    ? "bg-red-500/10 text-red-500 animate-pulse border border-red-500/20"
                                    : inv.status === "draft"
                                      ? "bg-zinc-500/10 text-zinc-450 border border-zinc-500/20"
                                      : inv.status === "sent"
                                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        : inv.status === "paid"
                                          ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20"
                                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                )}>
                                  {isInvoiceOverdue(inv) ? "Overdue 🔔" : inv.status}
                                </span>

                                {inv.driveUrl ? (
                                  <a
                                    href={inv.driveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 rounded-full text-[8px] font-bold shrink-0 hover:bg-emerald-500/20 transition-colors"
                                  >
                                    <CheckCircle className="w-2.5 h-2.5 shrink-0" />
                                    <span>Synced</span>
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-[8px] font-bold shrink-0">
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Popover Bubble Menu relative to the card container */}
                          {mobileActionsInvoice?.id === inv.id && (
                            <div className="hidden md:block">
                              <div
                                className="fixed inset-0 z-30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setMobileActionsInvoice(null);
                                }}
                              />

                              <div
                                className="absolute right-2.5 top-11 z-40 bg-background/95 dark:bg-zinc-900/95 border border-white/20 dark:border-white/10 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl flex flex-col gap-0.5 min-w-[185px] text-left animate-in fade-in zoom-in-95 duration-150 actions-menu-container"
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                              >
                                {!showFolderSubMenu && !showStatusSubMenu ? (
                                  <>
                                    {inv.driveFileId && (
                                      <>
                                        <button
                                          onClick={() => { triggerShare(inv, "whatsapp"); setMobileActionsInvoice(null); }}
                                          disabled={sharingState !== null}
                                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                          {sharingState === "whatsapp" && activeInvoice?.id === inv.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                          )}
                                          <span>WhatsApp</span>
                                        </button>

                                        <button
                                          onClick={() => { triggerShare(inv, "email"); setMobileActionsInvoice(null); }}
                                          disabled={sharingState !== null}
                                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                          {sharingState === "email" && activeInvoice?.id === inv.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Mail className="w-3.5 h-3.5 shrink-0" />
                                          )}
                                          <span>Email</span>
                                        </button>

                                        <button
                                          onClick={() => { triggerShare(inv, "share"); setMobileActionsInvoice(null); }}
                                          disabled={sharingState !== null}
                                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                          {sharingState === "share" && activeInvoice?.id === inv.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Share2 className="w-3.5 h-3.5 shrink-0" />
                                          )}
                                          <span>Universal Share</span>
                                        </button>

                                        <button
                                          onClick={() => { triggerShare(inv, "download"); setMobileActionsInvoice(null); }}
                                          disabled={sharingState !== null}
                                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                          {sharingState === "download" && activeInvoice?.id === inv.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Download className="w-3.5 h-3.5 shrink-0" />
                                          )}
                                          <span>Download PDF</span>
                                        </button>
                                      </>
                                    )}

                                    {inv.poAttachmentUrl && (
                                      <a
                                        href={inv.poAttachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-colors cursor-pointer"
                                      >
                                        <Paperclip className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                                        <span>View Attached PO</span>
                                      </a>
                                    )}

                                    <button
                                      onClick={() => { onEdit(inv); setMobileActionsInvoice(null); }}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-colors cursor-pointer font-bold"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                      <span>Edit Invoice</span>
                                    </button>

                                    <button
                                      onClick={() => { handleDuplicate(inv); setMobileActionsInvoice(null); }}
                                      disabled={duplicatingId === inv.id}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-slate-750 dark:text-zinc-350 hover:bg-slate-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50 font-semibold"
                                    >
                                      {duplicatingId === inv.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5 shrink-0" />
                                      )}
                                      <span>Duplicate</span>
                                    </button>

                                    <button
                                      onClick={() => setShowFolderSubMenu(true)}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer font-semibold"
                                    >
                                      <FolderIcon className="w-3.5 h-3.5 shrink-0" />
                                      <span>Move to Folder</span>
                                    </button>

                                    <button
                                      onClick={() => setShowStatusSubMenu(true)}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-blue-650 dark:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors cursor-pointer font-semibold"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                                      <span>Update Status</span>
                                    </button>

                                    <button
                                      onClick={() => { handleDeleteTrigger(inv.id); setMobileActionsInvoice(null); }}
                                      disabled={deletingId === inv.id}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50 font-bold"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>Delete Invoice</span>
                                    </button>
                                  </>
                                ) : showFolderSubMenu ? (
                                  <>
                                    <div className="flex items-center justify-between border-b border-white/5 pb-1 px-1 shrink-0">
                                      <button
                                        onClick={() => setShowFolderSubMenu(false)}
                                        className="text-[10px] font-black text-violet-650 dark:text-violet-450 hover:underline cursor-pointer bg-transparent border-0"
                                      >
                                        Back
                                      </button>
                                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Select Folder</span>
                                    </div>

                                    <button
                                      onClick={async () => {
                                        await moveInvoiceToFolder(inv.id, null);
                                        setMobileActionsInvoice(null);
                                      }}
                                      className={cn(
                                        "flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer bg-transparent border-0 text-left",
                                        !inv.folderId ? "bg-violet-600/10 text-violet-600 font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                      )}
                                    >
                                      <span className="flex items-center gap-2 truncate pr-2">
                                        <FolderIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        <span>All Invoices</span>
                                      </span>
                                      {!inv.folderId && <CheckCircle className="w-3 h-3 text-violet-600 shrink-0" />}
                                    </button>

                                    {folders.length > 0 && <div className="h-[1px] bg-border/20 my-1 shrink-0" />}

                                    <div className="max-h-[160px] overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                                      {folders.map((f) => (
                                        <button
                                          key={f.id}
                                          onClick={async () => {
                                            await moveInvoiceToFolder(inv.id, f.id);
                                            setMobileActionsInvoice(null);
                                          }}
                                          className={cn(
                                            "flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer",
                                            inv.folderId === f.id ? "bg-violet-600/10 text-violet-600 font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                          )}
                                        >
                                          <span className="flex items-center gap-2 truncate pr-2">
                                            <FolderIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <span className="truncate">{f.name}</span>
                                          </span>
                                          {inv.folderId === f.id && <CheckCircle className="w-3 h-3 text-violet-600 shrink-0" />}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between border-b border-white/5 pb-1 px-1 shrink-0">
                                      <button
                                        onClick={() => setShowStatusSubMenu(false)}
                                        className="text-[10px] font-black text-violet-650 dark:text-violet-450 hover:underline cursor-pointer bg-transparent border-0"
                                      >
                                        Back
                                      </button>
                                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Update Status</span>
                                    </div>

                                    {[
                                      { id: 'draft', label: 'Draft Status', color: 'text-zinc-450 hover:bg-zinc-500/10' },
                                      { id: 'sent', label: 'Sent Status', color: 'text-blue-400 hover:bg-blue-500/10' },
                                      { id: 'paid', label: 'Paid Status', color: 'text-emerald-400 hover:bg-emerald-500/10' },
                                      { id: 'cancelled', label: 'Cancelled Status', color: 'text-rose-500 hover:bg-rose-500/10' }
                                    ].map((st) => (
                                      <button
                                        key={st.id}
                                        onClick={async () => {
                                          await handleUpdateStatus(inv.id, st.id as any);
                                          setMobileActionsInvoice(null);
                                        }}
                                        className={cn(
                                          "flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer border-0 bg-transparent text-left",
                                          inv.status === st.id ? "bg-violet-600/10 text-violet-450 font-bold" : `text-muted-foreground ${st.color}`
                                        )}
                                      >
                                        <span>{st.label}</span>
                                        {inv.status === st.id && <CheckCircle className="w-3 h-3 text-violet-600 shrink-0" />}
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* table row panel layout */
                  <div className="space-y-3">
                    {/* Desktop Table View */}
                    <div className="hidden md:block glass-panel rounded-3xl border border-violet-500/15 dark:border-white/5 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs select-none">
                          <thead>
                            <tr className="border-b border-violet-500/10 dark:border-white/5 text-slate-500 dark:text-zinc-400 font-extrabold text-[10px] uppercase tracking-wider bg-violet-100/50 dark:bg-zinc-900/30">
                              <th className="p-4 w-10 text-center">Pin</th>
                              <th className="p-4">Bill No</th>
                              <th className="p-4">Customer Client</th>
                              <th className="p-4">Job Description</th>
                              <th className="p-4">Date</th>
                              <th className="p-4 text-right">Grand Total</th>
                              <th className="p-4 text-center">Status</th>
                              <th className="p-4 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInvoices.map((inv) => (
                              <tr
                                key={inv.id}
                                className="border-b border-violet-500/10 dark:border-white/5 hover:bg-violet-50/50 dark:hover:bg-zinc-900/20 transition-colors cursor-pointer group"
                                onClick={() => onEdit(inv)}
                              >
                                <td className="p-4 text-center" onClick={(e) => handleTogglePin(e, inv)}>
                                  <Star className={cn("w-4 h-4 mx-auto", inv.isPinned ? "text-amber-500 fill-amber-500" : "text-zinc-500")} />
                                </td>
                                <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                                  <div className="flex items-center gap-1.5">
                                    <span>{inv.billNumber}</span>
                                    {inv.isImported && (
                                       <div className="relative group/tooltip inline-flex items-center">
                                         <span className={cn(
                                           "flex items-center gap-0.5 border px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 cursor-default",
                                           inv.importSource === "pdf" ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" :
                                           inv.importSource === "jpeg" || inv.importSource === "jpg" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                                           "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                         )}>
                                           {inv.importSource === "pdf" ? <FileText className="w-3 h-3" /> :
                                            inv.importSource === "jpeg" || inv.importSource === "jpg" ? <FileImage className="w-3 h-3" /> :
                                            <FileSpreadsheet className="w-3 h-3" />}
                                           <span>
                                             {inv.importSource === "pdf" ? "PDF" : inv.importSource === "jpeg" || inv.importSource === "jpg" ? "JPG" : "Excel"}
                                           </span>
                                         </span>
                                         <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-800/95 border border-white/10 px-2.5 py-1 text-[10px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                                           Imported from {inv.importSource === "pdf" ? "PDF Document" : inv.importSource === "jpeg" || inv.importSource === "jpg" ? "JPG Image" : "Excel File"}
                                         </span>
                                       </div>
                                     )}
                                    {inv.poAttachmentUrl && (
                                      <div className="relative group/tooltip inline-flex items-center">
                                        <a
                                          href={inv.poAttachmentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="p-0.5 rounded hover:bg-violet-500/15 text-violet-500 dark:text-violet-400 shrink-0 transition-colors"
                                        >
                                          <Paperclip className="w-3.5 h-3.5" />
                                        </a>
                                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 rounded-lg bg-zinc-950/95 dark:bg-zinc-800/95 border border-white/10 px-2.5 py-1 text-[10px] text-white tooltip-text whitespace-nowrap z-50 shadow-xl font-bold tracking-wide backdrop-blur-sm normal-case">
                                          PO Attached: {inv.poAttachmentName ? (inv.poAttachmentName.length > 25 ? inv.poAttachmentName.slice(0, 22) + '...' + (inv.poAttachmentName.split('.').pop() || '') : inv.poAttachmentName) : "PO document"}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 font-extrabold text-slate-900 dark:text-white">{inv.billedTo.clientName}</td>
                                <td className="p-4 text-slate-600 dark:text-zinc-400 truncate max-w-[180px]">{inv.jobDescription}</td>
                                <td className="p-4 text-slate-600 dark:text-zinc-400">{formatDate(inv.billDate)}</td>
                                <td className="p-4 text-right font-mono font-black text-[#10B981]">₹{formatCurrency(inv.grandTotal)}</td>
                                <td className="p-4 text-center">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                    inv.status === "draft"
                                      ? "bg-violet-100 dark:bg-zinc-800 text-violet-600 dark:text-zinc-400"
                                      : inv.status === "sent"
                                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                        : inv.status === "paid"
                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  )}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMobileActionsInvoice(inv);
                                    }}
                                    className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-zinc-800 border border-violet-500/15 dark:border-white/5 flex items-center justify-center text-violet-600 dark:text-zinc-400 hover:text-violet-900 dark:hover:text-white mx-auto cursor-pointer"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Canva List View */}
                    <div className="md:hidden flex flex-col gap-2.5 animate-in fade-in duration-200">
                      {filteredInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          draggable={true}
                          onDragEnd={() => {
                            setDraggableInvoiceId(null);
                            setDraggedOverFolderId(null);
                          }}
                          onClick={() => onEdit(inv)}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", inv.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className="glass-panel rounded-2xl border border-violet-500/15 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md p-3 flex items-center gap-3 relative cursor-pointer hover:bg-muted/40 transition-colors shadow-sm select-none"
                        >
                          {/* Pinned Star Toggle Button */}
                          <div className="absolute -top-1 -left-1 z-20">
                            <button
                              onClick={(e) => handleTogglePin(e, inv)}
                              className={cn(
                                "p-1 rounded-lg border border-border/10 shadow-md transition-all cursor-pointer",
                                inv.isPinned
                                  ? "bg-amber-500 text-white border-amber-500 scale-100 opacity-100"
                                  : "bg-background/95 dark:bg-zinc-900/95 text-muted-foreground hover:text-amber-500 opacity-60 active:opacity-100 scale-90"
                              )}
                            >
                              <Star className={cn("w-3 h-3", inv.isPinned && "fill-current")} />
                            </button>
                          </div>

                          {/* Small document preview container on the left */}
                          <div className="w-[50px] h-[65px] bg-gradient-to-tr from-violet-600/10 via-violet-500/5 to-emerald-500/10 dark:from-violet-950/20 dark:to-emerald-950/20 rounded-lg flex items-center justify-center relative overflow-hidden shrink-0 border border-violet-500/10">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(139,92,246,0.15),transparent_50%)]" />

                            {/* Miniature CSS A4 Page */}
                            <div className="w-[32px] h-[45px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded shadow-md relative p-0.5 flex flex-col justify-between overflow-hidden scale-[1.05] pointer-events-none select-none">
                              {/* Micro Top Header */}
                              <div className="w-full flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-[1px] shrink-0 mb-[1px]">
                                <div className="w-1 h-1 bg-violet-600 rounded-full animate-pulse" />
                                <div className="w-3 h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                              </div>

                              {/* Micro lines representing details */}
                              <div className="space-y-[1px] flex-1 flex flex-col justify-center">
                                <div className="w-[80%] h-[1.5px] bg-zinc-400 dark:bg-zinc-600 rounded-full" />
                                <div className="w-[50%] h-[1px] bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                              </div>

                              {/* Micro Footer Signature */}
                              <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-[1px] shrink-0">
                                <div className="w-2 h-[1px] bg-violet-600/75" />
                                <div className="w-1.5 h-[1.5px] bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                              </div>
                            </div>
                          </div>

                          {/* Middle Details Block */}
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight truncate">
                              {inv.billedTo.clientName}
                            </h4>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 truncate leading-normal">
                              {inv.jobDescription}
                            </p>

                            {/* Meta row: badges, PO, time */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[7px] font-mono font-bold bg-violet-500/10 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1 py-0.2 rounded shrink-0">
                                {inv.billNumber}
                              </span>

                              {inv.isImported && (
                                 <div className={cn(
                                   "flex items-center gap-0.5 border px-1 py-0.2 rounded text-[7px] font-bold shrink-0",
                                   inv.importSource === "pdf" ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" :
                                   inv.importSource === "jpeg" || inv.importSource === "jpg" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                                   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                 )}>
                                   {inv.importSource === "pdf" ? <FileText className="w-2.5 h-2.5 shrink-0" /> :
                                    inv.importSource === "jpeg" || inv.importSource === "jpg" ? <FileImage className="w-2.5 h-2.5 shrink-0" /> :
                                    <FileSpreadsheet className="w-2.5 h-2.5 shrink-0" />}
                                   <span>{inv.importSource === "pdf" ? "PDF" : inv.importSource === "jpeg" || inv.importSource === "jpg" ? "JPG" : "Excel"}</span>
                                 </div>
                              )}

                              {/* PO attached indicator */}
                              {inv.poAttachmentUrl && (
                                <div className="flex items-center text-violet-500 dark:text-violet-450 shrink-0">
                                  <Paperclip className="w-2.5 h-2.5" />
                                </div>
                              )}

                              {/* Folder Badge Indicator */}
                              {inv.folderId && inv.folderId !== "drafts" && (
                                <div className="flex items-center gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded text-[7px] font-bold shrink-0">
                                  <FolderIcon className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                  <span className="truncate max-w-[50px]">{folders.find(f => f.id === inv.folderId)?.name || "Category"}</span>
                                </div>
                              )}

                              {/* Status Badge */}
                              <span className={cn(
                                "px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider",
                                inv.status === "draft"
                                  ? "bg-violet-100 dark:bg-zinc-800 text-violet-600 dark:text-zinc-400"
                                  : inv.status === "sent"
                                    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                    : inv.status === "paid"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              )}>
                                {inv.status}
                              </span>

                              <span className="text-[8px] font-semibold text-zinc-400/80 dark:text-zinc-400/80 lowercase truncate">
                                • {formatDate(inv.billDate)}
                              </span>
                            </div>
                          </div>

                          {/* Right side: Grand total & Action vertical dots trigger */}
                          <div className="flex items-center gap-2 shrink-0">
                            <p className="font-mono font-black text-xs text-[#10B981]">₹{formatCurrency(inv.grandTotal)}</p>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setShowFolderSubMenu(false);
                                setMobileActionsInvoice(mobileActionsInvoice?.id === inv.id ? null : inv);
                              }}
                              className="actions-trigger-btn p-2 rounded-xl hover:bg-muted text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white cursor-pointer transition-all active:scale-95 shrink-0"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Reports & Analytics Panel */}
            {activeSubTab === 'analytics' && (() => {
              const monthlyData = monthlyAnalyticsData;
              const width = 500;
              const height = 220;
              const paddingLeft = 55;
              const paddingRight = 20;
              const paddingTop = 25;
              const paddingBottom = 35;

              const chartWidth = width - paddingLeft - paddingRight;
              const chartHeight = height - paddingTop - paddingBottom;

              const maxRevenue = Math.max(...monthlyData.map((d: any) => d.revenue), 10000);

              const linePoints = monthlyData.map((d: any, i: number) => {
                const x = paddingLeft + (i * chartWidth) / 5;
                const y = height - paddingBottom - (d.revenue / maxRevenue) * chartHeight;
                return { x, y, data: d };
              });

              const linePath = linePoints.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              const areaPath = linePoints.length > 0
                ? `${linePath} L ${linePoints[linePoints.length - 1].x} ${height - paddingBottom} L ${linePoints[0].x} ${height - paddingBottom} Z`
                : "";

              const maxTax = Math.max(...monthlyData.map((d: any) => d.cgst + d.sgst + d.igst), 5000);
              const barWidth = 20;

              const totalInvoices = invoices.length;
              const draftCount = invoices.filter(i => i.status === 'draft').length;
              const sentCount = invoices.filter(i => i.status === 'sent' && !isInvoiceOverdue(i)).length;
              const paidCount = invoices.filter(i => i.status === 'paid').length;
              const overdueCount = invoices.filter(i => isInvoiceOverdue(i)).length;
              const cancelledCount = invoices.filter(i => i.status === 'cancelled').length;

              const activeInvoices = invoices.filter(i => i.status === 'paid' || i.status === 'sent');
              const totalCgst = activeInvoices.reduce((sum, i) => sum + (i.cgstAmount || 0), 0);
              const totalSgst = activeInvoices.reduce((sum, i) => sum + (i.sgstAmount || 0), 0);
              const totalIgst = activeInvoices.reduce((sum, i) => sum + (i.igstAmount || 0), 0);
              const totalTax = totalCgst + totalSgst + totalIgst;

              return (
                <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
                  {/* Top row: PDF uploader report & Cumulative stats */}
                  <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-wider">Financial Ledgers Export</h3>
                      <p className="text-zinc-400 text-xs mt-1">Compile annual billing details, tax collections, and active status ledgers into a styled A4 document.</p>
                    </div>
                    <button
                      onClick={handleDownloadFinancialReport}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-[#E55A22] hover:from-violet-75 hover:to-[#E55A22]/90 text-white font-extrabold py-3 px-6 rounded-2xl transition-all cursor-pointer shadow-lg shadow-violet-500/10 active:scale-98 text-xs uppercase tracking-wider w-full md:w-auto self-stretch shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF Financial Report</span>
                    </button>
                  </div>

                  {/* Tax Highlights summary boxes */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'CGST Collected', value: totalCgst, color: 'text-violet-400', bg: 'bg-violet-500/5' },
                      { label: 'SGST Collected', value: totalSgst, color: 'text-orange-400', bg: 'bg-orange-500/5' },
                      { label: 'IGST Collected', value: totalIgst, color: 'text-sky-400', bg: 'bg-sky-500/5' },
                      { label: 'Total Tax Collected', value: totalTax, color: 'text-emerald-400', bg: 'bg-emerald-500/5' }
                    ].map((box, i) => (
                      <div key={i} className={cn("glass-panel p-5 rounded-2xl border border-white/5 text-left", box.bg)}>
                        <p className="text-[10px] font-extrabold text-zinc-450 uppercase tracking-widest">{box.label}</p>
                        <p className={cn("text-lg sm:text-xl font-black mt-1", box.color)}>₹ {formatCurrency(box.value)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Main Interactive Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">

                    {/* Invoice Overview Line Chart */}
                    <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/5 dark:border-white/5 flex flex-col min-h-[300px]">
                      <div className="flex justify-between items-center pb-4 border-b border-zinc-150 dark:border-white/5 select-none mb-4">
                        <h3 className="text-xs sm:text-sm font-black text-zinc-800 dark:text-white uppercase tracking-wider">Invoice Overview</h3>
                        <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">Last 6 Months</span>
                      </div>
                      <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200/50 dark:text-white/5" vertical={false} />
                            <XAxis dataKey="label" stroke="currentColor" className="text-zinc-400" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="currentColor" className="text-zinc-400" fontSize={10} tickLine={false} axisLine={false} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              labelStyle={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                            <Line type="monotone" dataKey="created" name="Created" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="imported" name="Imported" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="paid" name="Paid" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#F97316" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="deleted" name="Deleted" stroke="#EF4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Revenue Overview Area/Bar Chart */}
                    <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/5 dark:border-white/5 flex flex-col min-h-[300px]">
                      <div className="flex justify-between items-center pb-4 border-b border-zinc-150 dark:border-white/5 select-none mb-4">
                        <h3 className="text-xs sm:text-sm font-black text-zinc-800 dark:text-white uppercase tracking-wider">Revenue Overview</h3>
                        <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">Paid Only</span>
                      </div>
                      <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#10B981" stopOpacity={0.2} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200/50 dark:text-white/5" vertical={false} />
                            <XAxis dataKey="label" stroke="currentColor" className="text-zinc-400" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                            <YAxis
                              stroke="currentColor" className="text-zinc-400" fontSize={10} tickLine={false} axisLine={false}
                              tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                            />
                            <RechartsTooltip
                              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              formatter={(value: any) => [`₹${formatCurrency(value as number)}`, 'Revenue']}
                              contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#10B981' }}
                              labelStyle={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                            <Bar dataKey="revenue" name="Collected Revenue" fill="url(#colorRevenue)" radius={[4, 4, 0, 0]} barSize={30} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Backup Activity Line Chart */}
                    <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/5 dark:border-white/5 flex flex-col min-h-[300px]">
                      <div className="flex justify-between items-center pb-4 border-b border-zinc-150 dark:border-white/5 select-none mb-4">
                        <h3 className="text-xs sm:text-sm font-black text-zinc-800 dark:text-white uppercase tracking-wider">Backup Activity</h3>
                        <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">Last 6 Months</span>
                      </div>
                      <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200/50 dark:text-white/5" vertical={false} />
                            <XAxis dataKey="label" stroke="currentColor" className="text-zinc-400" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="currentColor" className="text-zinc-400" fontSize={10} tickLine={false} axisLine={false} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              labelStyle={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                            <Line type="monotone" dataKey="synced" name="Synced" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="pending" name="Pending" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="failed" name="Failed" stroke="#EF4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* GST Tax Collection Stacked Bar */}
                    <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/5 dark:border-white/5 flex flex-col min-h-[300px]">
                      <div className="flex justify-between items-center pb-4 border-b border-zinc-150 dark:border-white/5 select-none mb-4">
                        <h3 className="text-xs sm:text-sm font-black text-zinc-800 dark:text-white uppercase tracking-wider">GST Tax Collection</h3>
                        <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">Last 6 Months</span>
                      </div>
                      <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200/50 dark:text-white/5" vertical={false} />
                            <XAxis dataKey="label" stroke="currentColor" className="text-zinc-400" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                            <YAxis
                              stroke="currentColor" className="text-zinc-400" fontSize={10} tickLine={false} axisLine={false}
                              tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                            />
                            <RechartsTooltip
                              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              formatter={(value: any) => [`₹${formatCurrency(value as number)}`]}
                              contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              labelStyle={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                            <Bar dataKey="cgst" name="CGST" stackId="a" fill="#8B5CF6" barSize={30} />
                            <Bar dataKey="sgst" name="SGST" stackId="a" fill="#E55A22" />
                            <Bar dataKey="igst" name="IGST" stackId="a" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Circular Status distribution donut wheel representation */}
                  <div className="glass-panel p-6 rounded-3xl border border-white/5 max-w-md mx-auto text-center select-none">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider pb-3 border-b border-white/5">Billing Status Distribution</h3>

                    <div className="flex items-center justify-center gap-8 py-6 flex-col sm:flex-row">
                      <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />

                          {(() => {
                            const total = totalInvoices || 1;
                            const paidP = (paidCount / total) * 100;
                            const sentP = (sentCount / total) * 100;
                            const overdueP = (overdueCount / total) * 100;
                            const draftP = (draftCount / total) * 100;

                            let offset = 0;
                            return (
                              <>
                                {/* Paid segment */}
                                {paidCount > 0 && (
                                  <circle
                                    cx="18" cy="18" r="15.915" fill="none" stroke="#10B981" strokeWidth="3.2"
                                    strokeDasharray={`${paidP} ${100 - paidP}`}
                                    strokeDashoffset={-offset}
                                  />
                                )}
                                {(() => { offset += paidP; return null; })()}

                                {/* Sent segment */}
                                {sentCount > 0 && (
                                  <circle
                                    cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="3.2"
                                    strokeDasharray={`${sentP} ${100 - sentP}`}
                                    strokeDashoffset={-offset}
                                  />
                                )}
                                {(() => { offset += sentP; return null; })()}

                                {/* Overdue segment */}
                                {overdueCount > 0 && (
                                  <circle
                                    cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="3.2"
                                    strokeDasharray={`${overdueP} ${100 - overdueP}`}
                                    strokeDashoffset={-offset}
                                  />
                                )}
                                {(() => { offset += overdueP; return null; })()}

                                {/* Draft segment */}
                                {draftCount > 0 && (
                                  <circle
                                    cx="18" cy="18" r="15.915" fill="none" stroke="#71717a" strokeWidth="3.2"
                                    strokeDasharray={`${draftP} ${100 - draftP}`}
                                    strokeDashoffset={-offset}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </svg>
                        <div className="absolute inset-0 flex flex-col justify-center items-center">
                          <span className="text-xl font-black text-white">{totalInvoices}</span>
                          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Bills Total</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-left w-full sm:w-auto flex-1">
                        {[
                          { label: 'Paid Bills', count: paidCount, color: 'bg-emerald-500' },
                          { label: 'Sent / Pending', count: sentCount, color: 'bg-blue-500' },
                          { label: 'Overdue Bills', count: overdueCount, color: 'bg-red-500' },
                          { label: 'Draft Files', count: draftCount, color: 'bg-zinc-500' },
                          { label: 'Cancelled Bills', count: cancelledCount, color: 'bg-rose-500/40' }
                        ].map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center gap-6 text-[11px] font-bold">
                            <span className="flex items-center gap-2 text-zinc-300">
                              <span className={cn("w-2 h-2 rounded-full", it.color)} />
                              <span>{it.label}</span>
                            </span>
                            <span className="text-white font-black">{it.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* Customers CRM Directory Panel */}
            {activeSubTab === 'crm' && (() => {
              const filteredCrm = crmCustomers.filter(c =>
                c.companyName.toLowerCase().includes(crmSearch.toLowerCase()) ||
                c.address.toLowerCase().includes(crmSearch.toLowerCase()) ||
                (c.gstin && c.gstin.toLowerCase().includes(crmSearch.toLowerCase()))
              );

              return (
                <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
                  {/* Top control bar: search crm + new client log trigger */}
                  <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-full flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                      <input
                        type="text"
                        value={crmSearch}
                        onChange={(e) => setCrmSearch(e.target.value)}
                        placeholder="Search clients by company name, location State, or GSTIN ID..."
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-violet-500/20 dark:border-white/10 bg-white dark:bg-zinc-900/40 focus:border-violet-500 outline-none transition-all text-slate-900 dark:text-white font-medium placeholder-slate-400 dark:placeholder-zinc-500 shadow-inner"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setEditingCustomer(null);
                        setCustFormName("");
                        setCustFormAddress("");
                        setCustFormGstin("");
                        setCustFormAttention("");
                        setCustFormSalutation("Dear Sir,");
                        setShowAddCustomerModal(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-violet-650 hover:bg-violet-750 text-white font-black text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition-all cursor-pointer shadow-lg active:scale-98 select-none shrink-0 w-full sm:w-auto"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add Client CRM</span>
                    </button>
                  </div>

                  {/* List CRM results grid */}
                  {crmLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-violet-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-zinc-500 text-xs font-bold animate-pulse">Syncing Customer directory...</p>
                    </div>
                  ) : filteredCrm.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-violet-500/20 dark:border-white/10 rounded-[32px] bg-[#fcfaff] dark:bg-zinc-950/20 space-y-4">
                      <Users className="w-10 h-10 mx-auto text-violet-500 dark:text-zinc-500" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">Customer Database Empty</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Start by logging custom profiles or drafting quotations to auto-capture details.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {filteredCrm.map((cust) => {
                        const initials = cust.companyName
                          .split(" ")
                          .map(w => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <div key={cust.id} className="glass-panel p-5 rounded-[24px] border border-violet-500/10 dark:border-white/5 flex flex-col justify-between hover:shadow-lg transition-shadow relative text-left">
                            <div>
                              {/* Company icon & initial profile badge */}
                              <div className="flex justify-between items-start gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-650 dark:text-violet-455 font-black text-xs flex items-center justify-center shrink-0">
                                    {initials}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1 leading-snug">{cust.companyName}</h4>
                                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-none">Registered CRM Member</p>
                                  </div>
                                </div>

                                {cust.gstin ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 text-[8px] font-black uppercase tracking-wider shrink-0">
                                    GST: {cust.gstin}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 text-[8px] font-black uppercase tracking-wider shrink-0">
                                    UN-REGISTERED
                                  </span>
                                )}
                              </div>

                              {/* Customer salutation profiles */}
                              <div className="space-y-2 border-t border-white/5 pt-3.5 mb-2 text-xs">
                                {cust.kindAttention && (
                                  <div className="flex items-center gap-1.5 text-zinc-300">
                                    <span className="text-zinc-500 font-bold uppercase text-[9px] w-12 shrink-0">ATTN:</span>
                                    <span className="font-bold truncate">{cust.kindAttention}</span>
                                  </div>
                                )}
                                <div className="flex items-start gap-1.5 text-zinc-300">
                                  <span className="text-zinc-500 font-bold uppercase text-[9px] w-12 shrink-0 pt-0.5">ADDR:</span>
                                  <span className="font-medium line-clamp-2 leading-relaxed text-zinc-400">{cust.address}</span>
                                </div>
                              </div>
                            </div>

                            {/* Manual Action edit indicators */}
                            <div className="flex items-center gap-2 border-t border-white/5 pt-3 mt-4 shrink-0 justify-end">
                              <button
                                onClick={() => {
                                  setEditingCustomer(cust);
                                  setCustFormName(cust.companyName);
                                  setCustFormAddress(cust.address);
                                  setCustFormGstin(cust.gstin || "");
                                  setCustFormAttention(cust.kindAttention || "");
                                  setCustFormSalutation(cust.dearSirText || "Dear Sir,");
                                  setShowAddCustomerModal(true);
                                }}
                                className="flex items-center gap-1 py-1.5 px-3 rounded-lg hover:bg-violet-500/10 text-violet-400 hover:text-violet-300 text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-colors border border-transparent hover:border-violet-500/20"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to delete "${cust.companyName}" customer CRM log?`)) {
                                    await deleteCustomer(cust.id!);
                                    showToast(`Deleted ${cust.companyName} record.`, "info");
                                    await loadCrmCustomers();
                                  }
                                }}
                                className="flex items-center gap-1 py-1.5 px-3 rounded-lg hover:bg-red-500/10 text-red-500 hover:text-red-400 text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-colors border border-transparent hover:border-red-500/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

          </div> {/* Close lg:col-span-3 */}
        </div> {/* Close grid grid-cols-1 lg:grid-cols-4 */}

      </div> {/* Close dashboard-main-content */}

      {/* Floating Add/Edit Customer Dialog Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveCustomer}
            className="w-full max-w-md bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-[28px] text-left shadow-2xl relative animate-in zoom-in-95 duration-250"
          >
            <h3 className="text-lg font-black text-white uppercase tracking-wider border-b border-white/5 pb-3 flex items-center gap-1.5 select-none">
              <UserPlus className="w-5 h-5 text-violet-500" />
              <span>{editingCustomer ? "Edit CRM Member" : "New CRM Customer"}</span>
            </h3>

            <div className="mt-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-zinc-450 uppercase tracking-widest block">Client Company Name *</label>
                <input
                  type="text"
                  value={custFormName}
                  onChange={(e) => setCustFormName(e.target.value)}
                  placeholder="e.g. Darshan Enterprises Co."
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 outline-none text-white text-sm font-bold placeholder-zinc-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-zinc-455 uppercase tracking-widest block">GSTIN Number (Optional)</label>
                <input
                  type="text"
                  value={custFormGstin}
                  onChange={(e) => setCustFormGstin(e.target.value)}
                  placeholder="e.g. 24BCVPP7836H1ZW"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 outline-none text-white text-sm font-bold placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-zinc-450 uppercase tracking-widest block">Attention Name</label>
                  <input
                    type="text"
                    value={custFormAttention}
                    onChange={(e) => setCustFormAttention(e.target.value)}
                    placeholder="e.g. Mr. S.K. Shah"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 outline-none text-white text-sm font-bold placeholder-zinc-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-zinc-450 uppercase tracking-widest block">Salutation</label>
                  <input
                    type="text"
                    value={custFormSalutation}
                    onChange={(e) => setCustFormSalutation(e.target.value)}
                    placeholder="e.g. Dear Sir,"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 outline-none text-white text-sm font-bold placeholder-zinc-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-zinc-450 uppercase tracking-widest block">Corporate Address *</label>
                <textarea
                  value={custFormAddress}
                  onChange={(e) => setCustFormAddress(e.target.value)}
                  placeholder="Corporate billing details..."
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 outline-none text-white text-sm font-bold h-20 resize-none placeholder-zinc-500"
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setEditingCustomer(null);
                }}
                className="flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold border border-white/10 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold bg-violet-650 hover:bg-violet-750 text-white cursor-pointer transition-colors"
              >
                <span>{editingCustomer ? "Update Details" : "Add to CRM"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Canva-Style bottom drawer actions overlay */}
      {mobileActionsInvoice && (
        <div className="md:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] transition-opacity animate-in fade-in duration-300"
            onClick={() => {
              setMobileActionsInvoice(null);
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
            {/* Grab handle capsule bar */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-12 h-1 bg-muted-foreground/30 dark:bg-white/20 rounded-full mx-auto mt-3.5 mb-2 shrink-0 cursor-grab active:cursor-grabbing select-none"
              style={{ touchAction: "none" }}
            />

            {/* Close button X */}
            <button
              onClick={() => setMobileActionsInvoice(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
            >
              ×
            </button>

            {/* Scrollable list content panel */}
            <div ref={drawerScrollRef} className="overflow-y-auto p-5 space-y-5 shrink-0 max-h-[85vh]">

              {/* Centered vector document preview letterhead banner */}
              <div className="w-full aspect-[4/3] bg-gradient-to-br from-violet-600/10 via-zinc-950 to-emerald-500/5 rounded-2xl border border-white/5 flex items-center justify-center relative overflow-hidden select-none mb-3">
                <div className="w-[100px] h-[140px] bg-white rounded shadow-2xl p-1.5 flex flex-col justify-between pointer-events-none relative scale-[0.85] sm:scale-100">
                  <div className="flex justify-between items-center border-b-[0.5px] border-[#09357B] pb-0.5">
                    <div className="flex items-center gap-0.5">
                      <div className="w-2.5 h-2.5 bg-orange-500 rounded-[1px]" />
                      <div className="text-[3px] font-black text-[#09357B] leading-none uppercase">Darshan</div>
                    </div>
                  </div>
                  <div className="text-[4px] font-black text-center text-[#09357B] border-[0.5px] border-black/30 p-px rounded-[1px] my-0.5">TAX INVOICE</div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div className="text-[1.8px] text-black/60 leading-none truncate font-bold text-black">
                      {mobileActionsInvoice.billedTo.clientName}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[2.2px] font-black text-[#09357B] bg-zinc-100 p-0.5 rounded-[1px]">
                    <span className="truncate max-w-[50px] italic">Rupees: {mobileActionsInvoice.rupeesInWords}</span>
                    <span className="text-emerald-600 font-extrabold">₹{formatCurrency(mobileActionsInvoice.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Title tag */}
              <div className="text-left">
                <h3 className="text-sm font-black text-white leading-tight truncate">
                  {mobileActionsInvoice.billedTo.clientName}
                </h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-1">
                  Bill No: {mobileActionsInvoice.billNumber} • Value: ₹{formatCurrency(mobileActionsInvoice.grandTotal)}
                </p>
              </div>

              {/* In-drawer directory category or payment status submenu switcher */}
              {showFolderSubMenu ? (
                <div className="space-y-3.5 animate-in slide-in-from-right duration-250 text-left">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <button
                      onClick={() => setShowFolderSubMenu(false)}
                      className="text-[10px] font-black uppercase tracking-wider text-violet-400 hover:text-violet-300 cursor-pointer bg-transparent border-0"
                    >
                      ← Back to Options
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Move to Folder</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    <button
                      onClick={() => {
                        moveInvoiceToFolder(mobileActionsInvoice.id, null);
                        setMobileActionsInvoice(null);
                      }}
                      className={cn(
                        "w-full py-3 px-4 rounded-xl text-xs font-extrabold text-left border flex items-center justify-between cursor-pointer bg-transparent",
                        !mobileActionsInvoice.folderId
                          ? "bg-violet-600/10 border-violet-500/25 text-violet-600 dark:text-white"
                          : "bg-violet-50/60 dark:bg-zinc-900 border-transparent text-slate-800 dark:text-zinc-300 hover:bg-violet-100/80 dark:hover:bg-zinc-800"
                      )}
                    >
                      <span>All Invoices (Decouple)</span>
                      {!mobileActionsInvoice.folderId && <span className="w-2 h-2 rounded-full bg-violet-400" />}
                    </button>

                    {folders.map(f => (
                      <button
                        key={f.id}
                        onClick={() => {
                          moveInvoiceToFolder(mobileActionsInvoice.id, f.id);
                          setMobileActionsInvoice(null);
                        }}
                        className={cn(
                          "w-full py-3 px-4 rounded-xl text-xs font-extrabold text-left border flex items-center justify-between cursor-pointer bg-transparent",
                          mobileActionsInvoice.folderId === f.id
                            ? "bg-violet-600/10 border-violet-500/25 text-violet-600 dark:text-white"
                            : "bg-violet-50/60 dark:bg-zinc-900 border-transparent text-slate-800 dark:text-zinc-300 hover:bg-violet-100/80 dark:hover:bg-zinc-800"
                        )}
                      >
                        <span>{f.name}</span>
                        {mobileActionsInvoice.folderId === f.id && <span className="w-2 h-2 rounded-full bg-violet-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : showStatusSubMenu ? (
                <div className="space-y-3.5 animate-in slide-in-from-right duration-250 text-left">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <button
                      onClick={() => setShowStatusSubMenu(false)}
                      className="text-[10px] font-black uppercase tracking-wider text-violet-400 hover:text-violet-300 cursor-pointer bg-transparent border-0"
                    >
                      ← Back to Options
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Update Status</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {[
                      { id: 'draft', label: 'Draft', color: 'text-zinc-450 hover:bg-zinc-500/10 border-zinc-500/20' },
                      { id: 'sent', label: 'Sent / Pending', color: 'text-blue-400 hover:bg-blue-500/10 border-blue-500/20' },
                      { id: 'paid', label: 'Paid', color: 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20' },
                      { id: 'cancelled', label: 'Cancelled', color: 'text-rose-500 hover:bg-rose-500/10 border-rose-500/20' }
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={async () => {
                          await handleUpdateStatus(mobileActionsInvoice.id, st.id as any);
                          setMobileActionsInvoice(null);
                        }}
                        className={cn(
                          "w-full py-3 px-4 rounded-xl text-xs font-extrabold text-left border flex items-center justify-between cursor-pointer bg-transparent",
                          mobileActionsInvoice.status === st.id
                            ? "bg-violet-600/10 border-violet-500/25 text-violet-600 dark:text-white"
                            : `bg-violet-50/60 dark:bg-zinc-900 ${st.color}`
                        )}
                      >
                        <span>{st.label}</span>
                        {mobileActionsInvoice.status === st.id && <span className="w-2 h-2 rounded-full bg-violet-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Primary Actions list */
                <div className="grid grid-cols-1 gap-2.5 text-left">
                  {/* WhatsApp */}
                  <button
                    onClick={() => {
                      triggerShare(mobileActionsInvoice, "whatsapp");
                      setMobileActionsInvoice(null);
                    }}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-50/60 hover:bg-violet-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white border border-violet-500/10 dark:border-white/5 active:scale-98 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                    <span>Share PDF on WhatsApp</span>
                  </button>

                  {/* Email */}
                  <button
                    onClick={() => {
                      triggerShare(mobileActionsInvoice, "email");
                      setMobileActionsInvoice(null);
                    }}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-50/60 hover:bg-violet-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white border border-violet-500/10 dark:border-white/5 active:scale-98 transition-colors cursor-pointer"
                  >
                    <Mail className="w-4.5 h-4.5 text-blue-400 shrink-0" />
                    <span>Send PDF via Email</span>
                  </button>

                  {/* Native Share */}
                  <button
                    onClick={() => {
                      triggerShare(mobileActionsInvoice, "share");
                      setMobileActionsInvoice(null);
                    }}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-50/60 hover:bg-violet-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white border border-violet-500/10 dark:border-white/5 active:scale-98 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                    <span>Universal Share PDF</span>
                  </button>

                  {/* Download PDF */}
                  <button
                    onClick={() => {
                      triggerShare(mobileActionsInvoice, "download");
                      setMobileActionsInvoice(null);
                    }}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-50/60 hover:bg-violet-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white border border-violet-500/10 dark:border-white/5 active:scale-98 transition-colors cursor-pointer"
                  >
                    <Download className="w-4.5 h-4.5 text-sky-400 shrink-0" />
                    <span>Download A4 PDF</span>
                  </button>

                  {/* View Attached PO */}
                  {mobileActionsInvoice.poAttachmentUrl && (
                    <a
                      href={mobileActionsInvoice.poAttachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-500/10 hover:bg-violet-500/15 dark:bg-violet-950/20 dark:hover:bg-violet-950/30 text-xs font-bold text-violet-600 dark:text-violet-400 border border-violet-500/20 active:scale-98 transition-colors cursor-pointer"
                    >
                      <Paperclip className="w-4.5 h-4.5 shrink-0 text-violet-500" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="truncate font-extrabold">{mobileActionsInvoice.poAttachmentName || "Attached Purchase Order"}</p>
                        <p className="text-[9px] text-zinc-400 mt-0.5 leading-none">Tap to view original PO file</p>
                      </div>
                    </a>
                  )}

                  {/* Edit details */}
                  <button
                    onClick={() => {
                      onEdit(mobileActionsInvoice);
                      setMobileActionsInvoice(null);
                    }}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-50/60 hover:bg-violet-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white border border-violet-500/10 dark:border-white/5 active:scale-98 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4.5 h-4.5 text-violet-500 dark:text-violet-400 shrink-0" />
                    <span>Edit Invoice Details</span>
                  </button>

                  {/* Duplicate draft */}
                  <button
                    onClick={() => {
                      handleDuplicate(mobileActionsInvoice);
                      setMobileActionsInvoice(null);
                    }}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-50/60 hover:bg-violet-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white border border-violet-500/10 dark:border-white/5 active:scale-98 transition-colors cursor-pointer"
                  >
                    <Copy className="w-4.5 h-4.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                    <span>Duplicate as New Draft</span>
                  </button>

                  {/* Folder Submenu switcher */}
                  <button
                    onClick={() => setShowFolderSubMenu(true)}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-50/60 hover:bg-violet-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white border border-violet-500/10 dark:border-white/5 active:scale-98 transition-colors cursor-pointer"
                  >
                    <FolderIcon className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                    <span>Move to Folder Category</span>
                  </button>

                  {/* Update Status Submenu switcher */}
                  <button
                    onClick={() => setShowStatusSubMenu(true)}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-violet-50/60 hover:bg-violet-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white border border-violet-500/10 dark:border-white/5 active:scale-98 transition-colors cursor-pointer"
                  >
                    <CheckCircle className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                    <span>Update Payment Status</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      handleDeleteTrigger(mobileActionsInvoice.id);
                      setMobileActionsInvoice(null);
                    }}
                    className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-500 border border-red-500/20 active:scale-98 transition-colors cursor-pointer mt-1"
                  >
                    <Trash2 className="w-4.5 h-4.5 shrink-0" />
                    <span>Permanently Delete Invoice</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete verification custom dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/75 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 p-6 sm:p-8 rounded-[28px] text-center shadow-2xl relative text-slate-900 dark:text-white">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto border-2 border-red-500/20 shadow-lg mb-5">
              <Trash2 className="w-7 h-7 animate-pulse text-red-500" />
            </div>

            <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Permanently Delete?
            </h3>
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">
              Are you sure you want to delete this Tax Invoice? This action is irreversible and the document records cannot be recovered.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white cursor-pointer active:scale-95 transition-all"
              >
                No, Keep it
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-95 shadow-lg shadow-red-500/20 transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Overviews Modals */}
      <AnalyticsModals
        activeModal={activeAnalyticsModal}
        onClose={() => setActiveAnalyticsModal(null)}
        invoices={invoices}
        currentMonth={currentMonth}
        currentYear={currentYear}
        selectedMonthYear={selectedMonthYear}
      />

      {/* Folder Addition Uploader Modal */}
      {showAddFolderModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleAddFolder}
            className="w-full max-w-sm bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-[28px] text-left shadow-2xl relative animate-in zoom-in-95 duration-250"
          >
            <h3 className="text-lg font-black text-white uppercase tracking-wider border-b border-white/5 pb-3 flex items-center gap-1.5 select-none">
              <FolderPlus className="w-5 h-5 text-violet-500" />
              <span>Create Category</span>
            </h3>

            <div className="mt-5 space-y-2.5">
              <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Category Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Ankleshwar, Painting..."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 outline-none text-white text-sm font-bold"
                required
                autoFocus
              />
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddFolderModal(false);
                  setNewFolderName("");
                }}
                className="flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold border border-white/10 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingFolder}
                className="flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold bg-violet-600 hover:bg-violet-700 text-white cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                {creatingFolder ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Create</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating preview rendering container (Must be present off-screen for A4 PDF compiling to access on the fly!) */}
      {sharingState && activeInvoice && adminSettings && (
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", zIndex: -100 }}>
          <InvoicePreview
            id="invoice-pdf-container"
            invoice={activeInvoice}
            settings={adminSettings}
          />
        </div>
      )}

      {/* Desktop Share link overlay */}
      {modalOpen && tempUrl && activeInvoice && (
        <ShareActionsModal
          isOpen={modalOpen}
          onClose={closeModal}
          downloadUrl={tempUrl}
          quotation={{
            number: activeInvoice.billNumber,
            grandTotal: activeInvoice.grandTotal,
            clientDetails: {
              companyName: activeInvoice.billedTo.clientName,
              subject: activeInvoice.jobDescription
            }
          } as any}
          onDownloadLocal={async () => {
            try {
              const pdfBlob = await generatePdfBlob("invoice-pdf-container", {
                isCustomized: isSettingsCustomized(dashboardSettings),
                themeColor: "invoice"
              });
              downloadPdf(pdfBlob, `Invoice_${activeInvoice.billNumber}`);
            } catch (err) {
              console.error("Failed to generate PDF for download:", err);
            }
          }}
        />
      )}

      {/* Premium Toast Notification */}
      {notification && (
        <div className="fixed top-6 left-4 right-4 md:top-auto md:bottom-6 md:left-auto md:right-6 z-50 mx-auto max-w-[calc(100%-32px)] md:max-w-sm select-none" style={{ animation: "premiumBounceIn 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275) both" }}>
          <style dangerouslySetInnerHTML={{
            __html: `
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
          <div className={`px-5 py-3.5 rounded-2xl border shadow-2xl flex items-center justify-center gap-2.5 w-full bg-zinc-900 dark:bg-zinc-950 text-white ${notification.type === "success"
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

      {/* Live AI Vision OCR Analysis Toast Notification */}
      {aiAnalysisStatus && (
        <div className="fixed top-6 left-4 right-4 md:top-auto md:bottom-6 md:left-auto md:right-6 z-[999999] mx-auto max-w-[calc(100%-32px)] md:max-w-md select-none animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 rounded-2xl border border-purple-500/40 bg-zinc-950/95 text-white shadow-2xl backdrop-blur-xl space-y-3 relative overflow-hidden">
            {/* Animated Live Laser Scanner Beam Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center relative shrink-0">
                <Sparkles className="w-5 h-5 text-purple-400 animate-spin" style={{ animationDuration: '3s' }} />
                <span className="absolute inset-0 rounded-xl border border-purple-400/60 animate-ping opacity-75" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <span>AI Vision Document Analysis</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </h4>
                  <span className="text-[10px] font-mono text-purple-400/80 font-bold">
                    Step {aiAnalysisStatus.step}/3
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate mt-0.5">
                  {aiAnalysisStatus.fileName}
                </p>
              </div>
            </div>

            {/* Live Animated Step Message */}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200">
              <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="truncate">{aiAnalysisStatus.stepMessage}</span>
            </div>

            {/* Live Continuous Glowing Progress Line */}
            <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-orange-500 to-emerald-400 rounded-full transition-all duration-500 shadow-md shadow-purple-500/50" 
                style={{ width: aiAnalysisStatus.step === 1 ? '35%' : aiAnalysisStatus.step === 2 ? '70%' : '95%' }} 
              />
            </div>
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
                ? "0 20px 50px rgba(139, 92, 246, 0.15), 0 0 50px rgba(0,0,0,0.5)"
                : "0 20px 40px rgba(139, 92, 246, 0.08), 0 0 30px rgba(0,0,0,0.05)"
            }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg mb-4 mt-2"
              style={{
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderColor: 'rgba(139, 92, 246, 0.2)',
                color: '#8b5cf6'
              }}
            >
              <FolderMinus className="w-6 h-6 animate-pulse" />
            </div>
            <h3
              className="text-lg font-black tracking-tight"
              style={{ color: theme === 'dark' ? '#ffffff' : '#0f172a' }}
            >
              Delete Category?
            </h3>
            <p
              className="mt-2 text-xs font-semibold leading-relaxed"
              style={{ color: theme === 'dark' ? '#a1a1aa' : '#475569' }}
            >
              Are you sure you want to delete the category <span className="font-black text-[#8b5cf6]">"{folderToDelete.name}"</span>? All invoices inside will return to the 'All' category.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={executeDeleteFolder}
                className="w-full py-3 px-5 rounded-2xl text-xs font-extrabold border border-transparent text-white cursor-pointer transition-all active:scale-[0.98] bg-gradient-to-r from-violet-600 to-[#E55A22] hover:from-violet-50 hover:to-[#E55A22]/90"
              >
                Yes, Delete Category
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

      {/* Mobile Floating Action Button (FAB) & Speed-Dial Stack - MOBILE ONLY */}
      <div className="mobile-fab-container fixed bottom-24 right-5 z-[9999] md:hidden flex flex-col items-end gap-3 select-none">
        {/* Backdrop overlay when FAB menu is open */}
        {mobileFabOpen && (
          <div
            className="fixed inset-0 bg-slate-950/25 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in duration-300"
            onClick={() => setMobileFabOpen(false)}
          />
        )}

        {/* Mobile Floating Options Stack (Speed Dial Style matching screenshot) */}
        {mobileFabOpen && (
          <div className="relative z-50 flex flex-col items-end gap-3.5 pr-0.5">
            
            {/* Option 1: New Invoice (Spring Bouncy Pop-Out 1) */}
            <button
              type="button"
              onClick={() => {
                setMobileFabOpen(false);
                onCreateNew();
              }}
              className="flex items-center gap-2.5 cursor-pointer group active:scale-95 transition-all duration-200 hover:-translate-x-1 animate-fab-pop-1"
            >
              {/* Left Pill Capsule */}
              <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-full px-4 py-2 shadow-lg shadow-purple-500/10 text-right">
                <span className="text-[13px] font-bold text-[#0F172A] dark:text-white tracking-tight whitespace-nowrap">
                  New Invoice
                </span>
              </div>

              {/* Right Popping Circular Icon */}
              <div className="w-[50px] h-[50px] rounded-full bg-white dark:bg-zinc-900 border-2 border-[#EBE4FF] dark:border-purple-800/50 shadow-md shadow-purple-500/20 flex items-center justify-center text-[#9333EA] dark:text-purple-400 group-hover:scale-110 group-hover:shadow-purple-500/40 transition-all duration-200 shrink-0">
                <FilePlus className="w-5 h-5 stroke-[2.2px]" />
              </div>
            </button>

            {/* Option 2: Upload JPG/PDF (Spring Bouncy Pop-Out 2) */}
            <button
              type="button"
              onClick={() => {
                setMobileFabOpen(false);
                setImportMode('vision');
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.accept = "image/jpeg,image/png,image/jpg,application/pdf";
                  fileInputRef.current.click();
                }
              }}
              className="flex items-center gap-2.5 cursor-pointer group active:scale-95 transition-all duration-200 hover:-translate-x-1 animate-fab-pop-2"
            >
              {/* Left Pill Capsule */}
              <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-full px-4 py-2 shadow-lg shadow-purple-500/10 text-right">
                <span className="text-[13px] font-bold text-[#0F172A] dark:text-white tracking-tight whitespace-nowrap">
                  Upload JPG/PDF
                </span>
              </div>

              {/* Right Popping Circular Icon */}
              <div className="w-[50px] h-[50px] rounded-full bg-white dark:bg-zinc-900 border-2 border-[#EBE4FF] dark:border-purple-800/50 shadow-md shadow-purple-500/20 flex items-center justify-center text-[#9333EA] dark:text-purple-400 group-hover:scale-110 group-hover:shadow-purple-500/40 transition-all duration-200 shrink-0">
                <Sparkles className="w-5 h-5 stroke-[2.2px]" />
              </div>
            </button>

            {/* Option 3: Import Excel File (Spring Bouncy Pop-Out 3) */}
            <button
              type="button"
              onClick={() => {
                setMobileFabOpen(false);
                setImportMode('excel');
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.accept = ".xlsx,.csv,.xls";
                  fileInputRef.current.click();
                }
              }}
              className="flex items-center gap-2.5 cursor-pointer group active:scale-95 transition-all duration-200 hover:-translate-x-1 animate-fab-pop-3"
            >
              {/* Left Pill Capsule */}
              <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-full px-4 py-2 shadow-lg shadow-emerald-500/10 text-right">
                <span className="text-[13px] font-bold text-[#0F172A] dark:text-white tracking-tight whitespace-nowrap">
                  Import Excel File
                </span>
              </div>

              {/* Right Popping Circular Icon */}
              <div className="w-[50px] h-[50px] rounded-full bg-white dark:bg-zinc-900 border-2 border-[#E8F8F0] dark:border-emerald-800/50 shadow-md shadow-emerald-500/20 flex items-center justify-center text-[#059669] dark:text-emerald-400 group-hover:scale-110 group-hover:shadow-emerald-500/40 transition-all duration-200 shrink-0">
                <FileSpreadsheet className="w-5 h-5 stroke-[2.2px]" />
              </div>
            </button>
          </div>
        )}

        {/* Main Floating Gradient Plus Button (Vibrant Premium Gradient with Pure White + Icon) */}
        <button
          type="button"
          onClick={() => setMobileFabOpen(!mobileFabOpen)}
          className="relative z-50 w-14 h-14 rounded-full bg-gradient-to-tr from-[#D946EF] via-[#7C3AED] to-[#4F46E5] text-white flex items-center justify-center shadow-[0_10px_28px_rgba(124,58,237,0.5)] border border-white/30 active:scale-90 hover:scale-105 transition-all duration-300 cursor-pointer"
          aria-label="New Invoice Actions"
        >
          <Plus
            className={cn("w-7 h-7 stroke-[2.5px] transition-transform duration-300 ease-spring", mobileFabOpen && "rotate-45")}
            style={{ color: '#ffffff', stroke: '#ffffff' }}
          />
        </button>
      </div>
    </div>
  );
};

const styleBlock = (
  <style dangerouslySetInnerHTML={{
    __html: `
    @keyframes fab-pop-out {
      0% {
        opacity: 0;
        transform: scale(0.3) translateY(24px);
      }
      65% {
        opacity: 1;
        transform: scale(1.08) translateY(-4px);
      }
      85% {
        transform: scale(0.96) translateY(1px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    .animate-fab-pop-1 {
      animation: fab-pop-out 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
    }
    .animate-fab-pop-2 {
      animation: fab-pop-out 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both;
    }
    .animate-fab-pop-3 {
      animation: fab-pop-out 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) 0s both;
    }
    @keyframes sparkline-flow {
      to {
        stroke-dashoffset: -18;
      }
    }
    .animate-sparkline-flow {
      stroke-dasharray: 6 3;
      animation: sparkline-flow 1.2s linear infinite;
    }
    
    @keyframes pulse-glow {
      0% {
        transform: scale(1);
        opacity: 0.6;
      }
      50% {
        transform: scale(1.8);
        opacity: 0;
      }
      100% {
        transform: scale(1);
        opacity: 0.6;
      }
    }
    .animate-pulse-glow {
      animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes folder-pop {
      0% {
        transform: scale(0.9) rotate(-6deg);
      }
      35% {
        transform: scale(1.22) rotate(6deg);
      }
      65% {
        transform: scale(0.95) rotate(-3deg);
      }
      85% {
        transform: scale(1.05) rotate(1deg);
      }
      100% {
        transform: scale(1) rotate(0deg);
      }
    }
    .animate-folder-pop {
      animation: folder-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .invoice-workspace-theme {
      --primary-color: #8B5CF6;
      --secondary-color: #10B981;
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

    
    .invoice-workspace-theme h1, 
    .invoice-workspace-theme h2, 
    .invoice-workspace-theme h3 {
      font-family: Arial, Helvetica, sans-serif;
    }

    /* Light mode overrides for Invoice Dashboard */
    html:not(.dark) .invoice-workspace-theme {
      color: #1e293b !important;
    }

    html:not(.dark) .invoice-workspace-theme h1,
    html:not(.dark) .invoice-workspace-theme h2,
    html:not(.dark) .invoice-workspace-theme h3 {
      color: #0f172a !important;
    }

    html:not(.dark) .invoice-workspace-theme .glass-panel {
      background: rgba(255, 255, 255, 0.75) !important;
      border-color: rgba(139, 92, 246, 0.15) !important;
      color: #1e293b !important;
      box-shadow: 0 10px 30px -10px rgba(139, 92, 246, 0.08) !important;
    }

    html:not(.dark) .invoice-workspace-theme input,
    html:not(.dark) .invoice-workspace-theme textarea,
    html:not(.dark) .invoice-workspace-theme select {
      background: rgba(255, 255, 255, 0.9) !important;
      border-color: rgba(139, 92, 246, 0.2) !important;
      color: #0f172a !important;
    }

    html:not(.dark) .invoice-workspace-theme input::placeholder,
    html:not(.dark) .invoice-workspace-theme textarea::placeholder,
    html:not(.dark) .invoice-workspace-theme .placeholder-zinc-500::placeholder {
      color: #94a3b8 !important;
    }

    html:not(.dark) .invoice-workspace-theme .text-white:not(.tooltip-text):not(.bg-violet-600):not(.bg-violet-600 *):not(.bg-emerald-600):not(.bg-emerald-600 *):not(.bg-red-600):not(.bg-red-600 *):not(.bg-rose-600):not(.bg-rose-600 *):not(.bg-amber-500):not(.bg-amber-500 *) {
      color: #0f172a !important;
    }

    /* Force all premium custom tooltips to retain white text in both Light and Dark modes */
    .tooltip-text,
    .invoice-workspace-theme .tooltip-text,
    html:not(.dark) .invoice-workspace-theme .tooltip-text {
      color: #ffffff !important;
    }

    /* Keep solid-colored buttons and their children white in Light Mode */
    html:not(.dark) .invoice-workspace-theme .bg-violet-600,
    html:not(.dark) .invoice-workspace-theme .bg-violet-600 *,
    html:not(.dark) .invoice-workspace-theme .bg-emerald-600,
    html:not(.dark) .invoice-workspace-theme .bg-emerald-600 *,
    html:not(.dark) .invoice-workspace-theme .bg-primary,
    html:not(.dark) .invoice-workspace-theme .bg-primary *,
    html:not(.dark) .invoice-workspace-theme .bg-red-600,
    html:not(.dark) .invoice-workspace-theme .bg-red-600 *,
    html:not(.dark) .invoice-workspace-theme .from-red-600,
    html:not(.dark) .invoice-workspace-theme .from-red-600 * {
      color: #ffffff !important;
    }


    html:not(.dark) .invoice-workspace-theme .text-zinc-400 {
      color: #475569 !important;
    }

    html:not(.dark) .invoice-workspace-theme .text-zinc-300 {
      color: #334155 !important;
    }

    html:not(.dark) .invoice-workspace-theme .text-zinc-500 {
      color: #64748b !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-900\/40 {
      background: rgba(255, 255, 255, 0.7) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-900\/40:hover {
      border-color: rgba(139, 92, 246, 0.35) !important;
      box-shadow: 0 20px 40px -15px rgba(139, 92, 246, 0.12) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-900\/50 {
      background: rgba(255, 255, 255, 0.75) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-900\/50:hover {
      background: rgba(255, 255, 255, 0.9) !important;
      border-color: rgba(139, 92, 246, 0.3) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-900\/60 {
      background: rgba(255, 255, 255, 0.8) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-950\/20 {
      background: rgba(139, 92, 246, 0.03) !important;
      border-color: rgba(139, 92, 246, 0.25) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-950\/40 {
      background: rgba(255, 255, 255, 0.7) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-950\/80 {
      background: rgba(255, 255, 255, 0.95) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-950 {
      background: #ffffff !important;
      color: #0f172a !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-900 {
      background: rgba(255, 255, 255, 0.9) !important;
      color: #0f172a !important;
    }

    html:not(.dark) .invoice-workspace-theme .border-white\/5 {
      border-color: rgba(139, 92, 246, 0.1) !important;
    }

    html:not(.dark) .invoice-workspace-theme .border-white\/10 {
      border-color: rgba(139, 92, 246, 0.15) !important;
    }

    html:not(.dark) .invoice-workspace-theme .border-white\/20 {
      border-color: rgba(139, 92, 246, 0.25) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-violet-500\/5 {
      background: rgba(139, 92, 246, 0.05) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-violet-500\/10 {
      background: rgba(139, 92, 246, 0.08) !important;
    }
  `}} />
);

export default InvoiceDashboard;
