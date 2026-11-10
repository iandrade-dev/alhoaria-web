import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        carvao: "rgb(var(--carvao-rgb) / <alpha-value>)",
        "carvao-leve": "rgb(var(--carvao-leve-rgb) / <alpha-value>)",
        "carvao-borda": "rgb(var(--carvao-borda-rgb) / <alpha-value>)",
        osso: "rgb(var(--osso-rgb) / <alpha-value>)",
        "osso-muted": "rgb(var(--osso-muted-rgb) / <alpha-value>)",
        creme: "rgb(var(--creme-rgb) / <alpha-value>)",
        ouro: "rgb(var(--ouro-rgb) / <alpha-value>)",
        queijo: "rgb(var(--queijo-rgb) / <alpha-value>)",
        macarico: "rgb(var(--macarico-rgb) / <alpha-value>)",
        madeira: "rgb(var(--madeira-rgb) / <alpha-value>)",
        "madeira-escura": "rgb(var(--madeira-escura-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Anton", "sans-serif"],
        sans: ["Inter Variable", "Inter", "sans-serif"],
        hand: ["Caveat Brush", "cursive"],
      },
    },
  },
  plugins: [],
};

export default config;
