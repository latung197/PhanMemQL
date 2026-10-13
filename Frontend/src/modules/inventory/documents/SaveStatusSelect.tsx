// "Save at status" choice of a voucher form (its "Trạng thái" field). The workflow stays (send for approval, approve, post) but a user whose rights reach a
// status may save the voucher straight there: the server runs the same steps in one transaction and refuses what the rights or
// the approval rules do not allow. Draft is always available. The status rights are granted per company unit (ST_*): a right for a
// later status includes the steps before it. A unit that switched the approval step off has no "Chờ duyệt" choice and approving needs
// no approver.
import { voucherStatusService } from '../../../services/voucherStatusService';
import type { SubMenuKey, UserProfile } from '../../../types';
import { reachesStatus } from '../../../utils/documentPolicy';
import { canApproveVoucher, getActionPermission } from '../../../utils/permissions';

export type SaveStatus = 'Draft' | 'Pending' | 'Approved' | 'Posted';

/** The labels the voucher screens keep their statuses under (what the API mapping puts in `status`); the names a unit chose are shown instead. */
export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  Draft: 'Lập chứng từ', Pending: 'Chờ duyệt', Approved: 'Đã phê duyệt', Posted: 'Chuyển sổ kho'
};

/** Name of a status as the company unit set it (Settings › Trạng thái chứng từ); the fixed label until the names are loaded. */
export const saveStatusName = (voucherType: string, status: SaveStatus): string =>
  voucherStatusService.name(voucherType, status, SAVE_STATUS_LABELS[status]);

type ChoiceUser = Pick<UserProfile, 'isSystemAdmin' | 'permissions' | 'specialRights' | 'ma_dvcs'> | null | undefined;

/**
 * The statuses a user may ask for in the unit they work in, from their rights on the voucher function (the server checks again):
 * Pending needs the pending right (or a later one) and the step in use; Approved the approved right and, while the approval step is
 * in use, being an approver; Posted the posted right too (only for vouchers that post).
 */
export const saveStatusChoices = (user: ChoiceUser, fn: SubMenuKey, options: { voucherType: string; posts: boolean }): SaveStatus[] => {
  const choices: SaveStatus[] = ['Draft'];
  const actions = getActionPermission(user, fn);
  if (!(actions.create || actions.edit)) return choices;
  const approvalInUse = voucherStatusService.isEnabled(options.voucherType, 'Pending');
  const mayApprove = !approvalInUse || canApproveVoucher(user, fn);
  if (approvalInUse && reachesStatus(user, fn, 'Pending')) choices.push('Pending');
  if (mayApprove && reachesStatus(user, fn, 'Approved')) choices.push('Approved');
  if (options.posts && mayApprove && reachesStatus(user, fn, 'Posted')) choices.push('Posted');
  return choices;
};
