namespace Core.Application.Features.Erp.Menu;

public sealed class MenuNodeDto
{
    public string Code { get; set; } = string.Empty;
    public string? ParentCode { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? Route { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool IsVisible { get; set; }
    public List<MenuNodeDto> Children { get; set; } = [];
}

public sealed record SaveMenuRequest(string Code, string? ParentCode, string Text, string? Route,
    string? Icon, int SortOrder, bool IsVisible, string? AllowedUnits);

public interface IMenuService
{
    Task<IReadOnlyList<MenuNodeDto>> GetMyMenuAsync(int userId, string unitCode, CancellationToken ct);
    Task<IReadOnlyList<MenuNodeDto>> GetAllAsync(CancellationToken ct);
    Task SaveAsync(SaveMenuRequest request, CancellationToken ct);
}
