using Core.Application.Modules.Accounts;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Accounts;

/// <summary>Tài chính › Hệ thống tài khoản kế toán. The endpoints come from CatalogControllerBase.</summary>
[Route("api/finance/accounts")]
[CatalogFunction("fin_account_cat")]
public sealed class AccountsController(IAccountService accounts, IPermissionService permissions)
    : CatalogControllerBase<AccountDto, SaveAccountRequest>(accounts, permissions);
