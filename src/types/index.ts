export interface QuotationItem {
  id: string;
  srNo: number;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface ClientDetails {
  companyName: string;
  address: string;
  districtState: string;
  kindAttention: string;
  subject: string;
  dearSirText: string;
}

export interface Quotation {
  id: string;
  number: string;
  date: string;
  clientDetails: ClientDetails;
  items: QuotationItem[];
  subTotal: number;
  gstRate: number; // e.g. 18 for 18%
  gstAmount: number;
  grandTotal: number;
  driveUrl?: string;
  driveFileId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  creatorEmail: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  folderId?: string;
  isPinned?: boolean;
  letterheadMode?: boolean;
  isAiGenerated?: boolean;
  customTerms?: string[];
}

export interface TaxInvoiceItem {
  id: string;
  srNo: number;
  description: string;
  hsnSac: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface TaxInvoice {
  id: string;
  billNumber: string;
  billDate: string;
  poNumber: string;
  poDate: string;
  consigneeDetails: {
    companyName: string;
    address: string;
    gstin: string;
  };
  billedTo: {
    clientName: string;
    clientAddress: string;
    clientGstin: string;
  };
  jobDescription: string;
  items: TaxInvoiceItem[];
  subTotal: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
  grandTotal: number;
  rupeesInWords: string;
  driveUrl?: string;
  driveFileId?: string;
  poAttachmentUrl?: string;
  poAttachmentName?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  creatorEmail: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  folderId?: string;
  isPinned?: boolean;
  letterheadMode?: boolean;
  gstEnabled?: boolean;
  customTerms?: string[];
  isImported?: boolean;
  invoiceType?: "manual" | "imported";
  importSource?: "pdf" | "excel" | "jpeg" | "jpg" | null;
  isDeleted?: boolean;
  isCancelled?: boolean;
  paymentStatus?: "paid" | "unpaid" | "overdue";
  isAiGenerated?: boolean;
}

export interface AdminSettings {
  headerImage: string; // Base64 or URL
  footerImage: string; // Base64 or URL
  signatureImage: string; // Base64 or URL
  terms: string[];
  companyDetails: string;
  gstNumber: string;
  signatureName: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfscCode?: string;
  invoiceNumberingFormat?: string;
}

export interface Folder {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  type?: 'quotation' | 'invoice';
}

export interface Customer {
  id?: string;
  companyName: string;
  address: string;
  districtState?: string;
  kindAttention?: string;
  dearSirText?: string;
  gstin?: string;
  createdBy: string;
  createdAt: string;
}



