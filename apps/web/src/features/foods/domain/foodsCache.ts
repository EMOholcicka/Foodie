import { useCallback, useRef, useState } from "react";

import type { Food } from "../api/foodsApi";

export type FoodsCache = {
  seed: (foods: Food[]) => void;
  get: (id: string) => Food | undefined;
  getMany: (ids: string[]) => Map<string, Food>;
};

export function useFoodsCache(): FoodsCache {
  const ref = useRef<Map<string, Food>>(new Map());
  const [, forceRender] = useState(0);

  const seed = useCallback((foods: Food[]) => {
    let changed = false;
    for (const f of foods) {
      if (!f?.id) continue;
      const prev = ref.current.get(f.id);
      if (prev !== f) {
        ref.current.set(f.id, f);
        changed = true;
      }
    }
    if (changed) forceRender((x) => x + 1);
  }, []);

  const get = useCallback((id: string) => ref.current.get(id), []);

  const getMany = useCallback((ids: string[]) => {
    const map = new Map<string, Food>();
    for (const id of ids) {
      const f = ref.current.get(id);
      if (f) map.set(id, f);
    }
    return map;
  }, []);

  return { seed, get, getMany };
}
