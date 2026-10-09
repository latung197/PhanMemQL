// Settings › Tham số mặc định (sys_default_config): operating parameters (company-wide and per company
// unit), voucher numbering, print template and number format. The backend reads the same values through
// ISystemParameters (e.g. whether a goods issue may make stock negative).
import React, { useEffect, useState } from 'react';
import { Building2, Calculator, Hash, Printer, RotateCcw, Save, Sliders, Warehouse as WarehouseIcon } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Checkbox } from '../../components/common/Checkbox';
import { SelectInput, TextInput } from '../../components/common/FormField';
import { Tabs } from '../../components/common/Tabs';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { saveWithFeedback, showToast } from '../../utils/toast';
import {
  COSTING_METHODS, costingMethodLabel, CostingMethod, DEFAULT_SYSTEM_CONFIG, PrintSignatureLabels, systemSettingsService,
  SystemDefaultConfig, UnitDefaultsConfig, VAT_RATES
} from '../../services/systemSettingsService';
import type { Currency } from '../../services/settingsApi';
import { loadCurrencyOptions } from '../../services/lookupOptions';
import { Warehouse } from '../../types';
import { VoucherNumberingPanel } from './VoucherNumberingPanel';
import { NumberFormatSettings } from './NumberFormatSettings';
import { SettingsViewProps } from './settingsTypes';

type DefaultsTab = 'parameters' | 'numbering' | 'print' | 'number_format';

interface DefaultConfigViewProps extends SettingsViewProps {
  /** Warehouses to choose the default from (demo catalog until warehouses move to the backend). */
  warehouses: Warehouse[];
  /** Company unit of the session, whose own parameters are edited. */
  unitCode: string;
}

const SIGNATURES: { key: keyof PrintSignatureLabels; label: string }[] = [
  { key: 'preparedBy', label: 'Chữ ký 1 (Người lập)' },
  { key: 'storekeeper', label: 'Chữ ký 2 (Thủ kho)' },
  { key: 'chiefAccountant', label: 'Chữ ký 3 (Kế toán trưởng)' },
  { key: 'director', label: 'Chữ ký 4 (Giám đốc)' }
];

/** Select value for a unit field: '' = follow the company value. */
const inherit = (value: boolean | null) => (value === null ? '' : value ? 'yes' : 'no');

