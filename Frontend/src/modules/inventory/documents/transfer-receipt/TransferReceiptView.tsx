import type { CompanyUnit, UserProfile } from '../../../../types';
import { TransferVoucherView } from '../transfers/TransferVoucherView';

export function TransferReceiptView(props: { companyUnits?: CompanyUnit[]; activeUnitCode: string; currentUser?: UserProfile }) {
  return <TransferVoucherView kind="receipt" {...props} />;
}
