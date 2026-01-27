
import { LayoutComponent } from './layout/layout.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { Routes } from '@angular/router';
import { SalesOrderComponent } from './pages/sales-order/sales-order.component';
import { PurchaseOrderComponent } from './pages/purchase-order/purchase-order.component';


export const routes: Routes = [
  
  
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'sales-order',
        component: SalesOrderComponent
      },
      {
        path: 'purchase-order',
        component: PurchaseOrderComponent
      },

      {
        path: 'customers',
        loadComponent: () =>
          import('./pages/customers/customers.component').then(m => m.CustomersComponent)
      },

      {
        path: 'items',
        loadComponent: () => import('./pages/inquiry-master/inquiry-master.component').then(m => m.InquiryMasterComponent)
      },

      {
        path: 'orders',
        loadComponent: () =>
          import('./pages/orders/orders.component').then(m => m.OrdersComponent)
      },

      { 
        path: 'inventory', component: InventoryComponent 
      },

      {
        path: 'invoices',
        loadComponent: () => import('./pages/invoices/invoices.component').then(m => m.InvoicesComponent)
      },

      {
        path: 'payments',
        loadComponent: () => import('./pages/payments/payments.component').then(m => m.PaymentsComponent)
      },

      {
        path: 'reminders',
        loadComponent: () => import('./pages/reminders/reminders.component').then(m => m.RemindersComponent)
      },

      {
        path: 'vendor',
        loadComponent: () => import('./pages/vendor/vendor.component').then(m => m.VendorComponent)
      },

      /* -----------------------------------
       *   NEW OFFER ROUTES (ADD THESE)
       * ----------------------------------*/
      {
        path: 'offers',
        loadComponent: () => import('./pages/offers/offers.component').then(m => m.OffersComponent)
      },

      {
        path: 'create-offer',
        loadComponent: () => import('./pages/offers/create-offer.component').then(m => m.CreateOfferComponent)
      },

      {
        path: 'proforma-invoice',
        loadComponent: () => import('./pages/proforma-invoice/proforma-invoice.component').then(m => m.ProformaInvoiceComponent)
      }
    ]
  }
];
