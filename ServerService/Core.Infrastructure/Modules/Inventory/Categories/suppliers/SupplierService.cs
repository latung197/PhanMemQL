using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory.Categories.suppliers;
using Core.Domain.Common;
using Core.Domain.Modules.Inventory.Categories.suppliers;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Core.Infrastructure.Modules.Inventory.Categories.suppliers
{

    /// <summary>Danh mục nhà cung cấp. Changes are logged automatically ([Audited]).</summary>
    public sealed class SupplierService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
        : CatalogService<Supplier, SupplierDto, SaveSupplierRequest>(db, batch, excel, audit), ISupplierService
    {
        // Function, loại đối tượng, nhãn của mã (field.*), độ dài mã, tên file xuất.
        private static readonly CatalogSpec Info = new("inv_supplier_cat", "supplier", "field.supplierCode", 20, "DanhMucNhaCungCap");

        // Cột được phép sắp xếp (danh sách trắng). Tên = sortKey / key của cột lưới ở frontend; "order" là thứ tự mặc định.
        private static readonly SortMap<Supplier> SortColumns = SortMap<Supplier>.By(x => x.Code, "order")
            .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("taxCode", x => x.TaxCode)
            .Add("isActive", x => x.IsActive).AddRecordStamps();

        protected override CatalogSpec Spec => Info;
        protected override SortMap<Supplier> Sorts => SortColumns;

        // Ô tìm kiếm khớp những trường nào. Dùng SearchFunctions.Matches (không phân biệt hoa thường VÀ dấu: gõ "thung" ra "Thùng"),
        // không dùng EF.Functions.ILike trực tiếp (test AccentInsensitiveSearchContractTests báo đỏ). pattern đã thoát ký tự đặc biệt.
        protected override IQueryable<Supplier> Search(IQueryable<Supplier> rows, string pattern) =>
            rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
                || SearchFunctions.Matches(x.TaxCode, pattern) || SearchFunctions.Matches(x.Phone, pattern));

        // Bộ lọc riêng của danh mục: tham số URL ngoài page, pageSize, sort, dir, search, status (ví dụ ?hasTaxCode=yes).
        // Chỉ đọc những khóa mình biết, khóa lạ bỏ qua. Dùng cho cả danh sách lẫn xuất Excel.
        protected override IQueryable<Supplier> ApplyFilters(IQueryable<Supplier> rows, IReadOnlyDictionary<string, string> filters) =>
            filters.TryGetValue("hasTaxCode", out var value)
                ? rows.Where(x => (x.TaxCode != null && x.TaxCode != "") == (value == "yes"))
                : rows;

        // Cột file Excel xuất: tiêu đề là khóa export.supplier.* (vi trùng tiêu đề file nhập để xuất xong sửa rồi nhập lại).
        protected override IReadOnlyList<ExportColumn<Supplier>> ExportColumns() =>
        [
            new("export.supplier.code", x => x.Code), new("export.supplier.name", x => x.Name),
        new("export.supplier.taxCode", x => x.TaxCode), new("export.supplier.isActive", x => YesNo(x.IsActive))
        ];

        // Dòng nhập Excel không có phiên bản.
        protected override SaveSupplierRequest WithoutVersion(SaveSupplierRequest request) => request with { Version = null };

        // Entity -> DTO. Cần dữ liệu liên quan (tên, bản dịch) thì đọc một lần cho cả danh sách, đừng đọc từng dòng.
        protected override Task<IReadOnlyList<SupplierDto>> MapAsync(IReadOnlyList<Supplier> rows,
            Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<SupplierDto>>(rows.Select(x => new SupplierDto(x.Code, x.Name, x.TaxCode, x.Phone,
                x.Address, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

        // Kiểm tra rồi chép request vào entity. Mã (Code) và SortOrder đã do lớp nền xử lý.
        protected override async Task ApplyAsync(Supplier row, SaveSupplierRequest request, CancellationToken ct)
        {
            var name = Guard.Required(request.Name, 200, "field.supplierName");
            if (await Db.Suppliers.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
                throw new BusinessRuleException("supplier.nameExists", name);
            row.Name = name;
            row.TaxCode = Guard.Optional(request.TaxCode, 30, "field.taxCode");
            row.Phone = Guard.Optional(request.Phone, 30, "field.phone");
            row.Address = Guard.Optional(request.Address, 300, "field.address");
            row.Note = Guard.Optional(request.Note, 300, "field.note");
            row.IsActive = request.IsActive;
        }

        // Tùy chọn: chặn xóa khi dữ liệu khác đang dùng (và xóa dòng con).
        // protected override async Task BeforeDeleteAsync(Supplier row, CancellationToken ct)
        // {
        //     if (await Db.GoodsReceipts.AnyAsync(x => x.SupplierCode == row.Code, ct))
        //         throw new BusinessRuleException("supplier.inUse", row.Name);
        // }
    }

}
