import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

interface DropdownMenuProps {
  label: ReactNode;
  align?: "left" | "right";
  minWidthClassName?: string;
  buttonClassName?: string;
  menuClassName?: string;
  scrollable?: boolean;
  maxHeight?: number;
  children: (controls: { close: () => void }) => ReactNode;
}

export function getDropdownScrollConfig(
  scrollable: boolean,
  maxHeight: number,
) {
  return {
    shouldScroll: scrollable,
    contentMaxHeight: scrollable ? maxHeight : undefined,
  };
}

export function DropdownMenu({
  label,
  align = "left",
  minWidthClassName = "min-w-[100px]",
  buttonClassName = "",
  menuClassName = "",
  scrollable = false,
  maxHeight = 240,
  children,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const uid = useMemo(() => `dmu-${Math.random().toString(36).slice(2, 9)}`, []);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;

    const recalc = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        close();
        return;
      }

      const style: CSSProperties = {
        position: "fixed",
        minWidth: rect.width,
        width: rect.width,
      };

      const spaceBelow = window.innerHeight - rect.bottom;
      const menuGap = 4;
      const effectiveMax = scrollable ? maxHeight + 40 : 300;

      if (spaceBelow < effectiveMax && rect.top > effectiveMax) {
        style.bottom = window.innerHeight - rect.top + menuGap;
      } else {
        style.top = rect.bottom + menuGap;
      }

      if (align === "right") {
        style.right = window.innerWidth - rect.right;
      } else {
        style.left = rect.left;
      }

      setMenuStyle(style);
    };

    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open, align, maxHeight, scrollable, close]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  const checkScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    setAtTop(el.scrollTop <= 1);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    if (open && scrollable) {
      requestAnimationFrame(() => checkScroll());
    }
  }, [open, scrollable, checkScroll]);

  const scrollUp = () => contentRef.current?.scrollBy({ top: -80, behavior: "smooth" });
  const scrollDown = () => contentRef.current?.scrollBy({ top: 80, behavior: "smooth" });
  const menuChildren = children({ close });
  const { shouldScroll, contentMaxHeight } = getDropdownScrollConfig(scrollable, maxHeight);

  const menuContent = (
    <>
      {shouldScroll && (
        <style>{`.${uid}::-webkit-scrollbar{display:none}.${uid}{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      )}
      <div
        ref={menuRef}
        role="menu"
        className={`fixed z-50 rounded-md border border-slate-200 dark:border-[#3f3f41] shadow-lg bg-white dark:bg-[#1d1d20] ${menuClassName}`}
        style={menuStyle}
      >
        {shouldScroll ? (
          <div className="relative">
            {!atTop && (
              <button
                type="button"
                onClick={scrollUp}
                className="absolute top-0 left-0 right-0 z-10 flex justify-center py-0.5 bg-gradient-to-b from-white dark:from-[#1d1d20] to-transparent rounded-t-md cursor-pointer border-0"
              >
                <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <div
              ref={contentRef}
              className={`${uid} overflow-y-auto py-1`}
              style={{ maxHeight: contentMaxHeight }}
              onScroll={checkScroll}
            >
              {menuChildren}
            </div>
            {!atBottom && (
              <button
                type="button"
                onClick={scrollDown}
                className="absolute bottom-0 left-0 right-0 z-10 flex justify-center py-0.5 bg-gradient-to-t from-white dark:from-[#1d1d20] to-transparent rounded-b-md cursor-pointer border-0"
              >
                <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="p-1">{menuChildren}</div>
        )}
      </div>
    </>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
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
      {open && createPortal(menuContent, document.body)}
    </div>
  );
}
