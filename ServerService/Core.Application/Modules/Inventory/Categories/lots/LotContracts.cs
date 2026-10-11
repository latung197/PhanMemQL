using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

/// <param name="ExpiryState">none (no expiry date), ok, near (expires within <see cref="LotRules.NearExpiryDays"/> days) or expired, as of today.</param>
public sealed record LotDto(string Code, string MaterialCode, string? MaterialName, string LotNo, DateOnly? MfgDate,
    DateOnly? ExpDate, string? SupplierCode, string? SupplierName, string QualityStatus, string ExpiryState, string? Note,
    bool IsActive, RecordStampDto Stamp, uint Version);

/// <summary>
/// A lot of one material. Its catalog code is derived (<c>VT001@LOT-2610</c>): the material and the lot number cannot be
/// changed on a saved lot; to correct them, delete the lot and add a new one. <c>QualityStatus</c> is PASSED, INSPECT or BLOCKED.
/// </summary>
public sealed record SaveLotRequest(string MaterialCode, string LotNo, DateOnly? MfgDate = null, DateOnly? ExpDate = null,
    string? SupplierCode = null, string QualityStatus = "PASSED", string? Note = null, bool IsActive = true,
    uint? Version = null) : ICatalogRequest
{
    public string Code => LotKey.Of(MaterialCode, LotNo);
}

/// <summary>The catalog code of a lot: "VT001@LOT-2610".</summary>
public static class LotKey
{
    public static string Of(string? materialCode, string? lotNo) =>
        $"{(materialCode ?? string.Empty).Trim().ToUpperInvariant()}@{(lotNo ?? string.Empty).Trim().ToUpperInvariant()}";
}

public static class LotRules
{
    /// <summary>A lot expiring within this many days is shown as "near".</summary>
    public const int NearExpiryDays = 30;
}

/// <summary>Lots on ICatalogService (list with the filters <c>materialCode</c>, <c>quality</c> and <c>expiry=near|expired</c>, export, create, update, delete, import).</summary>
public interface ILotService : ICatalogService<LotDto, SaveLotRequest>;
