import { useT, type Locale } from "../../i18n";

const labels: Record<Locale, string> = {
  "zh-CN": "中",
  "en-US": "EN",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useT();

  const next: Locale = locale === "zh-CN" ? "en-US" : "zh-CN";

  return (
    <button
      onClick={() => setLocale(next)}
      className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white dark:hover:border-slate-600 transition-colors"
    >
      {labels[locale]}
    </button>
  );
}
