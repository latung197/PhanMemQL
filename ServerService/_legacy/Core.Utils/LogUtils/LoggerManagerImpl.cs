using NLog;
using System;

namespace Core.Utils.LogUtils
{
    public class LoggerManagerImpl : ILoggerManager
    {
        private ILogger logger = LogManager.GetCurrentClassLogger();
        public void LogDebug(string message)
        {
            logger.Debug(message);
        }

        public void LogDebug(object data)
        {
            logger.Debug(data);
        }

        public void LogError(string message)
        {
            logger.Error(message);
        }

        public void LogError(Exception ex, string message)
        {
            logger.Error(ex, message);
        }

        public void LogError(Exception ex)
        {
            logger.Error(ex);
        }

        public void LogError(object data)
        {
            logger.Error(data);
        }

        public void LogInfo(string message)
        {
            logger.Info(message);
        }
        public void LogInfo(object data)
        {
            logger.Info(data);
        }
        public void LogTrace(string message)
        {
            logger.Trace(message);
        }

        public void LogTrace(object data)
        {
            logger.Trace(data);
        }

        public void LogWarning(string message)
        {
            logger.Warn(message);
        }

        public void LogWarning(object data)
        {
            logger.Warn(data);
        }
    }
}
