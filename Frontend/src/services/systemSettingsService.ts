// ERP settings kept as JSON sections by the backend (/api/settings/system-config): defaults, fiscal year,
// company profile and number format. They are cached here after login, so the getters stay synchronous.
// Save methods write to the backend first and update the cache on success.
// Settings with their own tables (currencies, exchange rates, departments, month locks, voucher numbering)
// are in services/settingsApi.ts.
import { apiRequest } from './apiClient';

export interface PrintSignatureLabels {
  preparedBy: string;
  storekeeper: string;
  chiefAccountant: string;
  director: string;
}

/** Printed vouchers take the company name, address and tax code from the company profile. */
export interface PrintTemplateConfig {
  footerNote: string;
  signatures: PrintSignatureLabels;
}

export type CostingMethod = 'MONTHLY_AVG' | 'INSTANT_AVG' | 'FIFO' | 'SPECIFIC';

export const COSTING_METHOD_LABELS: Record<CostingMethod, string> = {
  MONTHLY_AVG: 'Bình quân gia quyền cuối tháng',
  INSTANT_AVG: 'Bình quân di động (tức thời)',
  FIFO: 'Nhập trước xuất trước (FIFO)',
  SPECIFIC: 'Đích danh theo lô'
};

export const VAT_RATES = [0, 5, 8, 10] as const;

/** Company-wide operating parameters (section systemDefaults; backend SystemParameters). */
export interface SystemDefaultConfig {
  costingMethod: CostingMethod;
  /** Code of an active currency (Settings › Ngoại tệ). */
  defaultCurrency: string;
  defaultVatRate: number;
  /** Posting (ghi sổ) only for approved vouchers. */
  requireApprovalBeforePosting: boolean;
  /** Warehouse code preselected on new vouchers; a unit may choose its own. */
  defaultWarehouse: string;
  /** Allow issuing more than the stock on hand; a unit may choose its own. */
  allowNegativeStock: boolean;
  printTemplate: PrintTemplateConfig;
}

/** Parameters of one company unit; null = follow the company-wide value. */
export interface UnitDefaultsConfig {
  defaultWarehouse: string | null;
  allowNegativeStock: boolean | null;
}

/** Năm làm việc and the data entry start date; month locks are per unit (fiscalPeriodsApi). */
export interface FiscalYearConfig {
  fiscalYear: number;
  /** yyyy-MM-dd; vouchers dated before it are refused. */
  startDate: string;
}

export interface CompanyProfileConfig {
  companyName: string;
  shortName: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  legalRepresentative: string;
  chiefAccountant: string;
  logoUrl?: string;
}

/** How numbers and money are displayed, the same for every user of the company. */
export interface NumberFormatConfig {
  thousandSeparator: ',' | '.' | ' ' | '';
  decimalSeparator: '.' | ',';
  currencySymbol: string;
  currencyPosition: 'prefix' | 'suffix';
  amountDecimals: number;
  foreignAmountDecimals: number;
  exchangeRateDecimals: number;
  quantityDecimals: number;
  unitPriceDecimals: number;
  percentDecimals: number;
  defaultForeignCurrency: string;
  defaultExchangeRate: number;
}

export const DEFAULT_SYSTEM_CONFIG: SystemDefaultConfig = {
  costingMethod: 'MONTHLY_AVG',
  defaultCurrency: 'VND',
  defaultVatRate: 10,
  requireApprovalBeforePosting: true,
  defaultWarehouse: '',
  allowNegativeStock: false,
  printTemplate: {
    footerNote: 'Cảm ơn Quý khách hàng & Đối tác đã tin tưởng đồng hành cùng chúng tôi!',
    signatures: {
      preparedBy: 'Người lập biểu',
      storekeeper: 'Thủ kho phụ trách',
      chiefAccountant: 'Kế toán trưởng',
      director: 'Giám đốc / Thủ trưởng'
    }
  }
};

export const DEFAULT_FISCAL_CONFIG: FiscalYearConfig = {
  fiscalYear: 2026,
  startDate: '2026-01-01'
};

export const DEFAULT_COMPANY_PROFILE: CompanyProfileConfig = {
  companyName: 'Tập Đoàn Công Nghệ & Sản Xuất Trần Thịnh JSC',
  shortName: 'Trần Thịnh Group',
  taxCode: '0318899201',
  address: 'Tầng 18, Tòa nhà S-ERP Tower, Đường Lê Duẩn, Q.1, TP. Hồ Chí Minh',
  phone: '028 3822 9999',
  email: 'contact@tranthinh-erp.vn',
  website: 'https://tranthinh-erp.vn',
  legalRepresentative: 'Trần Văn Thịnh',
  chiefAccountant: 'Nguyễn Thị Bích Mai'
};

