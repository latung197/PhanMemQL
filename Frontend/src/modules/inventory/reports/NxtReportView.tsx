// Kho › Báo cáo nhập xuất tồn: tồn đầu, nhập, xuất, tồn cuối của từng vật tư trong từng kho trong một kỳ (rpt_stock_nxt).
import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import type { UserProfile } from '../../../types';
import { stockReportsApi } from './api';
import { CommonFilters, ReportFrame, filterInput, filterLabel, monthStart, num, today, th, useDebouncedSearch, useReport, useRowLimit } from './ReportKit';

export const NxtReportView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { formatQuantity, formatCurrency } = useNumberFormat();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [warehouse, setWarehouse] = useState('');
  const [group, setGroup] = useState('');
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedSearch(searchText);
  const filters = { from, to, warehouse, materialGroup: group, search };
  const { data, loading, error, reload } = useReport(() => stockReportsApi.nxt(filters), JSON.stringify(filters));
  const rows = data ?? [];
  const { visible, footer } = useRowLimit(rows);
  const canSeeMoney = rows.length === 0 || rows.some(r => r.closingValue !== null);
  const sum = (pick: (r: (typeof rows)[number]) => number | null) => rows.reduce((s, r) => s + (pick(r) ?? 0), 0);
  const money = (v: number | null) => num(v, x => formatCurrency(x, false));
  const dmy = (d: string) => d.split('-').reverse().join('/');

  return (
    <ReportFrame
      functionCode="inv_report_nxt" currentUser={currentUser} icon={<ArrowRightLeft className="h-5 w-5" />}
      title="Báo cáo nhập xuất tồn" countLabel="dòng" count={rows.length}
      activeFilterCount={[warehouse, group, searchText].filter(Boolean).length}
      onClear={() => { setWarehouse(''); setGroup(''); setSearchText(''); setFrom(monthStart()); setTo(today()); }}
      onRefresh={() => void reload()} onExport={() => stockReportsApi.exportFile('nxt', filters)}
      filterSummary={`Từ ${dmy(from)} đến ${dmy(to)}${warehouse ? ` · Kho: ${warehouse}` : ''}${group ? ` · Nhóm: ${group}` : ''}`}
      canSeeMoney={canSeeMoney}
      cards={canSeeMoney ? [
        { title: 'Giá trị tồn đầu', value: formatCurrency(sum(r => r.openingValue), false) },
        { title: 'Giá trị nhập', value: formatCurrency(sum(r => r.inValue), false), tone: 'text-emerald-600' },
        { title: 'Giá trị xuất', value: formatCurrency(sum(r => r.outValue), false), tone: 'text-rose-600' },
        { title: 'Giá trị tồn cuối', value: formatCurrency(sum(r => r.closingValue), false) }
      ] : undefined}
      loading={loading} error={error} empty={rows.length === 0} emptyTitle="Không có phát sinh hay tồn trong kỳ" emptyDescription="Đổi khoảng ngày hoặc bộ lọc."
      filters={<>
        <div><label className={filterLabel}>Từ ngày</label><input type="date" value={from} onChange={e => setFrom(e.target.value || monthStart())} className={filterInput} /></div>
        <div><label className={filterLabel}>Đến ngày</label><input type="date" value={to} onChange={e => setTo(e.target.value || today())} className={filterInput} /></div>
        <CommonFilters warehouse={warehouse} onWarehouse={setWarehouse} group={group} onGroup={setGroup} search={searchText} onSearch={setSearchText} />
      </>}
    >
      <table className="w-full text-xs text-left">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold">
          <tr>
            <th className={th} rowSpan={2}>Kho</th><th className={th} rowSpan={2}>Mã vật tư</th><th className={th} rowSpan={2}>Tên vật tư</th><th className={th} rowSpan={2}>ĐVT</th>
            <th className={`${th} text-center`} colSpan={2}>Tồn đầu</th><th className={`${th} text-center`} colSpan={2}>Nhập</th><th className={`${th} text-center`} colSpan={2}>Xuất</th><th className={`${th} text-center`} colSpan={2}>Tồn cuối</th>
          </tr>
          <tr>{['SL', 'Giá trị', 'SL', 'Giá trị', 'SL', 'Giá trị', 'SL', 'Giá trị'].map((h, i) => <th key={i} className={`${th} text-right`}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map(r => (
            <tr key={`${r.warehouseCode}|${r.materialCode}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className={th}>{r.warehouseCode}</td><td className={`${th} font-mono font-bold`}>{r.materialCode}</td><td className={th}>{r.materialName}</td><td className={th}>{r.uomCode}</td>
              <td className={`${th} text-right font-mono`}>{formatQuantity(r.openingQuantity)}</td><td className={`${th} text-right font-mono`}>{money(r.openingValue)}</td>
              <td className={`${th} text-right font-mono text-emerald-700 dark:text-emerald-400`}>{formatQuantity(r.inQuantity)}</td><td className={`${th} text-right font-mono`}>{money(r.inValue)}</td>
              <td className={`${th} text-right font-mono text-rose-700 dark:text-rose-400`}>{formatQuantity(r.outQuantity)}</td><td className={`${th} text-right font-mono`}>{money(r.outValue)}</td>
              <td className={`${th} text-right font-mono font-bold`}>{formatQuantity(r.closingQuantity)}</td><td className={`${th} text-right font-mono font-bold`}>{money(r.closingValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </ReportFrame>
  );
};
