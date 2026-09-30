import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, translations } from '../utils/i18n';
import { i18nDbService } from '../services/i18nDbService';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  refreshDbResources: () => void;
  dbDictionary: Record<string, string>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('serp_language');
    return (saved === 'en' || saved === 'vi') ? saved : 'vi';
  });

  const [dbDictionary, setDbDictionary] = useState<Record<string, string>>({});

  const reloadDbResources = useCallback(() => {
    const res = i18nDbService.getDictionaryByCulture(language);
    setDbDictionary(res.resources || {});
  }, [language]);

  useEffect(() => {
    reloadDbResources();
  }, [language, reloadDbResources]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('serp_language', lang);
  };

  const getNested = (obj: any, path: string): string | undefined => {
    if (!obj) return undefined;
    const parts = path.split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = curr[part];
      } else {
        return undefined;
      }
    }
    return typeof curr === 'string' ? curr : undefined;
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    // 1. Check Database SysResources FIRST (DB dynamic translations override)
    let text = dbDictionary[key];

    // 2. Fallback to Client Static i18n JSON files
    if (!text) {
      const dict = translations[language] || translations.vi;
      text =
        getNested(dict, key) ||
        getNested(translations.vi, key) ||
        (dict as Record<string, any>)[key] ||
        (translations.vi as Record<string, any>)[key] ||
        key;
    }

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, refreshDbResources: reloadDbResources, dbDictionary }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
