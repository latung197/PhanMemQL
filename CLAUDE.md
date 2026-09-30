# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

S-ERP: a Vietnamese ERP made of two apps plus user docs.

- `Frontend/`: React 19 + TypeScript, Vite 6, Tailwind v4, served by an Express dev server (`server.ts`) on `http://localhost:3000`. `server.ts` also hosts `/api/gemini/analyze` (AI assistant, needs `GEMINI_API_KEY`).
- `ServerService/`: .NET 10 Web API (EF Core + Dapper, PostgreSQL) on `http://localhost:2512`.
- `docs/`: end-user docs (Word).

**The frontend is the source of truth.** Function codes, data shapes and API response types follow `Frontend/src/types/index.ts` (`UserProfile`, `RoleDefinition`, `ActionPermissions`, `CompanyUnit`, `SystemNotification`) and the settings sections in `Frontend/src/services/systemSettingsService.ts`. The backend adapts to match.

UI text, error messages (`{ message }` from the API) and docs are written in **Vietnamese**.

## Commands

Frontend (run in `Frontend/`; there is no JS test runner or linter beyond `tsc`):

```bash
npm run dev          # tsx server.ts → http://localhost:3000 (Vite middleware mode)
npm run lint         # tsc --noEmit (type check)
npm run build        # vite build + bundle server.ts to dist/server.cjs
npm run export-seed  # regenerate ../ServerService/Core/SeedData/seed.json from src/mock
npm run check-policy # check utils/documentPolicy.ts against the backend test cases
```

`.env.local` (copy from `.env.example`): `VITE_API_URL` (defaults to `http://localhost:2512`), `GEMINI_API_KEY`.

Backend (run in `ServerService/`; xUnit tests):

```bash
dotnet build Core.sln
dotnet test tests/Core.Tests/Core.Tests.csproj
dotnet test tests/Core.Tests/Core.Tests.csproj --filter "FullyQualifiedName~PermissionMatrixTests"
dotnet run --project Core/Core.csproj --urls http://localhost:2512   # set ASPNETCORE_ENVIRONMENT=Development
```

