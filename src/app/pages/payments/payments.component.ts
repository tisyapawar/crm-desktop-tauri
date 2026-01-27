import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DBService } from '../../service/db.service';
import { jsPDF } from 'jspdf';
/* =============================
   INTERFACES
============================= */

interface Customer {
  id: number;
  name: string;
  companyName?: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  pan?: string;
}

// interface Payment {
//   id?: number;
//   customerName: string;
//   customerId?: number;
//   companyName?: string;
//   mobile?: string;
//   email?: string;
//   gstin?: string;
//   pan?: string;
//   paymentId: string;
//   date: string;
//   amount: number;
//   status: string;
// }

interface Payment {
  companyName: string;
  mobile: string;
  email: string;
  gstin: string;
  pan: string;
  id?: number;                 // internal DB key
  paymentId: string;           // PAY/YYYY/XXXX

  customerName: string;
  customerId?: number;

  invoiceNo: string;           // 🔗 LINK
  invoiceAmount: number;

  amount: number;

  outstandingBefore: number;
  outstandingAfter: number;

  date: string;
  status: 'Pending' | 'Success' | 'Failed';
}


@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.css']
})
export class PaymentsComponent implements OnInit {

  payments: Payment[] = [];
  customers: Customer[] = [];
  filteredInvoices: any[] = [];

  showForm = false;
  isEditing = false;
  editIndex: number | null = null;
  sortAsc = false;
  invoices: any[] = [];

