import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { DBService } from '../../service/db.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-sales-order',
  standalone: true,
  templateUrl: './sales-order.component.html',
  styleUrls: ['./sales-order.component.css'],
  imports: [FormsModule, CommonModule]
})
export class SalesOrderComponent implements OnInit, AfterViewInit {

  // ===== FORM STATE =====
  salesOrderStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED' = 'DRAFT';
  showForm = false;
  isEditing = false;
  editingOrder: any = null;
  newSale = true;
  state: any;
  inquiry: any;

  // ===== TABLE DATA =====
  draftOrders: any[] = [];
  submittedOrders: any[] = [];
  approvedOrders: any[] = [];

  // ===== PAYMENT TERMS =====
  pTerms = [
    { name: 'Advance', value: 'Advance' },
    { name: 'Credit', value: 'Credit' }
  ];

  /* ===============================
     OFFER SELECTION MODAL
  =============================== */
  showOfferModal = false;
  availableOffers: any[] = [];
  selectedCompanyForOffers = '';
  isLoadingOffers = false;

  // ===== BASIC DETAILS =====
  salesOrderNo = '';
  salesOrderDate = '';
  selectedCompanyName = ''; // For dropdown binding
  customerName = '';
  customerId = '';
  billAddr = '';
  shipAddr = '';
  gstNo = '';

  // ===== CONTACT =====
  contactPerson = '';
  contactNo = '';
  paymentTerms = 'Advance';
  creditDays: number | null = null;
  poNo = '';
  poDate = '';

  // ===== ITEMS =====
  itemsShow: any[] = [];

  // ===== SUMMARY =====
  freightCharges = 0;
  advanceReceived = 0;

  // ===== DELIVERY =====
  expectedDeliveryDate = '';
  deliveryTerms = '';
  transporterName = '';
  transportMode = '';

  // ===== ATTACHMENTS =====
  files: File[] = [];
  isDragActive = false;

  // ===== DATA =====
  customers: any[] = [];
  allItems: any[] = [];

  constructor(
    private router: Router,
    private dbService: DBService,
    private cdr: ChangeDetectorRef
  ) { }

  // ===== LIFECYCLE HOOKS =====

  async ngOnInit(): Promise<void> {
    await this.initDBAndLoad();

    const nav = this.router.getCurrentNavigation();
    this.state = nav?.extras?.state ?? history.state;
    this.inquiry = this.state?.inquiry;

    if (!this.inquiry) {
      this.newSale = true;
      await this.generateSalesOrderNo();
      this.salesOrderDate = new Date().toISOString().slice(0, 10);
      this.addLine();
      return;
    }

    // Auto-fill from Inquiry
    this.newSale = false;
    this.salesOrderNo = 'SO/' + this.getYearRange() + '/' + this.toThreeDigits(this.inquiry.no);
    this.salesOrderDate = new Date().toISOString().slice(0, 10);
    this.customerName = this.inquiry.customerName;

    const customer = await this.loadCustomerByName(this.customerName);
    if (customer) {
      this.billAddr = this.formatAddress(customer.billing);
      this.shipAddr = this.formatAddress(customer.shipping);
    }

    this.inquiry.items.forEach((i: any) => {
      const product = this.allItems.find(p => p.name === i.name);
      this.itemsShow.push({
        item: i.name,
        qty: i.qty,
        uom: product?.uom ?? '',
        hsn: product?.hsn ?? '',
        rate: product?.price ?? 0,
        disc: 0,
        discountType: '₹',
        gst: product?.gst ?? 18,
        total: 0
      });
      this.recalculateLine(this.itemsShow[this.itemsShow.length - 1]);
    });
  }

  async ngAfterViewInit() {
    console.log('🟢 ngAfterViewInit → loading sales orders');
    await this.loadSalesOrders();
  }

  // ===== INITIALIZATION =====

  async initDBAndLoad() {
    try {
      this.allItems = await this.dbService.getAllProducts();
    } catch (error) {
      console.error('❌ Failed to load inventory:', error);
      this.allItems = [];
    }

    try {
      this.customers = await this.dbService.getAllCustomers();
    } catch (error) {
      console.error('❌ Failed to load customers:', error);
      this.customers = [];
    }
  }

