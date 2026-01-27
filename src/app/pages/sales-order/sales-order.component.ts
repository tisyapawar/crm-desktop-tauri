import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DBService } from '../../service/db.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AfterViewInit } from '@angular/core';
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

  salesOrderStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED' = 'DRAFT';
  draftOrders: any[] = [];
  submittedOrders: any[] = [];
  approvedOrders: any[] = [];
  showForm = false;
  editingOrder: any = null;



  /* ---------------- PAGE STATE ---------------- */
  newSale = true;
  state: any;
  inquiry: any;

  /* ---------------- PAYMENT TERMS ---------------- */
  pTerms = [
    { name: 'Advance', value: 'Advance' },
    { name: 'Credit', value: 'Credit' }
  ];

  onPaymentTermsChange(value: string) {
    if (value !== 'Credit') {
      this.creditDays = null;
    }
  }
  /* ---------------- BASIC DETAILS ---------------- */
  salesOrderNo = '';
  salesOrderDate = '';
  customerName = '';
  customerId = '';
  billAddr = '';
  shipAddr = '';
  gstNo = '';

  /* ---------------- CONTACT ---------------- */
  contactPerson = '';
  contactNo = '';
  paymentTerms = 'Advance';
  creditDays: number | null = null;
  poNo = '';
  poDate = '';

  /* ---------------- ITEMS (MAIN TABLE) ---------------- */
  itemsShow: any[] = [];

  /* ---------------- SUMMARY ---------------- */
  freightCharges = 0;
  advanceReceived = 0;

  /* ---------------- DELIVERY ---------------- */
  expectedDeliveryDate = '';
  deliveryTerms = '';
  transporterName = '';
  transportMode = '';

  /* ---------------- ATTACHMENTS ---------------- */
  files: File[] = [];
  isDragActive = false;

  /* ---------------- DATA ---------------- */
  customers: any[] = [];
  allItems: any[] = [];

  constructor(
    private router: Router,
    private dbService: DBService
  ) { }

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
      createdAt: new Date().toISOString()
    };
  }


  /* ---------------- INIT ---------------- */
  async ngOnInit(): Promise<void> {
    await this.initDBAndLoad();

    const nav = this.router.getCurrentNavigation();
    this.state = nav?.extras?.state ?? history.state;
    this.inquiry = this.state?.inquiry;


    if (!this.inquiry) {
      this.newSale = true;
      await this.generateSalesOrderNo(); // 🔥 AUTO-GENERATE
      this.salesOrderDate = new Date().toISOString().slice(0, 10);
      this.addLine();
      return;
    }


    /* Auto-fill from Inquiry */
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
        gst: product?.gst ?? 0,
        total: 0
      });
      this.recalculateLine(this.itemsShow[this.itemsShow.length - 1]);
    });

  }

  async ngAfterViewInit() {
    console.log('🟢 ngAfterViewInit → loading sales orders');
    await this.loadSalesOrders();
  }


  async generateSalesOrderNo() {
    const db = await this.dbService.openDB();
    const tx = db.transaction('salesOrders', 'readonly');
    const store = tx.objectStore('salesOrders');

    return new Promise<void>((resolve) => {
      const req = store.openCursor(null, 'prev'); // 🔥 LAST record

      req.onsuccess = () => {
        let next = 1;

        if (req.result?.value?.orderNo) {
          const lastNo = req.result.value.orderNo; // SO/2025/43302
          const parts = lastNo.split('/');
          next = Number(parts[2]) + 1;
        }

        const year = new Date().getFullYear();
        this.salesOrderNo = `SO/${year}/${String(next).padStart(5, '0')}`;

        console.log('🆕 Generated Sales Order No:', this.salesOrderNo);
        resolve();
      };
    });
  }



  /* ---------------- ITEM ROW HANDLING ---------------- */
  createEmptyLine() {
    return {
      item: '',
      qty: 1,
      uom: '',
      hsn: '',
      rate: 0,
      disc: 0,
      discountType: '₹',
      gst: 0,
      total: 0
    };
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

  /* ---------------- TOTALS ---------------- */
  getSubtotal(): number {
    return this.itemsShow.reduce((s, i) => s + (i.qty * i.rate), 0);
  }

  getTaxTotal(): number {
    return this.itemsShow.reduce((s, i) => s + ((i.qty * i.rate) * (i.gst / 100)), 0);
  }

  getGrandTotal(): number {
    return this.getSubtotal() + this.getTaxTotal() + (this.freightCharges || 0);
  }

  /* ---------------- SAVE / CANCEL ---------------- */
  onSave() {
    const salesOrder = {
      salesOrderNo: this.salesOrderNo,
      date: this.salesOrderDate,
      customerName: this.customerName,
      billAddr: this.billAddr,
      shipAddr: this.shipAddr,
      items: this.itemsShow,
      freightCharges: this.freightCharges,
      advanceReceived: this.advanceReceived,
      total: this.getGrandTotal(),
      createdAt: new Date().toISOString()
    };

    console.log('SAVING SALES ORDER:', salesOrder);
    alert('Sales Order saved (check console)');
  }

  onCancel() {
    this.newSale = true;
    this.itemsShow = [];
    this.addLine();
  }

  /* ---------------- HELPERS ---------------- */
  async initDBAndLoad() {
    try {
      // Load inventory items from unified crm-db using DBService
      this.allItems = await this.dbService.getAll('inventory');
      console.log('📦 Loaded inventory items from unified DB:', this.allItems.length);
    } catch (error) {
      console.error('❌ Failed to load inventory:', error);
      this.allItems = [];
    }
  }

  async loadCustomerByName(name: string) {
    const db = await this.dbService.openDB();
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    return new Promise<any>(resolve => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.find((c: any) => c.name === name));
    });
  }

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

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.addFilesFromFileList(input.files);
    // reset input so same file can be reselected if needed
    input.value = '';
  }

  private addFilesFromFileList(list: FileList): void {
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i);
      if (!f) continue;
      // optional: avoid duplicates by name+size
      const exists = this.files.some(existing => existing.name === f.name && existing.size === f.size);
      if (!exists) this.files.push(f);
    }
  }

  removeFile(index: number): void {
    if (index >= 0 && index < this.files.length) {
      this.files.splice(index, 1);
    }
  }

  // clear all
  clearAllFiles(): void {
    this.files = [];
  }

  // drag/drop handlers
  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = true;
    // add active class to drop area
    const el = (ev.currentTarget as HTMLElement);
    el.classList.add('active');
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
    const el = (ev.currentTarget as HTMLElement);
    el.classList.remove('active');
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
    const el = (ev.currentTarget as HTMLElement);
    el.classList.remove('active');

    const dt = ev.dataTransfer;
    if (!dt) return;
    if (dt.files && dt.files.length) {
      this.addFilesFromFileList(dt.files);
    }
  }

  // helper to show human-friendly sizes
  formatBytes(bytes: number, decimals = 2): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = Math.max(0, decimals);
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return `${value} ${sizes[i]}`;
  }

  private async upsertSalesOrder(
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED'
  ) {
    this.salesOrderStatus = status;

    // 🔎 fetch existing by orderNo
    const existing = await this.dbService.getSalesOrderByNo(this.salesOrderNo);

    const payload = {
      ...existing,               // keeps id if exists
      ...this.buildSalesOrderPayload(),
      status
    };

    await this.dbService.addOrUpdateSalesOrder(payload);
    await this.loadSalesOrders();
  }

  // async saveDraft() {
  //   this.salesOrderStatus = 'DRAFT';

  //   const payload = this.buildSalesOrderPayload();
  //   console.log('💾 Saving draft payload:', payload);

  //   await this.dbService.addOrUpdateSalesOrder(payload);

  //   console.log('✅ Draft saved, reloading tables');
  //   await this.loadSalesOrders();

  //   alert('Sales Order saved as Draft');
  // }

  async saveDraft() {
    await this.upsertSalesOrder('DRAFT');
    alert('Sales Order saved as Draft');
  }

  // async submitOrder() {
  //   this.salesOrderStatus = 'SUBMITTED';

  //   const payload = this.buildSalesOrderPayload();
  //   console.log('📤 Submitting payload:', payload);

  //   await this.dbService.addOrUpdateSalesOrder(payload);

  //   console.log('✅ Submitted, reloading tables');
  //   await this.loadSalesOrders();

  //   alert('Sales Order submitted successfully');
  // }

  async submitOrder() {
    await this.upsertSalesOrder('SUBMITTED');
    alert('Sales Order submitted successfully');
  }

  // async approveOrder() {
  //   this.salesOrderStatus = 'APPROVED';

  //   const payload = this.buildSalesOrderPayload();

  //   // 1️⃣ Update Sales Order status
  //   await this.dbService.addOrUpdateSalesOrder(payload);

  //   // 2️⃣ Push into Orders table
  //   await this.dbService.addOrder({
  //     // id: payload.id,
  //     orderNo: payload.orderNo,
  //     orderDate: payload.orderDate,
  //     customerName: payload.customerName,
  //     items: payload.items.map((i: any) => ({
  //       productName: i.item,
  //       qty: i.qty
  //     })),
  //     totalAmount: payload.grandTotal,
  //     status: 'offers'
  //   });

  //   alert('Sales Order approved and moved to Orders');
  // }

  async approveOrder() {
    await this.upsertSalesOrder('APPROVED');

    // push to orders table (this is correct)
    await this.dbService.addOrder({
      orderNo: this.salesOrderNo,
      orderDate: this.salesOrderDate,
      customerName: this.customerName,
      items: this.itemsShow.map((i: any) => ({
        productName: i.item,
        qty: i.qty
      })),
      totalAmount: this.getGrandTotal(),
      status: 'offers'
    });

    alert('Sales Order approved and moved to Orders');
  }

  async loadSalesOrders() {
    console.log('📥 loadSalesOrders() called');

    const db = await this.dbService.openDB();
    console.log('✅ DB opened:', db.name);

    console.log(
      '📦 Available stores:',
      Array.from(db.objectStoreNames)
    );

    if (!db.objectStoreNames.contains('salesOrders')) {
      console.error('❌ salesOrders store DOES NOT EXIST');
      return;
    }

    const tx = db.transaction('salesOrders', 'readonly');
    const store = tx.objectStore('salesOrders');

    const req = store.getAll();

    req.onsuccess = () => {
      console.log('📄 Raw salesOrders data:', req.result);

      const all = req.result || [];

      this.draftOrders = all.filter(o => o.status === 'DRAFT');
      this.submittedOrders = all.filter(o => o.status === 'SUBMITTED');
      this.approvedOrders = all.filter(o => o.status === 'APPROVED');

      console.log('🟦 Draft orders:', this.draftOrders);
      console.log('🟨 Submitted orders:', this.submittedOrders);
      console.log('🟨 Approved orders:', this.approvedOrders);
    };

    req.onerror = () => {
      console.error('❌ Failed to read salesOrders', req.error);
    };
  }

  async createNewSalesOrder() {
    this.showForm = true;
    this.newSale = true;
    this.editingOrder = null;

    await this.generateSalesOrderNo();
    this.salesOrderDate = new Date().toISOString().slice(0, 10);
  }

  editDraft(order: any) {
    this.showForm = true;
    this.newSale = false;

    this.salesOrderNo = order.orderNo;
    this.salesOrderDate = order.orderDate;
    this.customerName = order.customerName;
    this.customerId = order.customerId;
    this.billAddr = order.billAddr;
    this.shipAddr = order.shipAddr;
    this.itemsShow = JSON.parse(JSON.stringify(order.items));
    this.freightCharges = order.freightCharges;
    this.salesOrderStatus = order.status;
  }


  async approveFromTable(order: any) {
    order.status = 'APPROVED';

    // update salesOrders
    await this.dbService.addOrUpdateSalesOrder(order);

    // push to orders table
    await this.dbService.addOrder({
      orderNo: order.orderNo,
      orderDate: order.orderDate,
      customerName: order.customerName,
      items: order.items.map((i: any) => ({
        productName: i.item,
        qty: i.qty
      })),
      totalAmount: order.grandTotal,
      status: 'offers'
    });

    alert('Sales Order approved');

    await this.loadSalesOrders(); // refresh tables
  }

  async deleteDraft(order: any) {
    const confirmed = confirm(
      `Are you sure you want to delete Sales Order ${order.orderNo}?`
    );

    if (!confirmed) return;

    const db = await this.dbService.openDB();
    const tx = db.transaction('salesOrders', 'readwrite');
    const store = tx.objectStore('salesOrders');

    const req = store.delete(order.id);

    req.onsuccess = async () => {
      console.log('🗑️ Draft deleted:', order.orderNo);
      await this.loadSalesOrders(); // refresh table
    };

    req.onerror = () => {
      console.error('❌ Failed to delete draft', req.error);
      alert('Failed to delete draft');
    };
  }

  goBackToList() {
    console.log('⬅️ Navigating back to Sales Order list');
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/sales-order']);
    });
  }

  // downloadSalesOrderPDF() {
  //   const doc = new jsPDF('p', 'mm', 'a4');

  //   // ===== HEADER =====
  //   doc.setFontSize(16);
  //   doc.text('SALES ORDER', 105, 15, { align: 'center' });

  //   doc.setFontSize(10);
  //   doc.text(`Order No: ${this.salesOrderNo}`, 14, 25);
  //   doc.text(`Order Date: ${this.salesOrderDate}`, 150, 25);

  //   doc.text(`Customer: ${this.customerName}`, 14, 32);
  //   doc.text(`Customer ID: ${this.customerId}`, 150, 32);

  //   doc.text('Billing Address:', 14, 40);
  //   doc.text(this.billAddr || '-', 14, 45, { maxWidth: 80 });

  //   doc.text('Shipping Address:', 110, 40);
  //   doc.text(this.shipAddr || '-', 110, 45, { maxWidth: 80 });

  //   // ===== ITEMS TABLE =====
  //   const tableData = this.itemsShow.map((i, index) => [
  //     index + 1,
  //     i.item,
  //     i.qty,
  //     i.uom,
  //     i.rate,
  //     i.gst + '%',
  //     i.total.toFixed(2)
  //   ]);

  //   autoTable(doc, {
  //     startY: 70,
  //     head: [['#', 'Item', 'Qty', 'UOM', 'Rate', 'GST', 'Total']],
  //     body: tableData,
  //     styles: { fontSize: 9 },
  //     headStyles: { fillColor: [15, 23, 42] }, // navy
  //     columnStyles: {
  //       0: { cellWidth: 8 },
  //       1: { cellWidth: 45 },
  //       6: { halign: 'right' }
  //     }
  //   });

  //   const finalY = (doc as any).lastAutoTable.finalY + 8;

  //   // ===== TOTALS =====
  //   doc.setFontSize(10);
  //   doc.text(`Subtotal: ${this.getSubtotal().toFixed(2)}`, 140, finalY);
  //   doc.text(`Tax: ${this.getTaxTotal().toFixed(2)}`, 140, finalY + 6);
  //   doc.text(`Freight: ${this.freightCharges.toFixed(2)}`, 140, finalY + 12);

  //   doc.setFontSize(11);
  //   doc.text(`Grand Total: ${this.getGrandTotal().toFixed(2)}`, 140, finalY + 20);

  //   // ===== FOOTER =====
  //   doc.setFontSize(9);
  //   doc.text('Generated from CRM', 14, 285);

  //   // ===== SAVE =====
  //   doc.save(`${this.salesOrderNo}.pdf`);
  // }

  downloadSalesOrderPDF(order?: any) {

    // 🔁 Resolve data source (form OR table row)
    const so = order ?? {
      orderNo: this.salesOrderNo,
      orderDate: this.salesOrderDate,
      customerName: this.customerName,
      billAddr: this.billAddr,
      shipAddr: this.shipAddr,
      items: this.itemsShow,
      freightCharges: this.freightCharges
    };

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    const logoPath = 'assets/LOGO.jpg';
    const logoWidth = 40;
    const logoHeight = 20;
    const logoX = (pageWidth - logoWidth) / 2;

    try {
      doc.addImage(logoPath, 'PNG', logoX, 10, logoWidth, logoHeight);
    } catch (error) {
      console.warn('Logo could not be loaded from:', logoPath, error);
    }

    let yPosition = 10 + logoHeight + 10;

    /* ================= HEADER ================= */
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

    /* ================= CUSTOMER & ADDRESSES ================= */
    yPosition += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    doc.text(`Customer Name : ${so.customerName}`, 15, yPosition);
    yPosition += 6;

    // Billing
    doc.setFont('helvetica', 'bold');
    doc.text('Billing Address:', 15, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(so.billAddr || '-', 15, yPosition + 5, { maxWidth: 80 });

    // Shipping
    doc.setFont('helvetica', 'bold');
    doc.text('Shipping Address:', pageWidth / 2 + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(so.shipAddr || '-', pageWidth / 2 + 5, yPosition + 5, { maxWidth: 80 });

    yPosition += 22;

    /* ================= ITEMS TABLE ================= */
    const tableData = so.items.map((item: any, index: number) => {
      const specifications =
        item.specifications || (item.hsn ? `HSN: ${item.hsn}` : '-');

      return [
        (index + 1).toString(),
        item.item || '-',
        item.hsn || '-',
        specifications,
        item.qty.toString(),
        item.uom || 'Kg',
        item.rate.toFixed(2),
        item.total.toFixed(2)
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
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;

    /* ================= FINANCIAL SUMMARY ================= */
    const assessable = so.items.reduce((s: number, i: any) => s + (i.qty * i.rate), 0);
    const freight = so.freightCharges || 0;
    const igstAmount = so.items.reduce(
      (s: number, i: any) => s + ((i.qty * i.rate) * (i.gst / 100)), 0
    );

    const subTotal = assessable + freight;
    const grandBeforeRound = subTotal + igstAmount;
    const roundedTotal = Math.round(grandBeforeRound);
    const roundOff = roundedTotal - grandBeforeRound;

    const summaryX = 120;
    doc.setFontSize(11);

    doc.text('Assessable Value :', summaryX, yPosition, { align: 'right' });
    doc.text(assessable.toFixed(2), summaryX + 50, yPosition);
    yPosition += 6;

    doc.text('Packing & Forwarding', summaryX, yPosition, { align: 'right' });
    doc.text(freight.toFixed(2), summaryX + 50, yPosition);
    yPosition += 6;

    doc.text('Sub Total:', summaryX, yPosition, { align: 'right' });
    doc.text(subTotal.toFixed(2), summaryX + 50, yPosition);
    yPosition += 6;

    doc.text('IGST', summaryX, yPosition, { align: 'right' });
    doc.text(igstAmount.toFixed(2), summaryX + 50, yPosition);
    yPosition += 6;

    doc.text('Round off', summaryX, yPosition, { align: 'right' });
    doc.text(roundOff.toFixed(2), summaryX + 50, yPosition);
    yPosition += 6;

    doc.text('Grand Total :', summaryX, yPosition, { align: 'right' });
    doc.text(roundedTotal.toFixed(2), summaryX + 50, yPosition);

    yPosition += 8;
    doc.text(`In Words - Rs. ${this.convertNumberToWords(roundedTotal)}`, 15, yPosition);

    yPosition += 12;
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition);
    doc.text('Authorised Signatory', 15, yPosition + 10);

    doc.save(`${so.orderNo}.pdf`);
  }


  convertNumberToWords(amount: number): string {
    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
      'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
      'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];

    const tens = [
      '', '', 'Twenty', 'Thirty', 'Forty',
      'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    const numToWords = (num: number): string => {
      if (num < 20) return ones[num];
      if (num < 100)
        return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      if (num < 1000)
        return (
          ones[Math.floor(num / 100)] +
          ' Hundred' +
          (num % 100 ? ' ' + numToWords(num % 100) : '')
        );
      if (num < 100000)
        return (
          numToWords(Math.floor(num / 1000)) +
          ' Thousand' +
          (num % 1000 ? ' ' + numToWords(num % 1000) : '')
        );
      if (num < 10000000)
        return (
          numToWords(Math.floor(num / 100000)) +
          ' Lakh' +
          (num % 100000 ? ' ' + numToWords(num % 100000) : '')
        );
      return (
        numToWords(Math.floor(num / 10000000)) +
        ' Crore' +
        (num % 10000000 ? ' ' + numToWords(num % 10000000) : '')
      );
    };

    return numToWords(amount);
  }

}