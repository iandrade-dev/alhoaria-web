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
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        "card-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.6)",
      },
      animation: {
        "torch-pass": "torchPass 1.6s ease-out forwards",
        "float-slow": "floatSlow 4s ease-in-out infinite",
      },
      keyframes: {
        torchPass: {
          "0%": { opacity: "0", transform: "translateX(-100%)" },
          "50%": { opacity: "0.8" },
          "100%": { opacity: "0", transform: "translateX(200%)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