  async generateSalesOrderNo() {
    try {
      const allOrders = await this.dbService.getSalesOrders();

      let nextNum = 1;
      if (allOrders.length > 0) {
        const lastOrder = allOrders.reduce((prev, current) => {
          const prevNum = parseInt(prev.orderNo.split('/')[2]) || 0;
          const currNum = parseInt(current.orderNo.split('/')[2]) || 0;
          return currNum > prevNum ? current : prev;
        });
        nextNum = parseInt(lastOrder.orderNo.split('/')[2]) + 1;
      }

      const year = new Date().getFullYear();
      this.salesOrderNo = `SO/${year}/${String(nextNum).padStart(5, '0')}`;
    } catch (error) {
      console.error('❌ Failed to generate order number:', error);
      const year = new Date().getFullYear();
      this.salesOrderNo = `SO/${year}/00001`;
    }
  }

  async loadCustomerByName(name: string) {
    return this.dbService.getCustomerByName(name);
  }

  async loadSalesOrders() {
    console.log('📥 Loading sales orders...');
    try {
      const allOrders = await this.dbService.getSalesOrders();
      this.draftOrders = allOrders.filter(o => o.status === 'DRAFT');
      this.submittedOrders = allOrders.filter(o => o.status === 'SUBMITTED');
      this.approvedOrders = allOrders.filter(o => o.status === 'APPROVED');
    } catch (error) {
      console.error('❌ Failed to load sales orders:', error);
    }
  }

  // ===== CUSTOMER SELECTION =====

  async onCompanySelected(selectedCompanyName: string) {
    if (!selectedCompanyName) {
      this.resetCompanyFields();
      return;
    }

    try {
      // Find exact customer from master list
      const customer = this.customers.find(c =>
        c.companyName?.toLowerCase().trim() === selectedCompanyName.toLowerCase().trim()
      );

      if (customer) {
        this.customerId = customer.id || customer.customerId || '';
        this.customerName = customer.name || customer.companyName || '';
        this.contactPerson = customer.primaryContact || '';
        this.contactNo = customer.email || customer.mobile || '';
        this.gstNo = customer.gstin || '';

        if (customer.billing) this.billAddr = this.formatAddress(customer.billing);
        if (customer.shipping) this.shipAddr = this.formatAddress(customer.shipping);

        console.log('✅ Auto-filled company details');
        this.selectedCompanyForOffers = selectedCompanyName;

        // Load offers with partial matching support
        await this.loadOffersForCompany(selectedCompanyName);

      } else {
        alert(`Customer "${selectedCompanyName}" not found in database`);
        this.resetCompanyFields();
      }
    } catch (error) {
      console.error('❌ Error in onCompanySelected:', error);
      alert('Error loading company details. Please try again.');
      this.resetCompanyFields();
    }
  }

  /**
   * ✅ FIXED: Allows partial name matching ("Polter" matches "Polter Inc")
   */
  async loadOffersForCompany(companyName: string) {
    console.log('📥 LOADING ORDERS FOR:', companyName);

    try {
      this.isLoadingOffers = true;
      this.showOfferModal = false;
      this.availableOffers = [];
      this.cdr.detectChanges();

      // 1. Fetch all orders
      const allOrders = await this.dbService.getAll('orders');

      if (!allOrders || allOrders.length === 0) {
        console.warn('⚠️ No orders found in database');
        this.isLoadingOffers = false;
        return;
      }

      // 2. Filter logic (Robust Partial Matching)
      this.availableOffers = allOrders.filter(order => {
        // Normalize names
        const orderCustomer = (order.customerName || '').toLowerCase().trim();
        const selectedCustomer = companyName.toLowerCase().trim();

        // CHECK 1: Name Match (Exact OR Partial)
        // This allows "Polter" to match "Polter Inc"
        const nameMatch = orderCustomer === selectedCustomer ||
          (orderCustomer.length > 3 && selectedCustomer.includes(orderCustomer)) ||
          (selectedCustomer.length > 3 && orderCustomer.includes(selectedCustomer));

        // CHECK 2: Status Match
        // Accepts 'previous' (Completed), 'completed', or 'offers'
        const status = (order.status || '').toLowerCase().trim();
        const isRelevantStatus = status === 'previous' || status === 'completed' || status === 'offers';

        return nameMatch && isRelevantStatus;
      });

      console.log('✅ Found matches:', this.availableOffers.length);

      // 3. Show Modal
      if (this.availableOffers.length > 0) {
        this.showOfferModal = true;
        this.cdr.detectChanges();
      } else {
        console.log(`ℹ️ No orders found for customer: ${companyName}`);
      }

    } catch (error) {
      console.error('❌ Error loading orders:', error);
    } finally {
      this.isLoadingOffers = false;
    }
  }

