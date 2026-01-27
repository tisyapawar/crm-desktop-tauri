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

  // ✅ SAME IDEA AS CUSTOMER BUSINESS VERTICAL
  vendorVertical?: string;

  vendorType?: string;
  companyName?: string;
  category?: string;
  brandName?: string;
  contactPerson?: string;
  address?: string;
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

    const next = max + 1;
    return 'VEN-' + next.toString().padStart(3, '0');
  }

  vendors: Vendor[] = [];
  filteredVendors: Vendor[] = [];
  newVendor: Vendor = {} as Vendor;

  isEditing = false;
  showModal = false;
  searchTerm = '';
  editingIndex = -1;

  constructor(private dbService: DBService) { }

  ngOnInit() {
    this.loadVendors();
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

  // ---------------- RESET ----------------
  async resetVendors() {
    if (!confirm('Remove all vendors?')) return;
    const db = await this.dbService.openDB();
    const tx = db.transaction('vendors', 'readwrite');
    tx.objectStore('vendors').clear();
    tx.oncomplete = () => {
      this.vendors = [];
      this.filteredVendors = [];
    };
  }

  // ---------------- MODAL ----------------
  openAddModal() {
    this.isEditing = false;
    this.newVendor = {
      vendorVertical: ''   // ✅ INIT LIKE CUSTOMER
    };
    this.showModal = true;
  }

  openEditModal(i: number) {
    this.isEditing = true;
    this.editingIndex = i;
    this.newVendor = JSON.parse(JSON.stringify(this.filteredVendors[i]));
    this.showModal = true;
  }

  cancelModal() {
    this.showModal = false;
    this.newVendor = {} as Vendor;
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

  // MODAL FILES
  onGstFileSelect(e: any) { this.readFile(e.target.files[0], f => this.newVendor.gstFile = f); }
  onPanFileSelect(e: any) { this.readFile(e.target.files[0], f => this.newVendor.panFile = f); }
  onMsmeFileSelect(e: any) { this.readFile(e.target.files[0], f => this.newVendor.msmeFile = f); }

  // TABLE FILES
  onGstFileSelectFromTable(e: any, v: Vendor) { this.saveFile(e, v, 'gstFile'); }
  onPanFileSelectFromTable(e: any, v: Vendor) { this.saveFile(e, v, 'panFile'); }
  onMsmeFileSelectFromTable(e: any, v: Vendor) { this.saveFile(e, v, 'msmeFile'); }

  private async saveFile(e: any, vendor: Vendor, key: 'gstFile' | 'panFile' | 'msmeFile') {
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

  // ---------------- EXCEL IMPORT ----------------
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

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;

      store.add({
        vendorId: r[0] || 'V' + Date.now() + '_' + i,
        vendorVertical: r[1] || '',    // ✅ SAME AS CUSTOMER
        vendorType: r[2] || '',
        companyName: r[3] || '',
        category: r[4] || '',
        brandName: r[5] || '',
        contactPerson: r[6] || '',
        address: r[7] || '',
        website: r[8] || '',
        email: r[9] || '',
        mobile: r[10] || '',
        gst: r[11] || '',
        pan: r[12] || '',
        msme: r[13] || '',
        paymentTerms: r[14] || '',
        product: r[15] || ''
      });
    }

    tx.oncomplete = () => this.loadVendors();
  }

  // ---------------- EXCEL EXPORT ----------------
  downloadExcel() {
    const ws = XLSX.utils.json_to_sheet(
      this.vendors.map(v => ({
        'Vendor ID': v.vendorId || '',
        'Vendor Vertical': v.vendorVertical || '',
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
