namespace Core.Utils.LogUtils
{
    public interface ILoggerManager
    {
        void LogInfo(string message);
        void LogInfo(object data);
        void LogDebug(object data);
        void LogError(object data);
        void LogWarning(object data);
        void LogTrace(object data);
        void LogDebug(string message);
        void LogError(string message);
        void LogError(Exception ex, string message);
        void LogError(Exception ex);
        void LogWarning(string message);
        void LogTrace(string message);
    }
}
