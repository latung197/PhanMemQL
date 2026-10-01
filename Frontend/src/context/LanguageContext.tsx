import React, { useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_LANGUAGE, Language, LANGUAGE_STORAGE_KEY, storedLanguage, translate } from '../utils/i18n';
import { i18nDbService } from '../services/i18nDbService';
import { authService, LanguageOption } from '../services/authService';
import { LanguageContext } from './languageContextValue';

// The language of the screens. Before login it is the one of the last visit; after login App applies the user's
// language from the profile (Settings › Ngôn ngữ lists the choices). Changing it in the header also saves it to
// the profile (Header). Missing texts fall back to Vietnamese.

const FALLBACK_LANGUAGES: LanguageOption[] = [{ code: DEFAULT_LANGUAGE, nativeName: 'Tiếng Việt', isDefault: true }];  // i18n-ignore

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(storedLanguage);
  const [languages, setLanguages] = useState<LanguageOption[]>(FALLBACK_LANGUAGES);

  const [dbDictionary, setDbDictionary] = useState<Record<string, string>>({});

  const reloadDbResources = useCallback(() => {
    const res = i18nDbService.getDictionaryByCulture(language);
    setDbDictionary(res.resources || {});
  }, [language]);

  useEffect(() => {
    reloadDbResources();
  }, [language, reloadDbResources]);

  useEffect(() => {
    authService.getLanguages()
      .then(list => { if (list.length > 0) setLanguages(list); })
      .catch(() => { /* backend unreachable: keep Vietnamese only */ });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, lang); } catch { /* storage unavailable */ }
    document.documentElement.lang = lang;
  }, []);

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    // Texts kept in the database override the files (the old I18nDbManager screen; replaced by phase B).
    const fromDb = dbDictionary[key];
    if (!fromDb) return translate(key, params, language);
    return Object.entries(params ?? {}).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), fromDb);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, languages, t, refreshDbResources: reloadDbResources, dbDictionary }}>
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
