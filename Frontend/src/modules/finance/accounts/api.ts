// Tài chính › Hệ thống tài khoản kế toán (backend /api/finance/accounts, function fin_account_cat).
import { createCatalogApi } from '../../../components/catalog/createCatalogApi';
import type { AccountRecord, SaveAccountInput } from './types';

export const accountsApi = createCatalogApi<AccountRecord, SaveAccountInput>({
  url: '/api/finance/accounts', fileName: 'HeThongTaiKhoanKeToan'
});
