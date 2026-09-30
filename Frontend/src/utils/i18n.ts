import viTranslations from '../locales/vi.json';
import enTranslations from '../locales/en.json';

export type Language = 'vi' | 'en';

export const translations: Record<Language, any> = {
  vi: viTranslations,
  en: enTranslations,
};

