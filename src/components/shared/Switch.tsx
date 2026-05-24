interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, ariaLabel, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-[38px] items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1369eb] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#27272b] disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-[#1170ff]" : "bg-slate-300 dark:bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}
