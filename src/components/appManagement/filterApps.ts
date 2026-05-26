import type { AppMetadataItem } from "../../types";

export const UNCATEGORIZED_FILTER_KEY = -1;

export function filterAppsBySearchAndCategories(
  data: AppMetadataItem[],
  search: string,
  selectedCategoryIds: number[],
): AppMetadataItem[] {
  const q = search.trim().toLowerCase();
  const hasSearch = q.length > 0;
  const hasCategoryFilters = selectedCategoryIds.length > 0;
  const wantsUncategorized = selectedCategoryIds.includes(UNCATEGORIZED_FILTER_KEY);
  const selectedCategories = new Set(
    selectedCategoryIds.filter((id) => id !== UNCATEGORIZED_FILTER_KEY),
  );

  return data.filter((item) => {
    const matchesSearch = !hasSearch
      || item.app_name.toLowerCase().includes(q)
      || (item.display_name?.toLowerCase().includes(q) ?? false)
      || (item.category_name?.toLowerCase().includes(q) ?? false);

    if (!matchesSearch) {
      return false;
    }

    if (!hasCategoryFilters) {
      return true;
    }

    if (item.category_id === null) {
      return wantsUncategorized;
    }

    return selectedCategories.has(item.category_id);
  });
}
