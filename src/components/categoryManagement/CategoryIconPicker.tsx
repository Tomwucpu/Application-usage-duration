import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { DropdownMenu } from "../shared/DropdownMenu";
import { BUILTIN_CATEGORY_ICONS } from "../CategoryIcons";
import { api } from "../../stores/useStore";
import type { CategoryItem } from "../../types";
import type { ToastTone } from "../shared/ToastStack";

interface Props {
  item: CategoryItem;
  onChanged: () => Promise<void>;
  pushToast: (tone: ToastTone, message: string) => void;
  t: (key: string) => string;
}

export function CategoryIconPicker({ item, onChanged, pushToast, t }: Props) {
  const [iconSource, setIconSource] = useState<"builtin" | "file">(item.icon_source);
  const [saving, setSaving] = useState(false);

  const handleSelectBuiltin = async (key: string) => {
    setSaving(true);
    try {
      await api.updateCategory({
        id: item.id,
        name: item.name,
        iconSource: "builtin",
        builtinIconKey: key,
        customIconPath: null,
      });
      await onChanged();
    } catch {
      pushToast("error", t("categoryManagement.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: t("common.imageFiles"), extensions: ["png", "jpg", "jpeg", "gif", "bmp", "ico"] }],
    });
    if (!selected) return;
    setSaving(true);
    try {
      await api.updateCategory({
        id: item.id,
        name: item.name,
        iconSource: "file",
        builtinIconKey: null,
        customIconPath: selected,
      });
      await onChanged();
    } catch {
      pushToast("error", t("categoryManagement.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const labelText = item.icon_source === "file"
    ? item.custom_icon_path?.split("\\").pop()?.split("/").pop() || t("categoryManagement.iconFile")
    : BUILTIN_CATEGORY_ICONS.find((i) => i.key === item.builtin_icon_key)?.key
      ?? BUILTIN_CATEGORY_ICONS[0].key;

  return (
    <DropdownMenu
      label={<span className="text-xs truncate max-w-[80px]">{labelText}</span>}
      minWidthClassName="min-w-[230px]"
    >
      {({ close }) => (
        <div className="space-y-0.5">
          <div className="flex p-1 gap-0.5 border-b border-slate-200 dark:border-[#3f3f41]">
            <button
              onClick={() => setIconSource("builtin")}
              className={`flex-1 py-1 text-xs rounded ${
                iconSource === "builtin"
                  ? "bg-slate-200 dark:bg-[#3f3f41] text-slate-800 dark:text-slate-200"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272b]"
              }`}
            >
              {t("categoryManagement.iconBuiltin")}
            </button>
            <button
              onClick={() => setIconSource("file")}
              className={`flex-1 py-1 text-xs rounded ${
                iconSource === "file"
                  ? "bg-slate-200 dark:bg-[#3f3f41] text-slate-800 dark:text-slate-200"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272b]"
              }`}
            >
              {t("categoryManagement.iconFile")}
            </button>
          </div>
          {iconSource === "builtin" ? (
            <div className="grid grid-cols-5 gap-0.5 p-1">
              {BUILTIN_CATEGORY_ICONS.map((icon) => (
                <button
                  key={icon.key}
                  onClick={() => {
                    handleSelectBuiltin(icon.key);
                    close();
                  }}
                  disabled={saving}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-[#27272b] disabled:opacity-50"
                  title={icon.key}
                >
                  <img src={icon.svg} alt={icon.key} className="w-6 h-6" />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-2">
              <button
                onClick={async () => {
                  close();
                  await handleSelectFile();
                }}
                disabled={saving}
                className="w-full px-3 py-2 text-sm text-left rounded border border-slate-200 dark:border-[#3f3f41] hover:bg-slate-100 dark:hover:bg-[#27272b] text-slate-600 dark:text-slate-300 disabled:opacity-50"
              >
                {t("categoryManagement.chooseFile")}
              </button>
            </div>
          )}
        </div>
      )}
    </DropdownMenu>
  );
}
