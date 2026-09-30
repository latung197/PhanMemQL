import { GoodsVoucher } from '../../../types';
import { initialVouchers } from '../../../mock/initialERPData';

let receiptStore = initialVouchers.filter(v => v.type === 'Nhập kho');

export const goodsReceiptsApi = {
  async getAll(): Promise<GoodsVoucher[]> {
    return Promise.resolve([...receiptStore]);
  },
  async create(data: GoodsVoucher): Promise<GoodsVoucher> {
    receiptStore = [data, ...receiptStore];
    return Promise.resolve(data);
  },
  async approve(id: string, approvedBy: string): Promise<boolean> {
    receiptStore = receiptStore.map(v => v.id === id ? { ...v, status: 'Đã phê duyệt', approvedBy } : v);
    return Promise.resolve(true);
  }
};
