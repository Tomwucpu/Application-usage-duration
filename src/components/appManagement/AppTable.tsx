import { useState, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { DataTable, type Column } from "../shared/DataTable";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { EditableCell } from "../shared/EditableCell";
import { DropdownMenu } from "../shared/DropdownMenu";
import { api } from "../../stores/useStore";
import type { AppMetadataItem, CategoryItem } from "../../types";
import type { ToastTone } from "../shared/ToastStack";
import { filterAppsBySearchAndCategories } from "./filterApps";

function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

interface AppTableProps {
  data: AppMetadataItem[];
  categories: CategoryItem[];
  search: string;
  selectedCategoryIds: number[];
  t: (key: string) => string;
  pushToast: (tone: ToastTone, message: string) => void;
  onRefresh: () => Promise<void>;
  appIcons: Record<string, string>;
  onVisibleRowsChange?: (rows: AppMetadataItem[]) => void;
}

interface ConfirmState {
  type: "delete" | "resetName" | "resetIcon";
  appName: string;
}

export function AppTable({
  data,
  categories,
  search,
  selectedCategoryIds,
  t,
  pushToast,
  onRefresh,
  appIcons,
  onVisibleRowsChange,
}: AppTableProps) {
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState("total_seconds");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const filtered = useMemo(
    () => filterAppsBySearchAndCategories(data, search, selectedCategoryIds),
    [data, search, selectedCategoryIds],
  );

  const sorted = useMemo(() => {
    const sorted = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      if (sortKey === "display_name") {
        const nameA = a.display_name || a.app_name;
        const nameB = b.display_name || b.app_name;
        return nameA.localeCompare(nameB) * dir;
      }
      if (sortKey === "category_name") {
        return (a.category_name || "").localeCompare(b.category_name || "") * dir;
      }
      if (sortKey === "total_seconds") {
        return (a.total_seconds - b.total_seconds) * dir;
      }
      return 0;
    });
    return sorted;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleConfirm = () => {
    if (!confirm) return;
    const { type, appName } = confirm;
    setConfirm(null);

    (async () => {
      try {
        if (type === "delete") {
          await api.deleteRecordsByApp(appName);
          pushToast("success", t("appManagement.deleteSuccess"));
        } else if (type === "resetName") {
          await api.resetAppDisplayName(appName);
          pushToast("success", t("appManagement.saveSuccess"));
        } else if (type === "resetIcon") {
          await api.resetAppCustomIcon(appName);
          pushToast("success", t("appManagement.saveSuccess"));
        }
        await onRefresh();
      } catch {
        pushToast("error", type === "delete" ? t("appManagement.deleteFailed") : t("appManagement.saveFailed"));
      }
    })();
  };

  const handleSaveDisplayName = async (appName: string, displayName: string) => {
    try {
      await api.setAppDisplayName(appName, displayName || null);
      await onRefresh();
      pushToast("success", t("appManagement.saveSuccess"));
    } catch {
      pushToast("error", t("appManagement.saveFailed"));
      throw new Error("save failed");
    }
  };

  const handleResetDisplayName = async (appName: string) => {
    try {
      await api.resetAppDisplayName(appName);
      await onRefresh();
      pushToast("success", t("appManagement.saveSuccess"));
    } catch {
      pushToast("error", t("appManagement.saveFailed"));
      throw new Error("save failed");
    }
  };

  const handleSaveCustomIcon = async (appName: string, customIconPath: string) => {
    try {
      await api.setAppCustomIcon(appName, customIconPath || null);
      await onRefresh();
      pushToast("success", t("appManagement.saveSuccess"));
    } catch {
      pushToast("error", t("appManagement.saveFailed"));
      throw new Error("save failed");
    }
  };

  const handleSaveCategory = async (appName: string, categoryId: number) => {
    try {
      await api.setAppCategory(appName, categoryId);
      await onRefresh();
      pushToast("success", t("appManagement.saveSuccess"));
    } catch {
      pushToast("error", t("appManagement.saveFailed"));
    }
  };

  const columns: Column<AppMetadataItem>[] = [
    {
      key: "icon",
      header: t("appManagement.icon"),
      width: "60px",
      sortable: false,
      render: (item) => {
        const icon = appIcons[item.app_name];
        return icon ? (
          <img src={`data:image/png;base64,${icon}`} alt="" className="h-6 w-6 rounded" />
        ) : (
          <div className="h-6 w-6 rounded bg-slate-200 dark:bg-slate-700" />
        );
      },
    },
    {
      key: "display_name",
      header: t("appManagement.appName"),
      sortable: true,
      width: "120px",
      render: (item) => {
        const displayValue = item.display_name || item.app_name;
        return (
          <EditableCell
            value={displayValue}
            placeholder={t("appManagement.clickToEdit")}
            showReset={!!item.display_name}
            onSave={(val) => {
              if (val === item.app_name) return handleResetDisplayName(item.app_name);
              return handleSaveDisplayName(item.app_name, val);
            }}
            onReset={() => setConfirm({ type: "resetName", appName: item.app_name })}
          />
        );
      },
    },
    {
      key: "category_name",
      header: t("appManagement.category"),
      sortable: true,
      width: "140px",
      render: (item) => {
        const currentCategory = categories.find((c) => c.id === item.category_id);
        return (
          <DropdownMenu
            label={currentCategory?.name || t("appManagement.noCategory")}
            minWidthClassName="w-full"
            scrollable
          >
            {({ close }) => (
              <>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      handleSaveCategory(item.app_name, category.id);
                      close();
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272b] rounded"
                  >
                    {category.name}
                  </button>
                ))}
              </>
            )}
          </DropdownMenu>
        );
      },
    },
    {
      key: "icon_path",
      header: t("appManagement.iconPath"),
      sortable: false,
      width: "220px",
      render: (item) => {
        const iconPath = item.custom_icon_path || item.default_icon_path || item.app_path || "";
        return (
          <div className="flex items-center gap-1 min-w-0">
            <EditableCell
              value={iconPath}
              placeholder={t("appManagement.clickToEdit")}
              showReset={!!item.custom_icon_path}
              onSave={(val) => handleSaveCustomIcon(item.app_name, val)}
              onReset={() => setConfirm({ type: "resetIcon", appName: item.app_name })}
            />
            <button
              onClick={async () => {
                const selected = await open({
                  multiple: false,
                  filters: [
                    {
                      name: t("appManagement.imageFiles") || "Images",
                      extensions: ["png", "jpg", "jpeg", "gif", "bmp", "ico"],
                    },
                  ],
                });
                if (selected) {
                  await handleSaveCustomIcon(item.app_name, selected);
                }
              }}
              title={t("appManagement.browseIcon")}
              className="shrink-0 text-slate-400 hover:text-[#1369ea] dark:text-slate-500 dark:hover:text-[#1369ea] transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 17a1 1 0 01-1-1V5.5A2.5 2.5 0 015.5 3H8l2 2h4.5A2.5 2.5 0 0117 7.5V16a1 1 0 01-1 1H4z" />
                <path d="M10 8v6M7 11h6" />
              </svg>
            </button>
          </div>
        );
      },
    },
    {
      key: "total_seconds",
      header: t("appManagement.totalTime"),
      sortable: true,
      width: "120px",
      render: (item) => (
        <span className="text-slate-900 dark:text-slate-100 tabular-nums">
          {formatDuration(item.total_seconds)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("appManagement.actions"),
      width: "120px",
      sortable: false,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              setConfirm({ type: "delete", appName: item.app_name })
            }
            title={t("appManagement.delete")}
            className="px-2 py-1 text-xs rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            {t("appManagement.delete")}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={sorted}
        pageSize={pageSize}
        pageSizeOptions={[10, 20, 30]}
        onPageSizeChange={setPageSize}
        onPageDataChange={onVisibleRowsChange}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        emptyText={search.trim() || selectedCategoryIds.length > 0 ? t("appManagement.noResults") : t("appManagement.noData")}
        className="mt-4"
      />

      <ConfirmDialog
        open={confirm?.type === "delete"}
        title={t("appManagement.delete")}
        message={t("appManagement.confirmDelete")}
        confirmText={t("appManagement.confirm")}
        cancelText={t("appManagement.cancel")}
        danger
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.type === "resetName"}
        title={t("appManagement.resetName")}
        message={t("appManagement.confirmResetName")}
        confirmText={t("appManagement.confirm")}
        cancelText={t("appManagement.cancel")}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.type === "resetIcon"}
        title={t("appManagement.resetIcon")}
        message={t("appManagement.confirmResetIcon")}
        confirmText={t("appManagement.confirm")}
        cancelText={t("appManagement.cancel")}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
