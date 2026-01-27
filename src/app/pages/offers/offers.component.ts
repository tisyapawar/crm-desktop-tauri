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
  address: string;
  introText: string;
  material: string;
  density: string;
  thickness: string;
  size: string;
  quantity: string;
  rate: string;
  taxes: string;
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

  offerLetter: OfferLetter = {
    date: '',
    subject: '',
    address: '',
    introText: '',
    material: '',
    density: '',
    thickness: '',
    size: '',
    quantity: '',
    rate: '',
    taxes: '',
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

  openDB(): Promise<IDBDatabase> {
    return new Promise(resolve => {
      const req = indexedDB.open("crm-db");
      req.onsuccess = () => resolve(req.result);
    });
  }

  /* -------------------
     CRUD / listing
     ------------------- */
  async loadOffers() {
    try {
      const db = await this.openDB();
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
      const db = await this.openDB();
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
  openOfferLetterModal() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    this.offerLetter['date'] = `${dd}/${mm}/${yyyy}`;

    if (this.selectedOffer) {
      Object.keys(this.offerLetter).forEach(key => {
        if (key !== 'date') {
          this.offerLetter[key as keyof typeof this.offerLetter]
            = this.selectedOffer[key] || '';
        }
      });
    } else {
      Object.keys(this.offerLetter).forEach(key => {
        if (key !== 'date') {
          this.offerLetter[key as keyof typeof this.offerLetter] = '';
        }
      });
    }

    this.showPdfFormModal = true;
  }

  closeOfferLetterModal() {
    this.showPdfFormModal = false;
  }

  // Helper: fetch customer object by name from customers store (scans all customers)
  async getCustomerByName(name: string) {
    try {
      const db = await this.openDB();
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

    const offer = this.selectedOffer;
    const customer = await this.getCustomerByName(offer.customerName || '');

    const doc = new jsPDF();

    const img = new Image();
    img.src = 'assets/Navbharat logo.png';

    img.onload = () => {
      // ---------------- HEADER IMAGE ----------------
      doc.addImage(img, 'PNG', 10, 0, 190, 60);

      // ---------------- REF + DATE ----------------
      const ref = (offer.offerRef || '').replace('/MDD', '');
      const rawDate = this.offerLetter['date'] || '';
      let formattedDate = '';

      if (rawDate) {
        const parts = rawDate.includes('-') ? rawDate.split('-') : rawDate.split('/');
        if (parts.length === 3) {
          formattedDate = parts[0].length === 4
            ? `${parts[2]}/${parts[1]}/${parts[0]}`
            : `${parts[0]}/${parts[1]}/${parts[2]}`;
        }
      }

      doc.setFontSize(10);
      doc.text(`Ref: ${ref}`, 20, 45);
      if (formattedDate) {
        doc.text(`Date: ${formattedDate}`, 190, 45, { align: 'right' });
      }

      // ---------------- TO BLOCK ----------------
      doc.setFontSize(12);
      doc.text('To,', 20, 60);
      doc.text(customer?.customerName || offer.customerName || 'Customer Name', 20, 70);

      let address = 'Customer Address';
      if (customer?.shipping) {
        address = `${customer.shipping.street || ''}, ${customer.shipping.area || ''}, ${customer.shipping.city || ''}, ${customer.shipping.state || ''}, ${customer.shipping.country || ''}, ${customer.shipping.pincode || ''}`;
      } else if (customer?.billing) {
        address = `${customer.billing.street || ''}, ${customer.billing.area || ''}, ${customer.billing.city || ''}, ${customer.billing.state || ''}, ${customer.billing.country || ''}, ${customer.billing.pincode || ''}`;
      }
      doc.text(address, 20, 80);

      // ---------------- SUBJECT ----------------
      doc.setFont('times', 'bold');
      doc.text(
        `Subject: ${this.offerLetter['subject'] || 'Your enquiry for supply of Product'}`,
        20,
        95
      );

      // ---------------- INTRO TEXT ----------------
      doc.setFont('times', 'normal');
      doc.setFontSize(11);

      const introText =
        this.offerLetter.introText ||
        'Please find attached the quotation we have prepared as per your requirement.';

      const introLines = doc.splitTextToSize(introText, 170);
      let y = 105;
      doc.text(introLines, 20, y);
      y += introLines.length * 5 + 5;

      // ---------------- SPEC TABLE ----------------
      const rows: any[] = [];
      const val = (key: keyof OfferLetter) =>
        (this.offerLetter[key] || '') ||
        (this.selectedOffer ? this.selectedOffer[key as any] || '' : '');

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
          fontSize: 9,
          font: 'times',
          cellPadding: 2
        },

        headStyles: {
          fillColor: [0, 0, 0],
          textColor: 255
        },

        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 125 }
        },

        margin: { bottom: 20 },
        pageBreak: 'avoid'
      });

      // Get position after table
      y = (doc as any).lastAutoTable.finalY + 8;

      // ---- CLOSING TEXT ----
      doc.setFontSize(11);

      const closingText =
        this.offerLetter.closingText ||
        'Kindly review the above quote and feel free to reach out if you need any clarification.';

      const closingLines = doc.splitTextToSize(closingText, 170);
      doc.text(closingLines, 20, y);
      y += closingLines.length * 5 + 8;

      // ---- SIGNATURE ----
      doc.text('Regards,', 20, y); y += 6;
      doc.text('For NAVBHARAT INSULATION & ENGG CO', 20, y); y += 6;
      doc.text('Authorized Signatory', 20, y); y += 10;

      // ---- FOOTER ----
      doc.setFontSize(9);
      doc.text(
        'A.N. HOUSE, TPS III, 31ST RD, LINKING RD, BANDRA, MUMBAI, MAHARASHTRA, INDIA 400050',
        105,
        y,
        { align: 'center' }
      );
      y += 5;

      doc.text(
        'E MAIL: info@navbharatgroup.com   URL: www.navbharatgroup.com',
        105,
        y,
        { align: 'center' }
      );

      doc.save(`Offer_${ref}.pdf`);
      this.closeOfferLetterModal();
    };
  }

  generateOfferPDFContent(doc: jsPDF, left: number) {
    let y = 35;
    const lineGap = 7;

    const displayRef = (this.selectedOffer?.offerRef || '').replace('/MDD', '');

    if (displayRef) {
      doc.text(`Ref: ${displayRef}`, left, y);
    }

    if (this.offerLetter.date) {
      doc.text(`Date: ${this.offerLetter.date}`, 160, y);
    }

    y += lineGap + 3;

    doc.text('To,', left, y); y += lineGap;

    if (this.selectedOffer?.customerName) {
      doc.text(this.selectedOffer.customerName, left, y);
      y += lineGap;
    }

    if (this.offerLetter.address) {
      doc.text(this.offerLetter.address, left, y);
      y += lineGap;
    }

    y += 4;

    if (this.offerLetter.subject) {
      doc.setFont('times', 'bold');
      doc.text(`Subject: ${this.offerLetter.subject}`, left, y);
      doc.setFont('times', 'normal');
      y += lineGap + 4;
    }

    if (this.offerLetter.introText) {
      const intro = doc.splitTextToSize(this.offerLetter.introText, 180);
      doc.text(intro, left, y);
      y += intro.length * lineGap + 4;
    }

    const specRows: any[] = [];
    const s = this.offerLetter;

    if (s.material) specRows.push(['Material', s.material]);
    if (s.density) specRows.push(['Density', s.density]);
    if (s.thickness) specRows.push(['Thickness', s.thickness]);
    if (s.size) specRows.push(['Size', s.size]);
    if (s.quantity) specRows.push(['Quantity', s.quantity]);
    if (s.rate) specRows.push(['Rate', s.rate]);
    if (s.taxes) specRows.push(['Taxes', s.taxes]);
    if (s.freight) specRows.push(['Freight', s.freight]);
    if (s.inspection) specRows.push(['Inspection', s.inspection]);
    if (s.packing) specRows.push(['Packing', s.packing]);
    if (s.loading) specRows.push(['Loading', s.loading]);
    if (s.deliveryTerms) specRows.push(['Delivery Terms', s.deliveryTerms]);
    if (s.paymentTerms) specRows.push(['Payment Terms', s.paymentTerms]);
    if (s.validity) specRows.push(['Offer Validity', s.validity]);

    if (specRows.length) {
      autoTable(doc, {
        startY: y,
        head: [['Specification', 'Details']],
        body: specRows,
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 120 }
        }
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (this.offerLetter.closingText) {
      const close = doc.splitTextToSize(this.offerLetter.closingText, 180);
      doc.text(close, left, y);
      y += close.length * lineGap + 6;
    }

    doc.text('Regards,', left, y); y += lineGap;
    doc.text('For NAVBHARAT INSULATION & ENGG CO', left, y); y += lineGap;
    doc.text('Authorized Signatory', left, y);

    doc.save(`Offer_${displayRef || 'Draft'}.pdf`);
    this.closeOfferLetterModal();
  }

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
      const db = await this.openDB();
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
      const db = await this.openDB();
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