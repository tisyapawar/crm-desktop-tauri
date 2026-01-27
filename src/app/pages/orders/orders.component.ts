import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DBService } from '../../service/db.service';

type OrderStatus = 'offers' | 'ongoing' | 'previous';

interface OrderItem {
  productName: string;
  productId?: string | number;
  qty: number;
  rate?: number;
  amount?: number;
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

  selectedFilter: OrderStatus | 'previous' = 'offers';
  orders: Order[] = [];

  // modals
  showModal = false;
  isEditing = false;
  editingOrderId: number | null = null;
  orderForm: Order = this.getEmptyOrder();

  showDetailsModal = false;
  detailsOrder: Order | null = null;

  inquiriesList: any[] = [];
  // reloadOrdersLocal: any;

  constructor(private dbService: DBService) { }

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
  }

  /* -------- FILTERED ORDERS -------- */
  get filteredOrders() {
    return this.orders.filter(o => o.status === this.selectedFilter);
  }

  applyFilter() {
  }

  /* -------- LOAD INQUIRIES -------- */
  // private loadInquiriesFromDB() {
  //   this.dbService.openDB().then(db => {
  //     const tx = db.transaction('inquiries', 'readonly');
  //     const store = tx.objectStore('inquiries');
  //     const req = store.getAll();

  //     req.onsuccess = () => {
  //       this.inquiriesList = req.result || [];
  //       console.log("Loaded inquiries:", this.inquiriesList);
  //     };
  //   });
  // }

  private loadInquiriesFromDB() {
    this.dbService.openDB().then(db => {
      console.log("DB OPENED FOR ORDERS:", db);

      const tx = db.transaction('inquiries', 'readonly');
      const store = tx.objectStore('inquiries');
      const req = store.getAll();

      req.onsuccess = () => {
        console.log("INQUIRIES LOADED FROM DB:", req.result);
        this.inquiriesList = req.result || [];
      };

      req.onerror = () => {
        console.error("ERROR loading inquiries:", req.error);
      };
    });
  }


  /* -------- INQUIRY → ORDER LINKING -------- */
  onInquirySelect(event: any) {
    const inqId = Number(event.target.value);
    if (!inqId) return;

    const selectedInquiry = this.inquiriesList.find(i => i.id === inqId);
    if (!selectedInquiry) return;

    this.orderForm.inquiryNo = selectedInquiry.no || selectedInquiry.id;
    this.orderForm.customerName = selectedInquiry.customerName;
    this.orderForm.salesman = selectedInquiry.salesman || '';

    this.orderForm.items = selectedInquiry.items.map((it: any) => ({
      productName: it.name,
      qty: it.qty,
      rate: 0,
      amount: 0
    }));

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

        const putReq = store.put(inquiry);
        putReq.onsuccess = () => {
          console.log("Inquiry marked as CONVERTED:", inquiryId);
        };
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

  /* -------- AMOUNT CALCULATION -------- */
  recalculateFormAmounts() {
    let amount = 0;
    this.orderForm.items.forEach(it => {
      it.amount = (Number(it.qty) || 0) * (Number(it.rate) || 0);
      amount += it.amount;
    });

    this.orderForm.amount = Number(amount.toFixed(2));
    const gst = (Number(this.orderForm.gstPercent || 0) / 100) * this.orderForm.amount;
    this.orderForm.totalAmount = Number((this.orderForm.amount + gst).toFixed(2));
  }


  // submitForm() {

  //   // basic validation
  //   if (!this.orderForm.customerName || this.orderForm.items.length === 0) {
  //     alert('Please enter customer and at least one item.');
  //     return;
  //   }

  //   /* -------------------------------
  //       UPDATE EXISTING ORDER
  //   --------------------------------*/
  //   if (this.isEditing && this.editingOrderId != null) {
  //     this.orderForm.id = this.editingOrderId;

  //     this.updateOrderInDB(this.orderForm)
  //       .then(() => {
  //         this.showModal = false;
  //         this.reloadOrdersLocal();
  //       })
  //       .catch(err => console.error(err));

  //     return;  // stop here (do not run create logic)
  //     this.loadOrders(); 
  //   }

  //   /* -------------------------------
  //       CREATE NEW ORDER
  //   --------------------------------*/
  //   this.createOrderInDB(this.orderForm)
  //     .then(() => {

  //       // ⭐ NEW: Mark linked inquiry as "converted"
  //       if (this.orderForm.inquiryNo) {
  //         this.markInquiryConverted(Number(this.orderForm.inquiryNo));
  //       }

  //       this.showModal = false;
  //       this.reloadOrdersLocal();
  //     })
  //     .catch(err => console.error(err));
  // }

  submitForm() {

    if (!this.orderForm.customerName || this.orderForm.items.length === 0) {
      alert('Please enter customer and at least one item.');
      return;
    }

    /* ---------- UPDATE ---------- */
    if (this.isEditing && this.editingOrderId != null) {
      this.orderForm.id = this.editingOrderId;

      this.updateOrderInDB(this.orderForm).then(() => {
        console.log('✅ Order updated');
        this.showModal = false;
        this.loadOrders();   // ✅ IMMEDIATE refresh
      });

      return;
    }

    /* ---------- CREATE ---------- */
    this.createOrderInDB(this.orderForm).then(() => {
      console.log('✅ Order created');

      this.createShippingReminder(this.orderForm);

      if (this.orderForm.inquiryNo) {
        this.markInquiryConverted(Number(this.orderForm.inquiryNo));
      }

      this.showModal = false;
      this.loadOrders();     // ✅ IMMEDIATE refresh
    });
  }



  /* -------- UPDATE STATUS -------- */
  updateStatus(orderId: number | undefined, newStatus: OrderStatus) {
    if (orderId == null) return;
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;

    this.updateOrderInDB(order).then(() => {
      if (newStatus === 'previous') this.reduceInventoryForOrder(order);
      this.loadOrders();
    });
  }

  /* -------- DELETE ORDER -------- */
  deleteOrder(orderId: number | undefined) {
    if (!confirm('Delete this order?')) return;
    if (orderId == null) return;

    this.deleteOrderFromDB(orderId).then(() => this.loadOrders());
  }

  /* -------- CRUD USING DBSERVICE -------- */
  // private async loadOrdersFromDB() {
  //   this.dbService.openDB().then(db => {
  //     const tx = db.transaction('orders', 'readonly');
  //     const store = tx.objectStore('orders');
  //     const req = store.getAll();

  //     req.onsuccess = () => {
  //       this.orders = req.result || [];
  //     };
  //   });
  // }

  private createOrderInDB(order: Order): Promise<void> {
    return this.dbService.openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('orders', 'readwrite');
        const store = tx.objectStore('orders');

        const req = store.add(order);
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e);
      });
    });
  }

  private updateOrderInDB(order: Order): Promise<void> {
    return this.dbService.openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('orders', 'readwrite');
        const store = tx.objectStore('orders');

        const req = store.put(order);
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e);
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
        req.onerror = e => reject(e);
      });
    });
  }

  /* -------- ORDER NUMBER -------- */
  private generateOrderNo(): string {
    const year = new Date().getFullYear();
    const sequential = Math.floor((Date.now() % 1000000) / 10).toString().padStart(4, '0');
    return `ORD/${year}/${sequential}`;
  }

  /* -------- INVENTORY REDUCTION -------- */
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

  /* -------- EMPTY ORDER TEMPLATE -------- */
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
      gstPercent: 0,
      totalAmount: 0,
      status: 'offers',
      remarks: ''
    };
  }

  loadOrders() {
    this.dbService.getAll('orders').then(data => {
      console.log('📦 Orders loaded:', data);
      this.orders = data;
      this.applyFilter(); // important
    });
  }

  async createShippingReminder(order: Order) {
    console.log('═══════════════════════════════════════');
    console.log('✅ NEW ORDER CREATED');
    console.log('═══════════════════════════════════════');
    console.log('📦 Order No:', order.orderNo);
    console.log('👤 Customer Name:', order.customerName);
    console.log('📅 Order Date:', order.orderDate);
    console.log('───────────────────────────────────────');

    try {
      console.log('🔔 Creating shipping reminder with params:');
      console.log('  ├─ type: order');
      console.log('  ├─ name:', order.customerName);
      console.log('  ├─ mobile: (not stored in orders)');
      console.log('  ├─ referenceNo:', order.orderNo);
      console.log('  ├─ followUpDays: 2');
      console.log('  └─ note:', `Ship order ${order.orderNo} - ${order.customerName}`);

      await this.dbService.createAutoReminder({
        type: 'order',
        name: order.customerName,
        mobile: '', // Orders don't have mobile, or fetch from customer if needed
        referenceNo: order.orderNo,
        followUpDays: 2, // Ship in 2 days
        note: `Ship order ${order.orderNo} - ${order.customerName}`
      });

      console.log('✅ Shipping reminder created');
      console.log('═══════════════════════════════════════');

    } catch (error) {
      console.error('❌ Shipping reminder creation failed:', error);
      console.log('═══════════════════════════════════════');
    }
  }
}