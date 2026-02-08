import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DBService } from '../../service/db.service';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-proforma-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proforma-invoice.component.html',
  styleUrls: ['./proforma-invoice.component.css']
})
export class ProformaInvoiceComponent implements OnInit {

  customers: any[] = [];
  inquiries: any[] = [];
  proformas: any[] = [];
  isPrintMode = false;
  showInquiryPopup = false;
  buyerInquiries: any[] = [];
  selectedBuyerId: number | null = null;
  inventory: any[] = [];
  companies: string[] = [];
  selectedCompany = '';
  filteredInquiries: any[] = [];
  isEditing = false;
  editingId: number | null = null;


  bankOptions = [
    {
      key: 'HDFC',
      name: 'Navbharat Insulation & Engg. Co.',
      bank: 'HDFC Bank Ltd',
      branch: 'Bandra West, Mumbai - 400050',
      ifsc: 'HDFC0001316',
      account: '50200028502545'
    },
    {
      key: 'UNION',
      name: 'Navbharat Insulation & Engg. Co.',
      bank: 'Union Bank of India',
      branch: 'Khar West Mumbai',
      ifsc: 'UBIN0531766',
      account: '366001010024087'
    }
  ];

  form: any = {
    buyerId: '',
    buyerName: '',
    buyerAddress: '',
    buyerGST: '',
    buyerPAN: '',
    inquiryId: '',
    items: [],
    paymentTerms: '',
    selectedBankKey: 'HDFC',
    bankDetails: {}
  };
  loading: boolean | undefined;

  constructor(private db: DBService) { }

  async ngOnInit() {
    console.log('🟢 Proforma init started');

    this.customers = await this.db.getAll('customers');
    console.log('📦 Customers loaded:', this.customers);

    this.inquiries = await this.db.getAll('inquiries');
    console.log('📦 Inquiries loaded:', this.inquiries);

    this.proformas = await this.db.getAll('proformas');
    console.log('📦 Proformas loaded:', this.proformas);

    this.inventory = await this.db.getAll('inventory');
    console.log('📦 Inventory loaded:', this.inventory);

    this.onBankChange();

    this.companies = [
      ...new Set(
        this.inquiries
          .map(i => i.companyName)
          .filter(Boolean)
      )
    ];
  }

  onBankChange() {
    console.log('🏦 Bank changed:', this.form.selectedBankKey);
    const bank = this.bankOptions.find(
      b => b.key === this.form.selectedBankKey
    );
    console.log('🏦 Matched bank:', bank);
    if (bank) this.form.bankDetails = { ...bank };
  }

  // onCustomerSelect() {
  //   console.log('👤 Customer dropdown changed');
  //   console.log('➡ buyerId from form:', this.form.buyerId, typeof this.form.buyerId);

  //   console.log('📦 Available customers:', this.customers);

  //   const customer = this.customers.find(
  //     c => String(c.id) === String(this.form.buyerId)
  //   );

  //   console.log('🎯 Matched customer:', customer);

  //   if (!customer) {
  //     console.warn('❌ No customer matched for buyerId');
  //     return;
  //   }

  //   this.form.buyerName = customer.name || '';
  //   this.form.buyerGST = customer.gstin || '';
  //   this.form.buyerPAN = customer.pan || '';

  //   this.form.buyerAddress =
  //     `${customer.billing?.street || ''}, ` +
  //     `${customer.billing?.area || ''}, ` +
  //     `${customer.billing?.city || ''}, ` +
  //     `${customer.billing?.state || ''}, ` +
  //     `${customer.billing?.country || ''}`;

  //   console.log('✅ Buyer fields set:', {
  //     name: this.form.buyerName,
  //     gst: this.form.buyerGST,
  //     pan: this.form.buyerPAN,
  //     address: this.form.buyerAddress
  //   });
  // }

  onCustomerSelect() {
    const buyerId = this.form.buyerId;
    if (!buyerId) return;

    // 1️⃣ Set buyer details
    const customer = this.customers.find(
      c => String(c.id) === String(buyerId)
    );

    if (customer) {
      this.form.buyerName = customer.name || '';
      this.form.buyerGST = customer.gstin || '';
      this.form.buyerPAN = customer.pan || '';
      this.form.buyerAddress =
        `${customer.billing?.street || ''}, ` +
        `${customer.billing?.area || ''}, ` +
        `${customer.billing?.city || ''}, ` +
        `${customer.billing?.state || ''}, ` +
        `${customer.billing?.country || ''}`;
    }

    // 2️⃣ Filter inquiries from IndexedDB-loaded data
    // this.buyerInquiries = this.inquiries.filter((inq: any) =>
    //   String(inq.customerId) === String(buyerId)
    // );

    this.buyerInquiries = this.inquiries.filter((inq: any) =>
      inq.customerName?.trim().toLowerCase() ===
      this.form.buyerName.trim().toLowerCase()
      &&
      inq.companyName?.trim().toLowerCase() ===
      (this.customers.find(c => String(c.id) === String(buyerId))?.companyName || '')
        .trim()
        .toLowerCase()
    );


    // 3️⃣ Open popup if inquiries exist
    if (this.buyerInquiries.length) {
      this.showInquiryPopup = true;
    }
  }

