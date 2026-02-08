import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { DBService } from '../../service/db.service';

interface FileAttachment {
  name: string;
  type: string;
  data: string;
}

interface Vendor {
  id?: number;
  vendorId?: string;
  vendorVertical?: string;
  vendorType?: string;
  companyName?: string;
  category?: string;
  brandName?: string;
  contactPerson?: string;

  billing: {
    street: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };

  shipping: {
    street: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };

  website?: string;
  email?: string;
  mobile?: string;

  gst?: string;
  pan?: string;
  msme?: string;

  gstFile?: FileAttachment;
  panFile?: FileAttachment;
  msmeFile?: FileAttachment;

  paymentTerms?: string;
  product?: string;
}

@Component({
  selector: 'app-vendor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor.component.html',
  styleUrls: ['./vendor.component.css']
})
export class VendorComponent implements OnInit {

  vendors: Vendor[] = [];
  filteredVendors: Vendor[] = [];
  newVendor: Vendor = this.getEmptyVendor();

  isEditing = false;
  showModal = false;
  searchTerm = '';
  editingIndex = -1;

  // ✅ NEW: checkbox state
  sameAsBilling = false;

  constructor(private dbService: DBService) { }

  ngOnInit() {
    this.loadVendors();
  }

  private getEmptyVendor(): Vendor {
    return {
      vendorVertical: '',
      vendorType: '',
      companyName: '',
      category: '',
      brandName: '',
      contactPerson: '',
      website: '',
      email: '',
      mobile: '',
      gst: '',
      pan: '',
      msme: '',
      paymentTerms: '',
      product: '',

      billing: {
        street: '',
        area: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India'
      },

      shipping: {
        street: '',
        area: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India'
      }
    };
  }

