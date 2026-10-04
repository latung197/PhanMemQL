import { GoodsVoucher } from '../../../../types';
import { initialVouchers } from '../../../../mock/initialERPData';

let issueStore = initialVouchers.filter(v => v.type === 'Xuất kho');

export const goodsIssuesApi = {
  async getAll(): Promise<GoodsVoucher[]> {
    return Promise.resolve([...issueStore]);
  },
  async create(data: GoodsVoucher): Promise<GoodsVoucher> {
    issueStore = [data, ...issueStore];
    return Promise.resolve(data);
  }
};
