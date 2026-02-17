import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import React from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Provide a render that includes LocalizationProvider for MUI date pickers.
(globalThis as any).renderWithLocalization = (ui: React.ReactElement) =>
  render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>
  );
