import { Component, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DBService } from '../../service/db.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


/* =============================
   INTERFACES
============================= */

interface InquiryItem {
  productName?: string;
  make?: string;
  hsn?: string;

  form?: string;
  density?: string;
  thickness?: string;
  fsk?: string;

  qty?: number;
  uom?: string;
}


interface FollowUpEntry {
  date: string;
  note: string;
}

interface InquiryRecord {
  id?: number;
  date: string;

  // 🔹 COMPANY FIRST
  companyName?: string;

  // 🔹 AUTO-FILLED FROM CUSTOMER
  customerName: string;
  customerPhone?: string;
  email?: string;
  mobile?: string;

  billing?: {
    street?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };

  shipping?: {
    street?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };

  items: InquiryItem[];
  notes?: string;
  followUps: FollowUpEntry[];

  inquiryType?: string;
  decision?: 'Accepted' | 'Rejected';
  rejectionReason?: string;

  lost?: {
    reason: string;
    remarks: string;
    date: string;
  };

  status?: string;
}


@Component({
  selector: 'app-inquiry-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inquiry-master.component.html',
  styleUrls: ['./inquiry-master.component.css']
})
export class InquiryMasterComponent {

  /* -----------------------------
     CORE VARIABLES
  ----------------------------- */

  inquiries: InquiryRecord[] = [];
  filteredInquiries: InquiryRecord[] = [];
  searchTerm: string = '';

  showAddEditModal = false;
  showViewModal = false;
  showFollowUpModal = false;
  showLostModal = false;

  isEditing = false;
  currentInquiry: InquiryRecord | null = null;
  viewInquiryRecord: InquiryRecord | null = null;
  followUpTarget: InquiryRecord | null = null;

  newFollowUpNote: string = '';
  lostTarget: InquiryRecord | null = null;
  lostReasonText: string = '';
  lostRemarksText: string = '';
  customers: any[] = [];
  inventory: any[] = [];

  constructor(
    private dbService: DBService,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.loadInquiries();
  }

  activeMenuId: any = null;

  toggleActionMenu(event: Event, id: any) {
    event.stopPropagation();
    this.activeMenuId = this.activeMenuId === id ? null : id;
  }

  closeActionMenu() {
    this.activeMenuId = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    this.activeMenuId = null;
  }

  /* -----------------------------
     SALES ORDER NAVIGATION ✅
  ----------------------------- */
  openSalesOrder(inquiry: InquiryRecord) {
    this.router.navigate(['/sales-order']);
  }
  openpurchaseOrder(inquiry: InquiryRecord) {
    this.router.navigate(['/purchase-order']);
  }
  /* -----------------------------
     INDEXEDDB OPEN
  ----------------------------- */
  async openDB(): Promise<IDBDatabase> {
    return this.dbService.openDB();
  }


  ngOnInit() {
    this.loadInquiries();
    this.loadCustomers();
    this.loadInventory();
  }

  /* -----------------------------
     LOAD CUSTOMERS
  ----------------------------- */

  async loadCustomers() {
    const db = await this.dbService.openDB();
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');

    store.getAll().onsuccess = (e: any) => {
      this.customers = e.target.result || [];
    };
  }

  /* -----------------------------
     COMPANY SELECTION
  ----------------------------- */
  onCompanySelect() {
    if (!this.currentInquiry) return;

    const customer = this.customers.find(
      c => c.companyName === this.currentInquiry!.companyName
    );

    if (!customer) return;

    this.currentInquiry.customerName = customer.name || '';
    this.currentInquiry.customerPhone = customer.mobile || '';
    this.currentInquiry.email = customer.email || '';

    this.currentInquiry.billing = customer.billing
      ? { ...customer.billing }
      : {};

    this.currentInquiry.shipping = customer.shipping
      ? { ...customer.shipping }
      : {};
  }

  /* -----------------------------
   LOAD INVENTORY
----------------------------- */
  async loadInventory() {
    const db = await this.dbService.openDB();
    const tx = db.transaction('inventory', 'readonly');
    const store = tx.objectStore('inventory');

    store.getAll().onsuccess = (e: any) => {
      this.inventory = e.target.result || [];
    };
  }

  /* -----------------------------
    PRODUCT SELECTION
  ----------------------------- */

  // onProductSelect(item: any) {
  //   if (!item.productName) return;

  //   // 🔍 Find inventory by NAME KEY (dropdown value)
  //   const product = this.inventory.find(
  //     p => p.name === item.productName
  //   );

  //   if (!product) return;

  //   // ✅ SAVE DISPLAY NAME (what user sees)
  //   item.productName = product.displayName;