  /**
   * ✅ FIXED: Mappings
   */
  selectOffer(offer: any) {
    console.log('✅ Selected offer:', offer);
    try {
      this.itemsShow = [];
      if (offer.items && Array.isArray(offer.items)) {
        offer.items.forEach((item: any) => {
          this.itemsShow.push({
            item: item.productName || item.item || item.name || '',
            qty: Number(item.qty) || 1,
            uom: item.uom || 'Kg',
            hsn: item.hsn || '',
            rate: Number(item.rate) || 0,
            disc: item.disc || 0,
            discountType: item.discountType || '₹',
            gst: Number(item.gst) || 18,
            total: 0
          });
        });
        this.itemsShow.forEach(line => this.recalculateLine(line));
      }

      if (offer.deliveryTerms) this.deliveryTerms = offer.deliveryTerms;

      this.closeOfferModal();
    } catch (error) {
      console.error('❌ Error auto-filling:', error);
    }
  }

  closeOfferModal() {
    this.showOfferModal = false;
    this.availableOffers = [];
  }

  skipOfferSelection() {
    this.closeOfferModal();
    if (this.itemsShow.length === 0) {
      this.addLine();
    }
  }

  // ===== HELPER METHODS =====

  formatOfferDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  getOfferTotal(offer: any): number {
    if (offer.totalAmount) return Number(offer.totalAmount);
    if (!offer.items || !Array.isArray(offer.items)) return 0;

    return offer.items.reduce((total: number, item: any) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      return total + (qty * rate);
    }, 0);
  }

  goBackToList() {
    this.showForm = false;
    this.resetForm();
  }

  onPaymentTermsChange(value: string) {
    if (value !== 'Credit') {
      this.creditDays = null;
    }
  }

  // ===== FORM ACTIONS =====

  async createNewSalesOrder() {
    this.showForm = true;
    this.isEditing = false;
    this.editingOrder = null;
    this.resetForm();

    await this.generateSalesOrderNo();
    this.salesOrderDate = new Date().toISOString().slice(0, 10);
  }

  async onSave() {
    try {
      if (!this.salesOrderNo || !this.customerName) {
        alert('❌ Order No and Customer Name are required');
        return;
      }

      if (this.itemsShow.length === 0) {
        alert('❌ Add at least one line item');
        return;
      }

      const salesOrder = this.buildSalesOrderPayload();

      if (this.isEditing && this.editingOrder?.id) {
        await this.dbService.put('salesOrders', {
          ...salesOrder,
          id: this.editingOrder.id,
          updatedAt: new Date().toISOString()
        });
        alert('✅ Sales Order updated successfully!');
      } else {
        await this.dbService.add('salesOrders', salesOrder);
        alert('✅ Sales Order saved successfully!');
      }

      await this.dbService.createAutoReminder({
        type: 'order',
        name: this.customerName,
        mobile: this.contactNo,
        referenceNo: this.salesOrderNo,
        followUpDays: 7,
        note: `Follow-up on Sales Order ${this.salesOrderNo}`
      });

      this.showForm = false;
      this.resetForm();
      await this.loadSalesOrders();

    } catch (error) {
      console.error('❌ Failed to save Sales Order:', error);
      alert('❌ Failed to save Sales Order.');
    }
  }

  onCancel() {
    this.showForm = false;
    this.resetForm();
  }

  resetForm() {
    this.salesOrderNo = '';
    this.salesOrderDate = new Date().toISOString().slice(0, 10);
    this.customerName = '';
    this.customerId = '';
    this.selectedCompanyName = '';
    this.billAddr = '';
    this.shipAddr = '';
    this.gstNo = '';
    this.contactPerson = '';
    this.contactNo = '';
    this.paymentTerms = 'Advance';
    this.creditDays = null;
    this.poNo = '';
    this.poDate = '';
    this.itemsShow = [];
    this.freightCharges = 0;
    this.advanceReceived = 0;
    this.expectedDeliveryDate = '';
    this.deliveryTerms = '';
    this.transporterName = '';
    this.transportMode = '';
    this.salesOrderStatus = 'DRAFT';
    this.isEditing = false;
    this.editingOrder = null;
    this.addLine();
  }

  // ===== WORKFLOW ACTIONS =====

  private async upsertSalesOrder(status: 'DRAFT' | 'SUBMITTED' | 'APPROVED') {
    this.salesOrderStatus = status;
    const existing = await this.dbService.getSalesOrderByNo(this.salesOrderNo);
    const payload = {
      ...existing,
      ...this.buildSalesOrderPayload(),
      status
    };
    await this.dbService.addOrUpdateSalesOrder(payload);
    await this.loadSalesOrders();
  }

  async saveDraft() {
    await this.upsertSalesOrder('DRAFT');
    alert('Sales Order saved as Draft');
  }

  async submitOrder() {
    await this.upsertSalesOrder('SUBMITTED');
    alert('Sales Order submitted successfully');
  }

  async approveOrder() {
    await this.upsertSalesOrder('APPROVED');
    alert('Sales Order approved');
  }

  // ===== TABLE ACTIONS =====

  editDraft(order: any) {
    this.showForm = true;
    this.isEditing = true;
    this.editingOrder = order;

    this.salesOrderNo = order.orderNo;
    this.salesOrderDate = order.orderDate;
    this.selectedCompanyName = order.companyName || ''; // Set dropdown
    this.customerName = order.customerName;
    this.customerId = order.customerId;
    this.billAddr = order.billAddr;
    this.shipAddr = order.shipAddr;
    this.gstNo = order.gstNo || '';
    this.contactPerson = order.contactPerson || '';
    this.contactNo = order.contactNo || '';
    this.paymentTerms = order.paymentTerms || 'Advance';
    this.creditDays = order.creditDays || null;
    this.poNo = order.poNo || '';
    this.poDate = order.poDate || '';
    this.itemsShow = JSON.parse(JSON.stringify(order.items));
    this.freightCharges = order.freightCharges || 0;
    this.advanceReceived = order.advanceReceived || 0;
    this.expectedDeliveryDate = order.expectedDeliveryDate || '';
    this.deliveryTerms = order.deliveryTerms || '';
    this.transporterName = order.transporterName || '';
    this.transportMode = order.transportMode || '';
    this.salesOrderStatus = order.status || 'DRAFT';
  }

  async approveFromTable(order: any) {
    try {
      const approvedOrder = {
        ...order,
        status: 'APPROVED',
        updatedAt: new Date().toISOString()
      };

      await this.dbService.put('salesOrders', approvedOrder);
      console.log('✅ Sales Order approved:', order.orderNo);
      alert('✅ Sales Order approved');
      await this.loadSalesOrders();
    } catch (error) {
      console.error('❌ Failed to approve Sales Order:', error);
      alert('❌ Failed to approve Sales Order');
    }
  }

  async deleteDraft(order: any) {
    if (!confirm(`Delete Sales Order ${order.orderNo}?`)) return;

    try {
      await this.dbService.delete('salesOrders', order.id);
      console.log('🗑️ Sales Order deleted:', order.orderNo);
      alert('✅ Sales Order deleted successfully');
      await this.loadSalesOrders();
    } catch (error) {
      console.error('❌ Failed to delete Sales Order:', error);
      alert('❌ Failed to delete Sales Order');
    }
  }

  // ===== ITEM MANAGEMENT =====

  createEmptyLine() {
    return { item: '', qty: 1, uom: '', hsn: '', rate: 0, disc: 0, discountType: '₹', gst: 0, total: 0 };
  }

  addLine() {
    this.itemsShow.push(this.createEmptyLine());
  }

  removeLine(index: number) {
    this.itemsShow.splice(index, 1);
  }

  recalculateLine(line: any) {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    let base = qty * rate;

    if (line.discountType === '%') {
      base -= base * (Number(line.disc) || 0) / 100;
    } else {
      base -= Number(line.disc) || 0;
    }

    const tax = base * (Number(line.gst) || 0) / 100;
    line.total = base + tax;
  }

  getSubtotal(): number {
    return this.itemsShow.reduce((s, i) => s + (i.qty * i.rate), 0);
  }

  getTaxTotal(): number {
    return this.itemsShow.reduce((s, i) => s + ((i.qty * i.rate) * (i.gst / 100)), 0);
  }

  getGrandTotal(): number {
    return this.getSubtotal() + this.getTaxTotal() + (this.freightCharges || 0);
  }

  // ===== HELPERS =====

  getCompanyNames(): string[] {
    return this.customers
      .filter(c => c.companyName && c.companyName.trim())
      .map(c => c.companyName.trim())
      .filter((name, index, self) => self.indexOf(name) === index)
      .sort((a, b) => a.localeCompare(b));
  }

  resetCompanyFields(): void {
    this.customerId = '';
    this.customerName = '';
    this.contactPerson = '';
    this.contactNo = '';
    this.gstNo = '';
    this.billAddr = '';
    this.shipAddr = '';
  }

  // File handling
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.addFilesFromFileList(input.files);
    input.value = '';
  }

  private addFilesFromFileList(list: FileList): void {
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i);
      if (!f) continue;
      const exists = this.files.some(existing => existing.name === f.name && existing.size === f.size);
      if (!exists) this.files.push(f);
    }
  }

  removeFile(index: number): void {
    if (index >= 0 && index < this.files.length) this.files.splice(index, 1);
  }

  clearAllFiles(): void { this.files = []; }

  // PDF Generation
  // downloadSalesOrderPDF(order?: any) {
  //   const so = order ?? {
  //     orderNo: this.salesOrderNo,
  //     orderDate: this.salesOrderDate,
  //     customerName: this.customerName,
  //     billAddr: this.billAddr,
  //     shipAddr: this.shipAddr,
  //     items: this.itemsShow,
  //     freightCharges: this.freightCharges
  //   };

  //   const doc = new jsPDF('p', 'mm', 'a4');
  //   const pageWidth = doc.internal.pageSize.getWidth();
  //   let yPosition = 20;

  //   doc.setFontSize(16);
  //   doc.text('SALES ORDER', pageWidth / 2, yPosition, { align: 'center' });
  //   yPosition += 10;

  //   doc.setFontSize(12);
  //   doc.text(`Order No: ${so.orderNo}`, 15, yPosition);
  //   doc.text(`Date: ${so.orderDate}`, pageWidth - 60, yPosition);
  //   yPosition += 10;

  //   doc.text(`Customer: ${so.customerName}`, 15, yPosition);
  //   yPosition += 20;

  //   const tableData = so.items.map((item: any, index: number) => [
  //     (index + 1).toString(),
  //     item.item || '-',
  //     item.qty.toString(),
  //     item.uom || 'Kg',
  //     item.rate.toFixed(2),
  //     item.total.toFixed(2)
  //   ]);

  //   autoTable(doc, {
  //     startY: yPosition,
  //     head: [['Sr.', 'Item', 'Qty', 'UOM', 'Rate', 'Amount']],
  //     body: tableData,
  //   });

  //   doc.save(`${so.orderNo}.pdf`);
  // }

  downloadSalesOrderPDF(order?: any) {
    const so = order ?? {
      orderNo: this.salesOrderNo,
      orderDate: this.salesOrderDate,
      customerName: this.customerName,
      items: this.itemsShow,
      freightCharges: this.freightCharges
    };

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 15;

    // ===== HEADER =====
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Navbharat Insulation & Engg. Co.', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 8;
    doc.text('SALES ORDER', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 7;
    doc.setFontSize(11);
    doc.text('Quantity & Rate Schedule', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 7;
    doc.setFontSize(12);

    const soDate = so.orderDate
      ? new Date(so.orderDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      : new Date().toLocaleDateString('en-IN');

    doc.text(
      `ORDER REFERENCE : ${so.orderNo} Dt. ${soDate}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );

    yPosition += 10;

    // ===== ITEMS TABLE =====
    const tableData = so.items.map((item: any, index: number) => {
      const specifications =
        item.specifications || (item.hsn ? `HSN: ${item.hsn}` : '-');

      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      let base = qty * rate;

      if (item.discountType === '%') {
        base -= base * (Number(item.disc) || 0) / 100;
      } else {
        base -= Number(item.disc) || 0;
      }

      return [
        (index + 1).toString(),
        item.item || '-',
        item.hsn || '-',
        specifications,
        qty.toString(),
        item.uom || 'Kg',
        rate.toFixed(2),
        base.toFixed(2)
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [[
        'Sr. No.',
        'Material Description',
        'HSN CODE',
        'Specifications',
        'Quantity',
        'Uom',
        'Rate/Uom',
        'Amount (Rs.)'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 35 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 20, halign: 'center' },
        7: { cellWidth: 25, halign: 'right' }
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;

    // ===== CORRECT CALCULATIONS =====
    const baseTotal = so.items.reduce((sum: number, i: any) => {
      const qty = Number(i.qty) || 0;
      const rate = Number(i.rate) || 0;
      let base = qty * rate;

      if (i.discountType === '%') {
        base -= base * (Number(i.disc) || 0) / 100;
      } else {
        base -= Number(i.disc) || 0;
      }

      return sum + base;
    }, 0);

    const gstTotal = so.items.reduce((sum: number, i: any) => {
      const qty = Number(i.qty) || 0;
      const rate = Number(i.rate) || 0;
      let base = qty * rate;

      if (i.discountType === '%') {
        base -= base * (Number(i.disc) || 0) / 100;
      } else {
        base -= Number(i.disc) || 0;
      }

      return sum + (base * (Number(i.gst) || 0) / 100);
    }, 0);

    // ===== FINANCIAL SUMMARY =====
    const summaryStartX = 120;
    doc.setFontSize(11);

    doc.setFont('helvetica', 'bold');
    doc.text('Assessable Value :', summaryStartX, yPosition, { align: 'right' });
    doc.text(baseTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.text('Packing & Forwarding', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text((so.freightCharges || 0).toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.text('Sub Total:', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    const subTotal = baseTotal + (so.freightCharges || 0);
    doc.text(subTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    const taxRate = so.items.length > 0 && so.items[0].gst ? so.items[0].gst : 18;
    doc.setFont('helvetica', 'normal');
    doc.text(`IGST @ ${taxRate}%`, summaryStartX, yPosition, { align: 'right' });
    doc.text('N.A.', summaryStartX + 25, yPosition, { align: 'center' });
    doc.text(gstTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Round off', summaryStartX, yPosition, { align: 'right' });
    const grandTotalBeforeRound = subTotal + gstTotal;
    const roundedTotal = Math.round(grandTotalBeforeRound);
    const roundOff = roundedTotal - grandTotalBeforeRound;
    doc.text(roundOff.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    doc.text('Grand Total :', summaryStartX, yPosition, { align: 'right' });
    doc.text(roundedTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'bold');
    doc.text(`In Words - Rs. ${this.convertNumberToWords(roundedTotal)}`, 15, yPosition);
    yPosition += 10;

    doc.text(
      '# Subject to the Terms stated in enclosed Commercial Terms & Conditions Annexure.',
      15,
      yPosition
    );
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition);
    doc.setFontSize(11);
    doc.text('Signed', pageWidth - 15, yPosition, { align: 'right' });

    yPosition += 15;

    doc.setFontSize(11);
    doc.text('Authorised Signatory', 15, yPosition);
    doc.text(`For ${so.companyName || 'Customer'}`, pageWidth - 15, yPosition, { align: 'right' });

    yPosition += 5;
    doc.text('Accepted as above', pageWidth - 15, yPosition, { align: 'right' });

    doc.save(`${so.orderNo}.pdf`);
  }


  private buildSalesOrderPayload() {
    return {
      orderNo: this.salesOrderNo,
      orderDate: this.salesOrderDate,
      customerName: this.customerName,
      customerId: this.customerId,
      billAddr: this.billAddr,
      shipAddr: this.shipAddr,
      gstNo: this.gstNo,
      contactPerson: this.contactPerson,
      contactNo: this.contactNo,
      paymentTerms: this.paymentTerms,
      creditDays: this.creditDays,
      poNo: this.poNo,
      poDate: this.poDate,
      items: this.itemsShow,
      freightCharges: this.freightCharges,
      grandTotal: this.getGrandTotal(),
      status: this.salesOrderStatus,
      createdAt: new Date().toISOString(),
      expectedDeliveryDate: this.expectedDeliveryDate,
      deliveryTerms: this.deliveryTerms,
      transporterName: this.transporterName,
      transportMode: this.transportMode,
      companyName: this.selectedCompanyName,
    };
  }

  // Format Helpers
  formatAddress(addr: any): string {
    if (!addr) return '';
    return `${addr.street}, ${addr.area}, ${addr.city}, ${addr.state}, ${addr.country}`;
  }

  getYearRange(): string {
    const y = new Date().getFullYear();
    return `${y}-${(y + 1).toString().slice(-2)}`;
  }

  toThreeDigits(n: number): string {
    return n.toString().padStart(3, '0');
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = Math.max(0, decimals);
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return `${value} ${sizes[i]}`;
  }

  convertNumberToWords(amount: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const numToWords = (num: number): string => {
      if (num < 20) return ones[num];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numToWords(num % 100) : '');
      return num.toString();
    };
    return numToWords(amount);
  }

  // Drag & Drop
  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = true;
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
    const dt = ev.dataTransfer;
    if (dt && dt.files.length) {
      this.addFilesFromFileList(dt.files);
    }
  }
}