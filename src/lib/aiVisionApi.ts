import { TaxInvoice } from '../types';

export const processDocumentWithAI = async (file: File): Promise<Partial<TaxInvoice>> => {
  return new Promise(async (resolve, reject) => {
    try {
      let base64Image = "";
      
      const fileType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      if (fileType === "application/pdf") {
        base64Image = await convertPdfToBase64(file);
      } else if (fileType.startsWith("image/")) {
        base64Image = await convertImageToBase64(file);
      } else {
        throw new Error("Unsupported file type. Please upload a JPG, PNG, or PDF.");
      }

      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // We always send image/jpeg for PDFs since we convert them to images via canvas
        body: JSON.stringify({ base64Image, mimeType: fileType === "application/pdf" ? "image/jpeg" : fileType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process document with AI");
      }

      const data = await response.json();
      resolve(data.invoiceData);
    } catch (err) {
      reject(err);
    }
  });
};

const convertImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const convertPdfToBase64 = async (file: File): Promise<string> => {
  // @ts-ignore - dynamic import to avoid SSR issues
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Could not create canvas context");

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  return dataUrl.split(',')[1];
};
