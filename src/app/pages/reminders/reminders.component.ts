import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { DBService } from '../../service/db.service';
import { Router } from '@angular/router';

interface Reminder {
  name: string;
  mobile: string;
  time: string;
  type: 'offer' | 'call' | 'payment' | 'general';
  referenceNo?: string;   // Offer No / Invoice No etc.
  note?: string;
}

const ACTION_REMINDER_TYPES = [
  'offer',
  'offer-followup',
  'call',
  'general',
  'inquiry',
  'order'
];

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reminders.component.html',
  styleUrls: ['./reminders.component.css']
})
export class RemindersComponent implements OnInit, OnDestroy {

  selectedDate = new Date().toISOString().slice(0, 10);

  reminders: any[] = [];
  filteredReminders: any[] = [];

  dueInvoices: any[] = [];
  selectedCustomerInvoices: any[] = [];

  showPaymentEmail = false;
  selectedCustomerName = '';
  emailBody = '';

  /* ⭐ NEW — Add Reminder Modal State */
  showAddModal = false;
  form: Reminder & { date: string } = {
    name: '',
    mobile: '',
    time: '',
    date: '',
    type: 'general',     // ⭐ REQUIRED
    referenceNo: '',
    note: ''
  };



  private dbChangeHandler: any;

  constructor(private db: DBService, private router: Router) { }


  // async ngOnInit() {
  //   await this.syncPaymentReminders();
  //   await this.loadUserReminders();

  //   this.dbChangeHandler = async () => {
  //     await this.syncPaymentReminders();
  //     await this.loadUserReminders();
  //   };

  //   window.addEventListener('crm-db-changed', this.dbChangeHandler);
  // }

  async ngOnInit() {
    console.log('🚀 Reminders page init');

    // TEMP: cleanup wrong reminders once
    await this.cleanupWrongPaymentReminders();

    await this.syncPaymentReminders();
    await this.loadUserReminders();

    await this.debugReminders();

    this.dbChangeHandler = async () => {
      console.log('🔄 DB changed → reloading reminders');
      await this.syncPaymentReminders();
      await this.loadUserReminders();
    };

    window.addEventListener('crm-db-changed', this.dbChangeHandler);
  }


  ngOnDestroy() {
    window.removeEventListener('crm-db-changed', this.dbChangeHandler);
  }

  // --------------------------------------------------------------------
  // ⭐ USER REMINDERS (SELF REMINDERS)
  // --------------------------------------------------------------------

  async loadUserReminders() {
    const all = await this.db.getAll('reminders');

    console.log('📦 ALL reminders from DB:', all);

    /* ==========================
       ACTION REMINDERS (User)
       ========================== */
    // this.filteredReminders = all.filter(r => {
    //   if (r.type === 'payment') return false;        // ❌ exclude payments
    //   if (r.status === 'done') return false;         // ❌ hide completed

    //   const dbDate = new Date(r.date).toISOString().slice(0, 10);

    //   console.log(
    //     '🔎 Action check:',
    //     dbDate,
    //     '===',
    //     this.selectedDate,
    //     '→',
    //     dbDate === this.selectedDate
    //   );

    //   return dbDate === this.selectedDate;
    // });

    this.filteredReminders = all.filter(r => {
      // ❌ Exclude system payment reminders
      if (r.type === 'payment') return false;

      // ❌ Hide completed actions
      if (r.status === 'done') return false;

      // ✅ Only action-type reminders
      if (!ACTION_REMINDER_TYPES.includes(r.type)) return false;

      // ✅ Date match
      const dbDate = new Date(r.date).toISOString().slice(0, 10);
      return dbDate === this.selectedDate;
    });


    /* ==========================
       PAYMENT REMINDERS (System)
       ========================== */
    this.dueInvoices = all.filter(r =>
      r.type === 'payment' &&
      r.status === 'pending'
    );

    console.log('✅ Action Reminders FINAL:', this.filteredReminders);
    console.log('💰 Payment Reminders FINAL:', this.dueInvoices);
  }


  onDateChange() {
    console.log('📅 Date changed to:', this.selectedDate);
    this.loadUserReminders();
  }


  saveAllUserReminders() {
    localStorage.setItem('user-reminders', JSON.stringify(this.reminders));
  }

  filterReminders() {
    this.filteredReminders = this.reminders.filter(r => r.date === this.selectedDate);
  }

