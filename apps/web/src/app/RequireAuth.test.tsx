import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import { RequireAuth } from "./RequireAuth";

vi.mock("../shared/api/auth", async () => {
  return {
    loadStoredAccessToken: vi.fn(() => null),
  };
});

describe("RequireAuth", () => {
  it("redirects unauthenticated to /auth preserving next and including reason=required", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/plan",
          element: (
            <RequireAuth>
              <div>Protected</div>
            </RequireAuth>
          ),
        },
        { path: "/auth", element: <div>Auth</div> },
      ],
      { initialEntries: ["/plan?x=1"] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("Auth")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/auth");
    expect(router.state.location.search).toBe("?reason=required&next=%2Fplan%3Fx%3D1");
  });
});
