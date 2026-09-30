// Settings › Tỷ giá (sys_exchange_rates). One row per currency and day; vouchers use the accounting rate of
// the latest day on or before their date.
import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, TrendingUp } from 'lucide-react';
import { GridView, GridViewColumn } from '../../components/common/GridView';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { SelectInput, TextInput } from '../../components/common/FormField';
import { ErrorState } from '../../components/common/StateViews';
import { currenciesApi, Currency, ExchangeRate, exchangeRatesApi, SaveExchangeRateInput } from '../../services/settingsApi';
import { useCatalog } from '../../hooks/useCatalog';
import { formatDate } from '../../utils/format';
import { SettingsViewProps } from './settingsTypes';

const rate = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 6 });
const today = () => new Date().toISOString().slice(0, 10);

export const ExchangeRateView: React.FC<SettingsViewProps> = ({ canEdit, canDelete }) => {
  const catalog = useCatalog(exchangeRatesApi, {
    keyOf: r => r.id, noun: 'tỷ giá', describe: r => `${r.currencyCode} ngày ${formatDate(r.date)}`
  });
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState<SaveExchangeRateInput | null>(null);
  const [editing, setEditing] = useState<ExchangeRate>();
  const [saving, setSaving] = useState(false);

  useEffect(() => { currenciesApi.getAll().then(setCurrencies).catch(() => setCurrencies([])); }, []);
  const foreign = currencies.filter(c => !c.isBase && c.isActive);
  const base = currencies.find(c => c.isBase)?.code ?? 'VND';
  const rows = useMemo(() => catalog.items.filter(r => !filter || r.currencyCode === filter), [catalog.items, filter]);

  const open = (item?: ExchangeRate) => {
    setEditing(item);
    setForm(item
      ? { currencyCode: item.currencyCode, date: item.date, buyRate: item.buyRate, sellRate: item.sellRate, accountingRate: item.accountingRate }
      : { currencyCode: filter || foreign[0]?.code || '', date: today(), buyRate: 0, sellRate: 0, accountingRate: 0 });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    if (await catalog.save(form, editing)) setForm(null);
    setSaving(false);
  };

  const number = (key: 'buyRate' | 'sellRate' | 'accountingRate', label: string, required = false) => form && (
    <TextInput label={label} required={required} type="number" min={0} step="any" className="text-right font-mono"
      value={form[key] || ''} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} />
  );

  const columns: GridViewColumn<ExchangeRate>[] = [
    { key: 'date', header: 'Ngày áp dụng', width: '130px', sortable: true, render: r => <span className="font-mono">{formatDate(r.date)}</span> },
    { key: 'currencyCode', header: 'Ngoại tệ', width: '100px', sortable: true, render: r => <span className="font-mono font-bold">{r.currencyCode}</span> },
    { key: 'buyRate', header: 'Mua vào', align: 'right', render: r => <span className="font-mono">{rate(r.buyRate)}</span> },
    { key: 'sellRate', header: 'Bán ra', align: 'right', render: r => <span className="font-mono">{rate(r.sellRate)}</span> },
    { key: 'accountingRate', header: 'Hạch toán', align: 'right', render: r => <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{rate(r.accountingRate)}</span> },
    { key: 'updatedBy', header: 'Người cập nhật', render: r => r.updatedBy || '—' }
  ];

  if (catalog.error) return <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} />;

  return (
    <>
      <GridView
        title="Tỷ giá ngoại tệ"
        subtitle={`Quy đổi ra ${base}. Chứng từ dùng tỷ giá hạch toán của ngày gần nhất không sau ngày chứng từ.`}
        icon={<TrendingUp className="h-4 w-4" />}
        data={rows}
        columns={columns}
        getItemId={r => r.id}
        loading={catalog.loading}
        searchable={false}
        toolbarFilters={
          <SelectInput aria-label="Lọc theo ngoại tệ" value={filter} onChange={e => setFilter(e.target.value)} wrapperClassName="w-56"
            options={[{ value: '', label: 'Tất cả ngoại tệ' }, ...foreign.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))]} />
        }
        primaryAction={canEdit && foreign.length > 0 ? { label: 'Thêm tỷ giá', icon: <Plus className="h-3.5 w-3.5" />, onClick: () => open() } : undefined}
        emptyText={foreign.length === 0 ? 'Chưa có ngoại tệ nào ngoài đồng tiền hạch toán. Hãy khai báo ngoại tệ trước.' : undefined}
        actions={(canEdit || canDelete) ? r => (
          <div className="flex justify-end gap-1">
            {canEdit && <Button variant="ghost" size="sm" title="Sửa" onClick={() => open(r)} icon={<Edit2 className="h-3.5 w-3.5" />} />}
            {canDelete && <Button variant="ghost" size="sm" title="Xóa" onClick={() => void catalog.remove(r)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-600" />} />}
          </div>
        ) : undefined}
      />

      {form && (
        <Modal isOpen onClose={() => setForm(null)} title={editing ? 'Sửa tỷ giá' : 'Thêm tỷ giá'}>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Ngoại tệ" required value={form.currencyCode}
                onChange={e => setForm({ ...form, currencyCode: e.target.value })}
                options={foreign.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))} />
              <TextInput label="Ngày áp dụng" required type="date" value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {number('buyRate', 'Mua vào')}
              {number('sellRate', 'Bán ra')}
              {number('accountingRate', 'Hạch toán', true)}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(null)}>Hủy</Button>
              <Button type="submit" size="sm" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
