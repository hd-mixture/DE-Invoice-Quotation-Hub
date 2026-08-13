"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AdminSettings } from "../../types";
import { getAdminSettings, saveAdminSettings, getQuotations, wipeUserAccountData, isSettingsCustomized, DEFAULT_SETTINGS } from "../../firebase/db";
import { uploadSettingImage, fileToBase64 } from "../../firebase/storage";
import { deleteFileFromGoogleDrive } from "../../services/googleDrive";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";
import { validateGSTIN } from "../../utils/gstValidation";
import { ReceiptRupee } from "../common/ReceiptRupee";
import { 
  Building2, 
  Receipt, 
  Signature, 
  Upload, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  FileImage,
  Sparkles,
  HelpCircle,
  Edit3,
  Check,
  X,
  Moon,
  Sun,
  User,
  LogOut,
  Lock,
  ShieldAlert,
  KeyRound,
  CreditCard,
  ArrowLeftRight,
  RotateCcw
} from "lucide-react";

interface AdminSettingsPanelProps {
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
  workspaceMode?: 'quotation' | 'invoice' | null;
  setWorkspaceMode?: (mode: 'quotation' | 'invoice' | null) => void;
}

export const AdminSettingsPanel: React.FC<AdminSettingsPanelProps> = ({ 
  onUnsavedChangesChange,
  workspaceMode,
  setWorkspaceMode
}) => {
  const { user, logout, googleAccessToken } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // File loading states
  const [headerUploading, setHeaderUploading] = useState(false);
  const [footerUploading, setFooterUploading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        const fetched = await getAdminSettings(user.uid);
        setSettings(fetched);
        setInitialSettings(JSON.parse(JSON.stringify(fetched))); // deep copy
      } catch (err) {
        setError("Failed to load settings from storage.");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [user]);

  // Track changes to trigger the unsaved warning alerts
  useEffect(() => {
    if (!settings || !initialSettings) {
      onUnsavedChangesChange?.(false);
      return;
    }
    const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);
    onUnsavedChangesChange?.(hasChanges);
  }, [settings, initialSettings, onUnsavedChangesChange]);

  // Clean up dirty state on unmount
  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  // Toggle drawer-open class on body to automatically slide off-screen mobile navbar and lock scroll
  useEffect(() => {
    if (showSwitchModal || showRestoreModal) {
      document.body.classList.add("drawer-open", "overflow-hidden");
    } else {
      document.body.classList.remove("drawer-open", "overflow-hidden");
    }
    return () => {
      document.body.classList.remove("drawer-open", "overflow-hidden");
    };
  }, [showSwitchModal, showRestoreModal]);

  const handleInputChange = (field: keyof AdminSettings, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [field]: value
    });
  };



  // Image Upload handler
  const handleImageUpload = async (field: "headerImage" | "footerImage" | "signatureImage", file: File) => {
    if (!settings) return;
    
    // Set individual uploading states
    if (field === "headerImage") setHeaderUploading(true);
    if (field === "footerImage") setFooterUploading(true);
    if (field === "signatureImage") setSigUploading(true);
    
    try {
      // Compress and convert to Base64 to stay highly resilient,
      // or upload to Storage (which falls back to base64 if storage is unconfigured)
      const imageUrl = await uploadSettingImage(field, file);
      handleInputChange(field, imageUrl);
      setSuccess(`${field === "headerImage" ? "Header Logo" : field === "footerImage" ? "Footer Image" : "Signature Image"} uploaded successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setHeaderUploading(false);
      setFooterUploading(false);
      setSigUploading(false);
    }
  };

  // Add a terms item
  const handleAddTerm = () => {
    if (!settings || !newTerm.trim()) return;
    const updatedTerms = [...settings.terms, newTerm.trim()];
    handleInputChange("terms", updatedTerms);
    setNewTerm("");
  };

  // Delete a terms item
  const handleDeleteTerm = (index: number) => {
    if (!settings) return;
    const updatedTerms = settings.terms.filter((_, i) => i !== index);
    handleInputChange("terms", updatedTerms);
  };

  // Save an edited term item
  const handleSaveTerm = (index: number) => {
    if (!settings || !editingText.trim()) return;
    const updatedTerms = [...settings.terms];
    updatedTerms[index] = editingText.trim();
    handleInputChange("terms", updatedTerms);
    setEditingIndex(null);
    setEditingText("");
  };

  const handleSave = async () => {
    if (!settings) return;
    


    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveAdminSettings(settings, user?.uid);
      setSuccess("Settings updated successfully!");
      setInitialSettings(JSON.parse(JSON.stringify(settings))); // Update initialSettings to match saved settings
      // Notify active components of settings change
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("user-settings-updated", { detail: settings }));
        import("canvas-confetti").then((module) => {
          module.default({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.8 }
          });
        });
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError("Failed to save changes: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRestoreDefault = async () => {
    if (!user) return;
    setShowRestoreModal(false);
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      await saveAdminSettings(defaultCopy, user.uid);
      setSettings(defaultCopy);
      setInitialSettings(defaultCopy);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("user-settings-updated", { detail: defaultCopy }));
      }
      setSuccess("Workspace Settings restored to defaults successfully!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError("Failed to restore default settings: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-semibold animate-pulse">Loading Admin configurations...</p>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:py-8 space-y-6 sm:space-y-8 pb-36 sm:pb-24 text-left">
      {/* Mobile Brand Banner - Beautifully branded for Darshan Enterprises! */}
      <div className="flex md:hidden flex-col items-center text-center p-6 bg-gradient-to-b from-[#09357B]/5 to-transparent dark:from-blue-500/5 rounded-3xl border border-white/10 dark:border-white/5 shadow-sm space-y-3 mb-2 select-none">
        <img
          src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
          alt="Darshan Enterprises Logo"
          className="w-14 h-14 object-contain rounded-2xl border border-border/30 shadow-md bg-white dark:bg-zinc-950"
        />
        <div className="space-y-0.5">
          <h2 className="font-black text-lg tracking-tight uppercase" style={{ fontFamily: "Arial Black, sans-serif" }}>
            <span className="text-[#E55A22]">DARSHAN</span>{" "}
            <span className="text-[#09357B] dark:text-blue-400">ENTERPRISES</span>
          </h2>
          <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-widest">Official Management Portal</p>
        </div>
      </div>

      {/* Settings Header */}
      {(() => {
        const hasUnsavedChanges = settings && initialSettings ? JSON.stringify(settings) !== JSON.stringify(initialSettings) : false;
        // Only show Restore Default button AFTER user has saved customized settings in initialSettings!
        const isCustomizedSavedUser = isSettingsCustomized(initialSettings);
        const isInvoiceTheme = workspaceMode === 'invoice';

        return (
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border/60 pb-6">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Workspace Settings</h1>
              <p className="text-muted-foreground text-sm mt-1">Configure company logos, signature authorities, GST credentials, and default quotation terms.</p>
            </div>
            
            <div className="hidden sm:flex items-center gap-2.5">
              {isCustomizedSavedUser && (
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(true)}
                    disabled={saving}
                    className={cn(
                      "flex items-center justify-center p-3 rounded-2xl border cursor-pointer transition-all active:scale-95 shadow-sm",
                      isInvoiceTheme
                        ? "border-violet-500/30 dark:border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400"
                        : "border-[#E55A22]/30 dark:border-orange-500/40 bg-[#E55A22]/10 hover:bg-[#E55A22]/20 text-[#E55A22] dark:text-orange-400"
                    )}
                  >
                    <RotateCcw className="w-4.5 h-4.5" />
                  </button>
                  
                  {/* Custom Floating Tooltip */}
                  <div className="absolute right-0 top-full mt-2 hidden group-hover:flex items-center justify-center pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className={cn(
                      "px-3 py-1.5 rounded-xl text-white text-[11px] font-extrabold shadow-2xl whitespace-nowrap border",
                      isInvoiceTheme
                        ? "bg-zinc-950 dark:bg-zinc-900 border-violet-500/30 text-violet-200"
                        : "bg-zinc-950 dark:bg-zinc-900 border-orange-500/30 text-orange-200"
                    )}>
                      Restore Default Settings
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={!hasUnsavedChanges || saving}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-bold transition-all shadow-lg select-none",
                  hasUnsavedChanges && !saving
                    ? isInvoiceTheme
                      ? "bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-violet-500/20 scale-[1.01] active:scale-[0.99]"
                      : "bg-[#E55A22] hover:bg-[#E55A22]/90 text-white cursor-pointer shadow-orange-500/20 scale-[1.01] active:scale-[0.99]"
                    : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed opacity-60 shadow-none border border-slate-300 dark:border-white/10"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4.5 h-4.5" />
                    <span>{hasUnsavedChanges ? "Save Settings" : "No Changes"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-start gap-3">
          <Sparkles className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
          <span>{success}</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: General Profile Info */}
        <div className="md:col-span-2 space-y-6">

          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 dark:border-white/5 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2 border-b border-border/40 pb-3">
              <Building2 className="w-5 h-5 text-primary" />
              <span>Company Credentials</span>
            </h2>

            {/* Signature Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Signature className="w-3.5 h-3.5" />
                <span>Authorized Signatory Name</span>
              </label>
              <input
                type="text"
                value={settings.signatureName}
                onChange={(e) => handleInputChange("signatureName", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background/50 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 font-medium"
                placeholder="e.g. Mata Prasad Prajapati"
              />
            </div>

            {/* GST Details */}
            {(() => {
              const gstValidation = validateGSTIN(settings.gstNumber || "");
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ReceiptRupee className="w-3.5 h-3.5" />
                        <span>GSTIN Number</span>
                      </label>
                      {settings.gstNumber && settings.gstNumber.trim().length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] font-bold">
                          {gstValidation.isValid ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Valid {gstValidation.stateName ? `(${gstValidation.stateName})` : ""}</span>
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                              <AlertCircle className="w-3 h-3" />
                              <span>{gstValidation.errorMsg || "Invalid Format"}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      maxLength={15}
                      value={settings.gstNumber}
                      onChange={(e) => {
                        const formatted = e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 15);
                        handleInputChange("gstNumber", formatted);
                      }}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border bg-background/50 outline-none transition-all focus:ring-2 font-mono font-medium uppercase",
                        settings.gstNumber && settings.gstNumber.trim().length > 0
                          ? gstValidation.isValid
                            ? "border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/10"
                            : "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/10"
                          : "border-border/60 focus:border-primary focus:ring-primary/10"
                      )}
                      placeholder="e.g. 24BCVPP7836H1ZW"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Standard 15-digit Indian Goods and Services Tax Identification Number.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Registered Bank & Billing Details */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 dark:border-white/5 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2 border-b border-border/40 pb-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <span>Registered Bank & Billing Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bank Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={settings.bankName || ""}
                  onChange={(e) => handleInputChange("bankName", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background/50 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 font-medium"
                  placeholder="e.g. State Bank of India"
                />
              </div>

              {/* Account Number */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Account Number
                </label>
                <input
                  type="text"
                  value={settings.bankAccountNo || ""}
                  onChange={(e) => handleInputChange("bankAccountNo", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background/50 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 font-medium"
                  placeholder="e.g. 42085596249"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* IFSC Code */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={settings.bankIfscCode || ""}
                  onChange={(e) => handleInputChange("bankIfscCode", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background/50 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono font-medium"
                  placeholder="e.g. SBIN0017314"
                />
              </div>

              {/* Invoice Numbering Format */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Invoice Numbering Format
                </label>
                <input
                  type="text"
                  value={settings.invoiceNumberingFormat || ""}
                  onChange={(e) => handleInputChange("invoiceNumberingFormat", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background/50 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono font-medium"
                  placeholder="e.g. DE-{number}"
                />
              </div>
            </div>
          </div>

          {/* Terms and Conditions Editor */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 dark:border-white/5 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2 border-b border-border/40 pb-3">
              <ReceiptRupee className="w-5 h-5 text-primary" />
              <span>Terms & Conditions Builder</span>
            </h2>

            {/* Add Term Box */}
            <div className="flex gap-2 w-full items-center">
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTerm()}
                placeholder="Enter a new term instruction..."
                className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-border/60 bg-background/50 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 font-medium text-sm sm:text-base"
              />
              <button
                onClick={handleAddTerm}
                type="button"
                className="p-3 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white rounded-xl transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Terms List */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {settings.terms.map((term, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between gap-3 p-3 bg-background/40 hover:bg-background/80 rounded-xl border border-border/40 transition-colors group"
                >
                  {editingIndex === index ? (
                    /* Inline Editing Mode */
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveTerm(index)}
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-primary bg-background outline-none font-medium"
                        autoFocus
                      />
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleSaveTerm(index)}
                          type="button"
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Save Term"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingIndex(null);
                            setEditingText("");
                          }}
                          type="button"
                          className="p-1.5 text-muted-foreground hover:bg-muted border border-border/40 rounded-lg transition-colors cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Standard Mode with Edit and Delete options */
                    <>
                      <div className="flex items-start gap-2.5 text-sm font-medium leading-relaxed flex-1 min-w-0">
                        <span className="text-muted-foreground font-bold shrink-0">{index + 1}.</span>
                        <span className="text-foreground break-words">{term}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingIndex(index);
                            setEditingText(term);
                          }}
                          type="button"
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 rounded-lg transition-colors cursor-pointer"
                          title="Edit Term"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTerm(index)}
                          type="button"
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 rounded-lg transition-colors cursor-pointer"
                          title="Delete Term"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {settings.terms.length === 0 && (
                <p className="text-center text-muted-foreground text-xs font-semibold py-4 border border-dashed border-border/60 rounded-2xl">
                  No custom terms defined. Will fall back to system defaults.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: File Asset Uploaders */}
        <div className="space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 dark:border-white/5 space-y-6">
            <h2 className="text-lg font-bold border-b border-border/40 pb-3 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-primary" />
              <span>Quotation Graphic Assets</span>
            </h2>

            {/* Header Upload */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Header Graphic (PNG Logo Banner)
              </label>
              <div className="border border-border/60 bg-background/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                {settings.headerImage ? (
                  <div className="relative w-full aspect-[4/1] bg-white rounded-lg flex items-center justify-center p-1.5 border">
                    <img 
                      src={settings.headerImage} 
                      alt="Header Preview" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-lg">
                      <label className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/30 cursor-pointer font-bold text-xs select-none">
                        Replace Banner
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload("headerImage", e.target.files[0])}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="w-full py-6 flex flex-col items-center justify-center cursor-pointer">
                    {headerUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                    )}
                    <span className="text-xs font-bold text-foreground">Upload Header Logo</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Supports PNG/JPEG</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={headerUploading}
                      onChange={(e) => e.target.files?.[0] && handleImageUpload("headerImage", e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Signature Upload */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Authorized Signature Graphic
              </label>
              <div className="border border-border/60 bg-background/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                {settings.signatureImage ? (
                  <div className="relative w-full aspect-[3/1] bg-white rounded-lg flex items-center justify-center p-2 border">
                    <img 
                      src={settings.signatureImage} 
                      alt="Signature Preview" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-lg">
                      <label className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/30 cursor-pointer font-bold text-xs select-none">
                        Replace Signature
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload("signatureImage", e.target.files[0])}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="w-full py-6 flex flex-col items-center justify-center cursor-pointer">
                    {sigUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                    )}
                    <span className="text-xs font-bold text-foreground">Upload Signature Scribble</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Transparent PNG recommended</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={sigUploading}
                      onChange={(e) => e.target.files?.[0] && handleImageUpload("signatureImage", e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Footer Upload */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Footer Banner Graphic (Optional)
              </label>
              <div className="border border-border/60 bg-background/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                {settings.footerImage ? (
                  <div className="relative w-full aspect-[4/1] bg-white rounded-lg flex items-center justify-center p-1.5 border">
                    <img 
                      src={settings.footerImage} 
                      alt="Footer Preview" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-lg">
                      <label className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/30 cursor-pointer font-bold text-xs select-none">
                        Replace Banner
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload("footerImage", e.target.files[0])}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="w-full py-6 flex flex-col items-center justify-center cursor-pointer">
                    {footerUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                    )}
                    <span className="text-xs font-bold text-foreground">Upload Footer Banner</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Supports PNG/JPEG</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={footerUploading}
                      onChange={(e) => e.target.files?.[0] && handleImageUpload("footerImage", e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>
            
            {/* Pro Tip */}
            <div className="bg-[#09357B]/5 dark:bg-blue-500/5 border border-primary/10 p-3 rounded-2xl flex gap-2 text-xs text-muted-foreground font-medium">
              <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Leave graphic assets blank to fall back to the built-in HTML/CSS vector styling that replicates the original printed quotation styles.</span>
            </div>
          </div>

          {/* Theme & User Profile Settings Section */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/20 dark:border-white/5 space-y-5 md:hidden">
            <h2 className="text-lg font-bold flex items-center gap-2 border-b border-border/40 pb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>App Preferences</span>
            </h2>

            {/* Theme Toggle (Night Mode) */}
            <div className="flex items-center justify-between p-3.5 bg-background/50 border border-border/40 rounded-2xl">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                <div className="text-left">
                  <p className="text-xs font-bold">Dark Theme (Night Mode)</p>
                  <p className="text-[10px] text-muted-foreground">Toggle between dark/light view</p>
                </div>
              </div>
              
              {/* Premium Toggle Switch */}
              <button 
                type="button"
                onClick={(e) => toggleTheme(e)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                  theme === "dark" ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-700"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    theme === "dark" ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Profile Info & Logout (Sign Out) */}
            {user && (
              <div className="hidden sm:block space-y-4 pt-2">
                <div className="flex items-center gap-3.5 p-3.5 bg-background/50 border border-border/40 rounded-2xl">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full border border-primary/20 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-xs font-extrabold leading-tight text-foreground truncate">
                      {user.displayName || "Administrator"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate leading-none mt-1">
                      {user.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("request-app-logout"))}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-destructive/20 hover:bg-destructive/10 text-destructive text-xs font-bold cursor-pointer transition-colors active:scale-98"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Portal</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Mobile Bottom Action Buttons (Rendered below all settings cards on mobile view only!) */}
      {(() => {
        const hasUnsavedChanges = settings && initialSettings ? JSON.stringify(settings) !== JSON.stringify(initialSettings) : false;
        const isCustomizedSavedUser = isSettingsCustomized(initialSettings);
        const isInvoiceTheme = workspaceMode === 'invoice';

        return (
          <div className="sm:hidden pt-6 pb-2 border-t border-border/60 mt-4 mb-16">
            <div className="flex items-center gap-2.5 w-full">
              {isCustomizedSavedUser && (
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(true)}
                    disabled={saving}
                    className={cn(
                      "flex items-center justify-center p-3.5 rounded-2xl border cursor-pointer transition-all active:scale-95 shadow-sm",
                      isInvoiceTheme
                        ? "border-violet-500/30 dark:border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400"
                        : "border-[#E55A22]/30 dark:border-orange-500/40 bg-[#E55A22]/10 hover:bg-[#E55A22]/20 text-[#E55A22] dark:text-orange-400"
                    )}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={!hasUnsavedChanges || saving}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm transition-all shadow-lg select-none",
                  hasUnsavedChanges && !saving
                    ? isInvoiceTheme
                      ? "bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-violet-500/20 scale-[1.01] active:scale-[0.99]"
                      : "bg-[#E55A22] hover:bg-[#E55A22]/90 text-white cursor-pointer shadow-orange-500/20 scale-[1.01] active:scale-[0.99]"
                    : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed opacity-60 shadow-none border border-slate-300 dark:border-white/10"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>{hasUnsavedChanges ? "Save Settings" : "No Changes"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Injected CSS style tag to animate mobile bottom navbar hiding and spring bouncy modal entry */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          body.drawer-open .mobile-bottom-nav-container {
            opacity: 0 !important;
            transform: translateY(115%) !important;
            pointer-events: none !important;
            transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease !important;
          }
          .bouncy-modal-entry {
            animation: bouncyPopMobile 0.45s cubic-bezier(0.34, 1.6, 0.64, 1) forwards;
          }
          .fab-spring-entry {
            animation: fabPopUpMobile 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s both;
          }
        }
        
        @media (min-width: 768px) {
          .bouncy-modal-entry {
            animation: bouncyPopDesktop 0.45s cubic-bezier(0.34, 1.6, 0.64, 1) forwards;
          }
        }

        @keyframes bouncyPopMobile {
          0% {
            opacity: 0;
            transform: translateY(100px) scale(0.9);
          }
          70% {
            opacity: 1;
            transform: translateY(-8px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes bouncyPopDesktop {
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

        @keyframes fabPopUpMobile {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.88);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}} />

      {/* Switch Portal Confirmation Modal */}
      {mounted && showSwitchModal && createPortal(
        <div className="fixed inset-0 z-[9999999] min-h-screen w-screen bg-black/70 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 pb-20 sm:pb-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md border backdrop-blur-2xl p-6 rounded-[28px] text-center shadow-2xl relative select-none bouncy-modal-entry"
            style={{ 
              backgroundColor: theme === 'dark' ? 'rgba(9, 9, 11, 0.95)' : '#ffffff',
              color: theme === 'dark' ? '#ffffff' : '#0f172a',
              borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(226, 232, 240, 1)',
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
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowSwitchModal(false);
                  setWorkspaceMode?.(workspaceMode === 'invoice' ? 'quotation' : 'invoice');
                }}
                className={cn(
                  "w-full py-3 px-5 rounded-2xl text-xs font-extrabold border border-transparent text-white cursor-pointer transition-all active:scale-[0.98]",
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
                className="w-full py-3 px-5 rounded-2xl text-xs font-extrabold cursor-pointer transition-all active:scale-[0.98] border bg-transparent"
                style={{
                  borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(226, 232, 240, 1)',
                  color: theme === 'dark' ? '#a1a1aa' : '#64748b'
                }}
              >
                No, Stay Here
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Restore Defaults Custom Confirmation Modal */}
      {mounted && showRestoreModal && createPortal(
        <div className="fixed inset-0 z-[9999999] min-h-screen w-screen bg-black/70 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md border backdrop-blur-2xl p-6 rounded-[28px] text-center shadow-2xl relative select-none bouncy-modal-entry"
            style={{ 
              backgroundColor: theme === 'dark' ? 'rgba(9, 9, 11, 0.95)' : '#ffffff',
              color: theme === 'dark' ? '#ffffff' : '#0f172a',
              borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(226, 232, 240, 1)',
              boxShadow: workspaceMode === 'invoice'
                ? "0 25px 60px -12px rgba(139, 92, 246, 0.25)"
                : "0 25px 60px -12px rgba(229, 90, 34, 0.25)"
            }}
          >
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border-2 shadow-lg mb-4 mt-1",
              workspaceMode === 'invoice'
                ? "bg-violet-500/10 border-violet-500/30 text-violet-500 shadow-violet-500/10"
                : "bg-[#E55A22]/10 border-orange-500/30 text-[#E55A22] shadow-orange-500/10"
            )}>
              <RotateCcw className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Restore Default Settings?
            </h3>
            
            <p className="mt-2.5 text-xs font-semibold leading-relaxed text-slate-600 dark:text-zinc-400">
              Are you sure you want to restore default workspace settings? This will reset all custom company info, signature authority, logos, bank details, and terms to system defaults.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleConfirmRestoreDefault}
                className={cn(
                  "flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold text-white cursor-pointer transition-all active:scale-[0.98] shadow-lg",
                  workspaceMode === 'invoice'
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-500/25"
                    : "bg-gradient-to-r from-[#E55A22] to-orange-600 hover:from-[#E55A22]/90 hover:to-orange-500 shadow-orange-500/25"
                )}
              >
                Restore Defaults
              </button>
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="flex-1 py-3 px-5 rounded-2xl text-xs font-extrabold cursor-pointer transition-all active:scale-[0.98] border border-slate-300 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Switch Portal Floating Button (Mobile Only, floats perfectly in the CENTER above the bottom navigation bar!) */}
      {setWorkspaceMode && (
        <div className="fixed bottom-24 left-0 right-0 z-40 md:hidden flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => setShowSwitchModal(true)}
            className={cn(
              "pointer-events-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border backdrop-blur-md cursor-pointer transition-all active:scale-95 duration-200 select-none font-bold text-[10px] uppercase tracking-wider whitespace-nowrap shadow-lg fab-spring-entry",
              workspaceMode === 'invoice'
                ? "bg-violet-600/70 dark:bg-violet-600/60 border-violet-500/25 text-white hover:bg-violet-600/80"
                : "bg-[#E55A22]/70 dark:bg-[#E55A22]/60 border-orange-500/25 text-white hover:bg-[#E55A22]/80"
            )}
            style={{
              boxShadow: workspaceMode === 'invoice'
                ? "0 8px 30px rgba(139, 92, 246, 0.2)"
                : "0 8px 30px rgba(229, 90, 34, 0.2)"
            }}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 animate-pulse" />
            <span>Switch Portal</span>
          </button>
        </div>
      )}
    </div>
  );
};
export default AdminSettingsPanel;
