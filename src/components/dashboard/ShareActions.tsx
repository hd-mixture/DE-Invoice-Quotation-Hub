import React, { useState } from "react";
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  MessageCircle, 
  Mail, 
  Send, 
  ExternalLink 
} from "lucide-react";
import { Quotation } from "../../types";
import { formatCurrency } from "../../lib/utils";

interface ShareActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  downloadUrl: string | null;
  onDownloadLocal: () => void;
}

export const ShareActionsModal: React.FC<ShareActionsModalProps> = ({
  isOpen,
  onClose,
  quotation,
  downloadUrl,
  onDownloadLocal
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !quotation || !downloadUrl) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const shareText = `Hello, Please find attached quotation ${quotation.number} from Darshan Enterprises.`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n\nDownload Link: ${downloadUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(downloadUrl)}&text=${encodeURIComponent(shareText)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(`Quotation ${quotation.number}`)}&body=${encodeURIComponent(`Dear Sir/Madam,\n\nPlease find attached quotation PDF from Darshan Enterprises.\n\nDownload Link: ${downloadUrl}\n\nRegards,\nDarshan Enterprises`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur overlay */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Glassmorphic Modal Box */}
      <div className="relative w-full max-w-md bg-background/80 border border-white/10 dark:border-white/5 p-6 rounded-3xl shadow-2xl backdrop-blur-xl transition-all duration-300 scale-[1.01] animate-in fade-in zoom-in-95 z-10 flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-border/20">
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground">Share Quotation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Select a supported platform to distribute this document.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-muted/80 rounded-xl transition-all text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Small Quotation KPI Card */}
        <div className="bg-muted/40 border border-border/20 p-4 rounded-2xl flex flex-col gap-1.5">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono font-bold bg-[#09357B]/10 dark:bg-blue-500/10 text-[#09357B] dark:text-blue-400 px-2.5 py-0.5 rounded-md">
              {quotation.number}
            </span>
            <span className="text-xs font-mono font-bold text-foreground">
              ₹ {formatCurrency(quotation.grandTotal)}
            </span>
          </div>
          <h4 className="font-extrabold text-sm text-foreground mt-1 truncate">
            {quotation.clientDetails.companyName}
          </h4>
          <p className="text-[11px] text-muted-foreground truncate">
            <span className="font-semibold">Subject:</span> {quotation.clientDetails.subject}
          </p>
        </div>

        {/* Share Link Input */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Public Download Link</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly 
              value={downloadUrl} 
              className="flex-1 px-3 py-2.5 rounded-xl border border-border/40 bg-muted/20 outline-none text-xs font-mono text-muted-foreground truncate"
            />
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                copied 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                  : "bg-primary text-white hover:bg-primary/95 shadow-md shadow-primary/10"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share Grid Shortcuts */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Download Local PDF */}
          <button
            onClick={() => {
              onDownloadLocal();
              onClose();
            }}
            className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/60 border border-border/20 rounded-2xl cursor-pointer text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground">Download PDF</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Save to your device</p>
            </div>
          </button>

          {/* Share WhatsApp Web */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/60 border border-border/20 rounded-2xl cursor-pointer text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground">WhatsApp</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Share via message</p>
            </div>
          </a>

          {/* Share Email default */}
          <a
            href={emailUrl}
            onClick={onClose}
            className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/60 border border-border/20 rounded-2xl cursor-pointer text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground">Email</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Send via mail client</p>
            </div>
          </a>

          {/* Share Telegram */}
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/60 border border-border/20 rounded-2xl cursor-pointer text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground">Telegram</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Share via telegram</p>
            </div>
          </a>
        </div>

        {/* Direct Link Open */}
        <a 
          href={downloadUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:underline mt-1 py-1 cursor-pointer"
        >
          <span>Open PDF directly in browser</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
export default ShareActionsModal;
