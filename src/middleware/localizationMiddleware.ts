import type { NextFunction, Request, Response } from 'express';
import { LocalizationService } from '../shared/localization/localizationService';
import { DEFAULT_LOCALE, SupportedLocale } from '../shared/localization/translations';

/**
 * Localization Middleware
 * Extracts x-locale header from request and sets locale context
 * Defaults to English if header is missing or invalid
 */
export const localizationMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    // Get locale from x-locale header (case-insensitive)
    let locale = (req.get('x-locale') || req.get('X-Locale') || '').toLowerCase().trim();

    // Validate and get valid locale
    locale = LocalizationService.getValidLocale(locale || undefined) as SupportedLocale;

    // Attach locale to request object for use in controllers
    (req as any).locale = locale;

    // Log locale selection for debugging
    const headerLocale = req.get('x-locale') || req.get('X-Locale');
    if (headerLocale && headerLocale.toLowerCase().trim() !== locale) {
      console.debug(`Locale fallback: requested "${headerLocale}" -> using "${locale}"`);
    }
  } catch (error) {
    console.error('Error in localizationMiddleware:', error);
    // Default to English on error
    (req as any).locale = DEFAULT_LOCALE;
  }

  next();
};

/**
 * Helper to get locale from request
 * @param req - Express Request object
 * @returns Current locale code
 */
export const getLocaleFromRequest = (req: Request): SupportedLocale => {
  return (req as any).locale || DEFAULT_LOCALE;
};

/**
 * Helper to translate in response
 * @param req - Express Request object
 * @param key - Translation key
 * @returns Translated message in user's locale
 */
export const t = (req: Request, key: string): string => {
  const locale = getLocaleFromRequest(req);
  return LocalizationService.translate(key, locale);
};
