import { useState, useCallback } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import type { ToastTone } from "../shared/ToastStack";

interface UpdateCheckerProps {
  t: (key: string) => string;
  pushToast: (tone: ToastTone, message: string) => void;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
}

type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest"; currentVersion: string }
  | { kind: "available"; currentVersion: string; latestVersion: string; body: string; html_url: string }
  | { kind: "downloading" }
  | { kind: "installed" }
  | { kind: "error"; message: string };

const GITHUB_API = "https://api.github.com/repos/Tomwucpu/Application-usage-duration/releases/latest";

function parseSemver(v: string): number[] {
  return v.replace(/^v/, "").split(".").map(Number);
}

function isNewer(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va > vb;
  }
  return false;
}

export function UpdateChecker({ t, pushToast }: UpdateCheckerProps) {
  const [state, setState] = useState<UpdateState>({ kind: "idle" });

  const handleCheck = useCallback(async () => {
    setState({ kind: "checking" });
    try {
      const currentVersion = await getVersion();
      const res = await fetch(GITHUB_API);
      if (!res.ok) {
        setState({ kind: "error", message: t("settings.update.error_api") });
        return;
      }
      const release: GitHubRelease = await res.json();
      if (!isNewer(release.tag_name, currentVersion)) {
        setState({ kind: "latest", currentVersion });
        return;
      }
      setState({
        kind: "available",
        currentVersion,
        latestVersion: release.tag_name,
        body: release.body,
        html_url: release.html_url,
      });
    } catch {
      setState({ kind: "error", message: t("settings.update.failed") });
    }
  }, [t]);

  const handleDownload = useCallback(async () => {
    if (state.kind !== "available") return;
    setState({ kind: "downloading" });
    try {
      const update = await check();
      if (!update) {
        setState({
          kind: "error",
          message: t("settings.update.no_latest_json"),
        });
        return;
      }
      await update.downloadAndInstall();
      setState({ kind: "installed" });
      pushToast("info", t("settings.update.restart_hint"));
    } catch {
      setState({ kind: "error", message: t("settings.update.failed") });
    }
  }, [state, t, pushToast]);

  const buttonLabel = (() => {
    switch (state.kind) {
      case "checking":
        return t("settings.update.checking");
      case "downloading":
        return t("settings.update.downloading");
      case "available":
        return t("settings.update.install");
      default:
        return t("settings.update.action");
    }
  })();

  const buttonDisabled =
    state.kind === "checking" || state.kind === "downloading";

  const buttonAction =
    state.kind === "available" ? handleDownload : handleCheck;

  return (
    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("settings.update.title")}
          {(state.kind === "latest" || state.kind === "available") && (
            <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
              v{state.currentVersion}
            </span>
          )}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); buttonAction(); }}
          disabled={buttonDisabled}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white transition-colors"
        >
          {buttonLabel}
        </button>
      </div>

      {state.kind === "latest" && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400">{t("settings.update.latest")}</p>
      )}

      {state.kind === "available" && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("settings.update.available")} {state.latestVersion}
          </p>
          {state.body && (
            <details className="text-xs text-slate-500 dark:text-slate-400">
              <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                {t("settings.update.release_notes")}
              </summary>
              <pre className="mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto text-slate-500 dark:text-slate-400">
                {state.body}
              </pre>
            </details>
          )}
          <p>
            <a
              href={state.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t("settings.update.download_page")}
            </a>
          </p>
        </div>
      )}

      {state.kind === "installed" && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400">{t("settings.update.installed")}</p>
      )}

      {state.kind === "error" && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-red-600 dark:text-red-400">{state.message}</p>
          {state.message === t("settings.update.no_latest_json") && (
            <p>
              <a
                href={`https://github.com/Tomwucpu/Application-usage-duration/releases`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t("settings.update.download_page")}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
