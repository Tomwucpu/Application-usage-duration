import { useState, useEffect } from "react";
import { useStore, api } from "../../stores/useStore";

interface IgnoredAppsProps {
  t: (key: string) => string;
}

function parseIgnoredApps(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function IgnoredApps({ t }: IgnoredAppsProps) {
  const appIcons = useStore((s) => s.appIcons);
  const ensureAppIconsLoaded = useStore((s) => s.ensureAppIconsLoaded);
  const [appNames, setAppNames] = useState<string[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [ignoredEnabled, setIgnoredEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const names = await api.getAllAppNames();
        setAppNames(names || []);
        await ensureAppIconsLoaded();
        const ignoredVal = await api.getSetting("ignored_apps");
        const ignoredList = parseIgnoredApps(ignoredVal);
        setIgnored(ignoredList);

        const ignoredEnabledVal = await api.getSetting("ignored_apps_enabled");
        setIgnoredEnabled(
          ignoredEnabledVal ? ignoredEnabledVal === "true" : ignoredList.length > 0,
        );
      } catch {
        // ignore
      }
    })();
  }, [ensureAppIconsLoaded]);

  const toggleIgnored = async (name: string) => {
    const next = ignored.includes(name) ? ignored.filter((n) => n !== name) : [...ignored, name];
    setIgnored(next);
    await api.setSetting("ignored_apps", JSON.stringify(next));
  };

  const toggleIgnoredEnabled = async () => {
    const next = !ignoredEnabled;
    setIgnoredEnabled(next);
    await api.setSetting("ignored_apps_enabled", String(next));
  };

  return (
    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("settings.ignored.title")}</h3>
        <button
          role="switch"
          aria-checked={ignoredEnabled}
          onClick={toggleIgnoredEnabled}
          className={`relative inline-flex h-5 w-[38px] items-center rounded-full transition-colors ${
            ignoredEnabled ? "bg-[#1170ff]" : "bg-[#1170ff] dark:bg-slate-700"
          }`}
          aria-label={t("settings.ignored.title")}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              ignoredEnabled ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <div
        className={`grid grid-cols-2 gap-2 overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-in-out ${
          ignoredEnabled
            ? "mt-3 opacity-100 translate-y-0 pointer-events-auto"
            : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        {appNames.map((n) => (
          <label
            key={n}
            className="flex items-center gap-4 rounded px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <input
              type="checkbox"
              checked={ignored.includes(n)}
              onChange={() => toggleIgnored(n)}
              aria-label={`Ignore ${n}`}
            />
            {appIcons[n] ? (
              <img src={`data:image/png;base64,${appIcons[n]}`} alt={n} className="w-5 h-5 rounded-md mt-0.5 flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-md flex-shrink-0 bg-slate-700 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                {n.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm">{n}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
