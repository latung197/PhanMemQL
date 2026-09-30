namespace Core.Application.Features.Erp.Menu;

public static class MenuTreeBuilder
{
    public static IReadOnlyList<MenuNodeDto> Build(IEnumerable<MenuNodeDto> source)
    {
        var nodes = source.ToDictionary(x => x.Code, StringComparer.Ordinal);
        foreach (var node in nodes.Values) node.Children = [];
        var roots = new List<MenuNodeDto>();
        foreach (var node in nodes.Values.OrderBy(x => x.SortOrder).ThenBy(x => x.Code))
        {
            if (string.IsNullOrEmpty(node.ParentCode) || node.ParentCode == node.Code
                || !nodes.TryGetValue(node.ParentCode, out var parent))
                roots.Add(node);
            else if (!HasAncestor(parent, node.Code, nodes))
                parent.Children.Add(node);
            else
                roots.Add(node);
        }
        Sort(roots);
        return roots;
    }

    private static bool HasAncestor(MenuNodeDto parent, string code,
        IReadOnlyDictionary<string, MenuNodeDto> nodes)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        while (true)
        {
            if (parent.Code == code || !seen.Add(parent.Code)) return true;
            if (string.IsNullOrEmpty(parent.ParentCode) || parent.ParentCode == parent.Code
                || !nodes.TryGetValue(parent.ParentCode, out var next)) return false;
            parent = next;
        }
    }

    private static void Sort(List<MenuNodeDto> nodes)
    {
        nodes.Sort((a, b) => a.SortOrder != b.SortOrder
            ? a.SortOrder.CompareTo(b.SortOrder) : string.CompareOrdinal(a.Code, b.Code));
        foreach (var node in nodes) Sort(node.Children);
    }
}
