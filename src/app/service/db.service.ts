import { Injectable } from '@angular/core';

// ===== INTERFACES =====
interface SalesOrder {
  id?: number;
  orderNo: string;
  orderDate: string;
  customerName: string;
  customerId: string;
  billAddr: string;
  shipAddr: string;
  gstNo?: string;
  items: Array<any>;
  freightCharges: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  createdAt: string;
}

interface Customer {
  id?: number;
  name: string;
  companyName: string;
  email?: string;
  mobile?: string;
  gstin?: string;
  billing?: any;
  shipping?: any;
}

// ✅ FIXED: Extended reminder types
interface ReminderConfig {
  type: 'offer' | 'inquiry' | 'order' | 'proforma' | 'invoice' | 'call' | 'payment' | 'general';
  name: string;
  mobile?: string;
  referenceNo: string;
  followUpDays: number;
  note?: string;
}

// ✅ FIXED: Made referenceNo optional, allow any extra properties
interface Reminder {
  id?: number;
  date: string;
  time: string;
  type: 'offer' | 'inquiry' | 'order' | 'proforma' | 'invoice' | 'call' | 'payment' | 'general';
  name: string;
  mobile: string;
  referenceNo?: string;  // ✅ Optional
  note: string;
  source: 'system' | 'manual';
  status: 'pending' | 'completed' | 'dismissed';
  createdAt: string;
  [key: string]: any;  // ✅ Allow extra properties
}

interface DbValidationResult {
  valid: boolean;
  stores: Record<string, number>;
  errors: string[];
}

// ===== DATABASE SERVICE =====
@Injectable({ providedIn: 'root' })
export class DBService {
  private DB_NAME = 'crm-db';
  private DB_VERSION = 111;

  // ✅ Cache DB connection to prevent race conditions
  private cachedDB: IDBDatabase | null = null;
  private dbOpenPromise: Promise<IDBDatabase> | null = null;

  /**
   * ✅ IMPROVED: Cache DB connection and handle concurrent access
   */
  openDB(): Promise<IDBDatabase> {
    // Return cached DB if available and open
    if (this.cachedDB && !this.cachedDB.onclose) {
      return Promise.resolve(this.cachedDB);
    }

    // If already opening, return existing promise to prevent race conditions
    if (this.dbOpenPromise) {
      return this.dbOpenPromise;
    }

    this.dbOpenPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;

          // Master store definitions
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
            payments: { keyPath: 'id' }
          };

