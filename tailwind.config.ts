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
        chart: {
          green: "#6EE7B7",
          "green-dim": "#34D399",
          amber: "#FBBF24",
          blue: "#60A5FA",
          slate: "#94A3B8",
          dark: "#0F1F1A",
          "dark-card": "#1C302B",
          "dark-grid": "#2D4A42",
        },
      },
    },
  },
  plugins: [],
};
export default config;
