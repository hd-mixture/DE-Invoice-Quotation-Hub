// Self-contained className merger (lightweight alternative to clsx + tailwind-merge)
export function cn(...classes: any[]): string {
  const result: string[] = [];
  
  for (const c of classes) {
    if (!c) continue;
    if (typeof c === "string") {
      result.push(c);
    } else if (Array.isArray(c)) {
      result.push(cn(...c));
    } else if (typeof c === "object") {
      for (const key in c) {
        if (c[key]) {
          result.push(key);
        }
      }
    }
  }
  
  return result.join(" ");
}

// Currency formatter matching the Indian numbering system / Standard commas (e.g. 1,100.00 or 1,00,000.00)
export function formatCurrency(amount: any): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(num) || num === null || num === undefined) return "0.00";
  
  // Format with standard locale formatting or custom decimals
  const parts = num.toFixed(2).split(".");
  let lastThree = parts[0].slice(-3);
  const otherParts = parts[0].slice(0, -3);
  
  if (otherParts !== "") {
    lastThree = "," + lastThree;
  }
  
  const formattedInteger = otherParts.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `${formattedInteger}.${parts[1]}`;
}

// Robust date parser for YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, ISO strings, etc.
export function parseDateStringToYearMonthDay(dateStr: string | undefined | null): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().split("T")[0];

  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m, day: d };
      } else if (parts[2].length === 4) {
        const y = parseInt(parts[2], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[0], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m, day: d };
      }
    }
  }

  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m, day: d };
      } else if (parts[2].length === 4) {
        const y = parseInt(parts[2], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[0], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m, day: d };
      }
    }
  }

  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
  }

  return null;
}

// Standard date formatter (returns DD-MM-YYYY)
export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const parsed = parseDateStringToYearMonthDay(dateString);
  if (parsed) {
    const day = String(parsed.day).padStart(2, "0");
    const month = String(parsed.month + 1).padStart(2, "0");
    return `${day}-${month}-${parsed.year}`;
  }
  return dateString;
}
