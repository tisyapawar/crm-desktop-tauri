/* =========================
   INVOICE ITEM (TABLE ROW)
========================= */
export interface InvoiceItem {
   srNo: number;
   particulars: string;
   hsn: string;
   uom: string;
   qty: number;
   rate: number;
   amount: number;
}

/* =========================
   PARTY DETAILS (Bill To / Ship To)
========================= */
export interface PartyDetails {
   customerId?: number | null;
   name: string;
   address: string;
   gstin: string;
   pan: string;
   state: string;
   supplyStateCode: string;
   placeOfSupply: string;
}

/* =========================
   TRANSPORT DETAILS
========================= */
export interface TransportDetails {
   mode: string;
   name: string;
   vehicleNo: string;
   lrNo: string;
   remarks: string;
}

/* =========================
   TAX CONFIGURATION
========================= */
export interface TaxRates {
   cgst: number;  // Percentage (e.g., 9 for 9%)
   sgst: number;  // Percentage (e.g., 9 for 9%)
   igst: number;  // Percentage (e.g., 18 for 18%)
}

export const DEFAULT_TAX_RATES: TaxRates = {
   cgst: 9,
   sgst: 9,
   igst: 18
};

/* =========================
   MAIN INVOICE MODEL
========================= */
export interface InvoiceModel {
   id?: number;

   // Invoice Details
   invoiceNo: string;
   invoiceDate: string;
   dueDate: string;
   orderRefNo: string;
   internalRefNo: string;
   ewayBillNo: string;

   // Supply & Jurisdiction
   supplyType: 'GST' | 'IGST';
   supplyStateCode: string;
   placeOfSupply: string;

   // Bill To Party
   billTo: PartyDetails;

   // Ship To Party
   shipTo: PartyDetails;

   // Line Items
   items: InvoiceItem[];

   // Charges
   subTotal1: number;
   packingCharges: number;
   freightCharges: number;
   otherCharges: number;

   // Taxes
   cgst: number;
   sgst: number;
   igst: number;

   // Totals
   subTotal2: number;
   roundOff: number;
   grandTotal: number;
   amountInWords: string;

   // Transport
   transport: TransportDetails;

   // Additional Information
   paymentTerms: string;
   remarks: string;

   // Status & Tracking
   status: 'Pending' | 'Paid';
   createdAt: string;
}

/* =========================
   HELPER FUNCTIONS
========================= */

/**
 * Creates an empty PartyDetails object with default values
 */
export function createEmptyPartyDetails(): PartyDetails {
   return {
      customerId: null,
      name: '',
      address: '',
      gstin: '',
      pan: '',
      state: '',
      supplyStateCode: '',
      placeOfSupply: ''
   };
}

/**
 * Creates an empty TransportDetails object with default values
 */
export function createEmptyTransportDetails(): TransportDetails {
   return {
      mode: '',
      name: '',
      vehicleNo: '',
      lrNo: '',
      remarks: ''
   };
}

/**
 * Creates an empty InvoiceItem with default values
 */
export function createEmptyInvoiceItem(srNo: number = 1): InvoiceItem {
   return {
      srNo,
      particulars: '',
      hsn: '',
      uom: '',
      qty: 1,
      rate: 0,
      amount: 0
   };
}