Local secrets live in `ServerService/Core/appsettings.Local.json` (gitignored): `ConnectionStrings:CoreContext`, `Tokens:Key` (≥32 chars), `Seed:DemoData`, `Seed:DefaultPassword`, `Seed:AdminPassword` (Development only; resets `admin`'s password on every start).

Database: run every script in `ServerService/sql/postgresql/` **in filename order** (`00-helpers.sql` first; `psql` may not be on PATH, e.g. `C:\Program Files\PostgreSQL\16\bin`). Scripts are idempotent and also migrate older data. There are no EF migrations; schema changes go into a new or existing `NN-*.sql` script.

`.claude/launch.json` defines `backend` (port 2512, Development) and `frontend` (port 3000) for the preview tools.

## Architecture

### Frontend ↔ backend split (what is real vs. mock)

- **Backend-backed:** login/JWT, users, roles, permission matrix, special rights, company units (DVCS), departments, currencies + exchange rates, month locks per unit, voucher number series, JSON settings (defaults, fiscal year, company profile, number format) with backup/restore, notifications (incl. SSE realtime), approval rules.
- **Still browser mock data:** materials, warehouses, goods receipts/issues, sales, finance, HR, reports. Lives in `Frontend/src/mock/` and is persisted to `localStorage['s_erp_database_state']`, loaded in `App.tsx`.
- Approval workflow endpoints (`/api/approvals/{fn}/{id}/submit|approve|reject|withdraw`) exist on the backend but the frontend does not call them yet.

When turning a mock feature into a real one, add the backend module, add `api.ts` in the feature folder calling `apiRequest`, and remove that screen's mock data.

### Function codes tie everything together

A `SubMenuKey` (e.g. `inv_receipt`) is the shared key for menu, route, permissions, notifications and approvals. A new function is declared in:
- Frontend: `src/types/index.ts` (`SubMenuKey`) and **`src/config/functions.ts`** (`FUNCTION_REGISTRY`: category, hash path, label, kind — typed `Record<SubMenuKey, …>`, so a missing entry is a compile error). Routes (`config/router.ts`), breadcrumbs (`utils/navigationHelper.ts`) and the permission matrix (`permissions/permissionCatalog.ts`) are derived from it. Then a sidebar item in `src/mock/initialMenuData.ts` (static, not cached) and a `case` in the parent `*Module.tsx` (Settings: `TABS` + `renderScreen` in `SettingsModule.tsx`).
- Backend: `Core.Application/Common/Permissions/FunctionCatalog.cs` (API auto-inserts missing codes into `sys_command` on startup). Vouchers also go in `Common/Documents/VoucherCatalog.cs`, which gives them a number series, the voucher special rights and a place in approval rules.
- Always navigate with `navigateTo` / `openFunction` in `App.tsx` (keeps the URL hash in sync); never set the active sub-menu state directly.

### Permissions

- Each function has 5 actions: `view / createEdit / delete / approve / printExport`. Special rights are `{function}:{CODE}` (e.g. `inv_receipt:VIEW_PRICE`), declared in `SpecialRightCatalog.cs`.
- Effective rights = **role + exceptions** (`PermissionMatrix.Resolve` / `ResolveRights`): admin (role `ADMIN` or legacy `auth_fl` containing `0`) has everything; otherwise the combined role matrix, where each `sys_user_command` row replaces that one function, and role special rights plus `sys_user_right` rows with `is_granted` true, minus those with false. The permission screen sends the full wanted matrix; the backend stores only the differences (`PermissionMatrix.Overrides` / `RightOverrides`). DB tables still store 11 legacy flags; `CommandPermission` converts both ways.
- Document status rules: `DocumentStatusPolicy.cs` (backend) and its mirror `Frontend/src/utils/documentPolicy.ts`; both are checked against `ServerService/tests/Core.Tests/Common/DocumentPolicyCases.json` (`dotnet test`, `npm run check-policy`). Change them together.
- Backend: controllers inherit `ApiControllerBase` (requires auth + access to the token's company unit) and use `[RequirePermission("code", PermissionAction.X)]` / `[RequireRight(...)]`. `GrantGuard` prevents non-admins granting rights they don't hold. `DocumentStatusPolicy` decides allowed actions per document status.
- Frontend: `utils/permissions.ts` (`canView`, `hasRight`, `getActionPermission`, also re-exported from `mock/initialRoles`). Frontend checks are display-only.
- Changing lock/password bumps `security_version`, invalidating existing JWTs. The JWT carries the active company unit; `POST /api/auth/switch-unit` issues a new token.

### Frontend structure

- `App.tsx` holds session, current user, company units, notifications and mock ERP state; renders `Sidebar`/`Header` and one `*Module.tsx` per category, which switches on `subKey`.
- All backend calls go through `apiRequest` in `src/services/apiClient.ts` (token in `localStorage['s_erp_auth_token']`, 401 dispatches `UNAUTHORIZED_EVENT` → logout). Screens must not call `fetch` directly; per-feature calls live in the feature's `api.ts`. The only exception is the SSE stream in `services/notificationStream.ts`.
- New features are copied from `src/modules/_templates/category-feature-template/` (master data) or `voucher-feature-template/` (master-detail documents). Each feature folder: `*View.tsx`, `types.ts`, `index.ts`, optional `api.ts`.
- API-backed catalogs follow `modules/settings/DepartmentCategoryView.tsx`: `useCatalog(api, …)` (`hooks/useCatalog.ts`) handles load/save/delete + toasts; the screen declares `GridView` columns and a `Modal` form. Settings screens take `SettingsViewProps` (`canEdit`, `canDelete`) and hide actions accordingly.
- Settings API clients are in `services/settingsApi.ts`; JSON settings sections are cached by `services/systemSettingsService.ts` (loaded at session start; number format applied via `NumberFormatContext.applyConfig`).
- Use the shared controls in `src/components/common/` (`GridView`, `CategoryHeaderToolbar`, `Modal`, `TextInput`/`SelectInput`/`FormField`, `Tabs`, `useConfirm()`, `LoadingState`/`ErrorState`, `NumberInput`/`CurrencyInput`, `LookupField`) and `showToast` / `saveWithFeedback` from `utils/toast.ts` instead of raw inputs, `window.confirm` etc. See `Frontend/src/DEVELOPER_GUIDE.md`.
- Colours (`src/index.css`): one light-blue brand scale `brand-50…950`; `indigo/violet/purple/fuchsia/blue/sky/cyan` are aliases of it, so any of them renders as brand. Use `brand-*` for accents and primary actions, `slate-*` for neutrals, and emerald / amber / rose only for meaning (success / warning / danger). In dark mode `slate` and `gray` become neutral grays (black/gray UI). No gradients or per-tab colours (`Tabs` `tone` is ignored); page background is `bg-background`.
- Notification deep links: `requestOpenDocument` / `useOpenDocumentRequest('<function code>', id => ...)` in `utils/documentLinks.ts`.
- `src/components/*View.tsx` at the top level (DashboardView, InventoryView, …) are not imported anywhere; the live screens are under `src/modules/`.

### Backend structure

Clean architecture, one-way deps `Core → Core.Infrastructure → Core.Application → Core.Domain`. In each layer, shared code is in `Common/` and features in `Modules/<Module>/`:
- `Core.Domain`: entities (`AuditableEntity` for `sys_*` audit columns).
- `Core.Application`: DTOs + service interfaces, pure rules (`PermissionMatrix`, `ApprovalRuleEngine`), exceptions (`BusinessRuleException`→400, NotFound→404, AuthenticationFailed→401, Forbidden→403, mapped to `{ message }` by `AppExceptionFilter`).
- `Core.Infrastructure`: `CoreContext` (EF), `UnitOfWork`, `SqlExecutor` (Dapper), services, `DatabaseSeeder`; register services in `DependencyInjection.cs`.
- `Core`: thin controllers, auth policies, `AddApi` (JWT, CORS `Cors:AllowedOrigins`, rate limiting). Can run as a Windows service.
- `_legacy/` is pre-refactor code, not in the solution; don't edit or reference it.

Shared building blocks for vouchers (see the "Khung lưu một phiếu" snippet in `ServerService/README.md`): `IFiscalPeriodService.EnsureDateOpenAsync` (month locks per unit + data entry start date), `IVoucherNumberService.NextAsync` (atomic via `VoucherNumbering/Sql/NextNumber.sql`, call inside the save transaction), `IExchangeRateService.GetRateAsync`, `DocumentStatusPolicy`, `IDocumentApprovalService`.

Settings storage: values nothing else references live as JSON sections in `sys_setting` (`SystemConfigSections`); anything referenced by other data (currencies, rates, departments, month locks, number series) has its own table. Users link to departments by `department_code` (the `department` column keeps the name for display); approval rules of type DEPARTMENT store the code.

Data access rules:
- **CRUD via EF Core**; **reports, calculations, ledger posting via raw SQL** through `ISqlExecutor`. SQL files live in `Core.Infrastructure/Modules/<Module>/Sql/<Name>.sql` (embedded resources), loaded with `SqlScripts.Get("<Module>", "<Name>")`. Always parameterize (`@name`); snake_case columns auto-map to PascalCase.
- Wrap EF save + raw SQL posting in `IUnitOfWork.ExecuteAsync(...)` so both share one transaction.

Database conventions (enforced by `TablesAndColumnsFollowNamingConvention` test):
- `sys_*` for system tables, `erp_*` for business tables; `snake_case` table/column names.
- **No foreign keys.** Link by indexed code/ID columns; services validate references and block deleting in-use rows. Relationships in `CoreContext` exist only for EF joins.
- `00-helpers.sql` provides `sys_rename_table`, `sys_rename_column`, `sys_rename_constraint`, `sys_drop_foreign_keys` for migration-style scripts.

Seeding: every startup inserts missing function codes, number series for new `VoucherCatalog` entries and a base currency (VND) if none. With an empty `sys_users`, `Seed:DemoData=true` loads `Core/SeedData/seed.json` (exported from the frontend mocks via `npm run export-seed`, incl. `mock/initialSettingsData.ts`); otherwise `Bootstrap:AdminPassword` (≥12 chars) creates only the admin and one unit.

Notifications: `NotificationStream` keeps SSE connections in memory (single-instance only); the server only sends `notification`/`sync` signals and the client refetches. Frontend also polls every 3 minutes. `NotificationCleanupService` purges old rows every 12h.

## Docs

- Root `README.md` ("Thêm một chức năng mới": catalog / voucher / report recipes) and `ServerService/README.md` (tables, API endpoint/permission table, voucher save skeleton) are the authoritative references, in Vietnamese.
- `Frontend/README.md` is leftover AI Studio boilerplate.
