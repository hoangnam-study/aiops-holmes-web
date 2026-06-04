import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@mui/material";
import StatusPill from "./StatusPill";
import { theme } from "../theme/theme";

describe("StatusPill", () => {
  it("renders the supplied status", () => {
    render(
      <ThemeProvider theme={theme}>
        <StatusPill value="connected" />
      </ThemeProvider>
    );
    expect(screen.getByText("connected")).toBeInTheDocument();
  });
});
