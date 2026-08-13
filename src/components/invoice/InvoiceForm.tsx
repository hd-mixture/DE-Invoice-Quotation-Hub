"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TaxInvoice, TaxInvoiceItem, AdminSettings, Customer } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { getAdminSettings, createInvoice, updateInvoice, getCustomers, createCustomer, isSettingsCustomized } from "../../firebase/db";
import { uploadPdfToGoogleDrive } from "../../services/googleDrive";
import { calculateGstBreakdown } from "../../utils/gstCalculator";
import { convertAmountToWords } from "../../utils/amountToWords";
import { InvoicePreview } from "./InvoicePreview";
import { downloadPdf, generatePdfBlob } from "../../services/pdfGenerator";
import { validateGSTIN, formatGSTINInput, GSTINValidationResult, isNaOrEmptyGSTIN } from "../../utils/gstValidation";
import { GSTInfoCard } from "./GSTInfoCard";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Printer, 
  Share2, 
  Eye, 
  ArrowLeft, 
  ChevronLeft,
  Building2, 
  Receipt, 
  CreditCard,
  CloudLightning,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Paperclip,
  UploadCloud,
  X
} from "lucide-react";
import { uploadPoAttachment } from "../../firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import { PwaSplashScreen } from "../common/PwaSplashScreen";
import { ReceiptRupee } from "../common/ReceiptRupee";
import { CustomDatePicker } from "../common/CustomDatePicker";

import { 
  InvoiceHistoryPanel, 
  InvoiceVersion, 
  computeInvoiceDiffs 
} from "./InvoiceHistoryPanel";
import { History } from "lucide-react";

