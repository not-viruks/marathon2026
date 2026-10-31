using APIHandler.Constants;
using APIHandler.Entities;
using APIHandler.Exceptions;
using APIHandler.Models.GroupReservation;
using APIHandler.Models.GuestReservation;
using APIHandler.Repositories.GroupReservations;
using APIHandler.Repositories.GuestSessions;
using APIHandler.Repositories.Orders;
using APIHandler.Repositories.Reservations;
using APIHandler.Repositories.Tables;
using APIHandler.Services.Auth;
using APIHandler.Services.Locations;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace APIHandler.Services.GroupReservations;

public class GroupReservationService(
    IGroupReservationRepository groupReservationRepository,
    ITableRepository tableRepository,
    IReservationRepository reservationRepository,
    IGuestSessionRepository guestSessionRepository,
    IUserService userService,
    ILocationService locationService,
    IOrderRepository orderRepository) : IGroupReservationService
{
    private const string DefaultRestaurantName = "Green & Tasty";

    public async Task<GetGroupReservationResponse> GetGroupReservationByTokenAsync(string token)
    {
        GroupReservation groupReservation = await groupReservationRepository.GetGroupReservationByTokenAsync(token)
            ?? throw new GroupReservationNotFoundException();

        if (groupReservation.Status != GroupReservationStatus.Open)
            throw new GroupReservationExpiredException();

        Task<Reservation?> reservationTask = reservationRepository.GetReservationByIdAsync(groupReservation.ReservationId);
        Task<int> countTask = guestSessionRepository.CountByGroupReservationId(groupReservation.GroupReservationId);

        Reservation reservation = await reservationTask ?? throw new ValidationException("Associated reservation not found.");
        int joinedGuestsCount = await countTask;

        if (joinedGuestsCount + 1 >= reservation.GuestCount)
            throw new GuestLimitExceededException();

        Table table = await tableRepository.GetTableAsync(reservation.TableId)
            ?? throw new InvalidOperationException("Associated table not found.");

        Location? location = await locationService.GetLocationByIdAsync(table.LocationId);
        string restaurantName = DefaultRestaurantName;
        string address = location?.Address ?? "Unknown Address";

        string inviterName = "Unknown";
        if (!string.IsNullOrWhiteSpace(reservation.CustomerId))
        {
            inviterName = await userService.GetUserName(reservation.CustomerId) ?? "Unknown";
        }
        return new GetGroupReservationResponse(
            groupReservation.GroupReservationId,
            table.LocationId,
            restaurantName,
            address,
            reservation.StartTime,
            reservation.EndTime,
            reservation.GuestCount,
            table.TableNumber,
            inviterName);
    }

    public async Task<GroupReservation> GetGroupReservationAsync(string groupReservationId)
    {
        GroupReservation? groupReservation = await groupReservationRepository.GetGroupReservationByIdAsync(groupReservationId);
        return groupReservation ?? throw new InvalidOperationException($"Group reservation with ID {groupReservationId} not found.");
    }

    public async Task<GroupReservation> CreateGroupReservationAsync(string reservationId)
    {
        var groupReservation = new GroupReservation
        {
            GroupReservationId = Guid.NewGuid().ToString(),
            ReservationId = reservationId,
            ReservationToken = Guid.NewGuid().ToString("N"),
            Status = GroupReservationStatus.Open,
        };

        await groupReservationRepository.SaveGroupReservationAsync(groupReservation);
        return groupReservation;
    }

    public async Task CreateGroupReservationIfDoesNotExistAsync(string userId, string reservationId)
    {
        GroupReservation? group = await groupReservationRepository.GetByReservationIdAsync(reservationId);
        if (group is not null)
            return;

        await CreateGroupReservationAsync(reservationId);
    }

    public async Task UpdateGroupReservationStatusAsync(string groupReservationId, GroupReservationStatus status)
    {
        var groupReservation = await GetGroupReservationAsync(groupReservationId);

        groupReservation.Status = status;

        await groupReservationRepository.SaveGroupReservationAsync(groupReservation);
    }

    public async Task DeleteGroupReservationAsync(string groupReservationId)
    {
        var groupReservation = await GetGroupReservationAsync(groupReservationId);

        await groupReservationRepository.DeleteGroupReservationAsync(groupReservation);
    }

    public async Task CloseGroupReservationAsync(string reservationId)
    {
        GroupReservation? groupReservation = await groupReservationRepository.GetByReservationIdAsync(reservationId);
        if (groupReservation is null)
            return;

        groupReservation.Status = GroupReservationStatus.Closed;

        await groupReservationRepository.SaveGroupReservationAsync(groupReservation);
    }

    public async Task<GetGroupInviteTokenResponse> GetGroupReservationInviteTokenAsync(string reservationId)
    {
        var reservation = await reservationRepository.GetReservationByIdAsync(reservationId)
            ?? throw new ReservationNotFoundException($"Reservation {reservationId} was not found.");

        if (reservation.GuestCount < 2)
            throw new ValidationException("Retrieving invitation token for the reservation with only one guest is not permitted.");

        if (reservation.Status != ReservationStatus.Reserved)
            throw new GroupReservationExpiredException("The group reservation is expired.");

        GroupReservation groupReservation = (await groupReservationRepository.GetByReservationIdAsync(reservationId))!;

        if (groupReservation.Status == GroupReservationStatus.Submitted)
            throw new GroupReservationSubmittedException();

        if (groupReservation.Status == GroupReservationStatus.Closed)
            throw new GroupReservationExpiredException();

        return new GetGroupInviteTokenResponse(groupReservation.ReservationToken);
    }

    public async Task<List<ConsolidatedDishResponse>> SubmitGroupPreOrderAsync(string userId, string groupReservationId, SubmitGroupPreOrderRequest request)
    {
        var groupReservation = await groupReservationRepository.GetGroupReservationByIdAsync(groupReservationId)
            ?? throw new GroupReservationNotFoundException($"Group reservation with ID '{groupReservationId}' not found.");

        var reservation = await reservationRepository.GetReservationByIdAsync(request.ReservationId)
            ?? throw new ReservationNotFoundException($"Reservation with ID '{request.ReservationId}' not found.");

        if (groupReservation.ReservationId != request.ReservationId)
        {
            throw new ValidationException("Group reservation does not match the provided reservation ID.");
        }

        if (reservation.CustomerId != userId)
        {
            throw new ActionForbiddenException("Only the reservation owner can submit the group pre-order.");
        }

        var sessions = await guestSessionRepository.GetAllByGroupReservationIdAsync(groupReservationId);
        var submittedSessions = sessions.Where(s => s.IsSubmitted).ToList();

        if (submittedSessions.Count == 0)
        {
            throw new ValidationException("There are no submitted guest sessions in this group.");
        }

        var allSubmittedDishes = submittedSessions
            .Where(s => s.Dishes != null)
            .SelectMany(s => s.Dishes)
            .Where(d => d.Quantity > 0)
            .ToList();

        if (allSubmittedDishes.Count == 0)
        {
            throw new ValidationException("No dishes found in the submitted guest sessions.");
        }

        var order = await orderRepository.GetOrderByReservationIdAsync(request.ReservationId)
            ?? throw new ValidationException($"Order for reservation '{request.ReservationId}' was not found.");

        var consolidated = allSubmittedDishes
            .GroupBy(d => d.DishId)
            .Select(g => new
            {
                DishId = g.Key,
                TotalQuantity = g.Sum(x => x.Quantity)
            })
            .ToList();

        order.Dishes ??= [];

        foreach (var item in consolidated)
        {
            var existingOrderItem = order.Dishes.FirstOrDefault(d => d.DishId == item.DishId);
            if (existingOrderItem != null)
            {
                existingOrderItem.Quantity += item.TotalQuantity;
            }
            else
            {
                order.Dishes.Add(new OrderItem
                {
                    DishId = item.DishId,
                    Quantity = item.TotalQuantity,
                    State = APIHandler.Constants.Orders.OrderItemState.Pending
                });
            }
        }

        order.Status = OrderStatus.SubmittedByCustomer;
        await orderRepository.SaveOrderAsync(order);

        groupReservation.Status = GroupReservationStatus.Submitted;
        await groupReservationRepository.SaveGroupReservationAsync(groupReservation);

        return consolidated
            .Select(c => new ConsolidatedDishResponse(c.DishId, c.TotalQuantity))
            .ToList();
    }
}

