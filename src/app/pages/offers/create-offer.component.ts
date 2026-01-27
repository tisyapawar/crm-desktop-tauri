// import { Component, ViewEncapsulation } from "@angular/core";
// import { CommonModule } from "@angular/common";
// import { FormsModule } from "@angular/forms";
// import { Router } from "@angular/router";
// import { DBService } from '../../service/db.service';

// @Component({
//   selector: 'app-create-offer',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './create-offer.component.html',
//   styleUrls: ['./create-offer.component.css'],
//   encapsulation: ViewEncapsulation.None
// })
// export class CreateOfferComponent {

//   offer: any = {
//   id: null,
//   offerRef: "",
//   customerId: null,
//   customerName: "",
//   businessVertical: "",
//   date: new Date().toISOString().slice(0, 10),
//   items: [],
//   subtotal: 0,
//   gst: 0,
//   grandTotal: 0,
//   notes: "",
//   paymentTerms: "",
//   validity: "",
//   terms: "",
// };

//   businessVerticals = [
//   "Medical Devices",
//   "Diagnostics",
//   "Hospital Furniture",
//   "OT & ICU Equipment",
//   "Laboratory Equipment",
//   "Rehabilitation",
//   "Consumables",
//   "Other"
// ];

//   constructor(private router: Router, private dbService: DBService) {
//    const state = history.state;

//   if (state.inquiry) {
//     const inquiry = state.inquiry;

//     // Customer
//     this.offer.customerName = inquiry.customerName;

//     // Vertical
//     this.offer.businessVertical = inquiry.vertical || "";

//     // Payment Terms
//     this.offer.paymentTerms = inquiry.paymentTerms || "";

//     // Validity (default)
//     this.offer.validity = "30 Days";

//     // Items from inquiry
//     this.offer.items = inquiry.items.map((it: any) => ({
//       name: it.item,
//       qty: it.qty,
//       rate: it.rate,
//       total: it.total
//     }));

//     this.calcTotals();
//   }

//   // Edit existing
//   if (state.offer) {
//     this.offer = state.offer;
//   }
// }


//   // OPEN DATABASE (VERSION 6)
//   openDB(): Promise<IDBDatabase> {
//   return new Promise((resolve, reject) => {
//     console.log("📌 Opening DB...");

//     // First open normally to get version 56
//     const firstReq = indexedDB.open("crm-db");

//     firstReq.onsuccess = () => {
//       const oldDB = firstReq.result;
//       const currentVersion = oldDB.version;

//       console.log("✔ Current CRM DB Version:", currentVersion);

//       oldDB.close();

//       // Upgrade to version 57
//       const newVersion = currentVersion + 1;
//       console.log("⚠ Upgrading DB to version:", newVersion);

//       const upgradeReq = indexedDB.open("crm-db", newVersion);

//       upgradeReq.onupgradeneeded = (event) => {
//         const db = upgradeReq.result;

//         console.log("🔧 Running DB upgrade...");

//         if (!db.objectStoreNames.contains("offers")) {
//           db.createObjectStore("offers", { keyPath: "id", autoIncrement: true });
//           console.log("✔ Created new 'offers' store");
//         } else {
//           console.log("✔ 'offers' store already exists");
//         }
//       };

//       upgradeReq.onsuccess = () => {
//         console.log("✔ DB opened successfully at version", newVersion);
//         resolve(upgradeReq.result);
//       };

//       upgradeReq.onerror = (e) => {
//         console.error("❌ Error upgrading DB:", e);
//         reject(e);
//       };
//     };

//     firstReq.onerror = (err) => {
//       console.error("❌ Error opening CRM DB:", err);
//       reject(err);
//     };
//   });
// }

//   addItem() {
//     console.log("➕ Adding new item");
//     this.offer.items.push({ name: "", qty: 1, rate: 0, total: 0 });
//     this.calcTotals();
//   }

//   removeItem(i: number) {
//     console.log("🗑 Removing item at index:", i);
//     this.offer.items.splice(i, 1);
//     this.calcTotals();
//   }

//   calcTotals() {
//     console.log("🧮 Calculating totals...");

//     this.offer.items.forEach((item: any) => {
//       item.total = (item.qty * item.rate) || 0;
//     });

//     this.offer.subtotal = this.offer.items.reduce((sum: any, item: any) => sum + item.total, 0);
//     this.offer.gst = +(this.offer.subtotal * 0.18).toFixed(2);
//     this.offer.grandTotal = +(this.offer.subtotal + this.offer.gst).toFixed(2);

//     console.log("➡ Subtotal:", this.offer.subtotal);
//     console.log("➡ GST:", this.offer.gst);
//     console.log("➡ Grand Total:", this.offer.grandTotal);
//   }

//   async saveOffer() {
//   console.log("💾 Save Offer Clicked");
//   this.calcTotals();

//   try {
//     const db = await this.dbService.openDB();
//     const tx = db.transaction("offers", "readwrite");
//     const store = tx.objectStore("offers");

//     let offerToSave = { ...this.offer };
//     delete offerToSave.id; // allow autoIncrement

//     const req = store.add(offerToSave);

//     req.onsuccess = async (e: any) => {
//       const newId = e.target.result;
//       console.log("✔ Offer saved with new ID:", newId);

//       // Generate reference number
//       const ref = this.generateOfferRef(newId);

//       // Update record with offerRef
//       const tx2 = db.transaction("offers", "readwrite");
//       const store2 = tx2.objectStore("offers");

//       const updatedOffer = { ...offerToSave, id: newId, offerRef: ref };
//       store2.put(updatedOffer);

//       tx2.oncomplete = () => {
//         alert("Offer Created Successfully!");
//         this.router.navigate(['/offers']);
//       };
//     };

