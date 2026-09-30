using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Application.Security
{
    public interface IUserPrincipalService
    {
        bool IsAuthenticated { get; }
        public int UserId { get; }
        public string Username { get;  }
        public string Accesstoken { get;  }
        public List<int> Roles {  get; }
        bool AddUpdateClaim(string key, string value);
    }
}
