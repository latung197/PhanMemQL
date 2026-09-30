// What a user may do with a voucher (chứng từ) in each status. Mirror of the backend
// Core.Application/Common/Permissions/DocumentStatusPolicy.cs: keep the two in step (same rules and
// messages). The frontend uses it to enable buttons; the backend checks the same rules again.
import { SubMenuKey, UserProfile } from '../types';
import { getActionPermission, hasRight, RIGHTS } from './permissions';

/** Voucher life cycle: Lập → Chờ duyệt → Đã duyệt → Đã ghi sổ, or Hủy. Same names as the backend enum. */
export type DocumentStatus = 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Cancelled';

export type DocumentAction = 'View' | 'Edit' | 'Submit' | 'Approve' | 'Reject' | 'Post' | 'Unpost' | 'Cancel';

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  Draft: 'Lập chứng từ',
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt',
  Posted: 'Đã ghi sổ',
  Cancelled: 'Đã hủy'
};

/** Status labels used by the demo voucher screens → policy status. */
export const statusFromLabel = (label?: string | null): DocumentStatus => {
  switch (label) {
    case 'Chờ duyệt': return 'Pending';
    case 'Đã duyệt':
    case 'Đã phê duyệt': return 'Approved';
    case 'Đã ghi sổ':
    case 'Chuyển sổ kho': return 'Posted';
    case 'Hủy':
    case 'Đã hủy': return 'Cancelled';
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
const deny = (reason: string): PolicyDecision => ({ allowed: false, reason });

/**
 * Whether `user` may perform `action` on a voucher of function `fn` in `status`.
 * isOwner = the user created the voucher. Approve / Reject also need the user to be an approver of the
 * current level; that part is decided by the backend approval API (DocumentApprovalDto.canAct).
 */
export function checkDocumentAction(user: PolicyUser, fn: SubMenuKey, action: DocumentAction,
  status: DocumentStatus, isOwner: boolean): PolicyDecision {
  const a = getActionPermission(user, fn);
  const has = (code: string) => hasRight(user, fn, code);
  if (!a.view) return deny('Không có quyền xem chức năng này.');
  if (!isOwner && !has(RIGHTS.VIEW_ALL)) return deny('Chỉ được thao tác trên phiếu do mình lập.');

  switch (action) {
    case 'View':
      return allow;

    case 'Edit':
      switch (status) {
        case 'Draft': return a.createEdit ? allow : deny('Không có quyền sửa phiếu.');
        case 'Pending': return a.createEdit && has(RIGHTS.EDIT_PENDING)
          ? allow : deny('Phiếu đang chờ duyệt; cần quyền "Sửa phiếu đang chờ duyệt".');
        case 'Approved': return a.createEdit && has(RIGHTS.EDIT_APPROVED)
          ? allow : deny('Phiếu đã duyệt; cần quyền "Sửa phiếu đã duyệt".');
        case 'Posted': return deny('Phiếu đã ghi sổ; phải bỏ ghi sổ trước khi sửa.');
        default: return deny('Phiếu đã hủy.');
      }

    case 'Submit':
      return status === 'Draft' && a.createEdit ? allow : deny('Chỉ trình duyệt được phiếu đang lập.');

    case 'Approve':
    case 'Reject':
      if (status !== 'Pending') return deny('Phiếu không ở trạng thái chờ duyệt.');
      if (isOwner) return deny('Không được tự duyệt phiếu do mình lập.');
      return a.approve ? allow : deny('Không có quyền phê duyệt.');

    case 'Post':
      return status === 'Approved' && has(RIGHTS.POST) ? allow : deny('Chỉ ghi sổ phiếu đã duyệt; cần quyền "Ghi sổ".');

    case 'Unpost':
      return status === 'Posted' && has(RIGHTS.UNPOST) ? allow : deny('Cần quyền "Bỏ ghi sổ".');

    case 'Cancel':
      if (status === 'Posted') return deny('Phiếu đã ghi sổ; phải bỏ ghi sổ trước khi hủy.');
      if (status === 'Cancelled') return deny('Phiếu đã hủy.');
      if (status === 'Draft' && isOwner && a.delete) return allow;
      return has(RIGHTS.CANCEL) ? allow : deny('Cần quyền "Hủy phiếu".');

    default:
      return deny('Thao tác không hợp lệ.');
  }
}

const ALL_ACTIONS: DocumentAction[] = ['View', 'Edit', 'Submit', 'Approve', 'Reject', 'Post', 'Unpost', 'Cancel'];

/** Every action at once, e.g. `const can = documentActions(user, 'inv_receipt', status, isOwner); can.Edit.allowed`. */
export const documentActions = (user: PolicyUser, fn: SubMenuKey, status: DocumentStatus, isOwner: boolean) =>
  Object.fromEntries(ALL_ACTIONS.map(action => [action, checkDocumentAction(user, fn, action, status, isOwner)])) as
    Record<DocumentAction, PolicyDecision>;
