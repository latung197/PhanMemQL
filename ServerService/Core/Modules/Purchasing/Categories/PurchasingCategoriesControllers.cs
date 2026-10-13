using Core.Application.Modules.Purchasing.Categories;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Purchasing.Categories;

/// <summary>Mua hàng › Danh mục dự án. The endpoints come from CatalogControllerBase; other screens pick a project with the lookup
/// (GET /api/lookups/projects).</summary>
[Route("api/purchasing/projects")]
[CatalogFunction("pur_project_cat")]
public sealed class ProjectsController(IProjectService projects, IPermissionService permissions)
    : CatalogControllerBase<ProjectDto, SaveProjectRequest>(projects, permissions);

/// <summary>Mua hàng › Danh mục điều khoản thanh toán (lookup <c>paymentTerms</c>).</summary>
[Route("api/purchasing/payment-terms")]
[CatalogFunction("pur_payment_term_cat")]
public sealed class PaymentTermsController(IPaymentTermService terms, IPermissionService permissions)
    : CatalogControllerBase<PaymentTermDto, SavePaymentTermRequest>(terms, permissions);

/// <summary>Mua hàng › Danh mục nhóm nhà cung cấp (lookup <c>supplierGroups</c>).</summary>
[Route("api/purchasing/supplier-groups")]
[CatalogFunction("pur_supplier_group_cat")]
public sealed class SupplierGroupsController(ISupplierGroupService groups, IPermissionService permissions)
    : CatalogControllerBase<SupplierGroupDto, SaveSupplierGroupRequest>(groups, permissions);
