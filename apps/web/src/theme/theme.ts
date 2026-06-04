import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#3777ff"
    },
    secondary: {
      main: "#56c596"
    },
    success: {
      main: "#55bd91"
    },
    warning: {
      main: "#f2a93b"
    },
    background: {
      default: "#f7f9fb",
      paper: "#ffffff"
    },
    text: {
      primary: "#1f2937",
      secondary: "#667985"
    },
    divider: "#e6eaee"
  },
  typography: {
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    h4: {
      fontSize: "1.5rem",
      fontWeight: 700
    },
    h5: {
      fontSize: "1.2rem",
      fontWeight: 700
    },
    h6: {
      fontWeight: 700
    },
    button: {
      textTransform: "none",
      fontWeight: 700
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        size: "small"
      }
    },
    MuiSelect: {
      defaultProps: {
        size: "small"
      }
    }
  }
});
