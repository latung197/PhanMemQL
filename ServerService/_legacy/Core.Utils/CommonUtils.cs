using Newtonsoft.Json;
using System.ComponentModel;
using System.Reflection;

namespace Core.Utils
{
    public static class CommonUtils
    {
        public static T Deserialize<T>(string json) where T : new()
        {
            try
            {
                return JsonConvert.DeserializeObject<T>(json);
            }
            catch
            {
                return new T();
            }
        }
        public static string Serialize<T>(T obj)
        {
            try
            {
                return JsonConvert.SerializeObject(obj);
            }
            catch
            {
                return string.Empty;
            }
        }
        public static Dictionary<int, string> EnumToDic<T>()
        {
            Dictionary<int, string> dic = new Dictionary<int, string>();
            Array values = Enum.GetValues(typeof(T));
            foreach (Object item in values)
            {
                string description = string.Empty;
                try
                {
                    description = ((DescriptionAttribute)item.GetType().GetMember(item.ToString()).FirstOrDefault()
                    .GetCustomAttribute(typeof(DescriptionAttribute))).Description ?? string.Empty;
                }
                catch (Exception)
                {
                    description = item.ToString();
                }
                dic.Add((int)item, description);
            }
            return dic;
        }
    }
}
