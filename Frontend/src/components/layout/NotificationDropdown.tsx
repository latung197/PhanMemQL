import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle2, AlertCircle, Send, X } from 'lucide-react';
import { SystemNotification } from '../../types';
import { formatRelativeTime } from '../../services/notificationService';
import { useConfirm } from '../common/ConfirmDialog';

interface NotificationDropdownProps {
  notifications: SystemNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  /** Hides one notification from this user's list. */
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  /** Opens what the notification links to (a document or a module). */
  onSelectNotification?: (notification: SystemNotification) => void;
  /** Shown to users allowed to send notifications: opens the publish form. */
  onCompose?: () => void;
}

const getTypeIcon = (type: SystemNotification['type']) => {
  switch (type) {
    case 'danger':
      return <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-indigo-500 shrink-0" />;
  }
};

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearAll,
  onSelectNotification,
  onCompose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const confirm = useConfirm();

  const unreadCount = notifications.filter(n => !n.read).length;

  // Escape closes the list, like the other popups.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleClearAll = async () => {
    const ok = await confirm({
      title: 'Xóa tất cả thông báo?',
      message: `${notifications.length} thông báo sẽ bị ẩn khỏi danh sách của bạn. Người khác vẫn nhận được bình thường.`,
      confirmLabel: 'Xóa tất cả',
      tone: 'warning'
    });
    if (ok) onClearAll();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-[5px] text-slate-600 dark:text-slate-300 hover:bg-[#dbeaf8] dark:hover:bg-slate-700 relative transition-colors focus:outline-hidden cursor-pointer"
        title={unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Thông báo'}
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] sm:w-96 bg-[#f8fafd] dark:bg-slate-900 border border-[#cbdcf0] dark:border-slate-800 rounded-[9px] shadow-xl z-50 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-4 py-2.5 bg-[#edf4fb] dark:bg-slate-800/60 border-b border-[#cbdcf0] dark:border-slate-800 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-200 truncate">
                  Thông báo {unreadCount > 0 && <span className="text-rose-600 dark:text-rose-400">({unreadCount} chưa đọc)</span>}
                </h4>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {onCompose && (
                  <button
                    onClick={() => { setIsOpen(false); onCompose(); }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    Gửi
                  </button>
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Đọc tất cả
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => void handleClearAll()}
                    className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Xóa tất cả
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Không có thông báo nào
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onMarkAsRead(item.id);
                      if ((item.linkFunction || item.linkModule) && onSelectNotification) {
                        onSelectNotification(item);
                        setIsOpen(false);
                      }
                    }}
                    className={`group relative p-3.5 pr-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex gap-3 items-start ${
                      !item.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    {getTypeIcon(item.type)}
                    <div className="grow min-w-0 text-xs space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`font-bold break-words ${!item.read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                          {!item.read && <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 mr-1.5 align-middle" aria-label="Chưa đọc" />}
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0" title={new Date(item.time).toLocaleString('vi-VN')}>
                          {formatRelativeTime(item.time)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug whitespace-pre-line break-words">
                        {item.message}
                      </p>
                      {(item.sender || item.linkDocumentId) && (
                        <p className="text-[10px] text-slate-400 flex flex-wrap gap-x-2">
                          {item.sender && <span>Gửi bởi {item.sender}</span>}
                          {item.linkDocumentId && <span className="text-indigo-500 dark:text-indigo-400 font-semibold">Mở phiếu {item.linkDocumentId} →</span>}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      title="Ẩn thông báo này"
                      aria-label="Ẩn thông báo này"
                      onClick={(e) => { e.stopPropagation(); onDismiss(item.id); }}
                      className="absolute top-2.5 right-2 p-0.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
