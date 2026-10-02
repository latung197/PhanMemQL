// The single place that decides what a user may see and do. The backend sends every
// function code in user.permissions; a missing code therefore means "no access".
import { ActionPermissions, SubMenuKey, UserProfile } from '../types';

export const FULL_ACTIONS: ActionPermissions = {
  view: true, create: true, edit: true, delete: true, approve: true, print: true, export: true
};

export const FORBIDDEN_ACTIONS: ActionPermissions = {
  view: false, create: false, edit: false, delete: false, approve: false, print: false, export: false
};

/** Data saved before Thêm/Sửa and In/Xuất were split (mock data in localStorage) has createEdit / printExport. */
type LegacyActions = Partial<ActionPermissions> & { createEdit?: boolean; printExport?: boolean };

type PermissionHolder = Pick<UserProfile, 'isSystemAdmin' | 'permissions'> | null | undefined;

export function getActionPermission(user: PermissionHolder, subKey: SubMenuKey): ActionPermissions {
  if (!user) return FORBIDDEN_ACTIONS;
  if (user.isSystemAdmin) return FULL_ACTIONS;
  const perm = user.permissions?.[subKey];
  if (perm === true) return FULL_ACTIONS;
  if (!perm) return subKey === 'overview_main' ? { ...FORBIDDEN_ACTIONS, view: true } : FORBIDDEN_ACTIONS;
  const p = perm as LegacyActions;
  return {
    view: !!p.view || subKey === 'overview_main',
    create: !!(p.create ?? p.createEdit),
    edit: !!(p.edit ?? p.createEdit),
    delete: !!p.delete,
    approve: !!p.approve,
    print: !!(p.print ?? p.printExport),
    export: !!(p.export ?? p.printExport)
  };
}

/**
 * Special right such as "xem giá" (backend SpecialRightCatalog), e.g. hasRight(user, 'inv_receipt', 'VIEW_PRICE').
 * Administrators have every right.
 */
export const hasRight = (user: Pick<UserProfile, 'isSystemAdmin' | 'specialRights'> | null | undefined,
  subKey: SubMenuKey, rightCode: string): boolean =>
  !!user && (!!user.isSystemAdmin || !!user.specialRights?.includes(`${subKey}:${rightCode}`));

/** Codes of the special rights, same as the backend. */
export const RIGHTS = {
  VIEW_PRICE: 'VIEW_PRICE',
  VIEW_COST: 'VIEW_COST',
  VIEW_ALL: 'VIEW_ALL',
  EDIT_PENDING: 'EDIT_PENDING',
  EDIT_APPROVED: 'EDIT_APPROVED',
  POST: 'POST',
  UNPOST: 'UNPOST',
  CANCEL: 'CANCEL',
  /** On overview_main: send notifications inside the current unit / to every unit. */
  SEND_NOTIFICATION: 'SEND_NOTIFICATION',
  SEND_NOTIFICATION_ALL: 'SEND_NOTIFICATION_ALL'
} as const;

/**
 * Approval screens ("Phê duyệt" menu) and the vouchers they approve. Same list as the backend
 * VoucherCatalog.ApprovalScreens: "Duyệt" on the screen approves those vouchers like "Duyệt" on the voucher.
 */
export const APPROVAL_SCREENS: Partial<Record<SubMenuKey, SubMenuKey[]>> = {
  inv_approve_receipt: ['inv_receipt'],
  inv_approve_issue: ['inv_issue'],
  inv_approve_transfer: ['inv_transfer_order', 'inv_transfer_issue', 'inv_transfer_receipt']
};

const approvalScreensOf = (voucher: SubMenuKey): SubMenuKey[] =>
  (Object.keys(APPROVAL_SCREENS) as SubMenuKey[]).filter(screen => APPROVAL_SCREENS[screen]!.includes(voucher));

/** "Duyệt" on the voucher or on one of its approval screens (backend PermissionMatrix.CanApprove). */
export const canApproveVoucher = (user: PermissionHolder, voucher: SubMenuKey): boolean =>
  getActionPermission(user, voucher).approve
  || approvalScreensOf(voucher).some(screen => getActionPermission(user, screen).approve);

/** Menu visibility and the screen guard. The overview is the landing page, so it is always visible. */
export const canView = (user: PermissionHolder, subKey: SubMenuKey): boolean =>
  getActionPermission(user, subKey).view;
