import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { GroupStatusResponse } from '@app/models/group-orders/group-status.model';
import { OwnerSessionResponse } from '@app/models/group-orders/owner-session.model';
import { SubmittedDish, SubmitGroupPreOrderRequest } from '@app/models/group-orders/submit-group-pre-order.model';
import { SKIP_ERROR_TOAST } from '@app/auth/skip-error-toast.context';

export interface RequestOptions {
  silent?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class GroupOrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getGroupInvite$(reservationId: string): Observable<GuestInvite> {
    return this.http
      .get<{ token: string }>(`${this.baseUrl}/reservations/${reservationId}/invite-token`)
      .pipe(
        switchMap(({ token }) =>
          this.http.get<GuestInvite>(`${this.baseUrl}/guest/invites/${token}`)
        )
      );
  }

  getSessions$(groupReservationId: string, options?: RequestOptions): Observable<GroupSessionsResponse> {
    const context = options?.silent
      ? new HttpContext().set(SKIP_ERROR_TOAST, true)
      : undefined;
    return this.http.get<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${groupReservationId}/sessions`,
      { context }
    );
  }

  getOwnerSessionId$(reservationId: string): Observable<string> {
    return this.http
      .get<OwnerSessionResponse>(`${this.baseUrl}/reservations/${reservationId}/guest-session-id`)
      .pipe(map((res) => res.guestSessionId));
  }

  getStatus$(groupReservationId: string, options?: RequestOptions): Observable<GroupStatusResponse> {
    const context = options?.silent
      ? new HttpContext().set(SKIP_ERROR_TOAST, true)
      : undefined;
    return this.http.get<GroupStatusResponse>(
      `${this.baseUrl}/guest/groups/${groupReservationId}/status`,
      { context }
    );
  }

  submit$(groupReservationId: string, reservationId: string): Observable<SubmittedDish[]> {
    const body: SubmitGroupPreOrderRequest = { reservationId };
    return this.http.post<SubmittedDish[]>(
      `${this.baseUrl}/group-reservations/${groupReservationId}/submit`,
      body
    );
  }

  removeSession$(groupReservationId: string, guestSessionId: string): Observable<GroupSessionsResponse> {
    return this.http.delete<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${groupReservationId}/sessions/${guestSessionId}`
    );
  }
}