  //   // ✅ Autofill rest (unchanged)
  //   item.make = product.productMake || '';
  //   item.uom = product.unit || 'Nos';

  //   if (product.size) {
  //     const parts = product.size.split(',');
  //     item.density = parts[0]?.trim() || '';
  //     item.thickness = parts[1]?.trim() || '';
  //   }

  //   item.form = product.category || '';
  //   item.fsk = product.specifications || '';
  // }

  onProductSelect(it: any) {
    const selected = this.inventory.find((p: any) => {
      const invName = (p.displayName || p.name || '').toLowerCase().trim();
      const selName = (it.productName || '').toLowerCase().trim();
      return invName === selName;
    });

    if (!selected) {
      console.log('⚠️ Product not found in inventory:', it.productName);
      return;
    }

    console.log('✅ Selected product:', selected);
    console.log('📦 Product unit:', selected.unit);

    // Auto-fill all product details
    it.make = selected.productMake || '';
    it.hsn = selected.hsn || '';
    it.form = selected.category || '';
    it.density = selected.density || '';
    it.thickness = selected.size || '';
    it.uom = selected.unit || 'Nos'; // Default to 'Nos' if unit is missing

    console.log('✅ Item after auto-fill:', it);
  }

  /* -----------------------------
     LOAD INQUIRIES
  ----------------------------- */

  getDisplayInquiryId(id?: number): string {
    if (!id) return '-';
    return `INQ-${String(id).padStart(4, '0')}`;
  }


