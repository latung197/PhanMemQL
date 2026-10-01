// Screen texts per language. Each language has one file per area under locales/<code>/:
//   common.json   – layout, shared controls, API messages (sections common, navigation, api)
//   settings.json – Settings screens
//   inventory.json – inventory screens (not translated yet beyond the existing keys)
// Keys keep their full path ("common.save", "companyUnits.title"); the files of a language are merged.
// A new language: add its folder with the same files and list it in FILES below; `npm run check-i18n` reports
// missing keys. Missing texts fall back to Vietnamese.
import viCommon from '../locales/vi/common.json';
import viSettings from '../locales/vi/settings.json';
import viInventory from '../locales/vi/inventory.json';
import enCommon from '../locales/en/common.json';
import enSettings from '../locales/en/settings.json';
import enInventory from '../locales/en/inventory.json';

/**
 * A language code of the backend catalog (Settings › Ngôn ngữ, sys_language): "vi", "en", "ja"...
 * A language without files, or a missing key, falls back to Vietnamese.
 */
export type Language = string;

export const DEFAULT_LANGUAGE: Language = 'vi';

/** Where the chosen language is kept between visits; apiClient sends it as Accept-Language. */
export const LANGUAGE_STORAGE_KEY = 'serp_language';

type Texts = Record<string, any>;

const FILES: Record<Language, Texts[]> = {
  vi: [viCommon, viSettings, viInventory],
  en: [enCommon, enSettings, enInventory],
};

export const translations: Record<Language, Texts> = Object.fromEntries(
  Object.entries(FILES).map(([code, files]) => [code, Object.assign({}, ...files)])
);

/** The language of the last visit (before the profile is loaded). */
export const storedLanguage = (): Language => {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

const lookup = (texts: Texts | undefined, key: string): string | undefined => {
  let current: unknown = texts;
  for (const part of key.split('.')) {
    if (current && typeof current === 'object' && part in (current as Texts)) current = (current as Texts)[part];
    else return undefined;
  }
  return typeof current === 'string' ? current : undefined;
};

/**
 * Text of a key in a language (default: the stored one), with {name} placeholders filled; Vietnamese when the
 * language lacks it, the key itself when nobody has it. Outside React (e.g. apiClient); screens use useLanguage().t.
 */
export const translate = (key: string, params?: Record<string, string | number>, language: Language = storedLanguage()): string => {
  let text = lookup(translations[language], key) ?? lookup(translations[DEFAULT_LANGUAGE], key) ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
  }
  return text;
};
