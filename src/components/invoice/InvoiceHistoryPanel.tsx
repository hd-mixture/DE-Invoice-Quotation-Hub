"use client";

import React, { useState } from "react";
import { TaxInvoice } from "../../types";
import { 
  History, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Clock, 
  FileDiff 
} from "lucide-react";
import { formatCurrency } from "../../lib/utils";

export interface InvoiceFieldDiff {
  fieldName: string;
  oldValue: string;
  newValue: string;
}

export interface InvoiceVersion {
  versionId: string;
  versionNumber: number;
  savedAt: string;
  savedBy: string;
  savedByEmail?: string;
  status: "saved" | "draft" | "unsaved";
  changesCount: number;
  changesSummary: string;
  diffs: InvoiceFieldDiff[];
  snapshot: TaxInvoice;
}

// Compute structured differences between two Tax Invoice snapshots
export function computeInvoiceDiffs(oldInv: TaxInvoice, newInv: TaxInvoice): InvoiceFieldDiff[] {
  const diffs: InvoiceFieldDiff[] = [];

  const check = (fieldName: string, oldVal: any, newVal: any) => {
    const sOld = String(oldVal ?? "").trim();
    const sNew = String(newVal ?? "").trim();
    if (sOld !== sNew) {
      diffs.push({
        fieldName,
        oldValue: sOld || "(Empty)",
        newValue: sNew || "(Empty)",
      });
    }
  };

  check("Bill Date", oldInv.billDate, newInv.billDate);
  check("Bill Number", oldInv.billNumber, newInv.billNumber);
  check("PO Number", oldInv.poNumber, newInv.poNumber);
  check("PO Date", oldInv.poDate, newInv.poDate);

  // Consignee details
  check("Consignee Company", oldInv.consigneeDetails?.companyName, newInv.consigneeDetails?.companyName);
  check("Consignee Address", oldInv.consigneeDetails?.address, newInv.consigneeDetails?.address);
  check("Consignee GSTIN", oldInv.consigneeDetails?.gstin, newInv.consigneeDetails?.gstin);

  // Billed To details
  check("Billed To Client", oldInv.billedTo?.clientName, newInv.billedTo?.clientName);
  check("Billed To Address", oldInv.billedTo?.clientAddress, newInv.billedTo?.clientAddress);
  check("Billed To GSTIN", oldInv.billedTo?.clientGstin, newInv.billedTo?.clientGstin);

  check("Job Description", oldInv.jobDescription, newInv.jobDescription);
  check("GST Enabled", oldInv.gstEnabled !== false ? "Enabled" : "Disabled", newInv.gstEnabled !== false ? "Enabled" : "Disabled");
  check("Letterhead Mode", oldInv.letterheadMode ? "Enabled" : "Disabled", newInv.letterheadMode ? "Enabled" : "Disabled");

  // Items diffing
  const oldItems = oldInv.items || [];
  const newItems = newInv.items || [];
  if (oldItems.length !== newItems.length) {
    diffs.push({
      fieldName: "Total Line Items",
      oldValue: `${oldItems.length} items`,
      newValue: `${newItems.length} items`,
    });
  }

  const maxItems = Math.max(oldItems.length, newItems.length);
  for (let i = 0; i < maxItems; i++) {
    const oItem = oldItems[i];
    const nItem = newItems[i];
    if (!oItem && nItem) {
      diffs.push({
        fieldName: `Item #${i + 1} Added`,
        oldValue: "(None)",
        newValue: `${nItem.description || "New Item"} (${nItem.qty} ${nItem.unit} @ ₹${nItem.rate})`,
      });
    } else if (oItem && !nItem) {
      diffs.push({
        fieldName: `Item #${i + 1} Removed`,
        oldValue: `${oItem.description || "Item"} (${oItem.qty} ${oItem.unit} @ ₹${oItem.rate})`,
        newValue: "(Removed)",
      });
    } else if (oItem && nItem) {
      check(`Item #${i + 1} Description`, oItem.description, nItem.description);
      check(`Item #${i + 1} HSN/SAC`, oItem.hsnSac, nItem.hsnSac);
      check(`Item #${i + 1} Quantity`, `${oItem.qty} ${oItem.unit}`, `${nItem.qty} ${nItem.unit}`);
      check(`Item #${i + 1} Rate`, formatCurrency(oItem.rate), formatCurrency(nItem.rate));
    }
  }

  check("Grand Total", formatCurrency(oldInv.grandTotal || 0), formatCurrency(newInv.grandTotal || 0));

  return diffs;
}

