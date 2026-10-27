import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { CustomerRecord, SaveCustomerInput } from './types';

export const customersApi = createCatalogApi<CustomerRecord, SaveCustomerInput>({
  url: '/api/sales/customers', fileName: 'DanhMucKhachHang'
});
