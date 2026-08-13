import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API Key is not configured on the server." }, { status: 500 });
    }

    const { base64Image, mimeType } = await request.json();

    if (!base64Image) {
      return NextResponse.json({ error: "Missing base64Image" }, { status: 400 });
    }

    const systemPrompt = `You are an advanced commercial document & handwriting OCR AI analyzer. Analyze the provided image to extract quotation, tax invoice, billing slip, estimate, or handwritten paper note details.

The input image MAY be:
- A printed commercial tax invoice or quotation PDF/image.
- A HANDWRITTEN paper note, pen-written slip, rough estimate, notebook memo, or handwritten invoice/bill.

Return ONLY a valid JSON object matching this structure:

{
  "isInvoiceOrQuotationDoc": true,
  "unrecognizedReason": "",
  "billedTo": {
    "clientName": "",
    "clientAddress": "",
    "clientGstin": ""
  },
  "billNumber": "",
  "billDate": "YYYY-MM-DD",
  "poNumber": "",
  "poDate": "YYYY-MM-DD",
  "jobDescription": "",
  "items": [
    {
      "description": "",
      "hsnSac": "",
      "qty": 1,
      "unit": "Nos",
      "rate": 0,
      "amount": 0
    }
  ]
}

CRITICAL OCR & HANDWRITING EXTRACTION RULES:
1. "isInvoiceOrQuotationDoc": Set to TRUE if the image contains commercial billing details, whether printed OR HANDWRITTEN (handwritten paper slips, pen notes e.g., "To, Mr. Saurabh", handwritten item tables, rough receipts, or handwritten estimates). Set to FALSE ONLY if it is a random personal selfie, landscape, animal, wallpaper, or non-billing photo.
2. "unrecognizedReason": If isInvoiceOrQuotationDoc is false, state why (e.g. "The image is a landscape photo rather than a billing document.").
3. HANDWRITING ACCURACY:
   - Carefully decipher handwritten text, cursive handwriting, rough pen writing, and handwritten table grids.
   - Extract recipient names written after "To,", "To", "Mr.", "M/s", etc. (e.g., "To, Mr. Saurabh" -> "Mr. Saurabh").
   - Extract handwritten dates (e.g., "Date 10/10/2050" -> "2050-10-10", "10-10-2050" -> "2050-10-10").
   - Read handwritten item tables column by column (Sr. No., Description, Qty, Unit, Rate, Amount).
   - Sanitize all numbers: convert handwritten numbers into clean numeric values (e.g. "2" -> 2, "100" -> 100, "200" -> 200).
4. Do not wrap the JSON in markdown code blocks. Just return raw JSON.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and extract invoice/quotation details if valid, including any handwritten notes or handwritten item tables." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI API error:", err);
      return NextResponse.json({ error: `OpenAI API Error: ${err}` }, { status: response.status });
    }

    const result = await response.json();
    let invoiceData;
    
    try {
      invoiceData = JSON.parse(result.choices[0].message.content);

      // 1. Check if AI classified image as non-document/random photo
      if (invoiceData.isInvoiceOrQuotationDoc === false) {
        const reason = invoiceData.unrecognizedReason || "The uploaded image does not appear to be a commercial invoice or quotation document.";
        return NextResponse.json({ 
          error: `Unrecognized Document Content: ${reason}` 
        }, { status: 422 });
      }
      
      // 2. Ensure we add valid IDs and calculate missing fields if items exist
      if (invoiceData.items && Array.isArray(invoiceData.items)) {
        invoiceData.items = invoiceData.items
          .filter((item: any) => item.description || item.amount > 0 || item.qty > 0 || item.rate > 0)
          .map((item: any, index: number) => {
            const parsedQty = typeof item.qty === 'number' ? item.qty : (parseFloat(String(item.qty || '1').replace(/[^0-9.]/g, '')) || 1);
            const parsedRate = typeof item.rate === 'number' ? item.rate : (parseFloat(String(item.rate || '0').replace(/[^0-9.]/g, '')) || 0);
            let parsedAmount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || '0').replace(/[^0-9.]/g, ''));

            if (isNaN(parsedAmount) || parsedAmount === 0) {
              parsedAmount = parsedQty * parsedRate;
            }

            return {
              id: crypto.randomUUID(),
              srNo: index + 1,
              description: String(item.description || '').trim(),
              hsnSac: String(item.hsnSac || '').trim(),
              unit: String(item.unit || 'Nos').trim(),
              qty: parsedQty,
              rate: parsedRate,
              amount: parsedAmount
            };
          });
      }

      const hasValidItems = Array.isArray(invoiceData.items) && invoiceData.items.length > 0;
      const hasHeaderMeta = Boolean(invoiceData.billNumber || invoiceData.billedTo?.clientName);

      if (!hasValidItems && !hasHeaderMeta) {
        return NextResponse.json({ 
          error: "Unrecognized Document Content: No quotation/invoice data or line items could be extracted from this file. Please upload a clear photo or scan of a commercial invoice." 
        }, { status: 422 });
      }

      invoiceData.isImported = true;
      invoiceData.invoiceType = "imported";
      invoiceData.importSource = mimeType === "application/pdf" ? "pdf" : "jpeg";

    } catch (parseError) {
      console.error("Error parsing OpenAI response:", result.choices[0].message.content);
      return NextResponse.json({ error: "Failed to parse AI document analysis response." }, { status: 500 });
    }

    return NextResponse.json({ invoiceData });
  } catch (error: any) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
