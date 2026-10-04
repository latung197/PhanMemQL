namespace Core.Application.Modules.Inventory.Documents.GoodsReceipts;

public sealed record GoodsReceiptLineDto(long Id, string Kind, string ProductCode, string ProductName,
    string Unit, decimal Quantity, decimal UnitPrice, decimal Amount, string? LotNumber, string? Position);

public sealed record SaveGoodsReceiptLine(string Kind, string ProductCode, string ProductName,
    string Unit, decimal Quantity, decimal UnitPrice, string? LotNumber, string? Position);

public sealed record GoodsReceiptDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate,
    string UnitCode, string UnitName, string WarehouseCode, string WarehouseName, string VoucherType,
    string CurrencyCode, decimal ExchangeRate, string? SupplierName, string? DelivererName,
    string? Note, string Status, decimal TotalValue, string CreatedBy, string? ApprovedBy,
    IReadOnlyList<GoodsReceiptLineDto> Items, IReadOnlyList<GoodsReceiptLineDto> MaterialItems, uint Version);

public sealed record SaveGoodsReceiptRequest(DateOnly Date, string WarehouseCode, string VoucherType,
    string CurrencyCode, decimal ExchangeRate, string? SupplierName, string? DelivererName,
    string? Note, IReadOnlyList<SaveGoodsReceiptLine> Items,
    IReadOnlyList<SaveGoodsReceiptLine>? MaterialItems, uint? Version = null);

public sealed record GoodsReceiptOption(string Code, string Name);
public sealed record GoodsReceiptOptionsDto(IReadOnlyList<GoodsReceiptOption> Warehouses,
    IReadOnlyList<GoodsReceiptOption> Currencies);

public interface IGoodsReceiptService
{
    Task<IReadOnlyList<GoodsReceiptDto>> GetAllAsync(int userId, string unitCode, CancellationToken ct);
    Task<GoodsReceiptOptionsDto> GetOptionsAsync(CancellationToken ct);
    Task<GoodsReceiptDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<GoodsReceiptDto> CreateAsync(int userId, string unitCode, SaveGoodsReceiptRequest request, CancellationToken ct);
    Task<GoodsReceiptDto> UpdateAsync(int userId, string unitCode, long id, SaveGoodsReceiptRequest request, CancellationToken ct);
    Task<GoodsReceiptDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<GoodsReceiptDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);
}
