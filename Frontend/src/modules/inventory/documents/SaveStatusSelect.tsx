// "Save at status" choice of a voucher form (its "Trạng thái" field). The workflow stays (send for approval, approve, post) but a user whose rights reach a
// status may save the voucher straight there: the server runs the same steps in one transaction and refuses what the rights or
// the approval rules do not allow. Draft is always available.

export type SaveStatus = 'Draft' | 'Pending' | 'Approved' | 'Posted';

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  Draft: 'Lập chứng từ', Pending: 'Chờ duyệt', Approved: 'Đã phê duyệt', Posted: 'Chuyển sổ kho'
};

/** The statuses a user may ask for, from their rights on the voucher function (the server checks again). */
export const saveStatusChoices = (rights: { create: boolean; edit: boolean; approve: boolean; canPost: boolean }): SaveStatus[] => {
  const choices: SaveStatus[] = ['Draft'];
  if (rights.create || rights.edit) choices.push('Pending');
  if (rights.approve) choices.push('Approved');
  if (rights.approve && rights.canPost) choices.push('Posted');
  return choices;
};
