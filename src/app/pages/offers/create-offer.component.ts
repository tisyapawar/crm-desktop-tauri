import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DBService } from '../../service/db.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-create-offer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-offer.component.html',
  styleUrls: ['./create-offer.component.css']
})
export class CreateOfferComponent implements OnInit {

  customers: any[] = [];
  inquiries: any[] = [];
  selectedCustomer: any = null;
  selectedInquiry: any = null; // Store full inquiry data for display

  showInquiryPopup = false;
  isEditMode = false;
  editingOfferId: number | null = null;


  businessVerticals = [
    'Projects',
    'Material Distribution Division',
    'Both'
  ];

  offer: any = {
    customerId: null,
    customerName: '',
    customerSnapshot: null,
    inquiryNo: null,

    businessVertical: '',
    paymentTerms: '',
    validity: '',
    terms: '',

    items: [],
    subtotal: 0,
    gst: 0,
    grandTotal: 0
  };
  // router: any;

  constructor(private db: DBService, private router: Router) { }

  async ngOnInit() {
    console.log('🟢 CreateOfferComponent initialized');

    this.customers = await this.db.getAll('customers');

    console.log('🟢 Customers loaded:', this.customers);

    const state = history.state;

    if (state && state.offer) {
      console.log('✏️ Edit mode detected:', state.offer);

      this.isEditMode = true;
      this.editingOfferId = state.offer.id;

      // Load entire offer into form
      this.offer = {
        ...state.offer
      };

      // Safety: ensure items array exists
      this.offer.items = this.offer.items || [];
    }
  }

  async onCustomerChange() {
    console.log('🟡 Customer changed:', this.selectedCustomer);

    if (!this.selectedCustomer) {
      console.warn('⚠️ No customer selected');
      // Reset vertical when no customer selected
      this.offer.businessVertical = '';
      return;
    }

    const customer = this.selectedCustomer;

    this.offer.customerId = customer.id;
    this.offer.customerName = customer.name;
    this.offer.customerSnapshot = { ...customer };

    // ✅ AUTO-FILL BUSINESS VERTICAL
    this.offer.businessVertical = customer.businessVertical || '';
    console.log('🟢 Auto-filled vertical:', this.offer.businessVertical);

    console.log('🟢 Offer customer set:', this.offer.customerSnapshot);

    const allInquiries = await this.db.getAll('inquiries');

    console.log('🟢 All inquiries from DB:', allInquiries);

    this.inquiries = allInquiries.filter(
      (i: any) =>
        i.customerName?.trim().toLowerCase() ===
        customer.name?.trim().toLowerCase()
    );


    console.log('🟢 Filtered inquiries for customer:', this.inquiries);

    this.showInquiryPopup = this.inquiries.length > 0;

    if (!this.showInquiryPopup) {
      console.warn('⚠️ No inquiries found for this customer');
    }
  }

  async selectInquiry(inquiry: any) {
    console.log('🟡 Inquiry selected:', inquiry);

    // Store full inquiry data for display
    this.selectedInquiry = { ...inquiry };

    this.offer.inquiryNo = inquiry.id; // Use ID instead of non-existent 'no'

    // Load inventory to get rates
    const inventory = await this.db.getAll('inventory');
    console.log('📦 Inventory loaded for rate lookup:', inventory.length, 'items');

    this.offer.items = inquiry.items.map((i: any) => {
      console.log('📦 Inquiry item:', i);

      // Try to find matching inventory item by product name (case-insensitive)
      const inquiryName = (i.productName || '').toLowerCase().trim();

      const inventoryItem = inventory.find((inv: any) => {
        const invName = (inv.displayName || '').toLowerCase().trim();
        return invName.startsWith(inquiryName);
      });


      const rate = inventoryItem?.price || 0;
      const qty = i.qty || 0;

      if (inventoryItem) {
        console.log('✅ Found inventory match:', i.productName, '→ Rate:', rate);
      } else {
        console.log('⚠️ No inventory match for:', i.productName, '→ Rate set to 0');
      }

      return {
        name: i.productName,          // ✅ FIXED
        hsn: i.hsn || '',   // ✅ fallback until HSN added
        qty: qty,
        rate: rate,                   // ✅ AUTO-FILLED from inventory
        total: qty * rate             // ✅ Calculate immediately
      };
    });

    console.log('🟢 Offer items populated with rates:', this.offer.items);
    console.log('🟢 Full inquiry stored:', this.selectedInquiry);

    this.calcTotals();
    this.showInquiryPopup = false;
  }


