// Demo departments, currencies and exchange rates. Only used by scripts/export-seed.ts to build the
// backend seed (ServerService/Core/SeedData/seed.json); at run time these lists come from the API.
import type { Currency, Department, SaveExchangeRateInput } from '../services/settingsApi';

export const DEMO_DEPARTMENTS: Omit<Department, 'userCount'>[] = [
  { code: 'BGD', name: 'Ban Giám Đốc', note: null, isActive: true },
  { code: 'KT', name: 'Phòng Kế Toán', note: null, isActive: true },
  { code: 'KTKV', name: 'Phòng Kế Toán - Kho Vận', note: null, isActive: true },
  { code: 'KD', name: 'Phòng Kinh Doanh', note: null, isActive: true },
  { code: 'KV', name: 'Phòng Kho Vận', note: null, isActive: true },
  { code: 'NS', name: 'Phòng Nhân Sự', note: null, isActive: true },
  { code: 'IT', name: 'Phòng Kỹ Thuật & IT', note: null, isActive: true }
];

export const DEMO_CURRENCIES: Currency[] = [
  { code: 'VND', name: 'Việt Nam Đồng', symbol: '₫', decimalPlaces: 0, isBase: true, isActive: true },
  { code: 'USD', name: 'Đô la Mỹ', symbol: '$', decimalPlaces: 2, isBase: false, isActive: true },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, isBase: false, isActive: true },
  { code: 'JPY', name: 'Yên Nhật', symbol: '¥', decimalPlaces: 0, isBase: false, isActive: true },
  { code: 'CNY', name: 'Nhân dân tệ', symbol: '¥', decimalPlaces: 2, isBase: false, isActive: true },
  { code: 'SGD', name: 'Đô la Singapore', symbol: 'S$', decimalPlaces: 2, isBase: false, isActive: true },
  { code: 'GBP', name: 'Bảng Anh', symbol: '£', decimalPlaces: 2, isBase: false, isActive: true },
  { code: 'KRW', name: 'Won Hàn Quốc', symbol: '₩', decimalPlaces: 0, isBase: false, isActive: true }
];

export const DEMO_EXCHANGE_RATES: SaveExchangeRateInput[] = [
  { currencyCode: 'USD', date: '2026-09-01', buyRate: 25420, sellRate: 25790, accountingRate: 25550 },
  { currencyCode: 'EUR', date: '2026-09-01', buyRate: 27500, sellRate: 28050, accountingRate: 27700 },
  { currencyCode: 'JPY', date: '2026-09-01', buyRate: 164.2, sellRate: 169.5, accountingRate: 166.5 },
  { currencyCode: 'CNY', date: '2026-09-01', buyRate: 3510, sellRate: 3620, accountingRate: 3550 },
  { currencyCode: 'USD', date: '2026-08-01', buyRate: 25350, sellRate: 25720, accountingRate: 25500 },
  { currencyCode: 'EUR', date: '2026-08-01', buyRate: 27400, sellRate: 27950, accountingRate: 27600 }
];
