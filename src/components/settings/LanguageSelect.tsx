import { useT, type Locale } from "../../i18n";
import { DropdownMenu } from "../shared/DropdownMenu";

const localeOptions: { value: Locale; labelKey: "settings.language.zh-CN" | "settings.language.en-US" }[] = [
  { value: "zh-CN", labelKey: "settings.language.zh-CN" },
  { value: "en-US", labelKey: "settings.language.en-US" },
];

export function LanguageSelect() {
  const { t, locale, setLocale } = useT();
  const selected = localeOptions.find((option) => option.value === locale)!;

  return (
    <DropdownMenu label={t(selected.labelKey)} align="right" minWidthClassName="min-w-[100px]">
      {({ close }) =>
        localeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setLocale(option.value);
              close();
            }}
            className={`w-full text-left mb-0.5 px-3 py-1.5 text-sm rounded-lg ${
              locale === option.value
                ? "text-[#ffffff] bg-[#1369ea] dark:text-[#ffffff] dark:bg-[#1369ea]"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#262c36]"
            }`}
          >
            {t(option.labelKey)}
          </button>
        ))
      }
    </DropdownMenu>
  );
}
