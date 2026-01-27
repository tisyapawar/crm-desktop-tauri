import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InquiryMasterComponent } from './inquiry-master.component';

describe('InquiryMasterComponent', () => {
  let component: InquiryMasterComponent;
  let fixture: ComponentFixture<InquiryMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InquiryMasterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InquiryMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
