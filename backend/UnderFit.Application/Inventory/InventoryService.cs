using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Contracts.Inventory;
using UnderFit.Domain.Inventory;
using UnderFit.Domain.Cash;

namespace UnderFit.Application.Inventory;

public sealed class InventoryService(IUnderFitDataStore dataStore, TimeProvider timeProvider)
{
    public async Task<IReadOnlyList<ProductResponse>> ListProductsAsync(CancellationToken ct) =>
        (await dataStore.ListProductsAsync(ct)).Select(Map).ToArray();

    public async Task<ProductResponse> CreateProductAsync(SaveProductRequest request, CancellationToken ct)
    {
        var product = new Product(request.Nombre, request.Precio, request.Activo);
        dataStore.AddProduct(product);
        await dataStore.SaveChangesAsync(ct);
        return Map(product);
    }

    public async Task<UpdateProductResponse> UpdateProductAsync(
        int id, SaveProductRequest request, CancellationToken ct)
    {
        var product = await RequireProductAsync(id, ct);
        product.Update(request.Nombre, request.Precio, request.Activo);
        await dataStore.SaveChangesAsync(ct);
        return new(true, 1, Map(product));
    }

    public async Task<DeleteProductResponse> DeleteProductAsync(int id, CancellationToken ct)
    {
        var product = await dataStore.FindProductAsync(id, ct);
        if (product is null) return new(true, 0);
        dataStore.RemoveProduct(product);
        await dataStore.SaveChangesAsync(ct);
        return new(true, 1);
    }

    public async Task<SellProductResponse> SellProductAsync(
        int id, SellProductRequest request, CancellationToken ct)
    {
        var quantity = request.Quantity ?? 1;
        if (quantity <= 0) throw new UseCaseException("product.quantity_invalid", "Cantidad invalida");
        var product = await RequireProductAsync(id, ct);
        if (!product.IsActive)
            throw new UseCaseException("product.inactive", "El producto no esta disponible");
        var total = product.Price * quantity;
        var paymentMethod = NormalizePaymentMethod(request.Payment?.FormaPago);
        var amount = request.Payment?.Monto ?? total;
        if (amount < 0) throw new UseCaseException("payment.amount_invalid", "Monto invalido");
        var now = timeProvider.GetUtcNow();
        var localNow = TimeZoneInfo.ConvertTime(now, timeProvider.LocalTimeZone);
        var businessDate = DateOnly.FromDateTime(localNow.DateTime);
        var cashSession = await dataStore.FindOpenCashSessionAsync(ct)
            ?? throw new UseCaseException("cash.not_open", "No hay una caja abierta");
        if (cashSession.BusinessDate != businessDate)
            throw new UseCaseException("cash.date_conflict", "La caja abierta no corresponde al dia actual");

        var sale = new ProductSale(
            product, quantity, total, paymentMethod, amount, 0,
            request.Payment?.Observacion, now);
        dataStore.AddProductSale(sale);
        CashMovement? movement = null;
        if (amount > 0)
        {
            movement = CashMovement.ProductSale(
                cashSession.Id, amount, paymentMethod, product.Name,
                request.Payment?.Observacion, now);
            dataStore.AddCashMovement(movement);
        }
        await dataStore.SaveChangesAsync(ct);
        return new(
            true, Map(product), Map(sale),
            movement is null
                ? new { skipped = true }
                : (object)new {
                    id = movement.Id,
                    tipoIngreso = "venta_producto",
                    descripcion = product.Name,
                    monto = amount,
                    formaPago = paymentMethod
                });
    }

    public async Task<IReadOnlyList<ProductSaleResponse>> ListSalesAsync(DateOnly date, CancellationToken ct) =>
        (await dataStore.ListProductSalesAsync(date, ct)).Select(Map).ToArray();

    public async Task<ProductSalesTotalResponse> GetSalesTotalAsync(DateOnly date, CancellationToken ct) =>
        new((await dataStore.ListProductSalesAsync(date, ct)).Sum(x => x.Total));

    public async Task<IReadOnlyList<PendingSaleResponse>> ListPendingSalesAsync(CancellationToken ct) =>
        (await dataStore.ListPendingProductSalesAsync(ct))
            .Where(x => x.Status == PendingProductSaleStatus.Pending).Select(Map).ToArray();

    public async Task<PendingSalesSummaryResponse> GetPendingSummaryAsync(DateOnly date, CancellationToken ct)
    {
        var sales = (await dataStore.ListPendingProductSalesAsync(ct))
            .Where(x => x.Status == PendingProductSaleStatus.Pending && LocalDate(x.OccurredAtUtc) == date)
            .ToArray();
        return new(sales.Length, sales.Sum(x => x.Total));
    }

