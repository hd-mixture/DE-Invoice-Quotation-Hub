"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, User, Send, CheckCircle2, FileText, Plus, Trash2, ArrowRight, Calendar, Building2, Lock, Sparkles, MapPin, Map, UserSquare2, FileSignature, LayoutList, Receipt, ScrollText, Image as ImageIcon, ChevronDown, LogOut, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { DEFAULT_SETTINGS, getAdminSettings } from "../../firebase/db";
import { AdminSettings } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { validateGSTIN, formatGSTINInput, isNaOrEmptyGSTIN } from "../../utils/gstValidation";
import { ReceiptRupee } from "../common/ReceiptRupee";

interface AIChatInterfaceProps {
  docType: "quotation" | "invoice";
  onFinish: (data: any) => void;
  onCancel: () => void;
  isDirectRedirection?: boolean;
}

interface Message {
  id: string;
  sender: "ai" | "user";
  type: "text" | "text_input" | "item_widget" | "date_widget" | "terms_widget" | "gst_widget" | "letterhead_widget" | "final_actions" | "generating" | "preview" | "gstin_widget";
  content: string;
}

const QUOTATION_STEPS = [
  { id: 0, title: "Date", desc: "Select quotation date", icon: Calendar },
  { id: 1, title: "Client / Company", desc: "Enter client or company name", icon: Building2 },
  { id: 2, title: "Address", desc: "Enter complete address", icon: MapPin },
  { id: 3, title: "District / State / Pincode", desc: "Enter location details", icon: Map },
  { id: 4, title: "Kind Attention", desc: "Who should we address?", icon: UserSquare2 },
  { id: 5, title: "Subject", desc: "Quotation subject or title", icon: FileSignature },
  { id: 6, title: "Line Items", desc: "Add your products or services", icon: LayoutList },
  { id: 7, title: "GST", desc: "Applicable GST?", icon: Receipt },
  { id: 8, title: "Terms & Conditions", desc: "Add your terms", icon: ScrollText },
  { id: 9, title: "Company Letterhead", desc: "Include letterhead?", icon: ImageIcon }
];

const INVOICE_STEPS = [
  { id: 0, title: "Bill No", desc: "Enter Invoice/Bill No", icon: FileText },
  { id: 1, title: "Date", desc: "Select bill date", icon: Calendar },
  { id: 2, title: "PO No", desc: "Enter Purchase Order No", icon: FileSignature },
  { id: 3, title: "PO Date", desc: "Select PO date", icon: Calendar },
  { id: 4, title: "Client / Company", desc: "Enter client or company name", icon: Building2 },
  { id: 5, title: "Address", desc: "Enter complete address", icon: MapPin },
  { id: 6, title: "GSTIN", desc: "Enter GSTIN", icon: Receipt },
  { id: 7, title: "Job Title", desc: "Title of job or service", icon: FileSignature },
  { id: 8, title: "Line Items", desc: "Add invoice items", icon: LayoutList },
  { id: 9, title: "GST", desc: "Applicable GST?", icon: Receipt },
  { id: 10, title: "Terms & Conditions", desc: "Add your terms", icon: ScrollText },
  { id: 11, title: "Company Letterhead", desc: "Include letterhead?", icon: ImageIcon }
];

