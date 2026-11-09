// Kho › Báo cáo tuổi hàng tồn: tồn đến một ngày chia theo thời gian nằm kho (0-30 … trên 180 ngày); hàng nhập sau còn lại, hàng nhập trước xuất trước (rpt_stock_aging).
import React, { useState } from 'react';
import { Hourglass } from 'lucide-react';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import type { UserProfile } from '../../../types';
import { stockReportsApi, type AgingRow } from './api';
import { CommonFilters, ReportFrame, filterInput, filterLabel, num, today, th, useDebouncedSearch, useReport, useRowLimit } from './ReportKit';

const BUCKETS: { label: string; qty: keyof AgingRow; value: keyof AgingRow }[] = [
  { label: '0-30 ngày', qty: 'qty0To30', value: 'value0To30' },
  { label: '31-60 ngày', qty: 'qty31To60', value: 'value31To60' },
  { label: '61-90 ngày', qty: 'qty61To90', value: 'value61To90' },
  { label: '91-180 ngày', qty: 'qty91To180', value: 'value91To180' },
  { label: 'Trên 180 ngày', qty: 'qtyOver180', value: 'valueOver180' }
];

export const AgingReportView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { formatQuantity, formatCurrency } = useNumberFormat();
  const [asOf, setAsOf] = useState(today());
  const [warehouse, setWarehouse] = useState('');
  const [group, setGroup] = useState('');
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedSearch(searchText);
  const filters = { asOf, warehouse, materialGroup: group, search };
  const { data, loading, error, reload } = useReport(() => stockReportsApi.aging(filters), JSON.stringify(filters));
  const rows = data ?? [];
  const { visible, footer } = useRowLimit(rows);
  const canSeeMoney = rows.length === 0 || rows.some(r => r.value !== null);
  const sumOf = (key: keyof AgingRow) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const money = (v: number | null) => num(v, x => formatCurrency(x, false));

  return (
    <ReportFrame
      functionCode="inv_report_aging" currentUser={currentUser} icon={<Hourglass className="h-5 w-5" />}
      title="Báo cáo tuổi hàng tồn" countLabel="dòng" count={rows.length}
      activeFilterCount={[warehouse, group, searchText].filter(Boolean).length}
      onClear={() => { setWarehouse(''); setGroup(''); setSearchText(''); setAsOf(today()); }}
      onRefresh={() => void reload()} onExport={() => stockReportsApi.exportFile('aging', filters)}
      filterSummary={`Tuổi hàng tồn đến ngày ${asOf.split('-').reverse().join('/')}${warehouse ? ` · Kho: ${warehouse}` : ''}${group ? ` · Nhóm: ${group}` : ''}`}
      canSeeMoney={canSeeMoney}
      cards={canSeeMoney ? [
        { title: 'Tổng giá trị tồn', value: formatCurrency(sumOf('value'), false) },
        { title: 'Trên 90 ngày', value: formatCurrency(sumOf('value91To180') + sumOf('valueOver180'), false), tone: 'text-amber-600' },
        { title: 'Trên 180 ngày', value: formatCurrency(sumOf('valueOver180'), false), tone: 'text-rose-600' }
      ] : undefined}
      loading={loading} error={error} empty={rows.length === 0} emptyTitle="Không có hàng tồn" emptyDescription="Đổi ngày hoặc bộ lọc."
      filters={<>
        <div><label className={filterLabel}>Tồn đến ngày</label><input type="date" value={asOf} onChange={e => setAsOf(e.target.value || today())} className={filterInput} /></div>
        <CommonFilters warehouse={warehouse} onWarehouse={setWarehouse} group={group} onGroup={setGroup} search={searchText} onSearch={setSearchText} />
      </>}
    >
      <table className="w-full text-xs text-left">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold">
          <tr>
            <th className={th} rowSpan={2}>Kho</th><th className={th} rowSpan={2}>Mã vật tư</th><th className={th} rowSpan={2}>Tên vật tư</th><th className={th} rowSpan={2}>ĐVT</th><th className={`${th} text-right`} rowSpan={2}>Tồn</th>
            {BUCKETS.map(b => <th key={b.label} className={`${th} text-center`} colSpan={2}>{b.label}</th>)}
            <th className={`${th} text-right`} rowSpan={2}>Giá trị tồn</th>
          </tr>
          <tr>{BUCKETS.flatMap(b => [<th key={`${b.label}q`} className={`${th} text-right`}>SL</th>, <th key={`${b.label}v`} className={`${th} text-right`}>Giá trị</th>])}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map(r => (
            <tr key={`${r.warehouseCode}|${r.materialCode}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className={th}>{r.warehouseCode}</td><td className={`${th} font-mono font-bold`}>{r.materialCode}</td><td className={th}>{r.materialName}</td><td className={th}>{r.uomCode}</td>
              <td className={`${th} text-right font-mono font-bold`}>{formatQuantity(r.quantity)}</td>
              {BUCKETS.flatMap(b => [
                <td key={`${b.label}q`} className={`${th} text-right font-mono`}>{Number(r[b.qty]) ? formatQuantity(Number(r[b.qty])) : ''}</td>,
                <td key={`${b.label}v`} className={`${th} text-right font-mono`}>{Number(r[b.qty]) ? money(r[b.value] as number | null) : ''}</td>
              ])}
              <td className={`${th} text-right font-mono font-bold`}>{money(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </ReportFrame>
  );
};
