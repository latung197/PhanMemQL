// Kho › Tính tồn kho tức thời (inv_calc_instant_stock): tồn hiện có của từng vật tư trong từng kho, số đã giữ chỗ (phần chưa xuất của yêu cầu xuất kho
// và đơn bán hàng đã duyệt) và số khả dụng (rpt_stock_availability). Hai nút kiểm tra: "Kiểm tra sổ kho" so các bảng số dư với sổ kho,
// "Dựng lại số dư" dựng lại các bảng số dư từ sổ kho khi có chênh lệch.
import React, { useState } from 'react';
import { Button } from '../../../components/common/Button';
import { useConfirm } from '../../../components/common/ConfirmDialog';
import { Zap, ShieldCheck, RefreshCw } from 'lucide-react';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import { getErrorMessage } from '../../../services/apiClient';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';
import type { UserProfile } from '../../../types';
import { stockProcessApi, stockReportsApi, type StockDiscrepancy } from './api';
import { CommonFilters, ReportFrame, th, useDebouncedSearch, useReport, useRowLimit } from './ReportKit';

export const InstantStockView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { formatQuantity } = useNumberFormat();
  const confirm = useConfirm();
  const perm = getActionPermission(currentUser, 'inv_calc_instant_stock');
  const [warehouse, setWarehouse] = useState('');
  const [group, setGroup] = useState('');
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedSearch(searchText);
  const [checking, setChecking] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<StockDiscrepancy[] | null>(null);
  const filters = { warehouse, materialGroup: group, search };
  const { data, loading, error, reload } = useReport(() => stockReportsApi.availability(filters), JSON.stringify(filters));
  const rows = data ?? [];
  const { visible, footer } = useRowLimit(rows);
  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);

  const verify = async () => {
    setChecking(true);
    try {
      const found = await stockProcessApi.verify();
      setDiscrepancies(found);
      if (found.length === 0) showToast.success('Các bảng số dư khớp với sổ kho.');
      else showToast.warning(`Có ${found.length} dòng số dư lệch so với sổ kho.`);
    } catch (e) { showToast.error(getErrorMessage(e)); }
    finally { setChecking(false); }
  };

  const rebuild = async () => {
    const ok = await confirm({
      title: 'Dựng lại số dư tồn kho?',
      message: 'Các bảng số dư (theo kho, lô, vị trí) của đơn vị đang làm việc được xóa và dựng lại từ sổ kho. Sổ kho không bị thay đổi.',
      tone: 'warning', confirmLabel: 'Dựng lại', cancelLabel: 'Không'
    });
    if (!ok) return;
    setChecking(true);
    try {
      const result = await stockProcessApi.rebuild();
      showToast.success(`Đã dựng lại ${result.rows} dòng số dư.`);
      setDiscrepancies(await stockProcessApi.verify());
      await reload();
    } catch (e) { showToast.error(getErrorMessage(e)); }
    finally { setChecking(false); }
  };

  const actions = (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => void verify()} disabled={checking} icon={<ShieldCheck className="h-3.5 w-3.5" />} className="text-xs">Kiểm tra sổ kho</Button>
      {perm.edit && (
        <Button type="button" variant="outline" size="sm" onClick={() => void rebuild()} disabled={checking} icon={<RefreshCw className="h-3.5 w-3.5" />} className="text-xs">Dựng lại số dư</Button>
      )}
    </>
  );

  const result = discrepancies === null ? null : discrepancies.length === 0 ? (
    <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-[5px] px-3 py-2">
      Các bảng số dư khớp với sổ kho.
    </p>
  ) : (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-[5px] px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      <p className="font-bold">Có {discrepancies.length} dòng số dư lệch so với sổ kho{perm.edit ? ' — bấm "Dựng lại số dư" để sửa.' : ' — nhờ người có quyền Sửa dựng lại số dư.'}</p>
      <ul className="mt-1 max-h-32 overflow-auto font-mono text-[11px]">
        {discrepancies.slice(0, 50).map((d, i) => (
          <li key={i}>{d.level} · {d.warehouseCode} · {d.materialCode}{d.lotCode ? ` · lô ${d.lotCode}` : ''}{d.locationCode ? ` · vị trí ${d.locationCode}` : ''}: sổ {formatQuantity(d.ledgerQuantity)} / số dư {formatQuantity(d.balanceQuantity)}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <ReportFrame
      functionCode="inv_calc_instant_stock" currentUser={currentUser} icon={<Zap className="h-5 w-5" />}
      title="Tính tồn kho tức thời" countLabel="dòng" count={rows.length}
      activeFilterCount={[warehouse, group, searchText].filter(Boolean).length}
      onClear={() => { setWarehouse(''); setGroup(''); setSearchText(''); }}
      onRefresh={() => void reload()} onExport={() => stockReportsApi.exportFile('availability', filters)}
      filterSummary={`Tồn kho tức thời${warehouse ? ` · Kho: ${warehouse}` : ''}${group ? ` · Nhóm: ${group}` : ''}`}
      canSeeMoney headerActions={actions} topSlot={result}
      cards={[
        { title: 'Tồn hiện có', value: formatQuantity(sum(r => r.quantity)) },
        { title: 'Giữ chỗ (yêu cầu xuất)', value: formatQuantity(sum(r => r.reservedByRequests)), tone: 'text-amber-600' },
        { title: 'Giữ chỗ (đơn bán)', value: formatQuantity(sum(r => r.reservedByOrders)), tone: 'text-amber-600' },
        { title: 'Khả dụng', value: formatQuantity(sum(r => r.available)), tone: 'text-emerald-600' }
      ]}
      loading={loading} error={error} empty={rows.length === 0} emptyTitle="Không có hàng tồn" emptyDescription="Đổi bộ lọc."
      filters={<CommonFilters warehouse={warehouse} onWarehouse={setWarehouse} group={group} onGroup={setGroup} search={searchText} onSearch={setSearchText} />}
    >
      <table className="w-full text-xs text-left">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold">
          <tr>
            <th className={th}>Kho</th><th className={th}>Mã vật tư</th><th className={th}>Tên vật tư</th><th className={th}>ĐVT</th>
            <th className={`${th} text-right`}>Tồn hiện có</th><th className={`${th} text-right`}>Giữ chỗ (yêu cầu xuất)</th>
            <th className={`${th} text-right`}>Giữ chỗ (đơn bán)</th><th className={`${th} text-right`}>Khả dụng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map(r => (
            <tr key={`${r.warehouseCode}|${r.materialCode}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className={th}>{r.warehouseCode}</td><td className={`${th} font-mono font-bold`}>{r.materialCode}</td><td className={th}>{r.materialName}</td><td className={th}>{r.uomCode}</td>
              <td className={`${th} text-right font-mono`}>{formatQuantity(r.quantity)}</td>
              <td className={`${th} text-right font-mono ${r.reservedByRequests > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>{r.reservedByRequests > 0 ? formatQuantity(r.reservedByRequests) : ''}</td>
              <td className={`${th} text-right font-mono ${r.reservedByOrders > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>{r.reservedByOrders > 0 ? formatQuantity(r.reservedByOrders) : ''}</td>
              <td className={`${th} text-right font-mono font-bold ${r.available < 0 ? 'text-rose-600' : ''}`}>{formatQuantity(r.available)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </ReportFrame>
  );
};
