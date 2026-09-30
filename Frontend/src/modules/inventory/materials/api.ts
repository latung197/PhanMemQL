import { inventoryApi } from '../../../services/api';

export const materialsApi = {
  getMaterials: inventoryApi.getMaterials,
  saveMaterial: inventoryApi.saveMaterial,
  deleteMaterial: inventoryApi.deleteMaterial
};
