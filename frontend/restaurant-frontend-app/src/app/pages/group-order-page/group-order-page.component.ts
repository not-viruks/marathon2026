import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { catchError, exhaustMap, filter, finalize, forkJoin, interval, Observable, of, Subscription, switchMap, tap } from 'rxjs';
import { ParticipantCardComponent } from '@app/components/group-orders/participant-card/participant-card.component';
import { ModalComponent } from '@app/shared/custom-components/modal/modal.component';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { ToastService } from '@app/services/toast/toast.service';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { Participant } from '@app/models/group-orders/participant.model';
import { GroupReservationStatus } from '@app/models/group-orders/group-status.model';
import { consolidatePreOrder } from '@app/shared/helpers/consolidate-pre-order';

@Component({
  selector: 'app-group-order-page',
  imports: [ParticipantCardComponent, DatePipe, CurrencyPipe, ModalComponent],
  templateUrl: './group-order-page.component.html',
  styleUrl: './group-order-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class GroupOrderPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly groupOrdersService = inject(GroupOrdersService);
  private readonly toastService = inject(ToastService);

  private syncSubscription?: Subscription;
  private isSyncing = false;

  readonly reservationId = signal<string>('');
  readonly groupReservationId = signal<string>('');
  readonly invite = signal<GuestInvite | null>(null);
  readonly participants = signal<Participant[]>([]);
  readonly ownerSessionId = signal<string>('');
  readonly status = signal<GroupReservationStatus>('Open');

  readonly isLoading = signal<boolean>(false);
  readonly errorStatus = signal<number | null>(null);

  readonly isModalOpen = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  readonly guestToRemove = signal<Participant | null>(null);
  readonly isRemovingGuest = signal<boolean>(false);

  readonly lastUpdated = signal<Date | null>(null);
  readonly syncFailed = signal<boolean>(false);

  readonly consolidated = computed(() => consolidatePreOrder(this.participants()));
  readonly grandTotal = computed(() => this.consolidated().total);

  readonly unsubmittedParticipants = computed(() =>
    this.participants().filter((person) => !person.isSubmitted)
  );

  readonly unsubmittedBannerText = computed(() => {
    const count = this.unsubmittedParticipants().length;
    if (count === 0) return '';
    const noun = count === 1 ? 'participant' : 'participants';
    const verb = count === 1 ? 'hasn’t' : 'haven’t';
    return `${count} ${noun} ${verb} submitted their cart yet — their dishes won't be included in the order`;
  });

  readonly hasAnyDishes = computed(() =>
    this.participants().some((person) => person.items.length > 0)
  );

  readonly statusBadgeText = computed(() => {
    return this.status() === 'Submitted' ? 'Sent to Restaurant' : 'Collecting pre-orders';
  });

  readonly canSubmit = computed(() => {
    return this.consolidated().items.length > 0 && this.status() === 'Open';
  });

  ngOnInit(): void {
    const resId = this.route.snapshot.paramMap.get('reservationId') ?? '';
    this.reservationId.set(resId);
    this.loadData();
  }

  ngOnDestroy(): void {
    this.stopSyncTimer();
  }

  loadData(): void {
    const resId = this.reservationId();
    if (!resId) return;

    this.stopSyncTimer();
    this.isLoading.set(true);
    this.errorStatus.set(null);

    this.groupOrdersService
      .getGroupInvite$(resId)
      .pipe(
        switchMap((invite) => {
          this.invite.set(invite);
          this.groupReservationId.set(invite.GroupReservationId);

          return forkJoin({
            sessions: this.groupOrdersService.getSessions$(invite.GroupReservationId),
            ownerSessionId: this.groupOrdersService.getOwnerSessionId$(resId),
            status: this.groupOrdersService.getStatus$(invite.GroupReservationId),
          });
        })
      )
      .subscribe({
        next: ({ sessions, ownerSessionId, status }) => {
          this.participants.set(sessions.participants);
          this.ownerSessionId.set(ownerSessionId);
          this.status.set(status.status);
          this.lastUpdated.set(new Date());
          this.syncFailed.set(false);
          this.isLoading.set(false);
          this.startSyncTimer();
        },
        error: (err: HttpErrorResponse) => {
          this.errorStatus.set(err.status ?? 500);
          this.isLoading.set(false);
        },
      });
  }

  refresh(): void {
    if (this.isSyncing || this.status() !== 'Open') {
      return;
    }
    this.syncData({ silent: true }).subscribe();
  }

  private startSyncTimer(): void {
    this.stopSyncTimer();
    if (this.status() !== 'Open') {
      return;
    }

    this.syncSubscription = interval(15_000)
      .pipe(
        filter(() => this.status() === 'Open' && !this.isSyncing),
        exhaustMap(() => this.syncData({ silent: true }))
      )
      .subscribe();
  }

  private stopSyncTimer(): void {
    if (this.syncSubscription) {
      this.syncSubscription.unsubscribe();
      this.syncSubscription = undefined;
    }
  }

  private syncData(options: { silent: boolean }): Observable<unknown> {
    const groupId = this.groupReservationId();
    if (!groupId) {
      return of(null);
    }

    this.isSyncing = true;
    return forkJoin({
      sessions: this.groupOrdersService.getSessions$(groupId, options),
      status: this.groupOrdersService.getStatus$(groupId, options),
    }).pipe(
      tap({
        next: ({ sessions, status }) => {
          this.participants.set(sessions.participants);
          this.status.set(status.status);
          this.lastUpdated.set(new Date());
          this.syncFailed.set(false);
          if (status.status !== 'Open') {
            this.stopSyncTimer();
          }
        },
        error: () => {
          this.syncFailed.set(true);
        },
      }),
      finalize(() => {
        this.isSyncing = false;
      }),
      catchError(() => of(null))
    );
  }

  openSubmitDialog(): void {
    if (!this.canSubmit() || this.isSubmitting()) {
      return;
    }
    this.isModalOpen.set(true);
  }

  closeSubmitDialog(): void {
    if (this.isSubmitting()) return;
    this.isModalOpen.set(false);
  }

  confirmSubmit(): void {
    if (this.isSubmitting() || !this.canSubmit()) {
      return;
    }
    this.isSubmitting.set(true);

    this.groupOrdersService
      .submit$(this.groupReservationId(), this.reservationId())
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isModalOpen.set(false);
          this.status.set('Submitted');
          this.stopSyncTimer();
          this.toastService.success('Pre-order sent to the restaurant');
        },
        error: () => {
          this.isSubmitting.set(false);
        },
      });
  }

  openRemoveGuestModal(guest: Participant): void {
    this.guestToRemove.set(guest);
  }

  closeRemoveGuestModal(): void {
    if (this.isRemovingGuest()) return;
    this.guestToRemove.set(null);
  }

  confirmRemoveGuest(): void {
    const guest = this.guestToRemove();
    if (!guest || this.isRemovingGuest()) {
      return;
    }
    this.isRemovingGuest.set(true);

    this.groupOrdersService
      .removeSession$(this.groupReservationId(), guest.id)
      .subscribe({
        next: (response) => {
          this.participants.set(response.participants);
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
}