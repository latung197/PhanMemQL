import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface CustomerRecord {
  code: string;
  name: string;
  taxCode?: string | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  address?: string | null;
  customerGroupCode?: string | null;
  customerGroupName?: string | null;
  paymentTermCode?: string | null;
  paymentTermName?: string | null;
  /** In the base currency; 0 = no limit. */
  creditLimit: number;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveCustomerInput {
  code: string;
  name: string;
  taxCode: string;
  phone: string;
  email: string;
  contactName: string;
  address: string;
  customerGroupCode: string;
  paymentTermCode: string;
  creditLimit: number;
  note: string;
  isActive: boolean;
  version?: number;
}
