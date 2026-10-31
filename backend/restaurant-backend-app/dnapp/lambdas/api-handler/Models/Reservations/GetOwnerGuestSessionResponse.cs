using System.Text.Json.Serialization;

namespace APIHandler.Models.Reservations;

public record GetOwnerGuestSessionResponse(
    [property: JsonPropertyName("guestSessionId")] string GuestSessionId
);

