import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  SupportedLocale,
  translations,
} from './translations';

/**
 * Localization Service - Handles translation and locale management
 * Supports: en (English), hi (Hindi), or (Odia)
 */
export class LocalizationService {
  /**
   * Get translated message for given key in specified locale
   * Falls back to English if translation not found
   * @param key - Translation key (e.g., 'auth.login.success')
   * @param locale - Locale code (en, hi, or)
   * @returns Translated message or fallback to English
   */
  static translate(key: string, locale: SupportedLocale = DEFAULT_LOCALE): string {
    // Validate locale
    if (!SUPPORTED_LOCALES.includes(locale)) {
      locale = DEFAULT_LOCALE;
    }

    // Get translation for the requested locale
    let message = translations[locale]?.[key];

    // If not found in requested locale, fallback to English
    if (!message) {
      message = translations[DEFAULT_LOCALE]?.[key];
    }

    // If still not found, return the key itself as fallback
    if (!message) {
      console.warn(`Translation key not found: ${key} for locale: ${locale}`);
      return key;
    }

    return message;
  }

  /**
   * Validate if locale is supported
   * @param locale - Locale code to validate
   * @returns true if locale is supported, false otherwise
   */
  static isValidLocale(locale: string): locale is SupportedLocale {
    return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
  }

  /**
   * Get default locale if provided locale is invalid
   * @param locale - Locale code to validate
   * @returns Valid locale code
   */
  static getValidLocale(locale: string | undefined): SupportedLocale {
    if (!locale || !this.isValidLocale(locale)) {
      return DEFAULT_LOCALE;
    }
    return locale;
  }

  /**
   * Get all supported locales
   * @returns Array of supported locale codes
   */
  static getSupportedLocales(): SupportedLocale[] {
    return [...SUPPORTED_LOCALES];
  }
}
