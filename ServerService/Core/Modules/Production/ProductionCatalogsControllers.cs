using Core.Application.Modules.Production;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Production;

/// <summary>Sản xuất › Danh mục quy trình sản xuất (lookup <c>productionProcesses</c>).</summary>
[Route("api/production/processes")]
[CatalogFunction("prod_process_cat")]
public sealed class ProductionProcessesController(IProductionProcessService processes, IPermissionService permissions)
    : CatalogControllerBase<ProductionProcessDto, SaveProductionProcessRequest>(processes, permissions);

/// <summary>Sản xuất › Danh mục tổ sản xuất (lookup <c>productionTeams</c>).</summary>
[Route("api/production/teams")]
[CatalogFunction("prod_team_cat")]
public sealed class ProductionTeamsController(IProductionTeamService teams, IPermissionService permissions)
    : CatalogControllerBase<ProductionTeamDto, SaveProductionTeamRequest>(teams, permissions);

/// <summary>Sản xuất › Danh mục công đoạn sản xuất (lookup <c>productionOperations</c>).</summary>
[Route("api/production/operations")]
[CatalogFunction("prod_operation_cat")]
public sealed class ProductionOperationsController(IProductionOperationService operations, IPermissionService permissions)
    : CatalogControllerBase<ProductionOperationDto, SaveProductionOperationRequest>(operations, permissions);