export const DefaultConfigView: React.FC<DefaultConfigViewProps> = ({ canEdit, warehouses, unitCode }) => {
  const [tab, setTab] = useState<DefaultsTab>('parameters');
  const [config, setConfig] = useState<SystemDefaultConfig>(() => systemSettingsService.getSystemDefaults());
  const [unit, setUnit] = useState<UnitDefaultsConfig>(() => systemSettingsService.getUnitDefaults());
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  useEffect(() => { loadCurrencyOptions().then(setCurrencies).catch(() => setCurrencies([])); }, []);

  const confirm = useConfirm();
  const baseCurrency = currencies.find(c => c.isBase);
  const warehouseOptions = warehouses.map(w => ({ value: w.code, label: `${w.code} - ${w.name}` }));
  /** A saved code that is not in the warehouse catalog is shown as such instead of looking unselected. */
  const withUnknown = (code: string | null | undefined) =>
    code && !warehouses.some(w => w.code === code)
      ? [{ value: code, label: `${code} (không có trong danh mục kho)` }, ...warehouseOptions] : warehouseOptions;
  const companyWarehouse = warehouses.find(w => w.code === config.defaultWarehouse);

  // The two tabs share one section but are saved separately: each keeps the other's unsaved edits as a draft.
  const saveParameters = ({ printTemplate: _print, ...params }: SystemDefaultConfig, message: string) =>
    void saveWithFeedback(systemSettingsService.saveSystemDefaults(params), () => {
      setConfig(prev => ({ ...systemSettingsService.getSystemDefaults(), printTemplate: prev.printTemplate }));
      showToast.success(message);
    });
  const savePrintTemplate = () =>
    void saveWithFeedback(systemSettingsService.saveSystemDefaults({ printTemplate: config.printTemplate }), () => {
      setConfig(prev => ({ ...prev, printTemplate: systemSettingsService.getSystemDefaults().printTemplate }));
      showToast.success('Đã lưu mẫu in');
    });
  const resetParameters = async () => {
    if (!(await confirm({
      title: 'Khôi phục tham số chung mặc định?',
      message: 'Phương pháp tính giá, thuế suất, kho mặc định và các tùy chọn xuất kho / ghi sổ sẽ về giá trị ban đầu cho toàn công ty.',
      confirmLabel: 'Khôi phục',
      tone: 'warning'
    }))) return;
    saveParameters({ ...DEFAULT_SYSTEM_CONFIG, defaultCurrency: config.defaultCurrency }, 'Đã khôi phục tham số chung mặc định');
  };

  const signature = (key: keyof PrintSignatureLabels, value: string) =>
    setConfig({ ...config, printTemplate: { ...config.printTemplate, signatures: { ...config.printTemplate.signatures, [key]: value } } });

  const company = systemSettingsService.getCompanyProfile();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-[5px] border border-slate-200 dark:border-slate-800">
        <div className="p-2.5 rounded-[5px] bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400"><Sliders className="h-5 w-5" /></div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Tham số hệ thống</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tham số vận hành, đánh số chứng từ, mẫu in và định dạng số. Các phiếu nghiệp vụ dùng trực tiếp các giá trị này.
          </p>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { key: 'parameters', label: 'Tham số vận hành', icon: <WarehouseIcon /> },
        { key: 'numbering', label: 'Đánh số chứng từ', icon: <Hash /> },
        { key: 'print', label: 'Mẫu in & chữ ký', icon: <Printer /> },
        { key: 'number_format', label: 'Định dạng số & tiền', icon: <Calculator /> }
      ]} />

      {tab === 'parameters' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2 p-5 border border-slate-200 dark:border-slate-800 rounded-[5px]" title="Tham số chung toàn công ty">
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); saveParameters(config, 'Đã lưu tham số chung'); }}>
              <fieldset disabled={!canEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectInput label="Phương pháp tính giá xuất kho" required value={config.costingMethod}
                  hint="Dùng khi tính giá vốn hàng xuất"
                  onChange={e => setConfig({ ...config, costingMethod: e.target.value as CostingMethod })}
                  options={COSTING_METHODS.map(k => ({ value: k, label: costingMethodLabel(k) }))} />
                {/* One source: the base currency of the currency catalog (backend fills systemDefaults.defaultCurrency from it). */}
                <TextInput label="Đồng tiền hạch toán" readOnly tabIndex={-1} className="bg-slate-50 dark:bg-slate-800/60"
                  hint="Đổi tại Cài đặt › Danh mục ngoại tệ (cột Tiền hạch toán)"
                  value={baseCurrency ? `${baseCurrency.code} - ${baseCurrency.name}` : config.defaultCurrency} />
                <SelectInput label="Thuế suất GTGT mặc định" value={String(config.defaultVatRate)}
                  hint="Chọn sẵn khi thêm dòng hàng vào chứng từ"
                  onChange={e => setConfig({ ...config, defaultVatRate: Number(e.target.value) })}
                  options={VAT_RATES.map(v => ({ value: String(v), label: `${v}%` }))} />
                <SelectInput label="Kho mặc định" value={config.defaultWarehouse} placeholder="— Không chọn sẵn —"
                  hint="Chọn sẵn trên phiếu mới; từng đơn vị có thể chọn kho riêng"
                  onChange={e => setConfig({ ...config, defaultWarehouse: e.target.value })} options={withUnknown(config.defaultWarehouse)} />
                <div className="md:col-span-2 space-y-2">
                  <Checkbox label="Cho phép xuất kho âm" checked={config.allowNegativeStock}
                    subLabel="Không chọn: chặn phiếu xuất khi số lượng xuất lớn hơn tồn kho"
                    onChange={allowNegativeStock => setConfig({ ...config, allowNegativeStock })} />
                  <Checkbox label="Chỉ ghi sổ phiếu đã được duyệt" checked={config.requireApprovalBeforePosting}
                    subLabel="Không chọn: phiếu lập xong có thể ghi sổ ngay, không cần trình duyệt"
                    onChange={requireApprovalBeforePosting => setConfig({ ...config, requireApprovalBeforePosting })} />
                </div>
              </fieldset>
              {canEdit && (
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />}
                    onClick={() => void resetParameters()}>
                    Mặc định
                  </Button>
                  <Button type="submit" size="sm" icon={<Save className="h-3.5 w-3.5" />}>Lưu tham số chung</Button>
                </div>
              )}
            </form>
          </Card>

          <Card className="p-5 border border-slate-200 dark:border-slate-800 rounded-[5px]" title={`Riêng đơn vị ${unitCode}`}>
            <form className="space-y-4" onSubmit={e => {
              e.preventDefault();
              void saveWithFeedback(systemSettingsService.saveUnitDefaults(unitCode, unit),
                () => showToast.success(`Đã lưu tham số riêng của đơn vị ${unitCode}`));
            }}>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Để "Theo tham số chung" thì đơn vị dùng giá trị bên trái. Muốn khai báo cho đơn vị khác, chuyển đơn vị làm việc trên thanh tiêu đề.
              </p>
              <fieldset disabled={!canEdit} className="space-y-4">
                <SelectInput label="Kho mặc định" value={unit.defaultWarehouse ?? ''}
                  onChange={e => setUnit({ ...unit, defaultWarehouse: e.target.value || null })}
                  options={[{ value: '', label: `Theo tham số chung${companyWarehouse ? ` (${companyWarehouse.code})` : ''}` }, ...withUnknown(unit.defaultWarehouse)]} />
                <SelectInput label="Xuất kho âm" value={inherit(unit.allowNegativeStock)}
                  onChange={e => setUnit({ ...unit, allowNegativeStock: e.target.value === '' ? null : e.target.value === 'yes' })}
                  options={[
                    { value: '', label: `Theo tham số chung (${config.allowNegativeStock ? 'cho phép' : 'không cho phép'})` },
                    { value: 'yes', label: 'Cho phép' },
                    { value: 'no', label: 'Không cho phép' }
                  ]} />
              </fieldset>
              {canEdit && (
                <div className="flex justify-end">
                  <Button type="submit" size="sm" icon={<Save className="h-3.5 w-3.5" />}>Lưu cho {unitCode}</Button>
                </div>
              )}
            </form>
          </Card>
        </div>
      )}

      {tab === 'numbering' && <VoucherNumberingPanel canEdit={canEdit} />}

      {tab === 'print' && (
        <Card className="p-5 border border-slate-200 dark:border-slate-800 rounded-[5px]" title="Mẫu in chứng từ">
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); savePrintTemplate(); }}>
            <div className="p-3 rounded-[5px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-200">Tiêu đề in lấy từ Hồ sơ doanh nghiệp</p>
              <p className="text-slate-600 dark:text-slate-400">{company.companyName} · MST {company.taxCode}</p>
              <p className="text-slate-600 dark:text-slate-400">{company.address}{company.phone ? ` · ĐT ${company.phone}` : ''}</p>
              <p className="text-[11px] text-slate-500">Sửa tại Cài đặt › Hồ sơ doanh nghiệp & sao lưu.</p>
            </div>
            <fieldset disabled={!canEdit} className="space-y-4">
              <TextInput label="Ghi chú chân trang" maxLength={300} value={config.printTemplate.footerNote}
                onChange={e => setConfig({ ...config, printTemplate: { ...config.printTemplate, footerNote: e.target.value } })} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SIGNATURES.map(s => (
                  <TextInput key={s.key} label={s.label} maxLength={60} className="text-center"
                    value={config.printTemplate.signatures[s.key]} onChange={e => signature(s.key, e.target.value)} />
                ))}
              </div>
            </fieldset>
            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" size="sm" icon={<Save className="h-3.5 w-3.5" />}>Lưu mẫu in</Button>
              </div>
            )}
          </form>
        </Card>
      )}

      {tab === 'number_format' && <NumberFormatSettings canEdit={canEdit} />}
    </div>
  );
};
