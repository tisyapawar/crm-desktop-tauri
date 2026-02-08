import { Component, NgZone, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { DBService } from '../../service/db.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OfferLetter {
  date: string;
  subject: string;
  subjectProduct?: string,
  address: string;
  introText: string;
  material: string;
  density: string;
  thickness: string;
  size: string;
  quantity: string;
  rate: string;
  taxes: number;
  freight: string;
  inspection: string;
  packing: string;
  loading: string;
  deliveryTerms: string;
  paymentTerms: string;
  validity: string;
  closingText: string;
}

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offers.component.html',
  styleUrls: ['./offers.component.css']
})
export class OffersComponent {

  offers: any[] = [];
  showViewModal = false;
  selectedOffer: any = null;

  // Offer Letter modal state + fields (moved from Inquiry)
  showPdfFormModal: boolean = false;
  selectedSubjectItem: any = null;

  offerLetter: OfferLetter = {
    date: '',
    subject: '',
    subjectProduct: '',
    address: '',
    introText: '',
    material: '',
    density: '',
    thickness: '',
    size: '',
    quantity: '',
    rate: '',
    taxes: 18,
    freight: '',
    inspection: '',
    packing: '',
    loading: '',
    deliveryTerms: '',
    paymentTerms: '',
    validity: '',
    closingText: ''
  };


  offerLetterKeys = Object.keys(this.offerLetter);

  constructor(private router: Router, private dbService: DBService, private ngZone: NgZone) {
    this.loadOffers();
  }

  private async findInventoryItemForOfferItem(item: any): Promise<any> {
    if (!item?.name) return null;

    const inventory = await this.dbService.getAll('inventory');

    console.log('📦 Inventory:', inventory);

    const itemName = item.name.toLowerCase();

    // 1️⃣ Find all name matches
    const matches = inventory.filter((inv: any) => {
      const invName = (inv.displayName || inv.name || '').toLowerCase();
      return invName === itemName;
    });

    if (matches.length === 0) {
      console.warn('❌ No inventory match for item:', item.name);
      return null;
    }

    // 2️⃣ If exactly one match → safe
    if (matches.length === 1) {
      return matches[0]; // ✅ FULL inventory JSON
    }

    // 3️⃣ Multiple matches → deterministic fallback
    console.warn(
      `⚠️ Multiple inventory matches for "${item.name}", using first match`,
      matches
    );

    return matches[0]; // still full inventory object
  }

  // NEW: when subject product changes
  async onSubjectProductChange(item: any) {
    if (!item) return;

    this.selectedSubjectItem = item;

    // From offer item
    this.offerLetter.subjectProduct = item.name || '';
    this.offerLetter.material = item.name || '';

    const qty = item.qty ?? '';
    const uom = item.uom ?? '';
    this.offerLetter.quantity = qty ? `${qty} ${uom}` : '';

    this.offerLetter.rate =
      item.rate !== undefined && item.rate !== null
        ? `₹${item.rate} per unit`
        : '';

    this.offerLetter.taxes =
      item.gst !== undefined && item.gst !== null
        ? item.gst
        : 18;

    // 🔍 Inventory sync
    const data = await this.findInventoryItemForOfferItem(item);
    console.log('✅ Matched inventory:', data);

    if (data) {
      this.offerLetter.density = data.density || '';
      this.offerLetter.thickness = data.thickness || '';
      this.offerLetter.size = data.size || '';
    }
  }

  // Add these properties to your component class
  activeMenuId: any = null;

  toggleActionMenu(event: Event, id: any) {
    event.stopPropagation();
    this.activeMenuId = this.activeMenuId === id ? null : id;
  }

  closeActionMenu() {
    this.activeMenuId = null;
  }

