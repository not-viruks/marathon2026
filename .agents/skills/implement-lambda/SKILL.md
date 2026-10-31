---
name: implement-lambda
description: >-
  Use this skill when the user asks to implement a new AWS Lambda endpoint, handler, service method,
  or feature in the restaurant-backend-app (.NET/C# project). Covers all architectural layers:
  Handler → Service → Repository → RouteRegistry registration.
---

# Implement AWS Lambda in restaurant-backend-app

## Project Overview

The backend lives in `backend/restaurant-backend-app/dnapp/lambdas/api-handler/`.

All endpoints share a **single Lambda function** (`Function.cs`) that uses custom routing.

---

## Architecture Layers

```
API Gateway → Function.cs → RouteRegistry → RouteHandler (match) → IApiRequestHandler.HandleRequest()
                                                                          ↓
                                                                    Service Layer
                                                                          ↓
                                                                    Repository Layer
                                                                          ↓
                                                                      DynamoDB
```

## Layer 1: Handler

Location: `Handlers/<Domain>/YourHandler.cs`

Handlers implement `IApiRequestHandler`:

```csharp
public async Task<APIGatewayProxyResponse> HandleRequest(APIGatewayProxyRequest request, ILambdaContext context)
```

### Getting path parameters:
```csharp
if (!request.TryGetPathValue("groupReservationId", out var groupReservationId))
    return ResponseBuilder.CreateErrorResponse(400, "Missing 'groupReservationId' in path parameters.", context.Logger);
```

### Getting the authenticated user (Cognito sub):
```csharp
if (request.RequestContext?.Authorizer?.Claims == null ||
    !request.RequestContext.Authorizer.Claims.TryGetValue("sub", out var userId))
    return ResponseBuilder.CreateErrorResponse(401, "Unauthorized.", context.Logger);
```

### Response helpers (use `ResponseBuilder`):
```csharp
ResponseBuilder.CreateSuccessResponse(result)          // 200 with JSON body
ResponseBuilder.CreateJsonResponse(200, result)        // 200 with JSON body
ResponseBuilder.CreateErrorResponse(404, "msg", logger) // error with message
ResponseBuilder.CreateErrorCodeResponse(validationException) // from ValidationException
```

### Exception handling pattern (always catch these):
```csharp
catch (GroupReservationNotFoundException ex) → 404
catch (GuestSessionNotFoundException ex)    → 404
catch (ReservationNotFoundException ex)    → 404
catch (ActionForbiddenException ex)        → 403
catch (ValidationException ex)            → ResponseBuilder.CreateErrorCodeResponse(ex)
```

### Constructor styles (both are valid):
```csharp
// Primary constructor (preferred for simple cases):
public class GetGroupSessionsHandler(IGuestSessionService guestSessionService) : IApiRequestHandler { ... }

// Traditional constructor (when null-checks needed):
public class DeleteGuestSessionHandler : IApiRequestHandler
{
    private readonly IGuestSessionService _guestSessionService;
    public DeleteGuestSessionHandler(IGuestSessionService guestSessionService)
    {
        _guestSessionService = guestSessionService ?? throw new ArgumentNullException(nameof(guestSessionService));
    }
}
```

---

## Layer 2: Service

Location: `Services/<Domain>/YourService.cs` + `IYourService.cs`

### Always:
1. Create an **interface** `IYourService` with the method signature.
2. Add the implementation in `YourService.cs`.
3. Register in `RouteRegistry.cs` → `services.AddSingleton<IYourService, YourService>();`

### Owner authorization pattern:
```csharp
private async Task ValidateReservationOwnerAsync(string groupReservationId, string userId)
{
    var group = await groupReservationRepository.GetGroupReservationByIdAsync(groupReservationId)
        ?? throw new GroupReservationNotFoundException();

    var reservation = await reservationRepository.GetReservationByIdAsync(group.ReservationId)
        ?? throw new ReservationNotFoundException("Parent reservation not found.");

    if (reservation.CustomerId != userId)
        throw new ActionForbiddenException("Only the reservation owner can perform this action.");
}
```

### Building participants list (used in GetAllSessions / DeleteSession):
```csharp
var sessions = await guestSessionRepository.GetAllByGroupReservationIdAsync(groupReservationId);
var dishIds = sessions.SelectMany(s => s.Dishes).Select(s => s.DishId).Distinct().ToArray();
var allDishes = await dishRepository.GetDishesByIdsAsync(dishIds);
var dishesById = allDishes.ToDictionary(d => d.Id);

var participants = new List<Participant>();
foreach (var guestSession in sessions)
{
    var items = guestSession.Dishes.Select(d => new OrderItemResponse
    {
        Dish = DishMapper.ToDishResponse(dishesById[d.DishId]),
        Quantity = d.Quantity
    }).ToArray();

    decimal total = items.Sum(i => i.Quantity * i.Dish.Price);
    participants.Add(new Participant(guestSession.Id, ParticipantType.Guest, guestSession.GuestName, items, total, guestSession.IsSubmitted));
}
return new GetAllSessionsResponse(participants, participants.Sum(p => p.Total));
```

---

## Layer 3: Repository

Location: `Repositories/<Domain>/YourRepository.cs` + `IYourRepository.cs`

Use `IDynamoDBContext` via `DynamoConfig` helpers:

```csharp
// Load by PK
await context.LoadAsync<Entity>(id, DynamoConfig.LoadConfig(ResourceNames.TableName));

// Save
await context.SaveAsync(entity, DynamoConfig.SaveConfig(ResourceNames.TableName));

// Delete
await context.DeleteAsync(entity, DynamoConfig.DeleteConfig(ResourceNames.TableName));

// Query by GSI
await context.QueryAsync<Entity>(hashKey, new QueryConfig
{
    OverrideTableName = ResourceNames.TableName,
    IndexName = GlobalSecondaryIndexes.Domain.IndexName
}).GetRemainingAsync();
```

Table names come from `Constants/ResourceNames.cs`.
GSI names come from `Constants/GlobalIndexNames.cs`.

---

## Layer 4: RouteRegistry Registration

File: `Routing/RouteRegistry.cs`

### Register new service (step A):
```csharp
services.AddSingleton<IYourNewService, YourNewService>();
```

### Register new route (step B):
Add to the appropriate `Get*Routes()` method:
```csharp
new RouteHandler(
    new Route(HttpMethods.GET, "/guest/groups/{groupReservationId}/sessions"),
    ActivatorUtilities.CreateInstance<GetGroupSessionsHandler>(provider)
),
```

Route templates use `{paramName}` placeholders which become path parameters.

---

## Models / DTOs

Location: `Models/<Domain>/` — create request/response records or classes.

Example response record:
```csharp
public record GetAllSessionsResponse(IEnumerable<Participant> Participants, decimal Total);

public record Participant(
    string Id,
    string Type,
    string Name,
    OrderItemResponse[] Items,
    decimal Total,
    bool IsSubmitted);
```

---

## Key Entity Structures

### GuestSession (DynamoDB):
- `Id` (PK: `guestSessionId`)
- `GroupReservationId` (GSI: `GroupReservationId-index`)
- `GuestName`, `Dishes` (List<OrderItem>), `IsSubmitted`, `IsOwnerSession`, `OwnerUserId`

### GroupReservation (DynamoDB):
- `GroupReservationId` (PK)
- `ReservationId` (GSI), `ReservationToken` (GSI), `Status` (Open/Submitted/Closed)

### Order (DynamoDB):
- `OrderId` (PK), `ReservationId` (GSI), `Status` (enum `OrderStatus`), `Items` (List<OrderItem>)
- `OrderStatus`: `Pending`, `SubmittedByCustomer`, `Confirmed`, `Canceled`

### Reservation (DynamoDB):
- `Id` (PK), `CustomerId`, `TableId`, `Status`, `GuestCount`, `StartTime`, `EndTime`

---

## Implementation Checklist

When implementing a new endpoint, complete **all** steps:

- [ ] 1. Create `Models/<Domain>/YourRequest.cs` and `YourResponse.cs` if needed
- [ ] 2. Add method signature to `Services/<Domain>/IYourService.cs`
- [ ] 3. Implement method in `Services/<Domain>/YourService.cs`
- [ ] 4. Add repository method signature to `Repositories/<Domain>/IYourRepository.cs` if needed
- [ ] 5. Implement repository method in `Repositories/<Domain>/YourRepository.cs` if needed
- [ ] 6. Create `Handlers/<Domain>/YourHandler.cs`
- [ ] 7. Register DI in `Routing/RouteRegistry.cs` (service + route)
- [ ] 8. Build and test: `cd backend/restaurant-backend-app && dotnet build`

---

## Homework Endpoints to Implement

### Level 1 — GET /guest/groups/{groupReservationId}/sessions
- Auth: Owner only (validate via `reservation.CustomerId == userId`)
- Returns all `GuestSession` records for the group with dish details, per-participant totals, and grand total
- Response shape: `{ participants: [...], total: number }`

### Level 2a — GET /reservations/{reservationId}/guest-session-id
- Auth: Owner only
- Find the `GuestSession` where `IsOwnerSession == true` and `GroupReservationId` matches the group linked to this reservation
- Response: `{ guestSessionId: "..." }`

### Level 2b — POST /group-reservations/{groupReservationId}/submit
- Auth: Owner only
- Body: `{ reservationId: "..." }`
- Steps: filter submitted sessions → collect all dishes → merge by dishId → update Order items → set Order status to `SubmittedByCustomer` → set GroupReservation status to `Submitted`
- Errors: 404 if not found; 400 if no submitted sessions or empty dishes or order not found

### Level 3 — DELETE /guest/groups/{groupReservationId}/sessions/{guestSessionId}
- Auth: Owner only
- Validate session belongs to this group reservation
- Delete the session, return updated snapshot (same shape as Level 1 response)
- Errors: 400 if session doesn't belong to group; 404 if not found

---

## Build Command

```bash
cd /home/andriy/Documents/marathon2026/backend/restaurant-backend-app
dotnet build
```

