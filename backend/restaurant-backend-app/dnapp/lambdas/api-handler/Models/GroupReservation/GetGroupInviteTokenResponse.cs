using System.Text.Json.Serialization;

namespace APIHandler.Models.GroupReservation;

public record GetGroupInviteTokenResponse(
    [property: JsonPropertyName("token")] string Token
);
