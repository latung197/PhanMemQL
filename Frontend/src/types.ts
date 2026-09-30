// Re-export all types from types/index.ts
export * from './types/index';

import { SalesOrder, Transaction } from './types/index';

// Type aliases for convenient usage
export type Order = SalesOrder;
export type FinancialTransaction = Transaction;
