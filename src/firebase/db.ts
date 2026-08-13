import { db } from "./config";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,
  serverTimestamp 
} from "firebase/firestore";
import { Quotation, AdminSettings, Folder, Customer } from "../types";

const QUOTATIONS_COLLECTION = "quotations";
const INVOICES_COLLECTION = "invoices";
const SETTINGS_COLLECTION = "admin";
const SETTINGS_DOCUMENT = "settings";
const CUSTOMERS_COLLECTION = "customers";

export const DEFAULT_SETTINGS: AdminSettings = {
  headerImage: "/Graphic Assets/header.png",
  footerImage: "/Graphic Assets/footer.png",
  signatureImage: "/Graphic Assets/DE_Signature.png",
  terms: [
    "Subject to Ankleshwar Jurisdiction.",
    "Payment Work Complete.",
    "PAN NO: BCVPP7836H.",
    "GST 18% Extra."
  ],
  companyDetails: "A-29, Radhekrishna Residency Kapodara Patia, Valia Road\nGIDC, Ankleshwar 393002, Dist- Bharuch (Gujarat)",
  gstNumber: "24BCVPP7836H1ZW",
  signatureName: "DARSHAN ENTERPRISES",
  bankName: "State Bank of India",
  bankAccountNo: "42085596249",
  bankIfscCode: "SBIN0017314",
  invoiceNumberingFormat: "DE-{number}"
};

// Helper to check if a user has customized their workspace settings from defaults
export function isSettingsCustomized(settings?: AdminSettings | null): boolean {
  if (!settings) return false;
  return (
    (settings.companyDetails !== DEFAULT_SETTINGS.companyDetails && Boolean(settings.companyDetails?.trim())) ||
    (settings.signatureName !== DEFAULT_SETTINGS.signatureName && Boolean(settings.signatureName?.trim())) ||
    (settings.gstNumber !== DEFAULT_SETTINGS.gstNumber && Boolean(settings.gstNumber?.trim())) ||
    (settings.bankAccountNo !== DEFAULT_SETTINGS.bankAccountNo && Boolean(settings.bankAccountNo?.trim())) ||
    (settings.headerImage !== DEFAULT_SETTINGS.headerImage && Boolean(settings.headerImage)) ||
    (settings.signatureImage !== DEFAULT_SETTINGS.signatureImage && Boolean(settings.signatureImage)) ||
    JSON.stringify(settings.terms) !== JSON.stringify(DEFAULT_SETTINGS.terms)
  );
}

// Fetch all quotations (optionally filtered by creator ID) ordered by creation date
export async function getQuotations(userId?: string): Promise<Quotation[]> {
  try {
    let q;
    if (userId) {
      q = query(collection(db, QUOTATIONS_COLLECTION), where("createdBy", "==", userId));
    } else {
      q = query(collection(db, QUOTATIONS_COLLECTION));
    }
    const querySnapshot = await getDocs(q);
    const quotations: Quotation[] = [];
    querySnapshot.forEach((doc) => {
      quotations.push({ ...doc.data(), id: doc.id } as Quotation);
    });
    // Sort in memory by createdAt descending
    return quotations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching quotations:", error);
    return [];
  }
}

// Fetch a single quotation by ID
export async function getQuotation(id: string): Promise<Quotation | null> {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...docSnap.data(), id: docSnap.id } as Quotation;
    }
    return null;
  } catch (error) {
    console.error("Error fetching quotation:", error);
    return null;
  }
}

// Create a new quotation
export async function createQuotation(quotation: Omit<Quotation, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, QUOTATIONS_COLLECTION), {
      ...quotation,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating quotation:", error);
    throw error;
  }
}

// Update an existing quotation
export async function updateQuotation(id: string, quotation: Partial<Quotation>): Promise<void> {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, id);
    await setDoc(docRef, quotation, { merge: true });
  } catch (error) {
    console.error("Error updating quotation:", error);
    throw error;
  }
}

// Delete a quotation
export async function deleteQuotation(id: string): Promise<void> {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting quotation:", error);
    throw error;
  }
}

// Fetch Admin Settings (User-specific settings mapping!)
export async function getAdminSettings(userId?: string): Promise<AdminSettings> {
  try {
    const documentId = userId || SETTINGS_DOCUMENT;
    const docRef = doc(db, SETTINGS_COLLECTION, documentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = { ...DEFAULT_SETTINGS, ...docSnap.data() } as AdminSettings;
      if (typeof window !== "undefined" && userId) {
        localStorage.setItem(`user_settings_${userId}`, JSON.stringify(data));
      }
      return data;
    }
    if (typeof window !== "undefined" && userId) {
      const local = localStorage.getItem(`user_settings_${userId}`);
      if (local) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
        } catch (_) {}
      }
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error fetching admin settings:", error);
    if (typeof window !== "undefined" && userId) {
      const local = localStorage.getItem(`user_settings_${userId}`);
      if (local) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
        } catch (_) {}
      }
    }
    return DEFAULT_SETTINGS;
  }
}

// Save Admin Settings (User-specific settings mapping!)
export async function saveAdminSettings(settings: AdminSettings, userId?: string): Promise<void> {
  try {
    const documentId = userId || SETTINGS_DOCUMENT;
    const docRef = doc(db, SETTINGS_COLLECTION, documentId);
    await setDoc(docRef, settings, { merge: true });
    if (typeof window !== "undefined" && userId) {
      localStorage.setItem(`user_settings_${userId}`, JSON.stringify(settings));
    }
  } catch (error) {
    console.error("Error saving admin settings:", error);
    if (typeof window !== "undefined" && userId) {
      localStorage.setItem(`user_settings_${userId}`, JSON.stringify(settings));
    }
    throw error;
  }
}

