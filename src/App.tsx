import { useState, useEffect, lazy, Suspense } from "react";
import { I18nProvider, useT } from "./i18n";
import { useStore, api } from "./stores/useStore";
import { invoke } from "@tauri-apps/api/core";
import { setDisplayNames } from "./components/AppNames";

const Dashboard = lazy(async () => {
  const mod = await import("./components/Dashboard");
  return { default: mod.Dashboard };
});

const SettingsPage = lazy(async () => {
  const mod = await import("./components/SettingsPage");
  return { default: mod.SettingsPage };
});

const AppManagement = lazy(async () => {
  const mod = await import("./components/appManagement/AppManagement");
  return { default: mod.AppManagement };
});

type View = "dashboard" | "settings" | "appManagement";

function NavButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-md transition-colors ${
        active
          ? "bg-indigo-50 dark:bg-[#27272b] text-[#3b82f6] dark:text-[#3b82f6]"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#27272b] hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function AppInner() {
  const init = useStore((s) => s.init);
  const theme = useStore((s) => s.theme);
  const displayNames = useStore((s) => s.displayNames);
  const { t, locale } = useT();
  const [currentView, setCurrentView] = useState<View>("dashboard");

  useEffect(() => {
    const p = init();
    return () => {
      p.then((cleanup) => cleanup());
    };
  }, [init]);

  useEffect(() => {
    invoke("update_window_theme", { theme });
  }, [theme]);

  useEffect(() => {
    api.setSetting("locale", locale);
    invoke("update_tray_menu", { locale });
  }, [locale]);

  useEffect(() => {
    if (displayNames) {
      setDisplayNames(displayNames);
    }
  }, [displayNames]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#1d1d20] text-slate-900 dark:text-slate-100 transition-colors">
      <header className="border-b border-slate-200 dark:border-[#3f3f41] px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{t("app.title")}</h1>
        <div className="flex items-center gap-1">
          <NavButton
            active={currentView === "dashboard"}
            onClick={() => setCurrentView("dashboard")}
            title={t("tab.dashboard")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </NavButton>
          <NavButton
            active={currentView === "settings"}
            onClick={() => setCurrentView("settings")}
            title={t("settings.title")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </NavButton>
          <NavButton
            active={currentView === "appManagement"}
            onClick={() => setCurrentView("appManagement")}
            title={t("appManagement.title")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </NavButton>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6" key={currentView}>
        <div className="animate-fadeIn">
          <Suspense fallback={<div className="text-center text-slate-500 py-12">{t("loading")}</div>}>
            {currentView === "dashboard" ? <Dashboard /> : currentView === "settings" ? <SettingsPage /> : <AppManagement />}
          </Suspense>
        </div>
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
