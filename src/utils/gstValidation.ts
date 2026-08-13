export interface GSTINValidationResult {
  isValid: boolean;
  gstin: string;
  pan: string | null;
  stateCode: string | null;
  stateName: string | null;
  errorMsg: string | null;
}

const STATE_MAPPINGS: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh"
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const isNaOrEmptyGSTIN = (val?: string | null): boolean => {
  if (!val) return true;
  const clean = val.trim().toUpperCase().replace(/[\s\.\-\/]/g, '');
  return ["", "NA", "NONE", "URP", "NOTAPPLICABLE", "NIL", "NULL"].includes(clean);
};

export const validateGSTIN = (input: string): GSTINValidationResult => {
  const rawInput = input.trim();

  if (isNaOrEmptyGSTIN(rawInput)) {
    return {
      isValid: true,
      gstin: "",
      pan: null,
      stateCode: null,
      stateName: null,
      errorMsg: null
    };
  }

  const gstin = rawInput.toUpperCase().replace(/\s+/g, '');

  if (gstin.length !== 15) {
    return {
      isValid: false,
      gstin,
      pan: null,
      stateCode: null,
      stateName: null,
      errorMsg: "GSTIN must be exactly 15 characters"
    };
  }

  if (!GSTIN_REGEX.test(gstin)) {
    return {
      isValid: false,
      gstin,
      pan: null,
      stateCode: null,
      stateName: null,
      errorMsg: "Invalid GSTIN format structure"
    };
  }

  const stateCode = gstin.substring(0, 2);
  const pan = gstin.substring(2, 12);
  const stateName = STATE_MAPPINGS[stateCode] || null;

  if (!stateName) {
    return {
      isValid: false,
      gstin,
      pan: null,
      stateCode: null,
      stateName: null,
      errorMsg: "Invalid State Code in GSTIN"
    };
  }

  if (!PAN_REGEX.test(pan)) {
    return {
      isValid: false,
      gstin,
      pan: null,
      stateCode: null,
      stateName: null,
      errorMsg: "Invalid PAN Structure in GSTIN"
    };
  }

  return {
    isValid: true,
    gstin,
    pan,
    stateCode,
    stateName,
    errorMsg: null
  };
};

export const formatGSTINInput = (input: string): string => {
  const clean = input.trim().toUpperCase();
  if (isNaOrEmptyGSTIN(clean)) {
    return clean;
  }
  return clean.replace(/[^A-Z0-9]/g, '').substring(0, 15);
};
