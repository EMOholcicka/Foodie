import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";

import { isApiError } from "./http";

describe("isApiError", () => {
  it("returns false for non-axios errors", () => {
    expect(isApiError(new Error("nope"))).toBe(false);
    expect(isApiError("nope")).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

  it("returns true for axios error with API error payload shape", () => {
    const err = new AxiosError("Bad", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: {},
      data: { error: { message: "Boom" } },
    } as any);

    expect(isApiError(err)).toBe(true);
    if (isApiError(err)) {
      expect(err.response?.data.error.message).toBe("Boom");
    }
  });

  it("returns false for axios error without the API error payload shape", () => {
    const err = new AxiosError("Bad", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: {},
      data: { message: "not wrapped" },
    } as any);

    expect(isApiError(err)).toBe(false);
  });
});
