namespace Core.Application.Modules.Inventory.Documents.GoodsIssues;

public sealed record GoodsIssueLineDto(long Id, string Kind, string MaterialCode, string MaterialName,
    string UomCode, decimal Quantity, decimal UnitPrice, decimal Amount, string? LotNumber, string? Position);

/// <summary>A line: the material and unit are codes of the catalogs; the name is taken from the material when saved.</summary>
public sealed record SaveGoodsIssueLine(string Kind, string MaterialCode,
    string UomCode, decimal Quantity, decimal UnitPrice, string? LotNumber, string? Position);

public sealed record GoodsIssueDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate,
    string UnitCode, string UnitName, string WarehouseCode, string WarehouseName, string VoucherType,
    string CurrencyCode, decimal ExchangeRate, string? CustomerName, string? ReceiverName,
    string? Note, string Status, decimal TotalValue, string CreatedBy, string? ApprovedBy,
    IReadOnlyList<GoodsIssueLineDto> Items, IReadOnlyList<GoodsIssueLineDto> MaterialItems, uint Version);

public sealed record SaveGoodsIssueRequest(DateOnly Date, string WarehouseCode, string VoucherType,
    string CurrencyCode, decimal ExchangeRate, string? CustomerName, string? ReceiverName,
    string? Note, IReadOnlyList<SaveGoodsIssueLine> Items,
    IReadOnlyList<SaveGoodsIssueLine>? MaterialItems, uint? Version = null);

public sealed record GoodsIssueOption(string Code, string Name);
public sealed record GoodsIssueOptionsDto(IReadOnlyList<GoodsIssueOption> Warehouses,
    IReadOnlyList<GoodsIssueOption> Currencies);

public interface IGoodsIssueService
{
    Task<IReadOnlyList<GoodsIssueDto>> GetAllAsync(int userId, string unitCode, CancellationToken ct);
    /// <summary>Warehouses the company unit may use (shared ones included) and the active currencies.</summary>
    Task<GoodsIssueOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct);
    Task<GoodsIssueDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<GoodsIssueDto> CreateAsync(int userId, string unitCode, SaveGoodsIssueRequest request, CancellationToken ct);
    Task<GoodsIssueDto> UpdateAsync(int userId, string unitCode, long id, SaveGoodsIssueRequest request, CancellationToken ct);
    Task<GoodsIssueDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<GoodsIssueDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);
}