  private generateVendorId(): string {
    let max = 0;

    for (const v of this.vendors) {
      if (!v.vendorId) continue;
      const match = v.vendorId.match(/^VEN-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }

    return 'VEN-' + (max + 1).toString().padStart(3, '0');
  }

  // ---------------- LOAD ----------------
  async loadVendors() {
    const db = await this.dbService.openDB();
    const tx = db.transaction('vendors', 'readonly');
    const store = tx.objectStore('vendors');

    store.getAll().onsuccess = (e: any) => {
      this.vendors = e.target.result || [];
      this.filteredVendors = [...this.vendors];
    };
  }

  // ---------------- FILTER ----------------
  filterVendors() {
    const search = (this.searchTerm || '').toLowerCase();
    this.filteredVendors = !search
      ? [...this.vendors]
      : this.vendors.filter(v =>
        JSON.stringify(v).toLowerCase().includes(search)
      );
  }

  // ---------------- MODAL ----------------
  openAddModal() {
    this.isEditing = false;
    this.sameAsBilling = false;
    this.newVendor = this.getEmptyVendor();
    this.showModal = true;
  }

  openEditModal(i: number) {
    this.isEditing = true;
    this.editingIndex = i;

    const v = JSON.parse(JSON.stringify(this.filteredVendors[i]));

    v.billing = v.billing || {
      street: '', area: '', city: '', state: '', pincode: '', country: 'India'
    };

    v.shipping = v.shipping || {
      street: '', area: '', city: '', state: '', pincode: '', country: 'India'
    };

    // ✅ NEW: auto-check checkbox if already same
    this.sameAsBilling =
      JSON.stringify(v.billing) === JSON.stringify(v.shipping);

    this.newVendor = v;
    this.showModal = true;
  }

  cancelModal() {
    this.showModal = false;
    this.sameAsBilling = false;
    this.newVendor = this.getEmptyVendor();
    this.isEditing = false;
    this.editingIndex = -1;
  }

  // ---------------- SAVE ----------------
  async submitForm() {
    const db = await this.dbService.openDB();
    const store = db.transaction('vendors', 'readwrite').objectStore('vendors');

    if (!this.isEditing) {
      this.newVendor.vendorId = this.generateVendorId();
    }

    this.isEditing
      ? store.put(this.newVendor)
      : store.add(this.newVendor);

    this.cancelModal();
    this.loadVendors();
  }

  // ---------------- SAME AS BILLING ----------------
  toggleSameAsBilling() {
    if (this.sameAsBilling) {
      this.newVendor.shipping = {
        ...this.newVendor.billing
      };
    }
  }

  // ---------------- DELETE ----------------
  async deleteVendor(idx: number) {
    if (!confirm('Delete this vendor?')) return;

    const vendor = this.filteredVendors[idx];
    const key = vendor.id ?? vendor.vendorId;
    if (!key) return;

    const db = await this.dbService.openDB();
    const tx = db.transaction('vendors', 'readwrite');
    tx.objectStore('vendors').delete(key);

    tx.oncomplete = () => this.loadVendors();
  }

  // ---------------- FILE HELPERS ----------------
  private readFile(file: File, cb: (f: FileAttachment) => void) {
    const r = new FileReader();
    r.onload = () => cb({
      name: file.name,
      type: file.type,
      data: r.result as string
    });
    r.readAsDataURL(file);
  }

  onGstFileSelect(e: any) {
    this.readFile(e.target.files[0], f => this.newVendor.gstFile = f);
  }

  onPanFileSelect(e: any) {
    this.readFile(e.target.files[0], f => this.newVendor.panFile = f);
  }

  onMsmeFileSelect(e: any) {
    this.readFile(e.target.files[0], f => this.newVendor.msmeFile = f);
  }

  onGstFileSelectFromTable(e: any, v: Vendor) {
    this.saveFile(e, v, 'gstFile');
  }

  onPanFileSelectFromTable(e: any, v: Vendor) {
    this.saveFile(e, v, 'panFile');
  }

  onMsmeFileSelectFromTable(e: any, v: Vendor) {
    this.saveFile(e, v, 'msmeFile');
  }

  private async saveFile(
    e: any,
    vendor: Vendor,
    key: 'gstFile' | 'panFile' | 'msmeFile'
  ) {
    const file = e.target.files[0];
    if (!file) return;

    this.readFile(file, async f => {
      vendor[key] = f;
      const db = await this.dbService.openDB();
      db.transaction('vendors', 'readwrite')
        .objectStore('vendors')
        .put(vendor);
    });
  }

  async removeGSTFile(vendor: any) {
    if (!confirm('Remove GST document?')) return;
    vendor.gstFile = undefined;
    const db = await this.dbService.openDB();
    db.transaction('vendors', 'readwrite').objectStore('vendors').put(vendor);
  }

  async removePanFile(vendor: any) {
    if (!confirm('Remove PAN document?')) return;
    vendor.panFile = undefined;
    const db = await this.dbService.openDB();
    db.transaction('vendors', 'readwrite').objectStore('vendors').put(vendor);
  }

  async removeMSMEFile(vendor: any) {
    if (!confirm('Remove MSME document?')) return;
    vendor.msmeFile = undefined;
    vendor.msme = '';
    const db = await this.dbService.openDB();
    db.transaction('vendors', 'readwrite').objectStore('vendors').put(vendor);
  }

  // ---------------- EXCEL ----------------
  handleExcel(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      this.importVendorsFromExcel(rows);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }

  async importVendorsFromExcel(rows: any[][]) {
    const db = await this.dbService.openDB();
    const tx = db.transaction('vendors', 'readwrite');
    const store = tx.objectStore('vendors');

    let last = 0;
    this.vendors.forEach(v => {
      if (v.vendorId?.startsWith('VEN-')) {
        const n = parseInt(v.vendorId.replace('VEN-', ''), 10);
        if (!isNaN(n)) last = Math.max(last, n);
      }
    });

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[2]) continue;

      last++;

      await store.add({
        vendorId: `VEN-${last.toString().padStart(3, '0')}`,
        vendorVertical: r[0] || '',
        vendorType: r[1] || '',
        companyName: r[2] || '',
        category: r[3] || '',
        brandName: r[4] || '',
        contactPerson: r[5] || '',
        mobile: r[6] || '',
        email: r[7] || '',
        website: r[8] || '',
        billing: {
          street: r[9] || '',
          area: r[10] || '',
          city: r[11] || '',
          state: r[12] || '',
          pincode: r[13] || '',
          country: 'India'
        },
        shipping: {
          street: r[14] || '',
          area: r[15] || '',
          city: r[16] || '',
          state: r[17] || '',
          pincode: r[18] || '',
          country: 'India'
        },
        gst: r[19] || '',
        pan: r[20] || '',
        msme: r[21] || '',
        paymentTerms: r[22] || '',
        product: r[23] || ''
      });
    }

    tx.oncomplete = () => this.loadVendors();
  }

  downloadExcel() {
    const ws = XLSX.utils.json_to_sheet(
      this.vendors.map(v => ({
        'Vertical': v.vendorVertical || '',
        'Vendor Type': v.vendorType || '',
        'Company Name': v.companyName || '',
        'Category': v.category || '',
        'Brand Name': v.brandName || '',
        'Contact Person': v.contactPerson || '',
        'Mobile': v.mobile || '',
        'Email': v.email || '',
        'GST': v.gst || '',
        'PAN': v.pan || '',
        'MSME': v.msme || '',
        'Payment Terms': v.paymentTerms || '',
        'Product': v.product || ''
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    XLSX.writeFile(wb, 'Vendor-List.xlsx');
  }
}