export const DEFAULT_NUMBER_FORMAT_CONFIG: NumberFormatConfig = {
  thousandSeparator: ',',
  decimalSeparator: '.',
  currencySymbol: 'VNĐ',
  currencyPosition: 'suffix',
  amountDecimals: 0,
  foreignAmountDecimals: 2,
  exchangeRateDecimals: 2,
  quantityDecimals: 0,
  unitPriceDecimals: 0,
  percentDecimals: 2,
  defaultForeignCurrency: 'USD',
  defaultExchangeRate: 25450
};

/** Section names used by the backend API. */
interface SettingSections {
  systemDefaults?: SystemDefaultConfig;
  fiscalConfig?: FiscalYearConfig;
  companyProfile?: CompanyProfileConfig;
  numberFormat?: NumberFormatConfig;
  /** Only for the unit of the session. */
  unitDefaults?: UnitDefaultsConfig;
}

type SectionName = keyof SettingSections;

class SystemSettingsService {
  private cache: SettingSections = {};

  /** Loads the settings of the signed-in company unit. Call after login and after switching unit. */
  async load(): Promise<void> {
    this.cache = await apiRequest<SettingSections>('GET', '/api/settings/system-config');
  }

  /** Forgets the cached values (logout). */
  clear(): void {
    this.cache = {};
  }

  private async save<K extends SectionName>(section: K, value: NonNullable<SettingSections[K]>, unitCode?: string) {
    const query = unitCode ? `?unitCode=${encodeURIComponent(unitCode)}` : '';
    await apiRequest<void>('PUT', `/api/settings/system-config/${section}${query}`, value);
    this.cache = { ...this.cache, [section]: value };
    return value;
  }

  /** Company-wide parameters. */
  getSystemDefaults(): SystemDefaultConfig {
    const saved = this.cache.systemDefaults;
    return {
      ...DEFAULT_SYSTEM_CONFIG,
      ...saved,
      printTemplate: {
        ...DEFAULT_SYSTEM_CONFIG.printTemplate,
        ...saved?.printTemplate,
        signatures: { ...DEFAULT_SYSTEM_CONFIG.printTemplate.signatures, ...saved?.printTemplate?.signatures }
      }
    };
  }

  saveSystemDefaults(config: Partial<SystemDefaultConfig>): Promise<SystemDefaultConfig> {
    return this.save('systemDefaults', { ...this.getSystemDefaults(), ...config });
  }

  /** Own parameters of the unit of the session (null fields follow the company value). */
  getUnitDefaults(): UnitDefaultsConfig {
    return { defaultWarehouse: null, allowNegativeStock: null, ...this.cache.unitDefaults };
  }

  saveUnitDefaults(unitCode: string, value: UnitDefaultsConfig): Promise<UnitDefaultsConfig> {
    return this.save('unitDefaults', value, unitCode);
  }

  /** Parameters in force for the unit of the session: what voucher screens should use. */
  getParameters(): Omit<SystemDefaultConfig, 'printTemplate'> {
    const { printTemplate: _print, ...company } = this.getSystemDefaults();
    const unit = this.getUnitDefaults();
    return {
      ...company,
      defaultWarehouse: unit.defaultWarehouse ?? company.defaultWarehouse,
      allowNegativeStock: unit.allowNegativeStock ?? company.allowNegativeStock
    };
  }

  getFiscalConfig(): FiscalYearConfig {
    const { fiscalYear, startDate } = { ...DEFAULT_FISCAL_CONFIG, ...this.cache.fiscalConfig };
    return { fiscalYear, startDate };
  }

  saveFiscalConfig(config: Partial<FiscalYearConfig>): Promise<FiscalYearConfig> {
    return this.save('fiscalConfig', { ...this.getFiscalConfig(), ...config });
  }

  getCompanyProfile(): CompanyProfileConfig {
    return { ...DEFAULT_COMPANY_PROFILE, ...this.cache.companyProfile };
  }

  saveCompanyProfile(profile: Partial<CompanyProfileConfig>): Promise<CompanyProfileConfig> {
    return this.save('companyProfile', { ...this.getCompanyProfile(), ...profile });
  }

  getNumberFormat(): NumberFormatConfig {
    return { ...DEFAULT_NUMBER_FORMAT_CONFIG, ...this.cache.numberFormat };
  }

  saveNumberFormat(config: NumberFormatConfig): Promise<NumberFormatConfig> {
    return this.save('numberFormat', config);
  }
}

export const systemSettingsService = new SystemSettingsService();
