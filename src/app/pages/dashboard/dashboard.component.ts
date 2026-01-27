import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  dashboardCards = [
    {
      title: 'Customers',
      description: 'Manage all customers data',
      image: 'assets/dashboard/customers.jpg',
      route: '/customers'
    },
    {
      title: 'Vendors',
      description: 'Manage all vendors data',
      image: 'assets/dashboard/vendor.jpeg',
      route: '/vendor'
    },
    {
      title: 'Inquiry',
      description: 'Manage all inquiries',
      route: '/items',
      image: 'assets/dashboard/item-master.jpg' 
    },
        {
      title: 'Offers',  
      description: 'View and manage offers',
      image: 'assets/dashboard/Offers.jpeg', 
      route: '/offers'
    },
    {
      title: 'Orders',
      description: 'Track and process orders',
      image: 'assets/dashboard/orders.jpg',
      route: '/orders'
    },
    {
      title: 'Inventory',
      description: 'Manage your inventory',
      image: 'assets/dashboard/inventory.jpg', 
      route: '/inventory'
    },
    {
      title: 'Invoices',
      description: 'View and generate invoices',
      image: 'assets/dashboard/invoices.jpg',
      route: '/invoices'
    },
    // {
    //   title: 'Proforma Invoice',
    //   description: 'Proforma Invoice generation',
    //   image: 'assets/dashboard/proforma.jpg',
    //   route: '/proforma-invoice'
    // },
    {
      title: 'Payments',
      description: 'Manage payments and receipts',
      image: 'assets/dashboard/payments.jpg',
      route: '/payments'
    },
    {
      title: 'Reminders',
      description: 'Send client reminders',
      image: 'assets/dashboard/reminders.jpg',
      route: '/reminders'
    }
  ];
}
