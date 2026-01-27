import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { InvoicesModule } from './pages/invoices/invoices.module';
import { bootstrapApplication } from '@angular/platform-browser';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CustomersComponent } from './pages/customers/customers.component';
import { VendorComponent } from './pages/vendor/vendor.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { InvoicesComponent } from './pages/invoices/invoices.component';
import { PaymentsComponent } from './pages/payments/payments.component';
import { RemindersComponent } from './pages/reminders/reminders.component';
import { SettingsComponent } from './pages/settings/settings.component';

@NgModule({
  declarations: [], 
  imports: [
    BrowserModule,
    FormsModule,
    AppComponent,
    DashboardComponent,
    CustomersComponent,
    VendorComponent,
    OrdersComponent,
    InvoicesComponent,
    InvoicesModule,
    PaymentsComponent,
    RemindersComponent,
    SettingsComponent
  ],
  providers: [],
  bootstrap: []
})
export class AppModule {}
