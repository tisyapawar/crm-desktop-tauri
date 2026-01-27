import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tax-invoice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tax-invoice.component.html',
  styleUrls: ['./tax-invoice.component.css']
})
export class TaxInvoiceComponent {
  @Input() invoice: any;

  // ✅ Remove ngAfterViewInit and downloadPDF completely
  // The parent component handles PDF generation

  numberToWordsIndian(amount: number): string {
    if (!amount || amount === 0) return 'Zero Only';

    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
      'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
      'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];

    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
      'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const num = Math.floor(amount);

    if (num < 20) return a[num] + ' Only';
    if (num < 100)
      return b[Math.floor(num / 10)] + ' ' + a[num % 10] + ' Only';
    if (num < 1000)
      return a[Math.floor(num / 100)] + ' Hundred ' +
        (num % 100 !== 0 ? this.numberToWordsIndian(num % 100) : 'Only');
    if (num < 100000)
      return this.numberToWordsIndian(Math.floor(num / 1000)) +
        ' Thousand ' +
        (num % 1000 !== 0 ? this.numberToWordsIndian(num % 1000) : 'Only');
    if (num < 10000000)
      return this.numberToWordsIndian(Math.floor(num / 100000)) +
        ' Lakh ' +
        (num % 100000 !== 0 ? this.numberToWordsIndian(num % 100000) : 'Only');

    return this.numberToWordsIndian(Math.floor(num / 10000000)) +
      ' Crore ' +
      (num % 10000000 !== 0 ? this.numberToWordsIndian(num % 10000000) : 'Only');
  }
}