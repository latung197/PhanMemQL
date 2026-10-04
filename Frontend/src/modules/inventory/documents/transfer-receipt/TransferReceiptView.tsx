import type { Product, Warehouse } from '../../../../types';
import { TransferVouchersView } from '../_shared/TransferVouchersView';

export function TransferReceiptView(props: { products: Product[]; warehouses: Warehouse[] }) {
  return <TransferVouchersView typeFilter="receipt" {...props} />;
}
