using Core.Application.Security;
using Core.Utils;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System.Security.Claims;

namespace Core.Infrastructure.ContextAccessors
{
    public class UserPrincipalService : IUserPrincipalService
    {
        #region Properties
        private readonly IHttpContextAccessor _httpContextAccessor;
        #endregion
        #region Constructor
        public UserPrincipalService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }
        #endregion
        public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated == true;
        public int UserId
        {
            get
            {
                if (_httpContextAccessor.HttpContext is null)
                {
                    return 0;
                }

                var context = _httpContextAccessor.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier);
                if (context is null)
                {
                    return -1;
                }

                int result;
                int.TryParse(context.Value, out result);
                return result;
            }
        }
        public string Username
        {
            get
            {
                if (_httpContextAccessor.HttpContext is null)
                {
                    return string.Empty;
                }

                Claim? context = _httpContextAccessor.HttpContext.User.FindFirst(ClaimTypeConst.USERNAME);

                if (context is null)
                {
                    return string.Empty;
                }

                return context.Value;
            }
        }
        public string Accesstoken
        {
            get
            {
                if (_httpContextAccessor.HttpContext is null)
                {
                    return string.Empty;
                }

                var context = _httpContextAccessor.HttpContext.User.FindFirst(ClaimTypeConst.ACCESS_TOKEN);

                if (context is null)
                {
                    return string.Empty;
                }

                return context.Value;
            }
        }
        public List<int> Roles
        {
            get
            {
                if (_httpContextAccessor.HttpContext is null)
                {
                    return new List<int>();
                }

                Claim? context = _httpContextAccessor.HttpContext.User.FindFirst(ClaimTypes.Role);

                if (context is null)
                {
                    return new List<int>();
                }
                string val = context.Value;
                if (string.IsNullOrEmpty(context.Value))
                {
                    return new List<int>();
                }
                else
                {
                    return context.Value.Split(",").Select(x => int.Parse(x)).ToList();
                }
            }
        }
        public bool AddUpdateClaim(string key, string value)
        {
            if (_httpContextAccessor.HttpContext is null)
            {
                return false;
            }

            var identity = (ClaimsIdentity)_httpContextAccessor.HttpContext.User.Identity;

            if (identity is null)
            {
                return false;
            }

            var existingClaims = identity.FindAll(key).ToList();
            if (existingClaims.Any())
            {
                foreach (var existingClaim in existingClaims)
                {
                    identity.RemoveClaim(existingClaim);
                }
                // add new claim
                identity.AddClaim(new Claim(key, value));
            }
            else
            {
                // add new claim
                identity.AddClaim(new Claim(key, value));
            }

            return true;
        }
    }
}
