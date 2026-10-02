# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

S-ERP: a Vietnamese ERP made of two apps plus user docs.

- `Frontend/`: React 19 + TypeScript, Vite 6, Tailwind v4, served by an Express dev server (`server.ts`) on `http://localhost:3000`. `server.ts` also hosts `/api/gemini/analyze` (AI assistant, needs `GEMINI_API_KEY`).
- `ServerService/`: .NET 10 Web API (EF Core + Dapper, PostgreSQL) on `http://localhost:2512`.
- `docs/`: end-user docs (Word).

**The frontend is the source of truth.** Function codes, data shapes and API response types follow `Frontend/src/types/index.ts` (`UserProfile`, `RoleDefinition`, `ActionPermissions`, `CompanyUnit`, `SystemNotification`) and the settings sections in `Frontend/src/services/systemSettingsService.ts`. The backend adapts to match.

UI text, error messages (`{ message }` from the API) and docs are written in **Vietnamese**.

Multi-language: languages are the backend catalog `sys_language` (Settings › Ngôn ngữ), each user has an own language (`sys_users.language`, null = default) and the frontend sends it as `Accept-Language`. Backend user texts live in `ServerService/Core.Application/Common/Localization/Messages.{vi,en}.json`: throw `new BusinessRuleException("module.key", args)` (never a sentence), Guard labels are `field.*` keys, and `MessagesTests` fails on a missing key or a Vietnamese sentence in a `throw`. Missing texts fall back to Vietnamese. Only the shared parts and Settings are being translated for now (Inventory later, when it is redeveloped).

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

- **Backend-backed:** login/JWT, users, roles, permission matrix, special rights, company units (DVCS), departments, currencies + exchange rates, month locks per unit, voucher number series, JSON settings (defaults, fiscal year, company profile, number format) with backup/restore, notifications (incl. SSE realtime), approval rules, change log, inventory unit of measure catalog (`erp_uom`, `modules/inventory/uom`).
- **Still browser mock data:** materials, warehouses, unit conversions (still read the mock unit list), goods receipts/issues, sales, finance, HR, reports. Lives in `Frontend/src/mock/` and is persisted to `localStorage['s_erp_database_state']`, loaded in `App.tsx`.
- Approval workflow endpoints (`/api/approvals/{fn}/{id}/submit|approve|reject|withdraw`) exist on the backend but the frontend does not call them yet.

When turning a mock feature into a real one, add the backend module, add `api.ts` in the feature folder calling `apiRequest`, and remove that screen's mock data.

### Function codes tie everything together

A `SubMenuKey` (e.g. `inv_receipt`) is the shared key for menu, route, permissions, notifications and approvals. A new function is declared in:
- Frontend: `src/types/index.ts` (`SubMenuKey`) and **`src/config/functions.ts`** (`FUNCTION_REGISTRY`: category, hash path, label, kind — typed `Record<SubMenuKey, …>`, so a missing entry is a compile error). Routes (`config/router.ts`), breadcrumbs (`utils/navigationHelper.ts`) and the permission matrix (`permissions/permissionCatalog.ts`) are derived from it. Then a sidebar item in `src/mock/initialMenuData.ts` (static, not cached) and a `case` in the parent `*Module.tsx` (Settings: `renderScreen` in `SettingsModule.tsx`; settings screens are opened from the sidebar only, no tab bar).
- Backend: `Core.Application/Common/Permissions/FunctionCatalog.cs` (API auto-inserts missing codes into `sys_command` on startup). Vouchers also go in `Common/Documents/VoucherCatalog.cs`, which gives them a number series, the voucher special rights and a place in approval rules.
- Always navigate with `navigateTo` / `openFunction` in `App.tsx` (keeps the URL hash in sync); never set the active sub-menu state directly.

### Permissions

