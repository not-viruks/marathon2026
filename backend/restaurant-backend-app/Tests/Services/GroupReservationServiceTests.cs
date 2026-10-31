using APIHandler.Constants;
using APIHandler.Entities;
using APIHandler.Exceptions;
using APIHandler.Models.GroupReservation;
using APIHandler.Repositories.GroupReservations;
using APIHandler.Repositories.GuestSessions;
using APIHandler.Repositories.Orders;
using APIHandler.Repositories.Reservations;
using APIHandler.Repositories.Tables;
using APIHandler.Services.Auth;
using APIHandler.Services.GroupReservations;
using APIHandler.Services.Locations;
using AutoFixture.Xunit2;
using Moq;

namespace APIHandler.Tests.Services;

public class GroupReservationServiceTests
{
    private readonly Mock<IGroupReservationRepository> _groupReservationRepositoryMock = new();
    private readonly Mock<ITableRepository> _tableRepositoryMock = new();
    private readonly Mock<IReservationRepository> _reservationRepositoryMock = new();
    private readonly Mock<IGuestSessionRepository> _guestSessionRepositoryMock = new();
    private readonly Mock<IUserService> _userServiceMock = new();
    private readonly Mock<ILocationService> _locationServiceMock = new();
    private readonly Mock<IOrderRepository> _orderRepositoryMock = new();

    private readonly GroupReservationService _service;

