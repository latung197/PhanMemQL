import type { RecordStamp } from '../../../components/common/RecordStamp';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COST' | 'OTHER_INCOME' | 'OTHER_EXPENSE' | 'PROFIT_LOSS' | 'OFF_BALANCE';
export type AccountNature = 'DEBIT' | 'CREDIT' | 'BOTH';

export const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COST', 'OTHER_INCOME', 'OTHER_EXPENSE', 'PROFIT_LOSS', 'OFF_BALANCE'];
export const ACCOUNT_NATURES: AccountNature[] = ['DEBIT', 'CREDIT', 'BOTH'];

/** An account of the chart (erp_account); the code is the key. */
export interface AccountRecord {
  code: string;
  name: string;
  nameEn?: string | null;
  parentAccountCode?: string | null;
  parentAccountName?: string | null;
  /** 1 for a first level account, parent level + 1 below it. */
  level: number;
  accountType: AccountType;
  nature: AccountNature;
  /** Other accounts have this one as their parent: it only adds them up and is not posted to. */
  hasChildren: boolean;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveAccountInput {
  code: string;
  name: string;
  nameEn: string;
  parentAccountCode: string;
  accountType: AccountType;
  nature: AccountNature;
  note: string;
  isActive: boolean;
  version?: number;
}
