import * as XLSX from 'xlsx';
import { TaxInvoice, TaxInvoiceItem } from '../types';

export const parseExcelInvoice = async (file: File): Promise<Partial<TaxInvoice>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to 2D JSON array
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        let clientName = "";
        let clientAddress = "";
        let clientGstin = "";
        let billNumber = "";
        let billDate = "";
        let poNumber = "";
        let poDate = "";
        let jobDescription = "";
        let customTerms: string[] = [];
        let isParsingTerms = false;
        
        let items: TaxInvoiceItem[] = [];
        
        // Simple heuristic: look for a row with "Description" or "Item" to act as headers
        let headerRowIdx = -1;
        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          if (!row) continue;
          
          if (!isParsingTerms && i < 50) { // Limit header/meta search
            const hasDescHeader = row.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('description') || cell.toLowerCase().includes('item')));
            if (hasDescHeader && headerRowIdx === -1) {
               headerRowIdx = i;
            }
          }
          
          // Try to extract metadata
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (typeof cell !== 'string') continue;
            const cellLower = cell.toLowerCase().trim();

            if (!isParsingTerms) {
               // Extract Client Name, Address and GSTIN
               if ((cellLower.includes('client') || cellLower.includes('billed to')) && !clientName) {
                 let potentialName = String(row[j + 1] || "").trim();
                 let startIdx = i;
                 if (!potentialName && json[i+1]) {
                    potentialName = String(json[i+1][j] || "").trim();
                    startIdx = i + 1;
                 }
                 if (potentialName) {
                    clientName = potentialName;
                    let addressLines = [];
                    for (let k = startIdx + 1; k < Math.min(startIdx + 10, json.length); k++) {
                      const nextRow = json[k];
                      if (!nextRow) continue;
                      const nextCell = String(nextRow[j] || "").trim();
                      if (!nextCell) continue;
                      
                      const nextCellLower = nextCell.toLowerCase();
                      if (nextCellLower.includes('gst tin') || nextCellLower.includes('gstin')) {
                         clientGstin = nextCell.substring(nextCellLower.indexOf('gst')).replace(/gst\s*t?i?n?\s*[:\-]*/i, '').trim();
                         if (!clientGstin && nextRow[j+1]) clientGstin = String(nextRow[j+1]).trim();
                         break;
                      } else if (nextCellLower.includes('job') || nextCellLower.includes('sr no') || nextCellLower.includes('description')) {
                         break;
                      } else {
                         addressLines.push(nextCell);
                      }
                    }
                    clientAddress = addressLines.join("\n");
                 }
               }
               // Extract Bill No
               if ((cellLower.includes('bill no') || cellLower.includes('invoice no')) && !billNumber) {
                 const idx = cellLower.indexOf('no');
                 const val = cell.substring(idx + 2).replace(/^[\s:.]+/, '').trim();
                 if (val) billNumber = val;
                 else if (row[j+1]) billNumber = String(row[j+1]).trim();
               }
               // Extract Date
               if ((cellLower.startsWith('date') || cellLower.startsWith('bill date')) && !cellLower.includes('p.o') && !cellLower.includes('po ') && !billDate) {
                 const idx = cellLower.indexOf('date');
                 const val = cell.substring(idx + 4).replace(/^[\s:.]+/, '').trim();
                 if (val) billDate = val;
                 else if (row[j+1]) billDate = String(row[j+1]).trim();
               }
               // Extract PO No
               if ((cellLower.includes('p.o. no') || cellLower.includes('po no') || cellLower.includes('p.o no')) && !poNumber) {
                 const idx = cellLower.indexOf('no');
                 const val = cell.substring(idx + 2).replace(/^[\s:.]+/, '').trim();
                 if (val) poNumber = val;
                 else if (row[j+1]) poNumber = String(row[j+1]).trim();
               }
               // Extract PO Date
               if ((cellLower.includes('p.o.date') || cellLower.includes('po date') || cellLower.includes('p.o. date')) && !poDate) {
                 const idx = cellLower.indexOf('date');
                 const val = cell.substring(idx + 4).replace(/^[\s:.]+/, '').trim();
                 if (val) poDate = val;
                 else if (row[j+1]) poDate = String(row[j+1]).trim();
               }
               // Extract Job/Subject
               if ((cellLower.includes('job') || cellLower.includes('subject') || cellLower.includes('project')) && !jobDescription) {
                 // Try to strip "Job :" or "Subject :" from the cell
                 let val = cell.replace(/^(job|subject|project)\s*(description|name)?[\s:.-]*/i, '').trim();
                 if (val) jobDescription = val;
                 else if (row[j+1]) jobDescription = String(row[j+1]).trim();
               }
               // Terms Trigger
               if ((cellLower.includes("term") || cellLower.includes("terms")) && cellLower.includes("condition")) {
                 isParsingTerms = true;
                 break;
               }
            } else {
               // We are parsing terms
               const termText = cell.trim();
               if (termText) {
                 if (termText.toLowerCase().includes('for,') || termText.toLowerCase().includes('authorised signatory') || termText.toLowerCase().includes('signature')) {
                   isParsingTerms = false;
                   break;
                 } else {
                   // Remove leading numbers like "(1) " or "1. "
                   const cleanedTerm = termText.replace(/^\(?\d+\)?\s*\.?\s*/, '').trim();
                   if (cleanedTerm && !customTerms.includes(cleanedTerm) && !cleanedTerm.toLowerCase().includes("condition")) {
                     customTerms.push(cleanedTerm);
                   }
                 }
               }
            }
          }
        }
        
        if (headerRowIdx !== -1) {
           const headers = json[headerRowIdx].map(h => String(h || '').toLowerCase());
           const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('item') || h.includes('particulars'));
           const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quant'));
           const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price') || h.includes('unit price'));
           const hsnIdx = headers.findIndex(h => h.includes('hsn') || h.includes('sac'));
           
           for (let i = headerRowIdx + 1; i < json.length; i++) {
              const row = json[i];
              // Break if we hit an empty row or a totals row or terms
              if (!row || row.length === 0 || (typeof row[0] === 'string' && (row[0].toLowerCase().includes('total') || row[0].toLowerCase().includes('rupee') || row[0].toLowerCase().includes('bank')))) break;
              if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('total'))) break;
              
              if (descIdx >= 0 && row[descIdx]) {
                const qty = qtyIdx >= 0 ? parseFloat(row[qtyIdx]) || 1 : 1;
                const rate = rateIdx >= 0 ? parseFloat(row[rateIdx]) || 0 : 0;
                
                items.push({
                   id: crypto.randomUUID(),
                   srNo: items.length + 1,
                   description: String(row[descIdx]),
                   hsnSac: hsnIdx >= 0 && row[hsnIdx] ? String(row[hsnIdx]) : "",
                   qty: qty,
                   unit: "Nos",
                   rate: rate,
                   amount: qty * rate
                });
              }
           }
        }

        // Helper to format date if it's DD/MM/YYYY to YYYY-MM-DD
        const formatDateForInput = (dStr: string) => {
          if (!dStr) return "";
          const parts = dStr.split(/[\/\-.]/);
          if (parts.length === 3) {
            // Assume DD/MM/YYYY or DD-MM-YYYY
            if (parts[2].length === 4) {
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          return dStr; // fallback
        };
        
        if (!items || items.length === 0) {
          throw new Error("Invalid Spreadsheet Structure: The uploaded Excel file does not contain recognizable quotation/invoice line items or valid columns (Description, Qty, Rate, Amount). Please check your Excel structure.");
        }

        const partialInvoice: Partial<TaxInvoice> = {
          billedTo: {
             clientName: clientName || "Imported Client",
             clientAddress: clientAddress || "",
             clientGstin: clientGstin || ""
          },
          billNumber: billNumber || undefined,
          billDate: billDate ? formatDateForInput(billDate) : undefined,
          poNumber: poNumber || undefined,
          poDate: poDate ? formatDateForInput(poDate) : undefined,
          jobDescription: jobDescription || undefined,
          customTerms: customTerms.length > 0 ? customTerms : undefined,
          items: items.length > 0 ? items : undefined,
          isImported: true,
          invoiceType: "imported",
          importSource: "excel"
        };
        
        resolve(partialInvoice);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

export const parsePDFInvoice = async (file: File): Promise<Partial<TaxInvoice>> => {
  // Placeholder for AI/OCR extraction logic
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
         billedTo: {
            clientName: "AI Extracted Client (Mock)",
            clientAddress: "123 Mock AI Street",
            clientGstin: "27AAACXXXXX1Z5"
         },
         jobDescription: "AI Document Import",
         items: [
           {
              id: crypto.randomUUID(),
              srNo: 1,
              description: "PDF Imported Service 1",
              hsnSac: "9983",
              qty: 1,
              unit: "Nos",
              rate: 5000,
              amount: 5000
           },
           {
              id: crypto.randomUUID(),
              srNo: 2,
              description: "PDF Imported Material",
              hsnSac: "7326",
              qty: 5,
              unit: "Kgs",
              rate: 200,
              amount: 1000
           }
         ],
         isImported: true,
         invoiceType: "imported",
         importSource: "pdf"
      });
    }, 1500); // Simulate network delay
  });
};
