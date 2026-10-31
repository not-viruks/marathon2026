import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { Order } from '@app/models/orders/order.model';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { GuestInviteService } from '@app/services/reservation/guest-invite.service';
import { ToastService } from '@app/services/toast/toast.service';

import { NotSubmittedOrderComponent } from './not-submitted-order.component';

describe('NotSubmittedOrderComponent', () => {
  let component: NotSubmittedOrderComponent;
  let fixture: ComponentFixture<NotSubmittedOrderComponent>;

  let groupOrdersServiceMock: jasmine.SpyObj<GroupOrdersService>;
  let guestInviteServiceMock: jasmine.SpyObj<GuestInviteService>;
  let toastServiceMock: jasmine.SpyObj<ToastService>;

  const order = {
    orderId: 'order-1',
    status: 0,
    reservationId: 'res-1',
    reservationAddress: 'Test address',
    reservationTime: '2026-09-07T12:15:00Z',
    orderItems: [
      {
        quantity: 2,
        dish: {
          id: 'dish-1',
          name: 'Dish 1',
          price: 10,
        },
      },
    ],
  } as Order;

  beforeEach(async () => {
    groupOrdersServiceMock = jasmine.createSpyObj<GroupOrdersService>('GroupOrdersService', [
      'getGroupInvite$',
      'getSessions$',
      'submit$',
      'removeSession$',
    ]);
    guestInviteServiceMock = jasmine.createSpyObj<GuestInviteService>('GuestInviteService', [
      'getInviteToken$',
    ]);
    toastServiceMock = jasmine.createSpyObj<ToastService>('ToastService', [
      'success',
      'error',
    ]);

    groupOrdersServiceMock.getGroupInvite$.and.returnValue(throwError(() => new Error('Not group')));
    groupOrdersServiceMock.getSessions$.and.returnValue(of({ participants: [], total: 0 }));

    await TestBed.configureTestingModule({
      imports: [NotSubmittedOrderComponent],
      providers: [
        { provide: GroupOrdersService, useValue: groupOrdersServiceMock },
        { provide: GuestInviteService, useValue: guestInviteServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotSubmittedOrderComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('order', order);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit submitted with the order ID', () => {
    spyOn(component.submitted, 'emit');

    component.submit();

    expect(component.submitted.emit).toHaveBeenCalledWith('order-1');
  });

  it('should calculate the total price', () => {
    expect(component.totalPrice()).toBe(20);
  });
});
