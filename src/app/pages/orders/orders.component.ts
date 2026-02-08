import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DBService } from '../../service/db.service';

type OrderStatus = 'offers' | 'ongoing' | 'completed';

interface OrderItem {
  productName: string;
  productId?: string | number;
  qty: number;
  rate?: number;
  amount?: number;
  hsn?: number;
  uom?: string;
}

interface Order {
  id?: number;
  orderNo: string;
  inquiryNo?: string;
  orderDate: string;
  deliveryDate?: string;
  customerId?: string | number;
  customerName: string;
  salesman?: string;
  items: OrderItem[];
  amount: number;
  gstPercent?: number;
  totalAmount: number;
  status: OrderStatus;
  remarks?: string;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {

  selectedFilter: OrderStatus | 'completed' = 'offers';
  orders: Order[] = [];

  // Modals
  showModal = false;
  isEditing = false;
  editingOrderId: number | null = null;
  orderForm: Order = this.getEmptyOrder();

  showDetailsModal = false;
  detailsOrder: Order | null = null;

  // Data Lists
  inquiriesList: any[] = [];
  inventoryList: any[] = []; // ✅ New Inventory List

  constructor(private dbService: DBService) { }

  // Action Menu Helpers
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

  ngOnInit() {
    this.loadOrders();
    this.loadInquiriesFromDB();
    this.loadInventoryFromDB(); // ✅ Load inventory on init
  }

  /* -------- FILTERED ORDERS -------- */
  get filteredOrders() {
    return this.orders.filter(o => o.status === this.selectedFilter);
  }

  applyFilter() {
    // Trigger logic on filter change if needed
  }

  /* -------- LOAD DATA -------- */
  private loadInquiriesFromDB() {
    this.dbService.getAll('inquiries').then(data => {
      this.inquiriesList = data || [];
      console.log("📄 Inquiries loaded:", this.inquiriesList.length);
    });
  }

  private loadInventoryFromDB() {
    this.dbService.getAll('inventory').then(data => {
      this.inventoryList = data || [];
      console.log("📦 Inventory loaded for pricing:", this.inventoryList.length);
    });
  }

  /* -------- INQUIRY → ORDER LINKING (WITH RATE LOOKUP) -------- */
  onInquirySelect(event: any) {
    const val = event.target.value;
    if (!val) return;

    // Use loose equality (==) to handle string/number ID mismatch
    const selectedInquiry = this.inquiriesList.find(i => i.id == val);

    if (!selectedInquiry) {
      console.warn("❌ Inquiry not found for ID:", val);
      return;
    }

    console.log("✅ Selected Inquiry:", selectedInquiry);

    // 1. Auto-fill Header
    this.orderForm.inquiryNo = selectedInquiry.no || selectedInquiry.inquiryNo || String(selectedInquiry.id);
    this.orderForm.customerName = selectedInquiry.companyName || '';
    this.orderForm.salesman = selectedInquiry.salesman || '';

    // 2. Auto-fill Items & Lookup Rates
    if (selectedInquiry.items && Array.isArray(selectedInquiry.items)) {
      this.orderForm.items = selectedInquiry.items.map((it: any) => {

        // Normalize Product Name
        const pName = it.productName || it.name || it.item || '';

        // 🔍 Find product in inventory to get the Rate/Price
        const product = this.inventoryList.find((p: any) => {
          const invName = (p.displayName || p.name || '').toLowerCase().trim();
          const targetName = pName.toLowerCase().trim();
          return invName === targetName;
        });

        // Use inventory price if available, otherwise 0
        // Checks for 'price', 'rate', or 'sellingPrice' fields
        const unitRate = product ? (Number(product.price) || Number(product.rate) || Number(product.sellingPrice) || 0) : 0;

        return {
          productName: pName,
          hsn: it.hsn,
          uom: it.uom,
          qty: Number(it.qty) || Number(it.quantity) || 1,
          rate: unitRate,  // ✅ Auto-filled from inventory
          amount: 0        // Will be calculated below
        };
      });
    }

    // 3. Recalculate totals immediately
    this.recalculateFormAmounts();
  }

  private markInquiryConverted(inquiryId: number) {
    this.dbService.openDB().then(db => {
      const tx = db.transaction('inquiries', 'readwrite');
      const store = tx.objectStore('inquiries');

      const getReq = store.get(inquiryId);

      getReq.onsuccess = () => {
        const inquiry = getReq.result;
        if (!inquiry) return;

        inquiry.status = 'converted';
        store.put(inquiry); // No need to wait for success here strictly
        console.log("Inquiry marked as CONVERTED:", inquiryId);
      };
    });
  }

  /* -------- OPEN / CLOSE MODAL -------- */
  openAddModal() {
    this.isEditing = false;
    this.editingOrderId = null;
    this.orderForm = this.getEmptyOrder();
    this.orderForm.orderNo = this.generateOrderNo();
    this.showModal = true;
  }

  openEditModal(order: Order) {
    this.isEditing = true;
    this.editingOrderId = order.id ?? null;
    // Deep clone to prevent mutating the table row directly
    this.orderForm = JSON.parse(JSON.stringify(order));
    this.showModal = true;
  }

  openDetailsModal(order: Order) {
    this.detailsOrder = order;
    this.showDetailsModal = true;
  }

  cancelModal() {
    this.showModal = false;
    this.isEditing = false;
    this.editingOrderId = null;
  }

  /* -------- ITEM LIST FORM -------- */
  addItemLine() {
    this.orderForm.items.push({ productName: '', qty: 1, rate: 0, amount: 0 });
  }

  removeItemLine(index: number) {
    this.orderForm.items.splice(index, 1);
    this.recalculateFormAmounts();
  }

  /* -------- AMOUNT CALCULATION (STRICT TYPES) -------- */
  recalculateFormAmounts() {
    let amount = 0;
    this.orderForm.items.forEach(it => {
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || 0;

      it.amount = qty * rate;
      amount += it.amount;
    });

    this.orderForm.amount = Number(amount.toFixed(2));

    const gstPercent = Number(this.orderForm.gstPercent) || 0;
    const gst = (this.orderForm.amount * gstPercent) / 100;

    this.orderForm.totalAmount = Number((this.orderForm.amount + gst).toFixed(2));
  }

  /* -------- SUBMIT FORM (CREATE/UPDATE) -------- */
  submitForm() {
    // 1. Validation
    if (!this.orderForm.customerName || this.orderForm.items.length === 0) {
      alert('Please enter customer and at least one item.');
      return;
    }

    // 2. Prepare Data (Deep Clone & Type Conversion)
    const payload: Order = JSON.parse(JSON.stringify(this.orderForm));

    // Force numbers for financial fields
    payload.amount = Number(payload.amount) || 0;
    payload.gstPercent = Number(payload.gstPercent) || 0;

    // Recalculate totals strictly before saving
    let calcAmount = 0;
    payload.items.forEach(item => {
      item.qty = Number(item.qty) || 0;
      item.rate = Number(item.rate) || 0;
      item.amount = item.qty * item.rate;
      calcAmount += item.amount;
    });

    payload.amount = parseFloat(calcAmount.toFixed(2));
    const gstAmount = (payload.amount * payload.gstPercent) / 100;
    payload.totalAmount = parseFloat((payload.amount + gstAmount).toFixed(2));

    /* ---------- UPDATE ---------- */
    if (this.isEditing && this.editingOrderId != null) {
      payload.id = this.editingOrderId; // Ensure ID is attached for update

      this.updateOrderInDB(payload).then(() => {
        console.log('✅ Order updated');
        this.showModal = false;
        this.loadOrders();
      }).catch(err => {
        console.error('❌ Update failed', err);
        alert('Failed to update order');
      });

      return;
    }

    /* ---------- CREATE ---------- */
    // Ensure ID is undefined so IndexedDB auto-increments
    delete payload.id;

    this.createOrderInDB(payload).then(() => {
      console.log('✅ Order created');

      // Handle side effects
      this.createShippingReminder(payload);

      if (payload.inquiryNo) {
        this.markInquiryConverted(Number(payload.inquiryNo));
      }

      this.showModal = false;
      this.loadOrders();
    }).catch(err => {
      console.error('❌ Create failed', err);
      alert('Failed to save order');
    });
  }

  /* -------- UPDATE STATUS -------- */
  updateStatus(orderId: number | undefined, newStatus: OrderStatus) {
    if (orderId == null) return;
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;

    this.updateOrderInDB(order).then(() => {
      if (newStatus === 'completed') this.reduceInventoryForOrder(order);
      this.loadOrders();
    });
  }

  /* -------- DELETE ORDER -------- */
  deleteOrder(orderId: number | undefined) {
    if (!confirm('Delete this order?')) return;
    if (orderId == null) return;

    this.deleteOrderFromDB(orderId).then(() => this.loadOrders());
  }

  /* -------- CRUD METHODS (FIXED) -------- */

  private createOrderInDB(order: Order): Promise<void> {
    return this.dbService.openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('orders', 'readwrite');
        const store = tx.objectStore('orders');

        // IMPORTANT: Remove ID property if present to prevent KeyGenerator errors
        const { id, ...orderWithoutId } = order;

        const req = store.add(orderWithoutId);
        req.onsuccess = () => resolve();
        req.onerror = (e) => {
          console.error("DB Add Error:", (e.target as any).error);
          reject(e);
        };
      });
    });
  }

  private updateOrderInDB(order: Order): Promise<void> {
    return this.dbService.openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('orders', 'readwrite');
        const store = tx.objectStore('orders');

        // Check ID exists
        if (!order.id) {
          reject('Cannot update order without ID');
          return;
        }

        const req = store.put(order);
        req.onsuccess = () => resolve();
        req.onerror = (e) => {
          console.error("DB Update Error:", (e.target as any).error);
          reject(e);
        };
      });
    });
  }

  private deleteOrderFromDB(orderId: number): Promise<void> {
    return this.dbService.openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('orders', 'readwrite');
        const store = tx.objectStore('orders');

        const req = store.delete(orderId);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e);
      });
    });
  }

  /* -------- HELPERS -------- */
  private generateOrderNo(): string {
    const year = new Date().getFullYear();
    const sequential = Math.floor((Date.now() % 1000000) / 10).toString().padStart(4, '0');
    return `ORD/${year}/${sequential}`;
  }

  private reduceInventoryForOrder(order: Order): void {
    order.items.forEach(it => {
      this.dbService.openDB().then(db => {
        const tx = db.transaction('inventory', 'readwrite');
        const store = tx.objectStore('inventory');

        store.get(it.productName).onsuccess = (e: any) => {
          const item = e.target.result;
          if (!item) return;

          item.quantity = Math.max(0, Number(item.quantity) - Number(it.qty));
          store.put(item);
        };
      });
    });
  }

  private getEmptyOrder(): Order {
    const today = new Date().toISOString().slice(0, 10);
    return {
      orderNo: '',
      inquiryNo: '',
      orderDate: today,
      deliveryDate: today,
      customerId: '',
      customerName: '',
      salesman: '',
      items: [{ productName: '', qty: 1, rate: 0, amount: 0 }],
      amount: 0,
      gstPercent: 18,
      totalAmount: 0,
      status: 'offers',
      remarks: ''
    };
  }

  loadOrders() {
    this.dbService.getAll('orders').then(data => {
      console.log('📦 Orders loaded:', data);
      this.orders = data;
      // Re-apply filter immediately after loading
      this.applyFilter();
    });
  }

  async createShippingReminder(order: Order) {
    console.log('═══════════════════════════════════════');
    console.log('✅ NEW ORDER CREATED');
    console.log('═══════════════════════════════════════');
    console.log('📦 Order No:', order.orderNo);

    try {
      await this.dbService.createAutoReminder({
        type: 'order',
        name: order.customerName,
        mobile: '',
        referenceNo: order.orderNo,
        followUpDays: 2, // Ship in 2 days
        note: `Ship order ${order.orderNo} - ${order.customerName}`
      });

      console.log('✅ Shipping reminder created');

    } catch (error) {
      console.error('❌ Shipping reminder creation failed:', error);
    }
  }
}