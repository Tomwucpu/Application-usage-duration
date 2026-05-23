import { useState, useCallback, useMemo } from "react";
import { DataTable, type Column } from "../shared/DataTable";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { api } from "../../stores/useStore";
import type { AppMetadataItem } from "../../types";
import type { ToastTone } from "../shared/ToastStack";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface EditableCellProps {
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  onReset?: () => void;
  showReset?: boolean;
}

function EditableCell({ value, placeholder, onSave, onReset, showReset }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleStartEdit = () => {
    setEditValue(value);
    setEditing(true);
  };

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim();
    if (trimmed === value.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed || "");
      setEditing(false);
    } catch {
      // Error handled by parent via pushToast — stay in editing mode
    } finally {
      setSaving(false);
    }
  }, [editValue, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditValue(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={saving}
          autoFocus
          className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-[#3f3f41] rounded bg-white dark:bg-[#1d1d20] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1369ea] disabled:opacity-50"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group min-w-0">
      <span
        onClick={handleStartEdit}
        title={value || placeholder}
        className={`cursor-pointer truncate block ${value ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500 italic text-xs"}`}
      >
        {value || placeholder}
      </span>
      {showReset && onReset && (
        <button
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          title="Reset"
          className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-opacity"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface AppTableProps {
  data: AppMetadataItem[];
  search: string;
  t: (key: string) => string;
  pushToast: (tone: ToastTone, message: string) => void;
  onRefresh: () => Promise<void>;
  appIcons: Record<string, string>;
}

interface ConfirmState {
  type: "delete" | "resetName" | "resetIcon";
  appName: string;
}

export function AppTable({ data, search, t, pushToast, onRefresh, appIcons }: AppTableProps) {
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState("total_seconds");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (item) =>
        item.app_name.toLowerCase().includes(q) ||
        (item.display_name && item.display_name.toLowerCase().includes(q))
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    const sorted = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      if (sortKey === "display_name") {
        const nameA = a.display_name || a.app_name;
        const nameB = b.display_name || b.app_name;
        return nameA.localeCompare(nameB) * dir;
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
      width: "180px",
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
      key: "icon_path",
      header: t("appManagement.iconPath"),
      sortable: false,
      width: "200px",
      render: (item) => {
        const iconPath = item.custom_icon_path || item.default_icon_path || item.app_path || "";
        return (
          <EditableCell
            value={iconPath}
            placeholder={t("appManagement.clickToEdit")}
            showReset={!!item.custom_icon_path}
            onSave={(val) => handleSaveCustomIcon(item.app_name, val)}
            onReset={() => setConfirm({ type: "resetIcon", appName: item.app_name })}
          />
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
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        emptyText={search.trim() ? t("appManagement.noResults") : t("appManagement.noData")}
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
