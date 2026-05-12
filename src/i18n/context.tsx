import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import zhCN from "./zh-CN.json";
import enUS from "./en-US.json";

export type Locale = "zh-CN" | "en-US";
type Translations = typeof zhCN;

const translations: Record<Locale, Translations> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

interface I18nContextValue {
  locale: Locale;
  t: (key: keyof Translations) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem("locale");
    return saved === "en-US" ? "en-US" : "zh-CN";
  });

  const setLocale = useCallback((loc: Locale) => {
    setLocaleState(loc);
    localStorage.setItem("locale", loc);
  }, []);

  const t = useCallback(
    (key: keyof Translations) => translations[locale][key] ?? key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx;
}
