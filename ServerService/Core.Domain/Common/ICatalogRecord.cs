namespace Core.Domain.Common;

/// <summary>
/// What every catalog (danh mục) record has: a unique code as its key, an active flag and a display order. Catalog
/// entities implement it so the shared catalog service (CatalogService) can create, find, list and delete them.
/// </summary>
public interface ICatalogRecord
{
    string Code { get; set; }
    bool IsActive { get; set; }
    int SortOrder { get; set; }
}
