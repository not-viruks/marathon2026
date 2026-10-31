import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Order } from '@app/models/orders/order.model';
import { Participant } from '@app/models/group-orders/participant.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { GuestInviteService } from '@app/services/reservation/guest-invite.service';
import { ToastService } from '@app/services/toast/toast.service';
import { ModalComponent } from '@app/shared/custom-components/modal/modal.component';

@Component({
  selector: 'app-not-submitted-order',
  standalone: true,
  imports: [CurrencyPipe, ModalComponent],
  templateUrl: './not-submitted-order.component.html',
  styleUrl: './not-submitted-order.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotSubmittedOrderComponent implements OnInit {
  private readonly groupOrdersService = inject(GroupOrdersService);
  private readonly guestInviteService = inject(GuestInviteService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly order = input.required<Order>();

  readonly submitted = output<string>();
  readonly addDish = output<void>();
  readonly removeDish = output<string>();
  readonly updateQuantity = output<{
    itemId: string;
    quantity: number;
  }>();

  readonly groupInvite = signal<GuestInvite | null>(null);
  readonly participants = signal<Participant[]>([]);
  readonly hasGroup = signal<boolean>(false);
  readonly selectedGuest = signal<Participant | null>(null);

  readonly isInviteModalOpen = signal<boolean>(false);
  readonly inviteToken = signal<string | null>(null);
  readonly guestToRemove = signal<Participant | null>(null);
  readonly isRemovingGuest = signal<boolean>(false);

  readonly guests = computed(() =>
    this.participants().filter(
      (p) =>
        p.type === 'Guest' ||
        (p.type as any) === 'guest' ||
        (p.type as any) === 1
    )
  );

  readonly otherGuests = computed(() => {
    const cur = this.selectedGuest();
    if (!cur) return [];
    return this.guests().filter((g) => g.id !== cur.id);
  });

  readonly nextGuest = computed(() => {
    const list = this.otherGuests();
    return list.length > 0 ? list[0] : null;
  });

  readonly myTotalPrice = computed(() =>
    this.order().orderItems.reduce(
      (total, item) => total + item.dish.price * item.quantity,
      0
    )
  );

  readonly grandTotal = computed(() => {
    const myTotal = this.myTotalPrice();
    const guestsTotal = this.guests()
      .filter((g) => g.isSubmitted)
      .reduce((sum, g) => sum + g.total, 0);
    return myTotal + guestsTotal;
  });

  readonly inviteLink = computed(() => {
    const token = this.inviteToken();
    return token ? `${window.location.origin}/join/${token}` : null;
  });

  // Backward compatibility alias for tests
  readonly totalPrice = computed(() => this.myTotalPrice());

  ngOnInit(): void {
    this.loadGroupSessions();
  }

  loadGroupSessions(): void {
    const resId = this.order().reservationId;
    if (!resId) return;

    this.groupOrdersService
      .getGroupInvite$(resId, { silent: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invite) => {
          this.groupInvite.set(invite);
          const groupId = (invite as any).groupReservationId ?? invite.GroupReservationId;
          if (groupId) {
            this.hasGroup.set(true);
            this.loadSessions(groupId);
          }
        },
        error: () => {
          this.hasGroup.set(false);
          this.participants.set([]);
        },
      });
  }

  private loadSessions(groupId: string): void {
    this.groupOrdersService
      .getSessions$(groupId, { silent: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.participants.set(res.participants);
          if (this.selectedGuest()) {
            const updated = res.participants.find(
              (p) => p.id === this.selectedGuest()?.id
            );
            this.selectedGuest.set(updated ?? null);
          }
        },
        error: (err) => console.error('Failed to load group sessions in cart:', err),
      });
  }

  selectGuest(guest: Participant): void {
    this.selectedGuest.set(guest);
  }

  backToMyPreOrder(): void {
    this.selectedGuest.set(null);
  }

  incrementItemQuantity(itemId: string): void {
    const item = this.findOrderItem(itemId);
    if (item) {
      this.updateItemQuantity(itemId, item.quantity + 1);
    }
  }

  decrementItemQuantity(itemId: string): void {
    const item = this.findOrderItem(itemId);
    if (item && item.quantity > 1) {
      this.updateItemQuantity(itemId, item.quantity - 1);
    }
  }

  submit(): void {
    const invite = this.groupInvite();
    const hasSubmittedGuests = this.guests().some(
      (g) => g.isSubmitted && g.items.length > 0
    );

    if (this.hasGroup() && invite && hasSubmittedGuests) {
      this.groupOrdersService
        .submit$(invite.GroupReservationId, this.order().reservationId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toastService.success('Pre-order sent to the restaurant');
            this.submitted.emit(this.order().orderId);
          },
          error: () => {
            // Fallback to regular submit if group submit fails
            this.submitted.emit(this.order().orderId);
          },
        });
    } else {
      this.submitted.emit(this.order().orderId);
    }
  }

  addDishToOrder(): void {
    this.addDish.emit();
  }

  removeDishFromOrder(itemId: string): void {
    this.removeDish.emit(itemId);
  }

  openInviteModal(): void {
    this.isInviteModalOpen.set(true);
    if (!this.inviteToken()) {
      this.guestInviteService
        .getInviteToken$(this.order().reservationId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ token }) => this.inviteToken.set(token),
          error: () =>
            this.toastService.error('Could not generate invite link.'),
        });
    }
  }

  closeInviteModal(): void {
    this.isInviteModalOpen.set(false);
  }

  async copyInviteLink(): Promise<void> {
    const link = this.inviteLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      this.toastService.success('Share it with your friends.', 'Link copied!');
    } catch {
      this.toastService.error('Could not copy link to clipboard.');
    }
  }

  openRemoveGuest(guest: Participant): void {
    this.guestToRemove.set(guest);
  }

  closeRemoveGuestModal(): void {
    if (this.isRemovingGuest()) return;
    this.guestToRemove.set(null);
  }

  confirmRemoveGuest(): void {
    const guest = this.guestToRemove();
    const invite = this.groupInvite();
    if (!guest || !invite || this.isRemovingGuest()) return;

    this.isRemovingGuest.set(true);
    this.groupOrdersService
      .removeSession$(invite.GroupReservationId, guest.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.participants.set(res.participants);
          if (this.selectedGuest()?.id === guest.id) {
            this.selectedGuest.set(null);
          }
          this.guestToRemove.set(null);
          this.isRemovingGuest.set(false);
          this.toastService.success(`Removed ${guest.name}`);
        },
        error: () => {
          this.isRemovingGuest.set(false);
          this.guestToRemove.set(null);
        },
      });
  }

  private findOrderItem(itemId: string) {
    return this.order().orderItems.find((item) => item.dish.id === itemId);
  }

  private updateItemQuantity(itemId: string, quantity: number): void {
    this.updateQuantity.emit({ itemId, quantity });
  }
}
