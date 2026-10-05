export const tokens = {
  radius: { sm: 4, md: 6, lg: 10, xl: 14 },
  fontSize: { xs: 10, sm: 11, md: 12, base: 13, lg: 14, xl: 16 },
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  // CSS variable names (used in style={{ color: 'var(--text)' }})
  color: {
    bg: "var(--bg)",
    surface: "var(--surface)",
    border: "var(--border)",
    text: "var(--text)",
    muted: "var(--text-muted)",
    accent: "var(--accent)",
  },
} as const;