export default function AIChatInterface({ docType, onFinish, onCancel, isDirectRedirection = false }: AIChatInterfaceProps) {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState(0);
  const [gatheredData, setGatheredData] = useState<any>({ items: [] });
  const [showLottieOverlay, setShowLottieOverlay] = useState(false);
  const [userSettings, setUserSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousLength = useRef(0);

  useEffect(() => {
    async function loadSettings() {
      if (user?.uid) {
        try {
          const s = await getAdminSettings(user.uid);
          setUserSettings(s);
        } catch (err) {
          console.error("Failed to load user settings in AI Chat:", err);
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

  const rawSteps = docType === "quotation" ? QUOTATION_STEPS : INVOICE_STEPS;
  const stepsList = rawSteps.filter(s => isDirectRedirection ? s.title !== "Company Letterhead" : true);
  const progressPercent = Math.round(((step + 1) / stepsList.length) * 100);

  // SMART AUTO-SCROLL
  useEffect(() => {
    if (messages.length > previousLength.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
    }
    previousLength.current = messages.length;
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    setStep(0);
    setGatheredData({ items: [] });
    
    const greeting = docType === "quotation" 
      ? "Hello! 👋\nI'll help you create a professional quotation.\nLet's start with the quotation date." 
      : "Hello! 👋\nI'll help you generate a Tax Invoice.\nLet's start with the Invoice/Bill Number.";
    
    setMessages([
      { id: Date.now().toString() + "a", sender: "ai", type: "text", content: greeting },
      { id: Date.now().toString() + "b", sender: "ai", type: docType === "quotation" ? "date_widget" : "text_input", content: docType === "quotation" ? "What is the quotation date?" : "What is the Invoice/Bill Number?" }
    ]);
  }, [docType]);

  const handleNextStepWithData = (userInput: string, externalData?: any) => {
    const currentStep = step;
    
    if (userInput.trim()) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: userInput }]);
    }

    setStep(prev => prev + 1);

    setTimeout(() => {
      let nextAiMsg = "";
      let msgType: Message["type"] = "text_input";
      const newData = { ...gatheredData, ...externalData };

      if (docType === "quotation") {
        switch (currentStep) {
          case 0:
            newData.date = externalData?.date || new Date().toISOString().split("T")[0];
            nextAiMsg = "Great! Now, please provide the client or company name.";
            break;
          case 1:
            newData.companyName = userInput;
            nextAiMsg = `Perfect. What is the address for ${userInput}? (Use Shift+Enter for multiple lines)`;
            break;
          case 2:
            newData.address = userInput;
            nextAiMsg = "Got it. And the District / State / Pincode?";
            break;
          case 3:
            newData.districtState = userInput;
            nextAiMsg = "Who should we address this to? (Kind Attention)";
            break;
          case 4:
            newData.kindAttention = userInput;
            nextAiMsg = "What is the subject or title of this quotation?";
            break;
          case 5:
            newData.subject = userInput;
            nextAiMsg = "Excellent. Now let's add the line items for your quotation.";
            msgType = "item_widget";
            break;
          case 6:
            nextAiMsg = "Should this include 18% GST?";
            msgType = "gst_widget";
            break;
          case 7:
            newData.gstEnabled = externalData?.value ?? true;
            nextAiMsg = "Review and edit the Terms & Conditions below.";
            msgType = "terms_widget";
            break;
          case 8:
            if (isDirectRedirection) {
              newData.letterheadMode = true;
              nextAiMsg = "All done! Generating your quotation & opening workplace...";
              msgType = "generating";
              setShowLottieOverlay(true);
              setTimeout(() => {
                setShowLottieOverlay(false);
                onFinish(newData);
              }, 1500);
            } else {
              nextAiMsg = "Should this be printed on your Company Letterhead?";
              msgType = "letterhead_widget";
            }
            break;
          case 9:
            newData.letterheadMode = externalData?.value ?? true;
            nextAiMsg = "All done! Generating your quotation preview...";
            msgType = "generating";
            setShowLottieOverlay(true);
            setTimeout(() => {
              setShowLottieOverlay(false);
              onFinish(newData);
            }, 2000);
            break;
        }
      } else {
        // Invoice Flow
        switch (currentStep) {
          case 0:
            newData.billNumber = userInput;
            nextAiMsg = "Got it. What is the Invoice/Bill Date?";
            msgType = "date_widget";
            break;
          case 1:
            newData.billDate = externalData?.date || new Date().toISOString().split("T")[0];
            nextAiMsg = "Thanks. What is the PO (Purchase Order) Number? (Type 'None' if NA)";
            break;
          case 2:
            newData.buyerOrderNo = userInput;
            nextAiMsg = "And what is the PO Date?";
            msgType = "date_widget";
            break;
          case 3:
            newData.buyerOrderDate = externalData?.date || new Date().toISOString().split("T")[0];
            nextAiMsg = "Great! What is the name of the Client/Company (Billed To)?";
            break;
          case 4:
            newData.companyName = userInput;
            nextAiMsg = `Okay, billing to ${userInput}. What is their address? (Use Shift+Enter for multiple lines)`;
            break;
          case 5:
            newData.address = userInput;
            nextAiMsg = "Got it. What is their GSTIN? (Type 'None' if NA)";
            msgType = "gstin_widget";
            break;
          case 6:
            newData.gstin = userInput;
            if (isNaOrEmptyGSTIN(userInput)) {
              newData.gstEnabled = false;
            }
            const compName = (newData.companyName && newData.companyName.trim() && !isNaOrEmptyGSTIN(newData.companyName))
              ? newData.companyName.trim()
              : "the client";
            nextAiMsg = `Thanks. What is the job title of ${compName}?`;
            break;
          case 7:
            newData.jobDescription = userInput;
            nextAiMsg = "Please add the invoice line items below.";
            msgType = "item_widget";
            break;
          case 8:
            if (isNaOrEmptyGSTIN(newData.gstin)) {
              // Directly ask Terms & Conditions (Skip GST Widget)
              newData.gstEnabled = false;
              nextAiMsg = "Review and edit the Terms & Conditions below.";
              msgType = "terms_widget";
            } else {
              const compName = (newData.companyName && newData.companyName.trim() && !isNaOrEmptyGSTIN(newData.companyName))
                ? newData.companyName.trim()
                : "the client";
              nextAiMsg = `GST is verified for ${compName}. Please select the applicable GST Tax type:`;
              msgType = "gst_widget";
            }
            break;
          case 9:
            if (isNaOrEmptyGSTIN(newData.gstin)) {
              // Terms confirmed for NA GSTIN
              if (isDirectRedirection) {
                newData.letterheadMode = true;
                newData.consigneeDetails = {
                  clientName: newData.companyName,
                  clientAddress: newData.address,
                  clientGstin: newData.gstin
                };
                nextAiMsg = "All done! Generating your tax invoice & opening workplace...";
                msgType = "generating";
                setShowLottieOverlay(true);
                setTimeout(() => {
                  setShowLottieOverlay(false);
                  onFinish(newData);
                }, 1500);
              } else {
                nextAiMsg = "Should this be printed on your Company Letterhead?";
                msgType = "letterhead_widget";
              }
            } else {
              // GST widget submitted for verified 15-char GSTIN -> Store GST Tax type
              if (externalData?.isIgstMode !== undefined) {
                newData.isIgstMode = externalData.isIgstMode;
                newData.igstRate = externalData.igstRate || (externalData.isIgstMode ? 18 : 0);
                newData.gstEnabled = true;
              } else if (externalData?.value !== undefined) {
                newData.gstEnabled = externalData.value;
              }
              nextAiMsg = "Review and edit the Terms & Conditions below.";
              msgType = "terms_widget";
            }
            break;
          case 10:
            // Terms confirmed for 15-char GSTIN
            if (isDirectRedirection) {
              newData.letterheadMode = true;
              newData.consigneeDetails = {
                clientName: newData.companyName,
                clientAddress: newData.address,
                clientGstin: newData.gstin
              };
              nextAiMsg = "All done! Generating your tax invoice & opening workplace...";
              msgType = "generating";
              setShowLottieOverlay(true);
              setTimeout(() => {
                setShowLottieOverlay(false);
                onFinish(newData);
              }, 1500);
            } else {
              nextAiMsg = "Should this be printed on your Company Letterhead?";
              msgType = "letterhead_widget";
            }
            break;
          case 11:
            // Letterhead confirmed in Home AI Studio tab!
            newData.letterheadMode = externalData?.value ?? true;
            newData.consigneeDetails = {
              clientName: newData.companyName,
              clientAddress: newData.address,
              clientGstin: newData.gstin
            };
            nextAiMsg = "All done! Generating your tax invoice preview...";
            msgType = "generating";
            setShowLottieOverlay(true);
            setTimeout(() => {
              setShowLottieOverlay(false);
              onFinish(newData);
            }, 2000);
            break;
        }
      }

      setGatheredData(newData);
      if (nextAiMsg) {
        setMessages(prev => [...prev, { id: Date.now().toString() + "ai", sender: "ai", type: msgType, content: nextAiMsg }]);
      }
    }, 500);
  };

  const TextInputWidget = ({ placeholder = "Type here..." }: { placeholder?: string }) => {
    const [val, setVal] = useState("");
    
    return (
      <div className={cn("bg-white dark:bg-zinc-900 border rounded-[20px] p-1.5 pl-3 shadow-sm w-full max-w-sm mt-1.5 flex items-center gap-2 relative", docType === "quotation" ? "border-orange-100 dark:border-orange-500/20" : "border-violet-100 dark:border-violet-500/20")}>
        <Building2 className={cn("w-4 h-4 shrink-0 self-end mb-1.5", docType === "quotation" ? "text-orange-400" : "text-violet-400")} />
        <textarea 
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={placeholder}
          rows={val.split('\n').length > 1 ? Math.min(val.split('\n').length, 4) : 1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && val.trim()) {
              e.preventDefault();
              handleNextStepWithData(val);
            }
          }}
          className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-zinc-100 text-xs py-1.5 placeholder:text-slate-400 resize-none overflow-hidden"
          style={{ minHeight: "24px" }}
        />
        <button 
          onClick={() => {
            if (val.trim()) handleNextStepWithData(val);
          }}
          disabled={!val.trim()}
          className={cn("w-8 h-8 shrink-0 flex items-center justify-center rounded-xl disabled:bg-slate-200 dark:disabled:bg-zinc-800 text-white transition-colors self-end", docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600")}
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const DateWidget = () => {
    const [dateVal, setDateVal] = useState(new Date().toISOString().split("T")[0]);

    const submitDate = (val: string) => {
      // Format visually for the user bubble
      const d = new Date(val);
      const display = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      setGatheredData((prev: any) => ({ ...prev, date: val }));
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: display }]);
      handleNextStepWithData("", { date: val });
    };

    return (
      <div className={cn("bg-white dark:bg-zinc-900 border rounded-[20px] p-1.5 pl-3 shadow-sm w-full max-w-[280px] mt-1.5 flex items-center gap-3", docType === "quotation" ? "border-orange-100 dark:border-orange-500/20" : "border-violet-100 dark:border-violet-500/20")}>
        <Calendar className={cn("w-4 h-4 shrink-0", docType === "quotation" ? "text-orange-400" : "text-violet-400")} />
        <input 
          autoFocus
          type="date"
          value={dateVal}
          onChange={e => setDateVal(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-zinc-100 text-[13px] font-bold tracking-wide [color-scheme:light] dark:[color-scheme:dark] w-full"
        />
        <div className="flex gap-1 shrink-0">
          <button onClick={() => submitDate(new Date().toISOString().split("T")[0])} className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors">
            Today
          </button>
          <button onClick={() => submitDate(dateVal)} className={cn("w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors", docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600")}>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const TermsWidget = () => {
    const [terms, setTerms] = useState<string>((userSettings?.terms || DEFAULT_SETTINGS.terms).join("\n"));

    const handleConfirmTerms = () => {
      const termsArray = terms.split("\n").filter(t => t.trim().length > 0);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: "Terms confirmed" }]);
      handleNextStepWithData("", { customTerms: termsArray });
    };

    return (
      <div className={cn("bg-white dark:bg-zinc-900 border rounded-2xl p-3 shadow-sm w-full max-w-sm mt-1.5", docType === "quotation" ? "border-orange-100 dark:border-orange-500/20" : "border-violet-100 dark:border-violet-500/20")}>
        <textarea 
          autoFocus
          value={terms}
          onChange={e => setTerms(e.target.value)}
          rows={5}
          className={cn("w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 text-xs focus:outline-none focus:ring-1 mb-3 text-slate-700 dark:text-zinc-300", docType === "quotation" ? "focus:border-orange-300 focus:ring-orange-300" : "focus:border-violet-300 focus:ring-violet-300")}
        />
        <button onClick={handleConfirmTerms} className={cn("w-full py-2.5 text-[11px] font-bold rounded-xl text-white transition-colors flex items-center justify-center gap-1.5", docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600")}>
          Confirm Terms <CheckCircle2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const GstinWidget = () => {
    const [val, setVal] = useState("");
    const [gstValidation, setGstValidation] = useState<any>(null);

    const handleChange = (raw: string) => {
      if (raw.toLowerCase() === "none" || raw.toLowerCase() === "na") {
        setVal(raw);
        setGstValidation(null);
        return;
      }
      const formatted = formatGSTINInput(raw);
      setVal(formatted);
      setGstValidation(validateGSTIN(formatted));
    };

    const handleSubmit = () => {
      const finalVal = val.trim();
      if (!finalVal) return;
      if (finalVal.toLowerCase() !== "none" && finalVal.toLowerCase() !== "na" && gstValidation && !gstValidation.isValid) {
         return; // Block submission of invalid GSTIN
      }
      handleNextStepWithData(finalVal);
    };
    
    return (
      <div className="flex flex-col gap-1.5 w-full max-w-sm mt-1.5">
        <div className={cn("bg-white dark:bg-zinc-900 border rounded-[20px] p-1.5 pl-3 shadow-sm flex items-center gap-2 relative", docType === "quotation" ? "border-orange-100 dark:border-orange-500/20" : "border-violet-100 dark:border-violet-500/20")}>
          <ReceiptRupee className={cn("w-4 h-4 shrink-0", docType === "quotation" ? "text-orange-400" : "text-violet-400")} />
          <input 
            autoFocus
            value={val}
            onChange={e => handleChange(e.target.value)}
            placeholder="e.g. 24BCVPP7836H1ZW or 'None'"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && val.trim() && (val.toLowerCase() === "none" || val.toLowerCase() === "na" || gstValidation?.isValid)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-zinc-100 text-xs py-1.5 placeholder:text-slate-400 uppercase"
          />
          <button 
            onClick={handleSubmit}
            disabled={!val.trim() || (val.toLowerCase() !== "none" && val.toLowerCase() !== "na" && (!gstValidation || !gstValidation.isValid))}
            className={cn("w-8 h-8 shrink-0 flex items-center justify-center rounded-xl disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:opacity-50 text-white transition-colors", docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600")}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        {gstValidation && val.toLowerCase() !== "none" && val.toLowerCase() !== "na" && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider self-start ${
            gstValidation.isValid 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
              : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
          }`}>
            {gstValidation.isValid ? (
              <>
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Verified • {gstValidation.stateName}</span>
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 shrink-0" />
                <span>Invalid: {gstValidation.errorMsg}</span>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const GstWidget = () => {
    const isValidVerifiedGstin = docType === "invoice" && !isNaOrEmptyGSTIN(gatheredData.gstin);

    if (isValidVerifiedGstin) {
      return (
        <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-2 shadow-sm w-full max-w-sm mt-1.5 flex flex-col gap-2 border-violet-100 dark:border-violet-500/20">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 px-1">
            <ReceiptRupee className="w-3.5 h-3.5 text-violet-500 shrink-0" />
            <span>Select GST Tax Mode:</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: "CGST + SGST (9% + 9%)" }]);
              handleNextStepWithData("", { isIgstMode: false, igstRate: 0, gstEnabled: true });
            }} className="flex-1 py-2.5 px-2 text-[10px] font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-colors text-center leading-tight cursor-pointer shadow-xs">
              CGST + SGST (9% + 9%)
            </button>
            <button onClick={() => {
              setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: "IGST (18%)" }]);
              handleNextStepWithData("", { isIgstMode: true, igstRate: 18, gstEnabled: true });
            }} className="flex-1 py-2.5 px-2 text-[10px] font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors text-center leading-tight cursor-pointer shadow-xs">
              IGST (18%)
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("bg-white dark:bg-zinc-900 border rounded-2xl p-1.5 shadow-sm w-full max-w-[280px] mt-1.5 flex gap-1.5", docType === "quotation" ? "border-orange-100 dark:border-orange-500/20" : "border-violet-100 dark:border-violet-500/20")}>
        <button onClick={() => {
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: "Yes, include 18% GST" }]);
          handleNextStepWithData("", { value: true });
        }} className={cn("flex-1 py-2 px-2 text-[10px] font-bold rounded-xl text-white transition-colors text-center leading-tight cursor-pointer", docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600")}>
          Yes, 18% GST
        </button>
        <button onClick={() => {
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: "No GST" }]);
          handleNextStepWithData("", { value: false });
        }} className="flex-1 py-2 px-2 text-[10px] font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors text-center leading-tight cursor-pointer">
          No GST
        </button>
      </div>
    );
  };

  const LetterheadWidget = () => {
    return (
      <div className={cn("bg-white dark:bg-zinc-900 border rounded-2xl p-1.5 shadow-sm w-full max-w-[280px] mt-1.5 flex gap-1.5", docType === "quotation" ? "border-orange-100 dark:border-orange-500/20" : "border-violet-100 dark:border-violet-500/20")}>
        <button onClick={() => {
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: "Yes, include digital letterhead" }]);
          handleNextStepWithData("", { value: false });
        }} className={cn("flex-1 py-2 px-2 text-[10px] font-bold rounded-xl text-white transition-colors text-center leading-tight", docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600")}>
          Yes, include digital letterhead
        </button>
        <button onClick={() => {
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: "No, keep top blank (printing on paper)" }]);
          handleNextStepWithData("", { value: true });
        }} className="flex-1 py-2 px-2 text-[10px] font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors text-center leading-tight">
          No, keep top blank
        </button>
      </div>
    );
  };

  const ItemWidget = () => {
    const [items, setItems] = useState<{desc: string, hsnSac: string, rate: number, qty: number, unit: string}[]>([]);
    const [desc, setDesc] = useState("");
    const [hsnSac, setHsnSac] = useState("");
    const [rate, setRate] = useState("");
    const [qty, setQty] = useState("");
    const [unit, setUnit] = useState("Nos");

    const handleAddItem = () => {
      if (!desc.trim() || !qty || !rate) return;
      const newItem = { desc, hsnSac: hsnSac.trim(), qty: Number(qty), rate: Number(rate), unit: unit.trim() || "Nos" };
      setItems([...items, newItem]);
      setDesc(""); setHsnSac(""); setQty(""); setRate(""); setUnit("Nos");
    };

    const finishItems = () => {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", type: "text", content: `Added ${items.length} items.` }]);
      handleNextStepWithData("", { items });
    };

    return (
      <div className={cn("bg-white dark:bg-zinc-900 border rounded-2xl p-3 shadow-sm w-full max-w-sm mt-1.5", docType === "quotation" ? "border-orange-100 dark:border-orange-500/20" : "border-violet-100 dark:border-violet-500/20")}>
        {items.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1 text-xs bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl border border-slate-100 dark:border-white/5">
                <div className="flex justify-between items-center">
                  <span className="font-medium truncate text-slate-700 dark:text-zinc-200">{item.desc}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-bold shrink-0 pl-2">{item.qty} {item.unit} x ₹{item.rate}</span>
                </div>
                {item.hsnSac && <span className="text-[10px] text-slate-400 font-semibold">HSN/SAC: {item.hsnSac}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <input 
            autoFocus
            type="text" placeholder="Item Description" 
            value={desc} onChange={e => setDesc(e.target.value)}
            className={cn("w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 outline-none", docType === "quotation" ? "focus:border-orange-400" : "focus:border-violet-400")}
          />
          <div className="flex gap-1.5">
            <input 
              type="text" placeholder="HSN/SAC (Optional)" value={hsnSac} onChange={e => setHsnSac(e.target.value)}
              className={cn("flex-[1.5] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 text-xs focus:outline-none min-w-0", docType === "quotation" ? "focus:border-orange-400" : "focus:border-violet-400")}
            />
            <input 
              type="number" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)}
              className={cn("flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 text-xs focus:outline-none min-w-0", docType === "quotation" ? "focus:border-orange-400" : "focus:border-violet-400")}
            />
          </div>
          <div className="flex gap-1.5">
            <input 
              type="text" placeholder="Unit" value={unit} onChange={e => setUnit(e.target.value)}
              className={cn("flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 text-xs focus:outline-none min-w-0", docType === "quotation" ? "focus:border-orange-400" : "focus:border-violet-400")}
            />
            <input 
              type="number" placeholder="Rate (₹)" value={rate} onChange={e => setRate(e.target.value)}
              className={cn("flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 text-xs focus:outline-none min-w-0", docType === "quotation" ? "focus:border-orange-400" : "focus:border-violet-400")}
            />
          </div>
          <div className="flex gap-1.5 mt-2">
            <button onClick={handleAddItem} className="flex-1 py-2 text-[10px] font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors uppercase tracking-wider">
              + Add Item
            </button>
            <button onClick={finishItems} disabled={items.length === 0} className={cn("flex-1 py-2 text-[10px] font-bold rounded-xl disabled:bg-slate-300 dark:disabled:bg-zinc-800 text-white transition-colors uppercase tracking-wider", docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600")}>
              Done Adding
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMessageContent = (msg: Message) => {
    const isLastMessage = messages[messages.length - 1]?.id === msg.id;

    if (msg.sender === "user") {
      return (
        <div className={cn("px-4 py-2.5 rounded-[20px] rounded-tr-md text-xs shadow-sm border font-medium", docType === "quotation" ? "bg-orange-50 dark:bg-orange-500/10 text-orange-950 dark:text-orange-200 border-orange-100 dark:border-orange-500/20" : "bg-violet-50 dark:bg-violet-500/10 text-violet-950 dark:text-violet-200 border-violet-100 dark:border-violet-500/20")}>
          {msg.content}
        </div>
      );
    }

    // AI Messages
    return (
      <div className="flex flex-col gap-1.5 items-start w-full">
        {msg.content && (
          <div className="px-4 py-2.5 rounded-[20px] rounded-tl-md text-xs bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 text-slate-800 dark:text-zinc-200 shadow-sm font-medium whitespace-pre-line leading-relaxed">
            {msg.content}
          </div>
        )}
        
        {/* Only render widgets for the very last message so history stays clean */}
        {isLastMessage && msg.type === "text_input" && <TextInputWidget placeholder="Enter details here..." />}
        {isLastMessage && msg.type === "date_widget" && <DateWidget />}
        {isLastMessage && msg.type === "item_widget" && <ItemWidget />}
        {isLastMessage && msg.type === "terms_widget" && <TermsWidget />}
        {isLastMessage && msg.type === "gstin_widget" && <GstinWidget />}
        {isLastMessage && msg.type === "gst_widget" && <GstWidget />}
        {isLastMessage && msg.type === "letterhead_widget" && <LetterheadWidget />}

      </div>
    );
  };

  return (
    <div className="flex gap-4 sm:gap-6 h-full w-full">
      {/* Left Sidebar */}
      <div className="w-[260px] shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-100 dark:border-white/5 rounded-[24px] p-5 shadow-lg shadow-slate-200/40 hidden lg:flex flex-col relative overflow-hidden">
        {/* Decorative corner blur */}
        <div className={cn("absolute -top-10 -left-10 w-24 h-24 blur-2xl rounded-full pointer-events-none", docType === "quotation" ? "bg-orange-400/20" : "bg-violet-400/20")} />
        
        <div className="relative z-10">
          <div className="flex flex-col gap-1.5 mb-4">
            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm mb-1 border", docType === "quotation" ? "bg-orange-50 dark:bg-orange-500/10 text-orange-500 border-orange-100 dark:border-orange-500/20" : "bg-violet-50 dark:bg-violet-500/10 text-violet-500 border-violet-100 dark:border-violet-500/20")}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 dark:text-white text-lg leading-tight">AI {docType === 'quotation' ? 'Quotation' : 'Invoice'} Wizard</h2>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium leading-relaxed mt-0.5">
                Answer a few questions and get your {docType} ready.
              </p>
            </div>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mb-4 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500 ease-out", docType === "quotation" ? "bg-orange-500" : "bg-violet-500")} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 pb-4 space-y-0 relative z-10 scrollbar-hide">
          {stepsList.map((s, idx) => {
            const isActive = step === idx;
            const isCompleted = step > idx;
            const isLast = idx === stepsList.length - 1;
            
            return (
              <div key={s.id} className="flex gap-3 relative py-1.5 group">
                {/* Connecting line segment */}
                {!isLast && (
                  <div className="absolute left-[12px] top-[32px] bottom-[-6px] w-[2px] bg-slate-100 dark:bg-zinc-800 -z-10" />
                )}
                <div className={cn(
                  "w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold transition-all duration-300 shadow-sm border",
                  isActive ? (docType === "quotation" ? "bg-white dark:bg-zinc-900 text-orange-500 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)] scale-110" : "bg-white dark:bg-zinc-900 text-violet-500 border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)] scale-110") :
                  isCompleted ? (docType === "quotation" ? "bg-orange-500 border-orange-500 text-white" : "bg-violet-500 border-violet-500 text-white") :
                  "bg-slate-50 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-800"
                )}>
                  {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : s.id + 1}
                </div>
                <div className={cn(
                  "flex flex-col justify-center transition-all duration-300 pt-0.5",
                  isActive ? "opacity-100 translate-x-1" : "opacity-60 hover:opacity-80"
                )}>
                  <h4 className={cn(
                    "font-bold text-xs leading-none mb-0.5",
                    isActive ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-zinc-400"
                  )}>{s.title}</h4>
                  <p className="text-[9px] text-slate-500 dark:text-zinc-500 font-medium">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Chat Area */}
      <div className="flex-1 bg-white dark:bg-zinc-950 backdrop-blur-xl border border-slate-100 dark:border-white/5 rounded-[32px] shadow-2xl shadow-slate-200/50 flex flex-col overflow-hidden relative">
        
        {/* Chat Header */}
        <div className="px-5 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-white/5 flex flex-col shrink-0 bg-white dark:bg-zinc-950 relative z-10">
           <div className="flex items-center justify-between">
             <div>
               <div className="flex items-center gap-2 mb-0.5">
                 <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shadow-sm border", docType === "quotation" ? "bg-orange-50 dark:bg-orange-500/10 text-orange-500 border-orange-100 dark:border-orange-500/20" : "bg-violet-50 dark:bg-violet-500/10 text-violet-500 border-violet-100 dark:border-violet-500/20")}>
                   <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                 </div>
                 <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">AI Chat Wizard</h3>
               </div>
               <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 font-medium pl-8 sm:pl-9">
                 Let's gather the details to generate your professional {docType}.
               </p>
             </div>
           </div>
           
           {/* Horizontal Steps Dots for Mobile/Tablet */}
           <div className="flex lg:hidden items-center gap-1.5 mt-3 px-0.5 w-full overflow-x-auto scrollbar-hide py-1">
             {stepsList.map((s, idx) => {
               const isActive = step === idx;
               const isCompleted = step > idx;
               return (
                 <div 
                   key={s.id} 
                   title={s.title}
                   className={cn(
                     "h-1.5 rounded-full transition-all duration-300 shrink-0",
                     isActive 
                       ? (docType === "quotation" ? "w-6 bg-orange-500" : "w-6 bg-violet-500") 
                       : isCompleted 
                         ? (docType === "quotation" ? "w-2 bg-orange-400/80" : "w-2 bg-violet-400/80") 
                         : "w-2 bg-slate-200 dark:bg-zinc-800"
                   )}
                 />
               );
             })}
           </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-zinc-900/20">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex w-full", msg.sender === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("flex gap-2.5 sm:gap-3 max-w-[90%] sm:max-w-[85%]", msg.sender === "user" ? "flex-row-reverse" : "flex-row")}>
                
                {/* Avatar */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border",
                  msg.sender === "ai" 
                    ? (docType === "quotation" ? "bg-white dark:bg-zinc-800 text-orange-500 border-orange-100 dark:border-orange-500/20" : "bg-white dark:bg-zinc-800 text-violet-500 border-violet-100 dark:border-violet-500/20")
                    : "bg-white dark:bg-zinc-800 text-slate-400 dark:text-zinc-400 border-slate-100 dark:border-white/10 overflow-hidden"
                )}>
                  {msg.sender === "ai" ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    user?.photoURL ? <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <User className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble Container */}
                <div className="flex flex-col gap-1 w-full">
                  {renderMessageContent(msg)}
                  <span className={cn("text-[9px] font-semibold text-slate-400 dark:text-zinc-500", msg.sender === "user" ? "text-right mr-1.5" : "text-left ml-1.5")}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer actions (Cancel / Security) */}
        <div className="px-5 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-950 shrink-0 flex items-center justify-between relative z-10">
          <button onClick={onCancel} className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold text-[10px] sm:text-[11px] hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm">
            Cancel
          </button>
          
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 absolute left-1/2 -translate-x-1/2">
            <Lock className="w-3 h-3 text-slate-300 dark:text-zinc-600" />
            Your data is secure and will never be shared.
          </div>

          <div className="flex items-center justify-end min-w-[120px] sm:min-w-[140px]">
            {messages.some(m => m.type === "generating") ? (
              <button 
                onClick={() => onFinish(gatheredData)} 
                className={cn("px-4 py-1.5 sm:px-5 sm:py-2 text-white rounded-full text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm", docType === "quotation" ? "bg-orange-500 hover:bg-orange-600" : "bg-violet-500 hover:bg-violet-600")}
              >
                <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> View Preview Again
              </button>
            ) : (
              <div /> /* Empty div to preserve flex-between layout balance */
            )}
          </div>
        </div>

        {/* Lottie Generating Overlay - Always rendered for fast loading, but visibility toggled */}
        <div className={cn(
          "absolute inset-0 z-50 flex flex-col items-center justify-center transition-all duration-300",
          showLottieOverlay ? "opacity-100 backdrop-blur-md bg-white/60 dark:bg-zinc-950/60 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}>
          <div 
            className="w-64 h-64 sm:w-80 sm:h-80 pointer-events-none -mt-10 transition-all duration-300 transform" 
            style={{ 
              transform: showLottieOverlay ? "scale(1)" : "scale(0.9)"
            }}
          >
            <DotLottieReact
              src={docType === "quotation" 
                ? "https://lottie.host/a08595ab-6751-45d9-a70e-4cdbe6f2a1c2/3PZzERNgMF.lottie" 
                : "https://lottie.host/26cb22b8-b191-482a-bffa-58198c86f79c/0TF7Fu63d2.lottie"
              }
              loop
              autoplay
            />
          </div>
          <p className={cn(
            "font-black text-lg sm:text-xl tracking-tight mt-2 animate-pulse drop-shadow-sm",
            docType === "quotation" ? "text-orange-500 dark:text-orange-400" : "text-violet-500 dark:text-violet-400"
          )}>
            Your {docType === "quotation" ? "Quotation" : "Invoice"} is generating...
          </p>
        </div>
      </div>
    </div>
  );
}
