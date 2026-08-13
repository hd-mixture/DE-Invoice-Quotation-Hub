export interface GstCalculationResult {
  subTotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
  grandTotal: number;
}

/**
 * Calculates dynamic GST allocations based on subtotal and percentages.
 * 
 * @param subTotal The sum of all item row amounts
 * @param cgstRate Percentage of CGST (e.g. 9 for 9%)
 * @param sgstRate Percentage of SGST (e.g. 9 for 9%)
 * @param igstRate Percentage of IGST (e.g. 18 for 18%)
 */
export function calculateGstBreakdown(
  subTotal: number,
  cgstRate: number,
  sgstRate: number,
  igstRate: number
): GstCalculationResult {
  const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
  
  const cgstAmount = cgstRate > 0 ? round((subTotal * cgstRate) / 100) : 0;
  const sgstAmount = sgstRate > 0 ? round((subTotal * sgstRate) / 100) : 0;
  const igstAmount = igstRate > 0 ? round((subTotal * igstRate) / 100) : 0;
  
  const gstTotal = round(cgstAmount + sgstAmount + igstAmount);
  const grandTotal = round(subTotal + gstTotal);
  
  return {
    subTotal: round(subTotal),
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstTotal,
    grandTotal
  };
}
