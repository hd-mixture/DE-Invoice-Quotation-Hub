import { storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { generatePdfBlob } from "./pdfGenerator";

/**
 * Uploads a generated PDF blob temporarily to Firebase Storage
 * in the 'temp_quotations' directory and returns a public download URL.
 * 
 * @param pdfBlob The A4 PDF binary blob
 * @param number The quotation reference number
 * @returns Promise containing the public download URL
 */
export async function uploadTempPDF(pdfBlob: Blob, number: string): Promise<string> {
  const cleanNumber = number.replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `Quotation_${cleanNumber}_${Date.now()}.pdf`;
  const storageRef = ref(storage, `temp_quotations/${filename}`);
  
  const snapshot = await uploadBytes(storageRef, pdfBlob, {
    contentType: "application/pdf",
    customMetadata: {
      quotationNumber: number,
      uploadedAt: new Date().toISOString()
    }
  });

  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

/**
 * Standard utility to share a physical PDF file directly using Web Share API
 */
export async function nativeSharePDF(pdfBlob: Blob, filename: string, text?: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  
  const file = new File([pdfBlob], filename.endsWith(".pdf") ? filename : `${filename}.pdf`, {
    type: "application/pdf"
  });

  const shareData: ShareData = {
    files: [file]
  };

  if (text) {
    shareData.text = text;
  }

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (err) {
      console.warn("Native share cancelled or failed:", err);
      return false;
    }
  }

  return false;
}
