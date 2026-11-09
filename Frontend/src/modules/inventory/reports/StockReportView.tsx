// Kho › Báo cáo tồn kho: số lượng và giá trị tồn của từng vật tư trong từng kho đến một ngày, đọc từ sổ kho (rpt_stock_balance).
import React, { useState } from 'react';
import { Boxes } from 'lucide-react';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import type { UserProfile } from '../../../types';
import { stockReportsApi, type StockRow } from './api';
import { CommonFilters, ReportFrame, filterInput, filterLabel, num, today, th, useDebouncedSearch, useReport, useRowLimit } from './ReportKit';

const LEVELS: Record<StockRow['level'], { text: string; cls: string }> = {
  below: { text: 'Dưới tối thiểu', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  over: { text: 'Vượt tối đa', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  ok: { text: 'Trong định mức', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  none: { text: '', cls: '' }
};

export const StockReportView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { formatQuantity, formatCurrency } = useNumberFormat();
  const [asOf, setAsOf] = useState(today());
  const [warehouse, setWarehouse] = useState('');
  const [group, setGroup] = useState('');
  const [searchText, setSearchText] = useState('');
  const [includeZero, setIncludeZero] = useState(false);
  const search = useDebouncedSearch(searchText);
  const filters = { asOf, warehouse, materialGroup: group, search, includeZero };
  const { data, loading, error, reload } = useReport(() => stockReportsApi.stock(filters), JSON.stringify(filters));
  const rows = data ?? [];
  const { visible, footer } = useRowLimit(rows);
  const canSeeMoney = rows.length === 0 || rows.some(r => r.value !== null);
  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const below = rows.filter(r => r.level === 'below').length;
  const money = (v: number | null) => num(v, x => formatCurrency(x, false));

  return (
    <ReportFrame
      functionCode="inv_report_stock" currentUser={currentUser} icon={<Boxes className="h-5 w-5" />}
      title="Báo cáo tồn kho" countLabel="dòng" count={rows.length}
      activeFilterCount={[warehouse, group, searchText, includeZero ? 'x' : ''].filter(Boolean).length}
      onClear={() => { setWarehouse(''); setGroup(''); setSearchText(''); setIncludeZero(false); setAsOf(today()); }}
      onRefresh={() => void reload()} onExport={() => stockReportsApi.exportFile('stock', filters)}
      filterSummary={`Tồn đến ngày ${asOf.split('-').reverse().join('/')}${warehouse ? ` · Kho: ${warehouse}` : ''}${group ? ` · Nhóm: ${group}` : ''}`}
      canSeeMoney={canSeeMoney}
      cards={[
        { title: 'Số dòng tồn', value: rows.length.toLocaleString('vi-VN') },
        { title: 'Tổng giá trị tồn', value: canSeeMoney ? formatCurrency(totalValue, false) : '—' },
        { title: 'Dưới tối thiểu', value: String(below), tone: below ? 'text-rose-600' : undefined }
      ]}
      loading={loading} error={error} empty={rows.length === 0} emptyTitle="Không có hàng tồn" emptyDescription="Đổi ngày, kho hoặc bật 'Hiện cả dòng tồn bằng 0'."
      filters={<>
        <div><label className={filterLabel}>Tồn đến ngày</label><input type="date" value={asOf} onChange={e => setAsOf(e.target.value || today())} className={filterInput} /></div>
        <CommonFilters warehouse={warehouse} onWarehouse={setWarehouse} group={group} onGroup={setGroup} search={searchText} onSearch={setSearchText} />
        <label className="flex items-end gap-1.5 pb-1 text-xs font-medium text-slate-700 dark:text-slate-300"><input type="checkbox" checked={includeZero} onChange={e => setIncludeZero(e.target.checked)} />Hiện cả dòng tồn bằng 0</label>
      </>}
    >
      <table className="w-full text-xs text-left">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold">
          <tr><th className={th}>Kho</th><th className={th}>Mã vật tư</th><th className={th}>Tên vật tư</th><th className={th}>ĐVT</th><th className={`${th} text-right`}>Tồn</th><th className={`${th} text-right`}>Giá vốn BQ</th><th className={`${th} text-right`}>Giá trị</th><th className={th}>Định mức</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map(r => (
            <tr key={`${r.warehouseCode}|${r.materialCode}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className={th}>{r.warehouseCode}</td><td className={`${th} font-mono font-bold`}>{r.materialCode}</td><td className={th}>{r.materialName}</td><td className={th}>{r.uomCode}</td>
              <td className={`${th} text-right font-mono`}>{formatQuantity(r.quantity)}</td>
              <td className={`${th} text-right font-mono`}>{money(r.averageCost)}</td>
              <td className={`${th} text-right font-mono font-bold`}>{money(r.value)}</td>
              <td className={th}>{LEVELS[r.level].text && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${LEVELS[r.level].cls}`}>{LEVELS[r.level].text}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </ReportFrame>
  );
};
