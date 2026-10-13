using Core.Application.Common.Exceptions;
using Core.Application.Common.Paging;
using Core.Application.Common.Permissions;
using Xunit;

namespace Core.Tests.Common;

public sealed class VoucherListQueryTests
{
    [Fact]
    public void StatusFilterIsAStatusNameOrNothing()
    {
        Assert.Null(new VoucherListQuery().StatusFilter);
        Assert.Null(new VoucherListQuery(Status: "  ").StatusFilter);
        Assert.Equal(DocumentStatus.Approved, new VoucherListQuery(Status: "Approved").StatusFilter);
        Assert.Equal(DocumentStatus.Posted, new VoucherListQuery(Status: " Posted ").StatusFilter);
        Assert.Throws<BusinessRuleException>(() => new VoucherListQuery(Status: "Nope").StatusFilter);
        // A number is not a status (Enum.TryParse would take "7" for a value that does not exist).
        Assert.Throws<BusinessRuleException>(() => new VoucherListQuery(Status: "7").StatusFilter);
    }

    [Fact]
    public void CodeFilterSplitsOnCommasAndIgnoresCaseAndSpaces()
    {
        Assert.Empty(new VoucherListQuery().CodeParts);
        Assert.Equal(["PNK-1"], new VoucherListQuery(Code: " pnk-1 ").CodeParts);
        Assert.Equal(["PNK-1", "PNK-2"], new VoucherListQuery(Code: "pnk-1, ,pnk-2,").CodeParts);
    }

    [Fact]
    public void PagingFollowsTheSharedLimits()
    {
        var (page, size) = PagingLimits.Normalize(new VoucherListQuery(Page: 0, PageSize: 5000));
        Assert.Equal(1, page);
        Assert.Equal(PagingLimits.MaxPageSize, size);
        Assert.Equal(PagingLimits.DefaultPageSize, PagingLimits.Normalize(new VoucherListQuery(PageSize: 0)).PageSize);
    }
}
