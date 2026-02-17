import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";

function setup() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          {
            index: true,
            element: (
              <div data-testid="page" style={{ height: 2000 }}>
                Content
              </div>
            ),
          },
        ],
      },
    ],
    { initialEntries: ["/"] }
  );

  return render(<RouterProvider router={router} />);
}

describe(AppShell.name, () => {
  it("reserves space for the sticky header so main content is not overlapped", () => {
    const { container } = setup();

    // We rely on MUI's Toolbar spacer (theme mixin) rather than hard-coded padding.
    // Assert that an empty toolbar spacer exists between AppBar and <main>.
    const toolbars = container.querySelectorAll("header + .MuiToolbar-root");
    expect(toolbars.length).toBe(1);

    const main = screen.getByRole("main");
    expect(main).not.toHaveStyle({ paddingTop: "64px" });
  });

  it("renders logout action as an accessible icon button", () => {
    setup();

    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });
});
