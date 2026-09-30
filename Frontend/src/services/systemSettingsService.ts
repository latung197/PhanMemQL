// ERP system settings (defaults, fiscal periods, currencies, exchange rates, company profile).
// Values are stored by the backend (/api/settings/system-config) and cached here after login, so the
// getters stay synchronous. Save methods write to the backend first and update the cache on success.
import { apiRequest } from './apiClient';

export interface AutoNumberingRule {
  prefix: string;
  pattern: string;
  nextNumber: number;
  digits: number;
}

export interface PrintSignatureLabels {
  preparedBy: string;
  storekeeper: string;
  chiefAccountant: string;
  director: string;
}

export interface PrintTemplateConfig {
  companyHeader: string;
  companyAddress: string;
  taxCode: string;
  phone: string;
  email: string;
  website: string;
  footerNote: string;
  signatures: PrintSignatureLabels;
}

export interface SystemDefaultConfig {
  defaultWarehouse: string;
  costingMethod: 'MONTHLY_AVG' | 'INSTANT_AVG' | 'FIFO' | 'SPECIFIC';
  defaultCurrency: string;
  qtyDecimalPlaces: number;
  priceDecimalPlaces: number;
  autoNumbering: Record<string, AutoNumberingRule>;
  printTemplate: PrintTemplateConfig;
}

