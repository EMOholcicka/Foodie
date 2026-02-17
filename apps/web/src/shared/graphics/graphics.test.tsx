import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import { BrandMark, IllustrationPanel, PlanGenerateIllustration, PlanLoadFailIllustration, TodayEmptyMealsIllustration } from "./index";

describe("shared graphics", () => {
  it("renders brand mark", () => {
    render(<BrandMark title="Foodie" />);
    expect(screen.getByRole("img", { name: "Foodie" })).toBeInTheDocument();
  });

  it("renders Today empty meals illustration", () => {
    render(<TodayEmptyMealsIllustration title="No meals" />);
    expect(screen.getByRole("img", { name: "No meals" })).toBeInTheDocument();
  });

  it("renders Plan load fail illustration", () => {
    render(<PlanLoadFailIllustration title="Load failed" />);
    expect(screen.getByRole("img", { name: "Load failed" })).toBeInTheDocument();
  });

  it("renders Plan generate illustration", () => {
    render(<PlanGenerateIllustration title="Generate" />);
    expect(screen.getByRole("img", { name: "Generate" })).toBeInTheDocument();
  });

  it("renders IllustrationPanel under standard MUI ThemeProvider", () => {
    const theme = createTheme({ palette: { mode: "dark" } });
    render(
      <ThemeProvider theme={theme}>
        <IllustrationPanel title="Oops" illustration={<PlanLoadFailIllustration title="err" />} description="Try again" />
      </ThemeProvider>
    );

    expect(screen.getByLabelText("Oops")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });
});
