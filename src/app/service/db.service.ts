import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DBService {
  private DB_NAME = 'crm-db';

  // ⭐ BUMP VERSION (MUST be higher than current 101)
  private DB_VERSION = 111;

  openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        // master store definitions
        const STORES: Record<string, IDBObjectStoreParameters> = {
          customers: { keyPath: 'id', autoIncrement: true },
          inquiries: { keyPath: 'id', autoIncrement: true },
          inventory: { keyPath: 'name' },
          offers: { keyPath: 'id', autoIncrement: true },
          vendors: { keyPath: 'vendorId' },
          orders: { keyPath: 'id', autoIncrement: true },
          invoices: { keyPath: 'id', autoIncrement: true },
          reminders: { keyPath: 'id', autoIncrement: true },
          'reminder-history': { keyPath: 'id', autoIncrement: true },
          proformas: { keyPath: 'id', autoIncrement: true },
          salesOrders: { keyPath: 'id', autoIncrement: true },
          sales_order_items: { keyPath: 'id', autoIncrement: true },
          purchaseOrders: { keyPath: 'id', autoIncrement: true },
          payments: { keyPath: 'id' },
        };

        // safely create stores if not exist
        Object.entries(STORES).forEach(([name, config]) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, config);
            console.log('DB: created store', name);
          }
        });
      };

      // request.onsuccess = () => resolve(request.result);
      request.onsuccess = () => {
        const db = request.result;
        console.log("🟢 DB opened with stores:", Array.from(db.objectStoreNames));
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // GENERIC HELPERS
  async getAll(storeName: string): Promise<any[]> {
    const db = await this.openDB();
    return new Promise(resolve => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async add(storeName: string, obj: any): Promise<any> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).add(obj);
      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('crm-db-changed', { detail: { store: storeName, type: 'add' } }));
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName: string, obj: any): Promise<any> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(obj);
      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('crm-db-changed', { detail: { store: storeName, type: 'put' } }));
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName: string, key: any): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('crm-db-changed', { detail: { store: storeName, type: 'delete' } }));
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }


  async addOrUpdateSalesOrder(data: any) {
    console.log('📦 DBService.addOrUpdateSalesOrder called with:', data);

    const db = await this.openDB();

    console.log(
      '📦 Stores available in DBService:',
      Array.from(db.objectStoreNames)
    );

    const tx = db.transaction('salesOrders', 'readwrite');
    const store = tx.objectStore('salesOrders');

    const req = store.put(data);

    req.onsuccess = () => {
      console.log('✅ sales_order saved successfully:', data);
    };

    req.onerror = () => {
      console.error('❌ Failed to save sales_order', req.error);
    };
  }

  getSalesOrders(): Promise<any[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.openDB();
        const tx = db.transaction('salesOrders', 'readonly');
        const req = tx.objectStore('salesOrders').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async getSalesOrderByNo(orderNo: string) {
    const db = await this.openDB();
    const tx = db.transaction('salesOrders', 'readonly');
    const store = tx.objectStore('salesOrders');

    return new Promise<any>(resolve => {
      const req = store.getAll();

      req.onsuccess = () => {
        const found = req.result.find((o: any) => o.orderNo === orderNo);
        resolve(found ?? null);
      };

      req.onerror = () => resolve(null);
    });
  }

  addOrder(order: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.openDB();
        const tx = db.transaction('orders', 'readwrite');
        const store = tx.objectStore('orders');

        store.put(order); // put = add or update

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getPurchaseOrderByNo(poNumber: string) {
    const db = await this.openDB();
    const tx = db.transaction('purchaseOrders', 'readonly');
    const store = tx.objectStore('purchaseOrders');

    return new Promise<any>(resolve => {
      const req = store.getAll();
      req.onsuccess = () => {
        const found = req.result.find((p: any) => p.poNumber === poNumber);
        resolve(found ?? null);
      };
      req.onerror = () => resolve(null);
    });
  }

  async getAllProformas(): Promise<any[]> {
    return this.getAll('proformas'); // ⭐ ADDED
  }

  async addProforma(p: any): Promise<any> {
    return this.add('proformas', p); // ⭐ ADDED
  }

  async updateProforma(p: any): Promise<any> {
    return this.put('proformas', p); // ⭐ ADDED
  }

  async deleteProforma(id: any): Promise<void> {
    return this.delete('proformas', id); // ⭐ ADDED
  }

  // Existing helpers
  async getAllInvoices(): Promise<any[]> {
    return this.getAll('invoices');
  }

  async addInvoice(invoice: any): Promise<any> {
    return this.add('invoices', invoice);
  }

  async updateInvoice(invoice: any): Promise<any> {
    return this.put('invoices', invoice);
  }

  async deleteInvoice(id: any): Promise<void> {
    return this.delete('invoices', id);
  }

  async getCustomerByName(name: string): Promise<any> {
    const db = await this.openDB();
    return new Promise(resolve => {
      const tx = db.transaction('customers', 'readonly');
      const req = tx.objectStore('customers').getAll();
      req.onsuccess = () => {
        resolve(req.result.find((c: any) =>
          c.name?.toLowerCase() === name.toLowerCase()
        ) || null);
      };
      req.onerror = () => resolve(null);
    });
  }

  async getAllReminders(): Promise<any[]> {
    return this.getAll('reminders');
  }

  async addReminder(reminder: any): Promise<any> {
    return this.add('reminders', reminder);
  }

  async updateReminder(reminder: any): Promise<any> {
    return this.put('reminders', reminder);
  }

  async deleteReminder(id: number): Promise<void> {
    return this.delete('reminders', id);
  }

  async createAutoReminder(config: {
    type: 'offer' | 'inquiry' | 'order';
    name: string;
    mobile?: string;
    referenceNo: string;
    followUpDays: number;
    note?: string;
  }): Promise<any> {
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + config.followUpDays);

    const reminder = {
      date: reminderDate.toISOString().slice(0, 10),
      time: '10:00',
      type: config.type,
      name: config.name,
      mobile: config.mobile || '',
      referenceNo: config.referenceNo,
      note: config.note || `Follow-up for ${config.type} ${config.referenceNo}`,
      source: 'system',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const result = await this.addReminder(reminder);
    console.log(`✅ Auto-reminder created for ${config.type}:`, reminder);

    return result;
  }

  async addOrUpdatePurchaseOrder(po: any) {
    const db = await this.openDB();
    const tx = db.transaction('purchaseOrders', 'readwrite');
    const store = tx.objectStore('purchaseOrders');

    return new Promise<void>((resolve, reject) => {
      const req = store.put(po); // put = add OR update (uses id)
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }


  async getAllPurchaseOrders(): Promise<any[]> {
    const db = await this.openDB();
    const tx = db.transaction('purchaseOrders', 'readonly');
    const store = tx.objectStore('purchaseOrders');

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }


  async deletePurchaseOrder(id: number) {
    const db = await this.openDB();
    const tx = db.transaction('purchaseOrders', 'readwrite');
    const store = tx.objectStore('purchaseOrders');

    return new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }


}