    public async Task<PendingSaleResponse> CreatePendingSaleAsync(
        CreatePendingSaleRequest request, CancellationToken ct)
    {
        if (request.Cantidad <= 0)
            throw new UseCaseException("product.quantity_invalid", "Cantidad invalida");
        var product = await RequireProductAsync(request.ProductoId, ct);
        if (!product.IsActive)
            throw new UseCaseException("product.inactive", "El producto no esta disponible");
        var member = await dataStore.FindMemberByIdentityAsync(request.UsuarioCi.Trim(), ct)
            ?? throw new UseCaseException("member.not_found", "Socio no encontrado");
        var session = await dataStore.FindActiveProfessorSessionAsync(request.ProfesorSesionId, ct)
            ?? throw new UseCaseException("staff.session_not_found", "La sesion del profesor no esta activa");
        var locationId = request.LocalId ?? session.LocationId;
        if (locationId != session.LocationId)
            throw new UseCaseException("staff.location_conflict", "La sesion no corresponde al local");
        var sale = new PendingProductSale(
            product, member.IdentityNumber, member.Name, request.Cantidad,
            session.ProfessorName, session.ProfessorId, session.Id, locationId,
            request.Observacion, timeProvider.GetUtcNow());
        dataStore.AddPendingProductSale(sale);
        await dataStore.SaveChangesAsync(ct);
        return Map(sale);
    }

    public async Task<CollectPendingSaleResponse> CollectPendingSaleAsync(
        int id, CollectPendingSaleRequest request, CancellationToken ct)
    {
        var sale = await dataStore.FindPendingProductSaleAsync(id, ct);
        if (sale is null || sale.Status != PendingProductSaleStatus.Pending)
            throw new UseCaseException("pending_sale.not_found", "El cobro ya no esta pendiente");
        var now = timeProvider.GetUtcNow();
        var businessDate = LocalDate(now);
        var cashSession = await dataStore.FindOpenCashSessionAsync(ct)
            ?? throw new UseCaseException("cash.not_open", "No hay una caja abierta");
        if (cashSession.BusinessDate != businessDate)
            throw new UseCaseException("cash.date_conflict", "La caja abierta no corresponde al dia actual");
        var paymentMethod = NormalizePaymentMethod(request.FormaPago);
        var member = await dataStore.FindMemberByIdentityAsync(sale.MemberIdentityNumber, ct);
        var note = string.IsNullOrWhiteSpace(request.Observacion)
            ? $"Cobro pendiente del Local {sale.LocationId} - {sale.Professor}"
            : request.Observacion;
        var movement = CashMovement.ProductSale(
            cashSession.Id, sale.Total, paymentMethod,
            $"{sale.ProductName} · venta pendiente Local {sale.LocationId}",
            note, now, member?.Id, sale.MemberIdentityNumber, sale.MemberName);
        dataStore.AddCashMovement(movement);
        sale.Collect(paymentMethod, movement.Id, now);
        await dataStore.SaveChangesAsync(ct);
        return new(sale.Id, new {
            id = movement.Id,
            tipoIngreso = "venta_producto",
            descripcion = movement.Description,
            monto = movement.Amount,
            formaPago = movement.PaymentMethod
        });
    }

    private async Task<Product> RequireProductAsync(int id, CancellationToken ct) =>
        await dataStore.FindProductAsync(id, ct)
        ?? throw new UseCaseException("product.not_found", "Producto no encontrado");

    private static ProductResponse Map(Product product) =>
        new(product.Id, product.Name, product.Price, product.IsActive);

    private DateTimeOffset ToLocal(DateTimeOffset value) =>
        TimeZoneInfo.ConvertTime(value, timeProvider.LocalTimeZone);

    private ProductSaleResponse Map(ProductSale sale)
    {
        var local = ToLocal(sale.OccurredAtUtc);
        return new(
            sale.Id, sale.ProductId, sale.ProductName, sale.Quantity, sale.Total,
            DateOnly.FromDateTime(local.DateTime), TimeOnly.FromDateTime(local.DateTime),
            sale.OccurredAtUtc, sale.PaymentMethod, sale.ReceivedAmount, sale.Change, sale.Note);
    }

    private PendingSaleResponse Map(PendingProductSale sale)
    {
        var local = ToLocal(sale.OccurredAtUtc);
        return new(
            sale.Id, sale.LocationId, sale.LocationId == 1 ? "Local 1" : "Local 2",
            sale.ProductId, sale.ProductName, sale.MemberIdentityNumber, sale.MemberName,
            sale.Quantity, sale.Total, sale.Professor, sale.ProfessorId, sale.ProfessorSessionId,
            DateOnly.FromDateTime(local.DateTime), TimeOnly.FromDateTime(local.DateTime),
            sale.OccurredAtUtc, sale.Status == PendingProductSaleStatus.Pending ? "pendiente" : "cobrada",
            sale.CollectedAtUtc, sale.PaymentMethod, sale.CashMovementId, sale.Note);
    }

    private DateOnly LocalDate(DateTimeOffset value) =>
        DateOnly.FromDateTime(ToLocal(value).DateTime);

    private static string NormalizePaymentMethod(string? value)
    {
        var method = string.IsNullOrWhiteSpace(value) ? "efectivo" : value.Trim().ToLowerInvariant();
        if (method == "tarjeta") method = "transferencia";
        if (method is not ("efectivo" or "transferencia"))
            throw new UseCaseException("payment.method_invalid", "Forma de pago obligatoria");
        return method;
    }
}
