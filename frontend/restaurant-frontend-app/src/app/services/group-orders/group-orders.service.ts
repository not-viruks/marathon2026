import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { Participant, ParticipantType } from '@app/models/group-orders/participant.model';
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

  private normalizeSessionsResponse(raw: any): GroupSessionsResponse {
    const rawParticipants = raw?.participants ?? raw?.Participants ?? [];
    const participants: Participant[] = rawParticipants.map((p: any) => ({
      id: p.id ?? p.Id ?? '',
      type: (p.type ?? p.Type ?? 'Guest') as ParticipantType,
      name: p.name ?? p.Name ?? '',
      items: (p.items ?? p.Items ?? []).map((it: any) => ({
        dish: {
          id: it.dish?.id ?? it.dish?.Id ?? it.Dish?.id ?? it.Dish?.Id ?? '',
          name: it.dish?.name ?? it.dish?.Name ?? it.Dish?.name ?? it.Dish?.Name ?? '',
          price: it.dish?.price ?? it.dish?.Price ?? it.Dish?.price ?? it.Dish?.Price ?? 0,
          imageUrl: it.dish?.imageUrl ?? it.dish?.ImageUrl ?? it.Dish?.imageUrl ?? it.Dish?.ImageUrl ?? 'assets/img/dish.png',
          weight: it.dish?.weight ?? it.dish?.Weight ?? it.Dish?.weight ?? it.Dish?.Weight,
        },
        quantity: it.quantity ?? it.Quantity ?? 0,
      })),
      total: p.total ?? p.Total ?? 0,
      isSubmitted: p.isSubmitted ?? p.IsSubmitted ?? false,
    }));
    const total = raw?.total ?? raw?.Total ?? 0;
    return { participants, total };
  }

  getGroupInvite$(reservationId: string, options?: RequestOptions): Observable<GuestInvite> {
    const context = options?.silent
      ? new HttpContext().set(SKIP_ERROR_TOAST, true)
      : undefined;
    return this.http
      .get<any>(`${this.baseUrl}/reservations/${reservationId}/invite-token`, { context })
      .pipe(
        switchMap((res) => {
          const token = res?.token ?? res?.Token;
          return this.http.get<any>(`${this.baseUrl}/guest/invites/${token}`, { context });
        }),
        map((res) => ({
          GroupReservationId: res?.groupReservationId ?? res?.GroupReservationId,
          LocationId: res?.locationId ?? res?.LocationId,
          RestaurantName: res?.restaurantName ?? res?.RestaurantName,
          LocationAddress: res?.locationAddress ?? res?.LocationAddress,
          StartTime: res?.startTime ?? res?.StartTime,
          EndTime: res?.endTime ?? res?.EndTime,
          MaxGuestCount: res?.maxGuestCount ?? res?.MaxGuestCount,
          TableNumber: res?.tableNumber ?? res?.TableNumber,
          InviterName: res?.inviterName ?? res?.InviterName,
        }))
      );
  }

  getSessions$(groupReservationId: string, options?: RequestOptions): Observable<GroupSessionsResponse> {
    const context = options?.silent
      ? new HttpContext().set(SKIP_ERROR_TOAST, true)
      : undefined;
    return this.http.get<any>(
      `${this.baseUrl}/guest/groups/${groupReservationId}/sessions`,
      { context }
    ).pipe(
      map((res) => this.normalizeSessionsResponse(res))
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
    return this.http.delete<any>(
      `${this.baseUrl}/guest/groups/${groupReservationId}/sessions/${guestSessionId}`
    ).pipe(
      map((res) => this.normalizeSessionsResponse(res))
    );
  }
}
