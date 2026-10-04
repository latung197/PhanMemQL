import type { Product, Warehouse } from '../../../../types';
import { TransferVouchersView } from '../_shared/TransferVouchersView';

export function TransferIssueView(props: { products: Product[]; warehouses: Warehouse[] }) {
  return <TransferVouchersView typeFilter="issue" {...props} />;
}
