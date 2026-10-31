import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';

export interface CreateGuestSessionRequest {
    groupReservationId: string;
    guestName: string;
}

export interface CreateGuestSessionResponse {
    SessionId: string;
    SessionToken: string;
}

export interface GuestMenuDish {
    id: string;
    name: string;
    description: string;
    price: number;
    weight?: string;
    calories?: string;
    proteins?: string;
    fats?: string;
    carbohydrates?: string;
    vitamins?: string;
    imageUrl?: string | null;
    state: string;        // "Available" | "On Stop"
    selectable: boolean;  // true/false
}

export type GuestMenuCategoryKey = string;

export interface GuestMenuResponse {
    dishes: Record<GuestMenuCategoryKey, GuestMenuDish[]>;
}

@Injectable({ providedIn: 'root' })
export class GuestSessionsService {
    private readonly baseUrl = inject(API_BASE_URL);
    private readonly http = inject(HttpClient);

    createSession(body: CreateGuestSessionRequest): Observable<CreateGuestSessionResponse> {
        return this.http.post<any>(`${this.baseUrl}/guest/sessions`, body).pipe(
            map((res) => ({
                SessionId: res?.sessionId ?? res?.SessionId ?? '',
                SessionToken: res?.sessionToken ?? res?.SessionToken ?? '',
            }))
        );
    }

    getMenu(guestSessionId: string, sessionToken: string): Observable<GuestMenuResponse> {
        return this.http
            .get<any>(`${this.baseUrl}/guest/sessions/${guestSessionId}/menu`, {
                headers: this.authHeaders(sessionToken),
            })
            .pipe(
                map((res) => {
                    const rawDishes = res?.dishes ?? res?.Dishes ?? {};
                    const normalizedDishes: Record<string, GuestMenuDish[]> = {};

                    for (const [category, dishList] of Object.entries(rawDishes)) {
                        if (Array.isArray(dishList)) {
                            normalizedDishes[category] = dishList.map((d: any) => ({
                                id: d.id ?? d.Id ?? '',
                                name: d.name ?? d.Name ?? '',
                                description: d.description ?? d.Description ?? '',
                                price: d.price ?? d.Price ?? 0,
                                weight: d.weight ?? d.Weight ?? '',
                                calories: d.calories ?? d.Calories ?? '',
                                proteins: d.proteins ?? d.Proteins ?? '',
                                fats: d.fats ?? d.Fats ?? '',
                                carbohydrates: d.carbohydrates ?? d.Carbohydrates ?? '',
                                vitamins: d.vitamins ?? d.Vitamins ?? '',
                                imageUrl: d.imageUrl ?? d.ImageUrl ?? null,
                                state: d.state ?? d.State ?? 'Available',
                                selectable:
                                    d.selectable ??
                                    d.Selectable ??
                                    (d.state ?? d.State) === 'Available',
                            }));
                        }
                    }

                    return { dishes: normalizedDishes };
                })
            );
    }

    addDish(guestSessionId: string, sessionToken: string, dishId: string, quantity: number) {
        return this.http.post(
            `${this.baseUrl}/guest/sessions/${guestSessionId}/dishes`,
            { dishId, quantity },
            { headers: this.authHeaders(sessionToken) }
        );
    }

    removeDish(guestSessionId: string, sessionToken: string, dishId: string, quantity: number) {
        return this.http.request(
            'delete',
            `${this.baseUrl}/guest/sessions/${guestSessionId}/dishes`,
            { body: { dishId, quantity }, headers: this.authHeaders(sessionToken) }
        );
    }

    submit(guestSessionId: string, sessionToken: string) {
        return this.http.post(
            `${this.baseUrl}/guest/sessions/${guestSessionId}/submit`,
            {},
            { headers: this.authHeaders(sessionToken) }
        );
    }

    private authHeaders(token: string) {
        return new HttpHeaders({ Authorization: `Bearer ${token}` });
    }
}
