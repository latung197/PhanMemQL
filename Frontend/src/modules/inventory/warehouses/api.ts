import { inventoryApi } from '../../../services/api';

export const warehousesApi = {
  getWarehouses: inventoryApi.getWarehouses,
  saveWarehouse: inventoryApi.saveWarehouse
};
