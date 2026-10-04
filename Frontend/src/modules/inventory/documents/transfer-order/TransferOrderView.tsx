import type { Product, Warehouse } from '../../../../types';
import { TransferVouchersView } from '../_shared/TransferVouchersView';

export function TransferOrderView(props: { products: Product[]; warehouses: Warehouse[] }) {
  return <TransferVouchersView typeFilter="order" {...props} />;
}
