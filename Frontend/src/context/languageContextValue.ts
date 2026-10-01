import { createContext } from 'react';
import type { Language } from '../utils/i18n';
import type { LanguageOption } from '../services/authService';

// The context object lives alone in this file (type-only imports) so it keeps its identity when the dev server
// hot-reloads LanguageContext.tsx or a locale file. Otherwise the provider and useLanguage could end up with two
// different context objects and every screen would throw "useLanguage must be used within a LanguageProvider".

export interface LanguageContextType {
  language: Language;
  /** Switches the screens (and the Accept-Language of API calls); does not save it to the profile. */
  setLanguage: (lang: Language) => void;
  /** Active languages of the backend catalog, default first (just Vietnamese while they are loading). */
  languages: LanguageOption[];
  t: (key: string, params?: Record<string, string | number>) => string;
  refreshDbResources: () => void;
  dbDictionary: Record<string, string>;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