//     req.onerror = (e: any) => {
//       console.error("❌ Error saving offer:", e.target.error);
//       alert("Failed to save offer");
//     };

//   } catch (err) {
//     console.error("❌ saveOffer() failed:", err);
//   }
// }


// generateOfferRef(id: number): string {
//   const year = new Date().getFullYear();
//   const padded = id.toString().padStart(4, '0');
//   return `NIEC/MDD/${year}/${padded}`;
// }

// }


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

  showInquiryPopup = false;

  businessVerticals = [
    'PROJECTS',
    'MATERIAL DISTRIBUTION',
    'BOTH'
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
  }

  async onCustomerChange() {
    console.log('🟡 Customer changed:', this.selectedCustomer);

    if (!this.selectedCustomer) {
      console.warn('⚠️ No customer selected');
      return;
    }

    const customer = this.selectedCustomer;

    this.offer.customerId = customer.id;
    this.offer.customerName = customer.name;
    this.offer.customerSnapshot = { ...customer };

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

  // selectInquiry(inquiry: any) {
  //   console.log('🟡 Inquiry selected:', inquiry);

  //   // Inquiry primary key
  //   this.offer.inquiryNo = inquiry.no;

  //   // Map items EXACTLY as stored in DB
  //   this.offer.items = inquiry.items.map((i: any) => {
  //     console.log('📦 Inquiry item:', i);

  //     return {
  //       name: i.name,                // ✅ CORRECT FIELD
  //       hsn: '',                     // ❌ Not present in inquiry DB
  //       qty: i.qty,                  // ✅ CORRECT FIELD
  //       rate: 0,
  //       total: 0
  //     };
  //   });

  //   console.log('🟢 Offer items populated:', this.offer.items);

  //   this.calcTotals();
  //   this.showInquiryPopup = false;
  // }

  selectInquiry(inquiry: any) {
    console.log('🟡 Inquiry selected:', inquiry);

    this.offer.inquiryNo = inquiry.no;

    this.offer.items = inquiry.items.map((i: any) => {
      console.log('📦 Inquiry item:', i);

      return {
        name: i.productName,          // ✅ FIXED
        hsn: i.hsn || i.make || '',   // ✅ fallback until HSN added
        qty: i.qty || 0,
        rate: 0,
        total: 0
      };
    });

    console.log('🟢 Offer items populated:', this.offer.items);

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


  // async saveOffer() {
  //   console.log('💾 Saving offer:', this.offer);

  //   await this.db.add('offers', {
  //     ...this.offer,
  //     date: new Date().toISOString().slice(0, 10)
  //   });

  //   console.log('✅ Offer saved successfully');
  //   alert('Offer saved successfully');
  // }

  // async saveOffer() {
  //   console.log('💾 Saving offer:', this.offer);

  //   // 1️⃣ SAVE OFFER (DO NOT REMOVE)
  //   const offerId = await this.db.add('offers', {
  //     ...this.offer,
  //     date: new Date().toISOString().slice(0, 10)
  //   });

  //   // 2️⃣ GENERATE OFFER REF
  //   const offerRef = this.generateOfferRef(offerId);

  //   // 3️⃣ CREATE FOLLOW-UP REMINDER (ONLY HERE)
  //   await this.db.add('reminders', {
  //     date: this.getFollowUpDate(2),   // +2 days
  //     time: '10:00',
  //     type: 'offer',
  //     name: this.offer.customerName,
  //     mobile: '',
  //     referenceNo: offerRef,
  //     note: `Follow up for offer ${offerRef}`,
  //     source: 'system',
  //     status: 'pending',
  //     createdAt: new Date().toISOString()
  //   });

  //   console.log('✅ Offer + reminder created');

  //   // 4️⃣ NAVIGATE BACK
  //   this.router.navigateByUrl('/offers');
  // }

  // async saveOffer() {
  //   console.log('💾 Saving offer:', this.offer);

  //   const id = await this.db.add('offers', {
  //     ...this.offer,
  //     date: new Date().toISOString().slice(0, 10)
  //   });

  //   // 🔔 CREATE OFFER FOLLOW-UP REMINDER (ONLY ON CREATE)
  //   const offerRef = this.generateOfferRef(id);

  //   await this.db.add('reminders', {
  //     date: this.getFollowUpDate(2),
  //     time: '10:00',
  //     type: 'offer',
  //     name: this.offer.customerName,
  //     mobile: '',
  //     referenceNo: offerRef,
  //     note: `Follow up for offer ${offerRef}`,
  //     source: 'system',
  //     status: 'pending',
  //     createdAt: new Date().toISOString()
  //   });

  //   console.log('✅ Offer + reminder created');
  //   this.router.navigateByUrl('/offers');
  // }

  async saveOffer() {
    console.log('═══════════════════════════════════════');
    console.log('💾 SAVING NEW OFFER');
    console.log('═══════════════════════════════════════');
    console.log('📄 Offer data:', this.offer);
    console.log('───────────────────────────────────────');

    // 1️⃣ SAVE OFFER
    const offerId = await this.db.add('offers', {
      ...this.offer,
      date: new Date().toISOString().slice(0, 10)
    });

    console.log('✅ Offer saved with ID:', offerId);

    // 2️⃣ GENERATE OFFER REF
    const offerRef = this.generateOfferRef(offerId);
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

      await this.db.createAutoReminder({
        type: 'offer',
        name: this.offer.customerName,
        mobile: mobile,
        referenceNo: offerRef,
        followUpDays: 2,
        note: `Follow-up offer ${offerRef} - ${this.offer.customerName}`
      });

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

}
