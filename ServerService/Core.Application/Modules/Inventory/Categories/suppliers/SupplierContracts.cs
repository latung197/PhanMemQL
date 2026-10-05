using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;
using System;
using System.Collections.Generic;
using System.Text;

namespace Core.Application.Modules.Inventory.Categories.suppliers
{
    /// <summary>Stamp = người tạo / người sửa và thời điểm; Version = phiên bản bản ghi (tự có cho mọi bảng erp_*).</summary>
    public sealed record SupplierDto(string Code, string Name, string? TaxCode, string? Phone, string? Address,
        string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

    /// <summary>Version: phiên bản lúc màn hình tải bản ghi (chống ghi đè khi 2 người cùng sửa).</summary>
    public sealed record SaveSupplierRequest(string Code, string Name, string? TaxCode, string? Phone, string? Address,
        string? Note, bool IsActive = true, uint? Version = null) : ICatalogRequest;

    /// <summary>Danh sách, xuất Excel, tạo, sửa, xóa, nhập Excel, xóa nhiều đều có sẵn từ ICatalogService.</summary>
    public interface ISupplierService : ICatalogService<SupplierDto, SaveSupplierRequest>;

}
