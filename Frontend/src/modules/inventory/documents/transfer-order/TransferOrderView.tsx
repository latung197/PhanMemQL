import type { CompanyUnit, UserProfile } from '../../../../types';
import { TransferVoucherView } from '../transfers/TransferVoucherView';

export function TransferOrderView(props: { companyUnits?: CompanyUnit[]; activeUnitCode: string; currentUser?: UserProfile }) {
  return <TransferVoucherView kind="order" {...props} />;
}
