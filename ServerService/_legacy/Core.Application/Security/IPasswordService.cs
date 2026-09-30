using Core.Domain.Entity.SystemEntities;

namespace Core.Application.Security;

public interface IPasswordService
{
    string Hash(SysUser user, string password);
    bool Verify(SysUser user, string password, out bool needsUpgrade);
}
