"use client";

import React from "react";
import { Quotation, AdminSettings } from "../../types";
import { formatCurrency, formatDate } from "../../lib/utils";

interface QuotationPreviewProps {
  quotation: Quotation;
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

export const QuotationPreview = React.forwardRef<HTMLDivElement, QuotationPreviewProps>(
  ({ quotation, settings, id = "quotation-pdf-container" }, ref) => {
    const { clientDetails, items, subTotal, gstRate, gstAmount, grandTotal, date } = quotation;

    return (
      <div 
        ref={ref}
        id={id}
        className="mx-auto relative"
        style={{
          width: "794px",
          minHeight: "1123px",
          backgroundColor: "#ffffff",
          color: "#000000",
          boxSizing: "border-box",
          padding: "45px 35px 35px 35px",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "14px",
          lineHeight: "1.4"
        }}
      >
        {/* Header Section */}
        <div 
          className="w-full mb-6 pb-2"
          style={{ borderBottom: "none", visibility: !quotation.letterheadMode ? "visible" : "hidden" }}
        >
          {settings.headerImage ? (
            <img 
              src={settings.headerImage} 
              alt="Header Logo" 
              className="w-full h-auto object-contain max-h-[110px]"
            />
          ) : (
            // Default gorgeous HTML-rendered Header matching the sample exactly
            <div style={{ display: "flex", alignItems: "center", justifyContent: "between" }}>
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

        {/* Recipient Details & Metadata Section */}
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: "16px", marginBottom: "16px" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: "bold", color: "#000000", margin: "0 0 4px 0" }}>To,</p>
            <div style={{ paddingLeft: "16px", fontWeight: "bold", color: "#000000", minHeight: "65px" }}>
              <p style={{ fontWeight: "bold", fontSize: "15px", margin: "0 0 2px 0" }}>{clientDetails.companyName || "[Company Name]"}</p>
              {clientDetails.address ? (
                <p style={{ whiteSpace: "pre-line", fontSize: "13.5px", fontWeight: "normal", lineHeight: "1.5", color: "#262626", margin: "0" }}>
                  {clientDetails.address}
                </p>
              ) : (
                <p style={{ color: "#a3a3a3", fontWeight: "normal", margin: "0" }}>[Address]</p>
              )}
              <p style={{ fontSize: "13.5px", fontWeight: "bold", color: "#262626", margin: "2px 0 0 0" }}>
                {clientDetails.districtState || "[District/State]"}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right", color: "#000000", fontWeight: "bold", fontSize: "13.5px", minWidth: "180px" }}>
            <p style={{ margin: "0" }}>Date: <span style={{ fontWeight: "normal" }}>{formatDate(date)}</span></p>
          </div>
        </div>

        {/* Attention & Subject */}
        <div style={{ width: "100%", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13.5px" }}>
          <div>
            <span style={{ fontWeight: "bold", color: "#000000" }}>Kind Attention:-</span>{" "}
            <span style={{ color: "#262626" }}>{clientDetails.kindAttention || "Mr TC Parmar"}</span>
          </div>
          <div>
            <span style={{ fontWeight: "bold", color: "#000000" }}>Sub:-</span>{" "}
            <span style={{ fontWeight: "600", color: "#171717" }}>
              {clientDetails.subject || "Question for man Power Supply"}
            </span>
          </div>
        </div>

        {/* Salutation */}
        <p style={{ fontWeight: "bold", fontSize: "13.5px", marginBottom: "16px", color: "#000000", marginTop: "0" }}>{clientDetails.dearSirText || "Dear Sir,"}</p>

        {/* Quotation Table */}
        <table 
          style={{ 
            width: "100%",
            textAlign: "left",
            borderCollapse: "collapse",
            marginBottom: "24px",
            border: "1px solid #000000",
            fontSize: "13px",
            color: "#000000"
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6" }}>
              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: "bold", width: "60px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Sr. No.</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: "bold", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Description</th>
              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: "bold", width: "65px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Qty</th>
              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: "bold", width: "65px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Unit</th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: "bold", width: "100px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>Rate</th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: "bold", width: "110px", borderBottom: "1px solid #000000" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || index}>
                <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: "500", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle" }}>{index + 1}</span>
                </td>
                <td style={{ padding: "8px 12px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
                  {renderFormattedDescription(item.description)}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle" }}>{item.qty}</span>
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center", color: "#262626", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle" }}>{item.unit}</span>
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle" }}>{formatCurrency(item.rate)}</span>
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", verticalAlign: "middle" }}>{formatCurrency(item.amount)}</span>
                </td>
              </tr>
            ))}

            {/* Total Row */}
            <tr style={{ fontWeight: "bold" }}>
              <td colSpan={5} style={{ padding: "8px 12px", textAlign: "right", fontWeight: "bold", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>
                Total
              </td>
              <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", backgroundColor: "#f9f9f9", borderBottom: "1px solid #000000" }}>
                {formatCurrency(subTotal)}
              </td>
            </tr>

            {/* GST Row (Optional) */}
            {gstRate > 0 && (
              <>
                <tr style={{ fontWeight: "500" }}>
                  <td colSpan={5} style={{ padding: "6px 12px", textAlign: "right", fontWeight: "600", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>
                    GST ({gstRate}%)
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", borderBottom: "1px solid #000000" }}>
                    {formatCurrency(gstAmount)}
                  </td>
                </tr>
                <tr style={{ fontWeight: "bold" }}>
                  <td colSpan={5} style={{ padding: "8px 12px", textAlign: "right", fontWeight: "bold", borderRight: "1px solid #000000", borderBottom: "1px solid #000000" }}>
                    Grand Total
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", backgroundColor: "#f5f5f5", borderBottom: "1px solid #000000" }}>
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* Terms & Conditions Section */}
        <div style={{ width: "100%", marginBottom: "32px", fontSize: "12px", lineHeight: "1.5", color: "#262626" }}>
          <p style={{ fontWeight: "bold", color: "#000000", fontSize: "13px", margin: "0 0 4px 0" }}>Term's & Condition :-</p>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "none", fontSize: "12px", lineHeight: "1.5", color: "#262626" }}>
            <tbody>
              {quotation.customTerms && quotation.customTerms.length > 0 ? (
                quotation.customTerms.map((term, index) => (
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
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>Subject to be Ankleshwar Juriduction.</td>
                  </tr>
                  <tr>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>2.</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>Payment monthly 5th date.</td>
                  </tr>
                  <tr>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>3.</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>Work started with in 4 days after receiving of work order.</td>
                  </tr>
                  <tr>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>4.</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>GST Extra 18% (24BCVPP7836H1ZW).</td>
                  </tr>
                  <tr>
                    <td style={{ width: "20px", fontWeight: "bold", verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>5.</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0", textAlign: "left" }}>Room Provide by khetan scope.</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Signature Area */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "end", marginTop: "32px", marginBottom: "64px", fontSize: "13.5px" }}>
          <p style={{ fontWeight: "bold", color: "#000000", margin: "0 0 6px 0" }}>For, {settings.signatureName || "DARSHAN ENTERPRISES"}</p>
          
          {/* Signature Image or default graphics */}
          <div style={{ height: "55px", display: "flex", alignItems: "center", justifyContent: "end", position: "relative", paddingRight: "16px", minWidth: "160px", visibility: !quotation.letterheadMode ? "visible" : "hidden" }}>
            {settings.signatureImage ? (
              <img 
                src={settings.signatureImage} 
                alt="Signature" 
                style={{ height: "100%", objectFit: "contain", maxWidth: "140px" }}
              />
            ) : (
              // Pristine vector scribble fallback for Mata Prasad Prajapati
              <svg style={{ width: "120px", height: "45px", color: "#1e40af" }} viewBox="0 0 120 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 5,30 C 15,28 35,15 45,18 C 55,20 40,38 35,35 C 30,32 50,10 65,12 C 80,14 70,35 78,32 C 85,30 90,15 98,16 C 105,17 95,28 110,25" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 12,24 C 20,24 25,28 32,27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 52,18 C 58,16 62,20 66,22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </div>

          <p style={{ fontWeight: "bold", color: "#000000", borderTop: "1px solid #d4d4d4", paddingTop: "4px", textAlign: "center", minWidth: "170px", margin: "0" }}>
            {settings.signatureName || "Authorised Signatory"}
          </p>
        </div>

        {/* Boxed Footer Address Box */}
        <div 
          style={{
            position: "absolute",
            bottom: "35px",
            left: "35px",
            right: "35px",
            border: "none",
            padding: "8px 12px",
            fontSize: "11.5px",
            textAlign: "center",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            color: "#000000",
            visibility: !quotation.letterheadMode ? "visible" : "hidden"
          }}
        >
          {settings.footerImage ? (
            <img 
              src={settings.footerImage} 
              alt="Footer text" 
              style={{ width: "100%", height: "auto", objectFit: "contain", maxHeight: "50px" }}
            />
          ) : (
            <>
              <p style={{ fontWeight: 600, color: "#000000", margin: "0 0 2px 0" }}>
                Add: {settings.companyDetails || "A-29, Radhey Krishna Recidency Nr. Glorious School, Valia Road GIDC Ankleshwar, Dist- Bharuch (Guj) 393001"}
              </p>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#262626", margin: "0" }}>
                Email- cheharmata@rediffmail.com (M) 9998016708
              </p>
            </>
          )}
        </div>
      </div>
    );
  }
);

QuotationPreview.displayName = "QuotationPreview";
export default QuotationPreview;