  // onCompanySelect() {
  //   if (!this.selectedCompany) return;

  //   this.filteredInquiries = this.inquiries.filter(inq =>
  //     inq.companyName?.trim().toLowerCase() ===
  //     this.selectedCompany.trim().toLowerCase()
  //   );

  //   console.log('Selected company:', this.selectedCompany);
  //   console.log(
  //     'Inquiry companies:',
  //     this.inquiries.map(i => i.companyName)
  //   );
  //   console.log('Filtered inquiries:', this.filteredInquiries);

  //   this.showInquiryPopup = true;
  // }

  onCompanySelect() {
    if (!this.selectedCompany) return;

    // 🔹 Find customer by company name
    const customer = this.customers.find(c =>
      c.companyName?.trim().toLowerCase() ===
      this.selectedCompany.trim().toLowerCase()
    );

    if (customer) {
      this.form.buyerName = customer.companyName; // 👈 COMPANY NAME on invoice
      this.form.buyerGST = customer.gstin || '';
      this.form.buyerPAN = customer.pan || '';

      this.form.buyerAddress =
        `${customer.billing?.street || ''}, ` +
        `${customer.billing?.area || ''}, ` +
        `${customer.billing?.city || ''}, ` +
        `${customer.billing?.state || ''}, ` +
        `${customer.billing?.country || ''}`;
    }

    // 🔹 Filter inquiries by company
    this.filteredInquiries = this.inquiries.filter(inq =>
      inq.companyName?.trim().toLowerCase() ===
      this.selectedCompany.trim().toLowerCase()
    );

    console.log('Selected company:', this.selectedCompany);
    console.log('Filtered inquiries:', this.filteredInquiries);

    this.showInquiryPopup = true;
  }

  loadFromInquiry(inq: any) {
    if (!inq || !inq.items?.length) return;

    this.form.items = inq.items.map((it: any) => {

      // 🔑 Match by DISPLAY NAME (same text as inquiry)
      const inv = this.inventory.find(
        p => p.displayName?.trim() === it.productName?.trim()
      );

      return {
        // SAME name as inquiry
        description: it.productName || '',

        // From inventory
        hsn: inv?.hsn || '',
        rate: inv?.price || 0,   // ✅ FIXED

        // From inquiry
        qty: it.qty || 0,
        uom: it.uom || ''
      };
    });

    this.calculateTotals();
  }


  selectInquiry(inq: any) {
    this.loadFromInquiry(inq);
    this.showInquiryPopup = false;
  }

  getDisplayInquiryId(id?: number): string {
    if (!id) return '-';
    return `INQ-${String(id).padStart(4, '0')}`;
  }


  addItem() {
    console.log('➕ Add item clicked');
    this.form.items.push({});
  }

  calculateTotals() {
    let sub = 0;
    this.form.items.forEach((i: any) => {
      sub += (+i.qty || 0) * (+i.rate || 0);
    });
    this.form.subTotal = sub;
    this.form.cgst = sub * 0.09;
    this.form.sgst = sub * 0.09;
    this.form.igst = sub * 0.18;
    this.form.total = sub + this.form.cgst + this.form.sgst;
    this.form.totalReceivable = this.form.total - (+this.form.advance || 0);

    console.log('🧮 Totals recalculated:', {
      subTotal: this.form.subTotal,
      total: this.form.total
    });
  }

  // async save() {
  //   // 🔥 IMPORTANT: Calculate totals before saving
  //   this.calculateTotals();

