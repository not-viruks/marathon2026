# Master Implementation Plan — Всі завдання з homework-backend.md

Цей план охоплює повну реалізацію всіх 3-х рівнів складності з `homework-backend.md`.

---

## 1-й рівень складності (Completed ✅)
- [x] **GET /guest/groups/{groupReservationId}/sessions**
  - [x] Service: `GetAllSessionsAsync` у `GuestSessionService`
  - [x] Handler: `GetGroupSessionsHandler`
  - [x] RouteRegistry: реєстрація роуту
  - [x] deployment_resources.json: реєстрація в API Gateway з `cognito_authorizer`
  - [x] Tests: 4 юніт-тести в `GuestSessionServiceTests`
  - [x] Deployed & Verified в AWS (HTTP 200 OK)

---

## 2-й рівень складності (Completed ✅)

### Завдання 2.1: Отримати owner session id
- **Endpoint**: `GET /reservations/{reservationId}/guest-session-id`
- **Доступ**: Тільки Owner (`reservation.CustomerId == sub`).
- [x] DTO: `GetOwnerGuestSessionResponse`
- [x] Service: метод `GetOwnerSessionIdAsync` в `IGuestSessionService` / `GuestSessionService`
- [x] Handler: `GetOwnerGuestSessionIdHandler`
- [x] RouteRegistry: реєстрація `GET /reservations/{reservationId}/guest-session-id`
- [x] deployment_resources.json: реєстрація в API Gateway з `cognito_authorizer`
- [x] Tests: 4 юніт-тести в `GuestSessionServiceTests`
- [x] Deployed & Verified в AWS (HTTP 200 OK)

### Завдання 2.2: Підтвердити консолідований group pre-order
- **Endpoint**: `POST /group-reservations/{groupReservationId}/submit`
- **Request Body**:
  ```json
  {
    "reservationId": "reservation-123"
  }
  ```
- **Доступ**: Тільки Owner (`reservation.CustomerId == sub`).
- [x] DTOs: `SubmitGroupPreOrderRequest`, `ConsolidatedDishResponse`
- [x] Service: метод `SubmitGroupPreOrderAsync` у `IGroupReservationService` / `GroupReservationService`
- [x] Handler: `SubmitGroupPreOrderHandler`
- [x] RouteRegistry: реєстрація `POST /group-reservations/{groupReservationId}/submit`
- [x] deployment_resources.json: реєстрація в API Gateway з `cognito_authorizer`
- [x] Tests: 3 юніт-тести в `GroupReservationServiceTests`
- [x] Deployed & Verified в AWS (HTTP 200 OK)

---

## 3-й рівень складності (Completed ✅)
- **DELETE /guest/groups/{groupReservationId}/sessions/{guestSessionId}**
  - [x] Service: `DeleteGuestSessionAsync`
  - [x] Handler: `DeleteGuestSessionHandler`
  - [x] RouteRegistry & deployment_resources.json налаштовані з `cognito_authorizer`
  - [x] Tests: 2 юніт-тести в `GuestSessionServiceTests`
  - [x] Deployed & Verified в AWS (HTTP 200 OK)

---

## Фінальна верифікація та деплой
- [x] `dotnet build`: успішно без помилок
- [x] `dotnet test`: 153/153 тестів пройшли успішно
- [x] `syndicate build`: бандл зібрано та завантажено в S3
- [x] `syndicate update --replace_output`: ресурси успішно оновлено
- [x] Тестування всіх ендпоінтів на живому AWS середовищі: всі повертають HTTP 200 OK
