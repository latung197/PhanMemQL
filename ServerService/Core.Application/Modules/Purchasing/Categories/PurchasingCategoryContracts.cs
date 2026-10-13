using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Purchasing.Categories;

// ---- Dự án ---------------------------------------------------------------------------------------------------------------------

public sealed record ProjectDto(string Code, string Name, string? DepartmentCode, string? DepartmentName, string? CustomerName,
    string? ManagerName, DateOnly? StartDate, DateOnly? EndDate, decimal Budget, string Status, string? Note, bool IsActive,
    RecordStampDto Stamp, uint Version);

/// <summary>Status is PLANNING, ACTIVE, ONHOLD, DONE or CANCELLED; Budget is in the base currency.</summary>
public sealed record SaveProjectRequest(string Code, string Name, string? DepartmentCode = null, string? CustomerName = null,
    string? ManagerName = null, DateOnly? StartDate = null, DateOnly? EndDate = null, decimal Budget = 0, string Status = "ACTIVE",
    string? Note = null, bool IsActive = true, uint? Version = null) : ICatalogRequest;

/// <summary>The catalog of projects on ICatalogService (paged list with the filters <c>projectStatus=</c> and <c>department=</c>).</summary>
public interface IProjectService : ICatalogService<ProjectDto, SaveProjectRequest>;

// ---- Điều khoản thanh toán -------------------------------------------------------------------------------------------------------

public sealed record PaymentTermDto(string Code, string Name, int Days, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SavePaymentTermRequest(string Code, string Name, int Days = 0, string? Note = null, bool IsActive = true,
    uint? Version = null) : ICatalogRequest;

public interface IPaymentTermService : ICatalogService<PaymentTermDto, SavePaymentTermRequest>;

// ---- Nhóm nhà cung cấp -----------------------------------------------------------------------------------------------------------

public sealed record SupplierGroupDto(string Code, string Name, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveSupplierGroupRequest(string Code, string Name, string? Note = null, bool IsActive = true,
    uint? Version = null) : ICatalogRequest;

public interface ISupplierGroupService : ICatalogService<SupplierGroupDto, SaveSupplierGroupRequest>;
