using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Production;

// ---- Tổ sản xuất -----------------------------------------------------------------------------------------------------------------

public sealed record ProductionTeamDto(string Code, string Name, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveProductionTeamRequest(string Code, string Name, string? Note = null, bool IsActive = true,
    uint? Version = null) : ICatalogRequest;

public interface IProductionTeamService : ICatalogService<ProductionTeamDto, SaveProductionTeamRequest>;

// ---- Công đoạn sản xuất ----------------------------------------------------------------------------------------------------------

/// <summary>NameEn is the second name ("Tên 2"); the team name is read from the team catalog.</summary>
public sealed record ProductionOperationDto(string Code, string Name, string? NameEn, string? ProductionTeamCode, string? ProductionTeamName,
    bool RequireMachine, bool IsHeavy, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveProductionOperationRequest(string Code, string Name, string? NameEn = null, string? ProductionTeamCode = null,
    bool RequireMachine = false, bool IsHeavy = false, string? Note = null, bool IsActive = true, uint? Version = null) : ICatalogRequest;

/// <summary>The catalog of operations on ICatalogService (paged list with the filter <c>team=</c>, a team code).</summary>
public interface IProductionOperationService : ICatalogService<ProductionOperationDto, SaveProductionOperationRequest>;