interface InvoiceFormProps {
  editInvoice: TaxInvoice | null;
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
  onClose: (forceClose?: boolean) => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ 
  editInvoice, 
  onUnsavedChangesChange, 
  onClose 
}) => {
  const { user, googleAccessToken, loginWithGoogle } = useAuth();
  
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingToDrive, setSyncingToDrive] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "history">("edit");
  const [isIgstMode, setIsIgstMode] = useState<boolean>(false);
  const [gstEnabled, setGstEnabled] = useState<boolean>(editInvoice ? editInvoice.gstEnabled !== false : true);
  
  // Dynamic validation error & success toasts
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customTerms, setCustomTerms] = useState<string[]>([]);

  // Form State Definitions
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [poAttachmentUrl, setPoAttachmentUrl] = useState("");
  const [poAttachmentName, setPoAttachmentName] = useState("");
  const [poUploading, setPoUploading] = useState(false);
  const [showPoSuggestionModal, setShowPoSuggestionModal] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  
  const [showSyncConfirmModal, setShowSyncConfirmModal] = useState(false);
  const [saveAsNewCopy, setSaveAsNewCopy] = useState(false);
  const [customFileName, setCustomFileName] = useState("");

  const [consigneeName, setConsigneeName] = useState("");
  const [consigneeAddress, setConsigneeAddress] = useState("");
  const [consigneeGstin, setConsigneeGstin] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientGstin, setClientGstin] = useState("");
  const [gstValidation, setGstValidation] = useState<GSTINValidationResult | null>(null);

  const handleClientGstinChange = (rawVal: string) => {
    const formatted = formatGSTINInput(rawVal);
    setClientGstin(formatted);
    const valResult = validateGSTIN(formatted);
    setGstValidation(valResult);

    if (isNaOrEmptyGSTIN(formatted)) {
      setGstEnabled(false);
    } else if (valResult.isValid && formatted.length === 15) {
      setGstEnabled(true);
    }
  };

  const [jobDescription, setJobDescription] = useState("");
  const [items, setItems] = useState<TaxInvoiceItem[]>([
    { id: "1", srNo: 1, description: "", hsnSac: "995473", qty: 1, unit: "JOB", rate: 0, amount: 0 }
  ]);

  const [letterheadMode, setLetterheadMode] = useState<boolean>(editInvoice ? !!editInvoice.letterheadMode : true);

  // CRM Autocomplete States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Invoice Version History State
  const [historyVersions, setHistoryVersions] = useState<InvoiceVersion[]>(() => {
    if (editInvoice && (editInvoice as any).history && Array.isArray((editInvoice as any).history) && (editInvoice as any).history.length > 0) {
      return (editInvoice as any).history;
    }
    if (editInvoice) {
      const formattedDate = editInvoice.billDate || editInvoice.createdAt 
        ? new Date(editInvoice.billDate || editInvoice.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date(editInvoice.billDate || editInvoice.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
        : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

      return [
        {
          versionId: `v1_${editInvoice.id || Date.now()}`,
          versionNumber: 1,
          savedAt: formattedDate,
          savedBy: editInvoice.creatorEmail ? editInvoice.creatorEmail.split("@")[0] : (user?.displayName || "User"),
          savedByEmail: editInvoice.creatorEmail || user?.email || "",
          status: "saved",
          changesCount: 0,
          changesSummary: "Tax Invoice created",
          diffs: [],
          snapshot: editInvoice,
        }
      ];
    }
    return [];
  });

  // Automatically commit a new immutable version history entry if changes exist when saving/syncing
  const commitAutoHistoryVersionIfNeeded = (previewData: TaxInvoice): InvoiceVersion[] => {
    const latestVersion = historyVersions.length > 0 ? historyVersions[0] : null;
    const diffs = latestVersion 
      ? computeInvoiceDiffs(latestVersion.snapshot, previewData)
      : [];

    if (diffs.length === 0 && historyVersions.length > 0) {
      return historyVersions;
    }

    const nextVerNum = historyVersions.length > 0 ? (historyVersions[0].versionNumber + 1) : 1;
    const nowFormatted = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

    const newVersion: InvoiceVersion = {
      versionId: `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      versionNumber: nextVerNum,
      savedAt: nowFormatted,
      savedBy: user?.displayName || "HD_Mixture",
      savedByEmail: user?.email || "",
      status: "saved",
      changesCount: diffs.length,
      changesSummary: diffs.length === 0 ? "Tax Invoice saved" : `You have made ${diffs.length} ${diffs.length === 1 ? "change" : "changes"}`,
      diffs: diffs,
      snapshot: JSON.parse(JSON.stringify(previewData)),
    };

    const updatedVersions = [newVersion, ...historyVersions];
    setHistoryVersions(updatedVersions);
    return updatedVersions;
  };

  // Restore an older historical invoice version's snapshot without overwriting history
  const handleRestoreInvoiceVersion = (ver: InvoiceVersion) => {
    const snap = ver.snapshot;
    if (!snap) return;

    if (snap.billNumber) setBillNumber(snap.billNumber);
    if (snap.billDate) setBillDate(snap.billDate);
    if (snap.poNumber) setPoNumber(snap.poNumber);
    if (snap.poDate) setPoDate(snap.poDate);

    if (snap.consigneeDetails) {
      setConsigneeName(snap.consigneeDetails.companyName || "");
      setConsigneeAddress(snap.consigneeDetails.address || "");
      setConsigneeGstin(snap.consigneeDetails.gstin || "");
    }
    if (snap.billedTo) {
      setClientName(snap.billedTo.clientName || "");
      setClientAddress(snap.billedTo.clientAddress || "");
      setClientGstin(snap.billedTo.clientGstin || "");
    }
    if (snap.jobDescription) setJobDescription(snap.jobDescription);
    if (snap.items) setItems(snap.items);
    if (snap.letterheadMode !== undefined) setLetterheadMode(snap.letterheadMode);
    if (snap.gstEnabled !== undefined) setGstEnabled(snap.gstEnabled);
    if (snap.customTerms) setCustomTerms(snap.customTerms);

    setError(null);
    setSuccess(`Restored Version v${ver.versionNumber}. Unsaved draft created. Tap Save Draft to commit.`);
    setTimeout(() => setSuccess(null), 4000);
    onUnsavedChangesChange?.(true);
  };

  // Scroll Lock when modals are active
  useEffect(() => {
    if (showSyncConfirmModal || showPoSuggestionModal) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [showSyncConfirmModal, showPoSuggestionModal]);

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

  const captureCustomerIfNeeded = async (name: string, addr: string, gstin: string) => {
    if (!user || !name.trim()) return;
    const exists = customers.some(c => c.companyName.toLowerCase() === name.trim().toLowerCase());
    if (!exists) {
      const newCust: Omit<Customer, "id"> = {
        companyName: name.trim(),
        address: addr.trim(),
        gstin: gstin.trim().toUpperCase(),
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

  const handleClientChange = (val: string) => {
    setClientName(val);
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
    setClientName(c.companyName);
    setClientAddress(c.address);
    if (c.gstin) {
      handleClientGstinChange(c.gstin);
    } else {
      setClientGstin("");
      setGstValidation(null);
    }
    setShowSuggestions(false);
    
    // Trigger custom visual notification in state
    setSuccess(`Auto-filled ${c.companyName} details!`);
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
  };

  // Deep comparison baseline state to track unsaved changes
  const [initialStateHash, setInitialStateHash] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);
  
  // High-fidelity dynamic scaling states for pixel-perfect fit
  const [previewScale, setPreviewScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  }, [activeTab, items, loadingSettings]);

  // Load custom admin preferences
  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;
      try {
        const fetchedSettings = await getAdminSettings(user.uid);
        setSettings(fetchedSettings);
        
        // Seed default corporate consignee details from Settings
        setConsigneeName(fetchedSettings.signatureName || "DARSHAN ENTERPRISES");
        setConsigneeAddress(fetchedSettings.companyDetails || "");
        setConsigneeGstin(fetchedSettings.gstNumber || "");
        
        // If creating a new invoice, pre-fill numbering format if set
        if (!editInvoice) {
          const defaultDate = new Date().toISOString().split("T")[0];
          setBillDate(defaultDate);
          setPoDate(defaultDate);
          
          if (fetchedSettings.invoiceNumberingFormat) {
            const randomSuffix = Math.floor(100 + Math.random() * 900); // 3-digit placeholder
            const placeholder = fetchedSettings.invoiceNumberingFormat.replace("{number}", String(randomSuffix));
            setBillNumber(placeholder);
          } else {
            setBillNumber(`DE-${Math.floor(10 + Math.random() * 90)}`);
          }
          if (fetchedSettings.terms) {
            setCustomTerms(fetchedSettings.terms);
          }
        }
      } catch (err) {
        console.error("Failed to retrieve settings:", err);
      } finally {
        setLoadingSettings(false);
      }
    }
    loadPreferences();

    const handleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
        if (customEvent.detail.signatureName) {
          setConsigneeName(customEvent.detail.signatureName);
        }
      }
    };
    window.addEventListener("user-settings-updated", handleUpdated);
    return () => {
      window.removeEventListener("user-settings-updated", handleUpdated);
    };
  }, [user, editInvoice]);

  // Load existing Invoice data if editing
  useEffect(() => {
    if (!editInvoice) {
      setHistoryVersions([]);
      return;
    }

    if ((editInvoice as any).history && Array.isArray((editInvoice as any).history) && (editInvoice as any).history.length > 0) {
      setHistoryVersions((editInvoice as any).history);
    } else {
      const formattedDate = editInvoice.billDate || editInvoice.createdAt 
        ? new Date(editInvoice.billDate || editInvoice.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date(editInvoice.billDate || editInvoice.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
        : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

      setHistoryVersions([
        {
          versionId: `v1_${editInvoice.id || Date.now()}`,
          versionNumber: 1,
          savedAt: formattedDate,
          savedBy: editInvoice.creatorEmail ? editInvoice.creatorEmail.split("@")[0] : (user?.displayName || "User"),
          savedByEmail: editInvoice.creatorEmail || user?.email || "",
          status: "saved",
          changesCount: 0,
          changesSummary: "Tax Invoice created",
          diffs: [],
          snapshot: editInvoice,
        }
      ]);
    }
    
    setBillNumber(editInvoice.billNumber || "");
    setBillDate(editInvoice.billDate || "");
    setPoNumber(editInvoice.poNumber || "");
    setPoDate(editInvoice.poDate || "");

    setConsigneeName(editInvoice.consigneeDetails?.companyName || "");
    setConsigneeAddress(editInvoice.consigneeDetails?.address || "");
    setConsigneeGstin(editInvoice.consigneeDetails?.gstin || "");

    setClientName(editInvoice.billedTo.clientName);
    setClientAddress(editInvoice.billedTo.clientAddress);
    
    const initialGstin = editInvoice.billedTo.clientGstin || "";
    setClientGstin(initialGstin);
    if (initialGstin) {
      setGstValidation(validateGSTIN(initialGstin));
    } else {
      setGstValidation(null);
    }

    setJobDescription(editInvoice.jobDescription);
    setItems(editInvoice.items && editInvoice.items.length > 0 ? editInvoice.items : [{ id: "1", srNo: 1, description: "", hsnSac: "995473", qty: 1, unit: "JOB", rate: 0, amount: 0 }]);
    setLetterheadMode(!!editInvoice.letterheadMode);
    const isNaGstin = isNaOrEmptyGSTIN(initialGstin);
    setGstEnabled(!isNaGstin && editInvoice.gstEnabled !== false);
    setPoAttachmentUrl(editInvoice.poAttachmentUrl || "");
    setPoAttachmentName(editInvoice.poAttachmentName || "");
    
    if (editInvoice.customTerms && editInvoice.customTerms.length > 0) {
      setCustomTerms(editInvoice.customTerms);
    } else if (settings?.terms) {
      setCustomTerms(settings.terms);
    } else {
      setCustomTerms([]);
    }
    
    // Set IGST selection based on active rates
    setIsIgstMode(editInvoice.igstRate > 0);
  }, [editInvoice]);

  // Calculations variables
  const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const cgstRate = gstEnabled ? (!isIgstMode ? 9 : 0) : 0;
  const sgstRate = gstEnabled ? (!isIgstMode ? 9 : 0) : 0;
  const igstRate = gstEnabled ? (isIgstMode ? 18 : 0) : 0;

  const {
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstTotal,
    grandTotal
  } = gstEnabled 
    ? calculateGstBreakdown(subTotal, cgstRate, sgstRate, igstRate)
    : { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0, grandTotal: subTotal };

  const rupeesInWords = convertAmountToWords(grandTotal);

  // Baseline dirty state tracker hash constructor
  const getCurrentStateHash = () => {
    return JSON.stringify({
      billNumber, billDate, poNumber, poDate,
      consigneeName, consigneeAddress, consigneeGstin,
      clientName, clientAddress, clientGstin,
      jobDescription, items, letterheadMode, isIgstMode, gstEnabled,
      poAttachmentUrl, poAttachmentName, customTerms
    });
  };

  // Generate initial state baseline hash
  useEffect(() => {
    if (loadingSettings) return;
    // Set baseline hash once on data resolution
    if (initialStateHash === "") {
      setInitialStateHash(getCurrentStateHash());
    }
  }, [loadingSettings]);

  // Monitor baseline changes in real-time
  useEffect(() => {
    if (initialStateHash === "") return;
    const currentHash = getCurrentStateHash();
    const hasUnsavedChanges = currentHash !== initialStateHash;
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [
    billNumber, billDate, poNumber, poDate,
    consigneeName, consigneeAddress, consigneeGstin,
    clientName, clientAddress, clientGstin,
    jobDescription, items, letterheadMode, isIgstMode, gstEnabled,
    poAttachmentUrl, poAttachmentName, customTerms, initialStateHash, onUnsavedChangesChange
  ]);

  // Auto clean dirty unmount
  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (type === "success") {
      setSuccess(message);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(message);
      setTimeout(() => setError(null), 4000);
    }
  };

  // HSN table row interactions
  const handleItemChange = (id: string, field: keyof TaxInvoiceItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Auto amount calculation on Qty or Rate edits
      if (field === "qty" || field === "rate") {
        const q = field === "qty" ? parseFloat(value) || 0 : item.qty;
        const r = field === "rate" ? parseFloat(value) || 0 : item.rate;
        updated.amount = Math.round((q * r + Number.EPSILON) * 100) / 100;
      }
      return updated;
    }));
  };

  const handleAddItem = () => {
    const newId = String(items.length + 1);
    setItems(prev => [
      ...prev,
      { id: newId, srNo: prev.length + 1, description: "", hsnSac: "995473", qty: 1, unit: "JOB", rate: 0, amount: 0 }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) {
      showToast("Cannot delete. Dynamic HSN table must contain at least 1 product row.", "error");
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id).map((item, idx) => ({
      ...item,
      srNo: idx + 1
    })));
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

  // Compile database model and save to Firestore
  const handleSave = async (redirectOnSave: boolean = true, e?: React.FormEvent): Promise<string | null> => {
    if (e) e.preventDefault();
    setError(null);

    const actualBillNumber = billNumber.trim();

    // Validations
    if (!actualBillNumber) {
      showToast("Error: Bill/Invoice Number is required.", "error");
      return null;
    }
    if (!clientName.trim() || !clientAddress.trim()) {
      showToast("Error: Billed To Customer Name and Address are required.", "error");
      return null;
    }
    
    // GSTIN Validation Blocker
    if (clientGstin.trim() && gstValidation && !gstValidation.isValid) {
      showToast(`Error: ${gstValidation.errorMsg || "Invalid Customer GSTIN."}`, "error");
      return null;
    }

    setSaving(true);
    try {
      const isActuallyEdit = !!editInvoice || !!savedDocId;
      const docIdToUse = editInvoice ? editInvoice.id : savedDocId;
      let finalDocId = "";

      const currentPreviewObj: TaxInvoice = {
        id: docIdToUse || "temp_id",
        billNumber: actualBillNumber,
        billDate: billDate || "",
        poNumber: (poNumber || "").trim() || "on Phone",
        poDate: poDate || "",
        consigneeDetails: {
          companyName: (consigneeName || "").trim(),
          address: (consigneeAddress || "").trim(),
          gstin: (consigneeGstin || "").trim()
        },
        billedTo: {
          clientName: (clientName || "").trim(),
          clientAddress: (clientAddress || "").trim(),
          clientGstin: (clientGstin || "").trim().toUpperCase()
        },
        jobDescription: (jobDescription || "").trim() || "Labour Job Work",
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
        rupeesInWords,
        status: isActuallyEdit ? (editInvoice ? editInvoice.status : "draft") : "draft",
        createdAt: isActuallyEdit ? (editInvoice ? editInvoice.createdAt : new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid || "",
        creatorEmail: user?.email || "",
        letterheadMode,
        gstEnabled,
        poAttachmentUrl: poAttachmentUrl || "",
        poAttachmentName: poAttachmentName || "",
        customTerms,
        folderId: isActuallyEdit ? (editInvoice ? editInvoice.folderId : "") : "",
        isImported: editInvoice ? (editInvoice.isImported ?? (editInvoice.invoiceType === "imported")) : false,
        invoiceType: editInvoice?.invoiceType || (editInvoice?.isImported ? "imported" : "manual"),
        importSource: editInvoice?.importSource || (editInvoice?.isImported ? "excel" : null),
        isDeleted: editInvoice?.isDeleted || false,
        isCancelled: editInvoice?.isCancelled || false,
        paymentStatus: editInvoice?.paymentStatus || "unpaid"
      };

      const updatedHistory = commitAutoHistoryVersionIfNeeded(currentPreviewObj);

      const invoiceData = {
        ...currentPreviewObj,
        history: updatedHistory
      };

      if (isActuallyEdit && docIdToUse) {
        finalDocId = docIdToUse;
        await updateInvoice(finalDocId, invoiceData);
        showToast("Invoice updated successfully!", "success");
      } else {
        finalDocId = await createInvoice(invoiceData);
        showToast("Invoice draft created successfully!", "success");
      }
      await captureCustomerIfNeeded(clientName, clientAddress, clientGstin);
      
      // Update baseline hash to prevent prompt trigger
      setInitialStateHash(getCurrentStateHash());
      onUnsavedChangesChange?.(false);
      
      if (redirectOnSave) {
        setTimeout(() => {
          onClose(true);
        }, 1000);
      }

      return finalDocId;
    } catch (err: any) {
      console.error(err);
      showToast("Failed to save invoice.", "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Google Drive Sync trigger
  const handleGoogleDriveSync = async (fileNameOverride?: string) => {
    let activeToken = googleAccessToken;
    if (!activeToken) {
      try {
        showToast("Linking Google account to sync...", "success");
        await loginWithGoogle();
        activeToken = localStorage.getItem("google_drive_access_token");
        if (!activeToken) {
          showToast("Failed to link Google Drive account.", "error");
          return;
        }
        showToast("Google account linked! Continuing sync...", "success");
      } catch (err) {
        showToast("Google link failed. Please sign out and sign back in.", "error");
        return;
      }
    }

    // 1. Save document first to guarantee sync-integrity
    const docId = await handleSave(false);
    if (!docId) return;

    setSyncingToDrive(true);
    showToast("Syncing document...", "success");

    try {
      // 2. Wait 400ms for Preview DOM to stabilize
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // 3. Render PDF Blob
      const pdfBlob = await generatePdfBlob("invoice-pdf-export-container", {
        isCustomized: isSettingsCustomized(settings),
        themeColor: "invoice"
      });
      let filename = fileNameOverride || `Invoice_${billNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}`;
      if (!filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf';
      }

      // Download standard browser copy for immediate offline access
      downloadPdf(pdfBlob, filename);

      // 4. Sync to Drive
      const syncResult = await uploadPdfToGoogleDrive(activeToken, pdfBlob, filename, "DE Bill");
      
      // 5. Update Firestore invoice with drive URLs
      await updateInvoice(docId, {
        driveUrl: syncResult.driveUrl,
        driveFileId: syncResult.driveFileId,
        status: "sent"
      });

      showToast("Invoice synced & saved successfully!", "success");
      
      // Check if PO is attached. If not, trigger PO suggestion modal, otherwise close!
      if (!poAttachmentUrl) {
        setSavedDocId(docId);
        setShowPoSuggestionModal(true);
      } else {
        onClose(true);
      }
    } catch (err: any) {
      console.error(err);
      showToast("Sync failed.", "error");
    } finally {
      setSyncingToDrive(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-violet-400">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="text-muted-foreground text-sm font-semibold animate-pulse">Initializing Invoice system...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1720px] mx-auto py-4 sm:py-6 px-3 sm:px-6 space-y-6 sm:space-y-8 pb-36 select-none">
      {styleBlock}

      {/* Corporate Settings brand line */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-violet-500/10 dark:border-white/10 pb-6 text-left">
        {/* Left block: back button & title */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => onClose()} 
            className="p-2.5 hover:bg-violet-500/10 rounded-2xl transition-colors cursor-pointer text-slate-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-white shrink-0 bg-violet-500/5 border border-violet-500/10"
            title="Go Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#8B5CF6]">
              <FileText className="w-3.5 h-3.5 shrink-0 text-violet-500" />
              <span>Tax Invoice Workspace</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
              {editInvoice ? "Edit Tax Invoice" : "Create Tax Invoice"}
            </h1>
            <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-mono leading-tight">{billNumber || "Draft Bill"}</p>
          </div>
        </div>

        {/* Right block: mobile tab switcher & desktop quick actions */}
        <div className="flex items-center justify-center md:justify-end gap-3 w-full md:w-auto mt-1 md:mt-0">
          {/* Mobile pane switcher */}
          <div className="lg:hidden flex bg-[#fcfaff]/80 dark:bg-zinc-900/60 p-1 rounded-2xl w-full max-w-[360px] border border-violet-500/15 dark:border-white/5 shadow-inner animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "edit" 
                  ? "bg-violet-600 text-white shadow-md scale-[1.01]" 
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Form</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "preview" 
                  ? "bg-violet-600 text-white shadow-md scale-[1.01]" 
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "history" 
                  ? "bg-violet-600 text-white shadow-md scale-[1.01]" 
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </div>

          {/* Desktop Quick Actions */}
          <div className="hidden lg:flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || syncingToDrive}
              className="flex items-center justify-center gap-1.5 border border-violet-500/20 dark:border-white/10 bg-white dark:bg-zinc-900/50 hover:bg-violet-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 py-2.5 px-4 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCustomFileName(`Invoice_${billNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}`);
                setSaveAsNewCopy(false);
                setShowSyncConfirmModal(true);
              }}
              disabled={saving || syncingToDrive}
              className="flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white py-2.5 px-4 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-violet-500/20 scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {syncingToDrive ? (
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

      {/* Premium Toast Notifications */}
      {(error || success) && (
        <div className="fixed top-6 left-4 right-4 md:top-auto md:bottom-6 md:left-auto md:right-6 z-[200] mx-auto max-w-[calc(100%-32px)] md:max-w-sm select-none" style={{ animation: "premiumBounceIn 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275) both" }}>
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
            success 
              ? "border-emerald-500/50 shadow-emerald-500/5" 
              : "border-red-500/50 animate-shake shadow-red-500/5"
          }`}>
            {success ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-lg shadow-emerald-500/60" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-lg shadow-red-500/60" />
            )}
            <span className="text-xs sm:text-sm font-extrabold tracking-wide text-center leading-snug">
              {success || error}
            </span>
          </div>
        </div>
      )}

      {/* Layout grids switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Form uploader inputs column */}
        <div className={`lg:col-span-4 space-y-6 ${activeTab !== "edit" ? "hidden lg:block" : ""}`}>
          
          {/* Top meta card */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-5 text-left bg-zinc-950/40 backdrop-blur-md">
            <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#8B5CF6] uppercase border-b border-white/5 pb-3 flex items-center gap-1.5 min-w-0">
              <ReceiptRupee className="w-4 h-4 shrink-0 text-violet-500" />
              <span className="truncate">Invoice Core Metadata</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bill Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Bill/Invoice Number</label>
                <input
                  type="text"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-white font-mono text-sm"
                  placeholder="e.g. DE-10"
                  required
                />
              </div>

              {/* Bill Date */}
              <div className="space-y-1.5">
                <CustomDatePicker
                  label="Bill/Invoice Date"
                  value={billDate}
                  onChange={(val) => setBillDate(val)}
                  isInvoiceTheme={true}
                  required={true}
                  placeholder="Select Bill Date"
                />
              </div>

              {/* PO Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">P.O. Number (Optional)</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-white text-xs font-medium"
                  placeholder="e.g. on Phone"
                />
              </div>

              {/* PO Date */}
              <div className="space-y-1.5">
                <CustomDatePicker
                  label="P.O. Date (Optional)"
                  value={poDate}
                  onChange={(val) => setPoDate(val)}
                  isInvoiceTheme={true}
                  placeholder="Select PO Date"
                />
              </div>

              {/* Purchase Order (PO) File Attachment Uploader */}
              <div className="col-span-1 sm:col-span-2 space-y-2 mt-1">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-violet-400" />
                  <span>Purchase Order (PO) Attachment</span>
                </label>
                
                {poAttachmentUrl ? (
                  /* Display attached file preview box */
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-violet-600/10 border border-violet-500/20 backdrop-blur-md transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/25 flex items-center justify-center text-violet-400 shrink-0">
                        <FileText className="w-5.5 h-5.5" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-white truncate max-w-[190px] sm:max-w-xs leading-tight">
                          {poAttachmentName || "Purchase_Order_Document"}
                        </p>
                        <a
                          href={poAttachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-extrabold text-violet-400 hover:text-violet-300 hover:underline inline-block mt-0.5"
                        >
                          View Original File
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPoAttachmentUrl("");
                        setPoAttachmentName("");
                        showToast("Purchase Order document detached.", "success");
                      }}
                      className="p-2.5 rounded-xl hover:bg-red-500/15 border border-transparent hover:border-red-500/20 text-zinc-400 hover:text-red-500 cursor-pointer transition-colors active:scale-95 shrink-0"
                      title="Detach PO File"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* File selector slot */
                  <div className="border border-dashed border-violet-500/20 dark:border-white/15 bg-violet-500/5 dark:bg-zinc-900/40 hover:bg-violet-500/10 dark:hover:bg-zinc-900/60 rounded-2xl p-4.5 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-300 group">
                    <label className="w-full flex flex-col items-center justify-center cursor-pointer select-none">
                      {poUploading ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 animate-spin text-violet-450 mb-2" />
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Uploading Purchase Order...</span>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">Please wait, uploading file securely</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <UploadCloud className="w-8 h-8 text-zinc-400 dark:text-zinc-550 mb-2 group-hover:text-violet-650 dark:group-hover:text-violet-400 transition-colors" />
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-violet-600 dark:group-hover:text-white transition-colors">Attach PO (PDF or Image)</span>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1 font-semibold uppercase tracking-wider">Supports PDF, PNG, JPG (Max 5MB)</span>
                        </div>
                      )}
                      
                      {!poUploading && (
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            // Size Check: 5MB Cap
                            if (file.size > 5 * 1024 * 1024) {
                              showToast("Error: PO document exceeds the 5MB size restriction.", "error");
                              return;
                            }
                            
                            setPoUploading(true);
                            try {
                              const secureUrl = await uploadPoAttachment(file);
                              setPoAttachmentUrl(secureUrl);
                              setPoAttachmentName(file.name);
                              showToast("Purchase Order document attached successfully!", "success");
                            } catch (err: any) {
                              console.error(err);
                              showToast("Failed to upload PO attachment.", "error");
                            } finally {
                              setPoUploading(false);
                            }
                          }}
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Consignee details */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-5 text-left bg-zinc-950/40 backdrop-blur-md">
            <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#8B5CF6] uppercase border-b border-white/5 pb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 shrink-0 text-violet-500" />
              <span className="truncate">Consignee (Your Company)</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block truncate">Consignee Name</label>
                <input
                  type="text"
                  value={consigneeName}
                  onChange={(e) => setConsigneeName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-white text-sm font-bold"
                  placeholder="e.g. DARSHAN ENTERPRISES"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block truncate">Consignee Address</label>
                <textarea
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${Math.max(42, el.scrollHeight)}px`;
                    }
                  }}
                  value={consigneeAddress}
                  onChange={(e) => {
                    setConsigneeAddress(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.max(42, e.target.scrollHeight)}px`;
                  }}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = "auto";
                    target.style.height = `${Math.max(42, target.scrollHeight)}px`;
                  }}
                  rows={1}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-white text-xs leading-relaxed resize-none overflow-hidden"
                  placeholder="Street details, GIDC location, City, District, State..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block truncate">Consignee GSTIN</label>
                <input
                  type="text"
                  value={consigneeGstin}
                  onChange={(e) => setConsigneeGstin(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-white text-sm font-mono"
                  placeholder="e.g. 24BCVPP7836H1ZW"
                />
              </div>
            </div>
          </div>

          {/* Billed To Customer */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-5 text-left bg-zinc-950/40 backdrop-blur-md">
            <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#8B5CF6] uppercase border-b border-white/5 pb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 shrink-0 text-violet-500" />
              <span className="truncate">Billed To (Customer)</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block truncate">Customer/Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-white text-sm font-bold"
                  placeholder="e.g. H M Electrical"
                  required
                  onFocus={() => {
                    if (clientName.trim()) {
                      const filtered = customers.filter(c => 
                        c.companyName.toLowerCase().includes(clientName.toLowerCase())
                      );
                      setShowSuggestions(filtered.length > 0);
                    }
                  }}
                />
                {showSuggestions && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowSuggestions(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-45 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl max-h-[220px] overflow-y-auto overflow-x-hidden p-1.5 flex flex-col gap-0.5 animate-in fade-in duration-150 scrollbar-thin scrollbar-thumb-zinc-800">
                      <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-violet-400 border-b border-white/5 select-none text-left">
                        CRM Customer Records
                      </div>
                      {customers
                        .filter(c => c.companyName.toLowerCase().includes(clientName.toLowerCase()))
                        .map((c, index) => (
                          <button
                            key={c.id || index}
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-violet-600/20 text-white transition-all flex flex-col justify-start gap-0.5 cursor-pointer border-0 bg-transparent"
                          >
                            <span className="font-bold text-zinc-100 line-clamp-1">{c.companyName}</span>
                            {c.address && <span className="text-[10px] text-zinc-450 dark:text-zinc-400 truncate text-left">{c.address}</span>}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block truncate">Customer Address Details</label>
                <textarea
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${Math.max(42, el.scrollHeight)}px`;
                    }
                  }}
                  value={clientAddress}
                  onChange={(e) => {
                    setClientAddress(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.max(42, e.target.scrollHeight)}px`;
                  }}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = "auto";
                    target.style.height = `${Math.max(42, target.scrollHeight)}px`;
                  }}
                  rows={1}
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-white text-xs leading-relaxed resize-none overflow-hidden"
                  placeholder="Client office location, street, state pin..."
                  required
                />
              </div>

              <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Customer GSTIN (Optional)</label>
                  <span className={`text-[10px] font-bold ${clientGstin.length === 15 || isNaOrEmptyGSTIN(clientGstin) ? 'text-emerald-500 dark:text-emerald-400' : 'text-zinc-500'}`}>
                    {isNaOrEmptyGSTIN(clientGstin) ? 'OPTIONAL / URP' : `${clientGstin.length}/15`}
                  </span>
                </div>
                <input
                  type="text"
                  value={clientGstin}
                  onChange={(e) => handleClientGstinChange(e.target.value)}
                  maxLength={15}
                  className={`w-full px-4 py-3 rounded-xl border bg-zinc-900/60 focus:ring-2 outline-none transition-all text-white text-sm font-mono uppercase ${
                    clientGstin && !isNaOrEmptyGSTIN(clientGstin)
                      ? (gstValidation?.isValid 
                          ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20' 
                          : 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20')
                      : 'border-white/10 focus:border-violet-500 focus:ring-violet-500/20'
                  }`}
                  placeholder="e.g. 24BCVPP7836H1ZW or NA"
                />
                {gstValidation && !isNaOrEmptyGSTIN(clientGstin) && <GSTInfoCard validation={gstValidation} />}
              </div>
            </div>
          </div>

          {/* Job Section */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-5 text-left bg-zinc-950/40 backdrop-blur-md">
            <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#8B5CF6] uppercase border-b border-white/5 pb-3 flex items-center gap-1.5 min-w-0">
              <FileText className="w-4 h-4 shrink-0 text-violet-500" />
              <span className="truncate">Job Title & Details</span>
            </h3>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Job Description Header</label>
              <input
                type="text"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-white text-sm font-bold"
                placeholder="e.g. Painting Work (Anupam Rasayan unit -4Jhagadia )"
              />
            </div>
          </div>

          {/* Dynamic Product HSN table */}
          <div className="glass-panel p-3.5 sm:p-5 rounded-3xl border border-white/10 space-y-4 text-left bg-zinc-950/40 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
              <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#8B5CF6] uppercase flex items-center gap-1.5 min-w-0">
                <ReceiptRupee className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                <span className="truncate">Item Breakdown</span>
              </h3>
              
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center justify-center gap-1 bg-violet-600/10 hover:bg-violet-600 text-violet-400 hover:text-white border border-violet-500/20 py-1.5 px-3 rounded-xl text-[10.5px] font-bold cursor-pointer transition-all active:scale-[0.97] shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>Add Item Row</span>
              </button>
            </div>

            {/* dynamic rows list */}
            <div className="space-y-3 w-full">
              {items.map((item, idx) => (
                <div 
                  key={item.id} 
                  className="p-3 bg-violet-50/40 dark:bg-zinc-900/40 rounded-2xl border border-violet-500/15 dark:border-white/5 relative flex flex-col gap-2 group animate-in slide-in-from-top-1.5 duration-200 shadow-sm"
                >
                  {/* Row Header: Item #, Bold button, and Remove button */}
                  <div className="flex items-center justify-between pb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4.5 h-4.5 rounded-full bg-violet-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
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
                        className="px-1.5 py-0.2 rounded bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-[9px] font-black cursor-pointer select-none active:scale-95 transition-all"
                        title="Format selection as Bold (Ctrl+B)"
                      >
                        B
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-zinc-400 hover:text-red-500 cursor-pointer p-0.5 rounded hover:bg-red-500/10 transition-colors"
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
                    className="w-full px-2.5 py-1.5 rounded-xl border border-violet-500/20 dark:border-white/10 bg-white dark:bg-zinc-950/60 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/10 outline-none transition-all text-slate-900 dark:text-white text-[11px] leading-relaxed shadow-inner resize-none overflow-hidden"
                    placeholder="Enter item description... (Ctrl+B to bold)"
                  />

                  {/* Equal 4-Column Grid: HSN/SAC, Qty, Unit, Rate */}
                  <div className="grid grid-cols-12 gap-1.5 pt-0.5">
                    {/* HSN/SAC */}
                    <div className="col-span-3 space-y-0.5">
                      <label className="text-[8px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block truncate">HSN/SAC</label>
                      <input
                        type="text"
                        value={item.hsnSac}
                        onChange={(e) => handleItemChange(item.id, "hsnSac", e.target.value)}
                        className="w-full px-1.5 py-1 rounded-lg border border-violet-500/20 dark:border-white/10 bg-white dark:bg-zinc-950/60 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/10 outline-none transition-all text-slate-900 dark:text-white font-mono text-[11px] text-center shadow-inner"
                        placeholder="995473"
                      />
                    </div>

                    {/* Qty */}
                    <div className="col-span-3 space-y-0.5">
                      <label className="text-[8px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block truncate">Qty</label>
                      <input
                        type="number"
                        step="any"
                        value={item.qty || ""}
                        onChange={(e) => handleItemChange(item.id, "qty", e.target.value)}
                        className="w-full px-1.5 py-1 rounded-lg border border-violet-500/20 dark:border-white/10 bg-white dark:bg-zinc-950/60 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/10 outline-none transition-all text-slate-900 dark:text-white text-[11px] text-center shadow-inner"
                        placeholder="1"
                      />
                    </div>

                    {/* Unit */}
                    <div className="col-span-3 space-y-0.5">
                      <label className="text-[8px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block truncate">Unit</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(item.id, "unit", e.target.value)}
                        className="w-full px-1.5 py-1 rounded-lg border border-violet-500/20 dark:border-white/10 bg-white dark:bg-zinc-950/60 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/10 outline-none transition-all text-slate-900 dark:text-white text-[11px] text-center font-bold shadow-inner"
                        placeholder="Nos"
                      />
                    </div>

                    {/* Rate */}
                    <div className="col-span-3 space-y-0.5">
                      <label className="text-[8px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-widest block truncate">Rate (₹)</label>
                      <input
                        type="number"
                        step="any"
                        value={item.rate || ""}
                        onChange={(e) => handleItemChange(item.id, "rate", e.target.value)}
                        className="w-full px-1.5 py-1 rounded-lg border border-violet-500/20 dark:border-white/10 bg-white dark:bg-zinc-950/60 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/10 outline-none transition-all text-slate-900 dark:text-white text-[11px] text-right font-mono shadow-inner"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ultra-Compact Bank Details & Calculations Summary */}
            <div className="mt-3 pt-3 border-t border-violet-500/10 dark:border-white/5 space-y-3">
              {/* Bank Account Details */}
              {gstEnabled && (
                <div className="p-2.5 bg-violet-500/[0.04] dark:bg-zinc-900/60 rounded-xl border border-violet-500/10 dark:border-white/5 space-y-0.5 select-none text-left">
                  <div className="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                    🔒 Registered Bank Details (Auto-Printed)
                  </div>
                  <div className="text-[10.5px] text-slate-600 dark:text-zinc-400 font-medium space-y-0.5">
                    <div>Bank: <strong className="text-slate-900 dark:text-white">{settings?.bankName || "State Bank of India"}</strong></div>
                    <div>A/c: <strong className="text-slate-900 dark:text-white font-mono">{settings?.bankAccountNo || "42085596249"}</strong></div>
                    <div>IFSC: <strong className="text-slate-900 dark:text-white font-mono">{settings?.bankIfscCode || "SBIN0017314"}</strong></div>
                  </div>
                </div>
              )}

              {/* Calculations Summary */}
              <div className="space-y-1 text-xs font-semibold pt-1 border-t border-violet-500/10 dark:border-white/5">
                <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-900 dark:text-white">₹{subTotal.toFixed(2)}</span>
                </div>
                {gstEnabled && (
                  <>
                    {cgstRate > 0 && (
                      <div className="flex justify-between text-slate-500 dark:text-zinc-400 text-[11px]">
                        <span>CGST ({cgstRate}%):</span>
                        <span className="font-mono text-slate-900 dark:text-white">₹{cgstAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {sgstRate > 0 && (
                      <div className="flex justify-between text-slate-500 dark:text-zinc-400 text-[11px]">
                        <span>SGST ({sgstRate}%):</span>
                        <span className="font-mono text-slate-900 dark:text-white">₹{sgstAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {igstRate > 0 && (
                      <div className="flex justify-between text-slate-500 dark:text-zinc-400 text-[11px]">
                        <span>IGST ({igstRate}%):</span>
                        <span className="font-mono text-slate-900 dark:text-white">₹{igstAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-slate-900 dark:text-white font-black text-sm pt-1 border-t border-violet-500/15 dark:border-white/10">
                  <span>Grand Total:</span>
                  <span className="font-mono text-violet-600 dark:text-violet-400">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Custom Terms & Conditions Editor */}
          <div className="glass-panel p-3.5 sm:p-5 rounded-3xl border border-white/10 space-y-4 text-left bg-zinc-950/40 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
              <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#8B5CF6] uppercase flex items-center gap-1.5 min-w-0">
                <FileText className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                <span className="truncate">Terms & Conditions</span>
              </h3>
              <button
                type="button"
                onClick={() => setCustomTerms([...customTerms, ""])}
                className="flex items-center justify-center gap-1 bg-violet-600/10 hover:bg-violet-600 text-violet-400 hover:text-white border border-violet-500/20 py-1.5 px-3 rounded-xl text-[10.5px] font-bold cursor-pointer transition-all active:scale-[0.97] shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>Add Term</span>
              </button>
            </div>

            <div className="space-y-3">
              {customTerms.map((term, index) => (
                <div key={index} className="flex items-start gap-3 group animate-in fade-in slide-in-from-top-1">
                  <div className="w-6 h-6 shrink-0 rounded-full bg-violet-100 dark:bg-zinc-800 text-[10px] text-violet-600 dark:text-zinc-400 font-extrabold flex items-center justify-center shadow-inner mt-1">
                    {index + 1}
                  </div>
                  <input
                    value={term}
                    onChange={(e) => {
                      const newTerms = [...customTerms];
                      newTerms[index] = e.target.value;
                      setCustomTerms(newTerms);
                    }}
                    className="flex-1 px-4 py-2 rounded-xl border border-violet-500/20 dark:border-white/10 bg-white dark:bg-zinc-950/60 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/10 outline-none transition-all text-slate-900 dark:text-white text-xs shadow-inner"
                    placeholder="Enter condition..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newTerms = customTerms.filter((_, i) => i !== index);
                      setCustomTerms(newTerms);
                    }}
                    className="text-zinc-500 hover:text-red-500 cursor-pointer p-2 rounded-lg hover:bg-red-500/10 transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
                    title="Remove term"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {customTerms.length === 0 && (
                <div className="text-center py-4 text-xs font-bold text-slate-500 dark:text-zinc-500 italic border border-dashed border-violet-500/20 dark:border-white/10 rounded-xl">
                  No terms and conditions added.
                </div>
              )}
            </div>
          </div>

          {/* GST Split configuration */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-5 text-left bg-zinc-950/40 backdrop-blur-md">
            <h3 className="text-xs sm:text-sm font-extrabold tracking-wider text-[#8B5CF6] uppercase border-b border-white/5 pb-3 flex items-center gap-1.5 min-w-0">
              <ReceiptRupee className="w-4 h-4 shrink-0 text-violet-500" />
              <span className="truncate">Tax Settings & GST</span>
            </h3>

            {/* GST Billing Mode Switch */}
            <div className="flex items-center justify-between p-3.5 bg-[#fcfaff] dark:bg-zinc-900/60 border border-violet-500/15 dark:border-white/5 rounded-2xl shadow-sm">
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Enable GST Billing</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">Calculate GST on invoices and display tax details.</p>
              </div>

              <button
                type="button"
                onClick={() => setGstEnabled(!gstEnabled)}
                className="text-violet-400 hover:text-violet-300 cursor-pointer active:scale-95 transition-transform"
              >
                {gstEnabled ? (
                  <ToggleRight className="w-10 h-10 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-zinc-500" />
                )}
              </button>
            </div>

            {/* IGST Mode Switch (Nested, only visible if GST is active) */}
            {gstEnabled && (
              <div className="flex items-center justify-between p-3.5 bg-[#fcfaff] dark:bg-zinc-900/60 border border-violet-500/15 dark:border-white/5 rounded-2xl shadow-sm animate-in slide-in-from-top-1 duration-200">
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Use IGST (Inter-State)</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">Use IGST (18%) instead of CGST + SGST for interstate transactions.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsIgstMode(!isIgstMode)}
                  className="text-violet-400 hover:text-violet-300 cursor-pointer active:scale-95 transition-transform"
                >
                  {isIgstMode ? (
                    <ToggleRight className="w-10 h-10 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-zinc-500" />
                  )}
                </button>
              </div>
            )}

            {/* Master Print settings */}
            <div className="flex items-center justify-between p-3.5 bg-[#fcfaff] dark:bg-zinc-900/60 border border-violet-500/15 dark:border-white/5 rounded-2xl select-none shadow-sm">
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Pre-printed Letterhead Mode</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">Hide graphic logo/signature borders for physical printing</p>
              </div>

              <button
                type="button"
                onClick={() => setLetterheadMode(!letterheadMode)}
                className="text-violet-400 hover:text-violet-300 cursor-pointer active:scale-95 transition-transform"
              >
                {letterheadMode ? (
                  <ToggleRight className="w-10 h-10 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-zinc-500" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live A4 sheet preview column (Hidden on mobile, sticky on desktop) */}
        <div className={`lg:col-span-5 lg:sticky lg:top-[90px] ${activeTab !== "preview" ? "hidden lg:block" : ""}`} ref={containerRef}>
          <div className="relative group/preview flex flex-col items-center">
            
            <div 
              className="relative overflow-hidden rounded-3xl border border-violet-500/15 dark:border-white/5 bg-white shadow-2xl select-none"
              style={{ 
                height: scaledHeight ? `${scaledHeight}px` : "auto",
                width: `${previewScale * 810}px`,
                transition: "height 0.2s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              <div 
                ref={wrapperRef}
                className="origin-top-left absolute left-0 top-0"
                style={{ 
                  transform: `scale(${previewScale})`,
                  width: "810px"
                }}
              >
                <InvoicePreview 
                  ref={previewRef}
                  invoice={{
                    id: "preview-inv-id",
                    billNumber: billNumber || "DE-10",
                    billDate,
                    poNumber: poNumber || "on Phone",
                    poDate,
                    consigneeDetails: {
                      companyName: consigneeName || "DARSHAN ENTERPRISES",
                      address: consigneeAddress || settings!.companyDetails,
                      gstin: consigneeGstin || settings!.gstNumber
                    },
                    billedTo: {
                      clientName: clientName || "[Billed Client Name]",
                      clientAddress: clientAddress || "[Client Corporate Address]",
                      clientGstin: clientGstin || "[Client GSTIN]"
                    },
                    jobDescription: jobDescription || "Labour Job Work Details",
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
                    rupeesInWords,
                    status: "draft",
                    createdAt: new Date().toISOString(),
                    createdBy: user?.uid || "",
                    creatorEmail: user?.email || "",
                    letterheadMode,
                    gstEnabled,
                    customTerms
                  }} 
                  settings={settings!} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tax Invoice History & Change Preview */}
        <div className={`lg:col-span-3 lg:sticky lg:top-[90px] ${activeTab !== "history" ? "hidden lg:block" : ""}`}>
          <InvoiceHistoryPanel
            versions={historyVersions}
            currentPreview={{
              id: editInvoice?.id || "preview-inv-id",
              billNumber: billNumber || "DE-10",
              billDate,
              poNumber: poNumber || "on Phone",
              poDate,
              consigneeDetails: {
                companyName: consigneeName || "DARSHAN ENTERPRISES",
                address: consigneeAddress || settings?.companyDetails || "",
                gstin: consigneeGstin || settings?.gstNumber || ""
              },
              billedTo: {
                clientName: clientName || "[Billed Client Name]",
                clientAddress: clientAddress || "[Client Corporate Address]",
                clientGstin: clientGstin || "[Client GSTIN]"
              },
              jobDescription: jobDescription || "Labour Job Work Details",
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
              rupeesInWords,
              status: "draft",
              createdAt: editInvoice?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: user?.uid || "",
              creatorEmail: user?.email || "",
              letterheadMode,
              gstEnabled,
              customTerms
            }}
            onRestoreVersion={handleRestoreInvoiceVersion}
            isSaving={saving}
            currentUserDisplayName={user?.displayName || "HD_Mixture"}
          />
        </div>

      </div>

      {/* Hidden Offscreen Container for dynamic, unscaled, pixel-perfect PDF compiles */}
      {settings && (
        <div style={{ position: "absolute", top: "-9999px", left: "-9999px", pointerEvents: "none", zIndex: -1000 }}>
          <InvoicePreview 
            id="invoice-pdf-export-container"
            invoice={{
              id: "export-inv-id",
              billNumber: billNumber || "DE-10",
              billDate,
              poNumber: poNumber || "on Phone",
              poDate,
              consigneeDetails: {
                companyName: consigneeName || "DARSHAN ENTERPRISES",
                address: consigneeAddress || settings.companyDetails,
                gstin: consigneeGstin || settings.gstNumber
              },
              billedTo: {
                clientName: clientName || "[Billed Client Name]",
                clientAddress: clientAddress || "[Client Corporate Address]",
                clientGstin: clientGstin || "[Client GSTIN]"
              },
              jobDescription: jobDescription || "Labour Job Work Details",
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
              rupeesInWords,
              status: "draft",
              createdAt: new Date().toISOString(),
              createdBy: user?.uid || "",
              creatorEmail: user?.email || "",
              letterheadMode,
              gstEnabled,
              customTerms
            }} 
            settings={settings} 
          />
        </div>
      )}

      {/* Sticky Mobile Floating Footer */}
      <div className="lg:hidden fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="w-full bg-[#fcfaff]/95 dark:bg-zinc-950/90 backdrop-blur-lg border border-violet-500/20 dark:border-white/10 p-2.5 rounded-2xl flex gap-2 shadow-2xl pointer-events-auto">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving || syncingToDrive}
            className="flex-1 flex items-center justify-center gap-1.5 bg-violet-50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-violet-500/20 py-2.5 px-4 rounded-xl font-bold text-xs cursor-pointer transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Draft</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setCustomFileName(`Invoice_${billNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}`);
              setSaveAsNewCopy(false);
              setShowSyncConfirmModal(true);
            }}
            disabled={saving || syncingToDrive}
            className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs cursor-pointer transition-all shadow-lg shadow-violet-500/20"
          >
            {syncingToDrive ? (
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
                  <CloudLightning className="w-5 h-5 text-violet-600 dark:text-violet-400" />
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

            {/* File Name Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">PDF File Name</label>
              <input 
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder="e.g. Reliance_Invoice_May"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-black/40 text-sm font-bold text-slate-900 dark:text-white focus:border-violet-500/60 dark:focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all font-mono"
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
                  if (!customFileName.trim()) {
                    showToast("Please enter a file name.", "error");
                    return;
                  }
                  setShowSyncConfirmModal(false);
                  handleGoogleDriveSync(customFileName.trim());
                }}
                className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-sm font-bold transition-all cursor-pointer text-white shadow-lg shadow-violet-500/20 text-center flex items-center justify-center gap-1.5"
              >
                <CloudLightning className="w-4 h-4" />
                <span>Proceed to Sync</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Purchase Order Suggestion Overlay Modal */}
      {showPoSuggestionModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999999] min-h-screen w-screen bg-black/75 dark:bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200 text-left">
          <style dangerouslySetInnerHTML={{ __html: `
            .bouncy-po-modal {
              animation: poBouncyPop 0.45s cubic-bezier(0.34, 1.6, 0.64, 1) forwards;
            }
            @keyframes poBouncyPop {
              0% {
                opacity: 0;
                transform: scale(0.88) translateY(30px);
              }
              100% {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}} />
          
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-[32px] text-center shadow-2xl relative select-none bouncy-po-modal text-slate-800 dark:text-zinc-100"
            style={{ boxShadow: "0 20px 50px rgba(139, 92, 246, 0.1), 0 0 30px rgba(0,0,0,0.05)" }}
          >
            {/* Vector Paperclip Illustration */}
            <div className="w-16 h-16 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 dark:border-violet-500/10 flex items-center justify-center mx-auto shadow-lg mb-4 mt-2">
              <Paperclip className="w-7 h-7 animate-pulse text-violet-600 dark:text-violet-400" />
            </div>
            
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Invoice Synced! 🎉</h3>
            <h4 className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mt-1">Would you like to attach the PO?</h4>
            
            <p className="mt-3.5 text-xs text-slate-500 dark:text-zinc-400 font-semibold leading-relaxed px-2">
              Your commercial Tax Invoice has been generated and synced successfully. To keep files organized, would you like to attach the customer's matching **Purchase Order (PO)** document to this invoice now?
            </p>
            
            <div className="mt-6 space-y-3">
              {/* Interactive File Upload Area inside suggestion modal */}
              {poUploading ? (
                <div className="py-5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-violet-600 dark:text-violet-400 mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Uploading Purchase Order...</span>
                </div>
              ) : (
                <label className="w-full py-4.5 px-4 rounded-2xl border border-dashed border-violet-300 dark:border-violet-500/30 hover:border-violet-500 dark:hover:border-violet-400 bg-violet-50 dark:bg-violet-500/5 hover:bg-violet-100/60 dark:hover:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group">
                  <UploadCloud className="w-7 h-7 text-slate-400 dark:text-zinc-500 mb-1.5 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors animate-pulse" />
                  <span className="text-xs font-extrabold">Upload Purchase Order (PO)</span>
                  <span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5">Supports PDF and Images (Max 5MB)</span>
                  
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      // Size check
                      if (file.size > 5 * 1024 * 1024) {
                        showToast("Error: PO exceeds 5MB limit.", "error");
                        return;
                      }
                      
                      setPoUploading(true);
                      try {
                        const secureUrl = await uploadPoAttachment(file);
                        
                        // Update Firestore document directly with new PO attachment details!
                        if (savedDocId) {
                          await updateInvoice(savedDocId, {
                            poAttachmentUrl: secureUrl,
                            poAttachmentName: file.name
                          });
                        }
                        
                        setPoAttachmentUrl(secureUrl);
                        setPoAttachmentName(file.name);
                        showToast("Purchase Order attached and synced successfully!", "success");
                        
                        // Confetti explosion
                        if (typeof window !== "undefined") {
                          import("canvas-confetti").then((module) => {
                            module.default({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
                          });
                        }
                        
                        // Wait 1.2s for success feel before closing form
                        setTimeout(() => {
                          setShowPoSuggestionModal(false);
                          onClose(true);
                        }, 1200);
                        
                      } catch (err: any) {
                        console.error(err);
                        showToast("Failed to upload PO attachment.", "error");
                      } finally {
                        setPoUploading(false);
                      }
                    }}
                  />
                </label>
              )}
              
              <button
                type="button"
                onClick={() => {
                  setShowPoSuggestionModal(false);
                  onClose(true);
                }}
                className="w-full py-3 px-5 rounded-2xl text-xs font-extrabold border border-slate-200 dark:border-zinc-800 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white cursor-pointer transition-all active:scale-[0.98]"
              >
                No, Skip & Finish
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const styleBlock = (
  <style dangerouslySetInnerHTML={{ __html: `
    .glass-panel {
      background: rgba(15, 23, 42, 0.3);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    }

    /* Light mode overrides for Invoice Form */
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
    html:not(.dark) .invoice-workspace-theme textarea::placeholder {
      color: #94a3b8 !important;
    }

    html:not(.dark) .invoice-workspace-theme .text-white:not(.bg-violet-600):not(.bg-violet-600 *):not(.bg-emerald-600):not(.bg-emerald-600 *):not(.bg-red-600):not(.bg-red-600 *):not(.bg-rose-600):not(.bg-rose-600 *):not(.bg-amber-500):not(.bg-amber-500 *) {
      color: #0f172a !important;
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

    html:not(.dark) .invoice-workspace-theme .bg-zinc-900\/50 {
      background: rgba(255, 255, 255, 0.75) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-900\/60 {
      background: rgba(255, 255, 255, 0.8) !important;
    }

    html:not(.dark) .invoice-workspace-theme .bg-zinc-950\/20 {
      background: rgba(255, 255, 255, 0.4) !important;
      border-color: rgba(139, 92, 246, 0.1) !important;
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

    html:not(.dark) .invoice-workspace-theme .text-zinc-100 {
      color: #0f172a !important;
    }
  `}} />
);

export default InvoiceForm;
