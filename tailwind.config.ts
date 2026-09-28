import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce7fd",
          200: "#c0d3fc",
          300: "#94b6fa",
          400: "#618ef6",
          500: "#3d66f0",
          600: "#2a48e5",
          700: "#2236d0",
          800: "#212ea8",
          900: "#152a6f",
          950: "#0b1a4b",
        },
        gold: {
          50: "#fffaeb",
          100: "#fef0c7",
          200: "#fee08a",
          300: "#fdca4d",
          400: "#fcb422",
          500: "#f5930b",
          600: "#d96f06",
          700: "#b44d09",
          800: "#923b0e",
          900: "#78310f",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
