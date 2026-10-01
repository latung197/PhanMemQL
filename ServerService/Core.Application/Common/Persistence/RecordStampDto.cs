namespace Core.Application.Common.Persistence;

/// <summary>
/// Who created / last changed a business row (erp_*, ErpEntity) and when; times in UTC, names of the users at
/// reading time. Every erp_* DTO carries it as "stamp".
/// </summary>
public sealed record RecordStampDto(DateTime CreatedAt, string? CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);
