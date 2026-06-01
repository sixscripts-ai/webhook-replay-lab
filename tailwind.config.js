/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0b",
          elevated: "#111113",
          panel: "#16171a",
        },
        border: {
          DEFAULT: "#27282c",
          strong: "#3a3b40",
        },
        fg: {
          DEFAULT: "#e6e7eb",
          muted: "#8b8d94",
          subtle: "#5e6068",
        },
        volt: {
          DEFAULT: "#c6f24e",
          dim: "#9bc534",
          glow: "#d8ff66",
        },
        danger: "#ff5d5d",
        warn: "#f5b042",
        ok: "#3ddc84",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        xxs: ["0.6875rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
};
