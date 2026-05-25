import { useState, useRef, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { DropdownMenu } from "../shared/DropdownMenu";
import { BUILTIN_CATEGORY_ICONS } from "../CategoryIcons";
import { api } from "../../stores/useStore";
import type { ToastTone } from "../shared/ToastStack";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  pushToast: (tone: ToastTone, message: string) => void;
  t: (key: string) => string;
}

export function CreateCategoryDialog({ open: isOpen, onClose, onCreated, pushToast, t }: Props) {
  const [name, setName] = useState("");
  const [iconSource, setIconSource] = useState<"builtin" | "file">("builtin");
  const [builtinIconKey, setBuiltinIconKey] = useState("folder");
  const [customIconPath, setCustomIconPath] = useState("");
  const [saving, setSaving] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast("error", t("categoryManagement.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      await api.createCategory({
        name: trimmedName,
        iconSource,
        builtinIconKey: iconSource === "builtin" ? builtinIconKey : null,
        customIconPath: iconSource === "file" ? (customIconPath.trim() || null) : null,
      });
      await onCreated();
      pushToast("success", t("categoryManagement.saveSuccess"));
      onClose();
      setName("");
      setIconSource("builtin");
      setBuiltinIconKey("folder");
      setCustomIconPath("");
    } catch {
      pushToast("error", t("categoryManagement.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const currentIcon = BUILTIN_CATEGORY_ICONS.find((i) => i.key === builtinIconKey) || BUILTIN_CATEGORY_ICONS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#27272b] border border-slate-200 dark:border-[#3f3f41] rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-fadeIn">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {t("categoryManagement.add")}
        </h3>

        <div className="space-y-4">
          <label className="space-y-1 text-sm block">
            <span className="text-slate-500 dark:text-slate-400">{t("categoryManagement.name")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-[#3f3f41] rounded bg-white dark:bg-[#1d1d20] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1369ea]"
              autoFocus
            />
          </label>

          <label className="space-y-1 text-sm block">
            <span className="text-slate-500 dark:text-slate-400">{t("categoryManagement.iconSource")}</span>
            <DropdownMenu
              label={iconSource === "builtin" ? t("categoryManagement.iconBuiltin") : t("categoryManagement.iconFile")}
              minWidthClassName="w-full"
            >
              {({ close }) => (
                <>
                  <button
                    onClick={() => { setIconSource("builtin"); close(); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272b] rounded"
                  >
                    {t("categoryManagement.iconBuiltin")}
                  </button>
                  <button
                    onClick={() => { setIconSource("file"); close(); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272b] rounded"
                  >
                    {t("categoryManagement.iconFile")}
                  </button>
                </>
              )}
            </DropdownMenu>
          </label>

          {iconSource === "builtin" ? (
            <label className="space-y-1 text-sm block">
              <span className="text-slate-500 dark:text-slate-400">{t("categoryManagement.icon")}</span>
              <DropdownMenu
                label={currentIcon.key}
                minWidthClassName="w-full"
              >
                {({ close }) => (
                  <>
                    {BUILTIN_CATEGORY_ICONS.map((icon) => (
                      <button
                        key={icon.key}
                        onClick={() => { setBuiltinIconKey(icon.key); close(); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272b] rounded flex items-center gap-2"
                      >
                        <img src={icon.svg} alt={icon.key} className="w-5 h-5" />
                        {icon.key}
                      </button>
                    ))}
                  </>
                )}
              </DropdownMenu>
            </label>
          ) : (
            <label className="space-y-1 text-sm block">
              <span className="text-slate-500 dark:text-slate-400">{t("categoryManagement.iconPath")}</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customIconPath}
                  onChange={(e) => setCustomIconPath(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-[#3f3f41] rounded bg-white dark:bg-[#1d1d20] text-slate-700 dark:text-slate-300"
                />
                <button
                  onClick={async () => {
                    const selected = await open({
                      multiple: false,
                      filters: [
                        {
                          name: t("categoryManagement.imageFiles"),
                          extensions: ["png", "jpg", "jpeg", "gif", "bmp", "ico"],
                        },
                      ],
                    });
                    if (selected) setCustomIconPath(selected);
                  }}
                  className="px-3 py-2 text-sm rounded border border-slate-200 dark:border-[#3f3f41] hover:bg-slate-100 dark:hover:bg-[#27272b] text-slate-600 dark:text-slate-300"
                >
                  {t("categoryManagement.browseIcon")}
                </button>
              </div>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-[#3f3f41] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1d1d20] transition-colors"
          >
            {t("categoryManagement.cancel")}
          </button>
          <button
            ref={confirmRef}
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-[#1369ea] text-white hover:bg-[#0f58c5] disabled:opacity-50 transition-colors"
          >
            {t("categoryManagement.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
