// The labels the voucher screens keep their statuses under (what the API mapping puts in `status`) and the small rules that read
// them: which labels are "in approval", which can be posted, the approval levels a unit uses and whether the user may take the
// voucher to the next one. The names a company unit gave the statuses (Settings › Trạng thái chứng từ) are shown instead of the
// labels by `saveStatusName` / `VoucherStatusBadge`; the labels themselves never change.
import { voucherStatusService } from '../../../services/voucherStatusService';
import type { SubMenuKey, UserProfile } from '../../../types';
import { APPROVAL_CHAIN, inApproval, reachesStatus, type DocumentStatus } from '../../../utils/documentPolicy';
import { SAVE_STATUS_LABELS, saveStatusName } from './SaveStatusSelect';

type RightsUser = Pick<UserProfile, 'isSystemAdmin' | 'permissions' | 'specialRights' | 'ma_dvcs'> | null | undefined;

/** Status label of a voucher screen → status of the policy. */
export const STATUS_OF_LABEL: Record<string, DocumentStatus> = {
  'Lập chứng từ': 'Draft', 'Chờ duyệt': 'Pending', 'Duyệt cấp 1': 'Approved1', 'Duyệt cấp 2': 'Approved2',
  'Đã phê duyệt': 'Approved', 'Chuyển sổ kho': 'Posted', 'Hủy': 'Cancelled'
};

/** Sent for approval and not approved to the end yet (Chờ duyệt, Duyệt cấp 1, Duyệt cấp 2). */
export const isInApprovalLabel = (label?: string | null): boolean => !!label && !!STATUS_OF_LABEL[label] && inApproval(STATUS_OF_LABEL[label]);

/** Labels of the statuses a voucher can be posted from: a draft, in approval or approved (the missing approval steps are recorded first). */
export const POSTABLE_LABELS: string[] = ['Lập chứng từ', 'Chờ duyệt', 'Duyệt cấp 1', 'Duyệt cấp 2', 'Đã phê duyệt'];

/**
 * The options of the two intermediate approval levels for a status filter or a status select, named as the unit named them.
 * Only the levels the unit switched on, unless `all` (a form that must still show the status of a voucher saved at a level the
 * unit has since switched off).
 */
export const approvalLevelOptions = (voucherType: string, all = false): { value: string; label: string }[] =>
  (['Approved1', 'Approved2'] as const)
    .filter(level => all || voucherStatusService.isEnabled(voucherType, level))
    .map(level => ({ value: SAVE_STATUS_LABELS[level], label: saveStatusName(voucherType, level) }));

/**
 * The "Duyệt" button of a voucher in the list: the voucher is in approval and the user reaches the next approval step the unit uses
 * after its status (a right for a later step includes the earlier ones, so the next step is enough). Mirror of the backend
 * `ApproveNextAsync`; the server checks again.
 */
export const canApproveVoucher = (user: RightsUser, fn: SubMenuKey, voucherType: string, label?: string | null): boolean => {
  if (!isInApprovalLabel(label)) return false;
  const status = STATUS_OF_LABEL[label!];
  // Pending has no place in the chain: the first level is next.
  const position = APPROVAL_CHAIN.indexOf(status);
  const next = voucherStatusService.approvalLevels(voucherType).find(level => APPROVAL_CHAIN.indexOf(level) > position);
  return !!next && reachesStatus(user, fn, next);
};