  calcTotals() {
    console.log('🧮 Recalculating totals');

    let subtotal = 0;

    this.offer.items.forEach((i: any) => {
      i.total = i.qty * i.rate;
      subtotal += i.total;
    });

    this.offer.subtotal = subtotal;
    this.offer.gst = +(subtotal * 0.18).toFixed(2);
    this.offer.grandTotal = +(subtotal + this.offer.gst).toFixed(2);

    console.log('🧮 Totals updated:', {
      subtotal: this.offer.subtotal,
      gst: this.offer.gst,
      total: this.offer.grandTotal
    });
  }

  generateOfferRef(id: number) {
    const y = new Date().getFullYear();
    return `NIEC/MDD/${y}/${String(id).padStart(4, '0')}`;
  }

  getFollowUpDate(days: number = 2): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async saveOffer() {
    console.log('═══════════════════════════════════════');
    console.log('💾 SAVING NEW OFFER');
    console.log('═══════════════════════════════════════');
    console.log('📄 Offer data:', this.offer);
    console.log('───────────────────────────────────────');

    // 1️⃣ SAVE OFFER
    // const offerId = await this.db.add('offers', {
    //   ...this.offer,
    //   date: new Date().toISOString().slice(0, 10)
    // });

    let offerId: number;

    if (this.isEditMode && this.editingOfferId) {
      // 🔁 UPDATE EXISTING OFFER
      await this.db.put('offers', {
        ...this.offer,
        id: this.editingOfferId
      });

      offerId = this.editingOfferId;
      console.log('✏️ Offer updated with ID:', offerId);

    } else {
      // ➕ CREATE NEW OFFER
      offerId = await this.db.add('offers', {
        ...this.offer,
        date: new Date().toISOString().slice(0, 10)
      });

      console.log('✅ New offer created with ID:', offerId);
    }


    console.log('✅ Offer saved with ID:', offerId);

    // 2️⃣ GENERATE OFFER REF
    // const offerRef = this.generateOfferRef(offerId);
    let offerRef = this.offer.offerRef;

    if (!this.isEditMode) {
      offerRef = this.generateOfferRef(offerId);
      this.offer.offerRef = offerRef;
    }

    console.log('📋 Generated Offer Ref:', offerRef);

    // 3️⃣ CREATE OFFER FOLLOW-UP REMINDER
    try {
      const customer = this.offer.customerSnapshot;
      const mobile = customer?.mobile || customer?.phone || '';

      console.log('🔔 Creating auto-reminder with params:');
      console.log('  ├─ type: offer');
      console.log('  ├─ name:', this.offer.customerName);
      console.log('  ├─ mobile:', mobile || '(not found)');
      console.log('  ├─ referenceNo:', offerRef);
      console.log('  ├─ followUpDays: 2');
      console.log('  └─ note:', `Follow-up offer ${offerRef} - ${this.offer.customerName}`);

      // await this.db.createAutoReminder({
      //   type: 'offer',
      //   name: this.offer.customerName,
      //   mobile: mobile,
      //   referenceNo: offerRef,
      //   followUpDays: 2,
      //   note: `Follow-up offer ${offerRef} - ${this.offer.customerName}`
      // });
      if (!this.isEditMode) {
        await this.db.createAutoReminder({
          type: 'offer',
          name: this.offer.customerName,
          mobile: mobile,
          referenceNo: offerRef,
          followUpDays: 2,
          note: `Follow-up offer ${offerRef} - ${this.offer.customerName}`
        });
      }


      console.log('✅ Reminder creation completed');
      console.log('═══════════════════════════════════════');

    } catch (error) {
      console.error('❌ Reminder creation failed:', error);
      console.log('═══════════════════════════════════════');
    }

    // 4️⃣ NAVIGATE BACK
    // alert('Offer created! Follow-up reminder set for 2 days.');
    this.router.navigateByUrl('/offers');
  }


  goBackToList() {
    console.log('🔙 Navigating back to Offers list');
    this.router.navigateByUrl('/offers');
  }

  // Generate display inquiry ID (INQ-0001 format)
  getDisplayInquiryId(id?: number): string {
    if (!id) return '-';
    return `INQ-${String(id).padStart(4, '0')}`;
  }

}