using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Sales.Categories;

// ---- Nhóm khách hàng -------------------------------------------------------------------------------------------------------------

public sealed record CustomerGroupDto(string Code, string Name, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveCustomerGroupRequest(string Code, string Name, string? Note = null, bool IsActive = true,
    uint? Version = null) : ICatalogRequest;

public interface ICustomerGroupService : ICatalogService<CustomerGroupDto, SaveCustomerGroupRequest>;

// ---- Khách hàng ------------------------------------------------------------------------------------------------------------------

/// <summary>CreditLimit = hạn mức công nợ in the base currency, 0 = no limit.</summary>
public sealed record CustomerDto(string Code, string Name, string? TaxCode, string? Phone, string? Email, string? ContactName,
    string? Address, string? CustomerGroupCode, string? CustomerGroupName, string? PaymentTermCode, string? PaymentTermName,
    decimal CreditLimit, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveCustomerRequest(string Code, string Name, string? TaxCode = null, string? Phone = null, string? Email = null,
    string? ContactName = null, string? Address = null, string? CustomerGroupCode = null, string? PaymentTermCode = null,
    decimal CreditLimit = 0, string? Note = null, bool IsActive = true, uint? Version = null) : ICatalogRequest;

public interface ICustomerService : ICatalogService<CustomerDto, SaveCustomerRequest>;

// ---- Bảng giá bán ----------------------------------------------------------------------------------------------------------------

/// <summary>A price of a price list: the material in a unit, from MinQuantity on (0 = from the first unit).</summary>
public sealed record PriceListLineDto(string MaterialCode, string? MaterialName, string UomCode, decimal MinQuantity, decimal UnitPrice, string? Note);

public sealed record SavePriceListLine(string MaterialCode, string UomCode, decimal MinQuantity, decimal UnitPrice, string? Note = null);

/// <summary>A list page carries the number of lines only; the form reads the lines of one price list from <see cref="IPriceListService.GetLinesAsync"/>.</summary>
public sealed record PriceListDto(string Code, string Name, string CurrencyCode, string? CustomerGroupCode, string? CustomerGroupName,
    DateOnly ValidFrom, DateOnly? ValidTo, string? Note, bool IsActive, int LineCount, RecordStampDto Stamp, uint Version);

/// <summary>Lines = null keeps the saved ones (an Excel import carries the header only).</summary>
public sealed record SavePriceListRequest(string Code, string Name, string CurrencyCode, DateOnly ValidFrom, DateOnly? ValidTo = null,
    string? CustomerGroupCode = null, string? Note = null, bool IsActive = true, uint? Version = null,
    IReadOnlyList<SavePriceListLine>? Lines = null) : ICatalogRequest;

/// <summary>The price a customer pays for a material in a unit on a day (see <see cref="IPriceListService.ResolveAsync"/>).</summary>
public sealed record ResolvedPriceDto(string PriceListCode, string PriceListName, string CurrencyCode, string UomCode,
    decimal MinQuantity, decimal UnitPrice);

public interface IPriceListService : ICatalogService<PriceListDto, SavePriceListRequest>
{
    /// <summary>The lines (prices) of one price list, by material, unit and quantity step.</summary>
    Task<IReadOnlyList<PriceListLineDto>> GetLinesAsync(string code, CancellationToken ct);

    /// <summary>
    /// The price of a material in a unit for a customer, in a currency, on a day (default today), for a quantity: among the active price
    /// lists of that currency valid that day, the ones of the customer's group come before the general ones, then the latest start, and
    /// the line with the highest "from quantity" not above the quantity wins. Null when no price list gives a price.
    /// </summary>
    Task<ResolvedPriceDto?> ResolveAsync(string? customerCode, string materialCode, string uomCode, string currencyCode,
        DateOnly? date, decimal quantity, CancellationToken ct);
}