// Fetch all folders for a user
export async function getFolders(userId: string): Promise<Folder[]> {
  try {
    const q = query(collection(db, "folders"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const folders: Folder[] = [];
    querySnapshot.forEach((doc) => {
      folders.push({ ...doc.data(), id: doc.id } as Folder);
    });
    return folders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching folders:", error);
    return [];
  }
}

// Create a new folder
export async function createFolder(folder: Omit<Folder, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "folders"), {
      ...folder,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}

// Delete a folder
export async function deleteFolder(id: string): Promise<void> {
  try {
    const docRef = doc(db, "folders", id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting folder:", error);
    throw error;
  }
}

// Fetch all invoices (optionally filtered by creator ID) ordered by creation date
export async function getInvoices(userId?: string): Promise<any[]> {
  try {
    let q;
    if (userId) {
      q = query(collection(db, INVOICES_COLLECTION), where("createdBy", "==", userId));
    } else {
      q = query(collection(db, INVOICES_COLLECTION));
    }
    const querySnapshot = await getDocs(q);
    const invoices: any[] = [];
    querySnapshot.forEach((doc) => {
      invoices.push({ ...doc.data(), id: doc.id });
    });
    // Sort in memory by createdAt descending
    return invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return [];
  }
}

// Fetch a single invoice by ID
export async function getInvoice(id: string): Promise<any | null> {
  try {
    const docRef = doc(db, INVOICES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...docSnap.data(), id: docSnap.id };
    }
    return null;
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return null;
  }
}

// Helper to strip undefined values which Firestore rejects
const sanitizeForFirestore = (obj: any) => JSON.parse(JSON.stringify(obj));

// Create a new invoice
export async function createInvoice(invoice: any): Promise<string> {
  try {
    const sanitizedInvoice = sanitizeForFirestore(invoice);
    const docRef = await addDoc(collection(db, INVOICES_COLLECTION), {
      ...sanitizedInvoice,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
}

// Update an existing invoice
export async function updateInvoice(id: string, invoice: any): Promise<void> {
  try {
    const sanitizedInvoice = sanitizeForFirestore(invoice);
    const docRef = doc(db, INVOICES_COLLECTION, id);
    await setDoc(docRef, sanitizedInvoice, { merge: true });
  } catch (error) {
    console.error("Error updating invoice:", error);
    throw error;
  }
}

// Delete an invoice (Soft Delete)
export async function deleteInvoice(id: string): Promise<void> {
  try {
    const docRef = doc(db, INVOICES_COLLECTION, id);
    await updateDoc(docRef, { isDeleted: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    throw error;
  }
}

// Wipe all user data (quotations, invoices, custom folders, settings) from Firestore
export async function wipeUserAccountData(userId: string): Promise<void> {
  try {
    // 1. Delete all user quotations
    const qQuotations = query(collection(db, QUOTATIONS_COLLECTION), where("createdBy", "==", userId));
    const querySnapshotQuotations = await getDocs(qQuotations);
    const deleteQuotationsPromises = querySnapshotQuotations.docs.map((docSnap) => 
      deleteDoc(doc(db, QUOTATIONS_COLLECTION, docSnap.id))
    );
    await Promise.all(deleteQuotationsPromises);

    // 2. Delete all user invoices
    const qInvoices = query(collection(db, INVOICES_COLLECTION), where("createdBy", "==", userId));
    const querySnapshotInvoices = await getDocs(qInvoices);
    const deleteInvoicesPromises = querySnapshotInvoices.docs.map((docSnap) => 
      deleteDoc(doc(db, INVOICES_COLLECTION, docSnap.id))
    );
    await Promise.all(deleteInvoicesPromises);

    // 3. Delete all user custom folders
    const qFolders = query(collection(db, "folders"), where("userId", "==", userId));
    const querySnapshotFolders = await getDocs(qFolders);
    const deleteFoldersPromises = querySnapshotFolders.docs.map((docSnap) => 
      deleteDoc(doc(db, "folders", docSnap.id))
    );
    await Promise.all(deleteFoldersPromises);

    // 4. Delete user admin settings
    const docRefSettings = doc(db, SETTINGS_COLLECTION, userId);
    await deleteDoc(docRefSettings);
  } catch (error) {
    console.error("Error wiping user account data:", error);
    throw error;
  }
}

// Fetch all customers for a user
export async function getCustomers(userId: string): Promise<Customer[]> {
  try {
    const q = query(collection(db, CUSTOMERS_COLLECTION), where("createdBy", "==", userId));
    const querySnapshot = await getDocs(q);
    const customers: Customer[] = [];
    querySnapshot.forEach((doc) => {
      customers.push({ ...doc.data(), id: doc.id } as Customer);
    });
    return customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}

// Create a new customer record
export async function createCustomer(customer: Omit<Customer, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), {
      ...customer,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating customer:", error);
    throw error;
  }
}

// Update a customer's info
export async function updateCustomer(id: string, customer: Partial<Customer>): Promise<void> {
  try {
    const docRef = doc(db, CUSTOMERS_COLLECTION, id);
    await setDoc(docRef, customer, { merge: true });
  } catch (error) {
    console.error("Error updating customer:", error);
    throw error;
  }
}

// Delete a customer record
export async function deleteCustomer(id: string): Promise<void> {
  try {
    const docRef = doc(db, CUSTOMERS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting customer:", error);
    throw error;
  }
}

