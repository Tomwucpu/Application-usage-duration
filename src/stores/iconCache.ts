export interface BoundedIconCache<T> {
  maxSize: number;
  values: Record<string, T>;
  order: string[];
}

export function createBoundedIconCache<T>(maxSize: number): BoundedIconCache<T> {
  return {
    maxSize,
    values: {},
    order: [],
  };
}

export function mergeBoundedIconCache<T>(
  cache: BoundedIconCache<T>,
  incoming: Record<string, T>,
): BoundedIconCache<T> {
  const values = { ...cache.values };
  const order = [...cache.order];

  for (const [key, value] of Object.entries(incoming)) {
    values[key] = value;

    const existingIndex = order.indexOf(key);
    if (existingIndex >= 0) {
      order.splice(existingIndex, 1);
    }
    order.push(key);

    while (order.length > cache.maxSize) {
      const evicted = order.shift();
      if (evicted) {
        delete values[evicted];
      }
    }
  }

  return {
    maxSize: cache.maxSize,
    values,
    order,
  };
}
