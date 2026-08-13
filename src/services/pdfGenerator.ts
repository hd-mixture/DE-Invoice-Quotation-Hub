import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface PdfGeneratorOptions {
  isCustomized?: boolean;
  themeColor?: "quotation" | "invoice" | "orange" | "violet" | string;
}

/**
 * Generates an A4 PDF from a DOM element.
 * Uses html2canvas with upscale options for razor-sharp vector/text rendering,
 * and jsPDF with exact mm conversions for standard A4 printing.
 * 
 * @param elementId The id of the DOM element to render
 * @param options Optional configuration including isCustomized flag and themeColor
 * @returns Promise containing the generated PDF Blob
 */
export async function generatePdfBlob(elementId: string, options?: PdfGeneratorOptions): Promise<Blob> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`PDF target element with id "${elementId}" not found in DOM.`);
  }

  // Optimize styling specifically for html2canvas capture (remove shadows, scale cleanly)
  const originalShadow = element.style.boxShadow;
  element.style.boxShadow = "none";

  try {
    // 300 DPI High-Resolution Capture Scale
    const targetScale = Math.max(3.5, (window.devicePixelRatio || 1) * 2);

    const canvas = await html2canvas(element, {
      scale: targetScale, // 3.5x scale (approx 300 DPI print quality)
      useCORS: true, // Permits loading Firebase Storage images without canvas security taint
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          clonedElement.style.boxShadow = "none";
          (clonedElement.style as any).webkitFontSmoothing = "antialiased";
          clonedElement.style.textRendering = "geometricPrecision";
        }
      }
    });

    // Reset styles
    element.style.boxShadow = originalShadow;

    // Use JPEG 0.98 for razor-sharp text edges while maintaining lightweight ~250KB file size
    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    
    // Standard A4 dimensions in mm: 210 x 297
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true // Enable PDF stream zlib compression
    });

    const imgWidth = 210; // mm
    const pageHeight = 297; // mm
    // Maintain scale ratio
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // Render pages with "NONE" compression option to prevent jsPDF downsampling
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "NONE");
    heightLeft -= pageHeight;

    // Support automatic pagination if the content overflows standard 1123px height
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "NONE");
      heightLeft -= pageHeight;
    }

    // Helper to add DARSHAN ENTERPRISES watermark in bottom right corner of each page with theme colors
    const addWatermark = (doc: jsPDF, theme?: string) => {
      try {
        const isQuotation = theme === "quotation" || theme === "orange";

        // Color palettes:
        // Quotation (Orange theme): #FFF7ED bg, #FED7AA border, #C2410C text, #EA580C subtext
        // Tax Invoice (Violet theme): #F8F6FF bg, #E2DCFF border, #6D28D9 text, #8B5CF6 subtext
        const bgColor: [number, number, number] = isQuotation ? [255, 247, 237] : [248, 246, 255];
        const borderColor: [number, number, number] = isQuotation ? [254, 215, 170] : [226, 220, 255];
        const primaryTextColor: [number, number, number] = isQuotation ? [194, 65, 12] : [109, 40, 217];
        const subTextColor: [number, number, number] = isQuotation ? [234, 88, 12] : [139, 92, 246];

        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.saveGraphicsState();
          
          // Draw bottom-right watermark badge (X: 128mm, Y: 286.5mm, W: 76mm, H: 6mm)
          doc.setFillColor(...bgColor);
          doc.setDrawColor(...borderColor);
          doc.roundedRect(128, 286.5, 76, 6, 1.2, 1.2, "FD");
          
          // Primary Brand Text
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.2);
          doc.setTextColor(...primaryTextColor);
          doc.text("✦ DARSHAN ENTERPRISES", 131, 290.4);

          // Dot Separator
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(...subTextColor);
          doc.text("•", 179, 290.4);

          // Subtext
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          doc.setTextColor(...subTextColor);
          doc.text("OFFICIAL SUITE", 183, 290.4);

          doc.restoreGraphicsState();
        }
      } catch (wErr) {
        console.warn("Watermark render notice:", wErr);
      }
    };

    // Apply watermark ONLY IF user has customized workspace settings
    if (options?.isCustomized) {
      addWatermark(pdf, options.themeColor);
    }

    return pdf.output("blob");
  } catch (error) {
    element.style.boxShadow = originalShadow;
    console.error("PDF generation pipeline failed:", error);
    throw error;
  }
}

/**
 * Downloads a generated PDF blob in the browser
 */
export function downloadPdf(pdfBlob: Blob, filename: string): void {
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
