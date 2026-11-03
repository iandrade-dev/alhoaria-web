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
        carvao: "#0A0A0A",
        "carvao-leve": "#141414",
        "carvao-borda": "#262626",
        osso: "#F5F5F0",
        "osso-muted": "#A8A8A0",
        creme: "#FFF8E7",
        ouro: "#E8B84A",
        queijo: "#F0C75E",
        macarico: "#FF6A1A",
        madeira: "#5C3D2E",
        "madeira-escura": "#241812",
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
