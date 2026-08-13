import { TaxInvoice, TaxInvoiceItem } from "../types";

/**
 * Clean and format date from DD-MM-YYYY to YYYY-MM-DD for standard input elements
 */
function cleanDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  const parts = dateStr.trim().split(/[-\/\.]/);
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];
    // Ensure 4 digit year
    if (year.length === 2) year = "20" + year;
    // Ensure 2 digit day/month
    if (day.length === 1) day = "0" + day;
    if (month.length === 1) month = "0" + month;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

/**
 * Standard utility to parse floats safely
 */
function safeFloat(val: string | number): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/[^0-9\.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Extracts and maps billing data from raw extracted text lines
 */
export function parseInvoiceText(rawText: string): Partial<TaxInvoice> {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  let billNumber = "";
  let billDate = new Date().toISOString().split("T")[0];
  let poNumber = "";
  let poDate = "";
  
  let clientName = "";
  let clientAddress = "";
  let clientGstin = "";
  
  let jobDescription = "";
  let items: TaxInvoiceItem[] = [];
  let bankName = "";
  let bankAccountNo = "";
  let bankIfscCode = "";
  
  let subTotal = 0;
  let cgstRate = 9;
  let sgstRate = 9;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let gstTotal = 0;
  let grandTotal = 0;
  let rupeesInWords = "";
  
  // 1. Meta Fields extraction (Bill Number, Date, PO Number, PO Date)
  for (const line of lines) {
    // Bill Number
    const billMatch = line.match(/Bill\s*No\s*[:\-]?\s*([A-Z0-9_\-\s\/]+)/i);
    if (billMatch && !billNumber) {
      const val = billMatch[1].trim();
      billNumber = val.split(/(?:Date|GSTIN|P\.O|P\.O\.No)/i)[0].trim().replace(/\s+/g, " ");
    }
    
    // PO Number
    const poMatch = line.match(/(?:P\.O\.\s*No|P\.O\.No|P\.O\s*No|PO\s*No)\s*[:\-]?\s*([A-Z0-9_\-\s\/]+)/i);
    if (poMatch && !poNumber) {
      const val = poMatch[1].trim();
      poNumber = val.split(/(?:Date|P\.O\.Date|GSTIN)/i)[0].trim().replace(/\s+/g, " ");
    }
    
    // PO Date
    const poDateMatch = line.match(/(?:P\.O\.\s*Date|P\.O\.Date|PO\s*Date)\s*[:\-]?\s*(\d{2}[-\/\.]\d{2}[-\/\.]\d{4})/i);
    if (poDateMatch && !poDate) {
      poDate = cleanDate(poDateMatch[1]);
    }
  }

  // Double Check for Date specifically (to distinguish from PO Date)
  // Find standard DD-MM-YYYY dates in text
  const dateRegex = /(?:^|[^\w])Date\s*[:\-]?\s*(\d{2}[-\/\.]\d{2}[-\/\.]\d{4})/i;
  for (const line of lines) {
    if (!line.includes("P.O") && !line.includes("PO")) {
      const dateMatch = line.match(dateRegex);
      if (dateMatch) {
        billDate = cleanDate(dateMatch[1]);
        break;
      }
    }
  }

  // 2. Client Details (BILLED TO section)
  let inBilledTo = false;
  let billedToLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/BILLED\s*TO/i)) {
      inBilledTo = true;
      continue;
    }
    
    if (inBilledTo) {
      // Billed To ends when we reach Job, HSN Table, or GSTIN
      if (line.match(/(?:Job\s*[:\-]|Sr\.\s*No|Sr\s*No|Description)/i) || billedToLines.length > 8) {
        inBilledTo = false;
        break;
      }
      
      if (line.match(/GSTIN\s*[:\-]?\s*([0-9A-Z]{15})/i)) {
        const gstMatch = line.match(/GSTIN\s*[:\-]?\s*([0-9A-Z]{15})/i);
        if (gstMatch) {
          clientGstin = gstMatch[1].trim();
        }
        
        // Remove GSTIN string from address line if merged
        const cleanedLine = line.replace(/GSTIN\s*[:\-]?\s*[0-9A-Z]{15}/i, "").trim();
        if (cleanedLine.length > 2) {
          billedToLines.push(cleanedLine);
        }
      } else {
        billedToLines.push(line);
      }
    }
  }

  // Client Name is usually the first non-empty line of Billed To
  if (billedToLines.length > 0) {
    clientName = billedToLines[0].trim();
    // Clean company prefix/suffix if they are standard e.g. "M/S"
    clientAddress = billedToLines.slice(1).join("\n").trim();
  }

  // 3. Job Description
  for (const line of lines) {
    const jobMatch = line.match(/Job\s*[:\-]+\s*([^\n\r]+)/i);
    if (jobMatch) {
      jobDescription = jobMatch[1].trim();
      break;
    }
  }

  // 4. HSN Items Table Parsing
  // Find headers and totals bounds
  let tableHeaderIndex = -1;
  let tableFooterIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/(?:Sr\.\s*No|Sr\s*No)\s*(?:Description|Particulars)/i)) {
      tableHeaderIndex = i;
    }
    if (line.match(/Total\s*=/i) || (line.includes("BANK Name") && tableHeaderIndex !== -1 && tableFooterIndex === -1)) {
      tableFooterIndex = i;
    }
  }

  if (tableHeaderIndex !== -1) {
    const endBound = tableFooterIndex !== -1 ? tableFooterIndex : lines.length;
    const tableLines = lines.slice(tableHeaderIndex + 1, endBound);
    
    let currentItem: TaxInvoiceItem | null = null;
    let srCounter = 1;
    
    for (const rawLine of tableLines) {
      // Check if line represents a new item row starting with a serial number e.g. "1 " or "1. "
      const srMatch = rawLine.match(/^(\d+)[\s\.]+/);
      
      // Look for data values at the end of the line: e.g. Amount, Rate, Unit, Qty, HSN
      // E.g. "... 995473 1333.12 SQMT 170.00 226630.40"
      // Regex matches: HSN(6 digits) Qty(decimal) Unit(words) Rate(decimal) Amount(decimal)
      const valuesMatch = rawLine.match(/(\d{6})\s+([\d\.]+)\s+([A-Z]+)\s+([\d\.]+)\s+([\d\.]+)$/i);
      
      if (srMatch && valuesMatch) {
        // This is a complete inline item row!
        if (currentItem) {
          items.push(currentItem);
        }
        
        const id = "item-" + Math.random().toString(36).substring(2, 9);
        const srNo = parseInt(srMatch[1], 10) || srCounter++;
        const hsnSac = valuesMatch[1].trim();
        const qty = safeFloat(valuesMatch[2]);
        const unit = valuesMatch[3].trim().toUpperCase();
        const rate = safeFloat(valuesMatch[4]);
        const amount = safeFloat(valuesMatch[5]);
        
        // Description is everything in between the serial number and the values block
        const startIdx = rawLine.indexOf(srMatch[0]) + srMatch[0].length;
        const endIdx = rawLine.lastIndexOf(valuesMatch[0]);
        const description = rawLine.substring(startIdx, endIdx).trim();
        
        currentItem = {
          id,
          srNo,
          description,
          hsnSac,
          qty,
          unit,
          rate,
          amount
        };
      } else if (valuesMatch && !srMatch) {
        // Values are present but no serial number: Might be an item starting on a new line or multi-line continuation
        if (currentItem) {
          items.push(currentItem);
        }
        
        const id = "item-" + Math.random().toString(36).substring(2, 9);
        const srNo = srCounter++;
        const hsnSac = valuesMatch[1].trim();
        const qty = safeFloat(valuesMatch[2]);
        const unit = valuesMatch[3].trim().toUpperCase();
        const rate = safeFloat(valuesMatch[4]);
        const amount = safeFloat(valuesMatch[5]);
        
        // Everything before values is description
        const endIdx = rawLine.lastIndexOf(valuesMatch[0]);
        const description = rawLine.substring(0, endIdx).trim();
        
        currentItem = {
          id,
          srNo,
          description,
          hsnSac,
          qty,
          unit,
          rate,
          amount
        };
      } else {
        // This is a plain description text line: Append to current active item's description
        if (currentItem) {
          currentItem.description += " " + rawLine;
        } else if (tableLines.length === 1 || (tableLines.length > 0 && items.length === 0)) {
          // Fallback if formatting was loose
          const fallbackId = "item-" + Math.random().toString(36).substring(2, 9);
          currentItem = {
            id: fallbackId,
            srNo: 1,
            description: rawLine,
            hsnSac: "995473",
            qty: 1,
            unit: "NOS",
            rate: 0,
            amount: 0
          };
        }
      }
    }
    
    if (currentItem) {
      items.push(currentItem);
    }
  }

  // 5. Summary calculations & Bank details
  for (const line of lines) {
    // Bank Name
    const bankMatch = line.match(/BANK\s*Name\s*[:\-]?\s*([A-Za-z0-9\s]+)/i);
    if (bankMatch && !bankName) {
      bankName = bankMatch[1].trim().split(/(?:Account|IFSC|Add)/i)[0].trim();
    }
    
    // Account No
    const accMatch = line.match(/Account\s*No\s*[:\-]?\s*(\d+)/i);
    if (accMatch && !bankAccountNo) {
      bankAccountNo = accMatch[1].trim();
    }
    
    // IFSC
    const ifscMatch = line.match(/IFSC\s*Code\s*[:\-]?\s*([A-Z0-9]{11})/i);
    if (ifscMatch && !bankIfscCode) {
      bankIfscCode = ifscMatch[1].trim();
    }
    
    // Rupees in words
    const rupeesMatch = line.match(/RUPEES\s*[:\-]+\s*([^\n\r]+)/i);
    if (rupeesMatch && !rupeesInWords) {
      rupeesInWords = rupeesMatch[1].trim().replace(/\s+/g, " ");
    }
    
    // Tax Rates & Amounts
    if (line.match(/(?:CGST|CGST\s*\d+%)\s*([\d\.]+)/i)) {
      const cgstMatch = line.match(/(?:CGST|CGST\s*(\d+)%)\s*([\d\.]+)/i);
      if (cgstMatch) {
        if (cgstMatch[1]) cgstRate = parseInt(cgstMatch[1], 10);
        cgstAmount = safeFloat(cgstMatch[2]);
      }
    }
    if (line.match(/(?:SGST|SGST\s*\d+%)\s*([\d\.]+)/i)) {
      const sgstMatch = line.match(/(?:SGST|SGST\s*(\d+)%)\s*([\d\.]+)/i);
      if (sgstMatch) {
        if (sgstMatch[1]) sgstRate = parseInt(sgstMatch[1], 10);
        sgstAmount = safeFloat(sgstMatch[2]);
      }
    }
    if (line.match(/(?:IGST|IGST\s*\d+%)\s*([\d\.]+)/i)) {
      const igstMatch = line.match(/(?:IGST|IGST\s*(\d+)%)\s*([\d\.]+)/i);
      if (igstMatch) {
        if (igstMatch[1]) igstRate = parseInt(igstMatch[1], 10);
        igstAmount = safeFloat(igstMatch[2]);
      }
    }
    
    // Grand Total (Final bottom amount)
    const totalMatch = line.match(/(?:GST\s*TOTAL|GST\s*TOTAL\s*=)\s*([\d\.]+)/i);
    if (totalMatch) {
      gstTotal = safeFloat(totalMatch[1]);
    }
  }

  // Calculate Subtotal and GrandTotal from items if parsing values was incomplete
  subTotal = items.reduce((sum, item) => sum + item.amount, 0);
  if (cgstAmount === 0 && sgstAmount === 0 && igstAmount === 0) {
    // Default fallback tax calc (CGST 9% + SGST 9%)
    cgstAmount = Math.round((subTotal * cgstRate / 100) * 100) / 100;
    sgstAmount = Math.round((subTotal * sgstRate / 100) * 100) / 100;
    gstTotal = cgstAmount + sgstAmount;
  }
  
  grandTotal = subTotal + gstTotal;

  // Double Check Bank detail fields from plain line scanning
  if (!bankAccountNo || !bankIfscCode) {
    for (const line of lines) {
      if (line.includes("SBIN") && !bankIfscCode) {
        const ifscMatch = line.match(/[A-Z]{4}0\d{6}/);
        if (ifscMatch) bankIfscCode = ifscMatch[0];
      }
      if (line.includes("Account No") || line.includes("A/C")) {
        const numMatch = line.match(/\d{9,18}/);
        if (numMatch && !bankAccountNo) bankAccountNo = numMatch[0];
      }
    }
  }

  return {
    billNumber,
    billDate,
    poNumber,
    poDate,
    consigneeDetails: {
      companyName: "DARSHAN ENTERPRISES",
      address: "A-29, Radhekrishna Residency Kapodara Patia, Valia Road GIDC, Ankleshwar 393002, Dist- Bharuch (Gujarat)",
      gstin: "24BCVPP7836H1ZW"
    },
    billedTo: {
      clientName,
      clientAddress,
      clientGstin
    },
    jobDescription,
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
    status: "draft"
  };
}

/**
 * Excel Parser mapping rows into raw text segments for structured scanning
 */
export function parseExcelData(jsonData: any[][]): Partial<TaxInvoice> {
  // Convert spreadsheet rows into a uniform flat text space
  const textSpace = jsonData
    .map(row => row.filter(cell => cell !== null && cell !== undefined).join(" "))
    .join("\n");
  
  return parseInvoiceText(textSpace);
}
