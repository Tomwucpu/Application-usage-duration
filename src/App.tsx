import { useEffect } from "react";
import { I18nProvider, useT } from "./i18n";
import { useStore } from "./stores/useStore";
import { Dashboard } from "./components/Dashboard";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

function AppInner() {
  const init = useStore((s) => s.init);
  const { t } = useT();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{t("app.title")}</h1>
        <LanguageSwitcher />
      </header>
      <main className="p-6">
        <Dashboard />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
