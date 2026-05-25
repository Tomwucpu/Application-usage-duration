import { useState, useCallback } from "react";

interface EditableCellProps {
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  onReset?: () => void;
  showReset?: boolean;
}

export function EditableCell({ value, placeholder, onSave, onReset, showReset }: EditableCellProps) {
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
