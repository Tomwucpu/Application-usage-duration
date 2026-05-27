import { useMemo, useState } from "react";
import { DataTable, type Column } from "../shared/DataTable";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { EditableCell } from "../shared/EditableCell";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { CategoryIcon } from "../CategoryIcons";
import { api, useStore } from "../../stores/useStore";
import type { CategoryItem } from "../../types";
import type { ToastTone } from "../shared/ToastStack";

function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

interface Props {
  data: CategoryItem[];
  search: string;
  t: (key: string) => string;
  pushToast: (tone: ToastTone, message: string) => void;
  onRefresh: () => Promise<void>;
  onVisibleRowsChange?: (rows: CategoryItem[]) => void;
}

export function CategoryTable({ data, search, t, pushToast, onRefresh, onVisibleRowsChange }: Props) {
  const categoryFileIcons = useStore((s) => s.categoryFileIcons);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) => item.name.toLowerCase().includes(q));
  }, [data, search]);

  const handleSaveName = async (id: number, item: CategoryItem, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === item.name) return;
    try {
      await api.updateCategory({
        id,
        name: trimmed,
        iconSource: item.icon_source,
        builtinIconKey: item.builtin_icon_key,
        customIconPath: item.custom_icon_path,
      });
      await onRefresh();
      pushToast("success", t("categoryManagement.saveSuccess"));
    } catch {
      pushToast("error", t("categoryManagement.saveFailed"));
      throw new Error("save failed");
    }
  };

  const handleDelete = async () => {
    if (confirmDeleteId == null) return;
    try {
      await api.deleteCategory(confirmDeleteId);
      await onRefresh();
      pushToast("success", t("categoryManagement.deleteSuccess"));
    } catch {
      pushToast("error", t("categoryManagement.deleteFailed"));
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const columns: Column<CategoryItem>[] = [
    {
      key: "icon",
      header: t("categoryManagement.icon"),
      width: "70px",
      render: (item) => (
        <CategoryIcon
          iconSource={item.icon_source}
          builtinIconKey={item.builtin_icon_key}
          customIconPath={item.custom_icon_path}
          base64={categoryFileIcons[item.id] || null}
          name={item.name}
          className="w-6 h-6 rounded-md"
        />
      ),
    },
    {
      key: "icon_path",
      header: "Icon",
      width: "260px",
      render: (item) => (
        <CategoryIconPicker
          item={item}
          onChanged={onRefresh}
          pushToast={pushToast}
          t={t}
        />
      ),
    },
    {
      key: "name",
      header: t("categoryManagement.name"),
      width: "120px",
      render: (item) => (
        <EditableCell
          value={item.name}
          placeholder=""
          onSave={(val) => handleSaveName(item.id, item, val)}
        />
      ),
    },
    {
      key: "app_count",
      header: t("categoryManagement.appCount"),
      width: "90px",
      render: (item) => <span className="tabular-nums">{item.app_count}</span>,
    },
    {
      key: "total_seconds",
      header: t("categoryManagement.totalTime"),
      width: "90px",
      render: (item) => <span className="tabular-nums">{formatDuration(item.total_seconds)}</span>,
    },
    {
      key: "actions",
      header: t("categoryManagement.actions"),
      width: "60px",
      render: (item) => (
        <div className="flex items-center">
          {!item.is_default && (
            <button
              onClick={() => setConfirmDeleteId(item.id)}
              className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
              title={t("categoryManagement.delete")}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={filtered}
        pageSize={pageSize}
        pageSizeOptions={[10, 20, 30]}
        onPageSizeChange={setPageSize}
        onPageDataChange={onVisibleRowsChange}
        emptyText={search.trim() ? t("categoryManagement.noResults") : t("categoryManagement.noData")}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t("categoryManagement.delete")}
        message={t("categoryManagement.confirmDelete")}
        confirmText={t("categoryManagement.confirm")}
        cancelText={t("categoryManagement.cancel")}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  );
}
