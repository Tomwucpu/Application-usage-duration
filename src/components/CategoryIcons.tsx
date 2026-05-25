import { convertFileSrc } from "@tauri-apps/api/core";
import type { CategoryIconSource } from "../types";

export const BUILTIN_CATEGORY_ICONS = [
  { key: "folder", svg: "/category-icons/1_uncategorized.png" },
  { key: "briefcase", svg: "/category-icons/2_office.png" },
  { key: "book", svg: "/category-icons/3_study.png" },
  { key: "video", svg: "/category-icons/4_video.png" },
  { key: "gamepad", svg: "/category-icons/5_entertainment.png" },
  { key: "messages", svg: "/category-icons/6_social.png" },
  { key: "monitor", svg: "/category-icons/7_system.png" },
];

export function getCategoryAssetSrc(path: string | null | undefined) {
  if (!path) return "";
  try {
    return convertFileSrc(path);
  } catch {
    return "";
  }
}

export function CategoryIcon({
  iconSource,
  builtinIconKey,
  customIconPath,
  base64,
  name,
  className = "w-6 h-6 rounded-md",
}: {
  iconSource: CategoryIconSource | null | undefined;
  builtinIconKey?: string | null;
  customIconPath?: string | null;
  base64?: string | null;
  name: string;
  className?: string;
}) {
  if (iconSource === "file") {
    if (base64) {
      return <img src={`data:image/png;base64,${base64}`} alt={name} className={className} />;
    }
    const assetSrc = getCategoryAssetSrc(customIconPath);
    if (assetSrc) {
      return <img src={assetSrc} alt={name} className={className} />;
    }
  }

  if (iconSource === "builtin" && builtinIconKey) {
    const iconDef = BUILTIN_CATEGORY_ICONS.find((i) => i.key === builtinIconKey);
    if (iconDef) {
      return <img src={iconDef.svg} alt={name} className={className} />;
    }
  }

  return (
    <div className={`${className} bg-slate-100 dark:bg-[#1d1d20] flex items-center justify-center text-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
