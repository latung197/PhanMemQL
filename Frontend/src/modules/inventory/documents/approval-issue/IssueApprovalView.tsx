import type { UserProfile } from '../../../../types';
import { InventoryApprovalView } from '../_shared/InventoryApprovalView';

export function IssueApprovalView({ currentUser }: { currentUser?: UserProfile }) {
  return <InventoryApprovalView typeFilter="issue" currentUser={currentUser} />;
}