  //   // 🔥 IMPORTANT: Ensure all fields are present
  //   const proformaToSave = {
  //     ...this.form,
  //     // Ensure these fields exist
  //     items: this.form.items || [],
  //     buyerName: this.form.buyerName || '',
  //     buyerAddress: this.form.buyerAddress || '',
  //     buyerGST: this.form.buyerGST || '',
  //     buyerPAN: this.form.buyerPAN || '',
  //     proformaNumber: this.form.proformaNumber || this.generatePFNo(),
  //     date: this.form.date || new Date().toISOString().slice(0, 10),
  //     // Include calculated totals
  //     subTotal: this.form.subTotal || 0,
  //     cgst: this.form.cgst || 0,
  //     sgst: this.form.sgst || 0,
  //     igst: this.form.igst || 0,
  //     total: this.form.total || 0,
  //     totalReceivable: this.form.totalReceivable || 0,
  //     otherCharges: this.form.otherCharges || 0,
  //     advance: this.form.advance || 0,
  //     roundOff: this.form.roundOff || 0,
  //     // Bank details
  //     selectedBankKey: this.form.selectedBankKey || 'HDFC',
  //     bankDetails: this.form.bankDetails || {},
  //     // Other fields
  //     paymentTerms: this.form.paymentTerms || '',
  //     preparedBy: this.form.preparedBy || ''
  //   };

  //   console.log('💾 Saving proforma:', proformaToSave);

  //   // Save to DB
  //   await this.db.add('proformas', proformaToSave);

  //   // 🔥 IMPORTANT: update UI list immediately
  //   this.proformas = await this.db.getAll('proformas');

  //   console.log('📋 Proformas list updated:', this.proformas);

  //   // Reset form
  //   this.form = {
  //     buyerId: '',
  //     buyerName: '',
  //     buyerAddress: '',
  //     buyerGST: '',
  //     buyerPAN: '',
  //     inquiryId: '',
  //     items: [],
  //     paymentTerms: '',
  //     selectedBankKey: 'HDFC',
  //     bankDetails: {}
  //   };

  //   this.onBankChange();

  //   alert('Proforma saved successfully!');
  // }

  async save() {
    this.calculateTotals();

    const proformaToSave: any = {
      ...this.form,
      items: this.form.items || [],
      buyerName: this.form.buyerName || '',
      buyerAddress: this.form.buyerAddress || '',
      buyerGST: this.form.buyerGST || '',
      buyerPAN: this.form.buyerPAN || '',
      proformaNumber: this.form.proformaNumber || this.generatePFNo(),
      date: this.form.date || new Date().toISOString().slice(0, 10),

      subTotal: this.form.subTotal || 0,
      cgst: this.form.cgst || 0,
      sgst: this.form.sgst || 0,
      igst: this.form.igst || 0,
      total: this.form.total || 0,
      totalReceivable: this.form.totalReceivable || 0,
      otherCharges: this.form.otherCharges || 0,
      advance: this.form.advance || 0,
      roundOff: this.form.roundOff || 0,

      selectedBankKey: this.form.selectedBankKey || 'HDFC',
      bankDetails: this.form.bankDetails || {},

      paymentTerms: this.form.paymentTerms || '',
      preparedBy: this.form.preparedBy || ''
    };

    if (this.isEditing && this.editingId != null) {
      proformaToSave.id = this.editingId;
      await this.db.put('proformas', proformaToSave);
    } else {
      await this.db.add('proformas', proformaToSave);
    }

    this.proformas = await this.db.getAll('proformas');

    // Reset state
    this.isEditing = false;
    this.editingId = null;

    this.form = {
      buyerId: '',
      buyerName: '',
      buyerAddress: '',
      buyerGST: '',
      buyerPAN: '',
      inquiryId: '',
      items: [],
      paymentTerms: '',
      selectedBankKey: 'HDFC',
      bankDetails: {}
    };

    this.onBankChange();

    alert('Proforma saved successfully!');
  }

  async downloadPDF(p?: any) {
    console.log('📄 downloadPDF called with:', p);

    // 1️⃣ Load proforma into form
    if (p) {
      this.form = { ...p };
      console.log('📋 Form after loading proforma:', this.form);
      console.log('📦 Items in form:', this.form.items);
    }

    // 2️⃣ RE-HYDRATE CUSTOMER DATA
    if (this.form.buyerId) {
      const customer = this.customers.find(
        c => String(c.id) === String(this.form.buyerId)
      );

      if (customer) {
        this.form.buyerName = customer.name || '';
        this.form.buyerGST = customer.gstin || '';
        this.form.buyerPAN = customer.pan || '';
        this.form.buyerAddress =
          `${customer.billing?.street || ''}, ` +
          `${customer.billing?.area || ''}, ` +
          `${customer.billing?.city || ''}, ` +
          `${customer.billing?.state || ''}, ` +
          `${customer.billing?.country || ''}`;
      }
    }

    // 3️⃣ ITEMS ARE ALREADY IN THE PROFORMA
    if (!this.form.items || !this.form.items.length) {
      console.warn('⚠️ No items found in proforma!');
      this.form.items = [];
    }

    // 4️⃣ RE-HYDRATE BANK DETAILS
    this.onBankChange();

    // 5️⃣ Recalculate totals (in case they're missing)
    this.calculateTotals();

    // 6️⃣ Switch to print mode
    this.isPrintMode = true;

    console.log('🖨️ Switched to print mode, form state:', this.form);

    // 7️⃣ Let DOM settle
    setTimeout(() => {
      this.generatePDF();
      this.isPrintMode = true;
    }, 1000);
  }

