// Date display helpers shared by the screens (Vietnamese format).

/** "2026-09-30" → "30/09/2026". Returns the input unchanged when it is not a date. */
export const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

/** ISO date-time from the backend (UTC) → local "30/09/2026 14:05". */
export const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value
    : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
