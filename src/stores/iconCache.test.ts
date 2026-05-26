import { describe, expect, it } from "vitest";
import {
  createBoundedIconCache,
  mergeBoundedIconCache,
} from "./iconCache";

describe("mergeBoundedIconCache", () => {
  it("keeps requested keys after merging new icons", () => {
    const cache = createBoundedIconCache<string>(3);

    const merged = mergeBoundedIconCache(cache, {
      Chrome: "icon-1",
      Cursor: "icon-2",
    });

    expect(merged.values.Chrome).toBe("icon-1");
    expect(merged.values.Cursor).toBe("icon-2");
    expect(merged.order).toEqual(["Chrome", "Cursor"]);
  });

  it("evicts the oldest key when capacity is exceeded", () => {
    const cache = createBoundedIconCache<string>(2);
    const filled = mergeBoundedIconCache(cache, {
      Chrome: "icon-1",
      Cursor: "icon-2",
    });

    const merged = mergeBoundedIconCache(filled, {
      WeChat: "icon-3",
    });

    expect(merged.values.Chrome).toBeUndefined();
    expect(merged.values.Cursor).toBe("icon-2");
    expect(merged.values.WeChat).toBe("icon-3");
    expect(merged.order).toEqual(["Cursor", "WeChat"]);
  });

  it("refreshes recency for updated keys before evicting", () => {
    const cache = createBoundedIconCache<string>(2);
    const filled = mergeBoundedIconCache(cache, {
      Chrome: "icon-1",
      Cursor: "icon-2",
    });

    const touched = mergeBoundedIconCache(filled, {
      Chrome: "icon-1b",
    });
    const merged = mergeBoundedIconCache(touched, {
      WeChat: "icon-3",
    });

    expect(merged.values.Chrome).toBe("icon-1b");
    expect(merged.values.Cursor).toBeUndefined();
    expect(merged.values.WeChat).toBe("icon-3");
    expect(merged.order).toEqual(["Chrome", "WeChat"]);
  });
});
