using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Production;

/// <summary>One step of a process; the operation name and its team are read from the operation catalog.</summary>
public sealed record ProductionProcessLineDto(int LineNo, string OperationCode, string? OperationName, string? TeamCode, string? TeamName);

/// <param name="UnitCodes">Company units the process applies to; empty = every unit.</param>
/// <param name="EffectiveTo">Last day in force; null = no end date.</param>
public sealed record ProductionProcessDto(string Code, string Name, string? NameEn, DateOnly EffectiveFrom, DateOnly? EffectiveTo, string? Note,
    bool IsActive, RecordStampDto Stamp, uint Version, IReadOnlyList<string> UnitCodes, IReadOnlyList<ProductionProcessLineDto> Lines);

/// <param name="UnitCodes">Unit codes separated by comma or semicolon (also the form of an Excel cell); null keeps the units the process
/// has, an empty text makes it apply to every unit.</param>
/// <param name="OperationCodes">Operation codes in order, separated by comma or semicolon (also the form of an Excel cell); null keeps the
/// steps the process has, a new process needs at least one.</param>
public sealed record SaveProductionProcessRequest(string Code, string Name, DateOnly EffectiveFrom, string? NameEn = null, DateOnly? EffectiveTo = null,
    string? Note = null, bool IsActive = true, uint? Version = null, string? UnitCodes = null, string? OperationCodes = null) : ICatalogRequest;

/// <summary>The catalog of processes on ICatalogService (paged list with the filters <c>unit=</c> and <c>operation=</c>).</summary>
public interface IProductionProcessService : ICatalogService<ProductionProcessDto, SaveProductionProcessRequest>;