export interface MonthLockState {
  month: number;
  year: number;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

export interface FiscalYearConfig {
  fiscalYear: number;
  startDate: string;
  lockDate: string;
  months: MonthLockState[];
}

export interface CurrencyItem {
  id: string;
  code: string;
  nameVi: string;
  symbol: string;
  isBaseCurrency: boolean;
  decimalPlaces: number;
  status: 'active' | 'inactive';
}

export interface ExchangeRateEntry {
  id: string;
  date: string;
  currencyCode: string;
  buyRate: number;
  sellRate: number;
  accountingRate: number;
  updatedBy: string;
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

// Default Constants
export const DEFAULT_SYSTEM_CONFIG: SystemDefaultConfig = {
  defaultWarehouse: 'WH01',
  costingMethod: 'MONTHLY_AVG',
  defaultCurrency: 'VND',
  qtyDecimalPlaces: 2,
  priceDecimalPlaces: 0,
  autoNumbering: {
    PNK: { prefix: 'PNK', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 },
    PXK: { prefix: 'PXK', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 },
    LDC: { prefix: 'LDC', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 },
    PXDC: { prefix: 'PXDC', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 },
    PNDC: { prefix: 'PNDC', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 },
    PKK: { prefix: 'PKK', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 },
    SO: { prefix: 'SO', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 },
    PT: { prefix: 'PT', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 },
    PC: { prefix: 'PC', pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}', nextNumber: 1, digits: 4 }
  },
  printTemplate: {
    companyHeader: 'TẬP ĐOÀN CÔNG NGHỆ & SẢN XUẤT TRẦN THỊNH JSC',
    companyAddress: 'Tầng 18, Tòa nhà S-ERP Tower, Đường Lê Duẩn, Q.1, TP. Hồ Chí Minh',
    taxCode: '0318899201',
    phone: '028 3822 9999',
    email: 'contact@tranthinh-erp.vn',
    website: 'https://tranthinh-erp.vn',
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
  startDate: '2026-01-01',
  lockDate: '2025-12-31',
  months: [
    { month: 1, year: 2026, isLocked: true, lockedBy: 'admin', lockedAt: '2026-02-01 18:00' },
    { month: 2, year: 2026, isLocked: true, lockedBy: 'admin', lockedAt: '2026-03-01 18:00' },
    { month: 3, year: 2026, isLocked: true, lockedBy: 'admin', lockedAt: '2026-04-01 18:00' },
    { month: 4, year: 2026, isLocked: true, lockedBy: 'admin', lockedAt: '2026-05-01 18:00' },
    { month: 5, year: 2026, isLocked: true, lockedBy: 'admin', lockedAt: '2026-06-01 18:00' },
    { month: 6, year: 2026, isLocked: true, lockedBy: 'admin', lockedAt: '2026-07-01 18:00' },
    { month: 7, year: 2026, isLocked: true, lockedBy: 'admin', lockedAt: '2026-08-01 18:00' },
    { month: 8, year: 2026, isLocked: false },
    { month: 9, year: 2026, isLocked: false },
    { month: 10, year: 2026, isLocked: false },
    { month: 11, year: 2026, isLocked: false },
    { month: 12, year: 2026, isLocked: false }
  ]
};

export const DEFAULT_CURRENCIES: CurrencyItem[] = [
  { id: '1', code: 'VND', nameVi: 'Việt Nam Đồng', symbol: '₫', isBaseCurrency: true, decimalPlaces: 0, status: 'active' },
  { id: '2', code: 'USD', nameVi: 'Đô la Mỹ', symbol: '$', isBaseCurrency: false, decimalPlaces: 2, status: 'active' },
  { id: '3', code: 'EUR', nameVi: 'Đồng Euro Châu Âu', symbol: '€', isBaseCurrency: false, decimalPlaces: 2, status: 'active' },
  { id: '4', code: 'JPY', nameVi: 'Yên Nhật', symbol: '¥', isBaseCurrency: false, decimalPlaces: 0, status: 'active' },
  { id: '5', code: 'CNY', nameVi: 'Nhân Dân Tệ Trung Quốc', symbol: '¥', isBaseCurrency: false, decimalPlaces: 2, status: 'active' },
  { id: '6', code: 'SGD', nameVi: 'Đô la Singapore', symbol: 'S$', isBaseCurrency: false, decimalPlaces: 2, status: 'active' },
  { id: '7', code: 'GBP', nameVi: 'Bảng Anh', symbol: '£', isBaseCurrency: false, decimalPlaces: 2, status: 'active' },
  { id: '8', code: 'KRW', nameVi: 'Won Hàn Quốc', symbol: '₩', isBaseCurrency: false, decimalPlaces: 0, status: 'active' }
];

export const DEFAULT_EXCHANGE_RATES: ExchangeRateEntry[] = [
  { id: '1', date: '2026-09-01', currencyCode: 'USD', buyRate: 25420, sellRate: 25790, accountingRate: 25550, updatedBy: 'admin' },
  { id: '2', date: '2026-09-01', currencyCode: 'EUR', buyRate: 27500, sellRate: 28050, accountingRate: 27700, updatedBy: 'admin' },
  { id: '3', date: '2026-09-01', currencyCode: 'JPY', buyRate: 164.2, sellRate: 169.5, accountingRate: 166.5, updatedBy: 'admin' },
  { id: '4', date: '2026-09-01', currencyCode: 'CNY', buyRate: 3510, sellRate: 3620, accountingRate: 3550, updatedBy: 'admin' },
  { id: '5', date: '2026-08-01', currencyCode: 'USD', buyRate: 25350, sellRate: 25720, accountingRate: 25500, updatedBy: 'admin' },
  { id: '6', date: '2026-08-01', currencyCode: 'EUR', buyRate: 27400, sellRate: 27950, accountingRate: 27600, updatedBy: 'admin' }
];

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

/** Section names used by the backend API. */
interface SettingSections {
  systemDefaults?: SystemDefaultConfig;
  fiscalConfig?: FiscalYearConfig;
  currencies?: CurrencyItem[];
  exchangeRates?: ExchangeRateEntry[];
  companyProfile?: CompanyProfileConfig;
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

  private async save<K extends SectionName>(section: K, value: NonNullable<SettingSections[K]>) {
    await apiRequest<void>('PUT', `/api/settings/system-config/${section}`, value);
    this.cache = { ...this.cache, [section]: value };
    return value;
  }

  // 1. System Defaults
  getSystemDefaults(): SystemDefaultConfig {
    return { ...DEFAULT_SYSTEM_CONFIG, ...this.cache.systemDefaults };
  }

  saveSystemDefaults(config: Partial<SystemDefaultConfig>): Promise<SystemDefaultConfig> {
    return this.save('systemDefaults', { ...this.getSystemDefaults(), ...config });
  }

  /**
   * Preview of the next voucher code. The sequence is only advanced in this browser session;
   * real numbering belongs to the backend voucher module.
   */
  generateVoucherCode(voucherType: string, dateStr?: string): string {
    const defaults = this.getSystemDefaults();
    const rule = defaults.autoNumbering[voucherType];
    const now = dateStr ? new Date(dateStr) : new Date();
    const yyyy = now.getFullYear().toString();
    const yy = yyyy.slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    if (!rule) {
      return `${voucherType}-${yyyy}${mm}-${String(Date.now()).slice(-4)}`;
    }

    const seqStr = String(rule.nextNumber).padStart(rule.digits || 4, '0');
    const code = rule.pattern
      .replace('{PREFIX}', rule.prefix)
      .replace('{YYYY}', yyyy)
      .replace('{YY}', yy)
      .replace('{MM}', mm)
      .replace('{DD}', dd)
      .replace('{SEQ}', seqStr);

    this.cache = {
      ...this.cache,
      systemDefaults: {
        ...defaults,
        autoNumbering: { ...defaults.autoNumbering, [voucherType]: { ...rule, nextNumber: rule.nextNumber + 1 } }
      }
    };
    return code;
  }

  // 2. Fiscal Year & Period Lock
  getFiscalConfig(): FiscalYearConfig {
    return { ...DEFAULT_FISCAL_CONFIG, ...this.cache.fiscalConfig };
  }

  saveFiscalConfig(config: Partial<FiscalYearConfig>): Promise<FiscalYearConfig> {
    return this.save('fiscalConfig', { ...this.getFiscalConfig(), ...config });
  }

  isDateLocked(dateStr: string): { locked: boolean; reason?: string } {
    const config = this.getFiscalConfig();
    if (!dateStr) return { locked: false };

    if (config.lockDate && dateStr <= config.lockDate) {
      return {
        locked: true,
        reason: `Ngày chứng từ (${dateStr}) nằm trong hoặc trước ngày khóa sổ hệ thống (${config.lockDate})`
      };
    }

    if (config.startDate && dateStr < config.startDate) {
      return {
        locked: true,
        reason: `Ngày chứng từ (${dateStr}) trước ngày bắt đầu nhập liệu của hệ thống (${config.startDate})`
      };
    }

    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const monthLock = config.months.find(ml => ml.month === m && ml.year === y);
    if (monthLock && monthLock.isLocked) {
      return {
        locked: true,
        reason: `Kỳ kế toán Tháng ${m}/${y} đã được khóa sổ bởi ${monthLock.lockedBy || 'quản trị viên'}!`
      };
    }

    return { locked: false };
  }

  // 3. Currencies
  getCurrencies(): CurrencyItem[] {
    return this.cache.currencies ?? DEFAULT_CURRENCIES;
  }

  saveCurrencies(currencies: CurrencyItem[]): Promise<CurrencyItem[]> {
    return this.save('currencies', currencies);
  }

  // 4. Exchange Rates
  getExchangeRates(): ExchangeRateEntry[] {
    return this.cache.exchangeRates ?? DEFAULT_EXCHANGE_RATES;
  }

  saveExchangeRates(rates: ExchangeRateEntry[]): Promise<ExchangeRateEntry[]> {
    return this.save('exchangeRates', rates);
  }

  getRateForCurrency(code: string, dateStr?: string): number {
    if (code === 'VND') return 1;
    const rates = this.getExchangeRates();
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);

    const currencyRates = rates
      .filter(r => r.currencyCode === code && r.date <= targetDate)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (currencyRates.length > 0) {
      return currencyRates[0].accountingRate || currencyRates[0].buyRate || 1;
    }

    const fallback = rates.find(r => r.currencyCode === code);
    return fallback ? fallback.accountingRate : 1;
  }

  // 5. Company Profile
  getCompanyProfile(): CompanyProfileConfig {
    return { ...DEFAULT_COMPANY_PROFILE, ...this.cache.companyProfile };
  }

  saveCompanyProfile(profile: Partial<CompanyProfileConfig>): Promise<CompanyProfileConfig> {
    return this.save('companyProfile', { ...this.getCompanyProfile(), ...profile });
  }

  // 6. Reset all settings to the built-in defaults
  async resetAllSettings(): Promise<void> {
    await this.save('systemDefaults', DEFAULT_SYSTEM_CONFIG);
    await this.save('fiscalConfig', DEFAULT_FISCAL_CONFIG);
    await this.save('currencies', DEFAULT_CURRENCIES);
    await this.save('exchangeRates', DEFAULT_EXCHANGE_RATES);
    await this.save('companyProfile', DEFAULT_COMPANY_PROFILE);
  }

  // 7. Export / import the full configuration bundle
  exportFullConfig(): string {
    const bundle = {
      systemDefaults: this.getSystemDefaults(),
      fiscalConfig: this.getFiscalConfig(),
      currencies: this.getCurrencies(),
      exchangeRates: this.getExchangeRates(),
      companyProfile: this.getCompanyProfile(),
      exportedAt: new Date().toISOString(),
      version: '2.0'
    };
    return JSON.stringify(bundle, null, 2);
  }

  /** Throws on invalid JSON or when the backend rejects a section. */
  async importFullConfig(jsonString: string): Promise<void> {
    const parsed = JSON.parse(jsonString) as SettingSections;
    if (parsed.systemDefaults) await this.save('systemDefaults', parsed.systemDefaults);
    if (parsed.fiscalConfig) await this.save('fiscalConfig', parsed.fiscalConfig);
    if (parsed.currencies) await this.save('currencies', parsed.currencies);
    if (parsed.exchangeRates) await this.save('exchangeRates', parsed.exchangeRates);
    if (parsed.companyProfile) await this.save('companyProfile', parsed.companyProfile);
  }
}

export const systemSettingsService = new SystemSettingsService();