// What a user may do with a voucher (chứng từ) in each status. Mirror of the backend
// Core.Application/Common/Permissions/DocumentStatusPolicy.cs: keep the two in step (same rules and
// messages). The frontend uses it to enable buttons; the backend checks the same rules again.
import { SubMenuKey, UserProfile } from '../types';
import { canApproveVoucher, getActionPermission, hasRight, RIGHTS } from './permissions';
import { translate } from './i18n';

/** Voucher life cycle: Lập → Chờ duyệt → Đã duyệt → Đã ghi sổ, or Hủy. Same names as the backend enum. */
export type DocumentStatus = 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Cancelled';

export type DocumentAction = 'View' | 'Edit' | 'Submit' | 'Approve' | 'Reject' | 'Post' | 'Unpost' | 'Cancel';

/** Name of a status in the user's language (texts: documentPolicy.status.*). */
export const documentStatusLabel = (status: DocumentStatus): string => translate(`documentPolicy.status.${status}`);

/** Status labels used by the demo voucher screens → policy status. */
export const statusFromLabel = (label?: string | null): DocumentStatus => {
  switch (label) {
    case 'Chờ duyệt': return 'Pending';  // i18n-ignore: stored demo status
    case 'Đã duyệt':  // i18n-ignore: stored demo status
    case 'Đã phê duyệt': return 'Approved';  // i18n-ignore: stored demo status
    case 'Đã ghi sổ':  // i18n-ignore: stored demo status
    case 'Chuyển sổ kho': return 'Posted';  // i18n-ignore: stored demo status
    case 'Hủy':  // i18n-ignore: stored demo status
    case 'Đã hủy': return 'Cancelled';  // i18n-ignore: stored demo status
    default: return 'Draft';
  }
};

export interface PolicyDecision {
  allowed: boolean;
  /** Why not, to show as a tooltip or message. */
  reason?: string;
}

type PolicyUser = Pick<UserProfile, 'isSystemAdmin' | 'permissions' | 'specialRights'> | null | undefined;

const allow: PolicyDecision = { allowed: true };
/** Refusal with the reason in the user's language (documentPolicy.deny.<key>). */
const deny = (reasonKey: string): PolicyDecision => ({ allowed: false, reason: translate(`documentPolicy.deny.${reasonKey}`) });

/**
 * Whether `user` may perform `action` on a voucher of function `fn` in `status`.
 * isOwner = the user created the voucher. Approve / Reject also need the user to be an approver of the
 * current level; that part is decided by the backend approval API (DocumentApprovalDto.canAct). They need
 * neither "Xem" on the voucher nor VIEW_ALL, so an approver working from an approval screen can act.
 */
export function checkDocumentAction(user: PolicyUser, fn: SubMenuKey, action: DocumentAction,
  status: DocumentStatus, isOwner: boolean): PolicyDecision {
  const a = getActionPermission(user, fn);
  const has = (code: string) => hasRight(user, fn, code);
  if (action === 'Approve' || action === 'Reject') {
    if (status !== 'Pending') return deny('notPending');
    if (isOwner) return deny('ownVoucher');
    return canApproveVoucher(user, fn) ? allow : deny('noApproveRight');
  }

  if (!a.view) return deny('noViewRight');
  if (!isOwner && !has(RIGHTS.VIEW_ALL)) return deny('ownOnly');

  switch (action) {
    case 'View':
      return allow;

    case 'Edit':
      switch (status) {
        case 'Draft': return a.createEdit ? allow : deny('noEditRight');
        case 'Pending': return a.createEdit && has(RIGHTS.EDIT_PENDING)
          ? allow : deny('editPending');
        case 'Approved': return a.createEdit && has(RIGHTS.EDIT_APPROVED)
          ? allow : deny('editApproved');
        case 'Posted': return deny('postedNoEdit');
        default: return deny('cancelled');
      }

    case 'Submit':
      return status === 'Draft' && a.createEdit ? allow : deny('submitDraftOnly');

    case 'Post':
      return status === 'Approved' && has(RIGHTS.POST) ? allow : deny('postApprovedOnly');

    case 'Unpost':
      return status === 'Posted' && has(RIGHTS.UNPOST) ? allow : deny('unpostRight');

    case 'Cancel':
      if (status === 'Posted') return deny('postedNoCancel');
      if (status === 'Cancelled') return deny('cancelled');
      if (status === 'Draft' && isOwner && a.delete) return allow;
      return has(RIGHTS.CANCEL) ? allow : deny('cancelRight');

    default:
      return deny('invalidAction');
  }
}

const ALL_ACTIONS: DocumentAction[] = ['View', 'Edit', 'Submit', 'Approve', 'Reject', 'Post', 'Unpost', 'Cancel'];

/** Every action at once, e.g. `const can = documentActions(user, 'inv_receipt', status, isOwner); can.Edit.allowed`. */
export const documentActions = (user: PolicyUser, fn: SubMenuKey, status: DocumentStatus, isOwner: boolean) =>
  Object.fromEntries(ALL_ACTIONS.map(action => [action, checkDocumentAction(user, fn, action, status, isOwner)])) as
    Record<DocumentAction, PolicyDecision>;