  // edit(p: any) {
  //   console.log('✏️ Edit clicked for proforma:', p);
  //   this.form = { ...p };
  //   this.onBankChange();
  // }

  edit(p: any) {
    this.isEditing = true;
    this.editingId = p.id;

    // Deep clone to avoid live table mutation
    this.form = JSON.parse(JSON.stringify(p));

    // Restore selected company dropdown
    this.selectedCompany = this.form.buyerName;

    this.calculateTotals();
  }


  async deleteProforma(p: any) {
    console.log('🗑️ Delete clicked for proforma:', p);

    // Delete from DB
    await this.db.delete('proformas', p.id);

    // 🔥 IMPORTANT: update UI list immediately
    this.proformas = this.proformas.filter(x => x.id !== p.id);

    console.log('📋 Proformas list after delete:', this.proformas);
  }

  generatePFNo() {
    const year = new Date().getFullYear();
    const seq = Math.floor((Date.now() % 100000) / 10).toString().padStart(4, '0');
    return `PF/${year}/${seq}`;
  }

  async convertToInvoice(p: any) {
    const invoice = {
      invoiceNumber: `INV/${new Date().getFullYear()}/${Math.floor(Date.now() % 100000)}`,
      date: new Date().toISOString().slice(0, 10),
      customerName: p.buyerName,
      items: p.items.map((it: any) => ({ name: it.description, qty: it.qty, rate: it.rate })),
      subtotal: p.subTotal,
      totalAmount: p.total,
      status: 'Pending'
    };
    if (this.db.addInvoice) await this.db.addInvoice(invoice);
    alert('Converted to Invoice (if backend exists)');
  }

  async generatePDF() {
    this.calculateTotals();
    this.loading = true;
    this.isPrintMode = true;

    try {
      // 🔥 Ensure inputs lose focus
      (document.activeElement as HTMLElement)?.blur();

      // 🔥 Allow DOM to paint with borders
      await new Promise(r => setTimeout(r, 200));

      const DATA = document.querySelector('#invoice-area') as HTMLElement;
      if (!DATA) {
        alert('Invoice area not found');
        return;
      }

      const canvas = await html2canvas(DATA, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: DATA.scrollWidth + 10,
        windowHeight: DATA.scrollHeight + 10,
        // x: -2,
        // y: -2,
        scrollX: 0,
        scrollY: 0,
        removeContainer: true,
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('#invoice-area') as HTMLElement;
          if (clonedElement) {
            // Ensure borders are visible in the clone
            clonedElement.style.border = '2px solid #000';
            clonedElement.style.boxSizing = 'border-box';
            // clonedElement.style.padding = '5px';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidthMM = 210;   // ⬅️ CORRECTED: Standard A4 width
      const pageHeightMM = 297;  // ⬅️ CORRECTED: Standard A4 height

      // Add margins so content doesn't touch edges
      const marginMM = 5;        // ⬅️ ADDED: 5mm margin on all sides
      const availableWidth = pageWidthMM - (2 * marginMM);
      const availableHeight = pageHeightMM - (2 * marginMM);

      let imgWidthMM = availableWidth;
      let imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;

      if (imgHeightMM > availableHeight) {
        const scale = availableHeight / imgHeightMM;
        imgWidthMM *= scale;
        imgHeightMM *= scale;
      }

      const x = (pageWidthMM - imgWidthMM) / 2;  // Center horizontally
      const y = marginMM;                         // Start with top margin

      pdf.addImage(imgData, 'PNG', x, y, imgWidthMM, imgHeightMM);

      pdf.save(`${this.form.proformaNumber || 'Proforma'}.pdf`);
    } catch (err) {
      console.error('PDF Error', err);
      alert('PDF Error. See console.');
    } finally {
      this.loading = false;
      this.isPrintMode = false;
    }
  }

  // Amount in words helper
  amountInWords(num: any) {
    if (!num) return 'Zero Rupees Only';
    num = Math.floor(Number(num));
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function inWords(n: number): string {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
    }
    return inWords(num) + ' Rupees Only';
  }
}
