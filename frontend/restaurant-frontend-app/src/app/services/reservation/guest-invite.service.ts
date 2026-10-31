import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { GroupInviteToken, GuestInvite } from '@app/models/reservations/guest-invite.model';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';

@Injectable({
  providedIn: 'root',
})
export class GuestInviteService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  getInviteToken$(reservationId: string): Observable<GroupInviteToken> {
    return this.http
      .get<any>(`${this.baseUrl}/reservations/${encodeURIComponent(reservationId)}/invite-token`)
      .pipe(
        map((res) => ({
          token: res?.token ?? res?.Token ?? '',
        }))
      );
  }

  getInvite$(token: string): Observable<GuestInvite> {
    return this.http
      .get<any>(`${this.baseUrl}/guest/invites/${encodeURIComponent(token)}`)
      .pipe(
        map((res) => ({
          GroupReservationId: res?.groupReservationId ?? res?.GroupReservationId ?? '',
          LocationId: res?.locationId ?? res?.LocationId ?? '',
          RestaurantName: res?.restaurantName ?? res?.RestaurantName ?? '',
          LocationAddress: res?.locationAddress ?? res?.LocationAddress ?? '',
          StartTime: res?.startTime ?? res?.StartTime ?? '',
          EndTime: res?.endTime ?? res?.EndTime ?? '',
          MaxGuestCount: res?.maxGuestCount ?? res?.MaxGuestCount ?? 0,
          TableNumber: res?.tableNumber ?? res?.TableNumber ?? 0,
          InviterName: res?.inviterName ?? res?.InviterName ?? '',
        }))
      );
  }
}
