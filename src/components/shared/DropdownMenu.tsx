import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface DropdownMenuProps {
  label: ReactNode;
  align?: "left" | "right";
  minWidthClassName?: string;
  buttonClassName?: string;
  menuClassName?: string;
  children: (controls: { close: () => void }) => ReactNode;
}

export function DropdownMenu({
  label,
  align = "left",
  minWidthClassName = "min-w-[100px]",
  buttonClassName = "",
  menuClassName = "",
  children,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const alignmentClassName = align === "right" ? "right-0" : "left-0";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 justify-between text-sm bg-slate-100 dark:bg-[#1d1d20] border border-slate-200 dark:border-[#3f3f41] rounded-md px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1369eb] cursor-pointer ${minWidthClassName} ${buttonClassName}`}
      >
        <span>{label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-1 z-10 rounded-md border border-slate-200 dark:border-[#3f3f41] shadow-lg bg-white dark:bg-[#1d1d20] p-1 ${alignmentClassName} ${minWidthClassName} ${menuClassName}`}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
