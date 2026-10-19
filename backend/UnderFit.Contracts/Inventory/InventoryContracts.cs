namespace UnderFit.Contracts.Inventory;

public sealed record SaveProductRequest(string Nombre, decimal Precio, bool Activo = true, bool? AvailableLocal1 = null, bool? AvailableLocal2 = null);
public sealed record ProductResponse(int Id, string Nombre, decimal Precio, bool Activo, bool AvailableLocal1 = true, bool AvailableLocal2 = true);
public sealed record UpdateProductResponse(bool Success, int Changes, ProductResponse Product);
public sealed record DeleteProductResponse(bool Success, int Changes);
public sealed record ProductPaymentRequest(
    decimal? Monto, string? FormaPago, decimal? MontoRecibido, string? Observacion);
public sealed record SellProductRequest(int? Id, int? Quantity, ProductPaymentRequest? Payment);
public sealed record ProductSaleResponse(
    int Id, int ProductoId, string Nombre, int Cantidad, decimal Total,
    DateOnly Fecha, TimeOnly Hora, DateTimeOffset Ts, string FormaPago,
    decimal MontoRecibido, decimal Cambio, string? Observacion);
public sealed record SellProductResponse(
    bool Success, ProductResponse Product, ProductSaleResponse Sale, object MovimientoCaja);
public sealed record ProductSalesTotalResponse(decimal Total);
public sealed record CreatePendingSaleRequest(
    int ProductoId, string UsuarioCi, int Cantidad, int ProfesorSesionId,
    int? LocalId, string? Observacion);
public sealed record PendingSaleResponse(
    int Id, int LocalId, string LocalNombre, int ProductoId, string ProductoNombre,
    string UsuarioCi, string UsuarioNombre, int Cantidad, decimal Total,
    string Profesor, int ProfesorId, int? ProfesorSesionId, DateOnly Fecha,
    TimeOnly Hora, DateTimeOffset Ts, string Estado, DateTimeOffset? CobradoTs,
    string? FormaPago, Guid? CajaMovimientoId, string? Observacion);
public sealed record PendingSalesSummaryResponse(int Cantidad, decimal Total);
public sealed record CollectPendingSaleRequest(string? FormaPago, string? Observacion);
public sealed record CollectPendingSaleResponse(int SaleId, object Movement);
