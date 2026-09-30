namespace Core.Domain
{
    public interface IAuditable
    {
        DateTime? CreateTime { get; set; }
        string? CreateId { get; set; }
        DateTime? UpdateTime { get; set; }
        string? UpdateId { get; set; }
        String? Status { get; set; }
    }
}
