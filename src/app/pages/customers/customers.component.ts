import { Component } from '@angular/core';
import { read, writeFileXLSX } from 'xlsx';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { utils, writeFile } from 'xlsx';
import { DBService } from '../../service/db.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css'
})
export class CustomersComponent {
  customers: any[] = [];
  searchTerm = '';
  showModal = false;
  isEditing = false;
  editingIndex: number | null = null;
  newCustomer: any = this.getEmptyCustomer();

  businessVerticals: string[] = [
    'Projects',
    'Material Distribution Division',
    'Both'
  ];
  onPanFileSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.newCustomer.panFile = {
        name: file.name,
        type: file.type,
        data: reader.result as string
      };
    };
    reader.readAsDataURL(file);
  }
  async onPanFileSelectFromTable(event: any, customer: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      customer.panFile = {
        name: file.name,
        type: file.type,
        data: reader.result as string
      };

      // 🔐 persist immediately
      const db = await this.dbService.openDB();
      const tx = db.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      await store.put(customer);
    };
    reader.readAsDataURL(file);
  }

  onGSTFileSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.newCustomer.panFile = {
        name: file.name,
        type: file.type,
        data: reader.result as string
      };
    };
    reader.readAsDataURL(file);
  }
  async onGSTFileSelectFromTable(event: any, customer: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      customer.GSTFile = {
        name: file.name,
        type: file.type,
        data: reader.result as string
      };

      // 🔐 persist immediately
      const db = await this.dbService.openDB();
      const tx = db.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      await store.put(customer);
    };
    reader.readAsDataURL(file);
  }


  constructor(private router: Router, private dbService: DBService) {
    this.loadFromIndexedDB();
  }

  // generateCustomerId() {
  //   const year = new Date().getFullYear();
  //   const seq = Math.floor((Date.now() % 100000) / 10)
  //     .toString()
  //     .padStart(4, '0');
  //   return `CUS/${year}/${seq}`;
  // }

  generateCustomerId(customers: any[]): string {
    let maxNumber = 0;

    customers.forEach(c => {
      if (c.customerId && c.customerId.startsWith('CUS-')) {
        const num = parseInt(c.customerId.replace('CUS-', ''), 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    const nextNumber = maxNumber + 1;
    return `CUS-${nextNumber.toString().padStart(3, '0')}`;
  }


  getEmptyCustomer() {
    return {
      id: undefined,
      customerId: '', // ❗ DO NOT generate ID here
      name: '',
      companyName: '',
      email: '',
      mobile: '',
      gstin: '',
      pan: '',
      panFile: undefined,
      msme: '',
      msmeFile: undefined,
      billing: { street: '', area: '', pincode: '', city: '', state: '', country: '' },
      shipping: { street: '', area: '', pincode: '', city: '', state: '', country: '' },
      businessVertical: '',
    };
  }


  async loadFromIndexedDB() {
    const db = await this.dbService.openDB();
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    const all = await store.getAll();
    const getAllRequest = store.getAll();
    getAllRequest.onsuccess = () => {
      const all = getAllRequest.result;
      this.customers = all;
      console.log('Loaded customers from IndexedDB:', this.customers);
    };

  }

  async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('crm-db', 5);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('customers')) {
          db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  filteredCustomers() {
    return this.customers.filter(c => {
      const str = JSON.stringify(c).toLowerCase();
      return str.includes(this.searchTerm.toLowerCase());
    });
  }

  openAddModal() {
    this.isEditing = false;
    this.showModal = true;
    this.newCustomer = this.getEmptyCustomer();
    this.dbService.getAll('customers').then(customers => {
      this.newCustomer.customerId = this.generateCustomerId(customers);
    });
  }

  openEditModal(index: number) {
    this.newCustomer = JSON.parse(JSON.stringify(this.customers[index]));
    this.isEditing = true;
    this.editingIndex = index;
    this.showModal = true;
  }

  cancelModal() {
    this.showModal = false;
    this.newCustomer = this.getEmptyCustomer();
  }

  async submitForm() {

    if (!this.newCustomer.name || this.newCustomer.name.trim() === "") {
      return;
    }

    const db = await this.dbService.openDB();
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');


    if (this.isEditing && this.editingIndex !== null) {
      const existing = this.customers[this.editingIndex];
      this.newCustomer.id = existing.id;
      await store.put(this.newCustomer);
      this.customers[this.editingIndex] = JSON.parse(JSON.stringify(this.newCustomer));
    }
    // else {
    //       const id = await store.add(this.newCustomer);
    //       this.newCustomer.id = id;
    //       this.customers.push(this.newCustomer);
    //     }

    else {
      this.newCustomer.id = Date.now();
      await store.add(this.newCustomer);
      this.customers.push(
        JSON.parse(JSON.stringify(this.newCustomer))
      );
    }


    this.cancelModal();

  }
  // ================= MSME FILE =================

  onMsmeFileSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.newCustomer.msmeFile = {
        name: file.name,
        type: file.type,
        data: reader.result as string
      };
    };
    reader.readAsDataURL(file);
  }

  async onMsmeFileSelectFromTable(event: any, customer: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      customer.msmeFile = {
        name: file.name,
        type: file.type,
        data: reader.result as string
      };

      const db = await this.dbService.openDB();
      const tx = db.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      await store.put(customer);
    };
    reader.readAsDataURL(file);
  }


  async deleteCustomer(index: number) {
    const db = await this.dbService.openDB(); const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    const id = this.customers[index].id;
    await store.delete(id);
    this.customers.splice(index, 1);
  }

  async resetCustomers() {
    const db = await this.dbService.openDB(); const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    store.clear();
    this.customers = [];
  }

  onFileChange(evt: any) {
    const target: DataTransfer = <DataTransfer>evt.target;
    if (target.files.length !== 1) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const bstr = e.target.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws);

      const formatted = data.map((row: any) => ({
        id: Date.now() + Math.random(),
        name: row['Name'] || '',
        companyName: row['Company Name'] || '',
        email: row['Email'] || '',
        mobile: row['Mobile'] || '',
        gstin: row['GSTIN'] || '',
        GSTFile: undefined, // ✅ ADD THIS
        pan: row['PAN'] || '',
        msme: row['MSME'] || '',
        msmeFile: undefined,
        billing: {
          street: row['Billing Street'] || '',
          area: row['Billing Area'] || '',
          pincode: row['Billing Pincode'] || '',
          city: row['Billing City'] || '',
          state: row['Billing State'] || '',
          country: row['Billing Country'] || '',
        },
        shipping: {
          street: row['Shipping Street'] || '',
          area: row['Shipping Area'] || '',
          pincode: row['Shipping Pincode'] || '',
          city: row['Shipping City'] || '',
          state: row['Shipping State'] || '',
          country: row['Shipping Country'] || '',
        },
      }));

      const db = await this.dbService.openDB();
      const tx = db.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      store.clear();
      formatted.forEach(c => store.add(c));
      this.customers = formatted;
    };
    reader.readAsBinaryString(target.files[0]);
  }

  downloadExcel() {
    this.dbService.getAll('customers').then((customers: any[]) => {

      const formattedCustomers = customers.map(c => ({
        'Name': c.name || '',
        'Company Name': c.companyName || '',
        'Email': c.email || '',
        'Mobile': c.mobile || '',
        'GSTIN': c.gstin || '',
        'PAN': c.pan || '',
        'MSME': c.msme || '',

        'Billing Street': c.billing?.street || '',
        'Billing Area': c.billing?.area || '',
        'Billing Pincode': c.billing?.pincode || '',
        'Billing City': c.billing?.city || '',
        'Billing State': c.billing?.state || '',
        'Billing Country': c.billing?.country || '',

        'Shipping Street': c.shipping?.street || '',
        'Shipping Area': c.shipping?.area || '',
        'Shipping Pincode': c.shipping?.pincode || '',
        'Shipping City': c.shipping?.city || '',
        'Shipping State': c.shipping?.state || '',
        'Shipping Country': c.shipping?.country || '',
      }));

      const ws = utils.json_to_sheet(formattedCustomers);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Customers');

      writeFile(wb, 'Customers.xlsx');
    });
  }



  goToInquiries(customer: any) {
    this.router.navigate(['/items'], { state: { customer } });
  }
}
