import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { DBService } from '../../service/db.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {

  items: any[] = [];
  searchTerm = '';

  showModal = false;
  isEditing = false;

  form: any = {};

  groupPrefixMap: any = {
    'Material Distribution Division': 'MDD',
    'Projects': 'PROJ'
  };

  activeMenuId: any = null;
  menuPosition: { top: string; left: string } = { top: '0px', left: '0px' };

  constructor(private dbService: DBService) { }

  toggleActionMenu(event: Event, item: any) {
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Calculate position for fixed positioning (works better in Electron)
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    // Position menu below the button
    this.menuPosition = {
      top: `${rect.bottom + scrollY + 8}px`,
      left: `${rect.right + scrollX - 160}px`
    };

    // Use the item's unique key (name field) instead of index
    this.activeMenuId = this.activeMenuId === item.name ? null : item.name;
  }

  closeActionMenu() {
    this.activeMenuId = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    this.activeMenuId = null;
  }

  ngOnInit() {
    this.loadFromIndexedDB();
  }

  /* ===============================
     Product ID Generator
  =============================== */
  async generateNextProductIdByGroup(group: string): Promise<string> {
    const prefix = this.groupPrefixMap[group] || 'GEN';

    const allProducts = await this.dbService.getAll('inventory');
    const groupProducts = allProducts.filter((p: any) => p.group === group);

    let maxCounter = 0;
    groupProducts.forEach((p: any) => {
      if (p.productId) {
        const match = p.productId.match(/INV-.*?-(\d+)/);
        if (match) {
          const counter = parseInt(match[1], 10);
          if (counter > maxCounter) maxCounter = counter;
        }
      }
    });

    const next = maxCounter + 1;
    return `INV-${prefix}-${next.toString().padStart(4, '0')}`;
  }

  /* ===============================
     Calculations
  =============================== */
  calculateTotalValue(item: any): number {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.price) || 0;
    const gst = Number(item.gst) || 0;

    const subtotal = qty * rate;
    const gstAmount = (subtotal * gst) / 100;
    const total = subtotal + gstAmount;

    return total;
  }

  calculateFormTotalValue(): string {
    const qty = Number(this.form.quantity) || 0;
    const rate = Number(this.form.price) || 0;
    const gst = Number(this.form.gst) || 0;

    const subtotal = qty * rate;
    const gstAmount = (subtotal * gst) / 100;
    const total = subtotal + gstAmount;

    return `₹${total.toFixed(2)}`;
  }

  /* ===============================
     UI Actions
  =============================== */
  openAddModal() {
    this.isEditing = false;
    this.showModal = true;
    this.form = {
      quantity: 0,
      price: 0,
      gst: 0,
      numberOfUnits: 0,
      location: '',
      group: '',
      displayName: '',
      size: '',
      hsn: '',
      unit: ''
    };
  }

  openEditModal(item: any) {
    this.form = { ...item };
    this.isEditing = true;
    this.showModal = true;
    this.closeActionMenu();
  }

  async submitForm() {
    // Validation
    if (!this.form.location || !this.form.group || !this.form.displayName || !this.form.size || !this.form.unit) {
      alert('Please fill all required fields: Location, Group, Item/Material, Size, and UOM');
      return;
    }

    if (!this.form.quantity || !this.form.price || this.form.gst === '' || this.form.gst === null) {
      alert('Please fill all required pricing fields: Quantity, Rate, and GST');
      return;
    }

    this.form.specifications = [
      this.form.thickness ? `Thickness: ${this.form.thickness}` : null,
      this.form.density ? `Density: ${this.form.density}` : null,
      this.form.size ? `Size: ${this.form.size}` : null
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      const allProducts = await this.dbService.getAll('inventory');

      // When editing, use displayName if it exists for comparison
      const formName = this.form.displayName || this.form.name;

      const existingProduct = allProducts.find((p: any) =>
        p.location?.toLowerCase() === this.form.location?.toLowerCase() &&
        p.group?.toLowerCase() === this.form.group?.toLowerCase() &&
        (p.displayName || p.name)?.toLowerCase() === formName?.toLowerCase() &&
        p.size?.toLowerCase() === this.form.size?.toLowerCase()
      );

      if (existingProduct && !this.isEditing) {
        console.log('Found existing product:', existingProduct);

        const updatedQty = Number(existingProduct.quantity ?? 0) + Number(this.form.quantity ?? 0);

        await this.dbService.put('inventory', {
          ...existingProduct,
          quantity: updatedQty,
          numberOfUnits: Number(existingProduct.numberOfUnits ?? 0) + Number(this.form.numberOfUnits ?? 0)
        });

        alert(`Updated stock for "${existingProduct.displayName || existingProduct.name} (${existingProduct.size})". New quantity: ${updatedQty}`);
      } else {
        if (!this.form.productId) {
          this.form.productId = await this.generateNextProductIdByGroup(this.form.group);
        }

        // When editing, preserve the existing composite key
        // When creating new, generate new composite key
        const itemKey = this.isEditing && this.form.name.includes('_')
          ? this.form.name // Keep existing composite key when editing
          : `${this.form.location}_${this.form.group}_${formName}_${this.form.size}`.toLowerCase();

        await this.dbService.put('inventory', {
          ...this.form,
          name: itemKey,
          displayName: formName,
          quantity: Number(this.form.quantity ?? 0),
          price: Number(this.form.price ?? 0),
          gst: Number(this.form.gst ?? 0),
          numberOfUnits: Number(this.form.numberOfUnits ?? 0),
          weight: Number(this.form.weight ?? 0)
        });

        console.log(this.isEditing ? 'Updated product:' : 'Created new product:', formName);
      }

      await this.loadFromIndexedDB();
      this.showModal = false;
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert('Failed to save inventory item. Please try again.');
    }
  }

  /* ===============================
     Data Load / Delete
  =============================== */
  async loadFromIndexedDB() {
    try {
      this.items = await this.dbService.getAll('inventory');
      console.log('✅ Loaded inventory items:', this.items.length);
    } catch (error) {
      console.error('❌ Error loading inventory:', error);
      this.items = [];
    }
  }

  async deleteItem(item: any) {
    const displayName = item.displayName || item.name;
    if (confirm(`Are you sure you want to delete "${displayName}" (${item.size})?`)) {
      try {
        await this.dbService.delete('inventory', item.name);
        await this.loadFromIndexedDB();
        console.log('✅ Deleted item:', displayName);
        this.closeActionMenu();
      } catch (error) {
        console.error('❌ Error deleting item:', error);
        alert('Failed to delete item. Please try again.');
      }
    }
  }

  filteredItems() {
    const t = this.searchTerm.toLowerCase();
    return this.items.filter((i: any) => {
      const displayName = i.displayName || i.name;
      return (
        (displayName || '').toLowerCase().includes(t) ||
        (i.productId || '').toLowerCase().includes(t) ||
        (i.location || '').toLowerCase().includes(t) ||
        (i.group || '').toLowerCase().includes(t)
      );
    });
  }

  /* ===============================
     Excel
  =============================== */
  triggerFileUpload() {
    (document.getElementById('excelUpload') as HTMLInputElement).click();
  }

  async handleExcelUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev!.target!.result, { type: 'array' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        const existingProducts = await this.dbService.getAll('inventory');

        let updatedCount = 0;
        let newCount = 0;

        for (const row of rows) {
          const rowLocation = row['Location'] || row['location'] || '';
          const rowGroup = row['Group'] || row['group'] || 'Material Distribution Division';
          const rowName = row['Item / Material'] || row['Name'] || row['name'] || '';
          const rowSize = row['Size'] || row['size'] || '';
          const rowQty = Number(row['Qty'] || row['Quantity'] || row['quantity'] || 0);

          const existingProduct = existingProducts.find((p: any) =>
            p.location?.toLowerCase() === rowLocation.toLowerCase() &&
            p.group?.toLowerCase() === rowGroup.toLowerCase() &&
            (p.displayName || p.name)?.toLowerCase() === rowName.toLowerCase() &&
            p.size?.toLowerCase() === rowSize.toLowerCase()
          );

          if (existingProduct) {
            const updatedQty = Number(existingProduct.quantity ?? 0) + rowQty;
            const rowNumberOfUnits = Number(row['No. of rolls/Bundles/pcs'] || row['numberOfUnits'] || 0);

            await this.dbService.put('inventory', {
              ...existingProduct,
              quantity: updatedQty,
              numberOfUnits: Number(existingProduct.numberOfUnits ?? 0) + rowNumberOfUnits
            });
            updatedCount++;
            console.log(`Updated: ${existingProduct.displayName || existingProduct.name} - New qty: ${updatedQty}`);
          } else {
            const productId = row['Product ID'] || row['productId'] || await this.generateNextProductIdByGroup(rowGroup);
            const itemKey = `${rowLocation}_${rowGroup}_${rowName}_${rowSize}`.toLowerCase();

            const newProduct = {
              name: itemKey,
              displayName: rowName,
              productId: productId,
              location: rowLocation,
              group: rowGroup,
              size: rowSize,
              hsn: row['HSN'] || row['hsn'] || '',
              unit: row['UOM'] || row['unit'] || '',
              numberOfUnits: Number(row['No. of rolls/Bundles/pcs'] || row['numberOfUnits'] || 0),
              quantity: rowQty,
              price: Number(row['Rate'] || row['price'] || 0),
              gst: Number(row['GST'] || row['GST %'] || row['gst'] || 0),
              category: row['Category'] || row['category'] || '',
              vendorName: row['Vendor Name'] || row['vendorName'] || '',
              productMake: row['Product Make'] || row['productMake'] || '',
              specifications: row['Specifications'] || row['specifications'] || '',
              weight: Number(row['Weight'] || row['weight'] || 0),
              attachment: null
            };

            await this.dbService.put('inventory', newProduct);
            newCount++;
            console.log(`Created: ${newProduct.displayName}`);
          }
        }

        await this.loadFromIndexedDB();
        alert(`Excel imported successfully!\n\nNew products: ${newCount}\nUpdated products: ${updatedCount}`);
      } catch (error) {
        console.error('❌ Error importing Excel:', error);
        alert('Failed to import Excel file. Please check the format and try again.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  downloadInventoryAsExcel() {
    const exportData = this.items.map((item: any) => {
      const displayName = item.displayName || item.name;
      return {
        'Location': item.location,
        'Group': item.group,
        'Item / Material': displayName,
        'Size': item.size,
        'HSN': item.hsn,
        'UOM': item.unit,
        'No. of rolls/Bundles/pcs': item.numberOfUnits,
        'Qty': item.quantity,
        'Rate': item.price,
        'GST %': item.gst,
        'Total Value': this.calculateTotalValue(item),
        'Category': item.category,
        'Vendor Name': item.vendorName,
        'Product Make': item.productMake,
        'Specifications': item.specifications,
        'Weight': item.weight
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'Inventory.xlsx');
  }

  /* ===============================
     Attachments
  =============================== */
  uploadAttachment(e: any) {
    const file = e.target.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = () => {
        this.form.attachment = r.result;
        this.form.attachmentName = file.name;
        this.form.attachmentType = file.type;
      };
      r.readAsDataURL(file);
    }
  }

  viewAttachment(it: any) {
    if (!it.attachment) {
      alert('No attachment available');
      return;
    }

    const fileName = it.attachmentName || 'attachment';
    const fileType = it.attachmentType || 'application/octet-stream';

    const link = document.createElement('a');
    link.href = it.attachment;
    link.download = fileName;

    if (fileType.startsWith('image/') || fileType === 'application/pdf') {
      const action = confirm(
        `File: ${fileName}\n\n` +
        `Click OK to download or Cancel to view in new tab`
      );

      if (action) {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(it.attachment, '_blank');
      }
    } else {
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    this.closeActionMenu();
  }

  cancelModal() {
    this.showModal = false;
    this.form = {};
  }
}