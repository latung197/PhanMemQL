// Kho › Báo cáo hàng nhập / hàng xuất: một màn hình cho hai báo cáo (rpt_stock_movements), xem chi tiết từng dòng chứng từ hoặc tổng hợp theo vật tư.
import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import { formatDate } from '../../../utils/format';
import type { UserProfile } from '../../../types';
import { SOURCE_LABELS, stockReportsApi } from './api';
import { CommonFilters, ReportFrame, filterInput, filterLabel, monthStart, num, today, th, useDebouncedSearch, useReport, useRowLimit } from './ReportKit';

export const MovementReportView: React.FC<{ direction: 'inward' | 'outward'; currentUser?: UserProfile }> = ({ direction, currentUser }) => {
  const inward = direction === 'inward';
  const { formatQuantity, formatCurrency } = useNumberFormat();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [warehouse, setWarehouse] = useState('');
  const [group, setGroup] = useState('');
  const [searchText, setSearchText] = useState('');
  const [mode, setMode] = useState<'detail' | 'summary'>('detail');
  const search = useDebouncedSearch(searchText);
  const filters = { from, to, warehouse, materialGroup: group, search, mode };
  const { data, loading, error, reload } = useReport(() => (inward ? stockReportsApi.inward(filters) : stockReportsApi.outward(filters)), `${direction}${JSON.stringify(filters)}`);
  const summary = mode === 'summary';
  const detail = data?.detail ?? [];
  const sums = data?.summary ?? [];
  const all: { quantity: number; value: number | null }[] = summary ? sums : detail;
  const { visible: vDetail, footer: fDetail } = useRowLimit(detail);
  const { visible: vSum, footer: fSum } = useRowLimit(sums);
  const canSeeMoney = all.length === 0 || all.some(r => r.value !== null);
  const totalQty = all.reduce((s, r) => s + r.quantity, 0);
  const totalValue = all.reduce((s, r) => s + (r.value ?? 0), 0);
  const money = (v: number | null) => num(v, x => formatCurrency(x, false));
  const dmy = (d: string) => d.split('-').reverse().join('/');
  const label = inward ? 'hàng nhập kho' : 'hàng xuất kho';
  const head = 'sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold';

  return (
    <ReportFrame
      functionCode={inward ? 'inv_report_inward' : 'inv_report_outward'} currentUser={currentUser}
      icon={inward ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
      title={`Báo cáo ${label}`} countLabel="dòng" count={all.length}
      activeFilterCount={[warehouse, group, searchText].filter(Boolean).length}
      onClear={() => { setWarehouse(''); setGroup(''); setSearchText(''); setFrom(monthStart()); setTo(today()); }}
      onRefresh={() => void reload()} onExport={() => stockReportsApi.exportFile(direction, filters)}
      filterSummary={`Từ ${dmy(from)} đến ${dmy(to)}${warehouse ? ` · Kho: ${warehouse}` : ''}${group ? ` · Nhóm: ${group}` : ''} · ${summary ? 'Tổng hợp theo vật tư' : 'Chi tiết'}`}
      canSeeMoney={canSeeMoney}
      cards={[
        { title: 'Số dòng', value: all.length.toLocaleString('vi-VN') },
        { title: 'Tổng số lượng', value: formatQuantity(totalQty) },
        { title: 'Tổng giá trị', value: canSeeMoney ? formatCurrency(totalValue, false) : '—' }
      ]}
      loading={loading} error={error} empty={all.length === 0} emptyTitle={`Không có ${label} trong kỳ`} emptyDescription="Chỉ tính phiếu đã ghi sổ. Đổi khoảng ngày hoặc bộ lọc."
      filters={<>
        <div><label className={filterLabel}>Từ ngày</label><input type="date" value={from} onChange={e => setFrom(e.target.value || monthStart())} className={filterInput} /></div>
        <div><label className={filterLabel}>Đến ngày</label><input type="date" value={to} onChange={e => setTo(e.target.value || today())} className={filterInput} /></div>
        <CommonFilters warehouse={warehouse} onWarehouse={setWarehouse} group={group} onGroup={setGroup} search={searchText} onSearch={setSearchText} />
        <div><label className={filterLabel}>Cách xem</label>
          <select value={mode} onChange={e => setMode(e.target.value as 'detail' | 'summary')} className={filterInput}><option value="detail">Chi tiết</option><option value="summary">Tổng hợp theo vật tư</option></select>
        </div>
      </>}
    >
      {summary ? (
        <>
          <table className="w-full text-xs text-left">
            <thead className={head}><tr><th className={th}>Kho</th><th className={th}>Mã vật tư</th><th className={th}>Tên vật tư</th><th className={th}>ĐVT</th><th className={`${th} text-right`}>Số phiếu</th><th className={`${th} text-right`}>Số lượng</th><th className={`${th} text-right`}>Giá trị</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {vSum.map(r => (
                <tr key={`${r.warehouseCode}|${r.materialCode}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={th}>{r.warehouseCode}</td><td className={`${th} font-mono font-bold`}>{r.materialCode}</td><td className={th}>{r.materialName}</td><td className={th}>{r.uomCode}</td>
                  <td className={`${th} text-right font-mono`}>{r.voucherCount}</td><td className={`${th} text-right font-mono`}>{formatQuantity(r.quantity)}</td><td className={`${th} text-right font-mono font-bold`}>{money(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fSum}
        </>
      ) : (
        <>
          <table className="w-full text-xs text-left">
            <thead className={head}><tr><th className={th}>Ngày</th><th className={th}>Loại</th><th className={th}>Số phiếu</th><th className={th}>{inward ? 'Nhà cung cấp / nguồn' : 'Khách / nơi nhận'}</th><th className={th}>Kho</th><th className={th}>Mã vật tư</th><th className={th}>Tên vật tư</th><th className={th}>ĐVT</th><th className={th}>Lô</th><th className={`${th} text-right`}>Số lượng</th><th className={`${th} text-right`}>Đơn giá</th><th className={`${th} text-right`}>Giá trị</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {vDetail.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={`${th} whitespace-nowrap`}>{formatDate(r.date)}</td><td className={th}>{SOURCE_LABELS[r.sourceFunction] ?? r.sourceFunction}</td>
                  <td className={`${th} font-mono font-bold`}>{r.voucherCode}</td><td className={th}>{r.partner}</td><td className={th}>{r.warehouseCode}</td>
                  <td className={`${th} font-mono font-bold`}>{r.materialCode}</td><td className={th}>{r.materialName}</td><td className={th}>{r.uomCode}</td><td className={th}>{r.lotCode}</td>
                  <td className={`${th} text-right font-mono`}>{formatQuantity(r.quantity)}</td><td className={`${th} text-right font-mono`}>{money(r.unitPrice)}</td><td className={`${th} text-right font-mono font-bold`}>{money(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fDetail}
        </>
      )}
    </ReportFrame>
  );
};
