import { useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render: (item: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  emptyText?: string;
  className?: string;
}

function SortIcon({ dir }: { dir?: "asc" | "desc" }) {
  return (
    <svg
      className="ml-1 inline-block h-3 w-3"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 4.5L6 1.5L9 4.5"
        stroke={dir === "asc" ? "#3b82f6" : "#94a3b8"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 7.5L6 10.5L9 7.5"
        stroke={dir === "desc" ? "#3b82f6" : "#94a3b8"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DataTable<T>({
  columns,
  data,
  pageSize,
  pageSizeOptions = [10, 20, 30],
  onPageSizeChange,
  sortKey,
  sortDir,
  onSort,
  emptyText,
  className = "",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const startIdx = (safePage - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#3f3f41]">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#1d1d20] border-b border-slate-200 dark:border-[#3f3f41]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none ${
                    col.sortable ? "cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" : ""
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => {
                    if (col.sortable && onSort) {
                      onSort(col.key);
                    }
                  }}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    {col.sortable && (
                      <SortIcon dir={sortKey === col.key ? sortDir : undefined} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#3f3f41]">
            {pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-slate-400 dark:text-slate-500"
                >
                  {emptyText || "No data"}
                </td>
              </tr>
            ) : (
              pageData.map((item, index) => (
                <tr
                  key={startIdx + index}
                  className="bg-white dark:bg-[#27272b] hover:bg-slate-50 dark:hover:bg-[#1d1d20] transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                      {col.render(item, startIdx + index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span>
              {startIdx + 1}-{Math.min(startIdx + pageSize, data.length)} / {data.length}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                if (onPageSizeChange) {
                  onPageSizeChange(newSize);
                }
              }}
              className="bg-slate-100 dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] rounded px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}/page
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1d1d20] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="px-2 text-slate-600 dark:text-slate-400">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1d1d20] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
