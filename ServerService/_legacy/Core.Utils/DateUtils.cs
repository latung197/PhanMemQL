using System.Globalization;

namespace Core.Utils
{
    public static class DateUtils
    {
        public static DateTime? GetDate(string dateString, string format = "yyyy/MM/dd")
        {
            try
            {
                if (string.IsNullOrEmpty(format))
                {
                    format = "yyyy/MM/dd";
                }

                return new DateTime?(DateTime.ParseExact(dateString, format, CultureInfo.InvariantCulture));
            }
            catch
            {
                return null;
            }
        }
    }
}
