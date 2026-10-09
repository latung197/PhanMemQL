using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.TaxRates;

public sealed record TaxRateDto(string Code, string Name, string TaxType, decimal Rate, bool IsExempt, string? Note, bool IsActive,
    RecordStampDto Stamp, uint Version);

/// <summary>TaxType is VAT, IMPORT or OTHER; Rate is a percent (0 to 100); an exempt tax has no rate (0).</summary>
public sealed record SaveTaxRateRequest(string Code, string Name, string TaxType, decimal Rate, bool IsExempt, string? Note,
    bool IsActive = true, uint? Version = null) : ICatalogRequest;

/// <summary>The catalog of tax rates on ICatalogService (paged list with the filter <c>type=VAT</c>, export, create, update, delete, import).</summary>
public interface ITaxRateService : ICatalogService<TaxRateDto, SaveTaxRateRequest>;