  // Add click listener to close menu when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    this.activeMenuId = null;
  }

  // openDB(): Promise<IDBDatabase> {
  //   return new Promise(resolve => {
  //     const req = indexedDB.open("crm-db");
  //     req.onsuccess = () => resolve(req.result);
  //   });
  // }

  /* -------------------
     CRUD / listing
     ------------------- */
  async loadOffers() {
    try {
      const db = await this.dbService.openDB();
      const tx = db.transaction("offers", "readonly");
      const store = tx.objectStore("offers");
      const req = store.getAll();
      req.onsuccess = () => {
        const data = req.result || [];
        // ensure offerRef exists
        data.forEach((row: any) => {
          if (!row.offerRef && row.id) row.offerRef = this.generateOfferRef(row.id);
        });
        this.offers = data.reverse();
      };
      req.onerror = (e) => console.error('loadOffers error', e);
    } catch (e) {
      console.error('DB error loadOffers', e);
    }
  }

  generateOfferRef(id: number) {
    const y = new Date().getFullYear();
    return `NIEC/MDD/${y}/${String(id).padStart(4, '0')}`;
  }

  createOffer() {
    this.router.navigate(['/create-offer']);
  }

  // open for edit (navigates to create-offer with state)
  editOffer(offer: any) {
    this.router.navigate(['/create-offer'], { state: { offer } });
  }

  viewOffer(offer: any) {
    this.selectedOffer = offer;
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedOffer = null;
  }

  async deleteOffer(id: number) {
    try {
      const db = await this.dbService.openDB();
      const tx = db.transaction("offers", "readwrite");
      tx.objectStore("offers").delete(id);
      tx.oncomplete = () => this.loadOffers();
    } catch (e) {
      console.error('deleteOffer error', e);
    }
  }

  /* -----------------------------
     Offer Letter modal functions
     ----------------------------- */
  async openOfferLetterModal() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    this.offerLetter['date'] = `${dd}-${mm}-${yyyy}`;

    if (this.selectedOffer) {
      // Load inquiry data if available
      let inquiryData: any = null;
      if (this.selectedOffer.inquiryNo) {
        try {
          inquiryData = await this.dbService.getById('inquiries', this.selectedOffer.inquiryNo);
          console.log('📋 Loaded inquiry for auto-fill:', inquiryData);
        } catch (error) {
          console.log('⚠️ Could not load inquiry:', error);
        }
      }

      // Auto-fill from existing offer data first
      Object.keys(this.offerLetter).forEach(key => {
        if (key !== 'date') {
          (this.offerLetter as any)[key] = this.selectedOffer[key] ?? '';
        }
      });

      // Auto-fill from inquiry if not already filled
      if (inquiryData && this.selectedOffer.items && this.selectedOffer.items.length > 0) {
        const firstItem = this.selectedOffer.items[0];

        // Material - from item name
        if (!this.offerLetter['material'] && firstItem.name) {
          this.offerLetter['material'] = firstItem.name;
          console.log('✅ Auto-filled Material:', firstItem.name);
        }

        // Try to get details from inquiry items
        if (inquiryData.items && inquiryData.items.length > 0) {
          const inquiryItem = inquiryData.items[0];

          // Density
          if (!this.offerLetter['density'] && inquiryItem.density) {
            this.offerLetter['density'] = inquiryItem.density;
            console.log('✅ Auto-filled Density:', inquiryItem.density);
          }

          // Thickness
          if (!this.offerLetter['thickness'] && inquiryItem.thickness) {
            this.offerLetter['thickness'] = inquiryItem.thickness;
            console.log('✅ Auto-filled Thickness:', inquiryItem.thickness);
          }

          // Form/Size
          if (!this.offerLetter['size'] && inquiryItem.form) {
            this.offerLetter['size'] = inquiryItem.form;
            console.log('✅ Auto-filled Size (from form):', inquiryItem.form);
          }
        }

        // Quantity - sum from all items
        if (!this.offerLetter['quantity']) {
          const totalQty = this.selectedOffer.items.reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
          const firstItemUOM = inquiryData?.items?.[0]?.uom || 'Units';
          this.offerLetter['quantity'] = `${totalQty} ${firstItemUOM}`;
          console.log('✅ Auto-filled Quantity:', this.offerLetter['quantity']);
        }

        // Rate - from first item
        if (!this.offerLetter['rate'] && firstItem.rate) {
          this.offerLetter['rate'] = `₹${firstItem.rate} per unit`;
          console.log('✅ Auto-filled Rate:', this.offerLetter['rate']);
        }

        // Calculate and auto-fill taxes (18% GST as default)
        if (!this.offerLetter['taxes'] && this.selectedOffer.grandTotal) {
          const subtotal = this.selectedOffer.subTotal || 0;
          const gstAmount = this.selectedOffer.grandTotal - subtotal;
          if (gstAmount > 0) {
            this.offerLetter['taxes'] = gstAmount;
            console.log('✅ Auto-filled Taxes:', this.offerLetter['taxes']);
          }
        }
      }

      // Default values for common fields if not filled
      if (!this.offerLetter['deliveryTerms']) {
        this.offerLetter['deliveryTerms'] = 'Ex-Works';
      }

      if (!this.offerLetter['paymentTerms']) {
        this.offerLetter['paymentTerms'] = '100% Advance';
      }

      if (!this.offerLetter['validity']) {
        this.offerLetter['validity'] = '30 days';
      }

      if (!this.offerLetter['packing']) {
        this.offerLetter['packing'] = 'Standard Industrial Packing';
      }

    } else {
      // New offer - clear all fields except date
      Object.keys(this.offerLetter).forEach(key => {
        if (key !== 'date') {
          (this.offerLetter as any)[key] = '';
        }
      });
    }

    // NEW: default subject product = first item
    if (this.selectedOffer?.items?.length && !this.selectedSubjectItem) {
      this.onSubjectProductChange(this.selectedOffer.items[0]);
    }

    this.showPdfFormModal = true;
  }

  closeOfferLetterModal() {
    this.showPdfFormModal = false;
  }

  // Helper: fetch customer object by name from customers store (scans all customers)
  async getCustomerByName(name: string) {
    try {
      const db = await this.dbService.openDB();
      const tx = db.transaction('customers', 'readonly');
      const store = tx.objectStore('customers');
      return new Promise<any>((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const found = (req.result || []).find((c: any) =>
            ((c.name || '').toLowerCase() === (name || '').toLowerCase()) ||
            ((c.companyName || '').toLowerCase() === (name || '').toLowerCase())
          );
          resolve(found || null);
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.error('getCustomerByName error', e);
      return null;
    }
  }

  async createOfferFollowUpReminder(offer: any) {
    try {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 3); // default +3 days
      followUpDate.setHours(0, 0, 0, 0);

      const reminder = {
        date: followUpDate.toISOString().slice(0, 10),
        time: '10:00',
        type: 'offer',
        source: 'system',
        status: 'pending',
        name: offer.customerName || '',
        mobile: '',
        referenceNo: offer.offerRef || this.generateOfferRef(offer.id),
        note: `Offer follow-up for ${offer.offerRef}`,
        createdAt: new Date().toISOString()
      };

      console.log('📌 Creating OFFER follow-up reminder:', reminder);

      await this.dbService.add('reminders', reminder);
    } catch (e) {
      console.error('❌ Failed to create offer reminder', e);
    }
  }


  /* -----------------------------
     PDF function - FIXED TO FIT ON ONE PAGE
     ----------------------------- */

  async downloadOfferPDF() {
    if (!this.selectedOffer) return;
    this.offerLetter.subject =
      `Your enquiry for supply of ${this.offerLetter.subjectProduct || ''}`.trim();


    const offer = this.selectedOffer;
    const customer = await this.getCustomerByName(offer.customerName || '');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let y = 5; // Start a bit lower

    // ---------------- LOGO (IF AVAILABLE) ----------------
    const img = new Image();
    img.src = 'assets/Navbharat logo.png';

    await new Promise<void>((resolve) => {
      img.onload = () => {
        // Add logo - larger size for better visibility
        doc.addImage(img, 'PNG', pageWidth / 2 - 60, y, 120, 35, undefined, 'FAST');
        resolve();
      };
      img.onerror = () => {
        // If logo fails to load, use text header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('NAVBHARAT INSULATION & ENGG CO', pageWidth / 2, y + 10, { align: 'center' });
        resolve();
      };
    });

    y += 42; // More space after logo

    // ---------------- REF + DATE (SINGLE LINE) ----------------
    const ref = (offer.offerRef || '').replace('/MDD', '');
    const dateStr = this.offerLetter['date'] || '';

    doc.setFontSize(10); // Increased from 9
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${ref}`, 20, y);
    doc.text(`Date: ${dateStr}`, pageWidth - 20, y, { align: 'right' });
    y += 10; // More spacing

    // ---------------- TO SECTION ----------------
    doc.setFontSize(11); // Increased from 10
    doc.text('To,', 20, y); y += 6;

    // Company name
    const companyName = customer?.companyName || customer?.customerName || offer.customerName || 'Company Name';
    doc.text(companyName, 20, y); y += 6;

    // Address (compact, single line if possible)
    if (customer?.shipping?.city || customer?.billing?.city) {
      const addr = customer?.shipping?.city ? customer.shipping : customer.billing;
      const parts = [addr.city, addr.state, addr.pincode].filter(p => p && p.trim());
      const address = parts.join(', ');

      if (address) {
        doc.text(address, 20, y);
        y += 6;
      }
    }
    y += 4;

    // ---------------- SUBJECT ----------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11); // Increased from 10
    const subject = this.offerLetter['subject'] || 'Your enquiry for supply of Product';
    doc.text(`Subject: ${subject}`, 20, y);
    y += 8;

    // ---------------- INTRO TEXT ----------------
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10); // Increased from 9

    const introText = `Thank you for your enquiry dated ${dateStr}. Please find the quotation as per your requirement.`;

    const introLines = doc.splitTextToSize(introText, 170);
    doc.text(introLines, 20, y);
    y += (introLines.length * 5) + 6; // Better line spacing

    // ---------------- SPECIFICATION TABLE ----------------
    const rows: any[] = [];
    const val = (key: keyof OfferLetter) =>
      (this.offerLetter[key] || '') ||
      (this.selectedOffer ? this.selectedOffer[key as any] || '' : '');

    // Only include filled fields
    if (val('material')) rows.push(['Material', val('material')]);
    if (val('density')) rows.push(['Density', val('density')]);
    if (val('thickness')) rows.push(['Thickness', val('thickness')]);
    if (val('size')) rows.push(['Size', val('size')]);
    if (val('quantity')) rows.push(['Quantity', val('quantity')]);
    if (val('rate')) rows.push(['Rate', val('rate')]);
    if (val('taxes')) rows.push(['Taxes', val('taxes')]);
    if (val('freight')) rows.push(['Freight', val('freight')]);
    if (val('inspection')) rows.push(['Inspection', val('inspection')]);
    if (val('packing')) rows.push(['Packing', val('packing')]);
    if (val('loading')) rows.push(['Loading', val('loading')]);
    if (val('deliveryTerms')) rows.push(['Delivery Terms', val('deliveryTerms')]);
    if (val('paymentTerms')) rows.push(['Payment Terms', val('paymentTerms')]);
    if (val('validity')) rows.push(['Offer Validity', val('validity')]);

    autoTable(doc, {
      startY: y,
      head: [['Specification', 'Details']],
      body: rows,
      theme: 'grid',

      styles: {
        fontSize: 9,           // Increased from 8
        font: 'helvetica',
        cellPadding: 2.5,      // Slightly more padding
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },

      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 9            // Increased from 8
      },

      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 132 }
      },

      margin: { left: 20, right: 20 }
    });

    // Get position after table
    y = (doc as any).lastAutoTable.finalY + 7; // More spacing

    // ---------------- CLOSING TEXT ----------------
    doc.setFontSize(10); // Increased from 9
    const closingText = 'Kindly review the above quote. Feel free to reach out for clarification. Looking forward to your response.';

    const closingLines = doc.splitTextToSize(closingText, 170);
    doc.text(closingLines, 20, y);
    y += (closingLines.length * 5) + 10; // Better spacing

    const stamp = new Image();
    stamp.src = 'assets/stamp.jpeg';

    await new Promise<void>((resolve) => {
      stamp.onload = () => {
        doc.addImage(stamp, 'PNG', 20, y - 10, 30, 30); // small stamp
        resolve();
      };
      stamp.onerror = () => resolve();
    });

    y += 25;

    // ---------------- SIGNATURE BLOCK ----------------
    doc.setFontSize(11); // Increased from 10
    doc.setTextColor(0);
    doc.text('Regards,', 20, y); y += 6;
    doc.text('For NAVBHARAT INSULATION & ENGG CO', 20, y); y += 10;

    // ---------------- FOOTER (FIXED AT BOTTOM) ----------------
    doc.setFontSize(8); // Increased from 7
    doc.setTextColor(80);
    doc.text(
      'A.N. HOUSE, TPS III, 31ST RD, LINKING RD, BANDRA, MUMBAI, MAHARASHTRA, INDIA 400050',
      pageWidth / 2,
      pageHeight - 12,
      { align: 'center' }
    );
    doc.text(
      'E MAIL: info@navbharatgroup.com   URL: www.navbharatgroup.com',
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );

    doc.save(`Offer_${ref}.pdf`);
    this.closeOfferLetterModal();
  }

  // OLD METHOD - NO LONGER USED
  // generateOfferPDFContent is replaced by the new downloadOfferPDF above
  // OLD METHOD - NO LONGER USED
  // generateOfferPDFContent is replaced by the new downloadOfferPDF above

  async saveOfferLetterToOffer() {
    if (!this.selectedOffer) return;

    // 🔑 Detect new offer BEFORE save
    const isNewOffer = !this.selectedOffer.id;

    Object.assign(this.selectedOffer, {
      material: this.offerLetter['material'],
      density: this.offerLetter['density'],
      thickness: this.offerLetter['thickness'],
      size: this.offerLetter['size'],
      quantity: this.offerLetter['quantity'],
      rate: this.offerLetter['rate'],
      taxes: this.offerLetter['taxes'],
      freight: this.offerLetter['freight'],
      inspection: this.offerLetter['inspection'],
      packing: this.offerLetter['packing'],
      loading: this.offerLetter['loading'],
      deliveryTerms: this.offerLetter['deliveryTerms'],
      paymentTerms: this.offerLetter['paymentTerms'],
      validity: this.offerLetter['validity']
    });

    try {
      const db = await this.dbService.openDB();
      const tx = db.transaction('offers', 'readwrite');
      const store = tx.objectStore('offers');

      let request: IDBRequest;

      if (isNewOffer) {
        request = store.add(this.selectedOffer);
      } else {
        request = store.put(this.selectedOffer);
      }

      request.onsuccess = async (event: any) => {
        // ✅ IndexedDB ID is available ONLY here
        if (isNewOffer) {
          this.selectedOffer.id = event.target.result;
          this.selectedOffer.offerRef = this.generateOfferRef(this.selectedOffer.id);

          console.log('🟢 New Offer ID:', this.selectedOffer.id);
          console.log('🟢 Offer Ref:', this.selectedOffer.offerRef);

          // 🔔 CREATE OFFER REMINDER (ONLY ON CREATE)
          await this.createOfferReminder(this.selectedOffer);
        }

        console.log('✅ Offer saved:', this.selectedOffer);
        this.loadOffers();
      };

      request.onerror = (e) => {
        console.error('❌ Failed to save offer', e);
      };

    } catch (e) {
      console.error('saveOfferLetterToOffer error', e);
    }
  }

  async createOfferReminder(offer: any) {
    try {
      const db = await this.dbService.openDB();
      const tx = db.transaction('reminders', 'readwrite');
      const store = tx.objectStore('reminders');

      const reminder = {
        date: this.getFollowUpDate(2),   // +2 days
        time: '10:00',
        type: 'offer',                  // ✅ MUST MATCH Reminders filter
        name: offer.customerName || '',
        mobile: '',
        referenceNo: offer.offerRef || '',
        note: `Follow up for offer ${offer.offerRef}`,
        source: 'system',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      console.log('📌 Creating offer reminder:', reminder);

      store.add(reminder);

      tx.oncomplete = () => {
        console.log('✅ Offer reminder committed to DB');
      };

      tx.onerror = (e) => {
        console.error('❌ Offer reminder transaction failed', e);
      };

    } catch (e) {
      console.error('createOfferReminder error', e);
    }
  }

  getFollowUpDate(days: number = 2): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

}