- Each function has 7 actions: `view / create / edit / delete / approve / print / export` (create = add, copy, import Excel; edit = change saved records; export = data to a file). Endpoints: `POST` → `PermissionAction.Create`, `PUT` / saving settings → `Edit`; submitting a voucher needs `Create` or `Edit`. Legacy flags map 1:1 (`can_add`, `can_edit`, `can_print`, `can_export`); `ActionPermissionsJsonConverter` still reads old `createEdit` / `printExport` JSON (seed, backups). Frontend screens: add button / import → `perms.create`, edit → `perms.edit`, `onExportExcel` only when `perms.export`, print → `perms.print`. Special rights are `{function}:{CODE}` (e.g. `inv_receipt:VIEW_PRICE`), declared in `SpecialRightCatalog.cs`.
- Effective rights = **role + exceptions** (`PermissionMatrix.Resolve` / `ResolveRights`): admin (role `ADMIN` or legacy `auth_fl` containing `0`) has everything; otherwise the combined role matrix, where each `sys_user_command` row replaces that one function, and role special rights plus `sys_user_right` rows with `is_granted` true, minus those with false. The permission screen sends the full wanted matrix; the backend stores only the differences (`PermissionMatrix.Overrides` / `RightOverrides`). DB tables still store 11 legacy flags; `CommandPermission` converts both ways.
- Document status rules: `DocumentStatusPolicy.cs` (backend) and its mirror `Frontend/src/utils/documentPolicy.ts`; both are checked against `ServerService/tests/Core.Tests/Common/DocumentPolicyCases.json` (`dotnet test`, `npm run check-policy`). Change them together.
- Reading: a function's full data (its `GET` endpoints) needs its **View** right; other screens pick codes through lookups (`/api/lookups/{name}`, open to signed-in users). `ReadAccessContractTests` fails when a GET of a controller with `const string Function` lacks `RequirePermission` (existing exceptions listed with a reason, to move to lookups when those screens are redone).
- Backend: controllers inherit `ApiControllerBase` (requires auth + access to the token's company unit) and use `[RequirePermission("code", PermissionAction.X)]` / `[RequireRight(...)]`. `GrantGuard` prevents non-admins granting rights they don't hold. `DocumentStatusPolicy` decides allowed actions per document status.
- Frontend: `utils/permissions.ts` (`canView`, `hasRight`, `getActionPermission`, also re-exported from `mock/initialRoles`). Frontend checks are display-only.
- Changing lock/password bumps `security_version`, invalidating existing JWTs. The JWT carries the active company unit; `POST /api/auth/switch-unit` issues a new token.

### Frontend structure

- `App.tsx` holds session, current user, company units, notifications and mock ERP state; renders `Sidebar`/`Header` and one `*Module.tsx` per category, which switches on `subKey`.
- All backend calls go through `apiRequest` in `src/services/apiClient.ts` (token in `localStorage['s_erp_auth_token']`, 401 dispatches `UNAUTHORIZED_EVENT` → logout). Screens must not call `fetch` directly; per-feature calls live in the feature's `api.ts`. The only exception is the SSE stream in `services/notificationStream.ts`.
- New features are copied from `src/modules/_templates/category-feature-template/` (master data) or `voucher-feature-template/` (master-detail documents). Each feature folder: `*View.tsx`, `types.ts`, `index.ts`, optional `api.ts`.
- API-backed catalogs use the shared catalog screen `components/catalog/CatalogScreen.tsx`: the feature only declares a `CatalogDefinition` (columns, form, Excel columns, extra filters; model `modules/inventory/uom/UomCategoryView.tsx`) and `CatalogScreen` does reload, search (accent-insensitive), status / extra filters, real `.xlsx` export (`perms.export`), Excel import with template, preview and per-row errors (`perms.create`, upsert also `perms.edit`), bulk delete (`perms.delete`), form with record stamps and lost-update protection (`useCatalog`). Its **Cột** button (`ColumnChooser` + `useGridLayout`) lets each user hide / reorder columns, drag header edges to resize, keep sort and page size, saved on the server (`sys_grid_layout`, `/api/grid-layouts/{fn}/{grid}`; admins set a company default); column `key`s are the saved names, so don't rename existing ones. Pick codes of a catalog anywhere with `CatalogLookup` (one code) or `CatalogMultiLookup` (several codes as chips, ticks in the F2 window) (code box + F2 server search, `GET /api/lookups/{name}`: code, name, a few extra columns), registered on the backend with one `services.AddLookup(new LookupDefinition(...))` line in `DependencyInjection`. Backend side: `ImportAsync` / `DeleteManyAsync` through `CatalogBatch` (all rows or none, each row through the service's own Create / Update / Delete, savepoint per row) and `POST .../import`, `.../delete-many`. Older settings screens (`modules/settings/DepartmentCategoryView.tsx`...) still use `useCatalog` + `GridView` directly and take `SettingsViewProps` (`canCreate`, `canEdit`, `canDelete`).
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
- Every `erp_*` entity inherits `ErpEntity` (`created_at`, `created_by`, `updated_at`, `updated_by`; timestamptz UTC, user ids), filled by `CoreContext` on save, never by callers; test `BusinessTablesHaveRecordStamps`. DTOs carry them as `stamp` (`RecordStampDto` via `RecordStamps.ForAsync`, names looked up in one query); frontend `recordStampColumns(t)` / `<RecordStampLine>` (`components/common`). Legacy `sys_*` tables keep `createtime` / `createid` / `updatetime` / `updateid`.
- Lost updates: records edited in forms implement `IVersioned` (`uint Version`, every `ErpEntity` has it), mapped by `CoreContext` to PostgreSQL's `xmin` as concurrency token (no SQL column needed; test `VersionedRecordsUseXminAsConcurrencyToken`). DTOs return `version`, save requests take `uint? Version = null`, and `UpdateAsync` calls `db.ExpectVersion(entity, request.Version)` right after loading (`touch: true` when a save may only change child rows: roles, user permissions / units). A stale version → `ConflictException("record.changed")` → HTTP 409 (also for `DbUpdateConcurrencyException`). Frontend: `useCatalog.save` sends `existing.version` and reloads on 409; other screens pass `version` from the loaded record. `ConcurrencyContractTests` fails when a service `UpdateAsync` lacks the request / DTO `Version` or the `ExpectVersion` call (exemptions with a reason in its `Exempt` list). Guide: `docs/chong-ghi-de.md`.
- **No foreign keys.** Link by indexed code/ID columns; services validate references and block deleting in-use rows. Relationships in `CoreContext` exist only for EF joins.
- `00-helpers.sql` provides `sys_rename_table`, `sys_rename_column`, `sys_rename_constraint`, `sys_drop_foreign_keys` for migration-style scripts.