  async loadInquiries() {
    this.customers = await this.dbService.getAll('customers');
    const db = await this.dbService.openDB();
    const tx = db.transaction('inquiries', 'readonly');
    const store = tx.objectStore('inquiries');

    const result: InquiryRecord[] = [];

    return new Promise<void>((resolve) => {
      const req = store.openCursor();

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          this.inquiries = result;
          this.filteredInquiries = result;
          resolve();
          return;
        }

        const value = cursor.value as InquiryRecord;

        // ✅ inject real auto-generated ID
        value.id = cursor.primaryKey as number;

        result.push(value);
        cursor.continue();
      };
    });
  }

  /* -----------------------------
     SEARCH
  ----------------------------- */

  searchInquiries() {
    const term = this.searchTerm?.toLowerCase().trim();

    if (!term) {
      // ✅ SAME OBJECTS, SAME IDs
      this.filteredInquiries = this.inquiries;
      return;
    }

    this.filteredInquiries = this.inquiries.filter(inq =>
      inq.customerName?.toLowerCase().includes(term) ||
      inq.companyName?.toLowerCase().includes(term)
    );
  }


  clearFilter() {
    this.searchTerm = '';
    this.filteredInquiries = [...this.inquiries];
  }

  trackByInquiryId(index: number, inq: InquiryRecord) {
    return inq.id;
  }


  /* -----------------------------
     ADD / EDIT INQUIRY
  ----------------------------- */
  openAddModal() {
    this.isEditing = false;
    this.showAddEditModal = true;
    this.currentInquiry = {
      date: new Date().toISOString().slice(0, 10),
      companyName: '',
      customerName: '',
      customerPhone: '',
      email: '',
      billing: {},
      shipping: {},
      items: [{
        productName: '',
        make: '',
        hsn: '',
        form: '',
        density: '',
        thickness: '',
        fsk: '',
        qty: 1,
        uom: 'Nos'
      }],
      notes: '',
      followUps: []
    };
  }


  openEditModal(inq: InquiryRecord) {
    this.isEditing = true;
    this.currentInquiry = JSON.parse(JSON.stringify(inq));

    if (this.currentInquiry && !this.currentInquiry.date) {
      this.currentInquiry.date = new Date().toISOString().slice(0, 10);
    }

    this.showAddEditModal = true;
  }

  addItemRow() {
    if (!this.currentInquiry) return;
    // this.currentInquiry.items.push({ name: '', qty: 1, description: '' });
    this.currentInquiry.items.push({
      productName: '',
      make: '',
      hsn: '',
      form: '',
      density: '',
      thickness: '',
      fsk: '',
      qty: 1,
      uom: 'Nos'
    });

  }

  removeItemRow(i: number) {
    if (!this.currentInquiry) return;
    this.currentInquiry.items.splice(i, 1);
  }

  // async saveInquiry() {
  //   if (!this.currentInquiry) return;

  //   const payload = { ...this.currentInquiry };
  //   delete payload.id; // ✅ never poison again

  //   await this.dbService.add('inquiries', payload);
  //   await this.loadInquiries();

  //   this.showAddEditModal = false;
  //   this.currentInquiry = null;
  // }

  // async saveInquiry() {
  //   if (!this.currentInquiry) return;

  //   const db = await this.dbService.openDB();
  //   const tx = db.transaction('inquiries', 'readwrite');
  //   const store = tx.objectStore('inquiries');

  //   if (this.isEditing) {
  //     store.put(this.currentInquiry);   // update
  //   } else {
  //     store.add(this.currentInquiry);   // insert
  //   }

  //   tx.oncomplete = async () => {
  //     await this.loadInquiries();
  //     this.showAddEditModal = false;
  //     this.currentInquiry = null;
  //   };
  // }

  async saveInquiry() {
    if (!this.currentInquiry) return;

    const db = await this.dbService.openDB();

    return new Promise<void>((resolve) => {
      const tx = db.transaction('inquiries', 'readwrite');
      const store = tx.objectStore('inquiries');

      if (this.isEditing) {
        store.put(this.currentInquiry!);
        console.log('✏️ Editing existing inquiry - no reminder created');

      } else {
        const request = store.add(this.currentInquiry!);

        request.onsuccess = async () => {
          const savedId = request.result as number;
          console.log('═══════════════════════════════════════');
          console.log('✅ NEW INQUIRY SAVED');
          console.log('═══════════════════════════════════════');
          console.log('📄 Inquiry ID:', savedId);
          console.log('📄 Display ID:', this.getDisplayInquiryId(savedId));
          console.log('👤 Customer Name:', this.currentInquiry!.customerName);
          console.log('📱 Customer Phone:', this.currentInquiry!.customerPhone);
          console.log('📅 Inquiry Date:', this.currentInquiry!.date);
          console.log('───────────────────────────────────────');

          // 🔔 CREATE AUTO-REMINDER
          try {
            console.log('🔔 Creating auto-reminder with params:');
            console.log('  ├─ type: inquiry');
            console.log('  ├─ name:', this.currentInquiry!.customerName);
            console.log('  ├─ mobile:', this.currentInquiry!.customerPhone);
            console.log('  ├─ referenceNo:', this.getDisplayInquiryId(savedId));
            console.log('  ├─ followUpDays: 1');
            console.log('  └─ note: Follow-up inquiry', this.getDisplayInquiryId(savedId), '-', this.currentInquiry!.customerName);

            await this.dbService.createAutoReminder({
              type: 'inquiry',
              name: this.currentInquiry!.customerName,
              mobile: this.currentInquiry!.customerPhone,
              referenceNo: this.getDisplayInquiryId(savedId),
              followUpDays: 1,
              note: `Follow-up inquiry ${this.getDisplayInquiryId(savedId)} - ${this.currentInquiry!.customerName}`
            });

            console.log('✅ Reminder creation call completed');
            console.log('═══════════════════════════════════════');

          } catch (error) {
            console.error('❌ Reminder creation failed:', error);
            console.log('═══════════════════════════════════════');
          }
        };
      }

      tx.oncomplete = async () => {
        await this.loadInquiries();
        this.showAddEditModal = false;
        this.currentInquiry = null;
        resolve();
      };
    });
  }

  /* -----------------------------
     DELETE
  ----------------------------- */
  // async deleteInquiry(id: number, event?: Event) {
  //   console.log('🗑️ DELETE CLICKED, ID =', id);
  //   event?.stopPropagation();

  //   const db = await this.dbService.openDB();
  //   const tx = db.transaction('inquiries', 'readwrite');
  //   const store = tx.objectStore('inquiries');

  //   const req = store.delete(id);

  //   req.onsuccess = () => console.log('✅ Deleted ID:', id);
  //   req.onerror = () => console.error('❌ Delete failed', req.error);

  //   tx.oncomplete = async () => {
  //     await this.loadInquiries();
  //   };
  // }

  async deleteInquiry(id?: number, event?: Event) {
    console.log('🗑️ DELETE CLICKED, ID =', id);
    event?.stopPropagation();

    if (id === undefined) {
      console.error('❌ Cannot delete: ID is undefined');
      return;
    }

    const db = await this.dbService.openDB();
    const tx = db.transaction('inquiries', 'readwrite');
    tx.objectStore('inquiries').delete(id);

    tx.oncomplete = async () => {
      console.log('✅ Deleted ID:', id);
      await this.loadInquiries();
    };
  }



  /* -----------------------------
     VIEW MODAL
  ----------------------------- */
  openViewModal(inq: InquiryRecord) {
    this.viewInquiryRecord = inq;
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.viewInquiryRecord = null;
  }

  /* -----------------------------
     FOLLOW-UP MODAL
  ----------------------------- */

  openFollowUpModal(inq: InquiryRecord) {
    console.log('📌 openFollowUpModal called with:', inq);
    this.followUpTarget = inq;
    this.newFollowUpNote = '';
    this.showFollowUpModal = true;
  }


  closeFollowUpModal() {
    this.showFollowUpModal = false;
    this.followUpTarget = null;
  }

  async addFollowUp() {
    if (!this.followUpTarget || !this.newFollowUpNote.trim()) return;

    const entry: FollowUpEntry = {
      date: new Date().toLocaleDateString(),
      note: this.newFollowUpNote
    };

    this.followUpTarget.followUps.push(entry);

    const db = await this.dbService.openDB();
    const tx = db.transaction('inquiries', 'readwrite');
    tx.objectStore('inquiries').put(this.followUpTarget);

    tx.oncomplete = () => {
      this.closeFollowUpModal();
      this.loadInquiries();
    };
  }

  /* -----------------------------
     LOST INQUIRY
  ----------------------------- */
  // openLostModal(inq: InquiryRecord) {
  //   this.lostTarget = inq;
  //   this.lostReasonText = '';
  //   this.lostRemarksText = '';
  //   this.showLostModal = true;
  // }

  openLostModal(inq: InquiryRecord) {
    console.log('📌 openLostModal called with:', inq);
    this.lostTarget = inq;
    this.showLostModal = true;
  }

  closeLostModal() {
    this.showLostModal = false;
    this.lostTarget = null;
  }

  async markLost() {
    if (!this.lostTarget) return;

    this.lostTarget.lost = {
      reason: this.lostReasonText,
      remarks: this.lostRemarksText,
      date: new Date().toLocaleDateString()
    };

    const db = await this.dbService.openDB();
    const tx = db.transaction('inquiries', 'readwrite');
    tx.objectStore('inquiries').put(this.lostTarget);

    tx.oncomplete = () => {
      this.closeLostModal();
      this.loadInquiries();
    };
  }

  /* -----------------------------
     CREATE OFFER NAVIGATION
  ----------------------------- */
  goToCreateOffer(inquiryId: number) {
    this.router.navigate(['/create-offer'], { state: { inquiryId } });
  }

  downloadInquiryPdf(inq: InquiryRecord) {
    if (!inq) return;

    const doc = new jsPDF('p', 'mm', 'a4');

    // ===== HEADER =====
    doc.setFontSize(16);
    doc.text('Inquiry Details', 105, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Inquiry ID: ${this.getDisplayInquiryId(inq.id)}`, 14, 25);
    doc.text(`Date: ${inq.date || '-'}`, 14, 32);

    doc.text(`Company: ${inq.companyName || '-'}`, 14, 39);
    doc.text(`Customer: ${inq.customerName || '-'}`, 14, 46);
    doc.text(`Phone: ${inq.customerPhone || '-'}`, 14, 53);

    doc.text(`Inquiry Type: ${inq.inquiryType || '-'}`, 14, 60);
    doc.text(`Decision: ${inq.decision || 'Pending'}`, 14, 67);

    if (inq.decision === 'Rejected') {
      doc.text(`Reason: ${inq.rejectionReason || '-'}`, 14, 74);
    }

    // ===== ITEMS TABLE =====
    autoTable(doc, {
      startY: inq.decision === 'Rejected' ? 82 : 74,
      head: [[
        'Product',
        'Make',
        'HSN',
        'Specs',
        'Qty',
        'UOM'
      ]],
      body: inq.items.map(it => [
        it.productName || '',
        it.make || '',
        it.hsn || '',
        `${it.form || ''} ${it.density || ''} ${it.thickness || ''} ${it.fsk || ''}`.trim(),
        it.qty ?? '',
        it.uom || ''
      ]),
      styles: {
        fontSize: 9
      },
      headStyles: {
        fillColor: [13, 42, 77] // navy blue
      }
    });

    // ===== NOTES =====
    let y = (doc as any).lastAutoTable.finalY + 10;

    if (inq.notes) {
      doc.setFontSize(10);
      doc.text('Notes:', 14, y);
      doc.setFontSize(9);
      doc.text(inq.notes, 14, y + 6, { maxWidth: 180 });
      y += 20;
    }

    // ===== FOLLOW UPS =====
    if (inq.followUps && inq.followUps.length > 0) {
      doc.setFontSize(10);
      doc.text('Follow-Ups:', 14, y);

      autoTable(doc, {
        startY: y + 6,
        head: [['Date', 'Note']],
        body: inq.followUps.map(f => [f.date, f.note]),
        styles: { fontSize: 9 },
        headStyles: {
          fillColor: [100, 100, 100]
        }
      });
    }

    // ===== SAVE =====
    const fileName = `${this.getDisplayInquiryId(inq.id)}.pdf`;
    doc.save(fileName);
  }

}