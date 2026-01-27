import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // ✅ This is required

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule], // ✅ Add RouterModule here
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {}
