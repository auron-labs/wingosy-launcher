import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createAppTheme } from "./theme-factory";

describe("application theme focus treatment", () => {
  afterEach(cleanup);

  it("shares a high-contrast focus ring across global and MUI controls", () => {
    const theme = createAppTheme("dark", null);
    const focusRing =
      theme.components.MuiCssBaseline.styleOverrides[":focus-visible"];

    expect(focusRing).toStrictEqual({
      outline: "3px solid #8E99F3",
      outlineOffset: 3,
    });
    expect(
      theme.components.MuiButtonBase.styleOverrides.root[
        "&:focus-visible, &.Mui-focusVisible"
      ]
    ).toStrictEqual(focusRing);
    expect(
      theme.components.MuiCssBaseline.styleOverrides[
        "button[data-controller-focused='true']"
      ]
    ).toStrictEqual(focusRing);
    expect(
      theme.components.MuiInputBase.styleOverrides.root["&.Mui-focused"]
        .boxShadow
    ).toBe("0 0 0 3px rgba(142, 153, 243, 0.35)");
  });

  it("injects the focus ring into the rendered global styles", () => {
    render(
      <ThemeProvider theme={createAppTheme("dark", null)}>
        <CssBaseline />
        <button type="button">Focusable action</button>
      </ThemeProvider>
    );

    const styles = Array.from(
      document.head.querySelectorAll("style"),
      (style) => style.textContent
    ).join("\n");
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain("3px solid #8E99F3");
  });
});
