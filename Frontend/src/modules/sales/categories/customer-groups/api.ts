import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { CustomerGroupRecord, SaveCustomerGroupInput } from './types';

export const customerGroupsApi = createCatalogApi<CustomerGroupRecord, SaveCustomerGroupInput>({
  url: '/api/sales/customer-groups', fileName: 'DanhMucNhomKhachHang'
});
