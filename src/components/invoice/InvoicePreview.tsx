"use client";

import React from "react";
import { TaxInvoice, AdminSettings } from "../../types";
import { formatCurrency, formatDate } from "../../lib/utils";
import { isNaOrEmptyGSTIN } from "../../utils/gstValidation";

interface InvoicePreviewProps {
  invoice: TaxInvoice;
  settings: AdminSettings;
  id?: string;
}

const renderFormattedDescription = (text: string) => {
  if (!text) return "";
  const formatted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;\/b&gt;/g, "</b>")
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;\/strong&gt;/g, "</strong>")
    .replace(/\n/g, "<br />");
  return <div dangerouslySetInnerHTML={{ __html: formatted }} style={{ textAlign: "left" }} />;
};

export const InvoicePreview = React.forwardRef<HTMLDivElement, InvoicePreviewProps>(
  ({ invoice, settings, id = "invoice-pdf-container" }, ref) => {
    const { 
      billNumber, 
      billDate, 
      poNumber, 
      poDate, 
      consigneeDetails, 
      billedTo, 
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
      rupeesInWords 
    } = invoice;

    return (
      <div 
        ref={ref}
        id={id}
        className="mx-auto relative select-none"
        style={{
          width: "794px",
          minHeight: "1123px",
          backgroundColor: "#ffffff",
          color: "#000000",
          boxSizing: "border-box",
          padding: "45px 35px 35px 35px",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "13px",
          lineHeight: "1.3"
        }}
      >
        {/* Header Section */}
        <div 
          className="w-full mb-4"
          style={{ visibility: !invoice.letterheadMode ? "visible" : "hidden" }}
        >
          {settings.headerImage ? (
            <img 
              src={settings.headerImage} 
              alt="Header Logo" 
              className="w-full h-auto object-contain max-h-[105px]"
            />
          ) : (
            // Default gorgeous HTML-rendered Header matching the sample exactly
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* D Logo Image */}
                <img
                  src="/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg"
                  alt="D Logo"
                  style={{ width: "55px", height: "55px", objectFit: "contain", borderRadius: "4px" }}
                />
                {/* Title and Slogan */}
                <div>
                  <h1 style={{ fontSize: "34px", lineHeight: "1", fontWeight: "900", fontFamily: "Arial Black, Helvetica, sans-serif", margin: "0" }}>
                    <span style={{ color: "#E55A22" }}>DARSHAN</span>{" "}
                    <span style={{ color: "#09357B" }}>ENTER</span>
                    <span style={{ color: "#E55A22" }}>PRISES</span>
                  </h1>
                  <p style={{ fontSize: "9.5px", color: "#09357B", fontWeight: "bold", margin: "4px 0 0 0", letterSpacing: "-0.2px", lineHeight: "1.1" }}>
                    All Kinds of Industrial & Decorative Painting, Sand & Shot Blasting & All Types of Labour Job Works.
                  </p>
                </div>
              </div>
              
              {/* ISO Stamp */}
              <div 
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #09357B",
                  color: "#09357B",
                  padding: "4px",
                  borderRadius: "50%",
                  textAlign: "center",
                  width: "55px",
                  height: "55px",
                  fontSize: "6.5px",
                  fontWeight: "bold",
                  lineHeight: "1.1",
                  marginLeft: "auto"
                }}
              >
                <span style={{ fontSize: "8px", borderBottom: "1px solid #09357B", paddingBottom: "1px", marginBottom: "1px" }}>ISO</span>
                <span>9001:2015</span>
                <span>COMPANY</span>
              </div>
            </div>
          )}
        </div>

        {/* Double-bordered Grid Panel */}
        <div style={{ border: "1px solid #000000", width: "100%" }}>
          {/* Title row */}
          <div 
            style={{ 
              textAlign: "center", 
              fontWeight: "bold", 
              fontSize: "14px", 
              padding: "6px 0", 
              borderBottom: "1px solid #000000",
              backgroundColor: "#ffffff",
              textTransform: "uppercase",
              letterSpacing: "1px"
            }}
          >
            Tax Invoice
          </div>

          {/* Consignee vs Bill Info Table Split */}
          <table style={{ width: "100%", borderCollapse: "collapse", borderBottom: "1px solid #000000", tableLayout: "fixed" }}>
            <tbody>
              <tr>
                {/* Left Column: Consignee Details spans all 4 rows */}
                <td rowSpan={4} style={{ width: "60%", padding: "8px", borderRight: "1px solid #000000", fontSize: "12.5px", verticalAlign: "top", textAlign: "left" }}>
                  <div>
                    <span style={{ fontWeight: "normal", color: "#4b5563" }}>Detail of Consignee : </span>
                    <span style={{ fontWeight: "bold" }}>{consigneeDetails.companyName || settings.signatureName || "DARSHAN ENTERPRISES"}</span>
                  </div>
                  <div style={{ whiteSpace: "pre-line", marginTop: "4px", lineHeight: "1.4" }}>
                    {consigneeDetails.address || settings.companyDetails}
                  </div>
                  {!isNaOrEmptyGSTIN(consigneeDetails.gstin) ? (
                    <div style={{ fontWeight: "bold", marginTop: "6px" }}>
                      GSTIN : {consigneeDetails.gstin}
                    </div>
                  ) : !isNaOrEmptyGSTIN(settings.gstNumber) ? (
                    <div style={{ fontWeight: "bold", marginTop: "6px" }}>
                      GSTIN : {settings.gstNumber}
                    </div>
                  ) : null}
                </td>

                {/* Row 1: Bill No */}
                <td style={{ width: "16%", padding: "6px 8px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", fontWeight: "bold", textAlign: "left", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle", lineHeight: "1.2" }}>Bill No :</span>
                </td>
                <td style={{ width: "24%", padding: "6px 8px", borderBottom: "1px solid #000000", textAlign: "left", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle", lineHeight: "1.2" }}>{billNumber || "DE- 10"}</span>
                </td>
              </tr>
              <tr>
                {/* Row 2: Date */}
                <td style={{ padding: "6px 8px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", fontWeight: "bold", textAlign: "left", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle", lineHeight: "1.2" }}>Date :</span>
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #000000", textAlign: "left", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle", lineHeight: "1.2" }}>{billDate ? formatDate(billDate) : "20-05-2026"}</span>
                </td>
              </tr>
              <tr>
                {/* Row 3: P.O.No */}
                <td style={{ padding: "6px 8px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", fontWeight: "bold", textAlign: "left", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle", lineHeight: "1.2" }}>P.O.No :</span>
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #000000", textAlign: "left", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle", lineHeight: "1.2" }}>{poNumber || "on Phone"}</span>
                </td>
              </tr>
              <tr>
                {/* Row 4: P.O.Date */}
                <td style={{ padding: "6px 8px", borderRight: "1px solid #000000", fontWeight: "bold", textAlign: "left", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle", lineHeight: "1.2" }}>P.O.Date :</span>
                </td>
                <td style={{ padding: "6px 8px", textAlign: "left", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle", lineHeight: "1.2" }}>{poDate ? formatDate(poDate) : "18-05-2026"}</span>
                </td>
              </tr>
            </tbody>
          </table>


          {/* BILLED TO section */}
          <div style={{ padding: "8px", borderBottom: "1px solid #000000", fontSize: "12.5px" }}>
            <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "11px", color: "#4b5563", letterSpacing: "0.5px" }}>BILLED TO,</div>
            <div style={{ fontWeight: "bold", fontSize: "14px", marginTop: "3px" }}>{billedTo.clientName || "[Client Company Name]"}</div>
            <div style={{ whiteSpace: "pre-line", marginTop: "4px", lineHeight: "1.4", minHeight: "36px" }}>
              {billedTo.clientAddress || "[Client Address details]"}
            </div>
            {!isNaOrEmptyGSTIN(billedTo.clientGstin) && (
              <div style={{ fontWeight: "bold", marginTop: "6px" }}>
                GSTIN : <span style={{ fontFamily: "monospace" }}>{billedTo.clientGstin}</span>
              </div>
            )}
          </div>

          {/* Job section */}
          <div style={{ padding: "8px", borderBottom: "1px solid #000000", fontWeight: "bold", fontSize: "13px" }}>
            Job :- {jobDescription || "Painting Work (Anupam Rasayan unit -4Jhagadia )"}
          </div>

          {/* Product Items Table grid */}
          <table 
            style={{ 
              width: "100%", 
              borderCollapse: "collapse", 
              borderBottom: "1px solid #000000",
              fontSize: "12.5px"
            }}
          >
            <thead>
              <tr style={{ fontWeight: "bold" }}>
                <th style={{ width: "45px", padding: "6px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Sr. No</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Description</th>
                <th style={{ width: "90px", padding: "6px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>HSN/SAC</th>
                <th style={{ width: "55px", padding: "6px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Qty</th>
                <th style={{ width: "55px", padding: "6px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Unit</th>
                <th style={{ width: "90px", padding: "6px 8px", textAlign: "right", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Rate</th>
                <th style={{ width: "100px", padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #000000" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const borderBottomStyle = index === items.length - 1 ? "none" : "1px solid #e5e7eb";
                return (
                  <tr key={item.id || index}>
                    <td style={{ padding: "8px 6px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: borderBottomStyle, verticalAlign: "middle" }}>
                      <span style={{ display: "inline-block", verticalAlign: "middle" }}>{index + 1}</span>
                    </td>
                    <td style={{ padding: "8px", borderRight: "1px solid #000000", borderBottom: borderBottomStyle, verticalAlign: "middle", whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
                      {renderFormattedDescription(item.description)}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: borderBottomStyle, verticalAlign: "middle", fontFamily: "monospace" }}>
                      <span style={{ display: "inline-block", verticalAlign: "middle" }}>{item.hsnSac || "995473"}</span>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: borderBottomStyle, verticalAlign: "middle" }}>
                      <span style={{ display: "inline-block", verticalAlign: "middle" }}>{Number(item.qty || 0).toFixed(2)}</span>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: borderBottomStyle, verticalAlign: "middle" }}>
                      <span style={{ display: "inline-block", verticalAlign: "middle" }}>{item.unit}</span>
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", borderRight: "1px solid #000000", borderBottom: borderBottomStyle, verticalAlign: "middle", fontFamily: "monospace" }}>
                      <span style={{ display: "inline-block", verticalAlign: "middle" }}>{formatCurrency(item.rate)}</span>
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", borderBottom: borderBottomStyle, verticalAlign: "middle", fontFamily: "monospace", fontWeight: "bold" }}>
                      <span style={{ display: "inline-block", verticalAlign: "middle" }}>{formatCurrency(item.amount)}</span>
                    </td>
                  </tr>
                );
              })}



              {/* Row Total line */}
              <tr style={{ fontWeight: "bold", backgroundColor: "#ffffff" }}>
                <td colSpan={6} style={{ padding: "8px", textAlign: "right", borderRight: "1px solid #000000", borderTop: "1px solid #000000" }}>Total =</td>
                <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", fontSize: "13px", borderTop: "1px solid #000000" }}>{formatCurrency(subTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Bottom Table Split: Bank details (Left) vs GST Summary allocations (Right) */}
          {invoice.gstEnabled !== false && (
            <table style={{ width: "100%", borderCollapse: "collapse", borderBottom: "1px solid #000000", tableLayout: "fixed" }}>
              <tbody>
                <tr>
                  {/* Left Bank detail cell */}
                  <td style={{ width: "55%", padding: "8px 12px", borderRight: "1px solid #000000", fontSize: "12px", verticalAlign: "middle", textAlign: "left" }}>
                    <div style={{ marginBottom: "5px" }}>
                      <span style={{ fontWeight: "bold", color: "#4b5563" }}>BANK Name : </span>
                      <span style={{ fontWeight: "bold" }}>{settings.bankName || "State Bank of India"}</span>
                    </div>
                    <div style={{ marginBottom: "5px" }}>
                      <span style={{ fontWeight: "bold", color: "#4b5563" }}>Account No : </span>
                      <span style={{ fontWeight: "bold", fontFamily: "monospace" }}>{settings.bankAccountNo || "42085596249"}</span>
                    </div>
                    <div>
                      <span style={{ fontWeight: "bold", color: "#4b5563" }}>IFSC Code : </span>
                      <span style={{ fontWeight: "bold", fontFamily: "monospace" }}>{settings.bankIfscCode || "SBIN0017314"}</span>
                    </div>
                  </td>

                  {/* Right GST Summary allocations */}
                  <td style={{ width: "45%", padding: 0, verticalAlign: "middle" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                      <tbody>
                        {/* CGST */}
                        {cgstRate > 0 && (
                          <tr>
                            <td style={{ width: "60%", padding: "5px 8px", color: "#4b5563", fontSize: "12.5px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Add:- GST CGST {cgstRate}%</td>
                            <td style={{ width: "40%", padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: "12.5px", borderBottom: "1px solid #e5e7eb" }}>{formatCurrency(cgstAmount)}</td>
                          </tr>
                        )}
                        {/* SGST */}
                        {sgstRate > 0 && (
                          <tr>
                            <td style={{ width: "60%", padding: "5px 8px", color: "#4b5563", fontSize: "12.5px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>SGST {sgstRate}%</td>
                            <td style={{ width: "40%", padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: "12.5px", borderBottom: "1px solid #e5e7eb" }}>{formatCurrency(sgstAmount)}</td>
                          </tr>
                        )}
                        {/* IGST */}
                        {igstRate > 0 && (
                          <tr>
                            <td style={{ width: "60%", padding: "5px 8px", color: "#4b5563", fontSize: "12.5px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Add:- GST IGST {igstRate}%</td>
                            <td style={{ width: "40%", padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: "12.5px", borderBottom: "1px solid #e5e7eb" }}>{formatCurrency(igstAmount)}</td>
                          </tr>
                        )}
                        {/* GST Total row */}
                        <tr style={{ backgroundColor: "#f9f9f9", fontWeight: "bold" }}>
                          <td style={{ width: "60%", padding: "6px 8px", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px", textAlign: "left" }}>GST TOTAL =</td>
                          <td style={{ width: "40%", padding: "6px 8px", textAlign: "right", fontFamily: "monospace", fontSize: "12.5px" }}>{formatCurrency(gstTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          )}


          {/* Rupees in Words + Grand Total block */}
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "12.5px" }}>
            <tbody>
              <tr>
                {/* Words */}
                <td style={{ width: "75%", padding: "8px 12px", borderRight: "1px solid #000000", fontWeight: "bold", textAlign: "left", verticalAlign: "middle" }}>
                  RUPEES :- <span style={{ fontWeight: "normal", fontSize: "12px", fontStyle: "italic", marginLeft: "4px" }}>{rupeesInWords}</span>
                </td>
                {/* Grand Total */}
                <td style={{ width: "25%", padding: "8px", textAlign: "right", fontFamily: "monospace", fontSize: "14px", fontWeight: "900", verticalAlign: "middle" }}>
                  {formatCurrency(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>

        </div>

        {/* Terms & Conditions Section */}
        <div style={{ width: "100%", marginTop: "16px", fontSize: "12px", lineHeight: "1.4", color: "#262626" }}>
          <p style={{ fontWeight: "bold", color: "#000000", fontSize: "12.5px", margin: "0 0 4px 0" }}>Term's & Condition :-</p>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "none", fontSize: "12px", lineHeight: "1.4", color: "#262626" }}>
            <tbody>
              {invoice.customTerms && invoice.customTerms.length > 0 ? (
                invoice.customTerms.map((term, index) => (
                  <tr key={index}>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>
                      {index + 1}.
                    </td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>
                      {term}
                    </td>
                  </tr>
                ))
              ) : settings.terms && settings.terms.length > 0 ? (
                settings.terms.map((term, index) => (
                  <tr key={index}>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>
                      {index + 1}.
                    </td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>
                      {term}
                    </td>
                  </tr>
                ))
              ) : (
                <>
                  <tr>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>1.</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>Subject to Ankleshwar Jurisdiction.</td>
                  </tr>
                  <tr>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>2.</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>Payment Work Complete.</td>
                  </tr>
                  <tr>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>3.</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>PAN NO: BCVPP7836H.</td>
                  </tr>
                  <tr>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>4.</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>GST 18% Extra.</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Signature Area */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "end", marginTop: "16px", marginBottom: "40px", fontSize: "13px" }}>
          <p style={{ fontWeight: "bold", color: "#000000", margin: "0 0 4px 0" }}>For, {settings.signatureName || consigneeDetails.companyName || "DARSHAN ENTERPRISES"},</p>
          
          {/* Signature scribble */}
          <div style={{ height: "55px", display: "flex", alignItems: "center", justifyContent: "end", position: "relative", paddingRight: "16px", minWidth: "160px", visibility: !invoice.letterheadMode ? "visible" : "hidden" }}>
            {settings.signatureImage ? (
              <img 
                src={settings.signatureImage} 
                alt="Signature Scribble" 
                style={{ height: "100%", objectFit: "contain", maxWidth: "140px" }}
              />
            ) : (
              // Pristine vector scribble fallback for Mata Prasad Prajapati
              <svg style={{ width: "120px", height: "45px", color: "#1e40af" }} viewBox="0 0 120 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 25C25 10 35 30 50 15C60 5 70 35 85 10C95 -5 105 20 115 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M30 35C45 32 60 28 80 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
              </svg>
            )}
          </div>
          
          <p style={{ fontWeight: "bold", color: "#52525b", margin: "4px 0 0 0", fontSize: "12px" }}>(Authorised Signatory)</p>
        </div>

        {/* Brand footer details (Optional margin line) */}
        <div 
          style={{ 
            position: "absolute", 
            bottom: "35px", 
            left: "35px", 
            right: "35px", 
            borderTop: "1.5px solid #09357B", 
            paddingTop: "6px", 
            textAlign: "center",
            fontSize: "9.5px",
            color: "#09357B",
            fontWeight: "bold",
            lineHeight: "1.2",
            visibility: !invoice.letterheadMode ? "visible" : "hidden"
          }}
        >
          {settings.footerImage ? (
            <img 
              src={settings.footerImage} 
              alt="Footer Address graphic" 
              className="w-full h-auto object-contain max-h-[40px] mt-[-6px]"
            />
          ) : (
            <>
              <div>A-29, Radhe Krishna Recidency, Nr. Kapodra Patiya, Valiya Road, G.I.D.C., Ankleshwar, Dist. Bharuch Gujarat - 393001</div>
              <div style={{ color: "#E55A22", marginTop: "2px" }}>Mob: 99980 16708, E-Mail: chehardarshan@gmail.com</div>
            </>
          )}
        </div>
      </div>
    );
  }
);

InvoicePreview.displayName = "InvoicePreview";
export default InvoicePreview;
