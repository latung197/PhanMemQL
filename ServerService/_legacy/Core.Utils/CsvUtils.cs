using System;
using System.Text;
using CsvHelper;

namespace Core.Utils
{
    public static class CsvUtils
    {
        public static List<T> ParseCsvCommon<T>(string path)
        {
            using (StreamReader reader = new StreamReader(path))
            {
                using (CsvReader csv = new CsvReader(reader, System.Globalization.CultureInfo.InvariantCulture))
                {
                    return csv.GetRecords<T>().ToList();
                }
            }
        }
        /// <summary>
        /// Parse CSV to data
        /// Some encoding not support (SHIFT_JIS)
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="path"></param>
        /// <param name="name"></param>
        /// <returns></returns>
        public static List<T> ParseCsvWithEncoding<T>(string path, string name)
        {
            using (StreamReader reader = new StreamReader(path, Encoding.GetEncoding(name)))
            {
                using (CsvReader csv = new CsvReader(reader, System.Globalization.CultureInfo.InvariantCulture))
                {
                    return csv.GetRecords<T>().ToList();
                }
            }
        }
        public static List<T> ParseCsvWithEncoding<T>(string path, int codePage)
        {
            using (StreamReader reader = new StreamReader(path, Encoding.GetEncoding(codePage)))
            {
                using (CsvReader csv = new CsvReader(reader, System.Globalization.CultureInfo.InvariantCulture))
                {
                    return csv.GetRecords<T>().ToList();
                }
            }
        }
    }
}
