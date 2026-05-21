import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from "react";

interface InfoTooltipProps {
  children: ReactNode;
}

type Align = "center" | "left" | "right";

export function InfoTooltip({ children }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [align, setAlign] = useState<Align>("center");
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const visible = open || hovered;

  const handleMouseEnter = () => {
    clearTimeout(hideTimerRef.current);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    hideTimerRef.current = setTimeout(() => setHovered(false), 150);
  };

  useEffect(() => {
    return () => clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!visible || !bubbleRef.current) {
      setAlign("center");
      return;
    }
    const rect = bubbleRef.current.getBoundingClientRect();
    const margin = 8;
    if (rect.right > window.innerWidth - margin) {
      setAlign("right");
    } else if (rect.left < margin) {
      setAlign("left");
    } else {
      setAlign("center");
    }
  }, [visible, children]);

  const bubbleClass =
    align === "center"
      ? "left-1/2 -translate-x-1/2"
      : align === "right"
        ? "right-0"
        : "left-0";

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[11px] font-semibold leading-none text-slate-500 transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-400"
        aria-label="More information"
      >
        ?
      </button>
      {visible && (
        <div ref={bubbleRef} className={`absolute top-full z-20 mt-2 w-80 ${bubbleClass}`}>
          <div className="rounded-xl border border-slate-200/70 bg-white/95 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 shadow-lg shadow-slate-900/8 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95 dark:text-slate-400 dark:shadow-black/20">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

