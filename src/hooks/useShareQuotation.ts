import { useState } from "react";
import { Quotation, AdminSettings } from "../types";
import { getAdminSettings, isSettingsCustomized } from "../firebase/db";
import { generatePdfBlob, downloadPdf } from "../services/pdfGenerator";
import { uploadTempPDF, nativeSharePDF } from "../services/pdfShareService";
import { useAuth } from "../context/AuthContext";

export type ShareType = "whatsapp" | "email" | "share" | "download" | "generating" | null;

export function useShareQuotation(showToast: (msg: string, type?: "success" | "info" | "error") => void) {
  const { user } = useAuth();
  const [sharingState, setSharingState] = useState<ShareType>(null);
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [tempUrl, setTempUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const triggerShare = async (q: Quotation, type: "whatsapp" | "email" | "share" | "download") => {
    setActiveQuotation(q);
    setSharingState(type);
    
    try {
      // 1. Fetch settings dynamically (User-specific settings!)
      const settings = await getAdminSettings(user?.uid);
      setAdminSettings(settings);

      // 2. Wait 300ms for hidden off-screen React DOM nodes to mount and render fully
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 3. Compile pixel-perfect PDF Blob on-the-fly from hidden DOM container
      const pdfBlob = await generatePdfBlob("quotation-pdf-container", {
        isCustomized: isSettingsCustomized(settings),
        themeColor: "quotation"
      });
      const filename = `Quotation_${q.number}.pdf`;
      const isMobileShareSupported = typeof navigator !== "undefined" && !!((navigator as any).share && (navigator as any).canShare);

      if (type === "download") {
        showToast("Compiling PDF document...", "info");
        downloadPdf(pdfBlob, filename);
        showToast("PDF downloaded successfully!", "success");
        setSharingState(null);
        return;
      }

      if (type === "share") {
        if (isMobileShareSupported) {
          const success = await nativeSharePDF(pdfBlob, filename);
          if (success) {
            showToast("Physical PDF shared successfully!", "success");
            setSharingState(null);
            return;
          }
        }
        
        // Desktop Fallback or Native Cancelled: Upload to Storage & open custom Share Modal
        showToast("Generating secure sharing link...", "info");
        const downloadUrl = await uploadTempPDF(pdfBlob, q.number);
        setTempUrl(downloadUrl);
        setModalOpen(true);
      } 
      
      else if (type === "whatsapp") {
        const textMessage = `Hello, Please find attached quotation from Darshan Enterprises.`;
        
        if (isMobileShareSupported) {
          // Mobile: Share physical PDF directly via Web Share API (Zero local downloads!)
          const success = await nativeSharePDF(pdfBlob, filename, textMessage);
          if (success) {
            showToast("Quotation PDF shared on WhatsApp!", "success");
            setSharingState(null);
            return;
          }
        }
        
        // Desktop: Upload to Firebase and open WhatsApp Web directly with the public link (Zero local downloads!)
        showToast("Uploading PDF and opening WhatsApp...", "info");
        const downloadUrl = await uploadTempPDF(pdfBlob, q.number);
        const finalMessage = `${textMessage}\n\nDownload Link: ${downloadUrl}`;
        
        const wpUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(finalMessage)}`;
        window.open(wpUrl, "_blank");
        showToast("WhatsApp Web opened successfully!", "success");
      } 
      
      else if (type === "email") {
        if (isMobileShareSupported) {
          // Mobile: Share physical PDF directly via Web Share API (Zero local downloads!)
          const success = await nativeSharePDF(pdfBlob, filename);
          if (success) {
            showToast("Quotation PDF shared via Email!", "success");
            setSharingState(null);
            return;
          }
        }

        // Desktop: Upload to Firebase and open mail client directly with the public link (Zero local downloads!)
        showToast("Uploading PDF and opening Email client...", "info");
        const downloadUrl = await uploadTempPDF(pdfBlob, q.number);
        const subject = "Quotation from Darshan Enterprises";
        const body = `Dear Sir/Madam,\n\nPlease find attached quotation PDF from Darshan Enterprises.\n\nQuotation PDF Download Link: ${downloadUrl}\n\nRegards,\nDarshan Enterprises`;
        
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        showToast("Mail client triggered successfully!", "success");
      }

    } catch (err: any) {
      console.error("Advanced sharing pipeline failed:", err);
      showToast("Advanced sharing failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setSharingState(null);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setTempUrl(null);
  };

  return {
    sharingState,
    activeQuotation,
    adminSettings,
    tempUrl,
    modalOpen,
    triggerShare,
    closeModal
  };
}
