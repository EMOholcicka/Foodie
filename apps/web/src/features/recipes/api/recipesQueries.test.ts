import { describe, expect, it } from "vitest";

import { normalizeRecipesListParams } from "./recipesQueries";

describe("normalizeRecipesListParams", () => {
  it("applies defaults when called with undefined", () => {
    expect(normalizeRecipesListParams(undefined)).toEqual({
      high_protein: false,
      favorites_only: false,
      tags: [],
    });
  });

  it("normalizes tags (trim, drop empties, sort) and booleans", () => {
    // sort is localeCompare-based and case-sensitive in the implementation
    expect(
      normalizeRecipesListParams({
        high_protein: true,
        favorites_only: false,
        tags: ["  b ", "", "a", "B"],
      })
    ).toEqual({
      high_protein: true,
      favorites_only: false,
      tags: ["a", "b", "B"],
    });
  });
});
