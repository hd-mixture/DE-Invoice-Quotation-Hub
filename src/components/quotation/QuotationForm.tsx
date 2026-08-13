"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Quotation, QuotationItem, AdminSettings, Customer } from "../../types";
import { createQuotation, updateQuotation, getAdminSettings, getCustomers, createCustomer, isSettingsCustomized } from "../../firebase/db";
import { uploadPdfToGoogleDrive } from "../../services/googleDrive";
import { generatePdfBlob, downloadPdf } from "../../services/pdfGenerator";
import { useAuth } from "../../context/AuthContext";
import QuotationPreview from "./QuotationPreview";
import { 
  Building2, 
  User, 
  Bookmark, 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  CloudLightning,
  Loader2,
  FileCheck,
  Eye,
  Edit3,
  ExternalLink,
  ChevronLeft,
  X,
  FileText
} from "lucide-react";
import { formatCurrency } from "../../lib/utils";

import { CustomDatePicker } from "../common/CustomDatePicker";

import { 
  QuotationHistoryPanel, 
  QuotationVersion, 
  computeQuotationDiffs 
} from "./QuotationHistoryPanel";
import { History } from "lucide-react";

interface QuotationFormProps {
  editQuotation: Quotation | null;
  onClose: (forceClose?: boolean) => void;
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
}

