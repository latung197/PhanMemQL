// Kho › Tính giá trung bình tháng (inv_calc_monthly_cost): giá bình quân gia quyền của một tháng, tính từ sổ kho (rpt_stock_monthly_cost).
// Chỉ để xem: không sửa giá của phiếu đã ghi sổ; giá vốn cuối kỳ của sổ kho (bình quân di động) hiện bên cạnh để so sánh.
import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import type { UserProfile } from '../../../types';
import { stockReportsApi } from './api';
import { CommonFilters, ReportFrame, filterInput, filterLabel, num, today, th, useDebouncedSearch, useReport, useRowLimit } from './ReportKit';

const thisMonth = () => today().slice(0, 7);

export const MonthlyCostView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { formatQuantity, formatCurrency } = useNumberFormat();
  const [month, setMonth] = useState(thisMonth());
  const [warehouse, setWarehouse] = useState('');
  const [group, setGroup] = useState('');
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedSearch(searchText);
  const [year, mon] = month.split('-');
  const filters = { year, month: String(Number(mon)), warehouse, materialGroup: group, search };
  const { data, loading, error, reload } = useReport(() => stockReportsApi.monthlyCost(filters), JSON.stringify(filters));
  const rows = data ?? [];
  const { visible, footer } = useRowLimit(rows);
  const canSeeMoney = rows.length === 0 || rows.some(r => r.closingValue !== null);
  const sum = (pick: (r: (typeof rows)[number]) => number | null) => rows.reduce((s, r) => s + (pick(r) ?? 0), 0);
  const money = (v: number | null) => num(v, x => formatCurrency(x, false));
  const cost = (v: number | null) => num(v, x => formatCurrency(x, false));

  return (
    <ReportFrame
      functionCode="inv_calc_monthly_cost" currentUser={currentUser} icon={<Calculator className="h-5 w-5" />}
      title="Giá trung bình tháng" countLabel="dòng" count={rows.length}
      activeFilterCount={[warehouse, group, searchText].filter(Boolean).length}
      onClear={() => { setWarehouse(''); setGroup(''); setSearchText(''); setMonth(thisMonth()); }}
      onRefresh={() => void reload()} onExport={() => stockReportsApi.exportFile('monthly-cost', filters)}
      filterSummary={`Tháng ${mon}/${year}${warehouse ? ` · Kho: ${warehouse}` : ''}${group ? ` · Nhóm: ${group}` : ''}`}
      canSeeMoney={canSeeMoney}
      cards={canSeeMoney ? [
        { title: 'Giá trị tồn đầu', value: formatCurrency(sum(r => r.openingValue), false) },
        { title: 'Giá trị nhập', value: formatCurrency(sum(r => r.inValue), false), tone: 'text-emerald-600' },
        { title: 'Giá trị xuất', value: formatCurrency(sum(r => r.outValue), false), tone: 'text-rose-600' },
        { title: 'Giá trị tồn cuối', value: formatCurrency(sum(r => r.closingValue), false) }
      ] : undefined}
      loading={loading} error={error} empty={rows.length === 0} emptyTitle="Không có tồn hay phát sinh trong tháng" emptyDescription="Đổi tháng hoặc bộ lọc."
      filters={<>
        <div><label className={filterLabel}>Tháng</label><input type="month" value={month} onChange={e => setMonth(e.target.value || thisMonth())} className={filterInput} /></div>
        <CommonFilters warehouse={warehouse} onWarehouse={setWarehouse} group={group} onGroup={setGroup} search={searchText} onSearch={setSearchText} />
      </>}
    >
      <p className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
        Giá bình quân tháng = (giá trị tồn đầu + giá trị nhập) / (số lượng tồn đầu + số lượng nhập). Báo cáo chỉ để xem và đối chiếu: giá xuất của phiếu đã ghi sổ không bị tính lại.
      </p>
      <table className="w-full text-xs text-left">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold">
          <tr>
            <th className={th} rowSpan={2}>Kho</th><th className={th} rowSpan={2}>Mã vật tư</th><th className={th} rowSpan={2}>Tên vật tư</th><th className={th} rowSpan={2}>ĐVT</th>
            <th className={`${th} text-center`} colSpan={2}>Tồn đầu</th><th className={`${th} text-center`} colSpan={2}>Nhập</th>
            <th className={`${th} text-right`} rowSpan={2}>Giá BQ tháng</th>
            <th className={`${th} text-center`} colSpan={2}>Xuất</th><th className={`${th} text-center`} colSpan={2}>Tồn cuối</th>
            <th className={`${th} text-right`} rowSpan={2}>Giá vốn cuối kỳ</th>
          </tr>
          <tr>{['SL', 'Giá trị', 'SL', 'Giá trị', 'SL', 'Giá trị', 'SL', 'Giá trị'].map((h, i) => <th key={i} className={`${th} text-right`}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map(r => (
            <tr key={`${r.warehouseCode}|${r.materialCode}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className={th}>{r.warehouseCode}</td><td className={`${th} font-mono font-bold`}>{r.materialCode}</td><td className={th}>{r.materialName}</td><td className={th}>{r.uomCode}</td>
              <td className={`${th} text-right font-mono`}>{formatQuantity(r.openingQuantity)}</td><td className={`${th} text-right font-mono`}>{money(r.openingValue)}</td>
              <td className={`${th} text-right font-mono text-emerald-700 dark:text-emerald-400`}>{formatQuantity(r.inQuantity)}</td><td className={`${th} text-right font-mono`}>{money(r.inValue)}</td>
              <td className={`${th} text-right font-mono font-bold text-brand-700 dark:text-brand-300`}>{cost(r.monthAverageCost)}</td>
              <td className={`${th} text-right font-mono text-rose-700 dark:text-rose-400`}>{formatQuantity(r.outQuantity)}</td><td className={`${th} text-right font-mono`}>{money(r.outValue)}</td>
              <td className={`${th} text-right font-mono font-bold`}>{formatQuantity(r.closingQuantity)}</td><td className={`${th} text-right font-mono font-bold`}>{money(r.closingValue)}</td>
              <td className={`${th} text-right font-mono`}>{cost(r.closingCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </ReportFrame>
  );
};