  // ⭐ Modal Button Click
  openAddModal() {
    this.form = {
      name: '',
      mobile: '',
      time: '',
      date: this.selectedDate,
      type: 'general',
      referenceNo: '',
      note: ''
    };
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  // Save New Reminder

  async saveReminder() {
    if (!this.form.name || !this.form.time || !this.form.type) {
      alert('Name, Time and Reminder Type are required');
      return;
    }

    const reminder = {
      ...this.form,
      date: this.selectedDate,
      source: 'manual',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await this.db.addReminder(reminder);
    await this.loadUserReminders();
    this.closeAddModal();
  }


  // Report PDF
  generateUserReminderReport() {
    if (this.filteredReminders.length === 0) {
      alert("No reminders for the selected date.");
      return;
    }

    const doc = new jsPDF();
    doc.text("Reminders Report", 105, 15, { align: "center" });
    doc.text(`Date: ${this.selectedDate}`, 14, 30);

    let y = 50;

    this.filteredReminders.forEach((r, i) => {
      doc.text(`${i + 1}. ${r.name} | ${r.mobile} | ${r.time}`, 14, y);
      y += 8;
    });

    doc.save(`Reminders_${this.selectedDate}.pdf`);
  }

  // Email for user reminders
  emailUserReminders() {
    if (this.filteredReminders.length === 0) {
      alert("No reminders to email for selected date.");
      return;
    }

    let content = `Your reminders for ${this.selectedDate}:\n\n`;

    this.filteredReminders.forEach((r, i) => {
      content += `${i + 1}. ${r.name} at ${r.time}\n`;
    });

    const subject = encodeURIComponent(`Reminders for ${this.selectedDate}`);
    const body = encodeURIComponent(content);

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  // --------------------------------------------------------------------
  // PAYMENT REMINDERS (INVOICES)
  // --------------------------------------------------------------------

  // async loadDueInvoices() {
  //   const invoices = await this.db.getAllInvoices();
  //   const today = new Date();

  //   this.dueInvoices = invoices
  //     .filter(inv => inv.status === 'Pending')
  //     .map(inv => {
  //       const invoiceDate = inv.date ? new Date(inv.date) : new Date();
  //       const creditDays = inv.creditDays ?? 30;

  //       const dueDate = new Date(invoiceDate);
  //       dueDate.setDate(dueDate.getDate() + creditDays);

  //       const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  //       return {
  //         id: inv.id,
  //         invoiceNumber: inv.invoiceNumber,
  //         customerName: inv.customerName,
  //         invoiceDate: inv.date,
  //         amount: inv.totalAmount,
  //         creditDays,
  //         dueDate: dueDate.toISOString().slice(0, 10),
  //         overdueDays
  //       };
  //     })
  //     .filter(inv => inv.overdueDays >= 0);
  // }

  navigateFromReminder(r: any) {
    console.log('🔗 Navigating from reminder:', r);

    if (!r.referenceNo) return;

    // switch (r.type) {
    //   case 'offer':
    //     this.router.navigate(['/offers'], {
    //       queryParams: { ref: r.referenceNo }
    //     });
    //     break;

    //   case 'payment':
    //     this.router.navigate(['/invoices'], {
    //       queryParams: { inv: r.referenceNo }
    //     });
    //     break;

    //   case 'call':
    //   case 'general':
    //     // Optional: open customer page later
    //     console.log('ℹ No navigation defined for type:', r.type);
    //     break;
    //   default:
    //     console.warn('⚠ Unknown reminder type:', r.type);
    // }
    switch (r.type) {
      case 'offer':
        this.router.navigate(['/offers'], {
          queryParams: { ref: r.referenceNo }
        });
        break;

      case 'payment':
        this.router.navigate(['/invoices'], {
          queryParams: { inv: r.referenceNo }
        });
        break;

      case 'call':
      case 'general':
      case 'inquiry':
      case 'order':
        console.log('ℹ Manual follow-up reminder');
        break;
    }

  }

  openPaymentReminder(customerName: string) {
    this.selectedCustomerName = customerName;
    this.selectedCustomerInvoices = this.dueInvoices.filter(x => x.customerName === customerName);

    let lines = '';
    this.selectedCustomerInvoices.forEach((inv, i) => {
      lines += `${i + 1}. ${inv.invoiceNumber} | ${inv.invoiceDate} | ₹${inv.amount} | Due: ${inv.dueDate} | Overdue: ${inv.overdueDays} days\n`;
    });

    this.emailBody =
      `To,
${customerName}

Subject: Payment Reminder

Dear Sir,

Your payment is pending for the following invoices:

${lines}

Kindly arrange the payment at the earliest.

Warm regards,
NAVBHARAT`;

    this.showPaymentEmail = true;
  }

  closePaymentEmail() {
    this.showPaymentEmail = false;
  }

  sendPaymentEmail() {
    const subject = encodeURIComponent("Payment Reminder");
    const body = encodeURIComponent(this.emailBody);

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    this.showPaymentEmail = false;
  }

  generateReminderPDF(customerName: string) {
    const doc = new jsPDF();

    doc.text("PAYMENT REMINDER", 105, 15, { align: 'center' });
    doc.text(`To: ${customerName}`, 14, 35);

    let y = 55;

    this.selectedCustomerInvoices.forEach((inv, i) => {
      doc.text(
        `${i + 1}. ${inv.invoiceNumber} | Amount: ₹${inv.amount} | Overdue: ${inv.overdueDays} days`,
        14,
        y
      );
      y += 8;
    });

    doc.save(`PaymentReminder_${customerName}.pdf`);
  }

  parseDDMMYYYY(dateStr: string): Date {
    if (!dateStr) return new Date();

    // Handles DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length !== 3) {
      const fallback = new Date(dateStr);
      return isNaN(fallback.getTime()) ? new Date() : fallback;
    }

    const [dd, mm, yyyy] = parts.map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  async cleanupWrongPaymentReminders() {
    const all = await this.db.getAllReminders();

    const wrong = all.filter(r =>
      r.type === 'payment' &&
      r.date.startsWith('2026') // adjust if needed
    );

    console.log('🧹 Deleting wrongly dated payment reminders:', wrong);

    for (const r of wrong) {
      await this.db.deleteReminder(r.id);
    }
  }

  async markReminderDone(reminder: any) {
    try {
      const updated = {
        ...reminder,
        status: 'done',
        completedAt: new Date().toISOString()
      };

      console.log('✅ Marking reminder as done:', updated);

      await this.db.put('reminders', updated);

      // Refresh list
      this.loadUserReminders();
    } catch (e) {
      console.error('❌ Failed to mark reminder done', e);
    }
  }

  async syncPaymentReminders() {
    console.log('🔄 Syncing payment reminders...');

    const invoices = await this.db.getAllInvoices();
    const reminders = await this.db.getAllReminders();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Existing payment reminders (avoid duplicates)
    const existingPaymentRefs = new Set(
      reminders
        .filter(r => r.type === 'payment')
        .map(r => r.referenceNo)
    );

    for (const inv of invoices) {
      console.log('📄 Invoice:', inv);

      // ✅ Only Pending invoices
      if (inv.status !== 'Pending') {
        console.log('⏭️ Skipped (not pending)');
        continue;
      }

      // ✅ Resolve due date properly
      let dueDate: Date;

      if (inv.dueDate) {
        dueDate = new Date(inv.dueDate);
      } else if (inv.invoiceDate && inv.creditDays) {
        dueDate = new Date(inv.invoiceDate);
        dueDate.setDate(dueDate.getDate() + Number(inv.creditDays));
      } else {
        console.log('⚠️ Skipped (no due date info)');
        continue;
      }

      dueDate.setHours(0, 0, 0, 0);

      const overdueDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      console.log('📆 Due Date:', dueDate.toISOString().slice(0, 10));
      console.log('⏱️ Overdue Days:', overdueDays);

      // ❌ REMOVE this condition (THIS WAS THE BUG)
      // if (overdueDays < 0) continue;

      if (existingPaymentRefs.has(inv.invoiceNo || inv.invoiceNumber)) {
        console.log('⏭️ Skipped (already has reminder)');
        continue;
      }

      const reminder = {
        date: dueDate.toISOString().slice(0, 10), // Used only for display
        time: '10:00',
        type: 'payment',
        name: inv.billTo?.name || inv.customerName || '',
        mobile: '',
        referenceNo: inv.invoiceNo || inv.invoiceNumber,
        invoiceNo: inv.invoiceNo || inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: dueDate.toISOString().slice(0, 10),
        creditDays: inv.creditDays ?? '',
        amount: inv.grandTotal ?? inv.amount ?? 0,
        overdueDays: Math.max(0, overdueDays), // 👈 KEY
        note: `Payment follow-up for invoice ${inv.invoiceNo}`,
        source: 'system',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      console.log('✅ Creating payment reminder:', reminder);
      await this.db.addReminder(reminder);
    }

    console.log('✅ Payment reminder sync complete');
  }

  // Add to reminders.component.ts

  async debugReminders() {
    const all = await this.db.getAllReminders();

    console.log('═══════════════════════════════════════');
    console.log('🔍 REMINDERS DEBUG');
    console.log('═══════════════════════════════════════');
    console.log('Selected Date:', this.selectedDate);
    console.log('Total reminders in DB:', all.length);

    console.log('\n📋 All reminders:');
    all.forEach((r, i) => {
      console.log(`\n${i + 1}.`, {
        type: r.type,
        date: r.date,
        name: r.name,
        refNo: r.referenceNo,
        status: r.status,
        matchesDate: r.date === this.selectedDate
      });
    });

    console.log('\n✅ Filtered (will show):', this.filteredReminders.length);
    console.log(this.filteredReminders);

    console.log('\n💰 Payment reminders:', this.dueInvoices.length);
    console.log('═══════════════════════════════════════');
  }
}