interface InvoiceHistoryPanelProps {
  versions: InvoiceVersion[];
  currentPreview: TaxInvoice;
  onRestoreVersion: (version: InvoiceVersion) => void;
  isSaving?: boolean;
  currentUserDisplayName?: string;
}

export const InvoiceHistoryPanel: React.FC<InvoiceHistoryPanelProps> = ({
  versions,
  currentPreview,
  onRestoreVersion,
  isSaving = false,
  currentUserDisplayName = "HD_Mixture"
}) => {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [selectedPreviewVersion, setSelectedPreviewVersion] = useState<InvoiceVersion | null>(null);
  const [activeLoadedVersionId, setActiveLoadedVersionId] = useState<string | null>(versions[0]?.versionId || null);
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false);

  const latestSavedVersion = versions.length > 0 ? versions[0] : null;
  const activePreviewVersion = selectedPreviewVersion || latestSavedVersion;

  const pendingDiffs = latestSavedVersion 
    ? computeInvoiceDiffs(latestSavedVersion.snapshot, currentPreview)
    : [];

  const hasUnsavedChanges = pendingDiffs.length > 0;

  const toggleExpand = (verId: string) => {
    setExpandedVersionId(prev => prev === verId ? null : verId);
  };

  const handleSelectPreview = (ver: InvoiceVersion) => {
    setSelectedPreviewVersion(ver);
  };

  const handleTriggerRestore = (ver: InvoiceVersion) => {
    onRestoreVersion(ver);
    setActiveLoadedVersionId(ver.versionId);
  };

  return (
    <div className="space-y-4 select-none">
      {/* HISTORY PANEL CARD */}
      <div className="bg-white dark:bg-zinc-900/90 rounded-[28px] border border-slate-200/80 dark:border-white/10 p-5 shadow-sm space-y-4 backdrop-blur-xl">
        
        {/* Header with Auto-Synced Badge */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-500/20 shrink-0">
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">
                Invoice History
              </h2>
              <p className="text-[9.5px] sm:text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate">
                {versions.length} immutable {versions.length === 1 ? "version" : "versions"} logged
              </p>
            </div>
          </div>

          <span className="text-[9.5px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Auto-Synced</span>
          </span>
        </div>

        {/* Timeline Container */}
        <div className="max-h-[380px] overflow-y-auto pr-3.5 sm:pr-2 space-y-3 custom-scrollbar">
          
          {/* 1. Unsaved Pending Entry */}
          {hasUnsavedChanges && (
            <div className="relative pl-6 pb-2 group">
              <div className="absolute left-[9px] top-4 bottom-0 w-[2px] bg-gradient-to-b from-violet-400 to-slate-200 dark:to-zinc-800" />
              <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-500/30 ring-4 ring-violet-100 dark:ring-violet-950/50 animate-pulse">
                <Clock className="w-2.5 h-2.5" />
              </div>

              <div className="bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/30 rounded-2xl p-3 space-y-2 transition-all shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[11px] font-extrabold text-violet-600 dark:text-violet-400 whitespace-nowrap block">
                      {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })},{" "}
                      {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    </span>
                    <p className="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold truncate">
                      Edited by <span className="font-extrabold text-slate-800 dark:text-zinc-200">{currentUserDisplayName}</span>
                    </p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-600 text-white font-extrabold uppercase tracking-wider shadow-sm shrink-0 whitespace-nowrap mt-0.5">
                    Unsaved Draft
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="font-bold text-violet-700 dark:text-violet-300">
                    You have made {pendingDiffs.length} {pendingDiffs.length === 1 ? "change" : "changes"}
                  </span>
                  <button
                    onClick={() => toggleExpand("unsaved_current")}
                    className="text-violet-600 dark:text-violet-400 hover:underline font-extrabold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View Changes</span>
                    {expandedVersionId === "unsaved_current" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Expanded Pending Diffs */}
                {expandedVersionId === "unsaved_current" && (
                  <div className="pt-2 border-t border-violet-500/20 space-y-1.5 animate-in fade-in duration-200">
                    {pendingDiffs.map((diff, idx) => (
                      <div key={idx} className="text-[10px] bg-white/80 dark:bg-zinc-900/80 p-2 rounded-xl border border-violet-200 dark:border-violet-950 flex flex-col gap-0.5">
                        <span className="font-extrabold text-slate-800 dark:text-zinc-200">{diff.fieldName}:</span>
                        <div className="flex items-center gap-1 font-mono text-[9.5px]">
                          <span className="line-through text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">{diff.oldValue}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded font-bold">{diff.newValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. Historical Saved Versions */}
          {versions.map((ver, idx) => {
            const isLatest = idx === 0 && !hasUnsavedChanges;
            const isExpanded = expandedVersionId === ver.versionId;
            const isSelected = activePreviewVersion?.versionId === ver.versionId;

            return (
              <div key={ver.versionId} className="relative pl-6 pb-2 group">
                {idx < versions.length - 1 && (
                  <div className="absolute left-[9px] top-4 bottom-0 w-[2px] bg-slate-200 dark:bg-zinc-800" />
                )}
                <div className={`absolute left-[2px] top-2 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                  isLatest 
                    ? "bg-violet-600 border-violet-200 dark:border-violet-900 shadow-sm" 
                    : "bg-slate-400 dark:bg-zinc-600 border-white dark:border-zinc-900"
                }`} />

                <div className={`p-3 rounded-2xl border transition-all space-y-1.5 ${
                  isSelected
                    ? "bg-violet-500/10 border-violet-500/40 shadow-sm"
                    : isLatest
                    ? "bg-slate-50/80 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700"
                    : "bg-white dark:bg-zinc-900/60 border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-zinc-700"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">
                          {ver.savedAt}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300">
                          v{ver.versionNumber}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                        Edited by <span className="font-extrabold text-slate-700 dark:text-zinc-300">{ver.savedBy}</span>
                      </p>
                    </div>
                    <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Saved
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] pt-0.5">
                    <span className="text-slate-600 dark:text-zinc-400 font-medium">
                      {ver.changesSummary || `You have made ${ver.changesCount} ${ver.changesCount === 1 ? "change" : "changes"}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          handleSelectPreview(ver);
                          toggleExpand(ver.versionId);
                        }}
                        className="text-violet-600 dark:text-violet-400 hover:underline font-extrabold flex items-center gap-0.5 cursor-pointer text-[10.5px]"
                      >
                        <span>View Changes</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Diffs List */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1.5 animate-in fade-in duration-200">
                      {ver.diffs.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">Invoice baseline created in this version.</p>
                      ) : (
                        ver.diffs.map((diff, dIdx) => (
                          <div key={dIdx} className="text-[10px] bg-slate-50 dark:bg-zinc-800/80 p-2 rounded-xl border border-slate-200/60 dark:border-white/5 flex flex-col gap-0.5">
                            <span className="font-extrabold text-slate-800 dark:text-zinc-200">{diff.fieldName}:</span>
                            <div className="flex items-center gap-1 font-mono text-[9.5px]">
                              <span className="line-through text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">{diff.oldValue}</span>
                              <span className="text-slate-400">→</span>
                              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded font-bold">{diff.newValue}</span>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Restore / Active Button */}
                      {activeLoadedVersionId === ver.versionId && !hasUnsavedChanges ? (
                        <button
                          disabled
                          className="mt-2 w-full py-1.5 px-3 rounded-xl bg-slate-200/80 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-extrabold text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Active Loaded Version</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTriggerRestore(ver)}
                          className="mt-2 w-full py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-[10.5px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore Version v{ver.versionNumber}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {versions.length === 0 && !hasUnsavedChanges && (
            <div className="text-center py-6 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">No saved versions yet.</p>
            </div>
          )}
        </div>

        {/* View All History Link */}
        {versions.length > 0 && (
          <div className="pt-2 text-center border-t border-slate-100 dark:border-white/5">
            <button
              onClick={() => setShowAllHistoryModal(true)}
              className="text-xs font-extrabold text-violet-600 dark:text-violet-400 hover:underline flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <FileDiff className="w-3.5 h-3.5" />
              <span>View Full Version Log</span>
            </button>
          </div>
        )}
      </div>

      {/* CHANGE PREVIEW CARD */}
      <div className="bg-white dark:bg-zinc-900/90 rounded-[28px] border border-slate-200/80 dark:border-white/10 p-5 shadow-sm space-y-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2.5">
          <FileDiff className="w-4 h-4 text-violet-500" />
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Change Preview
          </h3>
        </div>

        {/* Version Selector Tabs (Version 1, Version 2, Version 3...) */}
        {versions.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {versions.map((ver) => {
              const isSelected = activePreviewVersion?.versionId === ver.versionId;
              const isLatest = versions[0].versionId === ver.versionId;
              const isActiveLoaded = activeLoadedVersionId === ver.versionId && !hasUnsavedChanges;

              return (
                <button
                  key={ver.versionId}
                  type="button"
                  onClick={() => setSelectedPreviewVersion(ver)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-violet-600 text-white border-violet-600/30 shadow-md shadow-violet-500/20 scale-[1.02]"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200/60 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  <span>Version {ver.versionNumber}</span>
                  
                  {isActiveLoaded && (
                    <span 
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected 
                          ? "bg-white ring-2 ring-white/30 shadow-sm" 
                          : "bg-emerald-500 ring-2 ring-emerald-500/20 shadow-sm shadow-emerald-500/40"
                      }`} 
                      title="Active loaded version"
                    />
                  )}

                  {isLatest && !isActiveLoaded && (
                    <span 
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected 
                          ? "bg-white/80 ring-2 ring-white/30" 
                          : "bg-violet-500 ring-2 ring-violet-500/20 shadow-sm shadow-violet-500/40"
                      }`} 
                      title="Latest version"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Version Details */}
        {activePreviewVersion ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800/80 p-3 rounded-2xl border border-slate-200/60 dark:border-white/5">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                    Version {activePreviewVersion.versionNumber}
                  </span>
                  {activeLoadedVersionId === activePreviewVersion.versionId && !hasUnsavedChanges && (
                    <span className="text-[9.5px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                  {activePreviewVersion.savedAt} • {activePreviewVersion.savedBy}
                </p>
              </div>

              {/* Restore Button or Disabled Active Indicator */}
              {activeLoadedVersionId === activePreviewVersion.versionId && !hasUnsavedChanges ? (
                <button
                  disabled
                  className="px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[10.5px] font-extrabold cursor-not-allowed flex items-center gap-1 border border-slate-300/50 dark:border-zinc-700/50 opacity-80"
                  title="This version is currently active in the editor"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Active Version</span>
                </button>
              ) : (
                <button
                  onClick={() => handleTriggerRestore(activePreviewVersion)}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-[10.5px] cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-violet-500/20"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restore</span>
                </button>
              )}
            </div>

            {activePreviewVersion.diffs.length === 0 ? (
              <p className="text-slate-500 dark:text-zinc-400 text-[11px] italic py-3 text-center bg-slate-50/50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700">
                Initial baseline tax invoice created in this version.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-3.5 sm:pr-2 custom-scrollbar">
                {activePreviewVersion.diffs.map((diff, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-800/50 border border-slate-200/40 dark:border-white/5 text-[10.5px] space-y-0.5">
                    <span className="font-extrabold text-slate-800 dark:text-zinc-200 block">{diff.fieldName}</span>
                    <div className="flex items-center justify-between gap-1 text-[9.5px]">
                      <span className="text-red-500 font-mono line-through bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">{diff.oldValue}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">{diff.newValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 space-y-1">
            <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">Select a history item to view changes</p>
            <p className="text-[10.5px] text-slate-400 dark:text-zinc-500">You will see what was added, removed or updated in that version.</p>
          </div>
        )}
      </div>

      {/* FULL VERSION LOG MODAL */}
      {showAllHistoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-slate-200 dark:border-white/10 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-violet-500" />
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Full Tax Invoice Version Audit Log</h2>
              </div>
              <button 
                onClick={() => setShowAllHistoryModal(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-extrabold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              {versions.map((ver) => (
                <div key={ver.versionId} className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-200/70 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900 dark:text-white">Version v{ver.versionNumber}</span>
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{ver.savedAt}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300">Edited by <span className="font-bold">{ver.savedBy}</span> ({ver.savedByEmail || "authenticated user"})</p>
                  
                  {ver.diffs.length > 0 && (
                    <div className="pt-2 grid grid-cols-1 gap-1">
                      {ver.diffs.map((d, i) => (
                        <div key={i} className="text-[11px] flex items-center justify-between bg-white dark:bg-zinc-900 p-2 rounded-xl border border-slate-200/50 dark:border-white/5">
                          <span className="font-extrabold text-slate-800 dark:text-zinc-200">{d.fieldName}</span>
                          <span className="font-mono text-[10px] text-slate-600 dark:text-zinc-400">{d.oldValue} → <span className="text-emerald-600 dark:text-emerald-400 font-bold">{d.newValue}</span></span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => {
                        handleTriggerRestore(ver);
                        setShowAllHistoryModal(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-violet-600 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-violet-700"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restore This State
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
