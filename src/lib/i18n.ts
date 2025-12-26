/**
 * i18n - Internationalization module
 * 
 * This module re-exports the centralized translations and provides
 * backward-compatible functions for the existing codebase.
 */

import { webTranslations, getTranslation, formatDate, formatTime } from './translations/index';

export type Language = 'ARM' | 'RU';

// Re-export for backward compatibility
export const translations = webTranslations;

/**
 * Get translation by path (backward compatible with existing code)
 */
export function t(lang: Language, path: string): string {
  return getTranslation(webTranslations, lang, path);
}

// Re-export formatting functions
export { formatDate, formatTime };
