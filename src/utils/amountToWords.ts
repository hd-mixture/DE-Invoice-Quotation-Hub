/**
 * Converts a numeric amount into standard Indian English words format.
 * Matches Indian numbering system (Crores, Lakhs, Thousands, Hundreds).
 * 
 * Example: 17700.00 -> "Seventeen Thousand Seven Hundred Rupees and Zero Paisa Only."
 */
export function convertAmountToWords(amount: number): string {
  if (amount === 0) return "Zero Rupees Only";
  
  const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const doubleDigits = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tensDigits = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function convertUnderThousand(num: number): string {
    let str = "";
    if (num >= 100) {
      str += singleDigits[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 10 && num < 20) {
      str += doubleDigits[num - 10] + " ";
    } else if (num >= 20) {
      str += tensDigits[Math.floor(num / 10)] + " ";
      if (num % 10 > 0) {
        str += singleDigits[num % 10] + " ";
      }
    } else if (num > 0) {
      str += singleDigits[num] + " ";
    }
    return str;
  }

  // Round to 2 decimal places to prevent float precision issues
  const fixedVal = amount.toFixed(2);
  const parts = fixedVal.split(".");
  const integerVal = parseInt(parts[0], 10);
  const decimalVal = parseInt(parts[1], 10);
  
  let result = "";
  let remaining = integerVal;
  
  // 1. Crores (1,00,00,000)
  if (remaining >= 10000000) {
    const crores = Math.floor(remaining / 10000000);
    result += convertUnderThousand(crores) + "Crore ";
    remaining %= 10000000;
  }
  
  // 2. Lakhs (1,00,000)
  if (remaining >= 100000) {
    const lakhs = Math.floor(remaining / 100000);
    result += convertUnderThousand(lakhs) + "Lakh ";
    remaining %= 100000;
  }
  
  // 3. Thousands (1,000)
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    result += convertUnderThousand(thousands) + "Thousand ";
    remaining %= 1000;
  }
  
  // 4. Hundreds, Tens, Units
  if (remaining > 0) {
    result += convertUnderThousand(remaining);
  }
  
  // Format clean words
  let formattedIntegerWords = result.trim();
  if (formattedIntegerWords === "") {
    formattedIntegerWords = "Zero";
  }
  
  let formattedPaisaWords = "";
  if (decimalVal > 0) {
    formattedPaisaWords = convertUnderThousand(decimalVal).trim() + " Paisa";
  } else {
    formattedPaisaWords = "Zero Paisa";
  }
  
  return `${formattedIntegerWords} Rupees and ${formattedPaisaWords} Only.`;
}
