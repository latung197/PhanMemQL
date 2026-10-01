// Header notification bell (backend: /api/notifications).
import { apiRequest } from './apiClient';
import { storedLanguage, translate } from '../utils/i18n';
import { ModuleCategoryKey, SystemNotification } from '../types';

export interface PublishNotificationInput {
  title: string;
  message: string;
  type: SystemNotification['type'];
  linkModule?: ModuleCategoryKey | null;
  /** null = every company unit */
  unitCode?: string | null;
  /** null = every user */
  recipientUserId?: number | null;
  expiresAt?: string | null;
}

/** Who may send and where; mirrors the backend rights on overview_main. */
export interface NotificationSendScope { canSend: boolean; allUnits: boolean; unitCode: string }

export interface NotificationRecipient { id: number; userName: string; fullName: string; department: string }

export const notificationService = {
  getInbox: () => apiRequest<SystemNotification[]>('GET', '/api/notifications'),
  markRead: (id: string) => apiRequest<void>('PUT', `/api/notifications/${id}/read`),
  markAllRead: () => apiRequest<{ count: number }>('PUT', '/api/notifications/read-all'),
  /** Hides one notification from the current user's list. */
  dismiss: (id: string) => apiRequest<void>('DELETE', `/api/notifications/${id}`),
  /** Hides every notification from the current user's list. */
  dismissAll: () => apiRequest<{ count: number }>('DELETE', '/api/notifications'),
  publish: (input: PublishNotificationInput) => apiRequest<SystemNotification>('POST', '/api/notifications', input),
  getSendScope: () => apiRequest<NotificationSendScope>('GET', '/api/notifications/send-scope'),
  /** Active users of the unit (empty = every unit, only for senders allowed to reach all units). */
  getRecipients: (unitCode?: string) =>
    apiRequest<NotificationRecipient[]>('GET', `/api/notifications/recipients${unitCode ? `?unitCode=${encodeURIComponent(unitCode)}` : ''}`)
};

/** "5 phút trước" style label for the notification time (ISO string from the backend), in the user's language. */
export const formatRelativeTime = (iso: string): string => {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return translate('time.justNow');
  if (minutes < 60) return translate('time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate('time.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return translate('time.daysAgo', { n: days });
  return new Date(iso).toLocaleDateString(storedLanguage());
};