Seeding: every startup inserts missing function codes, number series for new `VoucherCatalog` entries and a base currency (VND) if none. With an empty `sys_users`, `Seed:DemoData=true` loads `Core/SeedData/seed.json` (exported from the frontend mocks via `npm run export-seed`, incl. `mock/initialSettingsData.ts`); otherwise `Bootstrap:AdminPassword` (≥12 chars) creates only the admin and one unit.

Change log: `sys_audit_log` is shared by every function and filled **automatically**: `CoreContext.SaveChangesAsync` runs `AuditTrail`, which logs every insert / update / delete of an entity marked `[Audited(function, objectType, Label = "...", SoftDelete = ...)]` (field before → after, same transaction; only for a signed-in user). Every entity must say `[Audited]` or `[NotAudited(reason)]` (`AuditDeclarationTests`); use `[AuditIgnore]` for secrets / preferences, `[AuditField]` to rename legacy columns, `[AuditJson]` for JSON columns, `[AuditedChild]` for list tables. By hand via `IAuditLog` only for what EF cannot see or needs business meaning: `Attach(entity, changes)` (e.g. names for ids), `RecordAsync(AuditEntry)` for permissions (effective rights, `UserAccessAudit`), password reset/change, approval actions, raw SQL / `ExecuteUpdate`. Shown only on Settings › Nhật ký thay đổi (`sys_audit_log`, `modules/settings/AuditLogView.tsx`, filters from `GET /api/audit-logs/filters`), never on the functions' screens; labels `audit.*`.

Change log retention: Settings › Nhật ký thay đổi › Lưu trữ (`GET/PUT /api/audit-logs/settings`, section `auditLog` in `sys_setting`, 0 = forever); `AuditLogCleanupService` deletes older rows in batches twice a day and leaves one `PURGE` row (by "system").

Database errors: `DatabaseErrors` (used by `AppExceptionFilter`) turns any unique violation into 409 `record.duplicate` naming the field (`dbfield.<column>` message keys) and value (Npgsql `IncludeErrorDetail`), deadlocks into 409 `record.busy`. Services still pre-check for specific messages.

Cache: `IAppCache` (memory, one instance) with table dependencies; `CacheInvalidationInterceptor` drops entries whenever CoreContext writes their tables (and again on commit / rollback); read through `db.CachedAsync(cache, key, tables, factory, ct)`, which bypasses the cache inside an open transaction. Cached: per-user access snapshot in `PermissionService` (token check, matrix, rights, units), active units, settings per unit, active languages, UOM list. Never cache stock, balances, voucher numbers, month locks. Dapper writes must call `cache.InvalidateTables`.

Logs / monitoring: Serilog (`Serilog` section; console + `Core/logs/erp-*.log`, 30 days), one line per request with UserId / UnitCode / ClientIp / RequestId (`X-Request-Id` header), slow requests (`Monitoring:SlowRequestMs`) and slow SQL (`SlowQueryInterceptor`, `Monitoring:SlowQueryMs`) as warnings; `GET /health` (database) and `/health/live`.

Notifications: `NotificationStream` keeps SSE connections in memory (single-instance only); the server only sends `notification`/`sync` signals and the client refetches. Frontend also polls every 3 minutes. `NotificationCleanupService` purges old rows every 12h.

## Docs

- Adding a catalog: follow the project skill `.claude/skills/them-danh-muc/SKILL.md` (`/them-danh-muc`), with full code in `docs/them-danh-muc.md`. Lost-update guide: `docs/chong-ghi-de.md`.
- Root `README.md` ("Thêm một chức năng mới": catalog / voucher / report recipes) and `ServerService/README.md` (tables, API endpoint/permission table, voucher save skeleton) are the authoritative references, in Vietnamese.
- `Frontend/README.md` is leftover AI Studio boilerplate.