          // Safely create stores if not exist
          Object.entries(STORES).forEach(([name, config]) => {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name, config);
              console.log('✅ DB: created store', name);
            }
          });
        };

        request.onsuccess = () => {
          const db = request.result;

          // Handle connection close
          db.onclose = () => {
            console.warn('⚠️ DB connection closed');
            this.cachedDB = null;
          };

          console.log('🟢 DB opened with stores:', Array.from(db.objectStoreNames));
          this.cachedDB = db;
          this.dbOpenPromise = null;
          resolve(db);
        };

        request.onerror = () => {
          console.error('❌ Failed to open database:', request.error);
          this.dbOpenPromise = null;
          reject(new Error(`Failed to open database: ${request.error}`));
        };

        request.onblocked = () => {
          console.warn('⚠️ Database open blocked (other tabs open?)');
        };
      } catch (error) {
        console.error('❌ Exception opening database:', error);
        this.dbOpenPromise = null;
        reject(error);
      }
    });

    return this.dbOpenPromise;
  }

  /**
   * ✅ IMPROVED: Store validation before operations
   */
  private validateStore(db: IDBDatabase, storeName: string): void {
    if (!db.objectStoreNames.contains(storeName)) {
      const available = Array.from(db.objectStoreNames).join(', ');
      throw new Error(
        `Store "${storeName}" does not exist. Available stores: ${available}`
      );
    }
  }

  /**
   * ✅ IMPROVED: Centralized event dispatcher
   */
  private dispatchDbEvent(store: string, type: 'add' | 'put' | 'delete', id?: any): void {
    try {
      const event = new CustomEvent('crm-db-changed', {
        detail: {
          store,
          type,
          id,
          timestamp: new Date().toISOString()
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('❌ Failed to dispatch DB event:', error);
    }
  }

  // ===== GENERIC CRUD METHODS =====

  /**
   * ✅ IMPROVED: Better error handling
   */
  async getAll(storeName: string): Promise<any[]> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      try {
        this.validateStore(db, storeName);

        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => {
          console.log(`✅ Retrieved ${req.result.length} records from ${storeName}`);
          resolve(req.result || []);
        };

        req.onerror = () => {
          const error = `Failed to read from ${storeName}: ${req.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };

        tx.onerror = () => {
          const error = `Transaction error in ${storeName}: ${tx.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };
      } catch (error) {
        console.error(`❌ Exception in getAll(${storeName}):`, error);
        reject(error);
      }
    });
  }

  /**
   * ✅ FIXED: Proper return type as number
   */
  async add(storeName: string, obj: any): Promise<number> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      try {
        this.validateStore(db, storeName);

        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).add(obj);

        req.onsuccess = () => {
          console.log(`✅ Added record to ${storeName}, ID: ${req.result}`);
          this.dispatchDbEvent(storeName, 'add', req.result);
          resolve(req.result as number);
        };

        req.onerror = () => {
          const error = `Failed to add to ${storeName}: ${req.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };

        tx.onerror = () => {
          const error = `Transaction error: ${tx.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };
      } catch (error) {
        console.error(`❌ Exception in add():`, error);
        reject(error);
      }
    });
  }

  /**
   * ✅ FIXED: Proper return type as number
   */
  async put(storeName: string, obj: any): Promise<number> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      try {
        this.validateStore(db, storeName);

        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(obj);

        req.onsuccess = () => {
          console.log(`✅ Updated record in ${storeName}, ID: ${req.result}`);
          this.dispatchDbEvent(storeName, 'put', req.result);
          resolve(req.result as number);
        };

        req.onerror = () => {
          const error = `Failed to update in ${storeName}: ${req.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };

        tx.onerror = () => {
          const error = `Transaction error: ${tx.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };
      } catch (error) {
        console.error(`❌ Exception in put():`, error);
        reject(error);
      }
    });
  }

  /**
   * ✅ IMPROVED: Return promise with error handling
   */
  async delete(storeName: string, key: any): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      try {
        this.validateStore(db, storeName);

        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);

        req.onsuccess = () => {
          console.log(`✅ Deleted record from ${storeName}, Key: ${key}`);
          this.dispatchDbEvent(storeName, 'delete', key);
          resolve();
        };

        req.onerror = () => {
          const error = `Failed to delete from ${storeName}: ${req.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };

        tx.onerror = () => {
          const error = `Transaction error: ${tx.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };
      } catch (error) {
        console.error(`❌ Exception in delete():`, error);
        reject(error);
      }
    });
  }

  /**
   * ✅ IMPROVED: Get single record with better error handling
   */
  async getById(storeName: string, id: number): Promise<any> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      try {
        this.validateStore(db, storeName);

        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(id);

        req.onsuccess = () => {
          const result = req.result;
          if (result) {
            console.log(`✅ Found record in ${storeName} with id ${id}`);
          } else {
            console.warn(`⚠️ No record found in ${storeName} with id ${id}`);
          }
          resolve(result || null);
        };

        req.onerror = () => {
          const error = `Failed to get from ${storeName}: ${req.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };

        tx.onerror = () => {
          const error = `Transaction error: ${tx.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };
      } catch (error) {
        console.error(`❌ Exception in getById():`, error);
        reject(error);
      }
    });
  }

  /**
   * ✅ IMPROVED: Search with filter function
   */
  async searchInStore(storeName: string, predicate: (item: any) => boolean): Promise<any[]> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      try {
        this.validateStore(db, storeName);

        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => {
          const results = (req.result || []).filter(predicate);
          console.log(`✅ Found ${results.length} matches in ${storeName}`);
          resolve(results);
        };

        req.onerror = () => {
          const error = `Search failed in ${storeName}: ${req.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };

        tx.onerror = () => {
          const error = `Transaction error: ${tx.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };
      } catch (error) {
        console.error(`❌ Exception during search:`, error);
        reject(error);
      }
    });
  }

  // ===== CUSTOMER METHODS =====
  async getAllCustomers(): Promise<Customer[]> {
    return this.getAll('customers') as Promise<Customer[]>;
  }

  async addCustomer(customer: Customer): Promise<number> {
    return this.add('customers', customer);
  }

  async updateCustomer(customer: Customer): Promise<number> {
    return this.put('customers', customer);
  }

  async deleteCustomer(id: number): Promise<void> {
    return this.delete('customers', id);
  }

  async getCustomerByName(name: string): Promise<Customer | null> {
    const results = await this.searchInStore('customers',
      c => c.name?.toLowerCase() === name.toLowerCase()
    );
    return results[0] || null;
  }

  async searchCustomers(name: string): Promise<Customer[]> {
    return this.searchInStore('customers',
      c => c.name?.toLowerCase().includes(name.toLowerCase())
    ) as Promise<Customer[]>;
  }

  // ===== SALES ORDER METHODS =====

  /**
   * ✅ IMPROVED: Return promise properly
   */
  async addOrUpdateSalesOrder(data: SalesOrder): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.openDB();

        if (!db.objectStoreNames.contains('salesOrders')) {
          throw new Error('salesOrders store does not exist');
        }

        const tx = db.transaction('salesOrders', 'readwrite');
        const store = tx.objectStore('salesOrders');
        const req = store.put(data);

        req.onsuccess = () => {
          console.log('✅ Sales order saved successfully:', data.orderNo);
          this.dispatchDbEvent('salesOrders', 'put', req.result);
          resolve(req.result as number);
        };

        req.onerror = () => {
          const error = `Failed to save sales order: ${req.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };

        tx.onerror = () => {
          const error = `Transaction error: ${tx.error}`;
          console.error('❌', error);
          reject(new Error(error));
        };
      } catch (error) {
        console.error('❌ Exception in addOrUpdateSalesOrder:', error);
        reject(error);
      }
    });
  }

  async getSalesOrders(): Promise<SalesOrder[]> {
    return this.getAll('salesOrders') as Promise<SalesOrder[]>;
  }

  async getSalesOrderByNo(orderNo: string): Promise<SalesOrder | null> {
    const results = await this.searchInStore('salesOrders',
      o => o.orderNo === orderNo
    );
    return (results[0] || null) as SalesOrder | null;
  }

  // ===== INVENTORY/PRODUCTS METHODS =====
  async getAllProducts(): Promise<any[]> {
    return this.getAll('inventory');
  }

  async addProduct(product: any): Promise<number> {
    return this.add('inventory', product);
  }

  async updateProduct(product: any): Promise<number> {
    return this.put('inventory', product);
  }

  async deleteProduct(name: string): Promise<void> {
    return this.delete('inventory', name);
  }

  // ===== ORDER METHODS =====
  async addOrder(order: any): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.openDB();
        const tx = db.transaction('orders', 'readwrite');
        const store = tx.objectStore('orders');
        const req = store.put(order);

        req.onsuccess = () => {
          console.log('✅ Order added:', order.orderNo);
          this.dispatchDbEvent('orders', 'put', req.result);
          resolve(req.result as number);
        };

        req.onerror = () => {
          console.error('❌ Failed to add order:', req.error);
          reject(new Error(`Failed to add order: ${req.error}`));
        };

        tx.onerror = () => {
          console.error('❌ Transaction error:', tx.error);
          reject(new Error(`Transaction error: ${tx.error}`));
        };
      } catch (error) {
        console.error('❌ Exception in addOrder:', error);
        reject(error);
      }
    });
  }

  async getAllOrders(): Promise<any[]> {
    return this.getAll('orders');
  }

  async updateOrder(order: any): Promise<number> {
    return this.put('orders', order);
  }

  async deleteOrder(id: number): Promise<void> {
    return this.delete('orders', id);
  }

  async searchOrders(customerName: string): Promise<any[]> {
    return this.searchInStore('orders',
      o => o.customerName?.toLowerCase().includes(customerName.toLowerCase())
    );
  }

  // ===== INVOICE METHODS =====
  async getAllInvoices(): Promise<any[]> {
    return this.getAll('invoices');
  }

  async addInvoice(invoice: any): Promise<number> {
    return this.add('invoices', invoice);
  }

  async updateInvoice(invoice: any): Promise<number> {
    return this.put('invoices', invoice);
  }

  async deleteInvoice(id: number): Promise<void> {
    return this.delete('invoices', id);
  }

  // ===== PROFORMA METHODS =====
  async getAllProformas(): Promise<any[]> {
    return this.getAll('proformas');
  }

  async addProforma(proforma: any): Promise<number> {
    return this.add('proformas', proforma);
  }

  async updateProforma(proforma: any): Promise<number> {
    return this.put('proformas', proforma);
  }

  async deleteProforma(id: number): Promise<void> {
    return this.delete('proformas', id);
  }

  // ===== PURCHASE ORDER METHODS =====
  async getPurchaseOrderByNo(poNumber: string): Promise<any> {
    const results = await this.searchInStore('purchaseOrders',
      p => p.poNumber === poNumber
    );
    return results[0] || null;
  }

  async addOrUpdatePurchaseOrder(po: any): Promise<number> {
    return this.put('purchaseOrders', po);
  }

  async getAllPurchaseOrders(): Promise<any[]> {
    return this.getAll('purchaseOrders');
  }

  async deletePurchaseOrder(id: number): Promise<void> {
    return this.delete('purchaseOrders', id);
  }

  // ===== INQUIRY METHODS =====
  async getAllInquiries(): Promise<any[]> {
    return this.getAll('inquiries');
  }

  async addInquiry(inquiry: any): Promise<number> {
    return this.add('inquiries', inquiry);
  }

  async updateInquiry(inquiry: any): Promise<number> {
    return this.put('inquiries', inquiry);
  }

  async deleteInquiry(id: number): Promise<void> {
    return this.delete('inquiries', id);
  }

  async searchInquiries(status: string): Promise<any[]> {
    return this.searchInStore('inquiries',
      i => i.status === status
    );
  }

  // ===== VENDOR METHODS =====
  async getAllVendors(): Promise<any[]> {
    return this.getAll('vendors');
  }

  async addVendor(vendor: any): Promise<number> {
    return this.add('vendors', vendor);
  }

  async updateVendor(vendor: any): Promise<number> {
    return this.put('vendors', vendor);
  }

  async deleteVendor(vendorId: any): Promise<void> {
    return this.delete('vendors', vendorId);
  }

  // ===== REMINDER METHODS =====
  async getAllReminders(): Promise<Reminder[]> {
    return this.getAll('reminders') as Promise<Reminder[]>;
  }

  /**
   * ✅ SIMPLEST FIX: Accept any object, just store it
   */
  async addReminder(reminder: any): Promise<number> {
    // Set defaults for optional fields
    const completeReminder = {
      mobile: reminder.mobile || '',
      referenceNo: reminder.referenceNo || '',
      note: reminder.note || '',
      createdAt: reminder.createdAt || new Date().toISOString(),
      ...reminder
    };

    return this.add('reminders', completeReminder);
  }

  async updateReminder(reminder: Reminder): Promise<number> {
    return this.put('reminders', reminder);
  }

  /**
   * ✅ FIXED: Handle undefined IDs properly
   */
  async deleteReminder(id: number | undefined): Promise<void> {
    if (id === undefined || id === null) {
      throw new Error('Cannot delete reminder: ID is required');
    }
    return this.delete('reminders', id);
  }

  /**
   * ✅ IMPROVED: Proper error handling and promise return
   */
  async createAutoReminder(config: ReminderConfig): Promise<number> {
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

    try {
      const result = await this.addReminder(reminder);
      console.log(`✅ Auto-reminder created for ${config.type}:`, reminder);
      return result;
    } catch (error) {
      console.error(`❌ Failed to create auto-reminder:`, error);
      throw error;
    }
  }

  // ===== DATABASE UTILITIES =====

  /**
   * ✅ NEW: Validate database integrity
   */
  async validateDatabase(): Promise<DbValidationResult> {
    const result: DbValidationResult = {
      valid: true,
      stores: {},
      errors: []
    };

    try {
      const db = await this.openDB();

      for (const storeName of Array.from(db.objectStoreNames)) {
        try {
          const records = await this.getAll(storeName);
          result.stores[storeName] = records.length;
        } catch (error) {
          result.valid = false;
          result.errors.push(`Error reading ${storeName}: ${error}`);
        }
      }

      console.log('✅ Database validation result:', result);
      return result;
    } catch (error) {
      result.valid = false;
      result.errors.push(`Database connection failed: ${error}`);
      return result;
    }
  }

  /**
   * ✅ NEW: Export all data as JSON
   */
  async exportAllData(): Promise<string> {
    const db = await this.openDB();
    const exportData: Record<string, any[]> = {};

    try {
      for (const storeName of Array.from(db.objectStoreNames)) {
        try {
          const data = await this.getAll(storeName);
          exportData[storeName] = data;
        } catch (error) {
          console.warn(`Failed to export ${storeName}:`, error);
        }
      }

      console.log('✅ Data export completed');
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Import data from JSON
   */
  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);

      for (const [storeName, records] of Object.entries(data)) {
        for (const record of (records as any[])) {
          try {
            await this.put(storeName, record);
          } catch (error) {
            console.warn(`Failed to import record in ${storeName}:`, error);
          }
        }
      }

      console.log('✅ Data import completed');
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Clear all data (use with caution!)
   */
  async clearAllData(): Promise<void> {
    try {
      const db = await this.openDB();

      for (const storeName of Array.from(db.objectStoreNames)) {
        try {
          await this.delete(storeName, undefined);
        } catch (error) {
          console.warn(`Failed to clear ${storeName}:`, error);
        }
      }

      console.log('✅ All data cleared');
    } catch (error) {
      console.error('❌ Clear failed:', error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    const db = await this.openDB();
    const stats = {
      name: db.name,
      version: db.version,
      stores: {} as Record<string, any>,
      totalRecords: 0
    };

    for (const storeName of Array.from(db.objectStoreNames)) {
      try {
        const records = await this.getAll(storeName);
        stats.stores[storeName] = {
          count: records.length,
          size: JSON.stringify(records).length
        };
        stats.totalRecords += records.length;
      } catch (error) {
        console.warn(`Failed to get stats for ${storeName}:`, error);
      }
    }

    return stats;
  }
}