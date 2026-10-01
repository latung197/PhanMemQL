/**
 * Checks src/utils/documentPolicy.ts against the cases the backend tests use
 * (ServerService/tests/Core.Tests/Common/DocumentPolicyCases.json), so the two policies stay the same.
 *
 *   npm run check-policy
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDocumentAction, DocumentAction, DocumentStatus } from '../src/utils/documentPolicy';
import type { ActionPermissions } from '../src/types';

interface PolicyCase {
  name: string;
  action: DocumentAction;
  status: DocumentStatus;
  isOwner: boolean;
  actions: (keyof ActionPermissions)[];
  /** Actions on the approval screen of the voucher (inv_approve_receipt). */
  screenActions?: (keyof ActionPermissions)[];
  rights: string[];
  allowed: boolean;
}

const toActions = (keys: (keyof ActionPermissions)[] = []): ActionPermissions => {
  const permissions: ActionPermissions = { view: false, createEdit: false, delete: false, approve: false, printExport: false };
  keys.forEach(a => { permissions[a] = true; });
  return permissions;
};

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../ServerService/tests/Core.Tests/Common/DocumentPolicyCases.json');
const { cases } = JSON.parse(readFileSync(file, 'utf8')) as { cases: PolicyCase[] };
const fn = 'inv_receipt';

const failures = cases.filter(c => {
  const permissions = { [fn]: toActions(c.actions), inv_approve_receipt: toActions(c.screenActions) };
  const user = { isSystemAdmin: false, permissions, specialRights: c.rights.map(r => `${fn}:${r}`) };
  return checkDocumentAction(user, fn, c.action, c.status, c.isOwner).allowed !== c.allowed;
});

failures.forEach(c => console.error(`SAI: ${c.name} (${c.action} / ${c.status}) — mong đợi ${c.allowed ? 'được phép' : 'bị chặn'}`));
console.log(`${cases.length - failures.length}/${cases.length} ca khớp với backend.`);
process.exit(failures.length > 0 ? 1 : 0);
