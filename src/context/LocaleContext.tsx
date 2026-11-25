import React, { createContext, useContext } from 'react';
import { UiLocale } from '../data/i18n';

const LocaleContext = createContext<UiLocale>('en');

export const LocaleProvider: React.FC<{ locale: UiLocale; children: React.ReactNode }> = ({
  locale,
  children,
}) => <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;

export function useLocale(): UiLocale {
  return useContext(LocaleContext);
}