    public GroupReservationServiceTests()
    {
        _service = new GroupReservationService(
            _groupReservationRepositoryMock.Object,
            _tableRepositoryMock.Object,
            _reservationRepositoryMock.Object,
            _guestSessionRepositoryMock.Object,
            _userServiceMock.Object,
            _locationServiceMock.Object,
            _orderRepositoryMock.Object);
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationByTokenAsync_ValidInput_ReturnsGroupReservationInfo(
        GroupReservation groupReservation,
        Table table,
        Reservation reservation,
        Location location,
        string expectedUserName)
    {
        groupReservation.ReservationId = reservation.Id;
        groupReservation.Status = GroupReservationStatus.Open;
        reservation.TableId = table.Id;
        table.LocationId = location.Id;

        _groupReservationRepositoryMock
            .Setup(r => r.GetGroupReservationByTokenAsync(groupReservation.ReservationToken))
            .ReturnsAsync(groupReservation);

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        _guestSessionRepositoryMock
            .Setup(r => r.CountByGroupReservationId(groupReservation.GroupReservationId))
            .ReturnsAsync(0);

        _tableRepositoryMock
            .Setup(r => r.GetTableAsync(table.Id))
            .ReturnsAsync(table);

        _locationServiceMock
            .Setup(s => s.GetLocationByIdAsync(table.LocationId))
            .ReturnsAsync(location);

        _userServiceMock
            .Setup(s => s.GetUserName(reservation.CustomerId!))
            .ReturnsAsync(expectedUserName);

        var result = await _service.GetGroupReservationByTokenAsync(groupReservation.ReservationToken);

        Assert.Equal(groupReservation.GroupReservationId, result.GroupReservationId);
        Assert.Equal(table.LocationId, result.LocationId);
        Assert.Equal(reservation.GuestCount, result.MaxGuestCount);
        Assert.Equal(reservation.StartTime, result.StartTime);
        Assert.Equal(reservation.EndTime, result.EndTime);
        Assert.Equal(table.TableNumber, result.TableNumber);
        Assert.Equal("Green & Tasty", result.RestaurantName);
        Assert.Equal(location.Address, result.LocationAddress);
        Assert.Equal(expectedUserName, result.InviterName);
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationByTokenAsync_InvalidToken_ThrowsNotFound(string token)
    {
        _groupReservationRepositoryMock
            .Setup(r => r.GetGroupReservationByTokenAsync(token))
            .ReturnsAsync((GroupReservation?)null);

        await Assert.ThrowsAsync<GroupReservationNotFoundException>(() => _service.GetGroupReservationByTokenAsync(token));
    }

    [Theory]
    [InlineAutoData(GroupReservationStatus.Closed)]
    [InlineAutoData(GroupReservationStatus.Submitted)]
    public async Task GetGroupReservationByTokenAsync_GroupReservationIsNotOpen_ThrowsException(
        GroupReservationStatus status,
        GroupReservation groupReservation)
    {
        groupReservation.Status = status;

        _groupReservationRepositoryMock
            .Setup(r => r.GetGroupReservationByTokenAsync(groupReservation.ReservationToken))
            .ReturnsAsync(groupReservation);

        await Assert.ThrowsAsync<GroupReservationExpiredException>(() => _service.GetGroupReservationByTokenAsync(groupReservation.ReservationToken));
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationByTokenAsync_WhenGuestCountIsMax_ThrowsGuestLimitExceeded(GroupReservation groupReservation, Reservation reservation)
    {
        groupReservation.Status = GroupReservationStatus.Open;
        groupReservation.ReservationId = reservation.Id;

        _groupReservationRepositoryMock
            .Setup(r => r.GetGroupReservationByTokenAsync(groupReservation.ReservationToken))
            .ReturnsAsync(groupReservation);

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        _guestSessionRepositoryMock
            .Setup(r => r.CountByGroupReservationId(groupReservation.GroupReservationId))
            .ReturnsAsync(reservation.GuestCount);

        await Assert.ThrowsAsync<GuestLimitExceededException>(() => _service.GetGroupReservationByTokenAsync(groupReservation.ReservationToken));
    }

    [Theory]
    [AutoData]
    public async Task CloseGroupReservationAsync_ValidInput_UpdatesGroupReservationStatus(GroupReservation groupReservation)
    {
        _groupReservationRepositoryMock
            .Setup(r => r.GetByReservationIdAsync(groupReservation.ReservationId))
            .ReturnsAsync(groupReservation);

        GroupReservation? savedGroupReservation = null;
        _groupReservationRepositoryMock
            .Setup(r => r.SaveGroupReservationAsync(It.IsAny<GroupReservation>()))
            .Callback<GroupReservation>(r => savedGroupReservation = r);

        await _service.CloseGroupReservationAsync(groupReservation.ReservationId);

        Assert.NotNull(savedGroupReservation);
        Assert.Equal(GroupReservationStatus.Closed, savedGroupReservation.Status);
    }

    [Theory]
    [AutoData]
    public async Task CloseGroupReservationAsync_GroupReservationNotFound_DoesNotThrowException(string reservationId)
    {
        _groupReservationRepositoryMock
            .Setup(r => r.GetByReservationIdAsync(reservationId))
            .ReturnsAsync((GroupReservation?)null);

        await _service.CloseGroupReservationAsync(reservationId);
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationInviteTokenAsync_ValidInput_ReturnsToken(Reservation reservation, GroupReservation groupReservation)
    {
        reservation.Status = ReservationStatus.Reserved;
        reservation.GuestCount = 3;
        groupReservation.ReservationId = reservation.Id;
        groupReservation.Status = GroupReservationStatus.Open;

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        _groupReservationRepositoryMock
            .Setup(r => r.GetByReservationIdAsync(reservation.Id))
            .ReturnsAsync(groupReservation);

        GetGroupInviteTokenResponse result = await _service.GetGroupReservationInviteTokenAsync(reservation.Id);

        Assert.Equal(groupReservation.ReservationToken, result.Token);
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationInviteTokenAsync_InvalidReservationId_ThrowsNotFound(string reservationId)
    {
        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservationId))
            .ReturnsAsync((Reservation?)null);

        await Assert.ThrowsAsync<ReservationNotFoundException>(() => _service.GetGroupReservationInviteTokenAsync(reservationId));
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationInviteTokenAsync_OneGuest_ThrowsValidationException(Reservation reservation)
    {
        reservation.Status = ReservationStatus.Reserved;
        reservation.GuestCount = 1;

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        await Assert.ThrowsAsync<ValidationException>(() => _service.GetGroupReservationInviteTokenAsync(reservation.Id));
    }

    [Theory]
    [InlineAutoData(ReservationStatus.Completed)]
    [InlineAutoData(ReservationStatus.Cancelled)]
    [InlineAutoData(ReservationStatus.InProgress)]
    public async Task GetGroupReservationInviteTokenAsync_StatusIsNotReserved_ThrowsValidationException(ReservationStatus reservationStatus, Reservation reservation)
    {
        reservation.Status = reservationStatus;
        reservation.GuestCount = 1;

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        await Assert.ThrowsAsync<ValidationException>(() => _service.GetGroupReservationInviteTokenAsync(reservation.Id));
    }

    [Theory]
    [InlineAutoData(GroupReservationStatus.Closed, typeof(GroupReservationExpiredException))]
    [InlineAutoData(GroupReservationStatus.Submitted, typeof(GroupReservationSubmittedException))]
    public async Task GetGroupReservationInviteTokenAsync_GroupStatusIsNotOpen_ThrowsException(GroupReservationStatus status, Type type, Reservation reservation, GroupReservation groupReservation)
    {
        reservation.Status = ReservationStatus.Reserved;
        reservation.GuestCount = 3;
        groupReservation.ReservationId = reservation.Id;
        groupReservation.Status = status;

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        _groupReservationRepositoryMock
            .Setup(r => r.GetByReservationIdAsync(reservation.Id))
            .ReturnsAsync(groupReservation);

        await Assert.ThrowsAsync(type, () => _service.GetGroupReservationInviteTokenAsync(reservation.Id));
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_ValidOwner_ConsolidatesDishesAndUpdatesOrder()
    {
        var userId = "user-123";
        var groupReservationId = "group-1";
        var reservationId = "res-1";
        var orderId = "order-1";

        var groupReservation = new GroupReservation
        {
            GroupReservationId = groupReservationId,
            ReservationId = reservationId,
            ReservationToken = "token-1",
            Status = GroupReservationStatus.Open
        };

        var reservation = new Reservation
        {
            Id = reservationId,
            CustomerId = userId,
            TableId = "table-1",
            WaiterId = "waiter-1"
        };

        var sessions = new List<GuestSession>
        {
            new()
            {
                Id = "s1",
                GuestName = "Guest 1",
                GroupReservationId = groupReservationId,
                IsSubmitted = true,
                Dishes = [new() { DishId = "dish-1", Quantity = 2 }, new() { DishId = "dish-2", Quantity = 1 }]
            },
            new()
            {
                Id = "s2",
                GuestName = "Guest 2",
                GroupReservationId = groupReservationId,
                IsSubmitted = true,
                Dishes = [new() { DishId = "dish-1", Quantity = 3 }]
            },
            new()
            {
                Id = "s3",
                GuestName = "Guest 3",
                GroupReservationId = groupReservationId,
                IsSubmitted = false, // not submitted, should be ignored
                Dishes = [new() { DishId = "dish-3", Quantity = 5 }]
            }
        };

        var order = new Order
        {
            OrderId = orderId,
            CustomerId = userId,
            ReservationId = reservationId,
            ReservationAddress = "Table 1",
            ReservationTime = "Oct 14, 2025",
            Status = OrderStatus.Created,
            Dishes = []
        };

        _groupReservationRepositoryMock.Setup(r => r.GetGroupReservationByIdAsync(groupReservationId))
            .ReturnsAsync(groupReservation);
        _reservationRepositoryMock.Setup(r => r.GetReservationByIdAsync(reservationId))
            .ReturnsAsync(reservation);
        _guestSessionRepositoryMock.Setup(r => r.GetAllByGroupReservationIdAsync(groupReservationId))
            .ReturnsAsync(sessions);
        _orderRepositoryMock.Setup(r => r.GetOrderByReservationIdAsync(reservationId))
            .ReturnsAsync(order);

        var result = await _service.SubmitGroupPreOrderAsync(userId, groupReservationId, new SubmitGroupPreOrderRequest { ReservationId = reservationId });

        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
        var dish1 = result.First(d => d.DishId == "dish-1");
        var dish2 = result.First(d => d.DishId == "dish-2");
        Assert.Equal(5, dish1.Quantity);
        Assert.Equal(1, dish2.Quantity);

        Assert.Equal(OrderStatus.SubmittedByCustomer, order.Status);
        Assert.Equal(GroupReservationStatus.Submitted, groupReservation.Status);

        _orderRepositoryMock.Verify(r => r.SaveOrderAsync(It.Is<Order>(o => o.Status == OrderStatus.SubmittedByCustomer && o.Dishes.Count == 2)), Times.Once);
        _groupReservationRepositoryMock.Verify(r => r.SaveGroupReservationAsync(It.Is<GroupReservation>(g => g.Status == GroupReservationStatus.Submitted)), Times.Once);
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_NotOwner_ThrowsActionForbiddenException()
    {
        var groupReservation = new GroupReservation
        {
            GroupReservationId = "g1",
            ReservationId = "r1",
            ReservationToken = "tok"
        };
        var reservation = new Reservation
        {
            Id = "r1",
            CustomerId = "owner-999",
            TableId = "tbl-1",
            WaiterId = "w-1"
        };

        _groupReservationRepositoryMock.Setup(r => r.GetGroupReservationByIdAsync("g1")).ReturnsAsync(groupReservation);
        _reservationRepositoryMock.Setup(r => r.GetReservationByIdAsync("r1")).ReturnsAsync(reservation);

        await Assert.ThrowsAsync<ActionForbiddenException>(() =>
            _service.SubmitGroupPreOrderAsync("stranger", "g1", new SubmitGroupPreOrderRequest { ReservationId = "r1" }));
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_NoSubmittedSessions_ThrowsValidationException()
    {
        var groupReservation = new GroupReservation
        {
            GroupReservationId = "g1",
            ReservationId = "r1",
            ReservationToken = "tok"
        };
        var reservation = new Reservation
        {
            Id = "r1",
            CustomerId = "u1",
            TableId = "tbl-1",
            WaiterId = "w-1"
        };

        _groupReservationRepositoryMock.Setup(r => r.GetGroupReservationByIdAsync("g1")).ReturnsAsync(groupReservation);
        _reservationRepositoryMock.Setup(r => r.GetReservationByIdAsync("r1")).ReturnsAsync(reservation);
        _guestSessionRepositoryMock.Setup(r => r.GetAllByGroupReservationIdAsync("g1")).ReturnsAsync(new List<GuestSession>());

        await Assert.ThrowsAsync<ValidationException>(() =>
            _service.SubmitGroupPreOrderAsync("u1", "g1", new SubmitGroupPreOrderRequest { ReservationId = "r1" }));
    }
}