  newPayment: Payment = this.getEmptyPayment();

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
    this.loadCustomers();
    this.loadInvoices();
    this.loadPayments();
  }


  /* =============================
     LOAD DATA
  ============================= */

  loadInvoices() {
    this.dbService.getAll('invoices').then(data => {
      this.invoices = data || [];
    });
  }

  loadPayments() {
    this.dbService.getAll('payments').then(data => {
      this.payments = data || [];
      this.sortPayments();
    });
  }
  // loadPayments() {
  //   this.dbService.getAll('payments').then((data: Payment[]) => {
  //     this.payments = data || [];
  //     this.sortPayments();
  //   });
  // }

  loadCustomers() {
    this.dbService.getAll('customers').then((data: Customer[]) => {
      this.customers = data || [];
    });
  }

  /* =============================
     FORM HELPERS
  ============================= */
  getEmptyPayment(): Payment {
    return {
      customerName: '',
      customerId: undefined,
      companyName: '',
      mobile: '',
      email: '',
      gstin: '',
      pan: '',

      paymentId: '',
      invoiceNo: '',
      invoiceAmount: 0,

      amount: 0,

      outstandingBefore: 0,
      outstandingAfter: 0,

      date: '',
      status: 'Pending'
    };
  }


  toggleForm(edit = false, index?: number) {
    this.showForm = !this.showForm;

    if (!this.showForm) {
      this.resetForm();
      return;
    }

    if (edit && index !== undefined) {
      this.isEditing = true;
      this.editIndex = index;
      this.newPayment = { ...this.payments[index] };
    } else {
      this.resetForm();
    }
  }

  resetForm() {
    this.isEditing = false;
    this.editIndex = null;
    this.newPayment = this.getEmptyPayment();
  }

  /* =============================
     CUSTOMER AUTO-FILL
  ============================= */

  // onCustomerSelected(name: string) {
  //   const customer = this.customers.find(c => c.name === name);
  //   if (!customer) return;

  //   this.newPayment.customerName = customer.name;
  //   this.newPayment.customerId = customer.id;
  //   this.newPayment.companyName = customer.companyName || '';
  //   this.newPayment.mobile = customer.mobile || '';
  //   this.newPayment.email = customer.email || '';
  //   this.newPayment.gstin = customer.gstin || '';
  //   this.newPayment.pan = customer.pan || '';
  // }
  onCustomerSelected(customerName: string) {

    // Auto-fill customer details (existing logic)
    const customer = this.customers.find(c => c.name === customerName);
    if (!customer) return;

    this.newPayment.customerName = customer.name;
    this.newPayment.customerId = customer.id;
    this.newPayment.companyName = customer.companyName || '';
    this.newPayment.mobile = customer.mobile || '';
    this.newPayment.email = customer.email || '';
    this.newPayment.gstin = customer.gstin || '';
    this.newPayment.pan = customer.pan || '';

    // 🔥 RESET invoice selection
    this.newPayment.invoiceNo = '';
    this.newPayment.invoiceAmount = 0;
    this.newPayment.outstandingBefore = 0;
    this.newPayment.outstandingAfter = 0;

    // 🔥 FILTER invoices for this customer ONLY
    this.filteredInvoices = this.invoices.filter(inv =>
      inv.billTo?.name === customerName &&
      this.getInvoiceOutstanding(inv.invoiceNo) > 0
    );
  }



  generatePaymentId(): string {
    const year = new Date().getFullYear();

    // get all payments of this year
    const yearPayments = this.payments.filter(p =>
      p.paymentId?.startsWith(`PAY/${year}`)
    );

    const nextNumber = yearPayments.length + 1;

    return `PAY/${year}/${nextNumber.toString().padStart(4, '0')}`;
  }


  /* =============================
     SAVE PAYMENT
  ============================= */

  // savePayment() {

  //   if (!this.isEditing) {
  //     this.newPayment.id = Date.now();            // internal DB id
  //     this.newPayment.paymentId = this.generatePaymentId(); // 🔥 AUTO
  //     this.payments.push({ ...this.newPayment });
  //   } else if (this.editIndex !== null) {
  //     this.payments[this.editIndex] = { ...this.newPayment };
  //   }

  //   // persist safely
  //   this.payments.forEach(p => {
  //     this.dbService.put('payments', p);
  //   });

  //   this.toggleForm();
  //   this.sortPayments();
  // }

  savePayment() {

    // ❌ prevent overpayment
    if (this.newPayment.amount > this.newPayment.outstandingBefore) {
      alert('Payment cannot exceed outstanding amount');
      return;
    }

    // generate IDs on add
    if (!this.isEditing) {
      this.newPayment.id = Date.now();
      this.newPayment.paymentId = this.generatePaymentId();
    }

    // this.newPayment.status = 'Success';

    // save payment
    this.dbService.put('payments', this.newPayment);

    // 🔄 update invoice status
    const remaining = this.getInvoiceOutstanding(this.newPayment.invoiceNo)
      - this.newPayment.amount;

    const invoice = this.invoices.find(
      i => i.invoiceNo === this.newPayment.invoiceNo
    );

    if (invoice) {
      invoice.status =
        remaining <= 0 ? 'Paid' : 'Partially Paid';

      this.dbService.put('invoices', invoice);
    }

    this.toggleForm();
    this.loadPayments();
  }

  /* =============================
     SORT
  ============================= */

  get sortedPayments() {
    return [...this.payments].sort((a, b) => {
      const d1 = new Date(a.date).getTime();
      const d2 = new Date(b.date).getTime();
      return this.sortAsc ? d1 - d2 : d2 - d1;
    });
  }

  sortPayments() {
    this.payments = this.sortedPayments;
  }

  getInvoiceOutstanding(invoiceNo: string): number {
    const invoice = this.invoices.find(i => i.invoiceNo === invoiceNo);
    if (!invoice) return 0;

    const totalPaid = this.payments
      .filter(p => p.invoiceNo === invoiceNo && p.status === 'Success')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return Number(invoice.grandTotal) - totalPaid;
  }

  // onInvoiceSelected() {
  //   const invoice = this.invoices.find(
  //     i => i.invoiceNo === this.newPayment.invoiceNo
  //   );
  //   if (!invoice) return;

  //   const outstanding = this.getInvoiceOutstanding(invoice.invoiceNo);

  //   this.newPayment.invoiceAmount = invoice.grandTotal;
  //   this.newPayment.outstandingBefore = outstanding;
  //   this.newPayment.amount = outstanding; // default full payment
  //   this.newPayment.outstandingAfter = 0;
  // }

  onInvoiceSelected() {
    const invoice = this.filteredInvoices.find(
      i => i.invoiceNo === this.newPayment.invoiceNo
    );

    if (!invoice) return;

    const outstanding = this.getInvoiceOutstanding(invoice.invoiceNo);

    this.newPayment.invoiceAmount = invoice.grandTotal;
    this.newPayment.outstandingBefore = outstanding;
    this.newPayment.amount = outstanding;
    this.newPayment.outstandingAfter = 0;
  }

  ngDoCheck() {
    if (this.newPayment.outstandingBefore != null && this.newPayment.amount != null) {
      this.newPayment.outstandingAfter =
        this.newPayment.outstandingBefore - this.newPayment.amount;
    }
  }


  deletePayment(payment: any, index: number) {

    // 🔒 HARD BLOCK (extra safety)
    if (payment.status === 'Success') {
      alert('Successful payments cannot be deleted.');
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete payment ${payment.paymentId}?`
    );

    if (!confirmed) return;

    // Remove from UI
    this.payments.splice(index, 1);

    // Remove from IndexedDB using INTERNAL ID
    if (payment.id) {
      this.dbService.delete('payments', payment.id);
    }

    this.sortPayments();
  }

  downloadReceipt(payment: Payment) {
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text('PAYMENT RECEIPT', 70, 20);

    doc.setFontSize(10);
    doc.text(`Payment ID: ${payment.paymentId}`, 20, 40);
    doc.text(`Invoice No: ${payment.invoiceNo}`, 20, 50);
    doc.text(`Customer: ${payment.customerName}`, 20, 60);
    doc.text(`Amount Paid: ₹${payment.amount}`, 20, 70);
    doc.text(`Outstanding After: ₹${payment.outstandingAfter}`, 20, 80);
    doc.text(`Date: ${payment.date}`, 20, 90);

    doc.save(`${payment.paymentId}.pdf`);
  }


}
