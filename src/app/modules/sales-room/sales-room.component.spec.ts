import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesRoomComponent } from './sales-room.component';

describe('SalesRoomComponent', () => {
  let component: SalesRoomComponent;
  let fixture: ComponentFixture<SalesRoomComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SalesRoomComponent]
    });
    fixture = TestBed.createComponent(SalesRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