export const QuotationForm: React.FC<QuotationFormProps> = ({ editQuotation, onClose, onUnsavedChangesChange }) => {
  const { user, googleAccessToken } = useAuth();
  
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Mobile active pane: "edit" | "preview" | "history"
  const [mobilePane, setMobilePane] = useState<"edit" | "preview" | "history">("edit");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedDriveUrl, setGeneratedDriveUrl] = useState<string | null>(null);

  const [showSyncConfirmModal, setShowSyncConfirmModal] = useState(false);
  const [saveAsNewCopy, setSaveAsNewCopy] = useState(false);
  const [newDocNumber, setNewDocNumber] = useState("");

  // Scroll Lock when sync modal is active
  useEffect(() => {
    if (showSyncConfirmModal) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [showSyncConfirmModal]);

  // Premium Toast Notification state
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Form Fields
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [districtState, setDistrictState] = useState("");
  const [kindAttention, setKindAttention] = useState("");
  const [subject, setSubject] = useState("");
  const [dearSirText, setDearSirText] = useState("Dear Sir,");
  
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstRate, setGstRate] = useState(18);
  const [letterheadMode, setLetterheadMode] = useState(false);
  const [customTerms, setCustomTerms] = useState<string[]>([]);
  // CRM Autocomplete States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Version History State
  const [historyVersions, setHistoryVersions] = useState<QuotationVersion[]>(() => {
    if (editQuotation && (editQuotation as any).history && Array.isArray((editQuotation as any).history) && (editQuotation as any).history.length > 0) {
      return (editQuotation as any).history;
    }
    if (editQuotation) {
      const formattedDate = editQuotation.date || editQuotation.createdAt 
        ? new Date(editQuotation.date || editQuotation.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date(editQuotation.date || editQuotation.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
        : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

      return [
        {
          versionId: `v1_${editQuotation.id || Date.now()}`,
          versionNumber: 1,
          savedAt: formattedDate,
          savedBy: editQuotation.creatorEmail ? editQuotation.creatorEmail.split("@")[0] : (user?.displayName || "User"),
          savedByEmail: editQuotation.creatorEmail || user?.email || "",
          status: "saved",
          changesCount: 0,
          changesSummary: "Quotation created",
          diffs: [],
          snapshot: editQuotation,
        }
      ];
    }
    return [];
  });

  // Automatically commit a new immutable version history entry if changes exist when saving/syncing
  const commitAutoHistoryVersionIfNeeded = (previewData: Quotation): QuotationVersion[] => {
    const latestVersion = historyVersions.length > 0 ? historyVersions[0] : null;
    const diffs = latestVersion 
      ? computeQuotationDiffs(latestVersion.snapshot, previewData)
      : [];

    if (diffs.length === 0 && historyVersions.length > 0) {
      return historyVersions;
    }

    const nextVerNum = historyVersions.length > 0 ? (historyVersions[0].versionNumber + 1) : 1;
    const nowFormatted = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

    const newVersion: QuotationVersion = {
      versionId: `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      versionNumber: nextVerNum,
      savedAt: nowFormatted,
      savedBy: user?.displayName || "HD_Mixture",
      savedByEmail: user?.email || "",
      status: "saved",
      changesCount: diffs.length,
      changesSummary: diffs.length === 0 ? "Quotation saved" : `You have made ${diffs.length} ${diffs.length === 1 ? "change" : "changes"}`,
      diffs: diffs,
      snapshot: JSON.parse(JSON.stringify(previewData)),
    };

    const updatedVersions = [newVersion, ...historyVersions];
    setHistoryVersions(updatedVersions);
    return updatedVersions;
  };

  // Restore an older historical version's snapshot without overwriting history
  const handleRestoreVersion = (ver: QuotationVersion) => {
    const snap = ver.snapshot;
    if (!snap) return;

    if (snap.date) setDate(snap.date);
    if (snap.number) setNumber(snap.number);
    if (snap.clientDetails) {
      setCompanyName(snap.clientDetails.companyName || "");
      setAddress(snap.clientDetails.address || "");
      setDistrictState(snap.clientDetails.districtState || "");
      setKindAttention(snap.clientDetails.kindAttention || "");
      setSubject(snap.clientDetails.subject || "");
      setDearSirText(snap.clientDetails.dearSirText || "Dear Sir,");
    }
    if (snap.items) setItems(snap.items);
    if (snap.gstRate !== undefined) setGstRate(snap.gstRate);
    if (snap.letterheadMode !== undefined) setLetterheadMode(snap.letterheadMode);
    if (snap.customTerms) setCustomTerms(snap.customTerms);

    showToast(`Restored Version v${ver.versionNumber}. Unsaved draft created. Tap Save Current to commit.`, "info");
    onUnsavedChangesChange?.(true);
  };

  // Load customers for CRM auto-fill
  useEffect(() => {
    async function loadCustomers() {
      if (user) {
        const fetched = await getCustomers(user.uid);
        setCustomers(fetched);
      }
    }
    loadCustomers();
  }, [user]);

  const captureCustomerIfNeeded = async (name: string, addr: string, dist: string, attention: string, dearSir: string) => {
    if (!user || !name.trim()) return;
    const exists = customers.some(c => c.companyName.toLowerCase() === name.trim().toLowerCase());
    if (!exists) {
      const newCust: Omit<Customer, "id"> = {
        companyName: name.trim(),
        address: addr.trim(),
        districtState: dist.trim(),
        kindAttention: attention.trim(),
        dearSirText: dearSir.trim(),
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      };
      try {
        const newId = await createCustomer(newCust);
        setCustomers(prev => [{ ...newCust, id: newId }, ...prev]);
      } catch (err) {
        console.error("Failed to auto-capture customer in CRM:", err);
      }
    }
  };

  const handleCompanyChange = (val: string) => {
    setCompanyName(val);
    if (!val.trim()) {
      setShowSuggestions(false);
      return;
    }
    const filtered = customers.filter(c => 
      c.companyName.toLowerCase().includes(val.toLowerCase())
    );
    setShowSuggestions(filtered.length > 0);
  };

  const selectCustomer = (c: Customer) => {
    setCompanyName(c.companyName);
    setAddress(c.address);
    if (c.districtState) setDistrictState(c.districtState);
    if (c.kindAttention) setKindAttention(c.kindAttention);
    if (c.dearSirText) setDearSirText(c.dearSirText);
    setShowSuggestions(false);
    showToast(`Auto-filled ${c.companyName} details`, "success");
  };

  const previewRef = useRef<HTMLDivElement>(null);
  
  // High-fidelity dynamic scaling states for pixel-perfect fit
  const [previewScale, setPreviewScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load Settings and Initialize Form
  useEffect(() => {
    async function init() {
      try {
        const fetchedSettings = await getAdminSettings(user?.uid);
        setSettings(fetchedSettings);
        
        let initNum = "";
        let initDate = "";
        let initCompany = "";
        let initAddress = "";
        let initDist = "";
        let initAttention = "";
        let initSubject = "";
        let initDear = "Dear Sir,";
        let initItems: QuotationItem[] = [];
        let initGstEnabled = true;
        let initGstRate = 18;
        let initLetterhead = false;
        let initCustomTerms: string[] = [];

        if (editQuotation) {
          // Edit Mode
          initNum = editQuotation.number;
          initDate = editQuotation.date;
          initCompany = editQuotation.clientDetails.companyName;
          initAddress = editQuotation.clientDetails.address;
          initDist = editQuotation.clientDetails.districtState;
          initAttention = editQuotation.clientDetails.kindAttention;
          initSubject = editQuotation.clientDetails.subject;
          initDear = editQuotation.clientDetails.dearSirText;
          initItems = editQuotation.items;
          initGstEnabled = editQuotation.gstRate > 0;
          initGstRate = editQuotation.gstRate || 18;
          initLetterhead = !!editQuotation.letterheadMode;
          initCustomTerms = (editQuotation.customTerms && editQuotation.customTerms.length > 0)
            ? editQuotation.customTerms
            : (fetchedSettings?.terms || []);

          setNumber(initNum);
          setDate(initDate);
          setCompanyName(initCompany);
          setAddress(initAddress);
          setDistrictState(initDist);
          setKindAttention(initAttention);
          setSubject(initSubject);
          setDearSirText(initDear);
          setItems(initItems);
          setGstEnabled(initGstEnabled);
          setGstRate(initGstRate);
          setLetterheadMode(initLetterhead);
          if ((editQuotation as any).history && Array.isArray((editQuotation as any).history) && (editQuotation as any).history.length > 0) {
            setHistoryVersions((editQuotation as any).history);
          } else {
            const formattedDate = editQuotation.date || editQuotation.createdAt 
              ? new Date(editQuotation.date || editQuotation.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date(editQuotation.date || editQuotation.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
              : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

            setHistoryVersions([
              {
                versionId: `v1_${editQuotation.id || Date.now()}`,
                versionNumber: 1,
                savedAt: formattedDate,
                savedBy: editQuotation.creatorEmail ? editQuotation.creatorEmail.split("@")[0] : (user?.displayName || "User"),
                savedByEmail: editQuotation.creatorEmail || user?.email || "",
                status: "saved",
                changesCount: 0,
                changesSummary: "Quotation created",
                diffs: [],
                snapshot: editQuotation,
              }
            ]);
          }
        } else {
          // New Mode
          const currentYear = new Date().getFullYear();
          const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
          initNum = `DEQ-${currentYear}-${randomSuffix}`;
          initDate = new Date().toISOString().split("T")[0];
          initItems = [
            {
              id: "item-1",
              srNo: 1,
              description: "",
              qty: 1,
              unit: "No",
              rate: 0,
              amount: 0
            }
          ];

          setNumber(initNum);
          setDate(initDate);
          setItems(initItems);
          if (fetchedSettings?.terms) {
            initCustomTerms = fetchedSettings.terms;
          }
          setHistoryVersions([]);
        }

        setCustomTerms(initCustomTerms);

        setInitialData({
          number: initNum,
          date: initDate,
          companyName: initCompany,
          address: initAddress,
          districtState: initDist,
          kindAttention: initAttention,
          subject: initSubject,
          dearSirText: initDear,
          items: initItems,
          gstEnabled: initGstEnabled,
          gstRate: initGstRate,
          letterheadMode: initLetterhead,
          customTerms: initCustomTerms
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();

    const handleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };
    window.addEventListener("user-settings-updated", handleUpdated);
    return () => {
      window.removeEventListener("user-settings-updated", handleUpdated);
    };
  }, [editQuotation]);

  // Track changes to trigger the unsaved warning alerts
  useEffect(() => {
    if (!initialData) {
      onUnsavedChangesChange?.(false);
      return;
    }

    const currentData = {
      number,
      date,
      companyName,
      address,
      districtState,
      kindAttention,
      subject,
      dearSirText,
      items,
      gstEnabled,
      gstRate,
      letterheadMode,
      customTerms
    };

    const hasChanges = JSON.stringify(currentData) !== JSON.stringify(initialData);
    onUnsavedChangesChange?.(hasChanges);
  }, [
    number,
    date,
    companyName,
    address,
    districtState,
    kindAttention,
    subject,
    dearSirText,
    items,
    gstEnabled,
    gstRate,
    letterheadMode,
    initialData,
    onUnsavedChangesChange
  ]);

  // Clean up dirty state on unmount
  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  // High-fidelity dynamic scaling calculation hook
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && wrapperRef.current) {
        const containerWidth = containerRef.current.clientWidth - 32; // 32px for premium padding buffers
        const targetWidth = 810; // A4 sheet is 794px + borders
        const newScale = Math.min(containerWidth / targetWidth, 1.05); // Cap scale at 1.05 max for display aesthetics
        setPreviewScale(newScale);
        
        // Measure child height and set scaled parent height to prevent blank voids below
        const childHeight = wrapperRef.current.scrollHeight;
        setScaledHeight(childHeight * newScale);
      }
    };

    // Execute immediately on render and DOM state updates
    handleResize();
    window.addEventListener("resize", handleResize);
    
    const t1 = setTimeout(handleResize, 50);
    const t2 = setTimeout(handleResize, 350); // Safe threshold for layout transition animations

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mobilePane, items, loading]);

  // Handle item change
  const handleItemChange = (itemId: string, field: keyof QuotationItem, value: any) => {
    const updatedItems = items.map((item) => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        // Recalculate amount if rate or qty changes
        if (field === "rate" || field === "qty") {
          const qty = field === "qty" ? parseFloat(value) || 0 : item.qty;
          const rate = field === "rate" ? parseFloat(value) || 0 : item.rate;
          updatedItem.amount = qty * rate;
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updatedItems);
  };

  // Add Item
  const handleAddItem = () => {
    const newId = `item-${Date.now()}`;
    const nextSrNo = items.length + 1;
    setItems([
      ...items,
      {
        id: newId,
        srNo: nextSrNo,
        description: "",
        qty: 1,
        unit: "No",
        rate: 0,
        amount: 0
      }
    ]);
  };

  // Delete Item
  const handleDeleteItem = (itemId: string) => {
    if (items.length === 1) return;
    const filtered = items.filter((item) => item.id !== itemId);
    // Recalculate serial numbers
    const updated = filtered.map((item, index) => ({
      ...item,
      srNo: index + 1
    }));
    setItems(updated);
  };

  const handleDescriptionBold = (itemId: string, textareaEl: HTMLTextAreaElement | null) => {
    if (!textareaEl) return;
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const text = textareaEl.value;
    
    // If there is selection, wrap it in <b>...</b>. If no selection, insert <b></b> at cursor.
    const selectedText = text.substring(start, end);
    const beforeText = text.substring(0, start);
    const afterText = text.substring(end);
    
    const newText = beforeText + `<b>${selectedText}</b>` + afterText;
    
    // Update the item description
    handleItemChange(itemId, "description", newText);
    
    // Refocus and place cursor inside or after the bold tags
    setTimeout(() => {
      textareaEl.focus();
      const offset = selectedText ? 7 : 3; // Length of tags added
      textareaEl.setSelectionRange(start + offset, end + offset);
    }, 50);
  };

  // Calculations
  const subTotal = items.reduce((acc, curr) => acc + curr.amount, 0);
  const calculatedGstRate = gstEnabled ? gstRate : 0;
  const gstAmount = (subTotal * calculatedGstRate) / 100;
  const grandTotal = subTotal + gstAmount;

  // Build full quotation object
  const buildQuotationObject = (customNumber?: string): Omit<Quotation, "id"> => {
    const isActuallyEdit = editQuotation && !customNumber;
    return {
      number: customNumber || number,
      date,
      clientDetails: {
        companyName,
        address,
        districtState,
        kindAttention,
        subject,
        dearSirText
      },
      items,
      subTotal,
      gstRate: calculatedGstRate,
      gstAmount,
      grandTotal,
      createdAt: isActuallyEdit ? editQuotation.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user?.uid || "admin",
      creatorEmail: user?.email || "admin@darshan.com",
      status: isActuallyEdit ? editQuotation.status : "draft",
      letterheadMode,
      customTerms
    };
  };

  // Save Draft (Automatically commits history version if changes exist)
  const handleSaveDraft = async () => {
    if (!companyName.trim()) {
      showToast("Company Name is required to save a draft.", "error");
      return;
    }
    setSaving(true);
    try {
      const currentObj = buildQuotationObject();
      const updatedHistory = commitAutoHistoryVersionIfNeeded(currentObj as Quotation);
      const data = {
        ...currentObj,
        history: updatedHistory
      };

      if (editQuotation) {
        await updateQuotation(editQuotation.id, data);
      } else {
        await createQuotation(data);
      }
      await captureCustomerIfNeeded(companyName, address, districtState, kindAttention, dearSirText);
      onUnsavedChangesChange?.(false);
      showToast("Draft saved & history version logged!", "success");
      setTimeout(() => {
        onClose(true);
      }, 1000);
    } catch (err) {
      showToast("Failed to save draft.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Generate PDF and Upload to Google Drive
  const handleGenerateAndSync = async (forceNewNumber?: string) => {
    if (!companyName.trim()) {
      showToast("Company Name is required to generate a quotation.", "error");
      return;
    }
    
    setExporting(true);
    try {
      const isActuallyEdit = !!editQuotation;
      const currentObj = buildQuotationObject(forceNewNumber);
      const updatedHistory = commitAutoHistoryVersionIfNeeded(currentObj as Quotation);
      
      // 1. Save or update the Firestore record first
      const data = {
        ...currentObj,
        history: updatedHistory
      };
      let quotationId = isActuallyEdit ? editQuotation.id : undefined;
      
      if (isActuallyEdit && editQuotation.id) {
        await updateQuotation(editQuotation.id, data);
      } else {
        quotationId = await createQuotation(data);
      }
      await captureCustomerIfNeeded(companyName, address, districtState, kindAttention, dearSirText);

      if (forceNewNumber) {
        setNumber(forceNewNumber);
      }

      // 2. Generate PDF blob from the DOM preview
      // Standard A4 is rendered in off-screen container or the visible one
      const pdfBlob = await generatePdfBlob("quotation-pdf-export-container", {
        isCustomized: isSettingsCustomized(settings),
        themeColor: "quotation"
      });

      // Download standard browser copy for immediate offline access
      const activeNumber = forceNewNumber || number;
      const cleanFileName = `Quotation_${activeNumber}_${companyName.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      downloadPdf(pdfBlob, cleanFileName);

      // 3. Upload to Google Drive if OAuth is configured
      if (googleAccessToken) {
        const driveResult = await uploadPdfToGoogleDrive(googleAccessToken, pdfBlob, cleanFileName);
        
        // 4. Save the Drive URLs in Firestore
        await updateQuotation(quotationId || editQuotation!.id, {
          driveUrl: driveResult.driveUrl,
          driveFileId: driveResult.driveFileId,
          status: "sent"
        });

        onUnsavedChangesChange?.(false);
        setGeneratedDriveUrl(driveResult.driveUrl);
        setShowSuccessModal(true);

        // Confetti Celebration
        if (typeof window !== "undefined") {
          import("canvas-confetti").then((module) => {
            module.default({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.6 }
            });
          });
        }
      } else {
        onUnsavedChangesChange?.(false);
        showToast("PDF downloaded locally! Connect your account to enable cloud sync.", "info");
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      showToast("Failed to sync.", "error");
    } finally {
      setExporting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#E55A22]" />
        <p className="text-muted-foreground text-sm font-semibold animate-pulse">Initializing template systems...</p>
      </div>
    );
  }

  // Construct current data representation for active preview sync
  const currentQuotationPreview: Quotation = {
    id: editQuotation?.id || "temp",
    number,
    date,
    clientDetails: { companyName, address, districtState, kindAttention, subject, dearSirText },
    items,
    subTotal,
    gstRate: calculatedGstRate,
    gstAmount,
    grandTotal,
    createdAt: "",
    createdBy: "",
    creatorEmail: "",
    status: "draft",
    letterheadMode,
    customTerms
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto px-3 py-4 sm:py-6 space-y-5 pb-36 select-none">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        {/* Left block: back button & title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button 
            onClick={() => onClose()} 
            className="p-2 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all cursor-pointer shrink-0 shadow-sm border border-slate-200/60 dark:border-white/5"
            title="Go Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="w-4.5 h-4.5 text-[#E55A22] shrink-0" />
              <h1 className="text-base sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                {editQuotation ? "Edit Quotation" : "Create Quotation"}
              </h1>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 font-mono truncate">
              {number}
            </p>
          </div>
        </div>

        {/* Right block: mobile tab switcher & desktop quick actions */}
        <div className="flex items-center justify-center md:justify-end gap-3 w-full md:w-auto mt-1 md:mt-0">
          {/* Mobile pane switcher */}
          <div className="md:hidden flex bg-muted/65 p-1 rounded-2xl w-full max-w-[340px] border border-border/20 shadow-inner">
            <button
              onClick={() => setMobilePane("edit")}
              className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mobilePane === "edit" 
                  ? "bg-background text-[#E55A22] shadow-sm scale-[1.01]" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Form</span>
            </button>
            <button
              onClick={() => setMobilePane("preview")}
              className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mobilePane === "preview" 
                  ? "bg-background text-[#E55A22] shadow-sm scale-[1.01]" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setMobilePane("history")}
              className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mobilePane === "history" 
                  ? "bg-background text-[#E55A22] shadow-sm scale-[1.01]" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </div>

          {/* Desktop Quick Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              onClick={handleSaveDraft}
              disabled={saving || exporting}
              className="flex items-center justify-center gap-1.5 border border-border bg-background/50 hover:bg-muted text-foreground py-2.5 px-4 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Draft</span>
            </button>

            <button
              onClick={() => {
                setNewDocNumber(number);
                setSaveAsNewCopy(false);
                setShowSyncConfirmModal(true);
              }}
              disabled={saving || exporting}
              className="flex items-center justify-center gap-1.5 bg-[#E55A22] hover:bg-[#d44e19] text-white py-2.5 px-4 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-orange-500/20 scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing cloud...</span>
                </>
              ) : (
                <>
                  <CloudLightning className="w-4 h-4" />
                  <span>Sync & Generate</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Column Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: EDIT PANE (4 cols) */}
        <div className={`${mobilePane !== "edit" ? "hidden" : "block"} lg:block lg:col-span-4 space-y-6`}>
          <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/20 dark:border-white/5 space-y-5">
            <h2 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#E55A22] uppercase border-b border-border/40 pb-3 flex items-center gap-1.5 min-w-0">
              <Building2 className="w-4 h-4 shrink-0 text-orange-500" />
              <span className="truncate">Recipient & Client Details</span>
            </h2>

            {/* Grid for metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <CustomDatePicker
                  label="Date"
                  value={date}
                  onChange={(val) => setDate(val)}
                  isInvoiceTheme={false}
                  placeholder="Select Quotation Date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quotation Number</label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/50 outline-none focus:border-[#E55A22] text-sm font-mono font-semibold"
                />
              </div>
            </div>

            {/* Company Name */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => handleCompanyChange(e.target.value)}
                placeholder="e.g. Khetan chemicals and fertilizers LTD."
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 outline-none focus:border-[#E55A22] text-sm font-bold"
                onFocus={() => {
                  if (companyName.trim()) {
                    const filtered = customers.filter(c => 
                      c.companyName.toLowerCase().includes(companyName.toLowerCase())
                    );
                    setShowSuggestions(filtered.length > 0);
                  }
                }}
              />
              {showSuggestions && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowSuggestions(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-45 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-[220px] overflow-y-auto overflow-x-hidden p-1.5 flex flex-col gap-0.5 animate-in fade-in duration-150 scrollbar-thin scrollbar-thumb-zinc-300">
                    <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#E55A22] border-b border-zinc-100 dark:border-zinc-800/80 select-none text-left">
                      CRM Customer Records
                    </div>
                    {customers
                      .filter(c => c.companyName.toLowerCase().includes(companyName.toLowerCase()))
                      .map((c, index) => (
                        <button
                          key={c.id || index}
                          type="button"
                          onClick={() => selectCustomer(c)}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-orange-500/10 dark:hover:bg-orange-500/10 text-foreground transition-all flex flex-col justify-start gap-0.5 cursor-pointer border-0"
                        >
                          <span className="font-bold text-slate-800 dark:text-zinc-100 line-clamp-1">{c.companyName}</span>
                          {c.address && <span className="text-[10px] text-zinc-450 dark:text-zinc-400 truncate text-left">{c.address}</span>}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address Details</label>
              <textarea
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${Math.max(48, el.scrollHeight)}px`;
                  }
                }}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.max(48, e.target.scrollHeight)}px`;
                }}
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = "auto";
                  target.style.height = `${Math.max(48, target.scrollHeight)}px`;
                }}
                placeholder="Plot no 42/7GIDC DAHEJ vagra..."
                rows={1}
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 outline-none focus:border-[#E55A22] text-sm font-medium leading-relaxed resize-none overflow-hidden"
              />
            </div>

            {/* District/State */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">District / State</label>
              <input
                type="text"
                value={districtState}
                onChange={(e) => setDistrictState(e.target.value)}
                placeholder="e.g. Dist-Bharuch Guj"
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 outline-none focus:border-[#E55A22] text-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Attention */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kind Attention</label>
                <input
                  type="text"
                  value={kindAttention}
                  onChange={(e) => setKindAttention(e.target.value)}
                  placeholder="e.g. Mr TC Parmar"
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 outline-none focus:border-[#E55A22] text-sm font-medium"
                />
              </div>

              {/* Dear Sir salutation */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dear Sir salutation</label>
                <input
                  type="text"
                  value={dearSirText}
                  onChange={(e) => setDearSirText(e.target.value)}
                  placeholder="Dear Sir,"
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 outline-none focus:border-[#E55A22] text-sm font-medium"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject Title</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Question for man Power Supply"
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background/50 outline-none focus:border-[#E55A22] text-sm font-bold"
              />
            </div>
          </div>

          {/* PRINT LAYOUT PREFERENCES */}
          <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/20 dark:border-white/5 space-y-4">
            <h2 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#E55A22] uppercase border-b border-border/40 pb-3 flex items-center gap-1.5 min-w-0">
              <Bookmark className="w-4 h-4 shrink-0 text-orange-500" />
              <span className="truncate">Print Layout Preferences</span>
            </h2>
            
            {/* Unified Master Switch Switch */}
            <div className="flex items-center justify-between p-4 bg-background/50 border border-border/40 rounded-2xl select-none">
              <div className="text-left pr-4">
                <p className="text-[12.5px] font-extrabold">Pre-printed Letterhead Mode</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold mt-0.5 leading-normal">
                  Hide header graphics, footer address texts, and authorized signatory blocks to print directly onto pre-printed company letterhead paper. Margin spaces and vertical alignments remain strictly preserved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLetterheadMode(!letterheadMode)}
                className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer outline-none shrink-0 ${letterheadMode ? "bg-[#E55A22]" : "bg-zinc-300 dark:bg-zinc-700"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${letterheadMode ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* ITEM ADDER SYSTEM */}
          <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/20 dark:border-white/5 space-y-5">
            <h2 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#E55A22] uppercase border-b border-border/40 pb-3 flex items-center justify-between gap-1.5 min-w-0">
              <span className="flex items-center gap-1.5 min-w-0">
                <Plus className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                <span className="truncate">Item Breakdown</span>
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center justify-center gap-1 bg-orange-500/10 hover:bg-[#E55A22] text-[#E55A22] hover:text-white border border-orange-500/20 py-1.5 px-3 rounded-xl text-[10.5px] font-bold cursor-pointer transition-all active:scale-[0.97] shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>Add Item Row</span>
              </button>
            </h2>

            {/* Items mapped */}
            <div className="space-y-3 w-full">
              {items.map((item, idx) => (
                <div 
                  key={item.id} 
                  className="p-3 bg-orange-500/5 dark:bg-zinc-900/40 rounded-2xl border border-orange-500/15 dark:border-white/5 relative flex flex-col gap-2 group animate-in slide-in-from-top-1.5 duration-200 shadow-sm"
                >
                  {/* Row Header: Item #, Bold button, and Remove button */}
                  <div className="flex items-center justify-between pb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4.5 h-4.5 rounded-full bg-[#E55A22] text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                        Item #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          const textarea = e.currentTarget.closest(".p-3")?.querySelector("textarea") as HTMLTextAreaElement;
                          handleDescriptionBold(item.id, textarea);
                        }}
                        className="px-1.5 py-0.2 rounded bg-orange-500/10 hover:bg-orange-500/20 text-[#E55A22] text-[9px] font-black cursor-pointer select-none active:scale-95 transition-all"
                        title="Format selection as Bold (Ctrl+B)"
                      >
                        B
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={items.length === 1}
                      className="text-zinc-400 hover:text-red-500 cursor-pointer p-0.5 rounded hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove item row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Auto-Expanding Description Box */}
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto";
                        el.style.height = `${Math.max(38, el.scrollHeight)}px`;
                      }
                    }}
                    value={item.description}
                    onChange={(e) => {
                      handleItemChange(item.id, "description", e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.max(38, e.target.scrollHeight)}px`;
                    }}
                    onInput={(e) => {
                      const target = e.currentTarget;
                      target.style.height = "auto";
                      target.style.height = `${Math.max(38, target.scrollHeight)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.ctrlKey && e.key === "b") {
                        e.preventDefault();
                        handleDescriptionBold(item.id, e.currentTarget as HTMLTextAreaElement);
                      }
                    }}
                    rows={1}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-orange-500/20 dark:border-white/10 bg-white dark:bg-zinc-950/60 focus:border-[#E55A22] focus:ring-1 focus:ring-orange-500/10 outline-none transition-all text-slate-900 dark:text-white text-[11px] leading-relaxed shadow-inner resize-none overflow-hidden"
                    placeholder="Enter item description... (Ctrl+B to bold)"
                  />

                  {/* Grid for Qty, Unit, Rate, Amount */}
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    {/* Qty */}
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block text-center">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.qty || ""}
                        onChange={(e) => handleItemChange(item.id, "qty", e.target.value)}
                        className="w-full px-1.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 focus:border-[#E55A22] outline-none text-[11px] font-bold text-center text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Unit */}
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block text-center">Unit</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(item.id, "unit", e.target.value)}
                        className="w-full px-1.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 focus:border-[#E55A22] outline-none text-[11px] font-bold text-center uppercase text-slate-900 dark:text-white"
                        placeholder="No"
                      />
                    </div>

                    {/* Rate */}
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block text-right">Rate (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.rate || ""}
                        onChange={(e) => handleItemChange(item.id, "rate", e.target.value)}
                        className="w-full px-1.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 focus:border-[#E55A22] outline-none text-[11px] font-bold font-mono text-right text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Amount */}
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block text-right">Amount</label>
                      <div className="w-full px-1.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[11px] font-bold font-mono text-right text-[#E55A22] truncate">
                        ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations summaries */}
            <div className="border-t border-border/30 pt-4 space-y-3.5">
              
              {/* GST Toggle */}
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Apply GST Rate</span>
                  <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">Toggle on/off Indian GST configurations.</span>
                </div>
                <div className="flex items-center gap-2">
                  {gstEnabled && (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={gstRate}
                      onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                      className="w-14 px-2 py-1 border border-border/60 rounded-md bg-background/50 text-xs font-bold text-center"
                    />
                  )}
                  <button
                    onClick={() => setGstEnabled(!gstEnabled)}
                    type="button"
                    className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-all ${gstEnabled ? "bg-[#E55A22]" : "bg-muted"}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-all ${gstEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>

              {/* Subtotal & Total figures */}
              <div className="space-y-1 text-sm font-semibold pr-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹ {formatCurrency(subTotal)}</span>
                </div>
                {gstEnabled && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST ({gstRate}%):</span>
                    <span className="font-mono">₹ {formatCurrency(gstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-foreground font-extrabold text-lg pt-1 border-t border-border/20">
                  <span>Grand Total:</span>
                  <span className="font-mono text-[#E55A22]">₹ {formatCurrency(grandTotal)}</span>
                </div>
              </div>

            </div>
          </div>
          
          {/* Custom Terms & Conditions Editor */}
          <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-white/10 space-y-4 bg-zinc-950/40 backdrop-blur-md">
            <div className="flex items-center justify-between gap-1.5 border-b border-white/5 pb-3 min-w-0">
              <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#E55A22] uppercase flex items-center gap-1.5 min-w-0">
                <FileText className="w-3.5 h-3.5 shrink-0 text-[#E55A22]" />
                <span className="truncate">Terms & Conditions</span>
              </h3>
              <button
                type="button"
                onClick={() => setCustomTerms([...customTerms, ""])}
                className="flex items-center justify-center gap-1 bg-orange-500/10 hover:bg-[#E55A22] text-[#E55A22] hover:text-white border border-orange-500/20 py-1.5 px-3 rounded-xl text-[10.5px] font-bold cursor-pointer transition-all active:scale-[0.97] shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>Add Term</span>
              </button>
            </div>

            <div className="space-y-2">
              {customTerms.map((term, index) => (
                <div key={index} className="flex items-start gap-2 group animate-in fade-in slide-in-from-top-1">
                  <div className="w-6 h-6 shrink-0 rounded-full bg-orange-500/10 dark:bg-zinc-800 text-[10px] text-[#E55A22] dark:text-orange-400 font-extrabold flex items-center justify-center shadow-inner mt-1">
                    {index + 1}
                  </div>
                  <input
                    value={term}
                    onChange={(e) => {
                      const newTerms = [...customTerms];
                      newTerms[index] = e.target.value;
                      setCustomTerms(newTerms);
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-orange-500/20 dark:border-white/10 bg-white dark:bg-zinc-950/60 focus:border-[#E55A22] focus:ring-1 focus:ring-orange-500/10 outline-none transition-all text-foreground text-xs shadow-inner"
                    placeholder="Enter condition..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newTerms = customTerms.filter((_, i) => i !== index);
                      setCustomTerms(newTerms);
                    }}
                    className="text-muted-foreground hover:text-destructive cursor-pointer p-2 rounded-lg hover:bg-destructive/10 transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
                    title="Remove term"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {customTerms.length === 0 && (
                <div className="text-center py-4 text-xs font-bold text-muted-foreground italic border border-dashed border-orange-500/20 dark:border-white/10 rounded-xl">
                  No terms and conditions added.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* CENTER COLUMN: LIVE PDF PREVIEW PANE (5 cols) */}
        <div 
          ref={containerRef}
          className={`${mobilePane !== "preview" ? "hidden" : "block"} lg:block lg:col-span-5 lg:sticky lg:top-24 w-full overflow-hidden rounded-3xl p-4 bg-neutral-200 dark:bg-slate-900 border border-neutral-300 dark:border-slate-800 shadow-sm`}
        >
          <div 
            style={{ 
              height: scaledHeight ? `${scaledHeight}px` : "auto",
              overflow: "hidden",
              transition: "height 0.2s ease" 
            }}
          >
            <div 
              ref={wrapperRef}
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
                width: "810px", // Fixed width to prevent word wrapping reflow while scaling
                transition: "transform 0.2s ease"
              }}
              className="no-scrollbar"
            >
              <QuotationPreview
                ref={previewRef}
                quotation={currentQuotationPreview}
                settings={settings}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: QUOTATION HISTORY PANE (3 cols) */}
        <div className={`${mobilePane !== "history" ? "hidden" : "block"} lg:block lg:col-span-3 lg:sticky lg:top-24 space-y-4`}>
          <QuotationHistoryPanel
            versions={historyVersions}
            currentPreview={currentQuotationPreview}
            onRestoreVersion={handleRestoreVersion}
            isSaving={saving}
            currentUserDisplayName={user?.displayName || "HD_Mixture"}
          />
        </div>

        {/* Hidden Offscreen Container for dynamic, unscaled, pixel-perfect PDF compiles */}
        {settings && (
          <div style={{ position: "absolute", top: "-9999px", left: "-9999px", pointerEvents: "none", zIndex: -1000 }}>
            <QuotationPreview 
              id="quotation-pdf-export-container"
              quotation={currentQuotationPreview} 
              settings={settings} 
            />
          </div>
        )}

      </div>

      {/* Premium Sync & Generate Confirmation Modal */}
      {showSyncConfirmModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999999] min-h-screen w-screen bg-black/75 dark:bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200 text-left">
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl shadow-2xl flex flex-col gap-4 text-slate-800 dark:text-zinc-100 scale-[1.01]"
            style={{ animation: "premiumBounceIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CloudLightning className="w-5 h-5 text-[#E55A22]" />
                  <span>Sync & Generate Options</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Confirm or update the document number before compiling and syncing.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowSyncConfirmModal(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document ID Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">Quotation Number</label>
              <input 
                type="text"
                value={newDocNumber}
                onChange={(e) => setNewDocNumber(e.target.value)}
                placeholder="e.g. DE-QT-11"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-black/40 text-sm font-bold text-slate-900 dark:text-white focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all font-mono uppercase"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowSyncConfirmModal(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-sm font-bold transition-all cursor-pointer text-center text-slate-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newDocNumber.trim()) {
                    showToast("Please enter a Quotation Number.", "error");
                    return;
                  }
                  setShowSyncConfirmModal(false);
                  handleGenerateAndSync(newDocNumber.trim());
                }}
                className="flex-1 py-3 rounded-2xl bg-[#E55A22] hover:bg-[#E55A22]/90 active:scale-[0.99] text-sm font-bold transition-all cursor-pointer text-white shadow-lg shadow-orange-500/20 text-center flex items-center justify-center gap-1.5"
              >
                <CloudLightning className="w-4 h-4" />
                <span>Proceed to Sync</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SUCCESS POPUP MODAL */}
      {showSuccessModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999999] min-h-screen w-screen bg-black/75 dark:bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-8 rounded-3xl space-y-6 text-center shadow-2xl relative animate-soft-pulse text-slate-800 dark:text-zinc-100">
            
            {/* Close Button */}
            <button 
              onClick={() => {
                setShowSuccessModal(false);
                onClose();
              }}
              className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto border-2 border-emerald-500/20 shadow-lg shadow-emerald-500/15 animate-bounce">
              <FileCheck className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Quotation Synced!
              </h3>
              <p className="mt-2.5 text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                The quotation <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-850 px-2 py-0.5 rounded-md">{number}</span> has been saved and synced successfully.
              </p>
            </div>

            {/* Direct Link */}
            {generatedDriveUrl && (
              <a
                href={generatedDriveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl text-sm font-bold border border-transparent text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer"
              >
                <span>Open Synced File</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={() => {
                setShowSuccessModal(false);
                onClose();
              }}
              className="w-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 py-3 px-5 rounded-2xl text-sm font-bold cursor-pointer text-slate-700 dark:text-zinc-300 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Sticky Mobile Floating Footer */}
      <div className="md:hidden fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="w-full bg-background/90 backdrop-blur-lg border border-white/20 dark:border-white/5 p-2.5 rounded-2xl flex gap-2 shadow-2xl pointer-events-auto">
          <button
            onClick={handleSaveDraft}
            disabled={saving || exporting}
            className="flex-1 flex items-center justify-center gap-1.5 bg-muted/80 text-foreground py-2.5 px-4 rounded-xl font-bold text-xs cursor-pointer transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => {
              setNewDocNumber(number);
              setSaveAsNewCopy(false);
              setShowSyncConfirmModal(true);
            }}
            disabled={saving || exporting}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#E55A22] text-white py-2.5 px-4 rounded-xl font-bold text-xs cursor-pointer transition-colors shadow-lg"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <CloudLightning className="w-4 h-4" />
                <span>Sync & PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

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
    </div>
  );
};
export default QuotationForm;
