import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import { AuthRoute } from "./AuthRoute";

import * as authApi from "../../../shared/api/auth";

vi.mock("../../../shared/api/auth", async () => {
  return {
    login: vi.fn(async () => ({ access_token: "t", refresh_token: "r", token_type: "bearer" })),
    register: vi.fn(async () => ({ access_token: "t", refresh_token: "r", token_type: "bearer" })),
  };
});

describe("AuthRoute", () => {
  it("renders login form and submits", async () => {
    const router = createMemoryRouter(
      [
        { path: "/auth", element: <AuthRoute /> },
        { path: "/today", element: <div>Today</div> },
      ],
      { initialEntries: ["/auth"] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("auth-email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByTestId("auth-password"), { target: { value: "password1" } });
    fireEvent.click(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(vi.mocked(authApi.login)).toHaveBeenCalledWith({ email: "a@b.com", password: "password1" });
    });

    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument();
    });
  });

  it("shows info alert for auth reason=required", async () => {
    const router = createMemoryRouter([{ path: "/auth", element: <AuthRoute /> }], {
      initialEntries: ["/auth?reason=required"],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByTestId("auth-reason-alert")).toBeInTheDocument();
    expect(screen.getByText("Please sign in to continue.")).toBeInTheDocument();
  });

  it("shows info alert for auth reason=expired", async () => {
    const router = createMemoryRouter([{ path: "/auth", element: <AuthRoute /> }], {
      initialEntries: ["/auth?reason=expired"],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByTestId("auth-reason-alert")).toBeInTheDocument();
    expect(screen.getByText("Your session expired. Please sign in again.")).toBeInTheDocument();
  });

  it("roundtrips encoded next after login", async () => {
    const router = createMemoryRouter(
      [
        { path: "/auth", element: <AuthRoute /> },
        { path: "/plan", element: <div>Plan</div> },
      ],
      { initialEntries: ["/auth?next=%2Fplan%3Fx%3D1"] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.change(screen.getByTestId("auth-email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByTestId("auth-password"), { target: { value: "password1" } });
    fireEvent.click(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(screen.getByText("Plan")).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe("/plan");
    expect(router.state.location.search).toBe("?x=1");
  });

  it("roundtrips encoded next after register", async () => {
    const router = createMemoryRouter(
      [
        { path: "/auth", element: <AuthRoute /> },
        { path: "/plan", element: <div>Plan</div> },
      ],
      { initialEntries: ["/auth?tab=register&next=%2Fplan%3Fx%3D1"] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.change(screen.getByTestId("auth-email"), { target: { value: "new@b.com" } });
    fireEvent.change(screen.getByTestId("auth-password"), { target: { value: "password1" } });
    fireEvent.click(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(screen.getByText("Plan")).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe("/plan");
    expect(router.state.location.search).toBe("?x=1");
  });

  it("ignores protocol-relative next and falls back to /today", async () => {
    const router = createMemoryRouter(
      [
        { path: "/auth", element: <AuthRoute /> },
        { path: "/today", element: <div>Today</div> },
      ],
      { initialEntries: ["/auth?next=%2F%2Fevil.com%2Fsteal"] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.change(screen.getByTestId("auth-email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByTestId("auth-password"), { target: { value: "password1" } });
    fireEvent.click(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe("/today");
  });

  it("allows short password on login (non-empty validation)", async () => {
    const router = createMemoryRouter([{ path: "/auth", element: <AuthRoute /> }], {
      initialEntries: ["/auth"],
    });

    render(<RouterProvider router={router} />);

    fireEvent.change(screen.getByTestId("auth-email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByTestId("auth-password"), { target: { value: "a" } });
    fireEvent.click(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(vi.mocked(authApi.login)).toHaveBeenCalledWith({ email: "a@b.com", password: "a" });
    });
  });

  it("switches to register tab and enforces minimum password length", async () => {
    const router = createMemoryRouter(
      [
        { path: "/auth", element: <AuthRoute /> },
        { path: "/today", element: <div>Today</div> },
      ],
      { initialEntries: ["/auth?tab=register"] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText("Create your account")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("auth-email"), { target: { value: "new@b.com" } });
    fireEvent.change(screen.getByTestId("auth-password"), { target: { value: "short" } });
    fireEvent.click(screen.getByTestId("auth-submit"));

    expect(await screen.findByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(vi.mocked(authApi.register)).toHaveBeenCalledTimes(0);

    fireEvent.change(screen.getByTestId("auth-password"), { target: { value: "password1" } });
    fireEvent.click(screen.getByTestId("auth-submit"));

    await waitFor(() => {
      expect(vi.mocked(authApi.register)).toHaveBeenCalledWith({ email: "new@b.com", password: "password1" });
    });
  });
});
