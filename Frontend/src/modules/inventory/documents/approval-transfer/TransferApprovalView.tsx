import type { UserProfile } from '../../../../types';
import { InventoryApprovalView } from '../_shared/InventoryApprovalView';

export function TransferApprovalView({ currentUser }: { currentUser?: UserProfile }) {
  return <InventoryApprovalView typeFilter="transfer" currentUser={currentUser} />;
}
