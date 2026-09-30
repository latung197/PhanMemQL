// The single place that decides what a user may see and do. The backend sends every
// function code in user.permissions; a missing code therefore means "no access".
import { ActionPermissions, SubMenuKey, UserProfile } from '../types';

export const FULL_ACTIONS: ActionPermissions = {
  view: true,
  createEdit: true,
  delete: true,
  approve: true,
  printExport: true
};

export const FORBIDDEN_ACTIONS: ActionPermissions = {
  view: false,
  createEdit: false,
  delete: false,
  approve: false,
  printExport: false
};

type PermissionHolder = Pick<UserProfile, 'isSystemAdmin' | 'permissions'> | null | undefined;

export function getActionPermission(user: PermissionHolder, subKey: SubMenuKey): ActionPermissions {
  if (!user) return FORBIDDEN_ACTIONS;
  if (user.isSystemAdmin) return FULL_ACTIONS;
  const perm = user.permissions?.[subKey];
  if (perm === true) return FULL_ACTIONS;
  if (!perm) return subKey === 'overview_main' ? { ...FORBIDDEN_ACTIONS, view: true } : FORBIDDEN_ACTIONS;
  return {
    view: !!perm.view || subKey === 'overview_main',
    createEdit: !!perm.createEdit,
    delete: !!perm.delete,
    approve: !!perm.approve,
    printExport: !!perm.printExport
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

/** Menu visibility and the screen guard. The overview is the landing page, so it is always visible. */
export const canView = (user: PermissionHolder, subKey: SubMenuKey): boolean =>
  getActionPermission(user, subKey).view;
