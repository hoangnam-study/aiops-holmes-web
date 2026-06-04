import { Box, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <Box
      sx={{
        fontSize: 14.5,
        lineHeight: 1.7,
        "& p": { my: 1 },
        "& ul, & ol": { pl: 3 },
        "& pre": {
          position: "relative",
          bgcolor: "#242c3b",
          color: "#f7fafc",
          p: 1.5,
          borderRadius: 1,
          overflowX: "auto",
          fontSize: 13
        },
        "& code": {
          bgcolor: "#eef2f6",
          borderRadius: 0.75,
          px: 0.5,
          py: 0.1
        },
        "& pre code": {
          bgcolor: "transparent",
          p: 0
        },
        "& table": {
          borderCollapse: "collapse",
          width: "100%",
          my: 1.5
        },
        "& th, & td": {
          border: "1px solid #dfe5eb",
          p: 1,
          textAlign: "left"
        }
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children, ...props }) {
            const text = String(children).replace(/\[object Object\]/g, "");
            return (
              <Box component="pre" {...props}>
                <Tooltip title="Copy">
                  <IconButton
                    size="small"
                    onClick={() => void navigator.clipboard.writeText(text)}
                    sx={{ position: "absolute", top: 6, right: 6, color: "#f7fafc" }}
                  >
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
                {children}
              </Box>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
