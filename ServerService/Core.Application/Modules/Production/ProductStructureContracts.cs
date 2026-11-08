using Core.Application.Common.Paging;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Production;

/// <summary>
/// List of the product structures: <c>Search</c> matches the product code and name; with <c>Mode = "parent"</c> (tìm mẹ - con) it matches the
/// components instead, so the result is the products that contain the searched material. <c>Status</c> = "active" or "inactive".
/// </summary>
public sealed record ProductStructureListQuery(int Page = 1, int PageSize = 50, string? Sort = null, string? Dir = null, string? Search = null,
    string? Mode = null, string? Status = null) : IPagedQuery;

/// <param name="HasChildren">At least one component has a structure of its own (the tree can be opened).</param>
public sealed record ProductStructureListItemDto(string MaterialCode, string MaterialName, string UomCode, int LineCount, bool HasChildren, bool IsActive);

/// <param name="HasStructure">The component has a structure of its own.</param>
public sealed record ProductStructureLineDto(int LineNo, string ComponentMaterialCode, string? ComponentMaterialName, string UomCode,
    string? ProductionOperationCode, string? ProductionOperationName, decimal Quantity, decimal ScrapPercent, string? Note, bool HasStructure);

public sealed record ProductStructureDto(string MaterialCode, string MaterialName, string UomCode, string? Note, bool IsActive,
    RecordStampDto Stamp, uint Version, IReadOnlyList<ProductStructureLineDto> Lines);

/// <summary>A component line; an empty unit takes the base unit of the material, the unit must be that or a converted one.</summary>
public sealed record SaveProductStructureLineRequest(string ComponentMaterialCode, decimal Quantity, string? UomCode = null,
    string? ProductionOperationCode = null, decimal ScrapPercent = 0, string? Note = null);

/// <param name="MaterialCode">The product (used by create; the route gives it on update).</param>
public sealed record SaveProductStructureRequest(string MaterialCode, IReadOnlyList<SaveProductStructureLineRequest> Lines, string? Note = null,
    bool IsActive = true, uint? Version = null);

public interface IProductStructureService
{
    Task<PagedResult<ProductStructureListItemDto>> ListAsync(ProductStructureListQuery query, CancellationToken ct);
    Task<ProductStructureDto> GetAsync(string materialCode, CancellationToken ct);
    Task<ProductStructureDto> CreateAsync(SaveProductStructureRequest request, CancellationToken ct);
    Task<ProductStructureDto> UpdateAsync(string materialCode, SaveProductStructureRequest request, CancellationToken ct);
    Task DeleteAsync(string materialCode, CancellationToken ct);
}
